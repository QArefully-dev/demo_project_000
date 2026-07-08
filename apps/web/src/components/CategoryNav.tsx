import { useSearchParams, Link } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
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
 * Derives categories from live product data and drives catalog
 * filtering via the `?category=` URL search parameter.
 */
export function CategoryNav() {
  const [searchParams] = useSearchParams();
  const activeCategory = searchParams.get('category') ?? '';
  const { products } = useProducts();
  const categories = useCategories(products);

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
                    to="/"
                    {...props}
                    aria-current={activeCategory === '' ? 'page' : undefined}
                    className={cn(props.className, linkClassName(''))}
                  >
                    All
                  </Link>
                )}
              />
              {categories.map((category) => (
                <NavigationMenuLink
                  key={category}
                  render={(props) => (
                    <Link
                      to={`/?category=${category}`}
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
