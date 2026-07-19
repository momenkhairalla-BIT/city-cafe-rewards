import { useMemo, useState } from 'react';
import type { EmployeeIdentity, ShiftSummary, TerminalLocation } from '../../auth/types';
import {
  PREVIEW_CATEGORIES,
  PREVIEW_MENU,
  PREVIEW_MODIFIER_GROUPS,
  PREVIEW_SALES_ROWS,
  type PreviewCategory,
  type PreviewMember,
  type PreviewMenuItem,
} from '../../preview/fixtures/catalog';
import { formatRmFromSen, formatRm } from '../../shared/formatting/money';
import { formatKlDateTime } from '../../shared/formatting/datetime';
import { EmptyState } from '../../shared/components/EmptyState';
import { MemberPanel } from './MemberPanel';
import { ModifierSheet } from './ModifierSheet';
import { PaymentPanel } from './PaymentPanel';
import {
  cartTotalSen,
  newCartLineId,
  type CartLine,
} from './cartTypes';
import './pos.css';

type RailId = 'sale' | 'orders' | 'member' | 'shift' | 'terminal' | 'help';

interface Props {
  employee: EmployeeIdentity;
  location: TerminalLocation;
  shift: ShiftSummary;
  onLock: () => void;
  onCloseRequest: () => void;
  onLogout: () => void;
  busy?: boolean;
}

const RAIL_ITEMS: { id: RailId; label: string }[] = [
  { id: 'sale', label: 'New Sale' },
  { id: 'orders', label: 'Orders' },
  { id: 'member', label: 'Member' },
  { id: 'shift', label: 'Shift' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'help', label: 'Help' },
];

function RailIcon({ id }: { id: RailId }) {
  const paths: Record<RailId, string> = {
    sale: 'M4 4h16v4H4zm0 6h10v4H4zm0 6h14v4H4',
    orders: 'M6 4h12v16H6zm2 2v12h8V6',
    member: 'M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-8 10a8 8 0 0 1 16 0',
    shift: 'M12 2v4l4 2-4 2v4l-4-2 4-2V2',
    terminal: 'M4 6h16v10H4zm4 14h8',
    help: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-2h2zm0-4h-2a3 3 0 1 1 3-3',
  };
  return (
    <svg className="aida-rail__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[id]} fill="currentColor" />
    </svg>
  );
}

