# Changelog

Semua perubahan penting pada repository ini dicatat di sini. Format mengikuti kategori sederhana agar mudah dibaca oleh manusia dan AI agent.

## [Unreleased]

### Fixed

- Kolom Title di tabel status (termasuk New Request) tidak lagi di-truncate dengan ellipsis. Judul panjang sekarang wrap ke baris baru (`white-space: normal`, `overflow-wrap: anywhere`) supaya terbaca penuh.
- Spacing tabel request: padding horizontal 12px konsisten di `th`/`td`, jarak 30px antara dropdown Status dan Priority, dan proporsi lebar kolom diset ulang agar Team/Note tidak berlebihan (20/9/7/8/14/10/14/12/6%).
- REQUEST DATE kini tampil `DD/MM/YYYY, HH.mm` dalam satu baris berwarna muted.
- DEADLINE kini memakai badge urgensi: merah "Terlambat X hari", oranye "Hari ini"/"Besok", teks biasa "X hari lagi" — diikuti tanggal `DD/MM/YYYY`.
- Modal Login ("Masuk ke reqord") dipadatkan: lebar 420px (dulu 680px), padding dan gap form dirapikan, tombol Masuk melebar berdampingan dengan Batal. Tinggi modal 330px (dulu 408px).
- Dropdown Status di tabel kini pill soft berwarna per status + chevron kecil; dropdown Priority kini ghost dropdown dengan dot warna (abu Normal, oranye High, hijau Low) + hover halus. Keduanya rata kiri dengan teks header kolom.

### Changed

- `<select>` native pada kolom STATUS dan PRIORITY diganti custom dropdown: trigger `<button>` (tampilan pill/ghost dipertahankan) + floating menu `<div role="listbox">` yang di-append ke `body` dengan `position:fixed`, kartu putih rounded-xl, border slate, shadow, opsi berdot warna + check pada opsi aktif. Menu nutup saat klik luar, Esc, resize, scroll, atau saat tabel di-render ulang. Logika update status/priority (termasuk done → completedAt, activity, save) dipindah ke `applyInlineChange()` tanpa perubahan perilaku.
- Klik judul work order kini toggle expand sub-item inline dengan input auto-focus. Enter menyimpan sub-item dan langsung menyiapkan input baru untuk input beruntun; Esc/klik luar menutup editor tanpa menghapus data. Checklist sub-item menjorok dengan guide line vertikal, checkbox + coretan saat selesai, dan tombol hapus kecil yang muncul saat hover.
- Badge edit kecil (✎) ditambahkan di ujung setiap TITLE agar modal edit tetap mudah diakses setelah klik judul dipakai untuk toggle sub-item. Klik badge membuka edit dialog tanpa men-toggle sub-item.
- Bagian Subitems beserta input dan handler-nya dihapus dari modal Edit work order — pengelolaan sub-item kini hanya lewat expand inline di tabel utama.
- Checkbox seleksi massal dikembalikan ke semua grup status: master checkbox di header (sebelah kiri TITLE, select-all per grup) + checkbox per baris di dalam sel TITLE. Muncul floating bulk bar saat ada seleksi untuk ubah status/priority atau hapus banyak item. Klik judul untuk expand sub-item berlaku identik di semua panel status.
- Alignment sel TITLE: checkbox dan konten judul dibungkus flex `items-start gap-3`, checkbox `mt-0.5 shrink-0`, teks + badge edit dalam wrapper `flex-1 min-w-0`. Judul multi-line rata kiri di x yang sama untuk semua baris, ikon pensil ikut sejajar dengan tepi teks, header checkbox sejajar vertikal dengan checkbox baris.
- Kolom TEAM dan NOTE dihapus dari tabel. Seluruh metadata kini berkumpul dalam satu baris `.title-meta` di bawah judul (`flex flex-wrap items-center gap-1.5 mt-1.5`): pill TEAM outlined bulat, pill Note outlined bulat (tooltip + klik lihat/edit tetap ada), dan tombol pensil bulat. Kolom REQUESTOR kembali hanya berisi badge nama.
- Pill TEAM kini memakai palet warna soft yang deterministik per nama team (teks/border/background), tetap outline dan mudah dibaca.
- Fix: field `team` kini ikut dikirim ke Supabase lewat `itemToSb()` (sebelumnya hanya tersimpan lokal, hilang setelah reload dari cloud). Skrip `migration-team.sql` ditambahkan untuk `ALTER TABLE ... ADD COLUMN team TEXT`; schema doc diperbarui. Sync punya fallback agar sync lain tetap jalan bila kolom belum ada.
- Sync kini mendeteksi keberadaan kolom `team` sekali lewat `select('team').limit(1)` dan tidak mengirim field itu jika kolom belum ada, sehingga tidak lagi memunculkan toast "Sync gagal: column team". Cache-buster naik ke `app.js?v=100` / `styles.css?v=115`.
- Input TEAM di dialog Tambah/Edit kini punya suggestion dari team yang pernah dipakai, tetap bisa diisi bebas. Warna pill TEAM dihitung dari hash nama ke HSL: nama sama → warna sama, nama beda → warna beda (tidak lagi terbatas 8 palet). `app.js?v=101`.


