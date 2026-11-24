# WaLite Build Plan: Rencana Perbaikan Arsitektur & Paritas Fitur

Dokumen rencana kerja ini disusun berdasarkan temuan investigasi empiris pada `rea-results/CLONE_SPEC.md` untuk memperbaiki aplikasi WaLite (Tauri v2 + WebView2, target `https://web.whatsapp.com`, identifier `id.my.vianto06.walite`) menjadi wrapper WhatsApp Desktop yang ultra-stabil, ringan di perangkat low-end, bebas logout mandiri, serta memiliki paritas cangkang desktop yang lengkap.

---

## 1. Strategi Perbaikan & Urutan Fase

Strategi teknis: Melakukan perbaikan terarah (*in-place surgical refactor*) pada repositori yang ada tanpa melakukan *rewrite* total.
- **Backend Rust (`src-tauri/src/main.rs`):** Refactor stabilisasi UDF WebView2, migrasi path profil, penghapusan fallback temp, pemulihan user agent dinamis, penutupan bersih (*graceful exit*), manajemen window multi-monitor, dan registrasi jendela popup panggilan masuk.
- **Dispatcher Notifikasi & Panggilan (`src-tauri/wa-download-manager.js`):** Refactor detektor panggilan masuk agar hanya mengandalkan tag Notification API dan mutasi title/favicon (dilarang membaca isi pesan teks), serta eliminasi penulisan log berlebih.
- **Engine Privasi Visual (`src-tauri/wa-privacy-panel.js`):** Ganti selector dinamis yang rapuh (`_ak8q`, `_ak8j`, `_ak8h`, `_ak8k`) dengan selector berbasis atribut semantik dan `data-testid` stabil berjenjang fallback.
- **Ekstensi Fitur Tambahan (`src-tauri/wa-zapzap-features.js`):** Peringan injeksi PDF.js, pertahankan kontrol zoom, navigasi chat nomor baru, dan keyboard shortcuts.
- **Antarmuka Popup Panggilan (`src/call_popup.html`):** Buat antarmuka jendela melayang *always-on-top* compact khusus penanganan panggilan masuk.

### Urutan Pelaksanaan Fase:
- **Fase 1: Stabilitas Sesi & Efisiensi Performa** (Prioritas mutlak: eliminasi logout sendiri, migrasi folder profil, pencegahan crash).
- **Fase 2: Cangkang Aplikasi Desktop** (Window management, tray bersih, single instance ketat, auto-start, badge taskbar, flash window).
- **Fase 3: Notifikasi Native & Jendela Panggilan Masuk** (WinRT toast, balas cepat, popup panggilan always-on-top, izin mic/kamera permanen).
- **Fase 4: Keselarasan Tampilan & Penyelesaian Matriks Paritas** (Penyamaan warna, tipografi, radius, zoom persisten, deep link, jump list).
- **Fase 5: Engine Privasi Visual DOM-Resilient & Pengaman Layar** (Blur tahan update WA, hover-reveal, proteksi compose box, hardened lock screen).
- **Fase 6: Polish Akhir & Distribusi** (Offline screen graceful, ikon monogram WL, pembersihan berkas usang, README, lisensi, CI GitHub).

---

## 2. Perbaikan Sesi (Stabilitas Tanpa Logout Mandiri)

