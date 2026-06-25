export function memberSelectFields() {
  return `id, student_id, name, member_code, customer_type, programme, email, phone,
          barcode_value, qr_value, points, total_purchases, current_stamp_progress,
          free_drinks_available, membership_status, is_active, created_at, updated_at`;
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
        OR UPPER(member_code) = $3
     LIMIT 1`,
    [upper, q, q.toUpperCase()]
  );
  return rows[0] || null;
}

export async function findMemberByCode(client, code) {
  return findMemberByScan(client, code);
}

export function generateMemberCode(type) {
  const prefix = type === 'city_student' ? 'CU-M' : 'GC-M';
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}
