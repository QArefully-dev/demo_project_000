import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { saveOrderAsSavedList } from '@/api/savedLists';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/AuthContext';

function message(error: unknown) {
  const code =
    error instanceof ApiError ? (error.response as { code?: string } | null)?.code : undefined;
  if (code === 'NAME_TAKEN')
    return 'A saved list with this name already exists. Choose a different name.';
  return error instanceof Error ? error.message : 'Unable to save this order as a list.';
}
export function SaveOrderAsListButton({ orderId }: { orderId: string }) {
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listId, setListId] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const save = async () => {
    if (!name.trim() || pending) return;
    if (!user) {
      navigate('/login', { state: { from: `${location.pathname}${location.search}` } });
      return;
    }
    setPending(true);
    setError(null);
    try {
      setListId((await saveOrderAsSavedList(orderId, { name: name.trim() })).listId);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setPending(false);
    }
  };
  return (
    <section aria-label="Save order as a list" className="rounded-lg border p-4 space-y-2">
      <p className="font-medium">Save this order as a list</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {listId ? (
        <Link className="text-sm font-medium underline" to={`/lists/${listId}`}>
          View saved list
        </Link>
      ) : (
        <div className="flex flex-wrap gap-2">
          <input
            aria-label="List name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="h-9 rounded-md border px-2"
            placeholder="List name"
            disabled={pending}
          />
          <Button
            type="button"
            variant="outline"
            disabled={!name.trim() || pending}
            onClick={() => void save()}
          >
            {pending ? 'Saving…' : 'Save list'}
          </Button>
        </div>
      )}
    </section>
  );
}