Langkah konkret penanganan sesi berdasarkan temuan CLONE_SPEC bagian 4 (satu baris per item):
- **Verifikasi & Migrasi Satu Kali Jalur UDF:** Periksa apakah folder aktif berada di `%LOCALAPPDATA%\id.my.vianto06.walite\EBWebView\EBWebView`; jika ya, buat mekanisme migrasi aman satu kali ke jalur standar `%LOCALAPPDATA%\id.my.vianto06.walite\data` dan jangan menghapus direktori lama sebelum sesi terbukti masih login tanpa scan ulang QR.
- **Eliminasi Fallback Folder Temp:** Hapus pemanggilan `std::env::temp_dir()` pada `get_persistent_data_dir()`; jika `%LOCALAPPDATA%` gagal dibaca, tampilkan pesan error native dan batalkan inisialisasi agar data sesi tidak dialihkan ke folder temp yang rentan dihapus sistem.
- **Koreksi Jalur Preferensi PDF:** Arahkan pembaruan berkas `Preferences` pada `ensure_webview_pdf_preferences()` langsung ke folder profil yang benar-benar aktif (`.../Default/Preferences`).
- **Gunakan User Agent Bawaan WebView2:** Hapus string User-Agent statis `Chrome/133.0.0.0` di `main.rs` dan biarkan WebView2 menggunakan User Agent Chromium bawaannya agar versi engine dan Client Hints (`Sec-CH-UA`) selalu sinkron dengan runtime Windows.
- **Penutupan Bersih (Clean Graceful Exit):** Ganti `app.exit(0)` di menu tray dengan alur: sembunyikan window, tutup webview controller, beri jeda waktu untuk flush buffer SQLite/LevelDB (`session.db-wal`), lalu panggil penghentian proses secara teratur.
- **Pencegahan Korupsi Double Instance:** Perketat deteksi single instance sebelum instansiasi WebView2 agar tidak terjadi dua proses bersamaan yang mengunci LevelDB `LOCK`.
- **Larangan Penghapusan Storage:** Pertahankan larangan mutlak terhadap pemanggilan API penghapusan cookie, pembersihan riwayat, atau manipulasi file session oleh aplikasi.

---

## 3. Optimalisasi Performa (Low-End Device & Jaringan Lambat)

Langkah optimalisasi diterapkan secara bertahap dan diuji stabilitasnya satu per satu (satu baris per item):
- **Eliminasi DevTools di Build Rilis:** Hapus baris `window.open_devtools();` di mode produksi dan batasi hanya pada kondisi `#[cfg(debug_assertions)]` (menghemat 1 proses renderer ~62 MB RAM).
- **Pengujian Bertahap Flag Network Service:** Uji penerapan `--enable-features=NetworkServiceInProcess` untuk menggabungkan network service ke proses browser utama (menghemat ~33 MB RAM).
- **Pembatasan Proses Renderer:** Uji dan terapkan `--renderer-process-limit=1` guna membatasi subproses renderer agar tidak bertambah saat membuka dialog atau tab bantuan.
- **Pembatasan Ukuran Cache Disk:** Terapkan flag `--disk-cache-size=125829120` untuk membatasi cache disk maksimum 120 MB agar tidak menimbun media lama di penyimpanan lambat.
- **Pengujian Batas Heap V8 yang Hati-hati:** Uji flag `--js-flags="--max-old-space-size=512"` secara terpisah di lingkungan dev; jangan terapkan di rilis sebelum terbukti stabil tanpa crash pada chat besar, karena crash V8 dapat memicu reset sesi/logout.
- **Optimasi Injeksi Skrip DOM:** Pindahkan skrip besar (PDF worker) ke pemuatan dinamis on-demand agar tidak membebani kompilasi awal JavaScript saat aplikasi dibuka.
- **Pertahankan Throttling Background Ramah Jaringan:** Pertahankan flag `--disable-background-timer-throttling` dan `--disable-renderer-backgrounding` agar sinkronisasi pesan di latar belakang tidak tertunda pada jaringan lambat.

---

## 4. Cangkang Aplikasi & UI (Komponen yang Diubah/Ditambah)

