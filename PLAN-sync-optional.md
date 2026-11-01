# Plan: Rework Flow - Scan Local, Sync Optional (Multi-Device)

## Problem
- Auth (Supabase) terjadi saat scan folder → rate limit, memblokir scan
- Auto-sync setiap saveItems() → terlalu banyak request ke Supabase
- User ingin: scan folder dulu (lokal), lalu pilih sync ke Supabase
- User juga ingin: buka di device lain → lihat data yang sudah di-sync

## Flow Baru

### 1. Scan Folder (lokal, tanpa auth)
- Klik Scan Folder → pilih folder → scan
- Data masuk ke localStorage (items, activities)
- TIDAK ada auth, TIDAK ada Supabase call
- Toast: "X work order dimuat dari folder"

### 2. Work (offline-capable)
- Edit, ubah status, tambah subitem, dll
- Semua auto-save ke localStorage
- TIDAK sync ke Supabase otomatis

### 3. Sync to Supabase (opsional, manual)
- Tombol "Sync to Cloud" di intro-actions
- Klik → jika belum auth: prompt kode → signIn/signUp
- Jika auth berhasil:
  - Push semua items ke Supabase (upsert by id)
  - Pull data dari Supabase yang lebih baru (merge by id, keep newer updated_at)
- Toast: "Synced: X pushed, Y pulled"
- Session disimpan di browser (supabase.auth.getSession)

### 4. Multi-Device Access
- Device A: Scan → Sync to Cloud (auth dengan kode X)
- Device B: Buka app → jika session valid → auto-pull dari Supabase
  - Jika session expired/tidak ada → prompt kode → pull data
- Setelah pull, data tampil di Device B
- Edit di Device B → Sync to Cloud → push perubahan

### 5. Buttons
- Scan Folder (lokal)
- Refresh (re-scan folder lokal)
- Save (simpan ke file Excel, existing)
- Sync to Cloud (push/pull Supabase)
- Export JSON / Import JSON
- Reset (hapus semua)

## Changes Needed

### app.js
1. Remove auth block from scanFolderButton handler
2. Remove sbSyncAll() call from saveItems() — atau buat conditional
3. Add syncToCloud() function:
   - Check auth (prompt if needed)
   - Upsert all items to Supabase
   - Pull newer items from Supabase
   - Merge (by id, keep newer updated_at)
4. Add syncToCloudButton event listener
5. On page load: jika session valid → sbLoadItems() (pull from cloud)
6. Keep sbLoadItems() for initial load (jika sudah auth)

### index.html
1. Tambah button "Sync to Cloud" di intro-actions
2. Keep semua button existing

### Supabase
- Tidak ada perubahan schema
- Auth hanya terjadi saat user klik Sync
- Session persist di browser (supabase.auth.getSession)

## Auth Handling
- Session disimpan di browser (supabase.auth.getSession)
- Jika session valid → skip prompt
- Jika session expired → prompt kode
- Rate limit: hanya kena saat sync, bukan saat scan

## Edge Cases
- Offline: scan + work tetap bisa, sync gagal → toast error, data tetap di localStorage
- Konflik data: merge by id, keep yang updated_at lebih baru
- User ganti kode: signOut dulu, lalu signIn dengan kode baru
- Multi-device: pull on load jika session valid
