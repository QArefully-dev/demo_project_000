import { navItems } from '@/components/nav/navItems';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { User } from 'lucide-react';

/** Intentional non-functional placeholder for future auth/account feature. */
export function AccountMenu() {
  if (!navItems.account?.enabled) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />} aria-label="Account">
          <User />
          Account
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled>Sign In</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>My Account</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return null;
}
