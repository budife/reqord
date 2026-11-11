# reqord

reqord adalah aplikasi work order tracker berbasis folder scan. Pengguna membuat folder request di struktur `YYYY/MMYY/Requestor - Campaign` (atau `MMYY/Requestor - Campaign`), lalu reqord membaca folder tersebut dan menampilkan work order di tabel.

[Dibuat oleh Budi Indra Ilham](https://www.linkedin.com/in/budife/).

## Fitur Utama

### Folder Scan

- Scan folder menggunakan File System Access API (Chromium: Chrome/Edge).
- Struktur 2-level (`MMYY/campaign`) dan 3-level (`YYYY/MMYY/campaign`).
- Nama folder format `Requestor - Campaign` → Title = campaign, Requestor = requestor.
- Dedup berdasarkan exact Title + Requestor (case-insensitive); duplikat ditampilkan via modal.
- Folder handle disimpan di IndexedDB; work order data di localStorage.
- Auto-refresh on page load jika folder handle tersimpan.
- Status diubah manual (dropdown di tabel).
- Month filter dropdown dari scanned items.

### Tabel Work Order

- Request list, Ongoing requests, Done requests.
- Ubah status langsung di tabel; item otomatis berpindah tabel.
- Cari berdasarkan title atau requestor.
- Filter priority, sort, dan month filter.

### Persistence

- Data persist di localStorage (key: `reqord-request-work-orders`).
- Folder handle persist di IndexedDB.
- Save button untuk simpan manual (toast konfirmasi).
- Export JSON / Import JSON.
- Reset button (hapus semua data + folder handle).

### Auto-sync

- Setiap perubahan (scan folder, edit, ubah status/priority, subitem) otomatis tersimpan ke Supabase dalam 5 detik.
- Tombol "Sync to Cloud" tetap ada sebagai fallback manual.

### Papan Publik (read-only)

- URL: `public.html` — bisa dibagikan ke siapa saja, tanpa login.
- Menampilkan requestor, judul, dan status per tabel.
- Search + filter bulan + realtime (berubah otomatis saat data di-update).
- Isi brief/working file dan catatan (`note`) tidak ditampilkan.

### Debug

- Console logging di DevTools (F12) untuk diagnosis persistence.
- `[reqord] loadItems: raw = ...` — localStorage content.
- `[reqord] persistDraft: saved X items` — save confirmation.

## Memulai

1. Buka https://budife.github.io/reqord/ di Chrome/Edge.
2. Klik "Scan Folder" → pilih folder root (berisi folder bulan).
3. Work order otomatis masuk ke tabel.
4. Klik "Save" untuk simpan manual (opsional, auto-save aktif).
5. Refresh halaman → data tetap ada (auto-refresh dari folder handle).

## Troubleshooting: Data Hilang di Refresh

1. Pastikan bukan mode incognito/private.
2. Klik "Save" setelah scan folder.
3. Buka DevTools (F12) → Console → cek log `[reqord] loadItems` dan `[reqord] persistDraft`.
4. Cek Application → Local Storage → `reqord-request-work-orders` harus ada isinya.
5. Jika `raw = null` → localStorage kosong (browser clear storage).
6. Jika `persistDraft: saved 0 items` → save tidak jalan.

## Dokumen

- `AGENT.md`: instruksi kerja untuk AI agent.
- `MEMORY.md`: konteks dan handoff antar sesi.
- `CHANGELOG.md`: riwayat perubahan.
- `ROADMAP.md`: tahapan pengembangan.
- `STYLE.md`: aturan gaya.

## Status

- Fase: prototype folder-scan work order tracker.
- Stack: vanilla JS + HTML + CSS (no build step).
- Storage: localStorage (items) + IndexedDB (folder handle).
- Backend: Supabase (Postgres + Auth + Realtime).
- Publik: `public.html` read-only (requestor, judul, status).
- Browser: Chromium only (File System Access API).
