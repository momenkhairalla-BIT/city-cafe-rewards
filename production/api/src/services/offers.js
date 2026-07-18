/** Shared offer eligibility and discount calculation (server-side). */
import { toSen, fromSen, percentOfSen, mulQtySen, minSen } from './money.js';

const DRINK_CATEGORIES = ['Coffee', 'Iced Drinks'];

export function mapOfferRow(row) {
  if (!row) return null;
  return {
    offerId: row.id,
    id: row.id,
    slug: row.slug,
    offerName: row.offer_name,
    customerTypeEligibility: row.customer_type_eligibility,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    appliesToCategory: row.applies_to_category,
    appliesToProductIds: row.applies_to_product_ids,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active,
  };
}

function toDateOnly(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export function isOfferActive(offer, today = new Date().toISOString().slice(0, 10)) {
  if (!offer || offer.isActive === false || offer.is_active === false) return false;
  const start = toDateOnly(offer.startDate || offer.start_date);
  const end = toDateOnly(offer.endDate || offer.end_date);
  if (start && start > today) return false;
  if (end && end < today) return false;
  return true;
}

export function validateOfferEligibility(offer, customerType) {
  if (!offer) return { ok: false, error: 'Offer not found' };
  if (!isOfferActive(offer)) return { ok: false, error: 'Offer is not active' };
  const elig = offer.customerTypeEligibility || offer.customer_type_eligibility;
  if (elig === 'all') return { ok: true };
  if (elig === 'city_student' && customerType !== 'city_student') {
    return { ok: false, error: 'This offer is only available for student members.' };
  }
  if (elig === 'general_customer' && customerType !== 'general_customer') {
    return { ok: false, error: 'This offer is only available for general customers.' };
  }
  return { ok: true };
}

function lineSen(i) {
  const unit = toSen(i.unitPrice ?? i.price ?? 0);
  const qty = Number(i.quantity ?? i.qty ?? 1);
  return mulQtySen(unit, qty);
}

function categoryBaseSen(cart, offer) {
  const slug = offer.slug || '';
  const name = offer.offerName || offer.offer_name || '';
  if (slug === 'student-drink-10' || name.includes('10% Student Drink')) {
    return cart.reduce((s, i) => (DRINK_CATEGORIES.includes(i.category) ? s + lineSen(i) : s), 0);
  }
  const cat = offer.appliesToCategory || offer.applies_to_category;
  if (cat) {
    return cart.reduce((s, i) => (i.category === cat ? s + lineSen(i) : s), 0);
  }
  return cart.reduce((s, i) => s + lineSen(i), 0);
}

/** Same loyalty/offer rules; amounts via integer sen (single calculation path). */
export function calculateOfferDiscount(offer, cart, subtotal) {
  if (!offer) return { discount: 0, pointsMultiplier: 1, label: '', discountType: null };

  const type = offer.discountType || offer.discount_type;
  const value = Number(offer.discountValue ?? offer.discount_value ?? 0);
  const label = offer.offerName || offer.offer_name || '';
  const subtotalSen = toSen(subtotal);

  if (type === 'double_points') {
    return { discount: 0, pointsMultiplier: value || 2, label, discountType: type };
  }

  if (type === 'percentage') {
    const baseSen = categoryBaseSen(cart, offer);
    const discountSen = percentOfSen(baseSen, value);
    return { discount: fromSen(discountSen), pointsMultiplier: 1, label, discountType: type };
  }

  if (type === 'fixed_amount') {
    const discountSen = minSen(toSen(value), subtotalSen);
    return {
      discount: fromSen(discountSen),
      pointsMultiplier: 1,
      label,
      discountType: type,
    };
  }

  if (type === 'special_price') {
    const hasCoffee = cart.some(c =>
      c.category === 'Coffee' || c.category === 'Iced Drinks' ||
      (c.name || '').toLowerCase().includes('latte') ||
      (c.name || '').toLowerCase().includes('coffee')
    );
    const hasCroissant = cart.some(c => (c.name || c.itemName || '').toLowerCase().includes('croissant'));
    if (hasCoffee && hasCroissant) {
      const normalSen = cart.reduce((s, i) => s + lineSen(i), 0);
      const specialSen = toSen(value || 12);
      const discountSen = Math.max(0, normalSen - specialSen);
      return { discount: fromSen(discountSen), pointsMultiplier: 1, label, discountType: type };
    }
    return { discount: 0, pointsMultiplier: 1, label: '', discountType: type };
  }

  return { discount: 0, pointsMultiplier: 1, label: '', discountType: type };
}

export async function getOfferById(client, offerId) {
  if (!offerId) return null;
  const { rows } = await client.query(`SELECT * FROM offers WHERE id = $1 LIMIT 1`, [offerId]);
  return rows[0] || null;
}

export async function getOfferBySlugOrId(client, key) {
  if (!key) return null;
  const { rows } = await client.query(
    `SELECT * FROM offers WHERE id::text = $1 OR slug = $1 LIMIT 1`,
    [key]
  );
  return rows[0] || null;
}
