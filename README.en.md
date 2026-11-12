# Walite

Walite is a lightweight, secure, and resource-efficient WhatsApp Web wrapper for Windows 11, crafted with Tauri v2 and Rust. It delivers a streamlined native experience with minimal footprint, persistent sessions, and a comprehensive client-side privacy suite.

## Features

- **Lightweight & Efficient**: Powered by Windows WebView2 runtime with strict memory limits and background optimizations.
- **Persistent Session**: Session data is preserved safely in `%LocalAppData%\id.my.vianto06.walite\EBWebView`.
- **Single Instance**: Seamless single-instance handling; launching a duplicate instance focuses the existing window.
- **System Tray Integration**: Close button (X) minimizes to tray to keep WebSockets and notifications responsive in background.
- **Strict Navigation Guard**: Restricts navigation exclusively to `https://web.whatsapp.com`; external links open via default OS browser.
- **Privacy & Screen Lock Panel**: Granular CSS-only blurring for sensitive elements and quick screen lock with PBKDF2 SHA-256 verification.

## System Requirements

- Windows 10 (64-bit) 1809+ or Windows 11
- Microsoft Edge WebView2 Runtime

## Building from Source

```powershell
npm install
npm run tauri build
```

## Disclaimer

Independent project. Not affiliated with, endorsed by, or sponsored by WhatsApp LLC or Meta Platforms, Inc. WhatsApp is a trademark of its respective owner.

## License

Released under the [MIT](LICENSE) License. Copyright © 2026 Ridho Novianto.

