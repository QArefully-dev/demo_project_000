import { ErrorMessage } from '@/components/ErrorMessage';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationList } from './NotificationList';

export function NotificationsPage() {
  const { notifications, unreadCount, loading, error, refresh, markRead, markAllRead } =
    useNotifications();
  if (loading && notifications.length === 0) return <LoadingSpinner />;
  if (error && notifications.length === 0)
    return <ErrorMessage message={error} onRetry={() => void refresh()} />;
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="section-eyebrow">Account</p>
          <h1 className="section-heading mt-2">Notifications</h1>
        </div>
        <Button disabled={!unreadCount} onClick={() => void markAllRead()}>
          Mark all as read
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {notifications.length === 0 ? (
        <p className="rounded-lg border py-12 text-center text-muted-foreground">
          You have no notifications.
        </p>
      ) : (
        <NotificationList items={notifications} onMarkRead={(id) => void markRead(id)} />
      )}
    </section>
  );
}