- Tabel dengan lebar 601–1100px kini discroll horizontal (min-width 1080px) supaya kolom tidak berhimpitan.

## [v0.6.1] — 2026-11-13

### Added

- 11 panel status: satu tabel per status (New Request, Waiting Brief, Working, 1st Draft, In Revision, Preview, On Hold, Approved, Done, Daily, Cancelled); panel kosong tersembunyi.
- Settings dialog di header: Ganti Password, Export Excel (XLSX), Export JSON, Import Excel, Import JSON.
- Show more: 20 item per halaman di tiap panel status + public board ("Show more (N lagi)").
- Activity mencatat username (`user · requestor · date`).
- Sync reconciliation: item di DB yang foldernya tidak ada lagi ditandai badge ⚠ orphan.

### Changed

- User menu dropdown di header (Login / Settings / Logout).
- Title cell 1 baris: truncate dengan ellipsis, tidak wrap di bawah checkbox.
- Cache-buster `app.js?v=67`, `public.js?v=4`.

### Removed

- Scan Folder & Refresh: input kini manual lewat `+ Tambah` supaya data benar-benar ter-track.
- Kode mati: `scanFolderHandle`, `saveFolderHandle`, `restoreFolderHandle`, `openDraftDatabase`, `storageDatabase`, `isLoadingWorkbook`, `dateAfterDays`, `isCompletedRequest`, `renderDailyTasks`, `renderDailyRow`, `refreshDailyDates`.

## [v0.6.2] — 2026-11-13

### Fixed

- Anti data-loss: backup lokal rolling (maks 5 titik), setiap penyimpanan menulis backup sebelumnya; storage corrupt otomatis dipulihkan dari backup.
- Sync reconciliation tidak lagi menghapus item lokal saat cloud kosong — cloud kosong kini memicu push ulang, bukan hapus.
- Per-user parked items: logout menyimpan items per-user (parked) dan login mengembalikannya — ganti user tidak lagi berisiko menghapus atau membocorkan data.
- Status Daily di-normalisasi benar sehingga pindah ke tabel Daily.

### Added

- Auto-sync: perubahan lokal otomatis disinkronkan ke cloud setelah 5 detik idle (batch 50 item/req), indikator status menunjukkan 'belum disinkron'.
- Settings → Pulihkan Backup: kembalikan data dari titik backup terakhir dengan konfirmasi.
- Import JSON & Excel wajib konfirmasi karena menimpa semua data.

## [v0.6.3] — 2026-11-13

### Added

- Settings → Kelola Kode Invite (hanya admin): generate kode acak format RQ-XXXXXXXX.
- Role pilihan: Admin atau Viewer, ditentukan saat generate.
- Kode invite disimpan di Supabase (reqord_meta), sinkron lintas device.
- Register sekarang validasi ke kode yang di-generate + legacy 'budd-reqord'.
- Kode otomatis ditandai used setelah dipakai, tidak bisa dipakai ulang.
- Salin/hapus kode dari dialog management, kode used dimark visual.

## [v0.6.4] — 2026-11-14

### Fixed

