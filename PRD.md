# PRD — reqord Supabase Integration

## 1. Overview

Migrasi reqord dari localStorage-only ke Supabase hosted backend, sehingga data persist di cloud dan bisa diakses multi-device dengan auth.

## 2. Current State (Audit)

### 2.1 Arsitektur Saat Ini
- **Frontend:** Static HTML/CSS/JS (GitHub Pages)
- **Storage:** localStorage (`reqord-request-work-orders`) + IndexedDB (folder handle)
- **Data flow:** Folder scan → localStorage → JSON export/import
- **Auth:** None
- **Backend:** None

### 2.2 Data Model Saat Ini (localStorage)
```json
{
  "id": "number",
  "title": "string",
  "requestor": "string",
  "month": "string (MMYY)",
  "priority": "high|normal|low",
  "status": "list|ongoing|revision|preview|done",
  "type": "project|daily",
  "date": "string (YYYY-MM-DD HH:mm)",
  "requestDate": "string (YYYY-MM-DD HH:mm)",
  "done": "boolean",
  "completedAt": "string",
  "dailyDoneDate": "string",
  "note": "string"
}
```

### 2.3 Fitur yang Ada
- Folder scan (File System Access API, Chromium only)
- Dedup exact Title + Requestor
- Month filter dropdown
- Duplicate modal
- Save button (manual localStorage)
- Reset button
- Export JSON / Import JSON
- Debug logging (console)
- Auto-refresh on page load

### 2.4 Masalah yang Ditemukan (Audit)
1. **Data loss risk:** localStorage bisa di-clear oleh browser (private mode, extension, quota)
2. **No auth:** Siapa pun yang buka URL bisa lihat data (jika localStorage ada)
3. **No multi-device:** Data hanya di satu browser
4. **No backup otomatis:** Export JSON manual
5. **Folder handle (IndexedDB):** Bisa hilang jika browser clear storage

## 3. Target State

### 3.1 Arsitektur Target
```
GitHub Pages (frontend) → Supabase API (HTTPS) → Postgres
```
- Frontend tetap di GitHub Pages (static)
- Backend: Supabase hosted (supabase.com)
- Auth: Supabase Auth (email/password)
- Storage: Supabase Postgres + RLS

### 3.2 Data Model Target (Supabase)
```sql
CREATE TABLE work_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  requestor TEXT NOT NULL,
  month TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'list',
  type TEXT DEFAULT 'project',
  date TIMESTAMPTZ,
  request_date TIMESTAMPTZ,
  done BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  daily_done_date TEXT,
  subitems JSONB DEFAULT '[]',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: user hanya lihat data miliknya
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own work_orders"
  ON work_orders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 3.3 Fitur Baru
- **Auth:** Login/register via Supabase Auth (email/password)
- **Cloud sync:** Data sync otomatis ke Supabase
- **Multi-device:** Akses dari browser mana pun setelah login
- **Offline fallback:** localStorage cache, sync saat online
- **Realtime (optional):** Perubahan real-time via Supabase Realtime

### 3.4 Fitur yang Dipertahankan
- Folder scan (tetap, sebagai cara input utama)
- Dedup via modal
- Month filter
- Status dropdown
- Search
- Export JSON (untuk backup manual)

### 3.5 Fitur yang Dihapus/Diganti
- localStorage sebagai primary storage → Supabase sebagai primary, localStorage sebagai cache
- Save button → auto-sync (dengan indicator)
- Reset button → tetap (clear local + cloud data)

## 4. Migration Plan

### Phase 1: Setup Supabase
1. Buat project di supabase.com
2. Buat tabel + RLS policy (SQL)
3. Enable Auth (email/password)
4. Dapat URL + anon key

### Phase 2: Frontend Integration
1. Tambah Supabase JS client (CDN)
2. Auth UI (login/register modal)
3. CRUD via Supabase API (insert, select, update, delete)
4. Offline cache (localStorage sebagai fallback)
5. Sync indicator (saved/syncing/error)

### Phase 3: Testing & Deploy
1. Test auth flow
2. Test CRUD operations
3. Test RLS (user isolation)
4. Deploy ke GitHub Pages
5. Update README

## 5. Security

- `anon key` di frontend (public, safe)
- `service_role` key hanya di server (tidak di frontend)
- RLS policy: `auth.uid() = user_id` (deny by default)
- CORS: Supabase handle otomatis
- HTTPS: Supabase provide SSL

## 6. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Supabase free tier limit (500MB DB) | Monitor usage, upgrade jika perlu |
| Network dependency | Offline cache di localStorage |
| Auth complexity | Supabase Auth simple (email/password) |
| Data migration | Export JSON dari localStorage → import ke Supabase |

## 7. Success Criteria

- [ ] User bisa register/login
- [ ] Folder scan → data masuk ke Supabase
- [ ] Refresh halaman → data tetap (dari Supabase)
- [ ] Multi-device: login di browser lain → data sama
- [ ] RLS: user A tidak bisa lihat data user B
- [ ] Offline: data cache di localStorage, sync saat online

## 8. Open Questions

- Email confirmation required atau auto-confirm?
- OAuth providers (Google, GitHub) atau email-only?
- Realtime subscriptions diperlukan atau polling cukup?
