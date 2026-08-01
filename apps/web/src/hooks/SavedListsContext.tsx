import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AddSavedListItemBody,
  CreateSavedListBody,
  RenameSavedListBody,
  SavedListDetail,
  SavedListSummary,
  UpdateSavedListItemBody,
} from '@shop/contracts/saved-lists';
import * as savedListsApi from '@/api/savedLists';
import { ApiError } from '@/api/client';
import { useAuth } from './AuthContext';

type SavedListsContextValue = {
  /** All list summaries, including the default list. */
  lists: SavedListSummary[];
  /** Compatibility alias for consumers introduced before the list page. */
  savedLists: SavedListSummary[];
  defaultList: SavedListDetail | null;
  savedVariantIds: ReadonlySet<number>;
  /** Compatibility alias for the saved indicator. */
  defaultVariantIds: ReadonlySet<number>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<boolean>;
  loadList: (listId: string) => Promise<SavedListDetail | false>;
  toggleDefaultSave: (variantId: number, quantity?: number) => Promise<boolean>;
  toggleDefaultVariant: (variantId: number, quantity?: number) => Promise<boolean>;
  createList: (body: CreateSavedListBody) => Promise<SavedListDetail | false>;
  renameList: (listId: string, body: RenameSavedListBody) => Promise<SavedListDetail | false>;
  deleteList: (listId: string) => Promise<boolean>;
  addItem: (listId: string, body: AddSavedListItemBody) => Promise<SavedListDetail | false>;
  updateItem: (
    listId: string,
    itemId: string,
    body: UpdateSavedListItemBody,
  ) => Promise<SavedListDetail | false>;
  removeItem: (listId: string, itemId: string) => Promise<boolean>;
};

const SavedListsContext = createContext<SavedListsContextValue | null>(null);

const SAVED_LIST_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  NAME_TAKEN: 'A saved list with this name already exists. Choose a different name.',
  LIST_LIMIT_REACHED:
    'You have reached the saved-list limit. Remove a list before creating another.',
};

const errorMessage = (error: unknown, fallback: string) => {
  if (error instanceof ApiError) {
    const code = (error.response as { code?: unknown } | null)?.code;
    if (typeof code === 'string' && code in SAVED_LIST_ERROR_MESSAGES)
      return SAVED_LIST_ERROR_MESSAGES[code]!;
  }
  return error instanceof Error ? error.message : fallback;
};