- Activity log per-user: localStorage key `reqord-activities-<user>`, park/restore on logout/login, sync to Supabase key `activities_<user>`.
- Month filter fixed: new items immediately get correct `month` (YYYY-MM) computed from requestDate/deadline in `normalizeItem()`.
- Auto-sync now silent: no toast "Tidak ada perubahan" and no sync status updates during 5s debounced auto-sync.
- debouncedSync guarded by auth: only runs when `supabaseClient.auth.getUser()` returns a user.
- Invite codes removed from public source: register validates only generated codes from `reqord_meta` (legacy `budd-reqord` fallback kept).
- Public board restricted: only items with `public: true` column visible on public page.
- RLS policies verified: anon can SELECT all (main app + public board), authenticated CRUD own rows.
- item.done reset on Done→other: status change handler sets `item.done = false` for any non-done status.
- Add dialog: removed dead `type: 'project'` param, new items always start as `new_request`.
- Realtime self-ignore: captures `currentUserId` at init, ignores payloads where `user_id` matches, debounced 1.5s reload.
- Secondary-button focus outline fixed: shorthand `border:1px solid #789b58!important` beats thin-line pass `border:1px solid var(--line)!important` cascade.

### Changed

- Cache-buster `app.js?v=69`, `public.js?v=5`.

## [v0.6.0] — 2026-11-13

### Added

- Tabel tunggal terpadu: semua work order + daily task dalam satu list dengan filter status di toolbar (11 pilihan).
- Workflow status 11-tahap: New Request → Waiting Brief → Working → 1st Draft → In Revision → Preview → On Hold → Approved → Done / Daily / Cancelled.
- Status `daily` masuk ke tabel yang sama (bukan tabel terpisah) dengan checkbox \"Selesai hari ini\" di kolom Actions dan counter di header tabel.
- Public board diubah: single list + filter status (read-only).
- Deadline pengganti Est.: default request date + 3 hari, editable di modal, tampil di semua tabel dengan countdown.

### Changed

- Arsitektur dari multi-tabel (Request/Ongoing/Done) → single tabel \"Work orders\" dengan kolom Status sebagai dropdown.
- Migrasi status lama: List→New Request, Ongoing→Working, Preview→1st Draft (DB constraint perlu di-update via SQL migration).
- Default status saat buat item baru: `new_request` (bukan `list`).
- Scan folder menggunakan `new_request` sebagai status awal.
- Bulk dialog status options diperbarui ke 11 nilai final.
- `folderKey` (path seperti `1026/Budi - Campaign`) sebagai identity canonical untuk scan dedup; disimpan di DB kolom `folder_key`.

### Removed

- Tombol Save (redundan) dan tombol Reset (menyesatkan — hanya clear lokal, data cloud kembali).
- 6 panel tabel terpisah (Request, Ongoing, Done, Daily, dll) diganti 1 panel \"Work orders\".

### Fixed

- Dropdown status tidak lagi tertutup saat sync realtime selesai (snapshot diff mengabaikan `updatedAt`, debounce 1.5s).

## [v0.5.0] — 2026-11-12

### Added

- Papan publik read-only di `public.html` (requestor, judul, status) dengan search, filter bulan, dan realtime.
- Link "Public board" di app.
- Pilih banyak work order (checkbox di kolom Title, select-all di header Title) lalu ubah status sekaligus lewat modal "Ubah Status".
- Hapus banyak work order sekaligus (tombol "Hapus" di bulk bar, dengan konfirmasi).
- Filter requestor di toolbar.
- History & Activity kini tersimpan (localStorage) dan disinkronkan ke Supabase (`reqord_meta`).
- Tombol `+ Tambah` dengan modal Tambah work order (Title, Requestor, Priority, suggestion).
- Tombol Export / Import JSON dan Reset kembali tersedia di toolbar intro.
- Riwayat versi v0.5.0 (release-notes.json + Recent changes).

### Changed

