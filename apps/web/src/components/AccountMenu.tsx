import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { LogIn, User } from 'lucide-react';

/**
 * Account menu in the header.
 * Shows Sign In link when anonymous, user menu when authenticated.
 */
export function AccountMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/', { replace: true });
  }

  // Anonymous state
  if (!user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />} aria-label="Account">
          <User />
          Account
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => navigate('/login')}>
            <LogIn className="mr-2 h-4 w-4" />
            Sign In
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Authenticated state
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />} aria-label="Account">
        <User />
        {user.displayName}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">{user.email}</div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/account')}>My Account</DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/orders')}>My Orders</DropdownMenuItem>
        {user.role === 'admin' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/admin/reviews')}>
              Review moderation
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void handleLogout()}>Sign Out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
