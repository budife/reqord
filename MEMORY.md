# AI Memory

Dokumen ini menyimpan konteks kerja yang perlu diketahui oleh AI agent berikutnya, terutama saat model AI diganti. Catatan di sini harus ringkas, faktual, dan diperbarui setelah pekerjaan yang bermakna.

## Project Snapshot

- Nama aplikasi: `reqord`.
- Creator: Budi Indra Ilham, LinkedIn: https://www.linkedin.com/in/budife/.
- Header menu memakai label `Settings` untuk profile maker, changelog, dan history.
- Lokasi kerja: root repository.
- Kondisi awal: repository kosong dan belum memiliki implementasi aplikasi.
- Dokumentasi dasar yang tersedia: `AGENT.md`, `README.md`, `STYLE.md`, dan `CHANGELOG.md`.
- Roadmap produk tersedia di `ROADMAP.md`.
- Test, lint, dan build: belum tersedia atau belum terdeteksi.

## Current State

- Produk: reqord adalah spreadsheet work order sederhana dengan tiga tabel: Request list, Ongoing requests, dan Done requests.
- Kebutuhan inti: input title, requestor, target done, priority, status, tabel work order, inline editing, search, dan perpindahan tabel berdasarkan status.
- Aturan input: work order baru selalu masuk `Request list`; requestor wajib diisi, dapat diketik bebas dengan rekomendasi nama yang mirip dari data yang sudah ada; target done otomatis tiga hari setelah tanggal request.
- Integrasi data wajib: import dan export `.xlsx` dengan kolom Title, Status, Requestor, RequestDate, TargetDone, dan Priority.
- Workbook Excel mandiri: `Save Excel` membuat sheet `Request List`, `Ongoing Requests`, `Done Requests`, dan `Read me`; `Open file` membaca semua sheet request.
- Flow Excel terbaru: `Open file` memilih dan memuat workbook, `Save changes` menulis kembali ke file yang sama menggunakan File System Access API di Chrome/Edge; save disabled sebelum load.
- Daily tasks ditampilkan sebagai tabel di atas Ongoing requests; item baru dari Add work order selalu masuk Request list.
- Request yang statusnya diubah menjadi `Daily task` berpindah otomatis ke tabel Daily; semua item memakai satu storage.
- Tabel Daily memakai struktur yang sama dengan tabel request: Title, Requestor, Status, Priority, Request date, Target done, dan Actions.
- Setiap tabel request memiliki tombol centang untuk menyelesaikan request dan tombol sampah dengan konfirmasi `Delete, beneran?`.
- Request list memiliki action `▶ Saya kerjain` untuk memindahkan item ke Ongoing requests.
- Dropdown requestor memiliki matching list, avatar inisial, active keyboard state, dan keyboard navigation.
- Target done ditampilkan lengkap dengan tanggal tahun dan konteks sisa waktu.
- Target done menampilkan tanggal, countdown relatif, dan tooltip tanggal lengkap.
- Request yang perlu revisi dari Done requests memakai tombol `↻` dan kembali ke Ongoing requests.
- `Save Excel` juga membuat sheet `Daily Tasks`; `Open file` membaca task dari sheet tersebut.
- Setiap sheet project diekspor sebagai tabel terpisah dengan header dan autofilter Excel.
- Data lama dengan kolom `Owner` dimigrasikan ke `Requestor` saat dibaca; tanggal serial Excel dinormalisasi saat import.
- Arah visual: flat minimal hijau matcha, responsive, dan mudah digunakan.
- Arah visual terbaru: flat style minimal dengan primary color hijau matcha, permukaan solid, dan shadow ringan; tidak ada tombol close/delete pada baris tabel.
- UX terbaru: entrance/row animations, hover/focus feedback, sticky header, shortcut Ctrl/Cmd + K, suggestion dropdown animation, dan reduced-motion support.
- Prototype awal: `index.html`, `styles.css`, dan `app.js`, tanpa build step.
- Prototype memakai `localStorage` untuk data dan SheetJS CDN untuk import/export XLSX.
- Tidak ada keputusan arsitektur aplikasi yang sudah dibuat.
- Tidak ada dependency, environment variable, API, atau service yang sudah dikonfigurasi.
- Pekerjaan berikutnya harus memilih stack dan model data, lalu mengimplementasikan fondasi sesuai `ROADMAP.md`.