- Scan folder dan edit otomatis tersimpan ke Supabase (debounced 5 detik); sinkronisasi langsung setelah scan.
- Item contoh (seed) dihapus — app mulai dari tabel kosong.
- Teks UI era Excel ("Open file...", "Saved to workbook", "tiga tabel") diganti.
- Sync ke cloud sekarang **manual**: otomatis (debounced 5 detik) dihapus, cukup tekan tombol "Sync to Cloud". Status menampilkan `Ada perubahan · belum disinkron` dan tombol menyala saat ada yang pending.
- Kolom `Est.` (durasi pengerjaan) dihapus, diganti kolom **Deadline** di semua tabel — default 3 hari dari tanggal request, bisa diedit di modal Work order details.
- Sync sekarang **bulk**: 163 item dikirim dalam 4 request (chunk 50) alih-alih 326 request berurutan (tiap item ambil user dulu). Sinkron 163 item turun dari puluhan detik jadi ~1 detik.
- Sync sekarang **hanya mengirim yang berubah** sejak sync terakhir (dibandingkan snapshot), dan menghapus item yang sudah hilang di lokal. Ubah 1 item → 1 request; sync ulang tanpa perubahan → 0 request.
- Scan menyimpan identitas folder (`folderKey`, mis. `1026/Budi - Campaign` atau `2026/1026/Budi - Campaign`) dan dedup berdasarkan itu — bukan lagi title+requestor. Jadi edit title lalu scan ulang tidak lagi membuat duplikat; item lama tanpa `folderKey` otomatis di-backfill saat scan berikutnya.
- `folderKey` sekarang juga disimpan di database (kolom `folder_key`), bukan cuma localStorage — jadi aman kalau data browser dibersihkan. Selama kolomnya belum dibuat, sync otomatis mencoba ulang tanpa field itu.

### Fixed

- Login/register: username dinormalisasi (huruf kecil, tanpa spasi/karakter khusus) supaya email `<username>@gmail.com` selalu valid.
- Scan/sync: fallback auth memakai username (bukan password) sebagai bagian email.
- Scan: ID item kini unik. Sebelumnya `Date.now()` bisa bentrok untuk ratusan item, sehingga item saling menimpa di Supabase dan list memadat.
- Fallback auth saat sesi Supabase tidak valid: dulu bisa error karena `#codeDialog` sudah tidak ada, sekarang membuka login dialog.
- Scan folder: pemisah ` - ` disepatatkan (tidak lagi memotong nama bertanda hubung), dan folder tanpa pemisah pakai requestor `Unknown` (dulu nama bulan).
- Layout mobile: tabel penuh, label kolom benar, filter wrap, header rapat, tanpa overflow 320–1440px.
- Klik centang di kolom Title tidak lagi membuka modal detail — centang hanya toggle pilihan (klik judul yang membuka modal).
- Status sinkron kini satu indikator yang stabil: `Ada perubahan…` → `Menyinkron… n/N` → `Tersinkron · baru saja` (atau `Gagal sinkron` / `Offline`). Dulu teksnya bolak-balik antara "Unsaved changes" dan "Synced" karena dua fungsi saling menimpa elemen yang sama.
- Load dari cloud (termasuk realtime) tidak lagi me-render tabel kalau isinya sama — dropdown status yang sedang dibuka tidak tertutup saat sync selesai.
- Perbandingan data sekarang mengabaikan `updatedAt` (metadata) dan realtime load didebounce 1,5 detik, jadi sync 147 item tidak lagi memicu render beruntun yang menutup dropdown.

### Removed

- Kode mati: fitur Excel/XLSX (loadWorkbook, downloadTemplate, loadActivities*, mergeNotesFromWorkbook), suggestion lama yang tidak terpakai, dan helper auth yang tidak dipanggil. CDN SheetJS dihapus.
- Elemen UI yang sudah tidak dirender (banner Excel).
- Tombol Save (redundan — semua perubahan sudah langsung tersimpan otomatis) dan tombol Reset (hanya mengosongkan lokal, data cloud balik lagi).

## [0.4.0] - 2026-09-25

### Added

- Merombak tab `Recent changes`: dropdown tanggal + ringkasan manusiawi per versi dari `release-notes.json`.
- Menggabungkan subitems ke modal `Work order details`; Title diklik membuka detail penuh.
- Menormalisasi ukuran baris subitem + tombol × hapus pakai konfirmasi modal.
- Mengganti semua prompt browser (`New`, `Load`, hapus request, hapus subitem) dengan modal konfirmasi gaya reqord.

## [0.2.0] - 2026-09-21

### Changed

- Menetapkan versi aplikasi menjadi `v0.2.0` setelah penambahan fitur workbook, draft, activity, Daily tasks, responsive layout, dan maker panel.

### Added

