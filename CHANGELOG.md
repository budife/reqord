# Changelog

Semua perubahan penting pada repository ini dicatat di sini. Format mengikuti kategori sederhana agar mudah dibaca oleh manusia dan AI agent.

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
- Sync sekarang **bulk**: 163 item dikirim dalam 4 request (chunk 50) alih-alih 326 request berurutan (tiap item ambil user dulu). Sinkron 163 item turun dari puluhan detik jadi ~1 detik.
- Sync sekarang **hanya mengirim yang berubah** sejak sync terakhir (dibandingkan snapshot), dan menghapus item yang sudah hilang di lokal. Ubah 1 item → 1 request; sync ulang tanpa perubahan → 0 request.

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
