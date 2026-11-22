# 📘 WaLite Project Handover & Architecture Guide for OpenCode

Dokumen ini disusun sebagai panduan teknis komprehensif untuk melanjutkan pengembangan aplikasi **WaLite** di **OpenCode**. Berisi gambaran umum proyek, dekonstruksi struktur folder dan fungsi berkas, implementasi fitur-fitur teknis utama, hingga aturan mutlak pengembangan.

---

## 📌 1. Gambaran Umum & Filosofi Proyek

* **Nama Aplikasi**: WaLite
* **App ID**: `id.my.vianto06.walite`
* **Versi Aktif**: `0.2.0` (Production / LTS Baseline)
* **Tujuan**: Desktop wrapper WhatsApp Web yang ultra-ringan (*lightweight*), berfokus pada privasi visual (*privacy-focused*), serta mendukung fitur native desktop seperti *Quick Reply Toast Notification* dan aktivasi *Web VoIP Calling*.
* **Pendekatan Multi-Platform**:
  * **Windows**: Dibangun menggunakan **Tauri v2 (Rust)** + **Microsoft Edge WebView2** runtime. Executable sangat kecil (~1.4 MB installer NSIS, ~3.5 MB portable binary) dengan konsumsi RAM idle hanya ~7–15 MB (Private Working Set).
  * **Linux**: Dibangun menggunakan **Python 3 (PyQt6)** + **QtWebEngine (Chromium)** yang memanfaatkan native D-Bus notifications (`org.freedesktop.Notifications`) dan integrasi Wayland/X11.

---

## 📂 2. Struktur Folder & Fungsi Komponen

```text
walite/
├── assets/                     # Aset branding visual (logo SVG & PNG)
├── scripts/                    # Skrip pembantu build & optimasi aset
├── src/                        # Frontend UI webview lokal
│   ├── index.html              # Fallback / splash screen webview
│   └── toast.html              # UI kartu notifikasi mengambang (Quick Reply)
├── src-linux/                  # Client mandiri untuk platform Linux (PyQt6)
│   ├── id.my.vianto06.walite.desktop # Desktop entry Linux
│   ├── run.sh                  # Skrip launcher Linux
│   └── walite.py               # Main application Linux (QtWebEngine + D-Bus)
├── src-tauri/                  # Client platform Windows (Tauri v2 + Rust)
│   ├── capabilities/           # Kebijakan izin keamanan Tauri v2 (default.json)
│   ├── gen/                    # Skema otomatis Tauri CLI
│   ├── icons/                  # Ikon aplikasi multi-resolusi (ico, png, icns)
│   ├── src/
│   │   └── main.rs             # Entry point Rust: window lifecycle, IPC, Win32 API
│   ├── build.rs                # Skrip build Tauri
│   ├── Cargo.toml / Cargo.lock # Dependensi Rust crate
│   ├── tauri.conf.json         # Konfigurasi aplikasi Tauri v2
│   ├── wa-download-manager.js  # Injected script: VoIP caller hook, notif interceptor, DOM helper
│   └── wa-privacy-panel.js     # Injected script: CSS blur engine, shield button, screen lock
├── .github/workflows/          # CI/CD multi-platform (Windows NSIS & Linux AppImage)
├── package.json                # Dependensi tooling Node.js (@tauri-apps/cli)
├── CHANGELOG.md                # Catatan riwayat versi & perbaikan bug
├── README.md / README.en.md    # Dokumentasi publik (Indonesia & English)
├── SECURITY.md                 # Kebijakan keamanan & pelaporan kerentanan
└── WALITE_WINDOWS_CONTEXT.md   # Konteks historis arsitektur Windows
```

---

### Analisis Mendalam Setiap Direktori

### 📁 `src/` (Frontend Jendela Lokal)
1. `src/toast.html`:
   * Antarmuka jendela kartu notifikasi mengambang (*floating notification card*) untuk Windows.
   * Mengusung desain **Fluent Dark** ala Windows 11: efek *acrylic backdrop-filter*, border halus, ikon melingkar foto pengirim, dan tombol *close*.
   * Menyediakan kolom input balasan inline (*Quick Reply*) dan tombol kirim (*paper-plane*). Saat pengguna mengetik balasan dan menekan `Enter`, pesan dikirimkan via protokol `walite-action://send-reply`.
   * Mengklik bodi notifikasi mengirimkan `walite-action://open-chat` untuk membuka dan memfokuskan jendela utama.
2. `src/index.html`:
   * Halaman placeholder/splash screen ringan lokal jika koneksi ke `web.whatsapp.com` sedang diinisialisasi.

---