Satu baris per item rencana peningkatan cangkang dan antarmuka desktop:
- **Title Bar & Kontrol Window:** Pertahankan title bar standar Windows 11 dengan kontrol Minimize, Maximize, dan Close yang mendukung snap layout native.
- **Dimensi Minimum:** Pertahankan batas ukuran minimum `min_inner_size(680.0, 500.0)` agar tata letak webview tidak terpotong atau rusak.
- **Persistensi Geometri Window:** Simpan posisi (X, Y) dan ukuran (W, H) terakhir ke file konfigurasi lokal saat window ditutup, lalu pulihkan saat startup.
- **System Tray Monogram WL:** Pasang ikon tray monogram "WL" dengan menu konteks rapi (Buka, Obrolan Baru, Pengaturan, Keluar Bersih) dan klik kiri untuk restore.
- **Badge & Flash Taskbar:** Perbarui overlay icon angka (32x32 green badge) dan picu `FlashWindowEx` pada taskbar saat ada pesan/panggilan masuk di latar belakang.
- **Mode Layar Penuh (F11) & Zoom:** Sediakan tombol pintas F11 untuk fullscreen serta persistensi skala tampilan `body.style.zoom` (Ctrl +, Ctrl -, Ctrl 0).
- **Asosiasi Protokol Deep Link:** Daftarkan protokol `whatsapp:` pada Registry Windows HKCU agar tautan `wa.me` dan `whatsapp://send` langsung membuka obrolan di WaLite.
- **Taskbar Jump List:** Daftarkan pintasan tugas cepat pada ikon taskbar (Buka WaLite, Obrolan Baru, Pengaturan) via Windows Shell API.
- **Layar Offline Bersahabat:** Buat halaman lokal `src/offline.html` bertema gelap yang otomatis ditampilkan saat koneksi internet terputus, dilengkapi tombol coba lagi otomatis.

---

## 5. Panel Privasi Visual & Lock Screen (DOM-Resilient Engine)

Satu baris per perilaku dan mekanisme ketahanan:
- **Perilaku yang Dipertahankan:** Master switch (Alt+Z), blur per elemen (nama, avatar, cuplikan pesan, gelembung chat, media, input teks), hover-to-reveal halus (.15s), lock screen (Alt+X), auto-lock N menit saat idle, kata sandi PBKDF2 SHA-256, dan penyimpanan preferensi di localStorage `wl:v1`.
- **Selector Stabil Berbasis Data-Testid:** Ganti seluruh selector class obfuscated (`_ak8q`, `_ak8j`, `_ak8h`, `_ak8k`) dengan kombinasi atribut stabil WhatsApp: `[data-testid="cell-frame-title"]`, `[data-testid="cell-frame-icon"]`, `[data-testid*="last-msg"]`, dan `div[role="row"]`.
- **Mekanisme Fallback Berjenjang:** Jika atribut `data-testid` tidak ditemukan akibat perubahan rilis web, engine otomatis menggunakan fallback hierarki semantik (`#pane-side div[role="row"] span[dir="auto"]`, `div[role="row"] img`) sebelum kelas CSS.
- **Proteksi Universal Compose Box:** Isolasi compose box footer dengan aturan CSS `:not(#main footer *)` dan reset filter eksplisit agar teks yang diketik pengguna tidak pernah ter-blur secara tidak sengaja.
- **Privasi Penuh Tanpa Membaca Chat:** Pengaburan visual diterapkan 100% menggunakan CSS filter (`filter: blur(...) !important`); dilarang keras membaca, memproses, mencatat, atau mengirim isi teks obrolan.
- **Pengamanan Layar Kunci (Hardened Lock Overlay):** Pasang MutationObserver pada `document.body` yang mendeteksi penghapusan paksa elemen overlay; jika status `isLocked` masih aktif, overlay otomatis dibuat kembali dalam 10 milidetik.

---

## 6. Rencana Paritas Fitur Lengkap (Checklist Matriks Paritas Per Fase)

Seluruh 42 baris matriks paritas dari CLONE_SPEC bagian 2 dialokasikan ke dalam checklist fase kerja. Tiap fitur berstatus MATCHED/EMULATED memiliki satu baris rencana implementasi (API Tauri/Plugin/JS yang dipakai).

