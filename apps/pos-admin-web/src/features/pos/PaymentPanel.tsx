import { useState } from 'react';
import type { EmployeeIdentity, TerminalLocation } from '../../auth/types';
import type { PreviewMember } from '../../preview/fixtures/catalog';
import { isUiPreviewMode } from '../../preview/uiPreviewMode';
import type { CartLine } from './cartTypes';
import { cartTotalSen } from './cartTypes';
import { formatRmFromSen } from '../../shared/formatting/money';

type PaymentMethod = 'cash' | 'card' | 'ewallet' | 'student_wallet';

interface Receipt {
  orderNumber: string;
  method: PaymentMethod;
  totalSen: number;
  lines: CartLine[];
}

interface Props {
  lines: CartLine[];
  member: PreviewMember | null;
  employee: EmployeeIdentity;
  location: TerminalLocation;
  onComplete: () => void;
  onCancel: () => void;
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  ewallet: 'E-wallet',
  student_wallet: 'Student wallet',
};

export function PaymentPanel({ lines, member, employee, location, onComplete, onCancel }: Props) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const totalSen = cartTotalSen(lines);
  const previewMode = isUiPreviewMode();

  function handlePay() {
    setReceipt({
      orderNumber: `A-${10500 + Math.floor(Math.random() * 99)}`,
      method,
      totalSen,
      lines: [...lines],
    });
  }

  if (receipt) {
    return (
      <section className="payment-panel payment-panel--receipt" aria-labelledby="receipt-title">
        <h3 id="receipt-title">Sale complete</h3>
        <p className="form-hint">Preview receipt — no backend sale recorded.</p>
        <dl className="receipt-details">
          <div><dt>Order</dt><dd>{receipt.orderNumber}</dd></div>
          <div><dt>Employee</dt><dd>{employee.fullName}</dd></div>
          <div><dt>Branch</dt><dd>{location.branchCode}</dd></div>
          <div><dt>Sales point</dt><dd>{location.salesPointCode}</dd></div>
          <div><dt>Terminal</dt><dd>{location.terminalCode}</dd></div>
          <div><dt>Method</dt><dd>{METHOD_LABELS[receipt.method]}</dd></div>
          {member && <div><dt>Member</dt><dd>{member.displayName}</dd></div>}
        </dl>
        <ul className="receipt-lines">
          {receipt.lines.map((line) => (
            <li key={line.id}>
              {line.qty}× {line.name}
              {line.modifierSummary && <span className="receipt-mod"> ({line.modifierSummary})</span>}
              <span className="receipt-line-price">{formatRmFromSen(line.unitPriceSen * line.qty)}</span>
            </li>
          ))}
        </ul>
        <p className="receipt-total">Total: {formatRmFromSen(receipt.totalSen)}</p>
        <button type="button" className="btn-primary" onClick={onComplete}>New sale</button>
      </section>
    );
  }

  return (
    <section className="payment-panel" aria-labelledby="payment-title">
      <h3 id="payment-title">Payment</h3>
      <p className="payment-preview-notice" role="status">
        {previewMode
          ? 'UI PREVIEW — backend connection disabled'
          : 'UI Preview — POS sales API disabled'}
      </p>

      <fieldset className="payment-methods">
        <legend>Method</legend>
        {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((key) => (
          <label key={key} className={`payment-method ${method === key ? 'payment-method--active' : ''}`}>
            <input
              type="radio"
              name="payment-method"
              value={key}
              checked={method === key}
              onChange={() => setMethod(key)}
            />
            {METHOD_LABELS[key]}
          </label>
        ))}
      </fieldset>

      <p className="payment-total">Total due: {formatRmFromSen(totalSen)}</p>

      <div className="payment-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>Back</button>
        <button type="button" className="btn-primary" onClick={handlePay} disabled={lines.length === 0}>
          Complete sale (preview)
        </button>
      </div>
    </section>
  );
}
