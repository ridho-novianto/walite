<div align="center">

<img src="assets/logo.png" alt="Walite Logo" width="128" height="128" />

# Walite

<p><strong>Lightweight, Secure & Privacy-Focused WhatsApp Web Wrapper for Windows 11</strong></p>

</div>

Walite is a lightweight, privacy-conscious desktop wrapper for WhatsApp Web tailored for Windows 11 and Windows 10 (64-bit), built with Tauri v2, Rust, and the Microsoft Edge WebView2 runtime. It is designed to minimize resource consumption, maintain persistent sessions in an isolated directory, and offer client-side visual privacy tools and a screen locker.

## Highlights

- **Lean & Efficient**: Native Rust core uses ~6.7 MB Private Working Set (~460 MB total idle with WebView2 runtime), optimized with `--renderer-process-limit=2`.
- **Persistent Session Storage**: Dedicated directory at `%LocalAppData%\id.my.vianto06.walite\EBWebView` ensures login credentials survive restarts, updates, and rebuilds.
- **Single Instance**: Opening a duplicate executable seamlessly focuses the existing window without creating redundant processes.
- **System Tray Integration**: Closing the window (X) minimizes to tray, preserving WebSocket connections and incoming notifications. Full exit is available via tray right-click "Keluar".
- **Navigation Isolation**: Webview navigation is strictly locked to `https://web.whatsapp.com`. External links open via the user's default browser.
- **Client-Side Privacy Suite**: Single-file CSS-only blur controls for contact names, avatars, message previews, chat logs, media, and text input, toggled via `Alt + Z`. Floating shield button is positioned at the bottom-right and can be toggled/hidden anytime via `Alt + H` or the header minimize button.
- **Screen Lock**: Fullscreen privacy blur overlay with PBKDF2 SHA-256 (100,000 iterations) password hashing and configurable auto-lock on idle.

## System Requirements

- Windows 11 or Windows 10 (64-bit, 1809+).
- Microsoft Edge WebView2 Runtime.
- No administrator privileges required (per-user NSIS installation).

## Installation

Download `Walite_0.1.3_x64-setup.exe` (~1.14 MB) from [Releases](https://github.com/ridho-novianto/walite/releases). Note that Windows SmartScreen may show an unverified publisher notice because this open-source build is not digitally code-signed. Upgrading from a previous version can be done seamlessly by running the installer directly without uninstalling.

## Building from Source

```powershell
git clone https://github.com/ridho-novianto/walite.git
cd walite
npm install
npm run tauri build
```
Build outputs:
- Binary: `src-tauri/target/release/walite.exe` (~3.24 MB)
- Installer: `src-tauri/target/release/bundle/nsis/Walite_0.1.3_x64-setup.exe` (~1.14 MB)

## Updating Selectors

If WhatsApp Web changes its markup, modify the `SELECTORS` object at the top of [`src-tauri/wa-privacy-panel.js`](src-tauri/wa-privacy-panel.js), run `node scripts/optimize-panel.js`, and re-run `npm run tauri build`.

## Privacy & Security

- **Display Protection, Not Encryption**: Screen Lock protects the physical screen from onlookers; it does not encrypt local cache or database files.
- **Zero Telemetry**: No trackers, analytics, or third-party metrics.
- **Isolated Script**: `wa-privacy-panel.js` makes no network requests (`fetch`, `XMLHttpRequest`, or `WebSocket`).

## Known Limitations

- **SmartScreen Prompt**: Unsigned installer triggers Microsoft SmartScreen filter.
- **DOM Couplings**: Blur effects rely on WhatsApp Web's DOM hierarchy.

## License

Released under the [MIT](LICENSE) License. Copyright © 2026 Ridho Novianto.

## Disclaimer

Independent project. Not affiliated with, endorsed by, or sponsored by WhatsApp LLC or Meta Platforms, Inc. WhatsApp is a trademark of its respective owner.
