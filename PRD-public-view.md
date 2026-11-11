# PRD — reqord Public View & Auto-Sync

**Tanggal:** 2026-11-12
**Status:** Draft
**Repo:** budife/reqord (GitHub Pages)

## 1. Latar Belakang

reqord v0.4.0 sudah punya:

- Folder scan (`YYYY/MMYY/pengirim - judul email`) via File System Access API → localStorage.
- Auth Supabase (username + password → `<username>@gmail.com`; invite code untuk admin).
- Tombol "Sync to Cloud" manual (upsert semua + load).
- RLS Supabase: publik bisa `SELECT` semua `work_orders`; `INSERT/UPDATE/DELETE` hanya untuk user login.
- Realtime subscription ke `work_orders`.

Yang belum ada:

- Sync otomatis setelah scan/edit. Fungsi `debouncedSync()` sudah ada di `app.js` tapi belum pernah dipanggil.
- UI publik untuk melihat status. API-nya sudah bisa dibaca publik, tapi tidak ada halamannya.

## 2. Tujuan

1. User login → scan folder → data langsung tersimpan ke cloud tanpa klik "Sync to Cloud".
2. Publik (tanpa login) bisa melihat papan status: requestor, judul, status.
3. Tetap bisa dipakai dari kantor (GitHub Pages + Supabase).

## 3. Non-Goals

- Tidak menampilkan isi brief/working file ke publik.
- Tidak menambah kolaborasi multi-user real-time.
- Tidak mengubah flow input folder scan yang sudah ada.

## 4. Konsep

Satu app, dua muka:

- **Mode Edit** (privat): login → scan folder → ubah status. Hanya user yang login.
- **Mode Lihat** (publik): read-only, tanpa login, bisa dibagikan ke siapa saja.

## 5. Detail Perubahan

### 5.1 Auto-sync (`app.js`)

- Panggil `debouncedSync()` dari `saveItems()` sehingga scan, edit, ubah status, priority, dan subitem otomatis masuk cloud (debounce 5 detik).
- Pastikan `sbSyncAll()` dipanggil di akhir scan folder (sekitar baris 619).
- Indicator `#saveState` sudah ada; pastikan menampilkan state syncing/synced dengan benar.
- Tombol "Sync to Cloud" tetap ada sebagai fallback manual.

### 5.2 Halaman Publik (`public.html` + `public.js` + `public.css`)

- URL: `https://budife.github.io/reqord/public.html`
- Baca `work_orders` dari Supabase pakai anon key (RLS public SELECT sudah ada).
- Tampilkan: Request list, Ongoing, Preview, On revision, Done — masing-masing dengan Requestor, Title, Status.
- Search + filter month.
- Realtime update via Supabase channel.
- Tanpa login, tanpa kontrol edit.
- Ada link dari app ke halaman publik ("View public board").

### 5.3 Keamanan Publik

- Anon key memang publik (aman untuk dibagikan).
- **Risiko:** kolom `note` ada di `work_orders` dan bisa dibaca publik lewat API. Solusi: halaman publik tidak menampilkan `note`, dan mempertimbangkan Postgres view `public_work_orders` (hanya requestor, title, status, priority, month, request_date) + grant anon select ke view itu.
- RLS tetap: write butuh auth.

SQL opsional untuk membatasi kolom yang terekspos (dijalankan di Supabase SQL Editor, keputusan user):

```sql
create view public_work_orders as
  select id, requestor, title, status, priority, month, request_date, date, created_at
  from work_orders;

grant select on public_work_orders to anon;
```

### 5.4 Mode Lihat di App (opsional)

- Toggle "View mode" untuk menyembunyikan kontrol edit (presentasi/proyeksi).

## 6. Data Model

- Reuse tabel `work_orders`, tanpa migrasi.
- Opsional: kolom `is_public` (default true) jika nanti ada item yang ingin disembunyikan dari publik.

## 7. UX Publik

- Bersih, read-only, dikelompokkan per status.
- Mobile-friendly.
- Auto-refresh realtime.

## 8. Risiko

- Office firewall: Supabase harus bisa diakses dari kantor (belum terverifikasi; perkiraan user: bisa).
- File System Access API butuh Chromium + HTTPS (GitHub Pages memenuhi).
- Realtime bisa berat kalau data banyak.

## 9. Success Criteria

- [ ] Scan folder → data otomatis masuk cloud tanpa klik sync.
- [ ] Edit status → otomatis tersimpan ke cloud (debounced).
- [ ] Publik buka `public.html` → lihat requestor/judul/status.
- [ ] Publik tidak bisa edit.
- [ ] Jalan dari kantor.

## 10. Keputusan yang Saya Ambil (perlu konfirmasi)

1. Publik = halaman terpisah `public.html`, bukan toggle di app.
2. Auto-sync memakai mekanisme yang sudah ada (`debouncedSync` 5 detik + `sbSyncAll`), bukan rebuild.
3. Kolom `note` tidak ditampilkan publik; mempertimbangkan view SQL untuk membatasi kolom yang terekspos.
4. Tombol "Sync to Cloud" tetap ada sebagai fallback.
