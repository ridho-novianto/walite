# Changelog

All notable changes to WaLite will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-11-15

> **Release Channel:** Stable (General Availability) / LTS Baseline  
> **Target Platform:** Windows 10/11 (64-bit) & Linux (x86_64 AppImage & Tarball)  
> **Status:** Production Ready  

WaLite v0.2.0 merupakan rilis besar (*major stable update*) yang menghadirkan pemisahan arsitektur mesin secara optimal untuk Windows dan Linux, dukungan penuh notifikasi interaktif **Balas Cepat (Quick Reply)** di kedua sistem operasi, penyelesaian tuntas isu multimedia di Linux, serta perbaikan menyeluruh pada engine privasi blur.

---

### 🌟 Ringkasan Utama (Highlights)

* **Versi Stabil (General Availability / LTS Baseline):**
  * Bukan lagi berstatus *preview/beta*. Seluruh komponen inti telah diuji stabilitasnya untuk penggunaan harian intensif.
  * **Windows**: Berjalan di atas **Tauri v2 + Rust + WebView2** dengan jejak biner ultra-ringan (~3 MB), memori Private Working Set hemat (~6.7 MB), dan engine rendering Edge Chromium.
  * **Linux**: Ditenagai oleh **PyQt6 + QtWebEngine (Chromium 140)** dengan akselerasi GPU (VA-API/Vulkan), menyelesaikan seluruh masalah video freeze dan audio deadlock warisan WebKitGTK.

* **Notifikasi Interaktif & Balas Cepat (Quick Reply) di Windows & Linux:**
  * **Windows (Tauri v2)**: Menghadirkan *floating toast notification card* modern berdesain Fluent Dark (`src/toast.html`) di pojok kanan bawah layar. Dilengkapi foto profil kontak (lingkaran), nama pengirim, preview pesan, dan kolom **Balas Cepat** inline (`<input>` + Enter/Kirim). Pengguna dapat membalas pesan instan tanpa perlu membuka jendela utama WaLite, atau mengklik kartu notifikasi untuk langsung fokus dan melompat ke chat room pengirim. Tampil menggunakan `SW_SHOWNOACTIVATE` sehingga tidak mencuri fokus ketikan aktif di aplikasi lain.
  * **Linux (PyQt6)**: Integrasi penuh notifikasi FreeDesktop / KDE Plasma via D-Bus (`org.freedesktop.Notifications`). Mendukung inline quick-reply (`NotificationReplied` D-Bus signal), avatar kontak melingkar via hint `image-path`, serta navigasi klik langsung ke obrolan dengan aktivasi Wayland `XDG_ACTIVATION_TOKEN`.

* **Perbaikan Total Engine Privacy Blur (`wa-privacy-panel.js`):**
  * **Proteksi Kotak Ketik Pesan**: Memperbaiki bug di mana kotak input ketik pesan di `#main footer` ikut ter-blur saat opsi *"Semua Pesan Chat"* diaktifkan. Sekarang teks yang sedang diketik tetap 100% terbaca jelas tanpa terpengaruh filter blur.
  * **Unblur Stiker saat Hover**: Memperbaiki bug stiker yang blurnya tidak mau hilang saat kursor diarahkan (*hover*). Selector `:has(:hover)` dan `:hover *` universal kini memastikan stiker dan media langsung terbuka seketika saat di-hover.

---

### ✨ Fitur Baru (New Features & Improvements)

#### 1. Linux Client (`src-linux/walite.py`)
* **Arsitektur Baru QtWebEngine (Chromium)**:
  * Eliminasi 100% galat `atom has bogus size`, video status macet, dan audio deadlock yang sebelumnya terjadi pada WebKitGTK / GStreamer.
  * Dukungan native hardware-accelerated video decoding (H.264/AVC1, VP8, VP9) dan AAC/Opus audio.
  * Dukungan penuh panggilan suara dan video WhatsApp Web (WebRTC), izin hardware mikrofon & kamera secara granular, dan drag-and-drop media sharing.
