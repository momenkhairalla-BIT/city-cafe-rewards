export interface CartModifierSelection {
  groupId: string;
  optionIds: string[];
}

export interface CartLine {
  id: string;
  menuItemId: string;
  name: string;
  unitPriceSen: number;
  qty: number;
  modifiers: CartModifierSelection[];
  modifierSummary?: string;
}

export function lineTotalSen(line: CartLine): number {
  return line.unitPriceSen * line.qty;
}

export function cartTotalSen(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + lineTotalSen(line), 0);
}

export function newCartLineId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