## Handoff Log

### 2026-11-12 (Bulk status change)

- Agent/model: Hermes Agent.
- Permintaan: user ingin pilih banyak work order lalu ganti status sekaligus.
- Perubahan: checkbox `.row-check` di dalam `.title-cell` (khusus admin), tombol "Pilih semua" di toolbar, dan `.bulk-bar` mengambang (pilih status → Terapkan / Batal). Status mengikuti logika inline (done mengisi `completedAt`).
- Validasi: `node --check app.js`, smoke test, uji browser — pilih 3 item → bulk bar muncul (count 3), Batal → bersih, Pilih semua → 152 item, apply "Ongoing request" → item pindah tabel, apply "Request list" → kembali.
- Catatan: checkbox ditaruh di dalam sel Title agar layout kolom tabel (fixed + label mobile) tidak berubah.

### 2026-11-12 (Scan item loss / duplicate IDs)

- Agent/model: Hermes Agent.
- Permintaan: user lapor scan mendeteksi 147 folder tapi hanya 4 yang muncul.
- Penyebab: `normalizeItem()` meng-generate id dengan `Date.now()`. Ratusan item diproses dalam hitungan milidetik → banyak id bentrok. Saat `sbSyncAll()` upsert by id, item saling menimpa di Supabase; realtime `sbLoadItems()` lalu memadatkan list berdasarkan id.
- Perubahan: tambah `generateItemId()` (timestamp + counter + random) dan `repairItemIds()` untuk memperbaiki data lama yang id-nya bentrok; dipanggil saat load dan sebelum merge cloud.
- Validasi: `node --check app.js`, smoke test, simulasi 147 item → 147 id unik, dan repair 1 id → 147 id unik.

### 2026-11-12 (Auth hardening)

- Agent/model: Hermes Agent.
- Permintaan: user melaporkan "invalid email" saat register/login.
- Penyebab: username mengandung spasi/karakter khusus, lalu dijadikan email `<username>@gmail.com`.
- Perubahan: tambah `normalizeUsername()` (lowercase + buang karakter selain `a-z0-9._-`) di login & register; fallback auth scan/sync memakai `userName` (bukan password) sebagai bagian email; placeholder username diperjelas.
- Validasi: `node --check app.js`, smoke test, dan tes `normalizeUsername` via node.
- Catatan: kode invitation tetap `budd-reqord`. Reset password tidak bisa karena email pemakai fake (`@gmail.com`).

### 2026-11-12 (Public view & auto-sync)

- Agent/model: Hermes Agent.
- Permintaan: user ingin login → scan folder → update langsung; plus mode lihat publik (read-only).
- Perubahan: `app.js` `saveItems()` → `debouncedSync()`; `scanFolderHandle()` → `sbSyncAll()`; tambah `public.html`, `public.js`, `public.css`; link "Public board" di `index.html`.
- Validasi: `node --check app.js`, `node --check public.js`, `node test/app-smoke.test.js`.
- Catatan: kolom `note` tidak ditampilkan di publik, tapi API Supabase masih memungkinkan membaca `note` (RLS public SELECT). Pertimbangkan view SQL bila perlu ketat.

### 2026-09-21 (Reload clean reset)

- Permintaan: saat tekan F5, aplikasi harus clean/reset cache dan list kembali kosong.
- Perubahan: localStorage draft dibersihkan saat startup; object store IndexedDB draft di-clear saat database siap; file handle dan activity tidak dipertahankan.
- Risiko yang diterima: perubahan yang belum di-Save hilang saat F5/reload.

### 2026-09-21 (Recent changes maker tab)

- Permintaan: tab maker tidak menampilkan seluruh changelog; gunakan `Recent changes`, sedangkan changelog lengkap tetap di GitHub.
- Perubahan: mengganti tab `Changelog` menjadi `Recent changes` dan menyisakan ringkasan perubahan terbaru di modal maker.
- Aturan lanjutan: setiap fitur/perubahan baru harus menambahkan item ringkas ke daftar Recent changes dan entri lengkap ke `CHANGELOG.md`.
- Versi aplikasi dinaikkan dari `v0.1.0` menjadi `v0.2.0` karena kumpulan fitur baru bersifat additive/non-breaking.

### 2026-09-21 (Repository audit hardening)

