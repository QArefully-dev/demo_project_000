import { Button } from '@/components/ui/button';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      <p className="text-destructive">{message}</p>
      {onRetry && (
        <Button variant="default" size="sm" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}