* **Manajemen Sumber Daya & Performa**:
  * Batas V8 heap memori 512 MB (`--js-flags=--max_old_space_size=512`) dan limit maksimal 2 proses renderer untuk mencegah kebocoran memori.
  * Pembatasan ukuran cache disk HTTP hingga 120 MB.
  * Pengingat ukuran dan posisi jendela (*geometry persistence*) serta zoom level per sesi.
  * Pintasan zoom halus: `Ctrl + Mouse Wheel`, `Ctrl + Plus`, `Ctrl + Minus`, dan `Ctrl + 0` (Reset).
  * Penegakan single-instance via socket lokal `QLocalServer`.

#### 2. Windows Client (`src-tauri`)
* **Floating Toast Quick-Reply Engine (`src/toast.html`)**:
  * Jendela sekunder frameless, transparan, dan *always-on-top* di sudut kanan bawah desktop.
  * Auto-dismiss cerdas: Menutup otomatis setelah 8 detik jika diabaikan; timer otomatis ditunda saat kursor berada di atas kartu atau saat pengguna sedang mengetik balasan.
  * Protokol komunikasi internal `walite-action://` yang aman dan kebal terhadap CSP web.
* **Integrasi Unduhan & Autoplay**:
  * Handler unduhan file otomatis mengarahkan ke folder `Downloads` pengguna dengan penamaan unik anti-overwrite.

#### 3. Otomasi Rilis & Distribusi CI/CD (`.github/workflows/release.yml`)
* Pipeline otomatis rilis dual-platform di GitHub Actions:
  * **Windows**: Di-compile pada runner `windows-latest` menggunakan Rust toolchain stable dan Tauri CLI v2, menghasilkan paket instalasi NSIS (`.exe`) dan Windows Installer (`.msi`).
  * **Linux**: Di-package pada runner `ubuntu-22.04` menggunakan PyInstaller dan `appimagetool`, menghasilkan portable standalone binary `WaLite_<version>_amd64.AppImage` dan arsip `.tar.gz`.

---

### 🐛 Perbaikan Bug (Bug Fixes)

* **Windows & Linux**:
  * Memperbaiki konflik selektor CSS pada opsi *"Semua Pesan Chat"* yang secara tidak sengaja menargetkan `.selectable-text` di area compose box. Selektor kini di-scope ketat ke `div[role="row"]` di dalam obrolan saja.
  * Menambahkan rule fallback anti-blur: `html.wl-overall-active:not(.wl-blur-input) #main footer, html.wl-overall-active:not(.wl-blur-input) #main footer * { filter: none !important; }`.
  * Memperbaiki hover unblur pada elemen stiker WhatsApp (`[data-testid*="sticker"]`) yang sebelumnya tidak merespons pseudo-class `:hover` induk.
* **Linux (v0.1.x Legacy Fixes Promoted to Stable)**:
  * Mengatasi D-Bus notification timeout lockups (penolakan base64 data URI oleh daemon FreeDesktop).
  * Menghilangkan white flash saat startup dengan mengaplikasikan warna tema dark WhatsApp `#111b21` sejak frame pertama render engine.

---

### 📂 Berkas & Komponen yang Diperbarui (Changelog Berkas)

