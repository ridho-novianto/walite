# Changelog

All notable changes to Walite will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-12

### Added
- Initial project scaffolding for Tauri v2 on Windows 11.
- Custom WebviewWindowBuilder initialization pointing to WhatsApp Web.
- Persistent session storage in `%LocalAppData%\id.my.vianto06.walite\EBWebView`.
- Background notification persistence with tuned Chromium flags.
- System tray integration with close-to-tray and restore behaviors.
- Single instance enforcement via `tauri-plugin-single-instance`.
- Safe navigation filtering (restricting to `web.whatsapp.com`).
- Privacy panel with granular CSS-only blurring and Alt+Z toggle.
- Secure screen lock overlay with PBKDF2 SHA-256 password hashing.

