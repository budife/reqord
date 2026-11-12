-- Migration: Update work_orders status check constraint to 11 values
-- Run this in Supabase SQL Editor after deploying app code v0.6.0

-- 1. Drop existing status check constraint(s)
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

-- 2. Migrate legacy status values to new ones
UPDATE work_orders SET status = 'new_request'    WHERE status = 'list';
UPDATE work_orders SET status = 'working'        WHERE status = 'ongoing';
UPDATE work_orders SET status = 'draft_preview'  WHERE status = 'preview';

-- 3. Add new constraint with 11 status values
ALTER TABLE work_orders ADD CONSTRAINT work_orders_status_check
  CHECK (status IN (
    'new_request',
    'waiting_brief',
    'working',
    'draft_preview',
    'revision',
    'preview',
    'on_hold',
    'approved',
    'done',
    'daily',
    'cancelled'
  ));

-- 4. Verify
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'work_orders'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%status%';