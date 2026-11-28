-- Migration: Merge Approved into Done, retain 10 canonical statuses.
-- Run in Supabase SQL Editor after deploying app code.

BEGIN;

-- Drop existing status check constraint(s) before normalizing legacy rows.
DO $$
DECLARE cname text;
BEGIN
  FOR cname IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'work_orders'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE work_orders DROP CONSTRAINT %I', cname);
  END LOOP;
END $$;

-- Normalize legacy values. Preserve current Preview; Approved is now Done.
UPDATE work_orders SET status = 'new_request'   WHERE lower(status) = 'list';
UPDATE work_orders SET status = 'waiting_brief' WHERE lower(status) IN ('waiting brief / working files', 'waiting_brief_working_files');
UPDATE work_orders SET status = 'working'       WHERE lower(status) = 'ongoing';
UPDATE work_orders SET status = 'draft_preview' WHERE lower(status) IN ('1st draft', 'first draft');
UPDATE work_orders SET status = 'revision'      WHERE lower(status) IN ('in revision', 'revisions');
UPDATE work_orders SET status = 'on_hold'       WHERE lower(status) IN ('on hold', 'hold');
UPDATE work_orders SET status = 'cancelled'     WHERE lower(status) IN ('cancelled', 'canceled', 'cancel');
UPDATE work_orders SET status = 'daily'         WHERE lower(status) IN ('daily', 'harian');
UPDATE work_orders SET status = 'preview'       WHERE lower(status) IN ('preview', 'final preview');
UPDATE work_orders SET status = 'done'          WHERE lower(status) IN ('done', 'complete', 'completed', 'selesai');
UPDATE work_orders SET status = 'done', done = true, completed_at = COALESCE(completed_at, now())
WHERE lower(status) = 'approved';

-- Restrict new writes to values exposed by the app.
ALTER TABLE work_orders ADD CONSTRAINT work_orders_status_check
  CHECK (status IN (
    'new_request',
    'waiting_brief',
    'working',
    'draft_preview',
    'revision',
    'preview',
    'on_hold',
    'done',
    'daily',
    'cancelled'
  ));

COMMIT;

-- Verify
SELECT status, count(*) FROM work_orders GROUP BY status ORDER BY status;
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'work_orders'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%status%';
