export function memberSelectFields() {
  return `id, student_id, name, member_code, customer_type, programme, email, phone,
          barcode_value, qr_value, points, total_purchases, current_stamp_progress,
          free_drinks_available, membership_status, is_active, user_id, created_at, updated_at`;
}

export function mapMemberRow(row) {
  if (!row) return null;
  return {
    ...row,
    studentId: row.student_id,
    memberCode: row.member_code,
    customerType: row.customer_type,
    barcodeValue: row.barcode_value,
    qrValue: row.qr_value,
    totalPurchases: row.total_purchases,
    currentStampProgress: row.current_stamp_progress,
    freeDrinksAvailable: row.free_drinks_available,
    membershipStatus: row.membership_status,
    userId: row.user_id,
    isActive: row.is_active,
  };
}

export async function findMemberByScan(client, code) {
  const q = (code || '').trim();
  if (!q) return null;
  const upper = q.toUpperCase();
  const { rows } = await client.query(
    `SELECT ${memberSelectFields()} FROM students
     WHERE UPPER(student_id) = $1
        OR UPPER(member_code) = $1
        OR UPPER(barcode_value) = $1
        OR UPPER(qr_value) = $1
        OR phone = $2
     LIMIT 1`,
    [upper, q]
  );
  return rows[0] || null;
}

export async function findMemberByCode(client, code) {
  return findMemberByScan(client, code);
}

/** City student: CU2024999 → CU-M-2024999 */
export function generateStudentMemberCode(studentId) {
  const id = (studentId || '').trim().toUpperCase();
  const suffix = id.replace(/^CU/i, '') || id;
  return `CU-M-${suffix}`;
}

/** General customer: GC006 / GC-M-006 (sequential from existing GC### records) */
export async function nextGeneralCustomerIds(client) {
  const { rows } = await client.query(
    `SELECT barcode_value FROM students
     WHERE customer_type = 'general_customer' AND barcode_value ~ '^GC[0-9]+$'
     ORDER BY CAST(SUBSTRING(barcode_value FROM 3) AS INTEGER) DESC NULLS LAST
     LIMIT 1`
  );
  let maxNum = 0;
  if (rows[0]?.barcode_value) {
    const m = String(rows[0].barcode_value).match(/^GC(\d+)$/i);
    if (m) maxNum = parseInt(m[1], 10);
  }
  const next = maxNum + 1;
  const padded = String(next).padStart(3, '0');
  const customerId = `GC${padded}`;
  return {
    customerId,
    memberCode: `GC-M-${padded}`,
    barcodeValue: customerId,
    qrValue: customerId,
  };
}

export function generateMemberCode(type, studentId = null) {
  if (type === 'city_student' && studentId) {
    return generateStudentMemberCode(studentId);
  }
  return `GC-M-${Date.now().toString().slice(-6)}`;
}