- Menghapus kolom Estimasi dari Daily tasks.
- Mengubah perilaku F5/reload menjadi clean reset: localStorage dan IndexedDB draft dibersihkan, sehingga aplikasi mulai kosong.
- Mengganti label Daily task menjadi `Selesai hari ini` dan progress `X selesai hari ini`.
- Menggabungkan kolom Today dan Selesai hari ini menjadi `Status hari ini` dengan label belum/sudah dikerjakan.
- Menghapus highlight row merah/kuning berdasarkan countdown Target done.
- Menghapus action `Tandai selesai` dari Request list agar alur selesai berjalan dari Ongoing requests.
- Memperbaiki format tanggal dan jam saat export Excel agar separator `T` diganti spasi.
- Menambahkan rekomendasi judul work order yang mirip saat input Title untuk mencegah duplikasi request.
- Menambahkan field `Estimasi` berupa angka bebas dengan dropdown satuan `minutes`/`jam`.
- Mengubah label Daily task menjadi `Selesai hari ini` dan menambahkan commit terbaru ke Recent changes.
- Menambahkan reset Daily task otomatis tepat saat pergantian hari; checkbox kembali tidak tercentang dan strikethrough hilang.
- Mengganti edit langsung Title/Requestor menjadi icon edit di Actions dengan modal `Edit work order`.
- Melengkapi History & Activity menjadi audit log tanpa batas 100 item dengan lifecycle workbook, detail aksi, dan kolom `Details` pada sheet Activity.
- Memperbaiki risiko file XLSX menjadi 0 byte dengan memvalidasi hasil serialisasi sebelum membuka writer file.
- Menambahkan save-state indicator, filter priority, sorting, inline edit Title/Requestor, Undo delete, dan progress Daily tasks.
- Menghapus sheet default `Sheet1`/`Sheet 2`/`Sheet 3` saat Save agar workbook hanya berisi sheet reqord.
- Menambahkan ringkasan hasil Load workbook pada toast agar jumlah row yang dimuat terlihat.
- Mengganti footer menjadi `budife.psd` dengan modal `Meet the maker` berisi tab `Profile` dan `Changelog`.
- Mengisi tab `Changelog` pada modal maker dengan seluruh milestone utama reqord.
- Mengganti tab modal maker menjadi `Recent changes`; changelog lengkap tetap dipelihara di repository GitHub.
- Menampilkan seluruh commit repository di tab `Recent changes` beserta hash, tanggal, dan message.
- Merombak tab `Recent changes` menjadi dropdown tanggal (maks 5 baris, scroll kalau lebih) + ringkasan manusiawi per versi dari `release-notes.json`.
- Menetapkan versi aplikasi menjadi `v0.3.0`.
- Menambahkan generator `scripts/generate-recent-changes.js` dan data `recent-changes.json` untuk menjaga Recent changes tetap mudah diperbarui.
- Menambahkan browser E2E checklist dan dokumentasi batasan runtime/CDN prototype.
- Estimate field tersedia di form, modal edit, dan renderer request dengan angka bebas plus unit `minutes`/`jam`.
- Mengganti kolom `Target done` di tabel menjadi `Estimasi`.
- Mengubah Estimasi menjadi `Waktu pengerjaan` aktual yang dihitung saat request diselesaikan.
- Mengganti label kolom waktu pengerjaan di Done requests menjadi `Est.`.
- Menambahkan edit `Est.` pada modal Done request.
- Menambahkan note/catatan per work order dengan icon dan popup modal.
- Mengubah workflow menjadi status-only tanpa kolom Actions, dengan tabel On revision dan Preview — Waiting for requester review.
- Menetapkan urutan final tabel: Request list, Ongoing request, Preview, On revision, Done requests, Daily tasks.
- Memindahkan Delete request ke modal Edit work order tanpa mengembalikan kolom Actions.
- Mengubah modal menjadi `Work order details`; Delete tersedia untuk semua status.
- Mengubah label dropdown Preview menjadi `Preview` dan menukar posisi Date/Day sebelum Priority.
- Menyimpan catatan request ke sheet `Notes` saat workbook disimpan.
- Menampilkan Catatan sebagai kolom di setiap tabel request.
- Menghapus kolom Catatan dari tampilan tabel; note tetap tersedia lewat Title/modal dan tersimpan di workbook.
- Menambahkan checklist Subitems dengan input Enter-to-create dan checkbox progress.
- Menambahkan persistence Subitems ke workbook melalui sheet `Subitems`.
- Menambahkan `.gitignore` untuk mengecualikan artefak environment agent dari repository aplikasi.
- Menambahkan mode draft lokal dengan `New`, `Load`, dan `Save`; draft disimpan di IndexedDB dengan fallback localStorage.
- Menghapus tombol `Refresh` dari toolbar utama dan menampilkan nama file aktif di sebelah kontrol workbook.
- Memindahkan History ke panel `History & Activity` di sebelah kanan dan menambahkan sheet `Activity` pada workbook, termasuk catatan delete.
- Menambahkan peringatan perubahan belum disimpan saat reload atau menutup tab; status bersih kembali setelah `Save changes / Replace` berhasil.
- Membatasi tampilan `Done requests` menjadi 10 item per batch dengan tombol `Load more done works`.
- Daily task kini memakai label `Today` dan `Done today`; tanggal mengikuti hari berjalan, judul dicoret saat checkbox selesai hari ini aktif, dan status reset pada hari berikutnya.
- Memperbaiki `Save changes / Replace` agar meminta izin file tujuan dan menulis workbook kembali ke file yang dipilih, bukan menganggap download sebagai replace.
- Menambahkan tombol `Download table template` di `Settings` untuk mengunduh workbook Excel kosong dengan seluruh sheet reqord.
- Mengubah penyimpanan menjadi file-first: list kosong sebelum `Open file`, tanpa autosave ke `localStorage`, dan `Save changes` hanya aktif setelah workbook dibuka.