* `src-linux/walite.py`: Client Linux mandiri berbasis PyQt6 + QtWebEngine dengan D-Bus quick-reply notification manager dan window persistence.
* `src-linux/id.my.vianto06.walite.desktop` & `src-linux/run.sh`: Desktop entry dan starter script untuk integrasi desktop Linux.
* `src/toast.html`: Tampilan antarmuka kartu notifikasi mengambang Windows (Fluent dark theme, avatar kontak, quick reply).
* `src-tauri/src/main.rs`: Handler jendela toast notifikasi, IPC bridge `walite-action://`, penyesuaian posisi multi-monitor, dan DPI scaling.
* `src-tauri/wa-download-manager.js`: Intersepsi `window.Notification` untuk Windows Quick-Reply, helper DOM `__walite_open_chat`, dan dispatcher `__walite_send_reply`.
* `src-tauri/wa-privacy-panel.js`: Patch selector CSS compose box dan universal hover unblur untuk stiker/media.
* `src-tauri/capabilities/default.json`: Penambahan hak akses window `"toast"` pada konfigurasi keamanan Tauri v2.
* `.github/workflows/release.yml`: Alur kerja otomatis build rilis multi-platform (Windows Tauri + Linux AppImage).
* `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`: Bump versi rilis ke `0.2.0`.

## [0.1.14] - 2026-11-13

### Fixed
- **Linux Video Playback & Status Viewing Freeze ("plai video freeze, statu")**:
  - Automatically configured `GST_VAAPI_ALL_DRIVERS_DISABLE=1` to prevent GStreamer hardware decoders (VA-API / NVDEC on NVIDIA) from deadlocking with WebKitGTK when DMA-BUF zero-copy buffer sharing is disabled.
  - Added `gstreamer1.0-plugins-ugly` to Debian package dependencies alongside `gst-plugins-bad` and `gst-libav` to guarantee full H.264/AVC1 video and AAC audio software decoding.
  - Injected an active HTML5 video enhancer that configures `playsinline` / `webkit-playsinline` on video elements in status and chats, and gracefully absorbs unhandled play promise rejections.
  - Optimized CSS blur filters on media in `wa-privacy-panel.js` with `will-change: filter` and GPU layer promotion (`transform: translateZ(0)`) to eliminate CPU frame readback stalls on playing videos.
- **Linux Chat Receiving Freezes ("nerima chat nge freeze")**:
  - Replaced the intensive synchronous full-DOM `TreeWalker` scan and unthrottled `MutationObserver` in `wa-download-manager.js` with an idle-debounced, scoped observer targeting only `#side` / `#app` outside `#main`. Incoming chat message bubbles no longer trigger heavy DOM tree iterations.
  - Fixed D-Bus notification timeout lockups on Linux: WebKitGTK's Web Notification bridge forwards icons to D-Bus (`org.freedesktop.Notifications`), which rejects base64 `data:` URIs and causes 25-second UI thread freezes. Inlined base64 icon data is now stripped on Linux while preserving full desktop notification title and message text.
  - Polyfilled `window.chrome` runtime APIs for WebKitGTK to ensure WhatsApp Web's Chrome-specific initialization paths execute flawlessly with Chrome on Linux User-Agent.
- **Cursor Performance Optimization**:
  - Replaced universal `* { cursor: auto; }` rule with scoped selectors (`body, #app, #main`) to eliminate continuous cursor style recomputations on hover.

## [0.1.13] - 2026-11-13

### Added
- **Cross-Platform Linux Native Support (Arch Linux, Debian, Ubuntu, Fedora, openSUSE)**:
  - **Universal AppImage & Debian Packaging**: Configured bundle targets for native Linux `.AppImage` (standalone portable binary for Arch, Fedora, openSUSE, Debian/Ubuntu) and `.deb` (Debian, Ubuntu, Linux Mint). Both packages consume native WebKitGTK without heavy containerization overhead (~12 MB installer, ~40-80 MB RAM).
  - **XDG Session Persistence**: Implemented `get_persistent_data_dir()` for Linux adhering to the XDG Base Directory specification (`$XDG_DATA_HOME/id.my.vianto06.walite` or `~/.local/share/id.my.vianto06.walite`), guaranteeing WhatsApp login sessions, IndexedDB, and cookies persist permanently across system reboots.
  - **Desktop External Browser Integration**: Implemented `xdg-open` handling for external hyperlinks on Linux.
  - **Automated Multi-OS Release Pipeline**: Configured GitHub Actions CI/CD matrix workflow (`.github/workflows/release.yml`) to automatically compile native Windows (`.exe`) and Linux (`.AppImage` + `.deb`) installers concurrently on tag push.