### Fase 1: Stabilitas Sesi & Efisiensi Performa
- [x] **Pemilihan Folder Simpan Unduhan (Save As)** | `WebviewWindowBuilder::on_download` event `DownloadEvent::Requested` memanggil native Win32 `GetSaveFileNameW`.
- [x] **Penanganan Tautan Eksternal** | Handler `on_navigation` & `on_new_window` memblokir URL non-WhatsApp dan membukanya via `rundll32 url.dll,FileProtocolHandler`.
- [x] **Indikator Jaringan Terputus** | Ditangani secara native oleh WebSocket connection lifecycle bawaan WhatsApp Web di WebView2.
- [x] **Reconnect Otomatis** | Ditangani secara native oleh Chromium network auto-reconnect di WebView2 saat koneksi internet pulih.
- [x] **Kinerja Jaringan Lambat** | Mengandalkan ServiceWorker CacheStorage dan flag background rendering WebView2 yang dioptimalkan.

### Fase 2: Cangkang Aplikasi Desktop
- [x] **Title Bar & Kontrol Window** | Konfigurasi standard Tauri window builder dengan tombol Minimize, Maximize, Close bawaan OS serta DWM Immersive Dark Mode.
- [x] **Ukuran Minimum Jendela** | Ditetapkan via `WebviewWindowBuilder::min_inner_size(680.0, 500.0)` pada inisialisasi window utama.
- [x] **Persistensi Geometri Window** | Simpan posisi (X, Y) dan ukuran (W, H) ke `window_state.json` lokal saat window berpindah/resize, dipulihkan saat app dibuka.
- [x] **Mode Layar Penuh (F11)** | Event keydown F11 memicu method `window.set_fullscreen(!is_fullscreen)` Tauri native.
- [x] **Zoom In / Out / Reset** | Keydown handler Ctrl +, Ctrl -, Ctrl 0 memanipulasi CSS `document.body.style.zoom` dan disimpan di localStorage.
- [x] **Pengaturan Tema (Light/Dark)** | Sinkronisasi atribut class `dark` pada root DOM dengan tema Windows 11 dan preferensi pengguna via DWM API.
- [x] **Minimize / Close ke Tray** | `WindowEvent::CloseRequested` memanggil `api.prevent_close()` & `window.hide()`, menyembunyikan app ke tray.
- [x] **Start Saat Login Windows** | Dibuat opsional dan MATI secara default; hanya ditulis jika pengguna mengaktifkannya di pengaturan.
- [x] **Penegakan Single Instance** | Plugin `tauri-plugin-single-instance` memfokuskan jendela utama via Win32 `ShowWindow`, `BringWindowToTop`, `SetForegroundWindow`.
- [x] **Klik Ikon System Tray** | `TrayIconEvent::Click` (MouseButton::Left) memulihkan dan memfokuskan jendela utama WaLite.
- [x] **Taskbar Jump List** | Pendaftaran tugas Start Menu / Taskbar Search "Obrolan Baru (Ctrl+M)" dan "Pengaturan (Ctrl+P)".
- [x] **Asosiasi Protokol Deep Link** | Default TIDAK didaftarkan agar tidak menimpa WhatsApp Desktop resmi pada sistem; handler override lama dibersihkan.
- [x] **Unread Badge Taskbar** | Method `window.set_overlay_icon(...)` memperbarui icon badge 32x32 berangka di atas ikon taskbar Windows.
- [x] **Flash Taskbar (Oranye)** | Memanggil Win32 API `FlashWindowEx` melalui handle HWND window utama saat notifikasi/badge tiba di latar belakang.
- [x] **Badge Ikon System Tray** | Tray icon menu lengkap (Buka, Obrolan Baru, Pengaturan, Inspect, Test Notif, Keluar) dengan clean exit.

