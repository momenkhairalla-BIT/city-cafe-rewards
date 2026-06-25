/** Shared offer eligibility and discount calculation (server-side). */

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

export function isOfferActive(offer, today = new Date().toISOString().slice(0, 10)) {
  if (!offer || offer.isActive === false || offer.is_active === false) return false;
  const start = offer.startDate || offer.start_date;
  const end = offer.endDate || offer.end_date;
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
    return { ok: false, error: 'This offer is only available for City University students.' };
  }
  if (elig === 'general_customer' && customerType !== 'general_customer') {
    return { ok: false, error: 'This offer is only available for general customers.' };
  }
  return { ok: true };
}

function categoryBase(cart, offer) {
  const slug = offer.slug || '';
  const name = offer.offerName || offer.offer_name || '';
  if (slug === 'student-drink-10' || name.includes('10% Student Drink')) {
    return cart.reduce((s, i) => {
      if (DRINK_CATEGORIES.includes(i.category)) {
        return s + Number(i.unitPrice ?? i.price) * Number(i.quantity ?? i.qty);
      }
      return s;
    }, 0);
  }
  const cat = offer.appliesToCategory || offer.applies_to_category;
  if (cat) {
    return cart.reduce((s, i) => {
      if (i.category === cat) return s + Number(i.unitPrice ?? i.price) * Number(i.quantity ?? i.qty);
      return s;
    }, 0);
  }
  return cart.reduce((s, i) => s + Number(i.unitPrice ?? i.price) * Number(i.quantity ?? i.qty), 0);
}

export function calculateOfferDiscount(offer, cart, subtotal) {
  if (!offer) return { discount: 0, pointsMultiplier: 1, label: '', discountType: null };

  const type = offer.discountType || offer.discount_type;
  const value = Number(offer.discountValue ?? offer.discount_value ?? 0);
  const label = offer.offerName || offer.offer_name || '';

  if (type === 'double_points') {
    return { discount: 0, pointsMultiplier: value || 2, label, discountType: type };
  }

  if (type === 'percentage') {
    const base = categoryBase(cart, offer);
    const discount = base * (value / 100);
    return { discount, pointsMultiplier: 1, label, discountType: type };
  }

  if (type === 'fixed_amount') {
    return {
      discount: Math.min(value, subtotal),
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
      const normal = cart.reduce(
        (s, i) => s + Number(i.unitPrice ?? i.price) * Number(i.quantity ?? i.qty),
        0
      );
      const special = value || 12;
      return { discount: Math.max(0, normal - special), pointsMultiplier: 1, label, discountType: type };
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