### Fixed
- **Linux Whitescreen on Reopen / Unminimize & Media Freezes**:
  - Automatically configured `WEBKIT_DISABLE_DMABUF_RENDERER=1` and `__NV_DISABLE_EXPLICIT_SYNC=1` at process launch, preventing WebKitGTK 2.40+ DMA-BUF buffer sharing deadlocks with GPU drivers on Wayland and X11 that previously caused whitescreens upon reopening after window close (`Win+Q`) and hard lockups during status video viewing, multimedia playback, and image thumbnail compression.
- **Missing Emojis on Linux**:
  - Set modern Chrome on Linux User-Agent on WebKitGTK so WhatsApp Web serves standard web emoji sprites instead of failing when looking for Apple Color Emoji fonts.
- **Linux Multimedia Codecs & Dependencies**:
  - Added GStreamer codec suite (`gstreamer1.0-plugins-good`, `gstreamer1.0-plugins-bad`, `gstreamer1.0-libav`) to Debian package dependencies for out-of-the-box video and audio decoding.
- **HTML5 Drag-and-Drop Event Propagation**:
  - Injected global `dragover` / `dragenter` default prevention to stop WebKitGTK from attempting to navigate away when dragging files from Linux file managers (Nautilus, Dolphin), enabling clean drop operations into WhatsApp chats.

### Changed
- **Official Branding Update ("Walite" -> "WaLite")**:
  - Rebranded the product name to **WaLite** (capital 'W' and capital 'L') across `tauri.conf.json`, window titles, system tray menus, installer manifests, and in-app privacy dialogs.

## [0.1.12] - 2026-11-13

### Fixed
- **Direct File, Image, and Document Drag & Drop ("gabisa drag file, gambar, dkk langsung")**:
  - Reconfigured `WebviewWindowBuilder::drag_and_drop(false)` in `src-tauri/src/main.rs`. In Tauri v2 on Windows, setting `drag_and_drop(true)` causes Tao to register an OLE drop target on the Win32 HWND that intercepts and swallows Explorer drag operations before they reach WebView2. Setting `drag_and_drop(false)` allows the embedded WebView2 Chromium controller to manage OLE drop operations natively, translating dropped files directly into standard HTML5 `DataTransfer.files` for WhatsApp Web so users can drag images, videos, and documents straight from Windows Explorer into chat conversations.
  - Added native Windows UIPI message filter bypass (`ChangeWindowMessageFilterEx`) for `WM_DROPFILES` (`0x0233`), `WM_COPYDATA` (`0x004A`), and `WM_COPYGLOBALDATA` (`0x0049`) to guarantee drop operations work under all privilege levels.
- **Taskbar Application Icon Resource Binding (`LoadIconW` ID `32512`)**:
  - Updated Win32 `LoadIconW` in `src-tauri/src/main.rs` to load resource ID `32512` (`IDI_APPLICATION`, generated by `winres`/`tauri-build`) with fallback to `1`, ensuring `WM_SETICON` (`ICON_BIG` & `ICON_SMALL`) successfully attaches the high-definition Walite icon to the window HWND for the Windows Taskbar and Alt-Tab switcher.
- **WhatsApp Desktop Upsell Banner Cleanup ("Dapatkan WhatsApp untuk Windows")**:
  - Broadened the upsell banner suppressor in `src-tauri/wa-download-manager.js` to inspect the entire application shell (excluding `#main` message bubbles and `[role="row"]` contact list rows), permanently removing all "Dapatkan WhatsApp untuk Windows" / "Get WhatsApp for Windows" upsell banners, buttons, and store download links.
- **Modern Windows 11 Fluent Download Modal**:
  - Enhanced the "Unduh Berkas" dialog with subtle acrylic frosted glass backdrop, crisp SVG action icons, gradient buttons, and responsive micro-interactions.

