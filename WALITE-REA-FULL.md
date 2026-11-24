# Walite: Paket Prompt REA Lengkap

Tujuan: memperbaiki Walite (wrapper WhatsApp Web ringan, Tauri v2 + WebView2, Windows 11,
identifier `id.my.vianto06.walite`) agar:

- semua fitur cangkang WhatsApp Desktop tertiru tanpa ada yang terlewat (panggilan masuk,
  notifikasi, badge, tray, window, shortcut, dan lainnya),
- ringan di device low-end dan jaringan lambat,
- tidak logout sendiri,
- fitur blur/privasi dan lock screen tetap ada dan stabil.

## Cara pakai

1. Jalankan Prompt 1 di agent (REA), tunggu `rea-results/CLONE_SPEC.md` selesai.
2. Jalankan Prompt 2, tunggu `rea-results/BUILD_PLAN.md` selesai, baca dan setujui.
3. Siapkan semua yang tertulis di bagian "Yang harus saya siapkan sendiri".
4. Jalankan Prompt 3.

Catatan:
- Build dan run Tauri + WebView2 harus dari Windows. Kalau agent berjalan di WSL, langkah
  build/uji tetap dijalankan dari Windows.
- Placeholder yang bisa diubah: `[5]` (batas interaksi uji umum) dan `[20]` (batas interaksi
  uji untuk inventaris fitur).
- Panggilan hanya bisa diuji dengan akun/nomor kedua milik sendiri, dan akun kamu harus
  sudah mendapat fitur Web Calling (rollout bertahap).

---

## PROMPT 1: Investigasi

