-- Migration 011: append-only audit_logs
-- Phase 2A — no normal path may UPDATE/DELETE rows (enforced by trigger).
-- Never store secrets, raw credentials, or excessive member PII in metadata.
--
-- ROLLBACK NOTES (temp/disposable only — never production):
--   1. DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
--   2. DROP FUNCTION IF EXISTS audit_logs_reject_mutation();
--   3. DROP TABLE IF EXISTS audit_logs;

CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      TEXT NOT NULL,
  outcome         TEXT NOT NULL,
  actor_user_id   UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  actor_role      TEXT NULL,
  selected_product TEXT NULL,
  branch_id       UUID NULL REFERENCES branches(id) ON DELETE SET NULL,
  sales_point_id  UUID NULL REFERENCES sales_points(id) ON DELETE SET NULL,
  terminal_id     UUID NULL REFERENCES terminals(id) ON DELETE SET NULL,
  shift_id        UUID NULL REFERENCES shifts(id) ON DELETE SET NULL,
  error_code      TEXT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT audit_logs_outcome_check
    CHECK (outcome IN ('success', 'failure', 'denied')),
  CONSTRAINT audit_logs_product_check
    CHECK (selected_product IS NULL OR selected_product IN ('pos', 'admin'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON audit_logs (event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_terminal ON audit_logs (terminal_id);

CREATE OR REPLACE FUNCTION audit_logs_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only'
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE PROCEDURE audit_logs_reject_mutation();
