import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

/**
 * Functional search bar with 300ms debounce.
 * Navigates to the catalog page with the search query.
 */
export function SearchBar() {
  const [searchParams] = useSearchParams();
  const currentQ = searchParams.get('q') ?? '';
  const [localValue, setLocalValue] = useState(currentQ);
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  // Sync local state when URL q param changes externally
  useEffect(() => {
    setLocalValue(currentQ);
  }, [currentQ]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const navigateToCatalog = useCallback(
    (q: string) => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      // Preserve current category if present
      const category = searchParams.get('category');
      if (category) params.set('category', category);
      navigate(`/catalog?${params.toString()}`);
    },
    [navigate, searchParams],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalValue(value);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (mountedRef.current) navigateToCatalog(value);
      }, 300);
    },
    [navigateToCatalog],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        if (timerRef.current) clearTimeout(timerRef.current);
        navigateToCatalog(localValue);
      }
    },
    [navigateToCatalog, localValue],
  );

  return (
    <div className="relative w-full max-w-[280px]" aria-label="Search products">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground z-10" />
      <Input
        type="search"
        placeholder="Search products..."
        className="pl-9"
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
