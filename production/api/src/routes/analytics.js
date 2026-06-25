import { Router } from 'express';
import { pool } from '../db/pool.js';

const router = Router();

router.get('/overview', async (_req, res, next) => {
  try {
    const [revenue, students, loyalty] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(total), 0) AS total_revenue,
          COUNT(*) AS total_orders,
          COALESCE(AVG(total), 0) AS avg_order_value,
          COALESCE(SUM(points_earned), 0) AS total_points_issued
        FROM orders WHERE transaction_type = 'Purchase'
      `),
      pool.query(`
        SELECT
          COUNT(*) AS total_students,
          COUNT(*) FILTER (WHERE total_purchases > 0) AS active_students,
          COUNT(*) FILTER (WHERE total_purchases > 1) AS repeat_customers,
          COUNT(*) FILTER (WHERE current_stamp_progress BETWEEN 7 AND 9) AS near_stamp_reward,
          COUNT(*) FILTER (WHERE free_drinks_available > 0) AS has_free_drink
        FROM students
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE transaction_type = 'Reward') AS rewards_redeemed,
          COUNT(*) FILTER (WHERE transaction_type = 'Free Drink') AS free_drinks_redeemed,
          COUNT(*) FILTER (WHERE transaction_type = 'Free Drink Earned') AS free_drinks_issued
        FROM orders
      `),
    ]);

    res.json({
      data: {
        ...revenue.rows[0],
        ...students.rows[0],
        ...loyalty.rows[0],
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
