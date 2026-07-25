interface NavItem {
  key: string;
  label: string;
  icon: string;
  enabled: boolean;
  className?: string;
}

export const searchItem: NavItem = {
  key: 'search',
  label: 'Search',
  icon: 'Search',
  enabled: false,
};

export const accountItem: NavItem = {
  key: 'account',
  label: 'Account',
  icon: 'User',
  enabled: false,
};

export const wishlistItem: NavItem = {
  key: 'wishlist',
  label: 'Wishlist',
  icon: 'Heart',
  enabled: true,
};

export const bundlesItem: NavItem = {
  key: 'bundles',
  label: 'Bundles',
  icon: 'Package',
  enabled: true,
};

export const navItems: Record<string, NavItem> = {
  search: searchItem,
  account: accountItem,
  wishlist: wishlistItem,
  bundles: bundlesItem,
};
