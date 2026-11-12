# Changelog

All notable changes to Walite will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
