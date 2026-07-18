/**
 * Central money utility — integer sen (1 RM = 100 sen).
 * Never use IEEE-754 for authoritative pricing.
 */

const SEN_PER_UNIT = 100n;

function assertFiniteNumber(value, label = 'amount') {
  if (typeof value === 'bigint') return;
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    const err = new Error(`Invalid ${label}`);
    err.code = 'INVALID_MONEY';
    err.status = 400;
    throw err;
  }
}

/** Parse RM amount (number or decimal string) to integer sen. */
export function toSen(amount) {
  if (typeof amount === 'bigint') return Number(amount);
  if (amount == null) {
    const err = new Error('Amount required');
    err.code = 'INVALID_MONEY';
    err.status = 400;
    throw err;
  }
  const raw = String(amount).trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(raw) && typeof amount === 'string') {
    // allow JS numbers via fixed 2dp normalisation below
  }
  assertFiniteNumber(typeof amount === 'string' ? Number(amount) : amount);

  // Normalise via string to avoid 12.9 * 100 float noise
  const num = typeof amount === 'number' ? amount : Number(amount);
  const fixed = num.toFixed(2);
  const neg = fixed.startsWith('-');
  const abs = neg ? fixed.slice(1) : fixed;
  const [whole, frac = '00'] = abs.split('.');
  const sen = Number(whole) * 100 + Number(frac.padEnd(2, '0').slice(0, 2));
  return neg ? -sen : sen;
}

/** Sen → number with exactly 2 decimal places (for JSON / NUMERIC bind). */
export function fromSen(sen) {
  const n = Number(sen);
  if (!Number.isInteger(n)) {
    const err = new Error('Sen must be an integer');
    err.code = 'INVALID_MONEY';
    err.status = 400;
    throw err;
  }
  return Math.round(n) / 100;
}

/** Format for display / stable string. */
export function formatSen(sen) {
  return fromSen(sen).toFixed(2);
}

export function mulQtySen(unitSen, qty) {
  const q = Number(qty);
  if (!Number.isInteger(q) || q < 1) {
    const err = new Error('Quantity must be a positive integer');
    err.code = 'INVALID_QUANTITY';
    err.status = 400;
    throw err;
  }
  return unitSen * q;
}

/** Percentage of sen, half-up to nearest sen. */
export function percentOfSen(baseSen, percent) {
  const p = Number(percent);
  if (!Number.isFinite(p) || p < 0) {
    const err = new Error('Invalid percent');
    err.code = 'INVALID_MONEY';
    err.status = 400;
    throw err;
  }
  // half-up: (base * pct + 50) / 100 when working in sen*percent
  return Math.floor((baseSen * p + 50) / 100);
}

export function addSen(...values) {
  return values.reduce((a, b) => a + Number(b), 0);
}

export function subSen(a, b) {
  return Number(a) - Number(b);
}

export function minSen(a, b) {
  return Math.min(Number(a), Number(b));
}

export function maxSen(a, b) {
  return Math.max(Number(a), Number(b));
}

/** Canonical JSON money fields as numbers with 2dp (NUMERIC-safe). */
export function moneyFieldsFromSen({ subtotalSen, discountSen, totalSen }) {
  return {
    subtotal: fromSen(subtotalSen),
    discount: fromSen(discountSen),
    total: fromSen(totalSen),
  };
}