- Audit menemukan folder environment `viserys-agent-main/` untracked di workspace; folder tidak dihapus dan tidak di-commit.
- Perubahan: menambahkan `.gitignore` untuk mengecualikan folder tersebut dari repository aplikasi.
- Save helper `writeWorkbookToHandle` sekarang mengembalikan byte count dan melakukan abort saat penulisan gagal.
- Residual risk: browser E2E untuk File System Access dan validasi row import parsial masih membutuhkan runtime browser.
- Checklist E2E terdokumentasi di `test/browser-e2e-checklist.md`; Chrome/Edge tidak tersedia di environment ini.
- Recent changes sekarang membaca `release-notes.json` (ringkasan manusiawi per versi + tanggal) dengan fallback embedded; daftar commit mentah tidak lagi dirender di tab.
- Bundling lokal SheetJS/Font Awesome belum dilakukan karena project belum memiliki package/build pipeline dan asset vendor lokal.
- Estimate field ditambahkan sebagai angka bebas + satuan `minutes`/`jam`; renderer tabel dan modal edit sudah menampilkan value/unit.
- Konsep estimate kemudian diganti: field estimasi awal dihapus; `Done requests` menghitung `Waktu pengerjaan` dari Request date sampai `completedAt`.

### 2026-09-21 (Audit follow-up)

- Audit ulang: syntax check, smoke test, dan diff check lulus.
- Perubahan lokal `index.html` berupa stylesheet Font Awesome yang dibutuhkan oleh icon square-check; perubahan tersebut kemudian dicatat/di-commit agar working tree bersih.
- Residual risk tetap: browser E2E File System Access dan validasi import parsial belum dapat diverifikasi tanpa runtime browser.

### 2026-09-21 (Complete activity audit log)

- Permintaan: History & Activity harus benar-benar lengkap.
- Perubahan: menghapus limit 100 item, mempertahankan detail activity dari workbook, menambahkan kolom `Details`, dan mencatat New, Load, Save, Save as New, edit, status, priority, daily done, delete, serta Undo.
- Validasi: `node --check app.js`, smoke test, dan `git diff --check` dijalankan.

### 2026-09-21 (Daily status column)

- Permintaan: kolom Today dan Selesai hari ini redundant.
- Perubahan: digabung menjadi `Status hari ini` dengan label `Belum dikerjakan hari ini` atau `Sudah selesai hari ini`, plus tanggal sebagai konteks.

### 2026-09-21 (Focus style rule)

- Preferensi UI: semua field focus memakai garis tipis konsisten, tanpa outline/ring tebal atau shadow besar.
- Perubahan: menyamakan focus state dropdown tabel, search, dan input modal edit menjadi outline 1px tanpa box-shadow.

### 2026-09-21 (Automatic daily reset)

- Permintaan: checkbox Daily task harus reset tidak tercentang pada hari berikutnya.
- Perubahan: menambahkan timer pergantian hari yang menghapus `dailyDoneDate`, merender ulang checkbox/strikethrough, dan memperbarui progress harian.

### 2026-09-21 (Daily completion wording)

- Perubahan: label `Done today` diganti menjadi `Selesai hari ini`, dan progress memakai format `X selesai hari ini`.
- Catatan: Recent changes diperbarui dengan commit-commit terbaru.

### 2026-09-21 (XLSX zero-byte safeguard)

- Masalah: proses `createWritable()` dapat men-truncate file sebelum `XLSX.write()` gagal, meninggalkan file 0 byte.
- Perubahan: hasil serialisasi workbook sekarang divalidasi sebelum writer file dibuat; download juga memakai guard byte yang sama.
- Validasi: `node --check app.js`, smoke test, dan `git diff --check` dijalankan.

### 2026-09-21 (MVP reliability pass)

- Agent/model: OpenCode.
- Permintaan: mengerjakan seluruh daftar improvement MVP.
- Perubahan tahap ini: save-state indicator, filter/sort, edit cepat Title/Requestor, Undo delete, progress Daily, konfirmasi Load, dan fallback pesan saat SheetJS CDN gagal.
- Validasi: `node --check app.js` dan `git diff --check` dijalankan.
- Pekerjaan lanjutan: pengujian browser nyata, validasi import parsial, dan pemecahan `app.js` ke modul kecil masih perlu dilanjutkan.

