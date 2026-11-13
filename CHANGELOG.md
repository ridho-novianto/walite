# Changelog

All notable changes to Walite will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
