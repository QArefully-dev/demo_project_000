import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicUser } from '@shop/contracts/auth';
import { CountryProvider, useCountry } from './CountryContext';
import type { CountryStorage } from '@/lib/countryStorage';
import { readSelectedCountry, writeSelectedCountry } from '@/lib/countryStorage';

vi.mock('@/hooks/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '@/hooks/AuthContext';

function guestUser(): ReturnType<typeof useAuth> {
  return { user: null, loading: false, login: null!, signup: null!, logout: null! };
}

function authenticatedUser(country: string): ReturnType<typeof useAuth> {
  return {
    user: {
      id: '123',
      email: 'test@example.com',
      displayName: 'Test',
      role: 'customer',
      country,
    } as PublicUser,
    loading: false,
    login: null!,
    signup: null!,
    logout: null!,
  };
}

function memoryStorage(): CountryStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

describe('CountryContext', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('defaults to DEFAULT_GUEST_COUNTRY for a guest visitor with no stored selection', () => {
    vi.mocked(useAuth).mockReturnValue(guestUser());
    const storage = memoryStorage();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CountryProvider storage={storage}>{children}</CountryProvider>
    );
    const { result } = renderHook(() => useCountry(), { wrapper });
    expect(result.current.activeCountry).toBe('US');
    expect(result.current.isAccountBound).toBe(false);
  });

  it('reads a stored guest selection on mount', () => {
    vi.mocked(useAuth).mockReturnValue(guestUser());
    const storage = memoryStorage();
    writeSelectedCountry(storage, 'DE');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CountryProvider storage={storage}>{children}</CountryProvider>
    );
    const { result } = renderHook(() => useCountry(), { wrapper });
    expect(result.current.activeCountry).toBe('DE');
    expect(result.current.isAccountBound).toBe(false);
  });

  it('persists a guest country change through selectCountry', () => {
    vi.mocked(useAuth).mockReturnValue(guestUser());
    const storage = memoryStorage();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CountryProvider storage={storage}>{children}</CountryProvider>
    );
    const { result } = renderHook(() => useCountry(), { wrapper });

    act(() => {
      result.current.selectCountry('FR');
    });

    expect(result.current.activeCountry).toBe('FR');
    expect(readSelectedCountry(storage)).toBe('FR');
  });

  it('prevents selectCountry from overriding the account country', () => {
    vi.mocked(useAuth).mockReturnValue(authenticatedUser('UK'));
    const storage = memoryStorage();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CountryProvider storage={storage}>{children}</CountryProvider>
    );
    const { result } = renderHook(() => useCountry(), { wrapper });

    expect(result.current.activeCountry).toBe('UK');
    expect(result.current.isAccountBound).toBe(true);

    act(() => {
      result.current.selectCountry('US');
    });

    expect(result.current.activeCountry).toBe('UK');
    expect(readSelectedCountry(storage)).toBe('US');
  });

  it('account country wins when user is present', () => {
    vi.mocked(useAuth).mockReturnValue(authenticatedUser('CN'));
    const storage = memoryStorage();
    writeSelectedCountry(storage, 'US');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CountryProvider storage={storage}>{children}</CountryProvider>
    );
    const { result } = renderHook(() => useCountry(), { wrapper });
    expect(result.current.activeCountry).toBe('CN');
    expect(result.current.isAccountBound).toBe(true);
  });

  it('exposes countryStorage for test inspection', () => {
    vi.mocked(useAuth).mockReturnValue(guestUser());
    const storage = memoryStorage();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CountryProvider storage={storage}>{children}</CountryProvider>
    );
    const { result } = renderHook(() => useCountry(), { wrapper });
    expect(result.current.countryStorage).toBe(storage);
  });
});
