# reqord

reqord adalah aplikasi work order tracker berbasis folder scan. Pengguna membuat folder request di struktur `YYYY/MMYY/Requestor - Campaign` (atau `MMYY/Requestor - Campaign`), lalu reqord membaca folder tersebut dan menampilkan work order di tabel.

[Dibuat oleh Budi Indra Ilham](https://www.linkedin.com/in/budife/).

## Fitur Utama

### Folder Scan

- Scan folder menggunakan File System Access API (Chromium: Chrome/Edge).
- Struktur 2-level (`MMYY/campaign`) dan 3-level (`YYYY/MMYY/campaign`).
- Nama folder format `Requestor - Campaign` → Title = campaign, Requestor = requestor.
- Dedup berdasarkan `folderKey` (path seperti `1026/Budi - Campaign` atau `2026/1026/Budi - Campaign`) — bukan Title+Requestor; edit title lalu scan ulang tidak membuat duplikat.
- Folder handle disimpan di IndexedDB; work order data di localStorage.
- Auto-refresh on page load jika folder handle tersimpan.
- Status diubah manual (dropdown di tabel).
- Month filter dropdown dari scanned items.

### Tabel Work Order (Single Table)

- Satu tabel terpadu "Work orders" berisi semua work order + daily task.
- Filter status di toolbar (11 pilihan: New Request, Waiting Brief, Working, 1st Draft, In Revision, Preview, On Hold, Approved, Done, Daily, Cancelled).
- Cari berdasarkan title atau requestor.
- Filter priority, sort, month filter, requestor filter.
- Kolom: Title, Requestor, Status, Priority, Request date, Deadline, Actions.
- Daily task: checkbox "Selesai hari ini" di kolom Actions, counter di header tabel.

### Persistence

- Data persist di localStorage (key: `reqord-request-work-orders`).
- Folder handle persist di IndexedDB.
- Export JSON / Import JSON.

### Sync ke Cloud (manual)

- Perubahan tersimpan lokal dulu (localStorage); tekan "Sync to Cloud" untuk mengirim semua ke Supabase.
- Status di toolbar: `Ada perubahan · belum disinkron` → `Menyinkron… n/N` → `Tersinkron · baru saja`.
- Tombol "Sync to Cloud" menyala (kuning) bila ada perubahan yang belum disinkron.
- Bulk upsert chunk 50 + snapshot diff: hanya item yang berubah dikirim, item yang hilang dihapus dari cloud.

### Login & Sync

- Login memakai username + kode (password); tersimpan di localStorage (`reqord-username`, `reqord-access-code`).
- Backend Supabase Auth (email `<username>@gmail.com`); tombol Logout dan Ganti Password di header saat login.
- Register otomatis saat kode belum terdaftar.

### Papan Publik (read-only)

- URL: `public.html` — bisa dibagikan ke siapa saja, tanpa login.
- Single list + filter status (search, status filter, month filter).
- Realtime (berubah otomatis saat data di-update).
- Isi brief/working file dan catatan (`note`) tidak ditampilkan.

### Ubah Status Banyak Sekali

- Centang work order di kolom Title (bisa dari tabel mana pun), atau gunakan checkbox "Pilih semua" di header kolom Title pada tiap tabel.
- Tombol "Pilih semua" di toolbar memilih semua yang tampil.
- Bulk bar muncul: klik "Ubah Status (N)" → modal pilih status → "Terapkan". Tombol "Hapus" menghapus semua yang dipilih (dengan konfirmasi).

### Debug

- Console logging di DevTools (F12) untuk diagnosis persistence.
- `[reqord] loadItems: raw = ...` — localStorage content.
- `[reqord] persistDraft: saved X items` — save confirmation.

## Memulai

1. Buka https://budife.github.io/reqord/ di Chrome/Edge.
2. Klik "Scan Folder" → pilih folder root (berisi folder bulan).
3. Work order otomatis masuk ke tabel (langsung tersimpan lokal).
4. Refresh halaman → data tetap ada (auto-refresh dari folder handle).

## Troubleshooting: Data Hilang di Refresh

1. Pastikan bukan mode incognito/private.
2. Buka DevTools (F12) → Console → cek log `[reqord] loadItems` dan `[reqord] persistDraft`.
3. Cek Application → Local Storage → `reqord-request-work-orders` harus ada isinya.
4. Jika `raw = null` → localStorage kosong (browser clear storage).
5. Jika `persistDraft: saved 0 items` → save tidak jalan.

## Dokumen

- `AGENT.md`: instruksi kerja untuk AI agent.
- `MEMORY.md`: konteks dan handoff antar sesi.
- `CHANGELOG.md`: riwayat perubahan.
- `ROADMAP.md`: tahapan pengembangan.
- `STYLE.md`: aturan gaya.

## Status

- Versi: v0.6.0.
- Fase: prototype folder-scan work order tracker (single-table, 11-status workflow).
- Stack: vanilla JS + HTML + CSS (no build step).
- Storage: localStorage (items) + IndexedDB (folder handle).
- Backend: Supabase (Postgres + Auth + Realtime).
- Publik: `public.html` read-only (single list + filter status).
- Browser: Chromium only (File System Access API).