```
Gunakan REA untuk memeriksa dua hal, lalu tulis hasilnya sebagai spesifikasi perbaikan
aplikasi Walite (wrapper WhatsApp Web ringan, Tauri v2 + WebView2, Windows 11).

TARGET A (referensi): WhatsApp Desktop resmi yang terpasang di komputer ini, plus
web.whatsapp.com di browser. Amati sebagai black box dengan akun saya sendiri.
TARGET B (yang diperbaiki): repo Walite di folder proyek ini. Ini kode saya sendiri,
jadi boleh dibaca penuh.

Batasan: untuk TARGET A jangan decompile/unpack, jangan bypass proteksi, jangan baca
isi chat, jangan ekstrak token/cookie/kunci sesi (cukup catat NAMA storage dan
perilakunya). Jangan kirim pesan ke orang lain, jangan otomatisasi WhatsApp. Panggilan
uji hanya ke nomor/akun kedua milik saya. Tulis file hanya di rea-results/. Isi dalam
Bahasa Indonesia; nama field, properti CSS, dan penanda UNKNOWN/INFERRED tetap Inggris.
Maksimal [5] interaksi uji per bagian, singkat dan aman (kecuali bagian 2: maksimal [20]).

Aturan efisiensi:
- Maksimal 2 script bantu di rea-results/_probe/: satu untuk baca computed CSS/layout,
  satu untuk ukur resource (RAM/CPU proses, jumlah proses WebView2) dan storage.
  Ubah script yang ada, jangan bikin baru per pertanyaan.
- Style hanya untuk komponen utama: sidebar/daftar chat, header chat, bubble pesan,
  composer, dialog, panel pengaturan. Skip hover/animasi kecuali murah.
- Kalau satu cara gagal, coba maksimal 2x lalu tandai UNKNOWN dan lanjut.
- Jangan simpan dump besar; ringkas langsung, simpan hanya yang dipakai.
- Setelah CLONE_SPEC.md selesai, hapus file sementara di _probe/ kecuali script-nya.

Tulis rea-results/CLONE_SPEC.md (ringkas, tabel/poin):

1. Audit Walite (TARGET B): daftar bug dan ketidakcocokan dari membaca kode dan
   menjalankan app. Tiap item: gejala, penyebab (bukti file/baris), tingkat keparahan.
   Cek khusus: lokasi dan stabilitas WebView2 user data folder, kode yang menghapus/
   mengubah storage, user agent yang dipakai, penanganan tray/close, single instance,
   injeksi wa-privacy-panel.js (kerapuhan terhadap perubahan DOM), lock screen,
   perilaku saat offline/jaringan lambat.

2. Inventaris fitur WhatsApp Desktop (matriks paritas). Targetnya mendata SEMUA fitur
   cangkang desktop, tanpa ada yang dilewati. Telusuri minimal kategori berikut, lalu
   tambahkan kategori lain yang kamu temukan:
   a. Panggilan masuk: bentuk jendela/popup (ukuran, posisi, apakah selalu di atas,
      apakah muncul di atas aplikasi lain/layar penuh), tombol Terima/Tolak/Balas
      pesan, suara dering, perilaku saat app diminimize atau di tray, panggilan
      suara vs video, panggilan grup, jendela panggilan aktif (kontrol mute/kamera/
      share screen, ukuran, always-on-top), panggilan tak terjawab.
   b. Notifikasi: tampilan toast, isi (pengirim/pratinjau), tombol aksi (balas
      cepat, tandai dibaca), klik membuka chat yang tepat, grup/ikon/suara,
      pengaturan pratinjau dan suara, perilaku Do Not Disturb/Focus Assist,
      notifikasi saat app fokus vs tidak.
   c. Badge dan indikator: badge unread di taskbar/ikon tray, overlay icon, flash
      taskbar, perubahan ikon tray saat ada pesan.
   d. Window: title bar, tombol window, ukuran minimum, restore posisi/ukuran/monitor,
      fullscreen, zoom, tema (light/dark/ikut sistem), perilaku Close/minimize ke tray.
   e. Sistem: start saat login, single instance, klik ikon tray, menu klik kanan tray
      dan taskbar (jump list), deep link (whatsapp://, wa.me), asosiasi protokol.
   f. Input/Output: shortcut keyboard (dalam app dan global), drag-drop file, tempel
      gambar/file dari clipboard, unduhan (lokasi, dialog simpan, buka file), pratinjau
      media, izin mikrofon/kamera/layar, pemilihan perangkat audio, spellcheck, emoji
      picker, link terbuka di browser mana.
   g. Pengaturan dan update: menu pengaturan yang ada di app desktop (notifikasi,
      umum, penyimpanan, bantuan), mekanisme update.
   h. Perilaku jaringan: tampilan saat offline, reconnect, sinkronisasi ulang.

   Untuk SETIAP fitur, isi baris tabel dengan kolom:
   fitur | perilaku WA Desktop (bukti singkat) | ada di web.whatsapp.com? (ya/tidak/
   UNKNOWN) | cara di Walite (Tauri API native / JS di WebView2 / tidak mungkin) |
   status: MATCHED, EMULATED, atau IMPOSSIBLE (beri alasan satu baris).

   Khusus panggilan: WhatsApp Web sudah mendukung panggilan suara/video (satu lawan satu
   dan grup, tab Calls, screen sharing) sejak rilis bertahap Juli 2026. Verifikasi di
   akun saya apakah sudah aktif, lalu uji langsung di dalam WebView2 Walite: apakah
   izin mikrofon/kamera/layar bisa diberikan dan diingat, apakah panggilan keluar dan
   masuk berjalan, apakah suara dering terdengar, dan sinyal apa yang bisa dipakai app
   untuk tahu ada panggilan masuk saat jendela di tray (Notification API, perubahan
   title/favicon, event DOM). Catat hanya NAMA sinyalnya, bukan isi chat.

3. UI/UX: warna (light + dark), tipografi, radius, bayangan, padding/margin/gap
   komponen utama (nilai asli computed CSS), state loading/kosong/offline/error.
   Screenshot di rea-results/screenshots/: wa-desktop.png (jendela 1280px),
   wa-mobile.png (375px), dan walite-sekarang.png (kondisi Walite saat ini, ukuran
   sama dengan wa-desktop). Maksimal 1 per ukuran. Gagal 2x = UNKNOWN.

4. Sesi dan penyebab logout: catat bagaimana WhatsApp Web menyimpan sesi (nama
   IndexedDB, localStorage, Cache Storage, Service Worker; tanpa nilai). Daftar kandidat
   penyebab logout sendiri dan tandai mana yang terbukti di Walite: user data folder
   berubah/ephemeral, storage terhapus, user agent usang atau diubah, WebView2 runtime
   update, storage kena eviction, dua instance dengan profil yang sama, crash saat tulis
   storage, sesi tertaut kedaluwarsa dari sisi HP. Tandai mana yang di sisi app (bisa
   diperbaiki) dan mana yang di sisi server WhatsApp (tidak bisa).

5. Performa: ukur idle RAM dan CPU (rata-rata proses gabungan, termasuk child WebView2)
   untuk WhatsApp Desktop, WhatsApp Web di browser, dan Walite sekarang. Catat flag
   WebView2/Tauri yang relevan untuk device low-end dan jaringan lambat.

6. Fitur blur/privasi: daftar perilaku panel privasi Walite sekarang, mana yang rusak,
   dan bagian mana yang bergantung pada selector DOM WhatsApp (tandai yang rapuh).

Aturan: bukti singkat tiap klaim, yang belum pasti tandai UNKNOWN, sensor
key/token/cookie, jangan salin kode/aset/logo/branding WhatsApp, jangan query API/
database di luar yang diminta aplikasi itu sendiri, jangan tulis implementasinya.
Akhiri dengan daftar "Tidak bisa diamati dari luar".
```

