# WaLite Project Context & Memory (Windows & Linux Architecture)

Dokumen ini berisi rangkuman lengkap arsitektur, histori perbaikan, status berkas, dan instruksi kompilasi untuk **WaLite v0.2.0 (Stable Release / LTS Baseline)**. Simpan atau *copy-paste* seluruh isi dokumen ini ke sesi chat AI baru saat Anda membuka project ini di **Windows** agar AI langsung memahami seluruh konteks tanpa kehilangan jejak.

---

## 📌 1. Identitas & Gambaran Proyek

* **Nama Proyek:** WaLite
* **Versi:** `0.2.0` (Stable / Production Ready / LTS Baseline)
* **Deskripsi:** Wrapper WhatsApp Web desktop yang ultra-ringan, aman, dan berfokus pada privasi visual.
* **Lokasi Partisi:** Partisi NTFS bersama (`/run/media/veinnn/PENS/Project/apps/walite` di Linux, atau `D:\Project\apps\walite` / drive PENS di Windows).
* **Lisensi:** MIT

---

## 🏗️ 2. Arsitektur Pemisahan Multi-Platform

Project ini secara cerdas memisahkan mesin peramban (*browser engine*) berdasarkan keunggulan native masing-masing sistem operasi:

| Komponen | Windows Client | Linux Client |
| :--- | :--- | :--- |
| **Teknologi Core** | **Tauri v2 (Rust 1.98+)** | **Python 3.11+ (PyQt6)** |
| **Web Engine** | **Microsoft Edge WebView2** (Chromium) | **QtWebEngine (Chromium 140)** |
| **Ukuran Biner** | ~3.2 MB (Executable portabel) | Standalone AppImage (~110 MB) |
| **RAM Core Idle** | ~6.7 MB (Private Working Set) | ~180-280 MB (Full Chromium GPU) |
| **Status Stabilitas** | 100% Stabil (Edge native hardware acceleration) | 100% Stabil (VA-API/Vulkan, no WebKitGTK freeze) |
| **Notifikasi** | Dedicated Floating Toast Card (`src/toast.html`) | Native KDE Plasma / FreeDesktop D-Bus |

---

## 🚀 3. Fitur Utama & Notifikasi Balas Cepat (Quick Reply)

### A. Windows (Tauri v2)
1. **Floating Toast Card (`src/toast.html`):**
   * Jendela melayang frameless dan transparan berdesain Fluent Dark khas Windows 11 di sudut kanan bawah desktop (tepat di atas taskbar).
   * Menampilkan foto profil/avatar kontak (lingkaran), nama pengirim, dan pratinjau pesan.
   * Ditampilkan dengan flag `SW_SHOWNOACTIVATE` sehingga **tidak mencuri fokus ketikan aktif** saat user sedang mengetik di aplikasi lain.
2. **Balas Cepat (Quick Reply):**
   * Kolom input balasan inline (`Balas cepat...`) dan tombol kirim paper-plane.
   * Mengetik balasan dan menekan `Enter` atau klik `Kirim` langsung mengirim pesan ke WhatsApp Web di background tanpa membuka jendela utama.
3. **Klik Langsung ke Obrolan:**
   * Mengklik bodi kartu notifikasi langsung memunculkan (*unminimize* & fokus) jendela utama WaLite dan melompat ke chat room pengirim melalui helper DOM `__walite_open_chat`.
4. **Protokol IPC Aman (`walite-action://`):**
   * Menggunakan URL scheme internal untuk komunikasi antara webview WhatsApp Web, jendela Toast, dan Rust backend tanpa terbentur masalah CSP atau dependensi COM registry.

### B. Linux (PyQt6)
1. Native D-Bus Notification (`org.freedesktop.Notifications`) dengan signal `NotificationReplied` untuk quick reply di KDE/GNOME.
2. Avatar melingkar via hint `image-path`.
3. Aktivasi jendela langsung dengan token Wayland `XDG_ACTIVATION_TOKEN`.

---

## 🛡️ 4. Engine Privacy Blur (`wa-privacy-panel.js`) & Perbaikan Bug

