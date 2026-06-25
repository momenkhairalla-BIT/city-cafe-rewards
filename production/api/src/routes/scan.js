import { Router } from 'express';
import { pool } from '../db/pool.js';
import { findMemberByScan, mapMemberRow } from '../services/members.js';

const router = Router();

router.get('/:code', async (req, res, next) => {
  try {
    const member = await findMemberByScan(pool, req.params.code);
    if (!member) return res.status(404).json({ error: 'No member found for this scan code' });
    if (!member.is_active) return res.status(403).json({ error: 'Member account is inactive' });
    res.json({ data: mapMemberRow(member) });
  } catch (err) {
    next(err);
  }
});

export default router;
