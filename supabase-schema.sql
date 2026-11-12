-- reqord Supabase Schema (shared: public read, admin write)
-- Jalankan di Supabase SQL Editor

-- 1. Tabel work_orders
CREATE TABLE IF NOT EXISTS work_orders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  requestor TEXT NOT NULL,
  month TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
  status TEXT DEFAULT 'list' CHECK (status IN ('list', 'ongoing', 'revision', 'preview', 'done')),
  type TEXT DEFAULT 'project' CHECK (type IN ('project', 'daily')),
  date TIMESTAMPTZ,
  request_date TIMESTAMPTZ,
  done BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  daily_done_date TEXT,
  subitems JSONB DEFAULT '[]'::jsonb,
  note TEXT,
  folder_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Index
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_month ON work_orders(month);

-- 3. Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS work_orders_updated_at ON work_orders;
CREATE TRIGGER work_orders_updated_at
  BEFORE UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 4. RLS (shared: public read, authenticated write)
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

-- Drop old per-user policies
DROP POLICY IF EXISTS "Users can view own work_orders" ON work_orders;
DROP POLICY IF EXISTS "Users can insert own work_orders" ON work_orders;
DROP POLICY IF EXISTS "Users can update own work_orders" ON work_orders;
DROP POLICY IF EXISTS "Users can delete own work_orders" ON work_orders;

-- New shared policies
CREATE POLICY "Public can view all work_orders"
  ON work_orders FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can insert work_orders"
  ON work_orders FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update work_orders"
  ON work_orders FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can delete work_orders"
  ON work_orders FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- 5. Enable Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE work_orders;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- 6. Activity sync (opsional, untuk History & Activity multi-device)
CREATE TABLE IF NOT EXISTS reqord_meta (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE reqord_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth can read meta" ON reqord_meta;
DROP POLICY IF EXISTS "Auth can insert meta" ON reqord_meta;
DROP POLICY IF EXISTS "Auth can update meta" ON reqord_meta;

CREATE POLICY "Auth can read meta" ON reqord_meta FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth can insert meta" ON reqord_meta FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth can update meta" ON reqord_meta FOR UPDATE USING (auth.uid() IS NOT NULL);
