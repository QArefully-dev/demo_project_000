import { navItems } from '@/components/nav/navItems';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Search } from 'lucide-react';

/** Intentional non-functional placeholder for future search feature. */
export function SearchBar() {
  if (!navItems.search?.enabled) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <div className="relative block w-full max-w-[280px]" aria-label="Search products" tabIndex={0} />
          }
        >
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground z-10" />
          <Input disabled type="search" placeholder="Search products..." className="pl-9" />
        </TooltipTrigger>
        <TooltipContent side="bottom">Coming soon</TooltipContent>
      </Tooltip>
    );
  }

  return null;
}
