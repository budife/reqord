-- Jalankan di Supabase SQL Editor SEBELUM deploy perubahan sync team.
-- Tanpa kolom ini, payload `team` dari app akan ditolak PostgREST.
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS team TEXT;
