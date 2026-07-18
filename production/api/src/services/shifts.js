import { pool } from '../db/pool.js';
import { writeAuditEvent } from './audit.js';
import { canOperatePosAtBranch, canAccessProduct } from '../authz/permissions.js';

function conflict(code, message) {
  const err = new Error(message);
  err.code = code;
  err.status = 409;
  return err;
}

function forbidden(code, message) {
  const err = new Error(message);
  err.code = code;
  err.status = 403;
  return err;
}

export async function openShift({ employee, terminalLocation, openingFloat = 0, notes = null }) {
  if (!canAccessProduct(employee, 'pos')) {
    throw forbidden('POS_PRODUCT_REQUIRED', 'POS product session required to open a shift');
  }
  if (!canOperatePosAtBranch(employee, terminalLocation.branch_id)) {
    throw forbidden('BRANCH_NOT_AUTHORIZED', 'Not authorised for this terminal branch');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Race-safe insert; unique indexes enforce concurrency
    let row;
    try {
      const inserted = await client.query(
        `INSERT INTO shifts (
           terminal_id, sales_point_id, branch_id, staff_user_id,
           status, opening_float, notes, opened_at
         ) VALUES ($1,$2,$3,$4,'open',$5,$6,NOW())
         RETURNING *`,
        [
          terminalLocation.terminal_id,
          terminalLocation.sales_point_id,
          terminalLocation.branch_id,
          employee.id,
          openingFloat,
          notes,
        ],
      );
      row = inserted.rows[0];
    } catch (e) {
      if (e.code === '23505') {
        throw conflict('SHIFT_ALREADY_ACTIVE', 'An active shift already exists for this terminal or employee');
      }
      throw e;
    }

    await writeAuditEvent({
      eventType: 'shift.opened',
      outcome: 'success',
      actorUserId: employee.id,
      actorRole: employee.role,
      selectedProduct: employee.selectedProduct,
      branchId: row.branch_id,
      salesPointId: row.sales_point_id,
      terminalId: row.terminal_id,
      shiftId: row.id,
      metadata: { openingFloat: Number(row.opening_float) },
      client,
    });

    await client.query('COMMIT');
    return row;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function getActiveShiftForEmployee(userId) {
  const { rows } = await pool.query(
    `SELECT * FROM shifts
     WHERE staff_user_id = $1 AND status IN ('open','locked')
     ORDER BY opened_at DESC LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

export async function getActiveShiftForTerminal(terminalId) {
  const { rows } = await pool.query(
    `SELECT * FROM shifts
     WHERE terminal_id = $1 AND status IN ('open','locked')
     ORDER BY opened_at DESC LIMIT 1`,
    [terminalId],
  );
  return rows[0] || null;
}

export async function lockShift({ employee, shiftId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM shifts WHERE id = $1 FOR UPDATE`,
      [shiftId],
    );
    const shift = rows[0];
    if (!shift) {
      const err = new Error('Shift not found');
      err.status = 404;
      err.code = 'SHIFT_NOT_FOUND';
      throw err;
    }
    if (shift.staff_user_id !== employee.id) {
      throw forbidden('SHIFT_OWNER_REQUIRED', 'Only the shift owner can lock this shift');
    }
    if (shift.status !== 'open') {
      throw conflict('SHIFT_NOT_OPEN', 'Only an open shift can be locked');
    }
    const { rows: updated } = await client.query(
      `UPDATE shifts SET status = 'locked', locked_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [shiftId],
    );
    await writeAuditEvent({
      eventType: 'shift.locked',
      outcome: 'success',
      actorUserId: employee.id,
      actorRole: employee.role,
      selectedProduct: employee.selectedProduct,
      branchId: shift.branch_id,
      salesPointId: shift.sales_point_id,
      terminalId: shift.terminal_id,
      shiftId: shift.id,
      client,
    });
    await client.query('COMMIT');
    return updated[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function resumeShift({ employee, shiftId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM shifts WHERE id = $1 FOR UPDATE`,
      [shiftId],
    );
    const shift = rows[0];
    if (!shift) {
      const err = new Error('Shift not found');
      err.status = 404;
      err.code = 'SHIFT_NOT_FOUND';
      throw err;
    }
    if (shift.staff_user_id !== employee.id) {
      throw forbidden('SHIFT_OWNER_REQUIRED', 'Only the shift owner can resume this shift');
    }
    if (shift.status !== 'locked') {
      throw conflict('SHIFT_NOT_LOCKED', 'Only a locked shift can be resumed');
    }
    const { rows: updated } = await client.query(
      `UPDATE shifts SET status = 'open', locked_at = NULL, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [shiftId],
    );
    await writeAuditEvent({
      eventType: 'shift.resumed',
      outcome: 'success',
      actorUserId: employee.id,
      actorRole: employee.role,
      selectedProduct: employee.selectedProduct,
      branchId: shift.branch_id,
      salesPointId: shift.sales_point_id,
      terminalId: shift.terminal_id,
      shiftId: shift.id,
      client,
    });
    await client.query('COMMIT');
    return updated[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function closeShift({
  employee,
  shiftId,
  expectedCash,
  actualCash,
  notes = null,
  handoverNotes = null,
  handoverToUserId = null,
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM shifts WHERE id = $1 FOR UPDATE`,
      [shiftId],
    );
    const shift = rows[0];
    if (!shift) {
      const err = new Error('Shift not found');
      err.status = 404;
      err.code = 'SHIFT_NOT_FOUND';
      throw err;
    }
    if (shift.staff_user_id !== employee.id) {
      throw forbidden('SHIFT_OWNER_REQUIRED', 'Only the shift owner can close this shift');
    }
    if (!['open', 'locked'].includes(shift.status)) {
      throw conflict('SHIFT_ALREADY_CLOSED', 'Shift is already closed');
    }

    const expected = Number(expectedCash);
    const actual = Number(actualCash);
    if (Number.isNaN(expected) || Number.isNaN(actual)) {
      const err = new Error('expectedCash and actualCash are required numbers');
      err.status = 400;
      err.code = 'INVALID_CASH_AMOUNTS';
      throw err;
    }
    const variance = actual - expected;

    const hasHandover = Boolean(handoverNotes || handoverToUserId);
    const { rows: updated } = await client.query(
      `UPDATE shifts SET
         status = 'closed',
         closed_at = NOW(),
         closing_expected_cash = $2,
         closing_actual_cash = $3,
         cash_variance = $4,
         notes = COALESCE($5::text, notes),
         handover_notes = $6::text,
         handover_to_user_id = $7::uuid,
         handover_at = CASE WHEN $8::boolean THEN NOW() ELSE handover_at END,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [shiftId, expected, actual, variance, notes, handoverNotes, handoverToUserId, hasHandover],
    );

    await writeAuditEvent({
      eventType: 'shift.closed',
      outcome: 'success',
      actorUserId: employee.id,
      actorRole: employee.role,
      selectedProduct: employee.selectedProduct,
      branchId: shift.branch_id,
      salesPointId: shift.sales_point_id,
      terminalId: shift.terminal_id,
      shiftId: shift.id,
      metadata: { expectedCash: expected, actualCash: actual, cashVariance: variance },
      client,
    });

    await client.query('COMMIT');
    return updated[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export function shiftSummary(shift) {
  if (!shift) return null;
  const openingFloat = Number(shift.opening_float);
  const cashSalesTotal = Number(shift.cash_sales_total || 0);
  const nonCashSalesTotal = Number(shift.non_cash_sales_total || 0);
  const expectedClosingCash = openingFloat + cashSalesTotal;
  return {
    id: shift.id,
    status: shift.status,
    terminalId: shift.terminal_id,
    salesPointId: shift.sales_point_id,
    branchId: shift.branch_id,
    staffUserId: shift.staff_user_id,
    openingFloat,
    cashSalesTotal,
    nonCashSalesTotal,
    saleCount: Number(shift.sale_count || 0),
    /** Soft expected closing cash = opening float + recorded cash sales */
    expectedClosingCash,
    closingExpectedCash: shift.closing_expected_cash != null ? Number(shift.closing_expected_cash) : null,
    closingActualCash: shift.closing_actual_cash != null ? Number(shift.closing_actual_cash) : null,
    cashVariance: shift.cash_variance != null ? Number(shift.cash_variance) : null,
    openedAt: shift.opened_at,
    lockedAt: shift.locked_at,
    closedAt: shift.closed_at,
    notes: shift.notes,
    handoverNotes: shift.handover_notes,
  };
}
