import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Notification } from '@shop/contracts/notifications';
import * as notificationsApi from '@/api/notifications';
import { useAuth } from './AuthContext';

type NotificationsContextValue = {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<boolean>;
  markRead: (notificationId: string) => Promise<Notification | false>;
  markAllRead: () => Promise<{ affectedCount: number } | false>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);
const errorMessage = (cause: unknown, fallback: string) =>
  cause instanceof Error && cause.message ? cause.message : fallback;

/** Buyer-scoped inbox state. Async results may only update their originating session. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notificationsRef = useRef<Notification[]>([]);
  const unreadCountRef = useRef(0);
  const stateVersionRef = useRef(0);
  const sessionVersionRef = useRef(0);
  const userIdRef = useRef<string | null>(userId);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  if (userIdRef.current !== userId) {
    userIdRef.current = userId;
    sessionVersionRef.current += 1;
    stateVersionRef.current += 1;
    controllerRef.current?.abort();
  }

  const applyNotifications = useCallback((next: Notification[]) => {
    notificationsRef.current = next;
    if (mountedRef.current) setNotifications(next);
  }, []);
  const applyUnreadCount = useCallback((next: number) => {
    unreadCountRef.current = next;
    if (mountedRef.current) setUnreadCount(next);
  }, []);
  const isCurrentSession = useCallback(
    (sessionVersion: number, expectedUserId: string) =>
      sessionVersion === sessionVersionRef.current && userIdRef.current === expectedUserId,
    [],
  );

  const refresh = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    const sessionVersion = sessionVersionRef.current;
    const version = ++stateVersionRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const page = await notificationsApi.getNotifications({}, controller.signal);
      if (isCurrentSession(sessionVersion, userId) && version === stateVersionRef.current) {
        applyNotifications(page.items);
        applyUnreadCount(page.unreadTotal);
        return true;
      }
      return false;
    } catch (cause) {
      if (
        !isCurrentSession(sessionVersion, userId) ||
        version !== stateVersionRef.current ||
        controller.signal.aborted
      )
        return false;
      setError(errorMessage(cause, 'Unable to load notifications.'));
      return false;
    } finally {
      if (
        isCurrentSession(sessionVersion, userId) &&
        version === stateVersionRef.current &&
        mountedRef.current
      )
        setLoading(false);
    }
  }, [applyNotifications, applyUnreadCount, isCurrentSession, userId]);

  useEffect(() => {
    mountedRef.current = true;
    if (!userId) {
      controllerRef.current?.abort();
      mutationQueueRef.current = Promise.resolve();
      applyNotifications([]);
      applyUnreadCount(0);
      setLoading(false);
      setError(null);
      return;
    }
    void refresh();
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, [applyNotifications, applyUnreadCount, refresh, userId]);

  const enqueueMutation = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const queued = mutationQueueRef.current.then(operation, operation);
    mutationQueueRef.current = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }, []);

  const markRead = useCallback(
    (notificationId: string): Promise<Notification | false> => {
      if (!userId) return Promise.resolve(false);
      const sessionVersion = sessionVersionRef.current;
      return enqueueMutation(async () => {
        if (!isCurrentSession(sessionVersion, userId)) return false;
        const confirmed = notificationsRef.current;
        const confirmedUnread = unreadCountRef.current;
        const target = confirmed.find((item) => item.id === notificationId);
        if (!target || target.readAt !== null) return target ?? false;
        ++stateVersionRef.current;
        const optimistic = confirmed.map((item) =>
          item.id === notificationId ? { ...item, readAt: new Date().toISOString() } : item,
        );
        applyNotifications(optimistic);
        applyUnreadCount(Math.max(0, confirmedUnread - 1));
        setError(null);
        try {
          const updated = await notificationsApi.markNotificationRead(notificationId);
          if (!isCurrentSession(sessionVersion, userId)) return false;
          applyNotifications(optimistic.map((item) => (item.id === updated.id ? updated : item)));
          return updated;
        } catch (cause) {
          if (!isCurrentSession(sessionVersion, userId)) return false;
          applyNotifications(confirmed);
          applyUnreadCount(confirmedUnread);
          setError(errorMessage(cause, 'Unable to mark notification as read.'));
          return false;
        }
      });
    },
    [applyNotifications, applyUnreadCount, enqueueMutation, isCurrentSession, userId],
  );

  const markAllRead = useCallback((): Promise<{ affectedCount: number } | false> => {
    if (!userId) return Promise.resolve(false);
    const sessionVersion = sessionVersionRef.current;
    return enqueueMutation(async () => {
      if (!isCurrentSession(sessionVersion, userId)) return false;
      const confirmed = notificationsRef.current;
      const confirmedUnread = unreadCountRef.current;
      if (!confirmedUnread) return { affectedCount: 0 };
      ++stateVersionRef.current;
      const optimistic = confirmed.map((item) =>
        item.readAt === null ? { ...item, readAt: new Date().toISOString() } : item,
      );
      applyNotifications(optimistic);
      applyUnreadCount(0);
      setError(null);
      try {
        const result = await notificationsApi.markAllNotificationsRead();
        if (!isCurrentSession(sessionVersion, userId)) return false;
        return result;
      } catch (cause) {
        if (!isCurrentSession(sessionVersion, userId)) return false;
        applyNotifications(confirmed);
        applyUnreadCount(confirmedUnread);
        setError(errorMessage(cause, 'Unable to mark notifications as read.'));
        return false;
      }
    });
  }, [applyNotifications, applyUnreadCount, enqueueMutation, isCurrentSession, userId]);

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, loading, error, refresh, markRead, markAllRead }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext(): NotificationsContextValue {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error('useNotificationsContext must be used within NotificationsProvider');
  return value;
}