### 2026-09-21 (MVP reliability checkpoints)

- Implemented: save-state indicator, priority filter, sorting, quick Title/Requestor editing, Undo delete toast, Daily progress counter, Load confirmation, mobile table/toolbar layout, SheetJS unavailable banner, safer local persistence error handling, and Node smoke checks.
- Commits: `99f1750` and `62b47c2`, both pushed to `origin/main`.
- Not yet fully verified: real browser File System Access permission flows, partial/invalid workbook row reporting, full Activity merge semantics, bundled SheetJS/offline operation, and complete `app.js` modular refactor.

### 2026-09-20 (Maker modal)

- Agent/model: OpenCode.
- Permintaan: footer memakai `budife.psd`, hover `Meet the maker`, klik membuka modal/sidebar dengan tab Profile dan Changelog.
- Perubahan: mengganti credit footer menjadi trigger maker dan menambahkan maker modal dua tab.
- Validasi: pemeriksaan sintaks JavaScript dan whitespace dijalankan setelah edit.

### 2026-09-20 (Draft and workbook modes)

- Agent/model: OpenCode.
- Permintaan: data dapat dibuat sebelum load, tersimpan lokal, lalu workbook dapat di-load dan di-replace atau disimpan sebagai file baru.
- Perubahan: menambahkan aksi `New`, `Load`, `Save`, `Save as New`, `Refresh`, persistence IndexedDB/localStorage, dan mode replace workbook.
- Validasi: pemeriksaan sintaks JavaScript dan whitespace dijalankan setelah edit.

### 2026-09-20 (History and activity panel)

- Agent/model: OpenCode.
- Permintaan: History dipindah dari Settings ke sisi kanan, digabung dengan activity, dan delete dicatat ke sheet.
- Perubahan: menambahkan panel topbar `History & Activity`, activity tracking untuk aksi utama, serta sheet `Activity` saat export workbook.
- Validasi: pemeriksaan sintaks JavaScript dan whitespace dijalankan setelah edit.

### 2026-09-20 (Unsaved changes warning)

- Agent/model: OpenCode.
- Permintaan: ingatkan pengguna menyimpan perubahan sebelum F5 karena autosave langsung ke Excel tidak memungkinkan tanpa izin browser.
- Perubahan: menambahkan dirty-state dan `beforeunload` warning; save berhasil menghapus status belum tersimpan.
- Validasi: pemeriksaan sintaks JavaScript dan whitespace dijalankan setelah edit.

### 2026-09-20 (Done request pagination)

- Agent/model: OpenCode.
- Permintaan: Done requests dibatasi 10 item dan bertambah 10 item lewat load more.
- Perubahan: menambahkan limit tampilan `Done requests` dan tombol `Load more done works`; data internal/export tetap lengkap.
- Validasi: pemeriksaan sintaks JavaScript dan whitespace dijalankan setelah edit.

### 2026-09-20 (Daily task recurrence)

- Agent/model: OpenCode.
- Permintaan: Daily tasks selesai per hari dan reset ketika tanggal berganti.
- Perubahan: menambahkan `dailyDoneDate`, action `Today done`, dan pengecekan tanggal hari ini saat render/export.
- Validasi: pemeriksaan sintaks JavaScript dan whitespace dijalankan setelah edit.

### 2026-09-20 (Daily task date display)

- Agent/model: OpenCode.
- Permintaan: tanggal Daily task harus berubah mengikuti hari, dan task yang selesai harus terlihat dicoret.
- Perubahan: `Request date` dan `Target done` daily selalu disegarkan ke hari ini; judul mendapat strikethrough saat `dailyDoneDate` sama dengan hari ini.
- Validasi: pemeriksaan sintaks JavaScript dan whitespace dijalankan setelah edit.

### 2026-09-20 (Template save fix)

- Agent/model: OpenCode.
- Masalah: template tanpa baris data ditolak sebagai workbook kosong; browser fallback tidak dapat menulis kembali file yang dipilih.
- Perubahan: `Save changes / Replace` meminta handle save bila belum tersedia lalu menulis workbook ke file tujuan; fallback download hanya dipakai jika browser tidak mendukung file picker.
- Validasi: `node --check app.js` dan `git diff --check` dijalankan.

### 2026-09-20 (Table template)