/** Shared saved-list state. Anonymous buyers never request saved-list data. */
export function SavedListsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [lists, setLists] = useState<SavedListSummary[]>([]);
  const [defaultList, setDefaultList] = useState<SavedListDetail | null>(null);
  const [savedVariantIds, setSavedVariantIds] = useState<ReadonlySet<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const defaultListRef = useRef<SavedListDetail | null>(null);
  const listsRef = useRef<SavedListSummary[]>([]);
  const savedVariantIdsRef = useRef<ReadonlySet<number>>(new Set());
  const mutationQueueRef = useRef(Promise.resolve());
  const mountedRef = useRef(true);

  const applyLists = useCallback((next: SavedListSummary[]) => {
    listsRef.current = next;
    if (mountedRef.current) setLists(next);
  }, []);
  const applyDefault = useCallback((next: SavedListDetail | null) => {
    defaultListRef.current = next;
    if (mountedRef.current) {
      setDefaultList(next);
      const ids = new Set(next?.items.map((item) => item.variantId) ?? []);
      savedVariantIdsRef.current = ids;
      setSavedVariantIds(ids);
    }
  }, []);
  const mergeDetail = useCallback(
    (detail: SavedListDetail) => {
      applyLists(
        listsRef.current.some((list) => list.listId === detail.listId)
          ? listsRef.current.map((list) =>
              list.listId === detail.listId
                ? {
                    ...list,
                    name: detail.name,
                    isDefault: detail.isDefault,
                    itemCount: detail.items.length,
                    updatedAt: detail.updatedAt,
                  }
                : list,
            )
          : [
              ...listsRef.current,
              {
                listId: detail.listId,
                name: detail.name,
                isDefault: detail.isDefault,
                itemCount: detail.items.length,
                createdAt: detail.createdAt,
                updatedAt: detail.updatedAt,
              },
            ],
      );
      if (detail.isDefault || defaultListRef.current?.listId === detail.listId)
        applyDefault(detail);
    },
    [applyDefault, applyLists],
  );

  const refresh = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    setLoading(true);
    setError(null);
    try {
      const nextLists = await savedListsApi.getSavedLists();
      const defaultSummary = nextLists.find((list) => list.isDefault);
      const detail = defaultSummary
        ? await savedListsApi.getSavedList(defaultSummary.listId)
        : null;
      applyLists(nextLists);
      applyDefault(detail);
      return true;
    } catch (cause) {
      setError(errorMessage(cause, 'Unable to load saved lists.'));
      return false;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [applyDefault, applyLists, user]);

  useEffect(() => {
    mountedRef.current = true;
    if (!user) {
      mutationQueueRef.current = Promise.resolve();
      applyLists([]);
      applyDefault(null);
      setError(null);
      setLoading(false);
      return;
    }
    void refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [applyDefault, applyLists, refresh, user]);

  const loadList = useCallback(
    async (listId: string): Promise<SavedListDetail | false> => {
      if (!user) return false;
      try {
        const detail = await savedListsApi.getSavedList(listId);
        mergeDetail(detail);
        return detail;
      } catch (cause) {
        setError(errorMessage(cause, 'Unable to load saved list.'));
        return false;
      }
    },
    [mergeDetail, user],
  );

  const toggleDefaultSave = useCallback(
    (variantId: number, quantity = 1): Promise<boolean> => {
      if (!user || !defaultListRef.current) return Promise.resolve(false);
      const optimisticIds = new Set(savedVariantIdsRef.current);
      if (optimisticIds.has(variantId)) optimisticIds.delete(variantId);
      else optimisticIds.add(variantId);
      savedVariantIdsRef.current = optimisticIds;
      setSavedVariantIds(optimisticIds);
      // Queue writes. A completion always reconciles the complete server detail before the next
      // intent runs, so an inverted response order cannot lose a successfully saved variant.
      const operation = mutationQueueRef.current.then(async () => {
        const current = defaultListRef.current;
        if (!current) return false;
        const item = current.items.find((entry) => entry.variantId === variantId);
        try {
          const updated = item
            ? (await savedListsApi.removeSavedListItem(current.listId, item.itemId),
              {
                ...current,
                items: current.items.filter((entry) => entry.itemId !== item.itemId),
              })
            : await savedListsApi.addSavedListItem(current.listId, { variantId, quantity });
          mergeDetail(updated);
          return true;
        } catch (cause) {
          // `current` is the last confirmed server snapshot: restoring it is an optimistic rollback.
          applyDefault(current);
          setError(errorMessage(cause, 'Unable to update saved item.'));
          return false;
        }
      });
      mutationQueueRef.current = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    },
    [applyDefault, mergeDetail, user],
  );

  const createList = useCallback(
    async (body: CreateSavedListBody) => {
      if (!user) return false;
      try {
        const detail = await savedListsApi.createSavedList(body);
        mergeDetail(detail);
        return detail;
      } catch (cause) {
        setError(errorMessage(cause, 'Unable to create saved list.'));
        return false;
      }
    },
    [mergeDetail, user],
  );
  const renameList = useCallback(
    async (listId: string, body: RenameSavedListBody) => {
      if (!user) return false;
      try {
        const detail = await savedListsApi.renameSavedList(listId, body);
        mergeDetail(detail);
        return detail;
      } catch (cause) {
        setError(errorMessage(cause, 'Unable to rename saved list.'));
        return false;
      }
    },
    [mergeDetail, user],
  );
  const deleteList = useCallback(
    async (listId: string) => {
      if (!user) return false;
      try {
        await savedListsApi.deleteSavedList(listId);
        applyLists(listsRef.current.filter((list) => list.listId !== listId));
        if (defaultListRef.current?.listId === listId) applyDefault(null);
        return true;
      } catch (cause) {
        setError(errorMessage(cause, 'Unable to delete saved list.'));
        return false;
      }
    },
    [applyDefault, applyLists, user],
  );
  const addItem = useCallback(
    async (listId: string, body: AddSavedListItemBody) => {
      if (!user) return false;
      try {
        const detail = await savedListsApi.addSavedListItem(listId, body);
        mergeDetail(detail);
        return detail;
      } catch (cause) {
        setError(errorMessage(cause, 'Unable to add saved item.'));
        return false;
      }
    },
    [mergeDetail, user],
  );
  const updateItem = useCallback(
    async (listId: string, itemId: string, body: UpdateSavedListItemBody) => {
      if (!user) return false;
      try {
        const detail = await savedListsApi.updateSavedListItem(listId, itemId, body);
        mergeDetail(detail);
        return detail;
      } catch (cause) {
        setError(errorMessage(cause, 'Unable to update saved item.'));
        return false;
      }
    },
    [mergeDetail, user],
  );
  const removeItem = useCallback(
    async (listId: string, itemId: string) => {
      if (!user) return false;
      try {
        await savedListsApi.removeSavedListItem(listId, itemId);
        const current = defaultListRef.current;
        if (current?.listId === listId)
          mergeDetail({
            ...current,
            items: current.items.filter((item) => item.itemId !== itemId),
          });
        return true;
      } catch (cause) {
        setError(errorMessage(cause, 'Unable to remove saved item.'));
        return false;
      }
    },
    [mergeDetail, user],
  );

  return (
    <SavedListsContext.Provider
      value={{
        lists,
        savedLists: lists,
        defaultList,
        savedVariantIds,
        defaultVariantIds: savedVariantIds,
        loading,
        error,
        refresh,
        loadList,
        toggleDefaultSave,
        toggleDefaultVariant: toggleDefaultSave,
        createList,
        renameList,
        deleteList,
        addItem,
        updateItem,
        removeItem,
      }}
    >
      {children}
    </SavedListsContext.Provider>
  );
}

export function useSavedListsContext(): SavedListsContextValue {
  const value = useContext(SavedListsContext);
  if (!value) throw new Error('useSavedListsContext must be used within SavedListsProvider');
  return value;
}
