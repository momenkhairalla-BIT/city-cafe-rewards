import { findMemberByScan } from './members.js';

const STAMP_GOAL = 10;

export function generateOrderNumber() {
  return `ORD-${Date.now().toString().slice(-8)}`;
}

export async function findStudentByCode(client, code) {
  return findMemberByScan(client, code);
}

export async function applyPurchaseLoyalty(client, student, totalAmount, pointsMultiplier = 1) {
  const pointsEarned = Math.floor(Number(totalAmount) * Number(pointsMultiplier || 1));
  const stampBefore = student.current_stamp_progress;
  let stampAfter = stampBefore + 1;
  let freeDrinkUnlocked = false;
  let freeDrinks = student.free_drinks_available;

  if (stampAfter >= STAMP_GOAL) {
    freeDrinkUnlocked = true;
    freeDrinks += 1;
    stampAfter = 0;
  }

  const { rows } = await client.query(
    `UPDATE students SET
      points = points + $2,
      total_purchases = total_purchases + 1,
      current_stamp_progress = $3,
      free_drinks_available = $4,
      updated_at = NOW()
     WHERE id = $1
     RETURNING points, current_stamp_progress, free_drinks_available`,
    [student.id, pointsEarned, stampAfter, freeDrinks]
  );

  return {
    pointsEarned,
    stampBefore,
    stampAfter,
    freeDrinkUnlocked,
    updatedStudent: rows[0],
  };
}

export async function applyRewardRedemption(client, student, pointsRequired) {
  if (student.points < pointsRequired) {
    throw new Error('Insufficient points');
  }
  await client.query(
    `UPDATE students SET points = points - $2, updated_at = NOW() WHERE id = $1`,
    [student.id, pointsRequired]
  );
}

export async function applyFreeDrinkRedemption(client, student) {
  if (student.free_drinks_available < 1) {
    throw new Error('No free drinks available');
  }
  await client.query(
    `UPDATE students SET free_drinks_available = free_drinks_available - 1, updated_at = NOW() WHERE id = $1`,
    [student.id]
  );
}