### 📁 `src-tauri/` (Windows Client Backend & Injected Web Scripts)
1. `src-tauri/src/main.rs`:
   * **Entry point Tauri v2**: Mengelola siklus hidup jendela `main` (WhatsApp Web) dan jendela `toast` (kartu notifikasi).
   * **Protokol IPC Aman (`walite-action://`)**: Menangani pesan aksi dari webview tanpa bergantung pada CSP web (`notify`, `open-chat`, `send-reply`, `close-toast`).
   * **Win32 API Interop**: Menggunakan `SetWindowPos`, `HWND_TOPMOST`, dan flag `SW_SHOWNOACTIVATE` agar jendela toast selalu tampil di atas aplikasi lain di pojok kanan bawah desktop **tanpa mencuri fokus ketikan aktif**.
   * **Tray Icon & Background Sync**: Mendukung minimize to tray dan kontrol pemanggilan jendela utama.
   * **Single Instance**: Menjamin hanya satu instance WaLite yang berjalan pada satu waktu.
2. `src-tauri/wa-privacy-panel.js`:
   * **Engine Privasi Visual**: Menginjeksi CSS dinamis ke dalam WhatsApp Web untuk mem-blur berbagai elemen:
     1. *Nama Kontak & Grup* (`wl-blur-names`).
     2. *Foto Profil & Ikon Avatar* (`wl-blur-avatars`): Mencakup foto profil kontak, foto kustom grup (misal: *UKM SOFTDEV*), ikon SVG default grup/komunitas (*kelompok 2*, *PESERTA HACKATHON*), dan channel.
     3. *Pratinjau Pesan Terakhir* (`wl-blur-lastmsg`): Di panel chat kiri.
     4. *Isi Pesan Obrolan Aktif* (`wl-blur-messages`): Di ruang obrolan `#main`.
     5. *Pratinjau Media* (`wl-blur-media`): Foto, video, audio, stiker, dan dokumen.
     6. *Kotak Ketik Pesan* (`wl-blur-input`): Di footer ruang obrolan.
   * **Hover Unblur Per Baris**: Menggunakan selektor hover berbasis baris individual (`#pane-side :is(div[role="row"], [role="listitem"]):hover`) sehingga mengarahkan kursor ke satu kontak hanya membuka filter untuk kontak tersebut tanpa membuka kontak lainnya.
   * **Screen Lock**: Fitur penguncian layar dengan sandi menggunakan derivasi kunci PBKDF2 (SHA-256) dengan salt acak dan modal overlay.
   * **Shortcut Global**: `Alt+Z` (Buka panel privasi), `Alt+X` (Kunci layar), `Alt+H` (Sembunyikan/tampilkan tombol shield).
3. `src-tauri/wa-download-manager.js`:
   * **VoIP Call Activation**: Mengaitkan (*hook*) module internal `WAWebABProps` WhatsApp Web untuk mengaktifkan:
     * `web_voip_call_tab_new_call`: Memunculkan ikon tab riwayat panggilan telepon di sidebar kiri.
     * `enable_web_calling` & `enable_web_group_calling`: Mengaktifkan tombol panggilan suara dan video.
     * `web_voip_call_history`: Mengaktifkan log riwayat panggilan.
   * **Intersepsi Notifikasi**: Mem-polyfill `window.Notification` dan Service Worker Notifications agar dialihkan ke jendela `toast` WaLite di Windows.
   * **DOM Automator**:
     * `__walite_open_chat(title, tag)`: Mensimulasikan pencarian dan klik kontak di `#pane-side` untuk membuka obrolan saat notifikasi diklik.
     * `__walite_send_reply(title, tag, text)`: Mengisi kotak input chat aktif dan mengeksekusi pengiriman pesan di latar belakang.
   * **Tombol Uji Notifikasi Native**: Menyuntikkan kartu uji notifikasi langsung ke menu WhatsApp Web: *Pengaturan (Settings) -> Notifikasi*.
4. `src-tauri/capabilities/default.json`:
   * Mendefinisikan izin keamanan Tauri v2 untuk window `main` dan `toast`.
5. `src-tauri/tauri.conf.json`:
   * Konfigurasi metadata bundle, identitas app (`id.my.vianto06.walite`), CSP, dan konfigurasi window.

---

### 📁 `src-linux/` (Linux Client Standalone)
> [!WARNING]
> **ATURAN MUTLAK**: Jangan memodifikasi folder `src-linux/` saat Anda sedang mengerjakan tugas perbaikan platform Windows!

1. `src-linux/walite.py`:
   * Aplikasi mandiri Linux berbasis **Python 3 + PyQt6 + QtWebEngine**.
   * Terhubung langsung ke daemon D-Bus Linux (`org.freedesktop.Notifications`) untuk menghasilkan notifikasi native desktop environment (KDE Plasma, GNOME, XFCE).
   * Mendukung D-Bus action `inline-reply` untuk balas cepat langsung dari notification center sistem operasi Linux.
2. `src-linux/id.my.vianto06.walite.desktop`:
   * Desktop entry specification XDG untuk integrasi menu aplikasi dan icon taskbar Linux.

---

