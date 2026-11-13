# reqord

reqord adalah aplikasi work order tracker **manual** — pengguna menambah work order sendiri lewat tombol `+ Tambah`, lalu memantau statusnya di 11 panel status. Tanpa scan folder, jadi semua data benar-benar ter-track.

[Dibuat oleh Budi Indra Ilham](https://www.linkedin.com/in/budife/).

## Fitur Utama

### Tambah Work Order (Manual)

- Tombol `+ Tambah` di intro → modal (Title + Requestor + Priority).
- Work order baru masuk ke panel `New Request` (status `new_request`).
- Deadline default = tanggal request + 3 hari, bisa diedit di modal detail.
- Edit: klik Title membuka modal Work order details (edit + subitems + catatan).
- Subitem inline + checklist.

### 11 Panel Status

- Satu tabel per status: New Request, Waiting Brief, Working, 1st Draft, In Revision, Preview, On Hold, Approved, Done, Daily, Cancelled.
- Panel kosong otomatis tersembunyi; muncul saat ada isi.
- Dropdown status di tiap baris untuk pindah status.
- Show more: 20 item per halaman, tombol "Show more (N lagi)".
- Cari berdasarkan title atau requestor.
- Filter priority, sort, bulan, requestor.

### Persistence

- Data persist di localStorage (key: `reqord-request-work-orders`).
- Export/Import JSON + Excel (XLSX) di Settings dialog.

### Sync ke Cloud (manual)

- Perubahan tersimpan lokal dulu (localStorage); tekan "Sync to Cloud" untuk mengirim semua ke Supabase.
- Status di toolbar: `Ada perubahan · belum disinkron` → `Menyinkron… n/N` → `Tersinkron · baru saja`.
- Bulk upsert chunk 50 + snapshot diff: hanya item yang berubah dikirim, item yang hilang dihapus dari cloud.
- Orphan detection: item di DB yang foldernya tidak ada lagi ditandai badge ⚠.

### Login & Settings

- Login memakai username + kode (password); tersimpan di localStorage (`reqord-username`, `reqord-access-code`).
- Backend Supabase Auth (email `<username>@gmail.com`).
- Menu header: Settings (Ganti Password, Export Excel/JSON, Import Excel/JSON) + Logout.

### History & Activity

- Panel kanan mencatat semua aksi: tambah, edit, hapus, status, subitem, dll.
- Tiap aktivitas mencatat **username** + requestor + tanggal.

### Papan Publik (read-only)

- URL: `public.html` — bisa dibagikan ke siapa saja, tanpa login.
- Single list + filter status (search, status filter, month filter) + show more 20/halaman.
- Realtime (berubah otomatis saat data di-update).
- Catatan (`note`) tidak ditampilkan.

### Ubah Status Banyak Sekali

- Centang work order di kolom Title, atau gunakan checkbox "Pilih semua" di header kolom.
- Tombol "Pilih semua" di toolbar memilih semua yang tampil.
- Bulk bar muncul: klik "Ubah Status (N)" → modal pilih status → "Terapkan". Tombol "Hapus" menghapus semua yang dipilih (dengan konfirmasi).

## Memulai

1. Buka https://budife.github.io/reqord/ di browser.
2. Klik `+ Tambah` → isi Title, Requestor, Priority → Simpan.
3. Work order muncul di panel New Request.
4. Tekan "Sync to Cloud" untuk mengirim ke Supabase.

## Troubleshooting: Data Hilang di Refresh

1. Pastikan bukan mode incognito/private.
2. Buka DevTools (F12) → Console → cek log `[reqord] loadItems` dan `[reqord] persistDraft`.
3. Cek Application → Local Storage → `reqord-request-work-orders` harus ada isinya.
4. Jika `raw = null` → localStorage kosong (browser clear storage).

## Dokumen

- `AGENT.md`: instruksi kerja untuk AI agent.
- `MEMORY.md`: konteks dan handoff antar sesi.
- `CHANGELOG.md`: riwayat perubahan.
- `ROADMAP.md`: tahapan pengembangan.
- `STYLE.md`: aturan gaya.

## Status

- Versi: v0.6.1.
- Fase: manual work order tracker (11 panel status, local-first + Supabase sync).
- Stack: vanilla JS + HTML + CSS (no build step).
- Storage: localStorage (items + activities).
- Backend: Supabase (Postgres + Auth + Realtime).
- Publik: `public.html` read-only (single list + filter status + show more).
