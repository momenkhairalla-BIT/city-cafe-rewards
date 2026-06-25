import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

function mapMenuItem(row) {
  return {
    id: row.id,
    slug: row.slug,
    productId: row.slug,
    name: row.name,
    price: Number(row.price),
    category: row.category,
    description: row.description || '',
    imageUrl: row.image_data || null,
    imageData: row.image_data || null,
    isActive: row.is_active,
    isStudentOfferEligible: row.is_student_offer_eligible,
    isBestSeller: row.is_best_seller,
    sortOrder: row.sort_order,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const all = req.query.all === 'true' && ['staff', 'admin'].includes(req.user?.role);
    const { rows } = await query(
      `SELECT id, slug, name, price, category, description, image_data, is_active,
              is_student_offer_eligible, is_best_seller, sort_order
       FROM menu_items ${all ? '' : 'WHERE is_active = TRUE'}
       ORDER BY sort_order, name`
    );
    res.json({ data: rows.map(mapMenuItem) });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { name, price, category, description, imageData, isStudentOfferEligible, isBestSeller } = req.body;
    const slug = (req.body.slug || name.toLowerCase().replace(/\s+/g, '-')) + '-' + Date.now().toString().slice(-4);
    const { rows } = await query(
      `INSERT INTO menu_items (slug, name, price, category, description, image_data,
        is_student_offer_eligible, is_best_seller)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [slug, name, price, category, description || '', imageData || null,
        !!isStudentOfferEligible, !!isBestSeller]
    );
    res.status(201).json({ data: mapMenuItem(rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const b = req.body;
    const { rows } = await query(
      `UPDATE menu_items SET
        name = COALESCE($2, name),
        price = COALESCE($3, price),
        category = COALESCE($4, category),
        description = COALESCE($5, description),
        image_data = COALESCE($6, image_data),
        is_student_offer_eligible = COALESCE($7, is_student_offer_eligible),
        is_best_seller = COALESCE($8, is_best_seller),
        updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id, b.name, b.price, b.category, b.description, b.imageData,
        b.isStudentOfferEligible, b.isBestSeller]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Menu item not found' });
    res.json({ data: mapMenuItem(rows[0]) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE menu_items SET is_active = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id, !!req.body.isActive]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Menu item not found' });
    res.json({ data: mapMenuItem(rows[0]) });
  } catch (err) {
    next(err);
  }
});

export default router;