## [0.1.11] - 2026-11-13

### Fixed
- **Windows Taskbar Application Icon ("logo di taskbar hilang lagi")**:
  - **AppUserModelID Explicit Binding**: Registered the explicit application identity `id.my.vianto06.walite` via `SetCurrentProcessExplicitAppUserModelID` on application startup so the Windows 11 Taskbar correctly maps the running window to the Walite app instead of showing an unlinked, generic white placeholder icon.
  - **Win32 Shell Cache Invalidation**: Called `SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, NULL, NULL)` at process launch to force Windows Explorer and the Taskbar to flush stale icon caches and reload the application icon immediately.
  - **Native `WM_SETICON` HWND Dispatch**: Dispatched `WM_SETICON` (`ICON_BIG` & `ICON_SMALL`) with the PE module's embedded icon (`LoadIconW(h_instance, 1)`) directly to the window's HWND, and initialized window and tray icons with `Image::from_app_icon_resource(128)`.

## [0.1.10] - 2026-11-13

### Fixed
- **Per-Contact Scoped Hover Unblur in Chat List ("hanya kontak yang di-hover yang dibuka filternya")**:
  - Completely eradicated the `[tabindex="-1"]` selector and broad `:hover *` selectors from the hover unblur rules for contact names, profile pictures, and last messages.
  - WhatsApp Web uses `tabindex="-1"` on the entire virtual scroll list container (`#pane-side div[tabindex="-1"]`), which previously caused moving the cursor anywhere inside the left chat pane to match `:hover` and simultaneously unblur all contacts.
  - Hover unblur is now strictly scoped to individual rows (`#pane-side :is([role="row"],[data-testid*="cell-frame"]):hover`). Moving the mouse cursor over one contact opens the filter exclusively for that specific contact's avatar, name, and last message snippet, while all other contacts remain securely blurred.

## [0.1.9] - 2026-11-13

### Fixed
- **Persistent Mouse Cursor Visibility in Chat ("muse ga muncul di chat")**:
  - **Environment Level**: Set the `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` environment variable prior to WebView2 initialization with `--disable-features=HideCursorWhileTyping,msSmartScreenProtection`, preventing WebView2 from suppressing and failing to restore the mouse cursor when typing or switching focus in WhatsApp Web input fields.
  - **DOM & CSS Level**: Enforced explicit default arrow pointer (`cursor: default !important`) over `#main` message bubbles, background, and selectable text, preventing dark-theme invisible black I-beam text cursors and prohibiting any `cursor: none` state. Buttons, emojis, attachments, and audio controls explicitly display `cursor: pointer !important`, while the compose box displays `cursor: text !important`.

## [0.1.8] - 2026-11-13

### Fixed
- **Scoped Hover Unblur per Contact**: Fixed hover unblur accidentally unblurring all contacts simultaneously in the chat list. Removed overly broad container matching so hovering cursor now only unblurs that specific contact's row (profile picture, name, snippet) or the specific element hovered, keeping other contacts securely blurred.
- **QR Code Disappearing Bug**: Fixed QR code / login screen disappearing after loading. Scoped banner removal strictly to `#pane-side` so that landing page elements, login cards, and the QR code are never affected or hidden before login.

## [0.1.7] - 2026-11-13

### Fixed
- **External Link Redirect to Default Browser**: Fixed links in WhatsApp Web chats (e.g. YouTube, Google, web links) failing to redirect to the user's default browser (Brave, Chrome, Edge). Intercepted external link clicks in both DOM capture phase and Rust `on_navigation` / `on_new_window` handlers using an instantaneous native Win32 `rundll32 url.dll,FileProtocolHandler` call, ensuring external links open smoothly in the system default browser while keeping Walite on WhatsApp Web.
- **Sticker Infinite Loading & Download**: Fixed stickers continuously spinning and failing to download by removing restrictive Chromium flags (`--disable-background-networking` and `--renderer-process-limit=2`). WhatsApp Web Service Workers and WebAssembly Signal crypto workers now have full network and process capacity to download, decrypt, and render stickers and media seamlessly.