### 📁 `scripts/` (Build Utilities)
1. `scripts/generate-icons.js`:
   * Generator ikon multi-ukuran dari master SVG untuk icon Windows (`.ico`), icon Linux (`.png`), dan icon macOS (`.icns`).
2. `scripts/optimize-panel.js`:
   * Skrip pemadat (*minifier*) dan pengoptimal CSS rules untuk engine privasi.

---

## ⚙️ 3. Mekanisme Kunci & Arsitektur Alur Kerja

### A. Alur Kerja Notifikasi & Balas Cepat (Quick Reply)
1. Pesan masuk diterima oleh WhatsApp Web di WebView2.
2. `wa-download-manager.js` menangkap notifikasi dan mengarahkan ke `walite-action://notify`.
3. `main.rs` menerima action, memposisikan jendela `toast`, mengisi data via `eval`, dan menampilkannya dengan flag `SW_SHOWNOACTIVATE`.
4. Jika user membalas di toast: `walite-action://send-reply` dikirim ke Rust, lalu Rust memanggil `__walite_send_reply` di jendela utama.
5. Jika user mengklik bodi toast: `walite-action://open-chat` dikirim ke Rust, lalu Rust memfokuskan jendela utama dan memanggil `__walite_open_chat`.

### B. Alur Kerja Selektor Blur Avatar & Hover Unblur
Pada `src-tauri/wa-privacy-panel.js`:
* **Elemen Avatar yang Dicakup**:
  * Gambar profil kontak & grup (`img:not(.emoji, [data-plain-text], [alt*="emoji"])`).
  * Ikon default SVG grup dan komunitas (`svg`, `[data-icon*="group"]`, `[data-icon*="community"]`, dll.).
  * Wadah ikon avatar (`[data-testid*="avatar"]`, `[data-testid="cell-frame-icon"]`, `div[style*="border-radius"]`).
* **Proteksi Pengecualian**:
  * Nama kontak/grup (`:not([data-testid="cell-frame-title"] *):not(span[title] *)`).
  * Cuplikan pesan terakhir (`:not([data-testid*="last-msg"] *)`).
  * Ikon status baca, pin, dan mute (`:not([data-icon*="check"] *):not([data-icon*="pinned"] *):not([data-icon*="muted"] *)`).
* **Hover State**:
  * Menggunakan `#pane-side :is(div[role="row"], [role="listitem"]):hover` yang menerapkan `filter: none !important;` secara eksklusif hanya pada baris yang disentuh kursor mouse.

---

## 🛠️ 4. Panduan Kompilasi & Pengujian

### Prasyarat di Lingkungan Windows:
* Node.js (v20+ / v22 LTS)
* Rust & Cargo (`stable-x86_64-pc-windows-msvc`)
* Visual Studio Build Tools (C++ Desktop Development)
* WebView2 Runtime (bawaan Windows)

### Perintah Build & Run:
```powershell
# Berpindah ke folder repo
cd d:\Project\apps\walite

# Hentikan proses walite yang sedang berjalan
Stop-Process -Name "*walite*" -Force -ErrorAction SilentlyContinue

# Kompilasi binary release Windows
cd src-tauri
cargo build --release

# Salin ke lokasi eksekusi aplikasi lokal
Copy-Item "target\release\walite.exe" "C:\Users\Vianto\AppData\Local\Walite\walite.exe" -Force

# Membuat installer paket NSIS
cd ..
npx tauri build --bundles nsis

# Jalankan aplikasi untuk pengujian
Start-Process "C:\Users\Vianto\AppData\Local\Walite\walite.exe"
```

---

## ⚠️ 5. Aturan Mutlak Pengembangan (Harap Dipatuhi OpenCode)

1. **JANGAN COMMIT ATAU PUSH KE GIT**:
   * Dilarang melakukan `git commit` atau `git push` ke GitHub secara otomatis kecuali pengguna memberikan instruksi eksplisit ("silakan commit", "push perubahan ini").
2. **JANGAN SENTUH PLATFORM LAIN SECARA TIDAK PERLU**:
   * Folder `src-linux/` adalah implementasi khusus Linux. Jangan memodifikasi file di dalam folder tersebut saat melakukan perbaikan atau fitur pada Windows client.
3. **PRESERVASI DEFINISI LIGHTWEIGHT**:
   * Jangan menyarankan browser eksternal penuh (seperti menjalankan Chrome headless / Puppeteer) yang menambah beban memori. WaLite mengandalkan Edge WebView2 bawaan OS agar konsumsi memori tetap minimal (~7-15 MB).
4. **INTEGRITAS FILE KEAMANAN & PRIVASI**:
   * Berkas `src-tauri/wa-privacy-panel.js` dan `src-tauri/wa-download-manager.js` diinjeksi saat halaman web dimuat. Pastikan sintaks JavaScript kompatibel tanpa error runtime yang dapat memutus skrip WhatsApp Web.

