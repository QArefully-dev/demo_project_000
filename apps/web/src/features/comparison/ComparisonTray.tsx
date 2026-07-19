import { Link } from 'react-router-dom';
import { Button, buttonVariants } from '@/components/ui/button';
import { useComparisonSelection } from './ComparisonSelectionContext';

export function ComparisonTray() {
  const { selectedIds, clear, canCompare, comparePath, capacityStatus } = useComparisonSelection();
  const count = selectedIds.length;

  return (
    <aside
      aria-label="Comparison tray"
      className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-surface-soft px-4 py-3"
    >
      <p className="text-sm font-medium">
        {count} {count === 1 ? 'product' : 'products'} selected for comparison
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {canCompare && comparePath ? (
          <Link to={comparePath} className={buttonVariants({ size: 'sm' })}>
            Compare selected
          </Link>
        ) : (
          <Button size="sm" disabled>
            Compare selected
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={count === 0} onClick={clear}>
          Clear selection
        </Button>
      </div>
      <p role="status" aria-live="polite" className="w-full text-sm text-muted-foreground">
        {capacityStatus === 'at-capacity' ? 'You can compare up to 4 products.' : ''}
      </p>
    </aside>
  );
}
