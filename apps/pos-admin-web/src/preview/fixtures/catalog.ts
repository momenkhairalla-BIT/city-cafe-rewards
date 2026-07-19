/** UI preview fixtures — not production pricing/loyalty authority. */

export type PreviewCategory = 'All' | 'Coffee' | 'Iced Drinks' | 'Tea' | 'Food' | 'Pastries' | 'Favourites';

export interface PreviewMenuItem {
  id: string;
  name: string;
  category: PreviewCategory;
  priceSen: number;
  available: boolean;
  bestSeller?: boolean;
  sku: string;
}

export interface PreviewMember {
  id: string;
  displayName: string;
  kind: 'student' | 'general';
  active: boolean;
  points: number;
  stamps: number;
  stampGoal: number;
  eligibleOffer?: string;
  availableReward?: string;
  rewardExpiry?: string;
}

/** UI-concept only until Team 2 modifier contract approval. */
export interface UiConceptModifierOption {
  id: string;
  label: string;
  priceDeltaSen: number;
}

export interface UiConceptModifierGroup {
  id: string;
  name: string;
  required: boolean;
  min: number;
  max: number;
  options: UiConceptModifierOption[];
}

export const PREVIEW_CATEGORIES: PreviewCategory[] = [
  'All',
  'Favourites',
  'Coffee',
  'Iced Drinks',
  'Tea',
  'Pastries',
  'Food',
];

export const PREVIEW_MENU: PreviewMenuItem[] = [
  { id: 'scl', name: 'Salted Caramel Latte', category: 'Favourites', priceSen: 1290, available: true, bestSeller: true, sku: 'CF-SCL' },
  { id: 'latte', name: 'Latte', category: 'Coffee', priceSen: 1050, available: true, sku: 'CF-LAT' },
  { id: 'americano', name: 'Americano', category: 'Coffee', priceSen: 850, available: true, sku: 'CF-AME' },
  { id: 'capp', name: 'Cappuccino', category: 'Coffee', priceSen: 950, available: true, sku: 'CF-CAP' },
  { id: 'mocha', name: 'Mocha', category: 'Coffee', priceSen: 1150, available: true, sku: 'CF-MOC' },
  { id: 'iced-latte', name: 'Iced Latte', category: 'Iced Drinks', priceSen: 1150, available: true, sku: 'IC-LAT' },
  { id: 'rose-tea', name: 'Rose Lychee Tea', category: 'Tea', priceSen: 980, available: true, sku: 'TE-RLT' },
  { id: 'croissant', name: 'Butter Croissant', category: 'Pastries', priceSen: 750, available: true, bestSeller: true, sku: 'PA-CRO' },
  { id: 'wrap', name: 'Chicken Wrap', category: 'Food', priceSen: 1450, available: false, sku: 'FD-WRP' },
  { id: 'nuts', name: 'Trail Mix Cup', category: 'Food', priceSen: 650, available: true, sku: 'FD-NUT' },
];

export const PREVIEW_MODIFIER_GROUPS: UiConceptModifierGroup[] = [
  {
    id: 'size',
    name: 'Size',
    required: true,
    min: 1,
    max: 1,
    options: [
      { id: 's', label: 'Small', priceDeltaSen: -50 },
      { id: 'm', label: 'Medium', priceDeltaSen: 0 },
      { id: 'l', label: 'Large', priceDeltaSen: 150 },
    ],
  },
  {
    id: 'milk',
    name: 'Milk',
    required: true,
    min: 1,
    max: 1,
    options: [
      { id: 'whole', label: 'Whole milk', priceDeltaSen: 0 },
      { id: 'oat', label: 'Oat milk', priceDeltaSen: 150 },
      { id: 'soy', label: 'Soy milk', priceDeltaSen: 150 },
    ],
  },
  {
    id: 'extras',
    name: 'Extras',
    required: false,
    min: 0,
    max: 3,
    options: [
      { id: 'shot', label: 'Extra shot', priceDeltaSen: 200 },
      { id: 'vanilla', label: 'Vanilla syrup', priceDeltaSen: 100 },
      { id: 'caramel', label: 'Caramel syrup', priceDeltaSen: 100 },
    ],
  },
];