### Fase 3: Notifikasi Native & Jendela Panggilan Masuk
- [x] **Tampilan Toast Windows** | WinRT Toast Notification native via crate `winrt-toast-reborn` dengan AUMID `id.my.vianto06.walite` (Teruji).
- [x] **Pratinjau Pengirim & Teks** | Ekstraksi nama pengirim dan cuplikan teks dari Notification API diteruskan lokal ke payload WinRT XML Toast (Teruji).
- [x] **Balas Cepat (Inline Quick Reply)** | Elemen WinRT Toast `<input id="replyBox" type="text" />` mati secara default; fallback otomatis buka obrolan (Teruji).
- [x] **Klik Buka Obrolan Tepat** | Klik tubuh notifikasi memulihkan window dan mengeksekusi helper DOM `__walite_open_chat(cleanTitle, cleanTag)` (Teruji).
- [x] **Foto Profil / Avatar di Toast** | Avatar kontak disimpan ke direktori temporary lokal dan disematkan ke berkas XML Toast via jalur `file:///` (Teruji).
- [x] **Pengaturan Suara & Pratinjau** | Redaksi teks nama/preview dan pembungkaman suara dikelola via preferensi lokal sebelum toast dikirim (Teruji).
- [x] **Dukungan Focus Assist / DND** | Dikelola secara otomatis dan native oleh Windows Action Center Notification Manager (Teruji).
- [x] **Supresi Notifikasi Chat Aktif** | Pengecekan kesamaan nama pengirim dengan judul chat di `#main header`; batalkan toast jika chat sedang aktif di layar (Teruji).
- [x] **Notifikasi Unduhan Selesai** | WinRT Toast dengan tombol aksi "Buka Berkas" (`ShellExecuteW open`) dan "Buka Folder" (`explorer.exe /select`) (Teruji).
- [x] **Popup Panggilan Masuk (Always-on-Top)** | Jendela sekunder Tauri `call_popup` berukuran 340x160 px, frameless, melayang always-on-top di pojok kanan bawah (Teruji).
- [x] **Tombol Aksi Panggilan Masuk** | Tombol "Terima" dan "Tolak" pada popup meneruskan IPC ke `__walite_accept_call()` / `__walite_decline_call()` dengan fallback fokus window (Teruji).
- [x] **Suara Dering Panggilan Masuk** | Dijalankan native oleh Web Audio API WhatsApp Web di dalam WebView2; nol duplikasi dering (Teruji).
- [ ] **Panggilan Saat App di Tray/Minimize** | Deteksi sinyal panggilan (tag notifikasi & perubahan title/favicon) otomatis memicu `call_popup.show()` (Perlu uji manual oleh pengguna dengan akun kedua).
- [ ] **Panggilan Suara vs Video** | Penanganan izin `PermissionKind::Microphone` dan `Camera` diizinkan permanen di `on_permission_request` (Perlu uji manual oleh pengguna dengan akun kedua).
- [ ] **Panggilan Grup** | Didukung penuh di dalam WebView2 dengan flag ABProp `enable_web_group_calling: true` (Perlu uji manual oleh pengguna dengan akun kedua).
- [ ] **Jendela Panggilan Aktif (PiP)** | Transisi otomatis ke window compact always-on-top saat window utama diminimize saat panggilan berlangsung (Perlu uji manual oleh pengguna dengan akun kedua).
- [ ] **Berbagi Layar (Screen Sharing)** | Izin capture layar desktop/jendela diberikan otomatis via Chromium display media API di WebView2 (Perlu uji manual oleh pengguna dengan akun kedua).
- [ ] **Panggilan Tak Terjawab (Missed Call)** | Toast notifikasi skenario `missed-call` di Windows Action Center dengan tombol panggil balik (Perlu uji manual oleh pengguna dengan akun kedua).
- [x] **Izin Perangkat Mikrofon & Kamera** | Handler `on_permission_request` Tauri merespons `PermissionResponse::Allow` dan diingat di profil WebView2 (Teruji).
- [x] **Pemilihan Perangkat Audio** | Dikelola native oleh Chromium MediaDevices API di menu pengaturan panggilan bawaan WhatsApp Web (Teruji).

