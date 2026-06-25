const STAMP_GOAL = 10;

export function generateOrderNumber() {
  return `ORD-${Date.now().toString().slice(-8)}`;
}

export async function findStudentByCode(client, code) {
  const q = (code || '').trim();
  if (!q) return null;
  const upper = q.toUpperCase();
  const { rows } = await client.query(
    `SELECT * FROM students
     WHERE UPPER(student_id) = $1 OR UPPER(member_code) = $1
        OR UPPER(barcode_value) = $1 OR UPPER(qr_value) = $1 OR phone = $2
     LIMIT 1`,
    [upper, q]
  );
  return rows[0] || null;
}

export async function applyPurchaseLoyalty(client, student, totalAmount, pointsMultiplier = 1) {
  const pointsEarned = Math.floor(Number(totalAmount) * Number(pointsMultiplier || 1));  const stampBefore = student.current_stamp_progress;
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
     RETURNING *`,
    [student.id, pointsEarned, stampAfter, freeDrinks]
  );

  return { updatedStudent: rows[0], pointsEarned, stampBefore, stampAfter, freeDrinkUnlocked };
}

export async function applyRewardRedemption(client, student, pointsRequired) {
  if (student.points < pointsRequired) {
    throw new Error('Insufficient points');
  }
  const { rows } = await client.query(
    `UPDATE students SET points = points - $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [student.id, pointsRequired]
  );
  return rows[0];
}

export async function applyFreeDrinkRedemption(client, student) {
  if (student.free_drinks_available <= 0) {
    throw new Error('No free drinks available');
  }
  const { rows } = await client.query(
    `UPDATE students SET free_drinks_available = free_drinks_available - 1, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [student.id]
  );
  return rows[0];
}