- Agent/model: OpenCode.
- Permintaan: menyediakan template table yang dapat diunduh dari `Settings`.
- Perubahan: menambahkan tombol `Download table template` dan workbook kosong dengan sheet request, `Daily Tasks`, serta `Read me`.
- Validasi: perubahan memakai library SheetJS yang sudah tersedia; validasi sintaks dijalankan setelah edit.

### 2026-09-20 (File-first storage)

- Agent/model: OpenCode.
- Permintaan: list tidak boleh muncul atau tersimpan sebelum pengguna membuka workbook.
- Perubahan: `app.js` memulai dengan list kosong dan tidak lagi menulis perubahan ke `localStorage`; label UI menjelaskan bahwa `Open file` harus dilakukan sebelum `Save changes`.
- Validasi: `node --check app.js` berhasil.
- Keputusan: data setelah `Open file` hanya berada di memori halaman sampai `Save changes` menulis kembali ke workbook yang dibuka.

### 2026-09-20

- Agent/model: OpenCode.
- Permintaan: menambahkan dokumentasi Markdown untuk agent, changelog, README, style, dan memory agar konteks tetap tersedia saat model AI berganti.
- Perubahan: membuat lima file dokumentasi di root repository.
- Validasi: memeriksa bahwa direktori awal kosong; belum ada test atau build yang dapat dijalankan.
- Next step: tentukan tujuan proyek dan tambahkan implementasi pertama beserta test yang relevan.

### 2026-09-20 (Product Definition)

- Agent/model: OpenCode.
- Klarifikasi pengguna: proyek reqord ditujukan untuk membuat dan memantau request/work order, mirip Monday.com, dengan penyimpanan otomatis ke XLSX serta kemampuan import/export.
- Keputusan produk: scope mencakup pipeline, board/table views, status pekerjaan, custom fields, collaboration, dashboard, XLSX data flow, dan visual premium glassmorphism.
- Perubahan: memperbarui `README.md`, `AGENT.md`, `STYLE.md`, `CHANGELOG.md`, `MEMORY.md`, dan menambahkan `ROADMAP.md`.
- Validasi: dokumentasi dibaca ulang; belum ada implementasi atau test yang dapat dijalankan.
- Next step: pilih stack dan bentuk model data, lalu implementasikan Phase 0 dan MVP pipeline.

### 2026-09-20 (Prototype)

- Agent/model: OpenCode.
- Perubahan: mengganti inbox menjadi spreadsheet work order dengan form add work order dan tiga tabel Project list, Ongoing projects, Done projects.
- XLSX: import dan export work order menggunakan kolom Title, Status, Requestor, RequestDate, TargetDone, dan Priority melalui SheetJS CDN.
- Interaksi: status dan priority dapat diubah langsung dari dropdown tabel; perubahan status otomatis memindahkan baris ke tabel yang sesuai; data tersimpan di `localStorage`.
- Input baru: form tidak meminta status atau target done; status awal otomatis `Project list` dan target done dihitung sistem.
- Aturan target terbaru: form tidak menampilkan status/deadline; tanggal dan jam request dicatat, target done otomatis tanggal request +3 hari. Hari request normal, row kuning saat sisa tepat 2 hari, dan merah saat sisa maksimal 1 hari.
- Validasi: file dibuat dan referensi antar-file diperiksa; belum menjalankan browser test otomatis.
- Next step: jalankan `index.html` di browser, pilih stack production, lalu ganti data lokal dengan model backend/import flow yang tervalidasi.

## Open Questions

- Stack frontend, backend, database, dan library XLSX apa yang akan digunakan?
- Apakah aplikasi harus local-first, cloud-first, atau hybrid?
- Apakah autosave ke XLSX berarti file lokal otomatis, penyimpanan server dalam format XLSX, atau export terjadwal?
- Apakah kolaborasi real-time dan multi-user masuk MVP atau fase berikutnya?
- Format matching item saat import memakai ID, external ID, atau kombinasi field?
- Apa definisi selesai untuk MVP pertama?

## Rules For Future Entries

- Tambahkan entri baru di bagian paling atas `Handoff Log`.
- Jangan menghapus catatan lama kecuali sudah terbukti salah; koreksi dengan catatan baru.
- Gunakan tanggal format `YYYY-MM-DD`.
- Catat fakta dan hasil validasi, bukan dugaan yang belum dikonfirmasi.