- Menambahkan dokumentasi dasar untuk AI agent dan handoff antar-model.
- Menambahkan `AGENT.md`, `README.md`, `STYLE.md`, dan `MEMORY.md`.
 - Menambahkan product brief reqord sebagai spreadsheet work order tiga tabel.
- Menambahkan requirement Project list, Ongoing projects, Done projects, dan status yang memindahkan item otomatis.
- Menambahkan `ROADMAP.md` untuk tahapan MVP hingga automation.
- Menambahkan prototype spreadsheet browser-first dengan form add work order, tiga tabel, inline status/priority editing, dan tema glassmorphism.
- Menambahkan penyimpanan lokal, search, perubahan tabel otomatis, serta import/export XLSX.
- Menambahkan status awal otomatis ke Project list, owner dropdown dari data yang tersedia, dan deadline otomatis tiga hari setelah input.
- Menyederhanakan UI dengan primary color hijau, glassmorphism subtle, dan menghapus tombol close/delete dari tabel.
- Menambahkan tanggal request, deadline manual dengan fallback tiga hari, serta indikator warna deadline merah dan kuning.
- Menghapus status dan deadline dari form work order; status awal otomatis masuk Project list dan tabel menampilkan Target done otomatis.
- Mengganti Owner menjadi Requestor dengan input bebas dan rekomendasi nama berdasarkan data yang sudah tersimpan.
- Menambahkan jam pada tanggal request dan menampilkannya di tabel serta export XLSX.
- Mengganti label import/export menjadi `Open file` dan `Save Excel`; workbook memiliki tiga sheet project dan `Read me` agar dapat digunakan tanpa membuka web.
- Mengganti tema dari glassmorphism ke flat style minimal dengan palet hijau matcha.
- Menambahkan modern interaction layer: entrance animation, row transition, hover/focus state, sticky header, shortcut keyboard, smooth scroll, dan reduced-motion support.
- Audit memperbaiki migrasi data lama `Owner` ke `Requestor` serta normalisasi tanggal serial dari Excel.
- Mengganti istilah `Project` menjadi `Request` pada tabel, status, workbook Excel, dan UI.
- Mengganti workspace label menjadi `reqord / Work order manager` dan menambahkan credit LinkedIn Budi Indra Ilham.
- Mengubah flow Excel menjadi Open file lalu Save changes ke file yang sama memakai File System Access API di Chrome/Edge.
- Menambahkan tabel Daily tasks di atas Request list dengan add task, date, priority, checkbox selesai, dan penyimpanan lokal terpisah.
- Menyatukan Daily task ke form Add work order dan satu data store; perubahan status ke Daily task otomatis memindahkan item ke tabel Daily.
- Menambahkan action buttons di ujung tabel request: complete memindahkan ke Done requests dan delete meminta konfirmasi.
- Menambahkan action `↻ Revisi` pada Done requests untuk mengembalikan request ke Ongoing requests.
- Menambahkan action `▶ Saya kerjain` pada Request list untuk memindahkan request ke Ongoing requests.

### Notes

- Prototype statis sudah tersedia; stack production, test, lint, dan build command belum dipilih.
