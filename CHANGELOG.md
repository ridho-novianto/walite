# Changelog

All notable changes to Walite will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