## [0.1.6] - 2026-11-13

### Fixed
- **Hover Unblur Reliability**: Fixed CSS specificity collisions that prevented blurred profile pictures, messages, contact names, and media previews from unblurring on cursor hover. Hovering over any element or its chat list row now instantly and smoothly unblurs the content (`transition: filter .15s ease-in-out`).
- **Profile Picture Blur on Contacts with Status**: Fixed contacts who posted a WhatsApp Status (story ring around avatar) failing to blur. Avatar selectors now target SVG `<image>`, status containers, and rings so all contact avatars remain consistently blurred unless hovered.
- **Permanent Removal of "Dapatkan WhatsApp untuk Windows" Banner**: Completely eliminated the persistent promotional desktop banner from the chat list using both targeted CSS selectors (`span[data-icon*="whatsapp"]`, upsell containers) and dynamic DOM TreeWalker observation.
- **Taskbar Icon Shell Refresh**: Added background Windows Shell notification (`ie4uinit.exe -show`) on application startup and clean-built PE resources to ensure the new circular "WL" logo displays accurately across the Windows taskbar and system tray.

### Changed
- **Fluent Download Experience (Anti-AI-Slop Redesign)**: Redesigned the "Unduh Berkas" dialog into a clean, modern Windows 11 Fluent aesthetic. Removed generic emojis, replacing them with crisp SVG vector icons (minimalist document badge with dynamic extension pill, download tray arrow, external link arrow), subtle frosted acrylic backdrop, and streamlined "Simpan Sebagai..." (native Windows File Picker) and "Buka Langsung" actions.

## [0.1.5] - 2026-11-13

### Added
- **Branded Toast Notifications**: Intercepted Web Notifications to set the official circular Walite logo as the notification icon/badge and branded notification titles with `WaLite • [Pengirim]` instead of generic `web.whatsapp.com`.
- **Hidden Promotional Banner**: Automatically hidden the annoying "Dapatkan WhatsApp untuk Windows" / "Get WhatsApp for Windows" desktop upsell banner across both CSS and continuous DOM cleaning.

### Fixed
- **Emoji Included in Text Filter**: Fixed emojis in chat messages to blur and unblur naturally alongside message text (`blurMessages`). Avatar blur (`blurAvatars`) no longer touches emojis, and emoji picker panel remains unblurred for convenient selection.
- **Fixed Sticker Infinite Loading**: Resolved the issue where stickers wouldn't load and spun indefinitely by allowing WhatsApp and Facebook CDN domains (`*.whatsapp.net`, `*.fbcdn.net`, `*.whatsapp.com`) in internal URL guards and strictly scoping the download manager to explicit `a[download]` file actions.
- **Dock & Taskbar Window Icon**: Explicitly attached default window icon to `WebviewWindowBuilder` and `TrayIconBuilder` in Rust, ensuring the new circular chat bubble logo displays accurately on the Windows taskbar and system tray.

## [0.1.4] - 2026-11-13

### Added
- **Interactive Download Manager (Save As & Open)**: Added a dedicated in-app Download Manager (`wa-download-manager.js`) that intercepts in-memory decrypted blob downloads from WhatsApp Web (images, videos, audio, documents/PDFs) and presents an intuitive modal with **"Simpan Sebagai... (Save As)"** (powered by Windows native File System Access dialog) and **"Buka Berkas (Open)"** to open or preview files immediately.

### Fixed
- **Emoji Blur Immunity**: Fixed emojis being erroneously blurred and censored inside chat messages, reaction bubbles, contact names, and emoji pickers by strictly exempting emoji elements and removing overly broad image selectors.
- **Hover-to-Reveal (Unblur) on Cursor Hover**: Fixed hover unblur functionality across all blurred elements. Moving the mouse cursor over profile pictures, message bubbles (including all text and children), contact names, preview snippets, and media will now smoothly and instantly unblur them.

