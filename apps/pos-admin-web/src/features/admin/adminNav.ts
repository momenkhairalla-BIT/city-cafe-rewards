export interface AdminNavItem {
  label: string;
  path: string;
}

export interface AdminNavGroup {
  title: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', path: '/admin' },
      { label: 'Live Ops', path: '/admin/live' },
    ],
  },
  {
    title: 'Reports',
    items: [
      { label: 'Sales', path: '/admin/reports/sales' },
      { label: 'Transactions', path: '/admin/reports/transactions' },
      { label: 'Products', path: '/admin/reports/products' },
      { label: 'Members', path: '/admin/reports/members' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Branches', path: '/admin/operations/branches' },
      { label: 'Terminals', path: '/admin/operations/terminals' },
      { label: 'Shifts', path: '/admin/operations/shifts' },
      { label: 'Employees', path: '/admin/operations/employees' },
    ],
  },
  {
    title: 'Catalogue',
    items: [
      { label: 'Menu', path: '/admin/catalogue/menu' },
      { label: 'Categories', path: '/admin/catalogue/categories' },
      { label: 'Variants', path: '/admin/catalogue/variants' },
    ],
  },
  {
    title: 'Rewards',
    items: [
      { label: 'Loyalty', path: '/admin/rewards/loyalty' },
      { label: 'Stamps', path: '/admin/rewards/stamps' },
      { label: 'Offers', path: '/admin/rewards/offers' },
      { label: 'Campaigns', path: '/admin/rewards/campaigns' },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Audit', path: '/admin/system/audit' },
      { label: 'Integrations', path: '/admin/system/integrations' },
      { label: 'Settings', path: '/admin/system/settings' },
    ],
  },
];

export function adminPageTitle(pathname: string): string {
  for (const group of ADMIN_NAV) {
    const item = group.items.find((i) => i.path === pathname);
    if (item) return item.label;
  }
  return 'Admin';
}
