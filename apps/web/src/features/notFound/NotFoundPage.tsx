import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/** 404 page shown for unknown routes. */
export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <h1 className="text-6xl font-extrabold text-muted-foreground/30">404</h1>
      <h2 className="text-xl font-semibold">Page not found</h2>
      <p className="text-muted-foreground">
        The page you are looking for does not exist or has been moved.
      </p>
      <Button nativeButton={false} render={(props) => <Link to="/" {...props} />}>
        Back to Home
      </Button>
    </div>
  );
}
