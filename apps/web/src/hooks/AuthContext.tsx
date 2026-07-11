import { createContext, useContext, type ReactNode } from 'react';
import type { PublicUser } from '@shop/contracts';

/**
 * AuthContext — skeleton (Wave 0).
 * Provides a static unauthenticated state.
 * Real implementation deferred to W1.A.
 */

interface AuthState {
  user: PublicUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: false,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
});

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/** Skeleton provider — always unauthenticated (Wave 0). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const value: AuthState = {
    user: null,
    loading: false,
    login: async () => {},
    signup: async () => {},
    logout: async () => {},
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
