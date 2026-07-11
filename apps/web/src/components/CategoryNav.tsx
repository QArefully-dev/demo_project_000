import { useSearchParams, Link } from 'react-router-dom';
import { useCategories } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from '@/components/ui/navigation-menu';

/**
 * Functional category filter navigation.
 * Fetches categories from the API and drives catalog
 * filtering via the `?category=` URL search parameter.
 */
export function CategoryNav() {
  const [searchParams] = useSearchParams();
  const activeCategory = searchParams.get('category') ?? '';
  const { categories, isLoading } = useCategories();

  const linkClassName = (category: string) =>
    cn(activeCategory === category && 'font-semibold bg-muted/50');

  return (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Shop</NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="flex min-w-[140px] flex-col p-1">
              <NavigationMenuLink
                render={(props) => (
                  <Link
                    to="/catalog"
                    {...props}
                    aria-current={activeCategory === '' ? 'page' : undefined}
                    className={cn(props.className, linkClassName(''))}
                  >
                    All
                  </Link>
                )}
              />
              {!isLoading &&
                categories.map((category) => (
                  <NavigationMenuLink
                    key={category}
                    render={(props) => (
                      <Link
                        to={`/catalog?category=${category}`}
                        {...props}
                        aria-current={activeCategory === category ? 'page' : undefined}
                        className={cn(props.className, linkClassName(category))}
                      >
                        {category}
                      </Link>
                    )}
                  />
                ))}
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
