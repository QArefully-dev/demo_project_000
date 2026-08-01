import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { SavedListDetail } from '@shop/contracts/saved-lists';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useCartContext } from '@/hooks/CartContext';
import { useSavedLists } from '@/hooks/useSavedLists';
import { SavedListOutcomeList } from './SavedListOutcomeList';
import { SAVED_LIST_ADD_FAILURE_MESSAGE, type SavedListAddState } from './savedListsPresentation';

const pounds = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const money = (cents: number) => pounds.format(cents / 100);

/** Server-resolved saved-list detail. Prices, availability and MOQ remain API facts. */
export function SavedListDetailPage() {
  const { listId = '' } = useParams();
  const { loadList, updateItem, removeItem, error: contextError } = useSavedLists();
  const { addSavedListToCart, isActionPending, isCartAvailable } = useCartContext();
  const [list, setList] = useState<SavedListDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutatingItem, setMutatingItem] = useState<string | null>(null);
  const [addState, setAddState] = useState<SavedListAddState>({ kind: 'idle' });
  const pendingAdd = isActionPending(listId, 'saved-list-add');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    void loadList(listId).then((result) => {
      if (!active) return;
      if (result) setList(result);
      else setLoadError('Unable to load this saved list.');
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [listId, loadList]);

  async function changeQuantity(itemId: string, quantity: number) {
    if (!list || !Number.isSafeInteger(quantity) || quantity < 1) return;
    setMutatingItem(itemId);
    const next = await updateItem(list.listId, itemId, { quantity });
    setMutatingItem(null);
    if (next) setList(next);
  }

  async function remove(itemId: string) {
    if (!list) return;
    setMutatingItem(itemId);
    const removed = await removeItem(list.listId, itemId);
    setMutatingItem(null);
    if (removed)
      setList((current) =>
        current
          ? { ...current, items: current.items.filter((item) => item.itemId !== itemId) }
          : current,
      );
  }

  async function addToCart() {
    if (!list || pendingAdd || !isCartAvailable) return;
    setAddState({ kind: 'pending' });
    const response = await addSavedListToCart(list.listId);
    setAddState(
      response
        ? { kind: 'result', response }
        : { kind: 'error', message: SAVED_LIST_ADD_FAILURE_MESSAGE },
    );
  }

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  if (loadError || !list)
    return (
      <div className="mx-auto max-w-3xl">
        <p role="alert" className="rounded-md border border-destructive/40 p-3 text-destructive">
          {loadError ?? contextError ?? 'Saved list not found.'}
        </p>
        <Link className="mt-4 inline-block underline" to="/lists">
          Back to saved lists
        </Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl pb-12">
      <Link className="text-sm underline underline-offset-4" to="/lists">
        Back to saved lists
      </Link>
      <header className="mb-6 mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-eyebrow">Saved list</p>
          <h1 className="section-heading mt-2">{list.name}</h1>
        </div>
        <Button
          onClick={() => void addToCart()}
          disabled={!isCartAvailable || pendingAdd || list.items.length === 0}
        >
          {pendingAdd ? 'Adding to cart…' : 'Add list to cart'}
        </Button>
      </header>
      {contextError && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {contextError}
        </p>
      )}
      {list.items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          This saved list is empty.
        </div>
      ) : (
        <ul className="space-y-3" aria-label={`${list.name} items`}>
          {list.items.map((item) => (
            <li key={item.itemId} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    className="font-medium underline underline-offset-4"
                    to={`/products/${item.productId}`}
                  >
                    {item.productName}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {item.label} · {item.sku}
                  </p>
                  <p className="mt-1 text-sm">
                    {item.unitPriceCents === null
                      ? 'Price unavailable'
                      : `${money(item.unitPriceCents)} per pack`}{' '}
                    {item.perTonneCents === null ? '' : `· ${money(item.perTonneCents)} / tonne`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    MOQ: {item.moqSacks} sacks ·{' '}
                    {item.availableToSell
                      ? item.backorderable
                        ? 'Available to backorder'
                        : 'Available'
                      : 'Unavailable'}
                    {!item.active ? ' · Retired' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`saved-list-quantity-${item.itemId}`}>
                    Quantity for {item.productName}
                  </label>
                  <input
                    id={`saved-list-quantity-${item.itemId}`}
                    type="number"
                    min="1"
                    defaultValue={item.quantity}
                    disabled={mutatingItem === item.itemId}
                    onBlur={(event) => void changeQuantity(item.itemId, Number(event.target.value))}
                    className="h-8 w-20 rounded-md border bg-background px-2 text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={mutatingItem === item.itemId}
                    onClick={() => void remove(item.itemId)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6">
        <SavedListOutcomeList state={addState} />
      </div>
    </div>
  );
}