### Fase 4: Antarmuka UI/UX & Input/Output
- [ ] **Pintasan Keyboard Chat** | Penanganan event keyboard native diteruskan langsung ke WebView2 (Ctrl+Alt+N, Ctrl+Alt+/, dll.).
- [ ] **Drag-and-Drop Berkas** | Penonaktifan Tauri drop handler (`drag_and_drop(false)`) dan bypass UIPI via `ChangeWindowMessageFilterEx`.
- [ ] **Tempel Media dari Clipboard** | Mendukung pembacaan gambar dan berkas dari clipboard Windows via Chromium Clipboard API.
- [ ] **Pratinjau Dokumen PDF In-App** | Modal viewer terintegrasi di DOM menggunakan engine Mozilla PDF.js canvas renderer dengan kontrol zoom & unduh.
- [ ] **Pemeriksa Ejaan (Spellcheck)** | Dikelola native oleh Chromium multi-language spellchecking engine bawaan Edge WebView2.
- [ ] **Antarmuka Pengaturan Desktop** | Modal dialog pengaturan komprehensif ZapZap di `wa-zapzap-features.js` (Ctrl+P) bertema Fluent Dark.
- [ ] **Mekanisme Pembaruan Aplikasi** | Pengecekan versi rilis berkala secara pasif melalui GitHub Releases API di background.

### Fase 5: Panel Privasi & Pengaman Layar
- [ ] **Pintasan Keyboard Global** | Listener global untuk Alt+Z (privasi), Alt+X (kunci layar), Alt+H (toggle shield), dan Ctrl+M (chat nomor baru).
- [ ] **Engine Privasi Visual DOM-Resilient** | Injeksi aturan CSS blur menggunakan selector berbasis atribut `data-testid` dan fallback hierarki.
- [ ] **Pengaman Layar Sandi (Lock Screen)** | Kartu modal PBKDF2 SHA-256 dengan proteksi anti-hapus DOM MutationObserver.

---

### Fitur Berstatus IMPOSSIBLE (Beserta Alasan & Alternatif Terdekat)

- **Fitur:** *Tombol Tandai Dibaca Langsung dari Notifikasi (Mark as Read action button)*
  - **Alasan:** WhatsApp Web tidak menyediakan API publik atau endpoint terbuka untuk mengubah status baca pesan secara headless tanpa memuat dan merender elemen DOM obrolan bersangkutan di antarmuka aktif. Memanipulasi protokol WebSocket secara langsung melanggar batasan wrapper murni dan berisiko tinggi memicu pemblokiran akun oleh Meta.
  - **Alternatif Terdekat:** Pengguna cukup mengklik tubuh kartu notifikasi; WaLite akan langsung memfokuskan jendela utama dan melompat ke obrolan bersangkutan secara instan via helper `__walite_open_chat`, yang secara otomatis menandai seluruh pesan pada obrolan tersebut telah dibaca oleh sistem resmi WhatsApp.

---

### Desain Jendela Popup Panggilan Masuk (Always-on-Top)

1. **Arsitektur Jendela:**
   - Dibuat jendela sekunder Tauri berlabel `"call_popup"` dengan file frontend `src/call_popup.html`.
   - Ukuran: 320x160 piksel, frameless, sudut melengkung 10px, latar belakang Fluent Dark (`rgba(32, 44, 51, 0.96)`), dan `always_on_top: true`.
   - Posisi: Dihitung dinamis pada sudut kanan bawah monitor aktif (tepat di atas taskbar Windows).
2. **Sinyal Pemicu Deteksi (Tanpa Membaca Isi Pesan):**
   - **Hanya membaca atribut sinyal sistem:**
     * Tag `Notification API` yang mengandung kata kunci panggilan (`call`, `voip`, `telepon`).
     * Mutasi `document.title` yang menampilkan teks panggilan masuk.
     * Perubahan atribut `href` pada elemen `<link rel="shortcut icon">` (favicon dering).
   - **Dilarang membaca isi pesan teks (`notification.body`)** demi menjamin privasi pengguna dan efisiensi pemrosesan.
