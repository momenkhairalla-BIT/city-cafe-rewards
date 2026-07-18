import { pool, query } from '../db/pool.js';
import { generateOpaqueToken, hashToken, hashSecret, verifySecret } from './secure-tokens.js';
import { writeAuditEvent } from './audit.js';

const ENROL_TTL_MS = Number(process.env.TERMINAL_ENROL_TTL_MS || 15 * 60 * 1000);

export async function createEnrolmentCode({ terminalId, managerUserId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const term = await client.query(
      `SELECT id, status FROM terminals WHERE id = $1 FOR UPDATE`,
      [terminalId],
    );
    if (!term.rows[0]) {
      const err = new Error('Terminal not found');
      err.code = 'TERMINAL_NOT_FOUND';
      err.status = 404;
      throw err;
    }
    if (!['pending_enrolment', 'revoked', 'replaced'].includes(term.rows[0].status)
      && term.rows[0].status !== 'active') {
      // allow re-enrolment OTC for pending/active replacement flows
    }

    // Revoke outstanding unconsumed codes
    await client.query(
      `UPDATE terminal_enrolment_codes
       SET revoked_at = NOW()
       WHERE terminal_id = $1 AND consumed_at IS NULL AND revoked_at IS NULL`,
      [terminalId],
    );

    const code = generateOpaqueToken(18);
    const codeHash = hashToken(code);
    const expiresAt = new Date(Date.now() + ENROL_TTL_MS);
    await client.query(
      `INSERT INTO terminal_enrolment_codes (terminal_id, code_hash, expires_at, created_by_user_id)
       VALUES ($1,$2,$3,$4)`,
      [terminalId, codeHash, expiresAt.toISOString(), managerUserId],
    );

    if (term.rows[0].status === 'active') {
      // Replacement path: leave active until enrol consumes; status stays until exchange
    } else {
      await client.query(
        `UPDATE terminals SET status = 'pending_enrolment', updated_at = NOW() WHERE id = $1`,
        [terminalId],
      );
    }

    await writeAuditEvent({
      eventType: 'terminal.enrolment_code_created',
      outcome: 'success',
      actorUserId: managerUserId,
      actorRole: 'admin',
      selectedProduct: 'admin',
      terminalId,
      metadata: { expiresAt: expiresAt.toISOString() },
      client,
    });

    await client.query('COMMIT');
    return { enrolmentCode: code, expiresAt: expiresAt.toISOString(), terminalId };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function enrolTerminal({ enrolmentCode, deviceFingerprint = null }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const codeHash = hashToken(enrolmentCode);
    const { rows } = await client.query(
      `SELECT c.*, t.status AS terminal_status
       FROM terminal_enrolment_codes c
       JOIN terminals t ON t.id = c.terminal_id
       WHERE c.code_hash = $1
       ORDER BY c.created_at DESC
       FOR UPDATE OF c, t`,
      [codeHash],
    );
    const row = rows[0];
    if (!row) {
      const err = new Error('Invalid enrolment code');
      err.code = 'ENROLMENT_INVALID';
      err.status = 401;
      throw err;
    }
    if (row.revoked_at) {
      const err = new Error('Enrolment code revoked');
      err.code = 'ENROLMENT_REVOKED';
      err.status = 401;
      throw err;
    }
    if (row.consumed_at) {
      const err = new Error('Enrolment code already used');
      err.code = 'ENROLMENT_REUSED';
      err.status = 401;
      throw err;
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      const err = new Error('Enrolment code expired');
      err.code = 'ENROLMENT_EXPIRED';
      err.status = 401;
      throw err;
    }

    const credential = generateOpaqueToken(32);
    const credentialHash = await hashSecret(credential);

    await client.query(
      `UPDATE terminal_enrolment_codes SET consumed_at = NOW() WHERE id = $1`,
      [row.id],
    );

    const { rows: termRows } = await client.query(
      `UPDATE terminals SET
         status = 'active',
         credential_hash = $2,
         credential_issued_at = NOW(),
         credential_revoked_at = NULL,
         credential_version = COALESCE(credential_version, 1) + 1,
         registered_at = NOW(),
         registered_by_user_id = $3,
         device_fingerprint = COALESCE($4, device_fingerprint),
         is_active = TRUE,
         updated_at = NOW()
       WHERE id = $1
       RETURNING id, code, sales_point_id, status, credential_version`,
      [row.terminal_id, credentialHash, row.created_by_user_id, deviceFingerprint],
    );

    const location = await resolveTerminalLocation(client, row.terminal_id);

    await writeAuditEvent({
      eventType: 'terminal.enrolled',
      outcome: 'success',
      actorUserId: row.created_by_user_id,
      terminalId: row.terminal_id,
      branchId: location.branch_id,
      salesPointId: location.sales_point_id,
      metadata: { terminalCode: termRows[0].code, credentialVersion: termRows[0].credential_version },
      client,
    });

    await client.query('COMMIT');
    return {
      terminalCredential: credential,
      terminal: termRows[0],
      location,
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function resolveTerminalLocation(clientOrNull, terminalId) {
  const q = clientOrNull ? clientOrNull.query.bind(clientOrNull) : query;
  const { rows } = await q(
    `SELECT t.id AS terminal_id, t.code AS terminal_code, t.status, t.credential_version,
            sp.id AS sales_point_id, sp.code AS sales_point_code, sp.name AS sales_point_name,
            b.id AS branch_id, b.code AS branch_code, b.name AS branch_name
     FROM terminals t
     JOIN sales_points sp ON sp.id = t.sales_point_id
     JOIN branches b ON b.id = sp.branch_id
     WHERE t.id = $1`,
    [terminalId],
  );
  return rows[0] || null;
}

export async function authenticateTerminalCredential(rawCredential) {
  if (!rawCredential) return null;
  const { rows } = await query(
    `SELECT id, credential_hash, status, credential_revoked_at, credential_version
     FROM terminals
     WHERE status = 'active' AND credential_hash IS NOT NULL AND credential_revoked_at IS NULL`,
  );
  for (const row of rows) {
    // bcrypt compare — acceptable for small terminal counts in Phase 2A
    // eslint-disable-next-line no-await-in-loop
    const ok = await verifySecret(rawCredential, row.credential_hash);
    if (ok) {
      const location = await resolveTerminalLocation(null, row.id);
      return { terminal: row, location };
    }
  }
  return null;
}

export async function heartbeatTerminal(terminalId) {
  await query(
    `UPDATE terminals SET last_heartbeat_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND status = 'active'`,
    [terminalId],
  );
}

export async function revokeTerminal({ terminalId, managerUserId, replaceWithTerminalId = null }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE terminals SET
         status = CASE WHEN $2::uuid IS NOT NULL THEN 'replaced' ELSE 'revoked' END,
         credential_hash = NULL,
         credential_revoked_at = NOW(),
         replaced_by_terminal_id = $2,
         is_active = FALSE,
         credential_version = COALESCE(credential_version, 1) + 1,
         updated_at = NOW()
       WHERE id = $1
       RETURNING id, code, status`,
      [terminalId, replaceWithTerminalId],
    );
    if (!rows[0]) {
      const err = new Error('Terminal not found');
      err.code = 'TERMINAL_NOT_FOUND';
      err.status = 404;
      throw err;
    }
    await client.query(
      `UPDATE terminal_enrolment_codes SET revoked_at = NOW()
       WHERE terminal_id = $1 AND consumed_at IS NULL AND revoked_at IS NULL`,
      [terminalId],
    );
    // Force-close any active shifts on this terminal
    await client.query(
      `UPDATE shifts SET status = 'closed', closed_at = NOW(), updated_at = NOW(),
         notes = COALESCE(notes,'') || ' [force-closed on terminal revoke]'
       WHERE terminal_id = $1 AND status IN ('open','locked')`,
      [terminalId],
    );
    const location = await resolveTerminalLocation(client, terminalId);
    await writeAuditEvent({
      eventType: 'terminal.revoked',
      outcome: 'success',
      actorUserId: managerUserId,
      actorRole: 'admin',
      selectedProduct: 'admin',
      terminalId,
      branchId: location?.branch_id,
      salesPointId: location?.sales_point_id,
      metadata: { terminalCode: rows[0].code, status: rows[0].status },
      client,
    });
    await client.query('COMMIT');
    return rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** Fingerprint alone must never authenticate. */
export async function rejectFingerprintAuth() {
  return null;
}
