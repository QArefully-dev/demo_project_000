import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSavedLists } from '@/hooks/useSavedLists';

/** Reusable picker for product and cart entry points to save one variant to a named list. */
export function SavedListPicker({
  variantId,
  quantity = 1,
  onSaved,
}: {
  variantId: number;
  quantity?: number;
  onSaved?: (listId: string) => void;
}) {
  const { lists, addItem, createList, error: contextError } = useSavedLists();
  const [selectedListId, setSelectedListId] = useState('');
  const [newName, setNewName] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Context updates after a failed mutation. Reflect that next render instead of reading the
  // stale closure from the submission that triggered it.
  useEffect(() => {
    if (contextError) setMessage(contextError);
  }, [contextError]);

  async function saveToExisting() {
    if (!selectedListId) return;
    setPending(true);
    setMessage(null);
    const saved = await addItem(selectedListId, { variantId, quantity });
    setPending(false);
    if (saved) onSaved?.(saved.listId);
  }

  async function createAndSave() {
    if (!newName.trim()) return;
    setPending(true);
    setMessage(null);
    const list = await createList({ name: newName.trim() });
    if (!list) {
      setPending(false);
      return;
    }
    const saved = await addItem(list.listId, { variantId, quantity });
    setPending(false);
    if (saved) {
      setNewName('');
      onSaved?.(saved.listId);
    }
  }

  return (
    <section aria-label="Save to a list" className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium">Save to a list</p>
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
      {lists.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="saved-list-picker-existing">
            Saved list
          </label>
          <select
            id="saved-list-picker-existing"
            value={selectedListId}
            onChange={(event) => setSelectedListId(event.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-sm"
            disabled={pending}
          >
            <option value="">Choose a list</option>
            {lists.map((list) => (
              <option key={list.listId} value={list.listId}>
                {list.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            onClick={() => void saveToExisting()}
            disabled={!selectedListId || pending}
          >
            {pending ? 'Saving…' : 'Save to selected list'}
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="saved-list-picker-name">
          New list name
        </label>
        <input
          id="saved-list-picker-name"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          maxLength={80}
          placeholder="New list name"
          className="h-8 rounded-md border bg-background px-2 text-sm"
          disabled={pending}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => void createAndSave()}
          disabled={!newName.trim() || pending}
        >
          Create list and save
        </Button>
      </div>
    </section>
  );
}
