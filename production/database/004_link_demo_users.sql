-- Link demo customer users to member records (additive, safe to re-run)

UPDATE students s SET user_id = u.id, updated_at = NOW()
FROM users u
WHERE UPPER(s.student_id) = 'CU2024001'
  AND u.username = 'CU2024001'
  AND (s.user_id IS NULL OR s.user_id = u.id);

UPDATE students s SET user_id = u.id, updated_at = NOW()
FROM users u
WHERE UPPER(s.member_code) = 'GC-M-001'
  AND u.username = 'general001'
  AND (s.user_id IS NULL OR s.user_id = u.id);