## [0.1.3] - 2026-11-13

### Added
- Integrated official new green handwritten "WL" chat bubble branding logo across the project (application icon, Windows .ico bundle, installer, and top banner in README).
- Redesigned Privacy Panel to a modern Dark Glass aesthetic matching WhatsApp Web Dark Mode (`rgba(32, 44, 51, 0.96)`, frosted backdrop blur, WhatsApp emerald teal `#00a884`, dark surfaces `#202c33`, and muted subtext `#8696a0`).

### Fixed
- Fixed unblurred default WhatsApp profile pictures: expanded avatar selectors and unblur hover rules to cover SVGs, contact initials circles (e.g. "ST"), community/group placeholders, and custom profile photos.

## [0.1.2] - 2026-11-13

### Fixed
- Fixed file download and saving: allowed `blob:https://web.whatsapp.com/` and internal URLs in navigation guards and new window handlers, enabling seamless downloads of images, videos, audio/voice notes, and documents directly into the system Downloads folder.
- Fixed duplicate download collisions with automatic unique numbering (`file (1).ext`) to ensure downloads never fail or silently abort.
- Fixed invisible mouse cursor: disabled Chromium's `HideCursorWhileTyping` feature flag in WebView2 to prevent Windows pointer desynchronization bug.
- Fixed native HTML5 file drag-and-drop: enabled `.disable_drag_drop_handler()` and `.drag_and_drop(true)` on WebView2 window builder so users can drag and drop images, PDFs, and files directly from Windows File Explorer into WhatsApp chat just like WhatsApp Desktop.

## [0.1.1] - 2026-11-13

### Changed
- Relocated floating shield button from bottom-left to bottom-right (`bottom: 22px; right: 22px`) to prevent obstructing WhatsApp Web navigation rail and profile picture.
- Added toggle hide support for floating shield button with persistence (`Alt + H` shortcut, panel toggle switch, and header minimize button).
- Added click-outside listener to automatically dismiss privacy panel.

### Fixed
- Fixed CSS selector scoping bug where un-prefixed comma-separated selectors remained permanently blurred even when overall or granular privacy switches were toggled off.
- Fixed undefined `body` variable references in About dialog (`bd.appendChild`).

## [0.1.0] - 2026-11-13

### Added
- Native Tauri v2 Windows 11 desktop wrapper for WhatsApp Web (`https://web.whatsapp.com`).
- Persistent session storage in `%LocalAppData%\id.my.vianto06.walite\EBWebView`.
- Low-overhead Chromium browser arguments with background notification throttling disabled and renderer limit of 2.
- System tray integration with un-minimize on left click, right click menu ("Buka Walite", "Keluar"), and close-to-tray behavior.
- Single instance enforcement via `tauri-plugin-single-instance`.
- Strict navigation boundary: internal navigation locked to `web.whatsapp.com`; external links (http, https, mailto, tel) delegate to default OS browser.
- New window requests (`target=_blank`, `window.open`) safely redirected to default external browser.
- Permission management: Notifications, Microphone, and Camera allowed only for `web.whatsapp.com`; downloads routed to user Downloads directory.
- Embedded CSP-compliant privacy panel (`wa-privacy-panel.js` < 25 KB):
  - Overall blur toggle (`Alt + Z`)
  - Granular blur toggles for names, avatars, last message snippets, message bubbles, media previews, and composer input.
  - Fullscreen screen lock (`Alt + X`) with PBKDF2 SHA-256 (100,000 iterations) verification and exponential retry delays.
  - Idle auto-lock detection via passive input listeners.
  - About dialog with copyright and legal disclaimer.
- Per-user NSIS installer bundle (`Walite_0.1.0_x64-setup.exe`, ~1.14 MB).
