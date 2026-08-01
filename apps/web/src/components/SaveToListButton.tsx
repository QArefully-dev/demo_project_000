import { useState } from 'react';
import { Heart } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/AuthContext';
import { useSavedLists } from '@/hooks/useSavedLists';
import { cn } from '@/lib/utils';

/** Default-list heart control for a concrete purchasable variant. */
export function SaveToListButton({
  variantId,
  quantity = 1,
}: {
  variantId?: number;
  quantity?: number;
}) {
  const { user } = useAuth();
  const { savedVariantIds, toggleDefaultSave, loading, error } = useSavedLists();
  const navigate = useNavigate();
  const location = useLocation();
  const saved = variantId !== undefined && savedVariantIds.has(variantId);
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const onClick = async () => {
    if (!user) {
      navigate('/login', { state: { from: `${location.pathname}${location.search}` } });
      return;
    }
    if (variantId === undefined || pending) return;
    setPending(true);
    setSaveError(null);
    const succeeded = await toggleDefaultSave(variantId, quantity);
    if (!succeeded)
      setSaveError(error ?? 'Unable to update the default saved list. Please try again.');
    setPending(false);
  };

  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={variantId === undefined || loading || pending}
        onClick={() => void onClick()}
        aria-label={saved ? 'Remove from default saved list' : 'Save to default list'}
      >
        <Heart className={cn('size-5', saved && 'fill-red-500 text-red-500')} />
      </Button>
      {saveError && (
        <p className="sr-only" role="alert">
          {saveError}
        </p>
      )}
    </div>
  );
}