---

## PROMPT 2: Rencana

```
Baca rea-results/CLONE_SPEC.md. Buat rencana perbaikan Walite (Tauri v2 + WebView2,
target https://web.whatsapp.com, identifier id.my.vianto06.walite). Jangan tulis kode dulu.

Tulis dalam SATU file: rea-results/BUILD_PLAN.md. Bahasa Indonesia, poin-poin,
maksimal 3 halaman, dibagi per fase. Isi:

1. Strategi: perbaiki repo yang ada atau rebuild bagian tertentu (pilih dan beri alasan
   satu baris per bagian). Urutan fase:
   - Fase 1 = stabilitas sesi (tanpa logout sendiri) + performa
   - Fase 2 = cangkang app (window, tray, single instance, start saat login, badge)
   - Fase 3 = notifikasi dan panggilan masuk
   - Fase 4 = tampilan/UI agar cocok referensi + sisa fitur dari matriks paritas
   - Fase 5 = panel privasi/blur + lock screen
   - Fase 6 = polish (offline screen, README profesional, copyright, ikon monogram WL,
     setelan GitHub)
2. Perbaikan sesi: langkah konkret dari temuan bagian 4 CLONE_SPEC (satu baris per
   item), termasuk lokasi data folder tetap, larangan kode yang menghapus storage,
   user agent stabil, single instance, penutupan yang aman saat exit.
3. Performa: optimasi untuk low-end dan jaringan lambat (satu baris per item).
4. Cangkang dan UI: komponen/fitur yang diubah atau ditambah (satu baris per item).
5. Panel privasi: perilaku yang dipertahankan (shield, blur per elemen, Alt+Z overall,
   Alt+X lock, auto-lock N menit, password lock screen, state di localStorage) dan cara
   membuatnya tahan perubahan DOM (fallback jika selector gagal, jangan membaca atau
   mengirim isi chat).
6. Rencana paritas fitur: salin seluruh baris matriks paritas dari CLONE_SPEC bagian 2
   dan jadikan checklist per fase. Tiap fitur berstatus MATCHED/EMULATED wajib punya
   satu baris rencana (API Tauri/plugin/JS yang dipakai). Fitur berstatus IMPOSSIBLE
   ditulis terpisah beserta alasan dan alternatif terdekat. Jangan menghapus baris
   apa pun dari matriks.
   Khusus panggilan masuk: rancang jendela popup terpisah yang selalu di atas
   (always-on-top, bisa dipicu saat app di tray) dengan tombol Terima/Tolak yang
   meneruskan aksi ke WhatsApp Web. Panggilan itu sendiri tetap berjalan lewat
   WhatsApp Web di WebView2; sertakan juga penanganan izin mikrofon/kamera/layar
   WebView2 (diingat, tidak minta ulang tiap buka), pemilihan perangkat audio, dan
   perilaku jendela panggilan aktif. Jangan merancang apa pun yang mengimplementasikan
   protokol panggilan WhatsApp sendiri.
7. Yang harus saya siapkan sendiri: WebView2 Runtime, Rust toolchain, Node, setup build
   di Windows atau WSL (jelaskan mana yang wajib Windows), repo GitHub, dan lainnya.
   Berurutan dan singkat.
8. Keamanan dan risiko: batasan agar tetap wrapper murni (tanpa otomatisasi, tanpa API
   tidak resmi, tanpa mengubah/memotong trafik WhatsApp, tanpa logo/branding WhatsApp
   di aplikasi). Catat jujur bahwa logout dari sisi server/HP tidak bisa dicegah dan
   risiko ban tidak bisa dijamin nol.

Item UNKNOWN dari CLONE_SPEC tulis sebagai asumsi di akhir (satu baris per item).
Jangan tulis kode, jangan tampilkan key/token asli.
Lihat juga rea-results/screenshots/ sebagai acuan tampilan.
```

