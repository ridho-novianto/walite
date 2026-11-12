# Walite

Walite adalah aplikasi wrapper desktop WhatsApp Web yang ringan dan berfokus pada privasi untuk Windows 11 dan Windows 10 (64-bit), dibangun menggunakan framework Tauri v2 dan bahasa pemrograman Rust dengan runtime Microsoft Edge WebView2. Aplikasi ini dirancang untuk meminimalkan beban memori sistem, mempertahankan sesi login secara permanen di lokasi penyimpanan terisolasi, serta menyediakan kontrol privasi visual sisi klien (CSS-only blur) dan pengunci layar mandiri.

## Fitur Utama

- **Ringan dan Efisien**: Proses inti native Rust hanya mengonsumsi Private Working Set sebesar ~6,7 MB (total aplikasi + WebView2 idle ~460 MB), dibatasi dengan argumen `--renderer-process-limit=2`.
- **Sesi Login Permanen**: Data sesi dan cache profil disimpan di direktori permanen `%LocalAppData%\id.my.vianto06.walite\EBWebView` sehingga login tetap terjaga saat aplikasi ditutup, diperbarui, atau dibangun ulang.
- **Single Instance**: Menjalankan executable kedua tidak membuat proses baru, melainkan otomatis memfokuskan dan menampilkan jendela yang sudah berjalan.
- **Integrasi System Tray**: Menutup jendela utama (tombol X) akan menyembunyikan aplikasi ke system tray tanpa memutus koneksi WebSocket atau notifikasi latar belakang. Keluar permanen dapat dilakukan melalui menu klik kanan tray "Keluar".
- **Navigasi Terisolasi**: Navigasi di dalam webview dibatasi hanya untuk origin `https://web.whatsapp.com`. Seluruh tautan eksternal (skema `http`, `https`, `mailto`, `tel`) otomatis dialihkan ke peramban standar sistem operasi.
- **Panel Privasi Mandiri**: Tombol floating shield di pojok kiri bawah menyediakan toggle pengaburan (blur) visual CSS-only untuk:
  - Nama kontak dan grup di panel samping dan header
  - Foto profil kontak
  - Cuplikan pesan terakhir di daftar chat
  - Isi percakapan di ruang obrolan
  - Pratinjau media (gambar, video, dokumen)
  - Kolom pengetikan pesan
  - Pintasan keyboard global: `Alt + Z` (toggle blur) dan `Alt + X` (kunci layar langsung).
- **Pengunci Layar (Screen Lock)**: Perlindungan tampilan visual dengan lapisan blur fullscreen dan verifikasi kata sandi berbasis hashing PBKDF2 SHA-256 (100.000 iterasi). Termasuk opsi kunci otomatis (Auto-lock) saat sistem idle.

## Tangkapan Layar

> *Placeholder: Antarmuka utama memuat WhatsApp Web dengan tombol shield di kiri bawah dan dialog pengunci layar saat aktif.*

## Persyaratan Sistem

- **Sistem Operasi**: Windows 11 atau Windows 10 (64-bit, versi 1809 atau yang lebih baru).
- **Runtime**: Microsoft Edge WebView2 Runtime (sudah terpasang secara bawaan di Windows 11).
- **Hak Akses**: Tidak memerlukan hak akses Administrator (pemasangan per-user).

## Instalasi dari Releases

