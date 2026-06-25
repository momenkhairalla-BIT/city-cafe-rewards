import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

function mapOffer(row) {
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

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM offers ORDER BY offer_name`);
    res.json({ data: rows.map(mapOffer) });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const {
      slug, offerName, customerTypeEligibility = 'city_student',
      discountType, discountValue = 0, appliesToCategory, appliesToProductIds,
      startDate, endDate, isActive = true,
    } = req.body;
    const { rows } = await query(
      `INSERT INTO offers (slug, offer_name, customer_type_eligibility, discount_type, discount_value,
        applies_to_category, applies_to_product_ids, start_date, end_date, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [slug || `offer-${Date.now()}`, offerName, customerTypeEligibility, discountType,
        discountValue, appliesToCategory || null, appliesToProductIds || null,
        startDate || null, endDate || null, isActive]
    );
    res.status(201).json({ data: mapOffer(rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const b = req.body;
    const { rows } = await query(
      `UPDATE offers SET
        offer_name = COALESCE($2, offer_name),
        customer_type_eligibility = COALESCE($3, customer_type_eligibility),
        discount_type = COALESCE($4, discount_type),
        discount_value = COALESCE($5, discount_value),
        applies_to_category = COALESCE($6, applies_to_category),
        applies_to_product_ids = COALESCE($7, applies_to_product_ids),
        start_date = COALESCE($8, start_date),
        end_date = COALESCE($9, end_date),
        is_active = COALESCE($10, is_active),
        updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id, b.offerName, b.customerTypeEligibility, b.discountType, b.discountValue,
        b.appliesToCategory, b.appliesToProductIds, b.startDate, b.endDate, b.isActive]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Offer not found' });
    res.json({ data: mapOffer(rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE offers SET is_active = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id, !!req.body.isActive]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Offer not found' });
    res.json({ data: mapOffer(rows[0]) });
  } catch (err) {
    next(err);
  }
});

export default router;
