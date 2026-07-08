interface NavItem {
  key: string;
  label: string;
  icon: string;
  enabled: boolean;
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
  enabled: false,
};

export const navItems: Record<string, NavItem> = {
  search: searchItem,
  account: accountItem,
  wishlist: wishlistItem,
};