Berkas `src-tauri/wa-privacy-panel.js` adalah **single source of truth** untuk kedua OS (di-include oleh Rust di Windows dan di-load oleh PyQt6 di Linux):

### Bug yang Telah Diperbaiki:
1. **Kotak Ketik Pesan Ter-blur (Fixed):**
   * *Penyebab lama:* Selector `.selectable-text` di `#main` secara tidak sengaja mengenai compose box di `#main footer`.
   * *Solusi:* Selector di-scope ke `div[role="row"]` dan ditambahkan proteksi eksplisit:
     ```css
     html.wl-overall-active:not(.wl-blur-input) #main footer,
     html.wl-overall-active:not(.wl-blur-input) #main footer * { filter: none !important; }
     ```
2. **Stiker Tidak Membuka Blur saat di-Hover (Fixed):**
   * *Penyebab lama:* Elemen stiker WhatsApp (`[data-testid*="sticker"]`) tidak merespons hover induk.
   * *Solusi:* Ditambahkan selector `:has(:hover)` dan universal descendant unblur `:hover *` untuk seluruh media dan stiker.
3. **Penyusutan Ukuran:**
   * Script `scripts/optimize-panel.js` telah dijalankan untuk memadatkan CSS rules secara optimal.

---

## 📁 5. Daftar Berkas Penting & Statusnya

* `src-tauri/src/main.rs`: Entry point Tauri v2 untuk Windows. Mengelola jendela utama ("main"), jendela toast ("toast"), routing `walite-action://`, multi-monitor positioning, dan system tray.
* `src/toast.html`: Antarmuka notifikasi mengambang Windows (Fluent dark theme, avatar kontak, quick reply).
* `src-tauri/wa-download-manager.js`: Intersepsi `window.Notification` untuk Windows Quick-Reply, helper DOM `__walite_open_chat`, dan dispatcher `__walite_send_reply`.
* `src-tauri/wa-privacy-panel.js`: Engine privasi blur visual (CSS injection + floating shield toggle + screen lock PBKDF2 SHA-256).
* `src-tauri/capabilities/default.json`: Konfigurasi keamanan Tauri v2 (mengizinkan window `main` dan `toast`).
* `src-linux/walite.py`: Client mandiri Linux (PyQt6 + QtWebEngine).
* `.github/workflows/release.yml`: Workflow CI/CD GitHub Actions multi-platform (Windows Tauri + Linux AppImage).
* `CHANGELOG.md`: Catatan rilis lengkap v0.2.0 (Stable / LTS).

---

## 🛠️ 6. Cara Menjalankan & Membangun di Windows

Saat berada di Windows, pastikan dependensi berikut terpasang:
1. **Node.js** (v20 atau v22 LTS)
2. **Rust & Cargo** (Toolchain `stable-x86_64-pc-windows-msvc`)
3. **C++ Build Tools** (dari Visual Studio Community atau Build Tools for Visual Studio)
4. **WebView2 Runtime** (Bawaan Windows 10/11)

### Perintah di Terminal Windows (PowerShell / Command Prompt):

```powershell
# 1. Pindah ke direktori proyek (sesuaikan huruf drive)
cd D:\Project\apps\walite

# 2. Pastikan dependensi npm terpasang
npm install

# 3. Jalankan development mode (hot reload)
npm run tauri dev

# 4. Compile biner rilis production (.msi & .exe)
npm run tauri build
```
Hasil build installer Windows akan berada di:
`src-tauri\target\release\bundle\msi\` dan `src-tauri\target\release\bundle\nsis\`

---

## 🔄 7. Git & Release Status

* **Branch:** `main`
* **Release Tag:** `v0.2.0`
* **Commit Terakhir:** `ce7d9ba` (`feat(release): v0.2.0 - Stable Release (LTS Baseline) with interactive quick-reply notifications, privacy blur fixes, and high-performance Linux QtWebEngine`)
* **Status Working Tree:** Bersih (*clean*).
* Untuk push ke remote GitHub:
  ```bash
  git push origin main
  git push origin v0.2.0 --force
  ```
