import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

const MAX_IMAGE_BYTES = 500 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

function mapMenuItem(row) {
  const imageData = row.image_data || null;
  const imageUrl = row.image_url || null;
  return {
    id: row.id,
    slug: row.slug,
    productId: row.slug,
    name: row.name,
    price: Number(row.price),
    category: row.category,
    description: row.description || '',
    imageUrl: imageUrl || (imageData && !String(imageData).startsWith('data:') ? imageData : null),
    imageData: imageData && String(imageData).startsWith('data:') ? imageData : null,
    imageAlt: row.image_alt || row.name || '',
    isActive: row.is_active,
    isStudentOfferEligible: row.is_student_offer_eligible,
    isBestSeller: row.is_best_seller,
    sortOrder: row.sort_order,
    hasImage: Boolean(imageData || imageUrl),
  };
}

const MENU_SELECT = `id, slug, name, price, category, description, image_data, image_url, image_alt,
  is_active, is_student_offer_eligible, is_best_seller, sort_order`;

function validateImagePayload(body) {
  if (body.removeImage === true) return null;

  const data = body.imageData;
  if (data === undefined || data === null || data === '') return undefined;

  const str = String(data);
  if (!str.startsWith('data:')) {
    if (str.length > 2048) {
      const err = new Error('Image URL is too long');
      err.status = 400;
      throw err;
    }
    return { imageData: null, imageUrl: str };
  }

  const match = str.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    const err = new Error('Invalid image format. Use PNG, JPG, JPEG, or WEBP.');
    err.status = 400;
    throw err;
  }

  const mime = match[1].toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(mime)) {
    const err = new Error('Invalid image type. Accepted: PNG, JPG, JPEG, WEBP.');
    err.status = 400;
    throw err;
  }

  const byteLength = Buffer.byteLength(match[2], 'base64');
  if (byteLength > MAX_IMAGE_BYTES) {
    const err = new Error('Image is too large. Maximum size is 500 KB.');
    err.status = 400;
    throw err;
  }

  return { imageData: str, imageUrl: null };
}

function resolveImageFields(body) {
  if (body.removeImage === true) {
    return { imageData: null, imageUrl: null, imageAlt: body.imageAlt ?? undefined };
  }

  const validated = validateImagePayload(body);
  const imageAlt = body.imageAlt !== undefined ? body.imageAlt : undefined;

  if (validated === undefined) {
    if (body.imageUrl !== undefined) {
      return { imageData: null, imageUrl: body.imageUrl || null, imageAlt };
    }
    return { imageAlt };
  }

  if (validated === null) return { imageAlt };

  return { ...validated, imageAlt };
}

router.get('/', async (req, res, next) => {
  try {
    const all = req.query.all === 'true' && ['staff', 'admin'].includes(req.user?.role);
    const { rows } = await query(
      `SELECT ${MENU_SELECT} FROM menu_items ${all ? '' : 'WHERE is_active = TRUE'}
       ORDER BY sort_order, name`
    );
    res.json({ data: rows.map(mapMenuItem) });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const {
      name, price, category, description,
      isStudentOfferEligible, isBestSeller, imageAlt,
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Product name is required' });
    if (price === undefined || Number(price) < 0) {
      return res.status(400).json({ error: 'Valid price is required' });
    }
    if (!category?.trim()) return res.status(400).json({ error: 'Category is required' });

    const imageFields = resolveImageFields(req.body);
    const slug = (req.body.slug || name.toLowerCase().replace(/\s+/g, '-')) + '-' + Date.now().toString().slice(-4);

    const { rows } = await query(
      `INSERT INTO menu_items (slug, name, price, category, description, image_data, image_url, image_alt,
        is_student_offer_eligible, is_best_seller)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        slug, name.trim(), price, category.trim(), description || '',
        imageFields.imageData ?? null, imageFields.imageUrl ?? null,
        imageAlt || name.trim(),
        !!isStudentOfferEligible, !!isBestSeller,
      ]
    );
    res.status(201).json({ data: mapMenuItem(rows[0]) });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
});

router.put('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const b = req.body;
    const imageFields = resolveImageFields(b);
    const touchImageData = b.removeImage === true || imageFields.imageData !== undefined;
    const touchImageUrl = b.removeImage === true || imageFields.imageUrl !== undefined
      || (imageFields.imageData !== undefined && imageFields.imageData !== null);

    const { rows } = await query(
      `UPDATE menu_items SET
        name = COALESCE($2, name),
        price = COALESCE($3, price),
        category = COALESCE($4, category),
        description = COALESCE($5, description),
        image_data = CASE
          WHEN $9::boolean THEN NULL
          WHEN $12::boolean THEN $6::text
          ELSE image_data END,
        image_url = CASE
          WHEN $9::boolean THEN NULL
          WHEN $13::boolean THEN $7::text
          ELSE image_url END,
        image_alt = COALESCE($8, image_alt),
        is_student_offer_eligible = COALESCE($10, is_student_offer_eligible),
        is_best_seller = COALESCE($11, is_best_seller),
        updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        req.params.id,
        b.name ?? null,
        b.price ?? null,
        b.category ?? null,
        b.description ?? null,
        imageFields.imageData ?? null,
        imageFields.imageUrl ?? null,
        imageFields.imageAlt ?? null,
        b.removeImage === true,
        b.isStudentOfferEligible ?? null,
        b.isBestSeller ?? null,
        touchImageData,
        touchImageUrl,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Menu item not found' });
    res.json({ data: mapMenuItem(rows[0]) });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
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
