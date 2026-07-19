import { Button } from '@/components/ui/button';
import { useComparisonSelection } from './ComparisonSelectionContext';

interface CompareProductButtonProps {
  productId: string;
  productName?: string;
}

export function CompareProductButton({ productId, productName }: CompareProductButtonProps) {
  const { isSelected, toggle } = useComparisonSelection();
  const selected = isSelected(productId);
  const label = productName ? `Compare ${productName}` : 'Compare product';

  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={selected}
      aria-label={label}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle(productId);
      }}
    >
      {selected ? 'Selected for comparison' : 'Compare'}
    </Button>
  );
}