3. **Interaksi & Aksi:**
   - Tombol "Jawab" (Hijau): Meneruskan IPC ke jendela utama untuk memanggil `window.__walite_accept_call()`.
   - Tombol "Tolak" (Merah): Meneruskan IPC ke jendela utama untuk memanggil `window.__walite_decline_call()`.
   - Panggilan itu sendiri tetap berjalan sepenuhnya di dalam WhatsApp Web di WebView2; popup hanya bertindak sebagai pengendali jarak jauh visual.

---

## 7. Yang Harus Saya Siapkan Sendiri (Prasyarat Lingkungan)

Daftar prasyarat berurutan dan singkat:
1. **Sistem Operasi Windows 10/11 (Wajib Windows):** Pembangunan biner dan pengujian WebView2, WinRT Toast, dan Windows API wajib dijalankan langsung di lingkungan Windows (bukan di dalam WSL).
2. **Node.js (v20 atau v22 LTS):** Terpasang di Windows beserta npm untuk mengelola dependensi build frontend.
3. **Rust Toolchain:** Terpasang via `rustup` dengan target `stable-x86_64-pc-windows-msvc`.
4. **C++ Build Tools:** Visual Studio Build Tools 2022 (komponen "Desktop development with C++" dan Windows SDK 10/11).
5. **Microsoft Edge WebView2 Runtime:** Sudah terpasang secara bawaan di Windows 10/11 (Evergreen).
6. **Dua Akun WhatsApp Milik Sendiri:** Akun utama untuk login di WaLite dan akun kedua pada ponsel fisik/nomor lain untuk menguji panggilan masuk, suara dering, dan balas cepat notifikasi.
7. **Repositori Git Bersih:** Pastikan working tree branch `main` berada dalam kondisi bersih (*clean*) sebelum memulai eksekusi Fase 1.

---

## 8. Keamanan, Risiko, dan Batasan

- **Prinsip Wrapper Murni:**
  - Dilarang keras membuat bot, scheduler pesan, scraping chat, atau otomatisasi interaksi pesan.
  - Dilarang menggunakan API tidak resmi atau memodifikasi/memotong paket data trafik jaringan WebSocket WhatsApp.
  - Dilarang menyalin aset berhak cipta Meta, logo resmi WhatsApp, atau merek dagang tanpa izin; gunakan ikon monogram independen "WL".
- **Privasi Data Lokal:**
  - Injeksi skrip hanya untuk styling pengaburan visual dan penerusan event lokal ke Windows Action Center / Popup.
  - Teks pesan dan nomor telepon tidak boleh disimpan permanen, dicatat dalam berkas log, atau dikirimkan ke server eksternal mana pun.
- **Batasan Realistis:**
  - Logout dari sisi server WhatsApp (misalnya ponsel utama offline 14 hari berturut-turut atau sesi dicabut manual dari ponsel) berada di luar kendali teknis aplikasi dan tidak dapat dicegah.
  - Risiko pemblokiran (*ban*) dari server WhatsApp tidak pernah bernilai nol pada aplikasi klien pihak ketiga mana pun; menjaga WaLite sebagai wrapper murni tanpa otomatisasi adalah posisi paling aman yang dapat dicapai.

---

## 9. Asumsi dari Item UNKNOWN CLONE_SPEC

- **Asumsi 1:** Kunci kriptografi Signal Protocol dan sesi multi-device di dalam basis data IndexedDB LevelDB akan tetap valid selama direktori User Data Folder WebView2 tidak terhapus atau berganti path.
- **Asumsi 2:** Status fitur Web Calling pada akun pengguna akan tetap aktif pada rilis-rilis WhatsApp Web berikutnya seiring status rollout A/B testing Meta yang telah terverifikasi bernilai `true`.
- **Asumsi 3:** Format payload WinRT XML Notification pada Windows 11 tetap stabil dan kompatibel ke belakang untuk skenario panggilan masuk (`Scenario::IncomingCall`) dan input teks balasan cepat.

---
*Rencana perbaikan ini selesai disusun sebagai luaran resmi PROMPT 2: Rencana. Siap untuk dievaluasi pengguna sebelum eksekusi Fase 1.*