export const PREVIEW_MEMBERS: PreviewMember[] = [
  {
    id: 'm-student',
    displayName: 'Aisyah Lim',
    kind: 'student',
    active: true,
    points: 420,
    stamps: 7,
    stampGoal: 10,
    eligibleOffer: 'Student iced drink RM2 off',
    availableReward: 'Free pastry at 10 stamps',
    rewardExpiry: '31 Aug 2026',
  },
  {
    id: 'm-general',
    displayName: 'Daniel Ong',
    kind: 'general',
    active: true,
    points: 180,
    stamps: 3,
    stampGoal: 10,
    availableReward: 'RM5 voucher',
    rewardExpiry: '15 Sep 2026',
  },
  {
    id: 'm-inactive',
    displayName: 'Inactive Member',
    kind: 'general',
    active: false,
    points: 0,
    stamps: 0,
    stampGoal: 10,
  },
];

export interface PreviewKpi {
  label: string;
  value: string;
  hint: string;
}

export const PREVIEW_OVERVIEW_KPIS: PreviewKpi[] = [
  { label: 'Net sales', value: 'RM 4,820.50', hint: 'Today · sample' },
  { label: 'Orders', value: '126', hint: 'Today · sample' },
  { label: 'Avg order', value: 'RM 38.26', hint: 'Today · sample' },
  { label: 'Member sales', value: '62%', hint: 'vs guest · sample' },
  { label: 'Rewards applied', value: '18', hint: 'Today · sample' },
  { label: 'Open shifts', value: '2', hint: 'Main Cafe' },
  { label: 'Cash sales', value: 'RM 1,640.00', hint: 'Soft POS · sample' },
  { label: 'Variance alerts', value: '1', hint: 'Needs attention' },
];

export const PREVIEW_SALES_ROWS = [
  { order: 'A-10521', when: 'Today 10:14', staff: 'Nadia', salesPoint: 'Main Counter', method: 'Cash', totalSen: 2890, status: 'Completed' },
  { order: 'A-10520', when: 'Today 10:02', staff: 'Nadia', salesPoint: 'Main Counter', method: 'E-wallet', totalSen: 1570, status: 'Completed' },
  { order: 'A-10519', when: 'Today 09:48', staff: 'Hafiz', salesPoint: 'Snack Station', method: 'Card', totalSen: 980, status: 'Completed' },
];

export interface PreviewTerminal {
  id: string;
  code: string;
  branch: string;
  salesPoint: string;
  status: 'active' | 'revoked' | 'pending';
  lastSeen?: string;
}

export const PREVIEW_TERMINALS: PreviewTerminal[] = [
  { id: 't1', code: 'MC-T01', branch: 'Main Cafe', salesPoint: 'Main Counter', status: 'active', lastSeen: 'Today 10:12' },
  { id: 't2', code: 'MC-T02', branch: 'Main Cafe', salesPoint: 'Snack Station', status: 'active', lastSeen: 'Today 09:55' },
  { id: 't3', code: 'MC-T03', branch: 'Main Cafe', salesPoint: 'Main Counter', status: 'pending' },
];

export interface PreviewShiftRow {
  id: string;
  staff: string;
  terminal: string;
  salesPoint: string;
  status: 'open' | 'locked' | 'closed';
  openedAt: string;
  varianceSen: number | null;
}

export const PREVIEW_SHIFT_ROWS: PreviewShiftRow[] = [
  { id: 's1', staff: 'Nadia', terminal: 'MC-T01', salesPoint: 'Main Counter', status: 'open', openedAt: 'Today 08:00', varianceSen: null },
  { id: 's2', staff: 'Hafiz', terminal: 'MC-T02', salesPoint: 'Snack Station', status: 'locked', openedAt: 'Today 07:45', varianceSen: null },
  { id: 's3', staff: 'Aina', terminal: 'MC-T01', salesPoint: 'Main Counter', status: 'closed', openedAt: 'Yesterday 14:00', varianceSen: -350 },
];

export interface PreviewEmployee {
  id: string;
  name: string;
  username: string;
  role: 'staff' | 'admin';
  branches: string[];
  isGlobalManager: boolean;
}

export const PREVIEW_EMPLOYEES: PreviewEmployee[] = [
  { id: 'e1', name: 'Nadia Rahman', username: 'nadia', role: 'staff', branches: ['Main Cafe'], isGlobalManager: false },
  { id: 'e2', name: 'Hafiz Ali', username: 'hafiz', role: 'staff', branches: ['Main Cafe'], isGlobalManager: false },
  { id: 'e3', name: 'Siti Manager', username: 'siti', role: 'admin', branches: ['Main Cafe', 'City Mall'], isGlobalManager: true },
];

export const PREVIEW_SALES_BY_POINT = [
  { point: 'Main Counter', sen: 382050 },
  { point: 'Snack Station', sen: 100000 },
];

export const PREVIEW_HOURLY_SALES = [42, 58, 71, 65, 48, 52, 38, 29];
