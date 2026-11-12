# Walite

Walite adalah wrapper WhatsApp Web untuk Windows 11 yang ringan, aman, dan efisien, dibangun menggunakan Tauri v2 dan Rust. Aplikasi ini dirancang untuk meminimalkan penggunaan sumber daya sistem, menjaga sesi login tetap persisten dan aman, serta dilengkapi panel privasi dengan fitur pengaburan tampilan (blur) dan pengunci layar (screen lock).

## Fitur Utama

- **Ringan & Hemat Sumber Daya**: Menggunakan engine WebView2 bawaan Windows dengan flag optimasi memori dan render process limit.
- **Sesi Permanen**: Data sesi disimpan secara persisten di folder terdedikasi (`%LocalAppData%\id.my.vianto06.walite\EBWebView`).
- **Single Instance**: Mencegah proses ganda berjalan bersamaan; membuka instance baru otomatis mengaktifkan jendela yang sudah ada.
- **System Tray Terintegrasi**: Tombol tutup (X) menyembunyikan aplikasi ke system tray agar notifikasi dan koneksi WebSocket tetap aktif tanpa gangguan.
- **Navigasi Aman**: Navigasi dibatasi hanya pada WhatsApp Web (`https://web.whatsapp.com`); tautan eksternal otomatis dibuka di peramban standar sistem operasi.
- **Panel Privasi Mandiri**: Fitur blur granular (nama kontak, foto profil, pratinjau pesan, media, input teks) dan penguncian layar berbasis sandi aman (PBKDF2 SHA-256).

## Persyaratan Sistem

- Windows 10 (64-bit) versi 1809+ atau Windows 11
- Microsoft Edge WebView2 Runtime (bawaan Windows 11)

## Kompilasi dari Source

1. Pastikan Rust (`x86_64-pc-windows-msvc`), Node.js (LTS), dan Visual Studio C++ Build Tools telah terpasang.
2. Pasang dependensi:
   ```powershell
   npm install
   ```
3. Uji kompilasi:
   ```powershell
   cargo check --manifest-path src-tauri/Cargo.toml
   ```
4. Build release installer:
   ```powershell
   npm run tauri build
   ```

## Catatan Privasi & Keamanan

- Walite tidak menyertakan modul telemetri atau analitik pihak ketiga.
- Tidak ada penyimpanan kredensial, kata sandi akun, maupun isi percakapan di luar sesi resmi WhatsApp Web.
- Pengunci layar (Screen Lock) berfungsi sebagai pengaman privasi tampilan visual di layar fisik, bukan sebagai enkripsi data penyimpanan lokal.

## Disclaimer

Proyek independen. Tidak berafiliasi dengan, didukung, atau disponsori oleh WhatsApp LLC atau Meta Platforms, Inc. WhatsApp adalah merek dagang dari pemiliknya masing-masing.

## Lisensi

Didistribusikan di bawah lisensi [MIT](LICENSE). Copyright © 2026 Ridho Novianto.

