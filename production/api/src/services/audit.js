import { query } from '../db/pool.js';

/**
 * Append-only audit writer. Never log secrets, raw credentials, or excessive PII.
 * metadata must be a plain object of non-sensitive operational fields only.
 */
export async function writeAuditEvent({
  eventType,
  outcome,
  actorUserId = null,
  actorRole = null,
  selectedProduct = null,
  branchId = null,
  salesPointId = null,
  terminalId = null,
  shiftId = null,
  errorCode = null,
  metadata = {},
  client = null,
}) {
  const q = client ? client.query.bind(client) : query;
  const safeMeta = sanitizeMetadata(metadata);
  await q(
    `INSERT INTO audit_logs (
      event_type, outcome, actor_user_id, actor_role, selected_product,
      branch_id, sales_point_id, terminal_id, shift_id, error_code, metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
    [
      eventType,
      outcome,
      actorUserId,
      actorRole,
      selectedProduct,
      branchId,
      salesPointId,
      terminalId,
      shiftId,
      errorCode,
      JSON.stringify(safeMeta),
    ],
  );
}

const FORBIDDEN_META_KEYS = new Set([
  'password', 'pin', 'badge', 'card', 'token', 'credential', 'secret',
  'authorization', 'cookie', 'enrolment_code', 'enrollment_code',
  'raw', 'ssn', 'nric',
]);

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(metadata)) {
    const key = String(k).toLowerCase();
    if (FORBIDDEN_META_KEYS.has(key) || key.includes('password') || key.includes('pin') || key.includes('token')) {
      continue;
    }
    if (v == null) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    } else if (Array.isArray(v) && v.every((x) => typeof x === 'string' || typeof x === 'number')) {
      out[k] = v.slice(0, 20);
    }
  }
  return out;
}
