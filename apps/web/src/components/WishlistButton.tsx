import { navItems } from '@/components/nav/navItems';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart } from 'lucide-react';

/** Intentional non-functional placeholder for future wishlist feature. */
export function WishlistButton() {
  if (!navItems.wishlist?.enabled) {
    return (
      <Button disabled variant="ghost" size="sm" aria-label="Wishlist" className="relative">
        <Heart />
        Wishlist
        <Badge variant="secondary" className="ml-1">
          0
        </Badge>
      </Button>
    );
  }

  return null;
}