export function CounterWorkspace({
  employee,
  location,
  shift,
  onLock,
  onCloseRequest,
  onLogout,
  busy = false,
}: Props) {
  const [rail, setRail] = useState<RailId>('sale');
  const [category, setCategory] = useState<PreviewCategory>('All');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [member, setMember] = useState<PreviewMember | null>(null);
  const [modifierItem, setModifierItem] = useState<PreviewMenuItem | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false);

  const filteredMenu = useMemo(() => {
    let items = PREVIEW_MENU;
    if (category !== 'All') {
      items = items.filter((i) => i.category === category || (category === 'Favourites' && i.bestSeller));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
    }
    return items;
  }, [category, search]);

  function addToCart(item: PreviewMenuItem) {
    if (!item.available) return;
    setModifierItem(item);
  }

  function confirmModifier(
    selections: Record<string, string[]>,
    unitPriceSen: number,
    summary: string,
  ) {
    if (!modifierItem) return;
    const modifiers = Object.entries(selections).map(([groupId, optionIds]) => ({ groupId, optionIds }));
    setCart((prev) => [
      ...prev,
      {
        id: newCartLineId(),
        menuItemId: modifierItem.id,
        name: modifierItem.name,
        unitPriceSen,
        qty: 1,
        modifiers,
        modifierSummary: summary || undefined,
      },
    ]);
    setModifierItem(null);
    setRail('sale');
  }

  function updateQty(lineId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.id === lineId ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    );
  }

  function clearSale() {
    setCart([]);
    setMember(null);
    setShowPayment(false);
    setRail('sale');
  }

  const totalSen = cartTotalSen(cart);

  return (
    <div className="counter-workspace">
      <nav className="aida-rail" aria-label="POS navigation">
        <p className="aida-rail__brand">Aida</p>
        <ul>
          {RAIL_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`aida-rail__btn ${rail === item.id ? 'aida-rail__btn--active' : ''}`}
                onClick={() => {
                  setRail(item.id);
                  if (item.id !== 'sale') setShowPayment(false);
                }}
              >
                <RailIcon id={item.id} />
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <main className="menu-gallery">
        {rail === 'sale' && !showPayment && (
          <>
            <header className="menu-gallery__header">
              <h2>Menu</h2>
              <label htmlFor="menu-search" className="visually-hidden">Search menu</label>
              <input
                id="menu-search"
                type="search"
                placeholder="Search products…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </header>
            <div className="menu-gallery__tabs" role="tablist" aria-label="Categories">
              {PREVIEW_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={category === cat}
                  className={`menu-tab ${category === cat ? 'menu-tab--active' : ''}`}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="menu-gallery__grid">
              {filteredMenu.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`product-card ${!item.available ? 'product-card--sold-out' : ''}`}
                  disabled={!item.available}
                  onClick={() => addToCart(item)}
                >
                  {item.bestSeller && <span className="product-card__badge">Best seller</span>}
                  <span className="product-card__name">{item.name}</span>
                  <span className="product-card__price">{formatRmFromSen(item.priceSen)}</span>
                  {!item.available && <span className="product-card__sold-out">Sold out</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {rail === 'orders' && (
          <section className="orders-preview" aria-labelledby="orders-preview-title">
            <h2 id="orders-preview-title">Recent orders</h2>
            <p className="form-hint">Preview history — limited to sample rows.</p>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>When</th>
                  <th>Staff</th>
                  <th>Point</th>
                  <th>Method</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {PREVIEW_SALES_ROWS.map((row) => (
                  <tr key={row.order}>
                    <td>{row.order}</td>
                    <td>{row.when}</td>
                    <td>{row.staff}</td>
                    <td>{row.salesPoint}</td>
                    <td>{row.method}</td>
                    <td>{formatRmFromSen(row.totalSen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {rail === 'member' && (
          <MemberPanel member={member} onSelectMember={setMember} />
        )}

        {rail === 'shift' && (
          <section className="shift-workspace-panel" aria-labelledby="shift-panel-title">
            <h2 id="shift-panel-title">Shift controls</h2>
            <dl className="shift-details">
              <div><dt>Status</dt><dd>{shift.status}</dd></div>
              <div><dt>Opening float</dt><dd>{formatRm(shift.openingFloat)}</dd></div>
              {shift.openedAt && (
                <div><dt>Opened</dt><dd>{formatKlDateTime(shift.openedAt)}</dd></div>
              )}
            </dl>
            <div className="shift-actions">
              <button type="button" className="btn-secondary" onClick={onLock} disabled={busy}>
                Lock shift
              </button>
              <button type="button" className="btn-secondary" onClick={onCloseRequest} disabled={busy}>
                Close shift
              </button>
              <button type="button" className="btn-secondary" onClick={onLogout}>
                Log out
              </button>
            </div>
          </section>
        )}

        {rail === 'terminal' && (
          <section aria-labelledby="terminal-info-title">
            <h2 id="terminal-info-title">Terminal</h2>
            <dl className="shift-details">
              <div><dt>Code</dt><dd>{location.terminalCode}</dd></div>
              <div><dt>Branch</dt><dd>{location.branchName || location.branchCode}</dd></div>
              <div><dt>Sales point</dt><dd>{location.salesPointName || location.salesPointCode}</dd></div>
            </dl>
          </section>
        )}

        {rail === 'help' && (
          <EmptyState
            title="Help"
            description="Contact your branch manager for POS support. This preview does not include live help desk integration."
          />
        )}

        {showPayment && (
          <PaymentPanel
            lines={cart}
            member={member}
            employee={employee}
            location={location}
            onComplete={clearSale}
            onCancel={() => setShowPayment(false)}
          />
        )}
      </main>

      <aside className={`order-ribbon ${orderDrawerOpen ? 'order-ribbon--open' : ''}`}>
        <header className="order-ribbon__header">
          <h2>Current order</h2>
          <button
            type="button"
            className="order-ribbon__toggle"
            aria-expanded={orderDrawerOpen}
            onClick={() => setOrderDrawerOpen((v) => !v)}
          >
            {orderDrawerOpen ? 'Close' : 'Open'}
          </button>
        </header>

        {cart.length === 0 ? (
          <EmptyState title="No items yet" description="Select products from the menu." />
        ) : (
          <ul className="order-lines">
            {cart.map((line) => (
              <li key={line.id} className="order-line">
                <div className="order-line__info">
                  <span className="order-line__name">{line.name}</span>
                  {line.modifierSummary && (
                    <span className="order-line__mods">{line.modifierSummary}</span>
                  )}
                  <span className="order-line__price">{formatRmFromSen(line.unitPriceSen * line.qty)}</span>
                </div>
                <div className="order-line__qty">
                  <button type="button" aria-label="Decrease quantity" onClick={() => updateQty(line.id, -1)}>−</button>
                  <span>{line.qty}</span>
                  <button type="button" aria-label="Increase quantity" onClick={() => updateQty(line.id, 1)}>+</button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {member && (
          <div className="order-ribbon__member">
            <span className="status-pill status-pill--info">{member.displayName}</span>
          </div>
        )}

        <footer className="order-ribbon__footer">
          <p className="order-ribbon__total">Subtotal: {formatRmFromSen(totalSen)}</p>
          <p className="form-hint">Taxes & rewards calculated at checkout (preview).</p>
          <button
            type="button"
            className="btn-primary order-ribbon__pay"
            disabled={cart.length === 0}
            onClick={() => setShowPayment(true)}
          >
            Pay
          </button>
          {cart.length > 0 && (
            <button type="button" className="btn-secondary" onClick={clearSale}>Clear</button>
          )}
        </footer>
      </aside>

      <ModifierSheet
        open={modifierItem !== null}
        itemName={modifierItem?.name ?? ''}
        basePriceSen={modifierItem?.priceSen ?? 0}
        groups={PREVIEW_MODIFIER_GROUPS}
        onConfirm={confirmModifier}
        onClose={() => setModifierItem(null)}
      />
    </div>
  );
}