---

## PROMPT 3: Build

```
Baca rea-results/BUILD_PLAN.md. Kerjakan perbaikan Walite sesuai rencana.

Aturan kerja:
- Kerjakan per fase berurutan. Selesaikan satu fase penuh sebelum lanjut.
- Fase 1 wajib diuji dulu: tutup dan buka app berulang kali, restart app setelah idle,
  dan pastikan sesi WhatsApp tetap login tanpa scan ulang QR. Laporkan hasil tes ini
  secara jujur, termasuk yang belum bisa diuji.
- Jangan pernah menambah kode yang menghapus cookie/storage/profil WebView2.
- Jangan membaca, menyimpan, mencatat di log, atau mengirim isi chat. Injeksi hanya
  untuk blur/lock UI dan untuk meneruskan sinyal notifikasi/panggilan secara lokal.
- Notifikasi dan panggilan: pakai API native Windows lewat Tauri. Data hanya diteruskan
  lokal ke toast/popup, tidak disimpan dan tidak dikirim ke mana pun.
- Panggilan berjalan lewat WhatsApp Web di WebView2. Pastikan izin mikrofon/kamera/layar
  ditangani dan diingat, pemilihan perangkat audio berfungsi, dan popup panggilan masuk
  selalu-di-atas muncul walau app di tray. Uji dengan akun kedua milik saya.
- Bangun semua fitur berstatus MATCHED/EMULATED di checklist paritas BUILD_PLAN.md,
  satu per satu. Centang di checklist setelah fitur diuji, bukan setelah ditulis.
- Setelah tiap fase: jalankan build (npm run tauri build atau perintah build proyek
  ini) dan perbaiki error sebelum lanjut.
- Bandingkan tampilan dengan screenshot di rea-results/screenshots/ (wa-desktop.png,
  wa-mobile.png) dan perbaiki selisihnya.
- Setelah tiap fase, commit dengan pesan jelas dan push ke GitHub.
- Jangan tampilkan key/token di output.
- Di akhir, tulis ringkasan singkat: yang selesai, yang ditunda, asumsi yang dipakai,
  angka idle RAM/CPU sebelum dan sesudah, dan hal yang tetap di luar kendali app
  (misalnya logout dari sisi server/HP).
- Tulis juga laporan paritas: tabel fitur dengan status akhir (selesai, sebagian,
  IMPOSSIBLE) dan hasil uji tiap fitur. Fitur yang tidak bisa diuji (misalnya panggilan
  video butuh perangkat kedua) tandai "belum teruji", jangan diklaim selesai.
```

---

## Batasan yang perlu diketahui

- **Panggilan** berjalan lewat WhatsApp Web (sudah mendukung panggilan suara/video sejak
  rilis bertahap Juli 2026), jadi Walite cukup memastikan WebView2 mendukungnya: izin
  mikrofon/kamera/layar, suara dering, dan popup panggilan masuk selalu-di-atas. Rollout
  bertahap, jadi akun tertentu mungkin belum mendapat fiturnya. Mengimplementasikan
  protokol panggilan sendiri tetap dilarang (jalur tidak resmi, risiko ban tinggi).
- **Notifikasi dengan tombol aksi** di Windows lewat Tauri lebih terbatas daripada notifikasi
  native WhatsApp Desktop. Kalau tidak bisa persis sama, matriks menandainya EMULATED atau
  IMPOSSIBLE, bukan dilewati diam-diam.
- **Logout sendiri** biasanya punya penyebab di sisi app (folder data WebView2 berubah atau
  terhapus, user agent usang, storage terbuang), dan itu diburu di Fase 1. Sebagian logout tidak
  bisa dicegah app, misalnya sesi tertaut kedaluwarsa karena HP lama offline.
- **Risiko ban** tidak bisa dijamin nol. Wrapper murni tanpa otomatisasi dan tanpa API tidak
  resmi adalah posisi paling aman yang bisa dicapai.