1. Unduh installer `Walite_0.1.0_x64-setup.exe` (~1,14 MB) dari tab [Releases](https://github.com/ridho-novianto/walite/releases).
2. Jalankan file installer. Karena installer ini belum menggunakan sertifikat penandatanganan kode berbayar (EV/OV code signing certificate), Windows SmartScreen mungkin akan menampilkan dialog peringatan "Windows protected your PC". Klik **More info** lalu pilih **Run anyway**.
3. Pemasang akan menginstal Walite ke direktori lokal pengguna (`%LocalAppData%\Programs\Walite`) dan membuat shortcut di Start Menu.

## Kompilasi dari Source

Pastikan prasyarat berikut sudah terpasang di sistem:
- Rust (toolchain `stable-x86_64-pc-windows-msvc`)
- Visual Studio Build Tools (workload "Desktop development with C++")
- Node.js (LTS v20+ atau v24+) dan npm

Langkah-langkah kompilasi:
```powershell
# 1. Klon repositori
git clone https://github.com/ridho-novianto/walite.git
cd walite

# 2. Pasang dependensi JavaScript
npm install

# 3. Verifikasi kode Rust
cargo check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml

# 4. Bangun binary release dan installer NSIS
npm run tauri build
```
Hasil kompilasi:
- Executable: `src-tauri/target/release/walite.exe` (~3,24 MB)
- Installer: `src-tauri/target/release/bundle/nsis/Walite_0.1.0_x64-setup.exe` (~1,14 MB)

## Cara Memperbarui SELECTORS bila DOM WhatsApp Berubah

Panel privasi Walite menggunakan pemilih CSS (selectors) yang didefinisikan secara terpusat pada file [`src-tauri/wa-privacy-panel.js`](src-tauri/wa-privacy-panel.js).

Jika WhatsApp Web melakukan pembaruan struktur DOM (misalnya nama attribute atau class berubah), ikuti panduan berikut:
1. Buka build debug dengan devtools aktif, atau periksa elemen target melalui browser DevTools pada `web.whatsapp.com`.
2. Temukan objek `SELECTORS` di bagian atas file `src-tauri/wa-privacy-panel.js`:
   ```javascript
   const SELECTORS = {
     names: '#pane-side [role="row"] [dir="auto"], #pane-side span[title], ...',
     avatars: '#pane-side img, #main header img, ...',
     lastMessage: '#pane-side [role="row"] [dir="ltr"], ...',
     messages: '#main .message-in, #main .message-out, ...',
     media: '#main [data-testid*="media"], #main video, ...',
     input: '#main footer [contenteditable="true"], ...'
   };
   ```
3. Sesuaikan selector yang relevan menggunakan atribut yang paling stabil (utamakan `id`, `role`, `data-testid`, atau atribut semantik `dir`).
4. Jalankan `node scripts/optimize-panel.js` untuk memastikan ukuran skrip tetap di bawah 25 KB.
5. Bangun ulang aplikasi menggunakan `npm run tauri build`.

## Catatan Privasi dan Keamanan

- **Bukan Enkripsi Data**: Pengunci layar (Screen Lock) adalah lapisan pengaman tampilan grafis di layar fisik untuk mencegah orang lain melihat obrolan saat Anda meninggalkan meja, bukan enkripsi berkas basis data di disk lokal.
- **Tanpa Telemetri**: Tidak ada analitik, pelacakan, atau modul pelaporan pihak ketiga yang dikirim dari aplikasi Walite.
- **Zero Network Calls pada Script Panel**: File `wa-privacy-panel.js` berjalan secara lokal di dalam WebView tanpa memanggil API jaringan (`fetch`, `XMLHttpRequest`, `WebSocket`, dll.).
- **Isolasi Origin**: Skrip IPC Tauri dan kapabilitas internal dinonaktifkan untuk konten eksternal `web.whatsapp.com`.

## Batasan yang Diketahui

1. **Peringatan SmartScreen**: Karena aplikasi ini merupakan proyek open-source independen tanpa sertifikat digital komersial, Windows SmartScreen akan memperingatkan saat installer pertama kali dijalankan.
2. **Ketergantungan DOM WhatsApp**: Efek pengaburan (blur) bergantung pada struktur elemen DOM WhatsApp Web. Jika WhatsApp merilis pembaruan antarmuka besar-besaran, pemilih CSS mungkin memerlukan penyesuaian minor seperti dijelaskan di atas.
3. **Panggilan Suara / Video**: Panggilan suara/video web bergantung pada dukungan protokol WebRTC WebView2 pada versi Windows yang digunakan.

## FAQ Singkat

**T: Mengapa sesi saya tidak hilang saat aplikasi ditutup?**  
J: Walite mengonfigurasi direktori profil WebView2 ke folder permanen pengguna (`%LocalAppData%\id.my.vianto06.walite\EBWebView`). Berbeda dari peramban mode privat, data cookie dan local storage WhatsApp disimpan persisten di sana.

**T: Bagaimana cara menutup aplikasi sepenuhnya?**  
J: Klik kanan pada ikon Walite di taskbar / system tray pojok kanan bawah Windows, lalu pilih **Keluar**.

**T: Apakah Walite dapat membaca pesan saya?**  
J: Tidak. Walite tidak memiliki backend server dan tidak membaca atau mengirim isi pesan obrolan Anda ke mana pun.

## Lisensi

Didistribusikan di bawah lisensi [MIT](LICENSE). Copyright © 2026 Ridho Novianto.

## Disclaimer

Proyek independen. Tidak berafiliasi dengan, didukung, atau disponsori oleh WhatsApp LLC atau Meta Platforms, Inc. WhatsApp adalah merek dagang dari pemiliknya masing-masing.
