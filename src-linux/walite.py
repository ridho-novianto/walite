#!/usr/bin/env python3
"""
WaLite for Linux (Full Featured & Optimized Edition)
Ultra-lightweight, privacy-focused, and 100% stable WhatsApp Web client.

Architecture & Features:
- Engine: QtWebEngine (Chromium-based) with Vulkan/VA-API GPU acceleration
- Interactive Notifications (KDE Plasma & Linux Desktop):
    * Click-to-open chat (ActionInvoked with Wayland XDG_ACTIVATION_TOKEN)
    * Circular contact avatar/photo preview (image-path hint & icon)
    * Quick reply / inline-reply support (NotificationReplied D-Bus signal + auto send)
- Performance: Capped V8 heap (512MB), renderer process limits, bounded disk cache (120MB)
- UX: Window geometry & zoom persistence, Ctrl+Wheel zoom, zero white-flash dark theme,
      native file dialog downloads, system tray with single-instance enforcement.
- Privacy: Full integration with WaLite Privacy Blur Panel (wa-privacy-panel.js).
"""

import os
import sys
from pathlib import Path

from PyQt6.QtCore import (
    QEvent,
    QMetaType,
    QObject,
    QSettings,
    QStandardPaths,
    Qt,
    QUrl,
    QVariant,
    pyqtSlot,
)
from PyQt6.QtDBus import (
    QDBusArgument,
    QDBusConnection,
    QDBusInterface,
    QDBusMessage,
    QDBusVariant,
)
from PyQt6.QtGui import (
    QAction,
    QColor,
    QDesktopServices,
    QIcon,
    QImage,
    QKeySequence,
    QPainter,
    QPainterPath,
    QShortcut,
)
from PyQt6.QtNetwork import QLocalServer, QLocalSocket
from PyQt6.QtWidgets import (
    QApplication,
    QFileDialog,
    QMainWindow,
    QMenu,
    QSystemTrayIcon,
)
from PyQt6.QtWebEngineCore import (
    QWebEngineDownloadRequest,
    QWebEngineNotification,
    QWebEnginePage,
    QWebEngineProfile,
    QWebEngineScript,
    QWebEngineSettings,
)
from PyQt6.QtWebEngineWidgets import QWebEngineView

APP_ID = "id.my.vianto06.walite"
APP_NAME = "WaLite"
TARGET_URL = "https://web.whatsapp.com"
CHROME_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
)
DARK_BG_COLOR = QColor(17, 27, 33)  # WhatsApp Web dark mode theme color

if getattr(sys, "frozen", False):
    BUNDLE_DIR = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    PRIVACY_JS_PATH = BUNDLE_DIR / "wa-privacy-panel.js"
    ICON_PATH = BUNDLE_DIR / "icons" / "icon.png"
    if not ICON_PATH.exists():
        ICON_PATH = BUNDLE_DIR / "icon.png"
else:
    SCRIPT_DIR = Path(__file__).resolve().parent
    PROJECT_ROOT = SCRIPT_DIR.parent
    PRIVACY_JS_PATH = PROJECT_ROOT / "src-tauri" / "wa-privacy-panel.js"
    ICON_PATH = PROJECT_ROOT / "src-tauri" / "icons" / "icon.png"


def is_allowed_internal_url(url: QUrl) -> bool:
    scheme = url.scheme().lower()
    if scheme in ("blob", "data", "about", "javascript"):
        return True
    host = url.host().lower()
    if (
        host == "web.whatsapp.com"
        or host.endswith(".whatsapp.com")
        or host.endswith(".whatsapp.net")
        or host.endswith(".fbcdn.net")
    ):
        return True
    return False


class WaWebEnginePage(QWebEnginePage):
    """Custom WebEnginePage managing navigation, external links, and permissions."""

    def __init__(self, profile: QWebEngineProfile, parent: QObject = None):
        super().__init__(profile, parent)
        self.setBackgroundColor(DARK_BG_COLOR)
        self.featurePermissionRequested.connect(self._handle_feature_permission)

    def _handle_feature_permission(self, security_origin: QUrl, feature: QWebEnginePage.Feature):
        host = security_origin.host().lower()
        if host == "web.whatsapp.com" or host.endswith(".whatsapp.com"):
            self.setFeaturePermission(
                security_origin,
                feature,
                QWebEnginePage.PermissionPolicy.PermissionGrantedByUser,
            )
        else:
            self.setFeaturePermission(
                security_origin,
                feature,
                QWebEnginePage.PermissionPolicy.PermissionDeniedByUser,
            )

    def acceptNavigationRequest(self, url: QUrl, nav_type: QWebEnginePage.NavigationType, is_main_frame: bool) -> bool:
        if is_allowed_internal_url(url):
            return True

        scheme = url.scheme().lower()
        if scheme in ("http", "https", "mailto", "tel"):
            QDesktopServices.openUrl(url)
            return False

        return False

    def createWindow(self, window_type: QWebEnginePage.WebWindowType) -> QWebEnginePage:
        # Prevent popup tabs or windows from breaking the single-window layout
        return self


class ZoomWheelFilter(QObject):
    """Intercepts Ctrl + Mouse Wheel for instant, buttery-smooth page zooming."""

    def __init__(self, window: "WaLiteMainWindow"):
        super().__init__(window)
        self.window = window

    def eventFilter(self, watched: QObject, event: QEvent) -> bool:
        if event.type() == QEvent.Type.Wheel:
            modifiers = QApplication.keyboardModifiers()
            if modifiers & Qt.KeyboardModifier.ControlModifier:
                delta = event.angleDelta().y()
                if delta > 0:
                    self.window.zoom_in()
                elif delta < 0:
                    self.window.zoom_out()
                return True
        return super().eventFilter(watched, event)


class DBusNotificationManager(QObject):
    """
    Handles native Linux FreeDesktop / KDE Plasma notifications with:
    - Click-to-open chat (ActionInvoked default action + Wayland activation token)
    - Sender circular avatar/photo (image-path hint & icon)
    - Quick reply support (NotificationReplied D-Bus signal + auto send in WhatsApp)
    """

    def __init__(self, window: "WaLiteMainWindow"):
        super().__init__(window)
        self.window = window
        self.bus = QDBusConnection.sessionBus()
        self.active_notifications: dict[int, QWebEngineNotification] = {}
        self.notification_senders: dict[int, str] = {}
        self.notification_tags: dict[int, str] = {}
        self._activation_tokens: dict[int, str] = {}

        # Connect to Freedesktop Notifications D-Bus signals with explicit signatures
        self.bus.connect(
            "org.freedesktop.Notifications",
            "/org/freedesktop/Notifications",
            "org.freedesktop.Notifications",
            "ActionInvoked",
            "us",
            self._on_action_invoked,
        )
        self.bus.connect(
            "org.freedesktop.Notifications",
            "/org/freedesktop/Notifications",
            "org.freedesktop.Notifications",
            "ActivationToken",
            "us",
            self._on_activation_token,
        )
        self.bus.connect(
            "org.freedesktop.Notifications",
            "/org/freedesktop/Notifications",
            "org.freedesktop.Notifications",
            "NotificationReplied",
            "us",
            self._on_notification_replied,
        )
        self.bus.connect(
            "org.freedesktop.Notifications",
            "/org/freedesktop/Notifications",
            "org.freedesktop.Notifications",
            "NotificationClosed",
            "uu",
            self._on_notification_closed,
        )

        self.iface = QDBusInterface(
            "org.freedesktop.Notifications",
            "/org/freedesktop/Notifications",
            "org.freedesktop.Notifications",
            self.bus,
        )

    def present_notification(self, notif: QWebEngineNotification):
        # Anchor notification object to keep it alive until closed/clicked
        notif.setParent(self)

        title = (notif.title() or "WhatsApp").strip()
        message = (notif.message() or "").strip()
        tag = notif.tag() or ""
        icon_path = self._render_avatar(notif.icon(), title)

        is_real_chat = (
            title != "WhatsApp"
            and "uji coba" not in message.lower()
            and "test" not in message.lower()
        )

        # Build actions: 'default' (click anywhere on toast) and 'inline-reply' (quick reply)
        actions = QDBusArgument()
        actions.beginArray(QMetaType.Type.QString.value)
        actions.add("default")
        actions.add("Buka Obrolan")
        if is_real_chat:
            actions.add("inline-reply")
            actions.add("Balas Cepat")
        actions.endArray()

        # Build hints with desktop entry, category, and avatar image path
        hints = QDBusArgument()
        hints.beginMap(QMetaType.Type.QString.value, QMetaType.fromName(b"QDBusVariant").id())

        hints.beginMapEntry()
        hints.add("desktop-entry")
        hints.add(QDBusVariant(APP_ID))
        hints.endMapEntry()

        hints.beginMapEntry()
        hints.add("category")
        hints.add(QDBusVariant("im.received" if is_real_chat else "transfer"))
        hints.endMapEntry()

        if is_real_chat:
            hints.beginMapEntry()
            hints.add("x-kde-reply-placeholder-text")
            hints.add(QDBusVariant(f"Balas pesan ke {title}..."))
            hints.endMapEntry()

            hints.beginMapEntry()
            hints.add("x-kde-reply-submit-button-text")
            hints.add(QDBusVariant("Kirim"))
            hints.endMapEntry()

            hints.beginMapEntry()
            hints.add("x-kde-reply-submit-button-icon-name")
            hints.add(QDBusVariant("document-send"))
            hints.endMapEntry()

        if icon_path:
            hints.beginMapEntry()
            hints.add("image-path")
            hints.add(QDBusVariant(icon_path))
            hints.endMapEntry()

            hints.beginMapEntry()
            hints.add("image_path")
            hints.add(QDBusVariant(icon_path))
            hints.endMapEntry()

        hints.endMap()

        replaces_id = QVariant(0)
        replaces_id.convert(QMetaType(QMetaType.Type.UInt.value))

        reply = self.iface.call(
            "Notify",
            APP_NAME,
            replaces_id,
            icon_path or str(ICON_PATH),
            title,
            message,
            actions,
            hints,
            10000 if is_real_chat else 4000,
        )

        if reply.type() == QDBusMessage.MessageType.ReplyMessage and reply.arguments():
            nid = int(reply.arguments()[0])
            self.active_notifications[nid] = notif
            self.notification_senders[nid] = title
            self.notification_tags[nid] = tag
            try:
                notif.closed.connect(lambda: self._cleanup_nid(nid))
            except Exception:
                pass

    def _cleanup_nid(self, nid: int):
        self.active_notifications.pop(nid, None)
        self.notification_senders.pop(nid, None)
        self.notification_tags.pop(nid, None)
        self._activation_tokens.pop(nid, None)

    @pyqtSlot("uint", str)
    def _on_activation_token(self, nid: int, token: str):
        nid = int(nid)
        self._activation_tokens[nid] = str(token)

    @pyqtSlot("uint", str)
    def _on_action_invoked(self, nid: int, action: str):
        nid = int(nid)
        action = str(action)
        token = self._activation_tokens.pop(nid, None)

        if action in ("default", "open", "1", ""):
            # 1. Bring window to front with Wayland activation token
            self.window.activate_from_notification(token)
            # 2. Trigger notification.onclick in WhatsApp Web so it navigates to that chat
            notif = self.active_notifications.get(nid)
            if notif:
                try:
                    notif.click()
                except Exception as e:
                    print(f"[WaLite] notif.click error: {e}")
            # 3. Direct DOM fallback: open chat by title/tag to guarantee navigation
            title = self.notification_senders.get(nid, "")
            tag = self.notification_tags.get(nid, "")
            if title and title != "WhatsApp":
                self._open_chat_in_page(title, tag)

    @pyqtSlot("uint", str)
    def _on_notification_replied(self, nid: int, reply_text: str):
        nid = int(nid)
        reply_text = str(reply_text)
        token = self._activation_tokens.pop(nid, None)

        # 1. Bring window to front
        self.window.activate_from_notification(token)

        # 2. Open chat via notification click and DOM fallback
        notif = self.active_notifications.get(nid)
        if notif:
            try:
                notif.click()
            except Exception as e:
                print(f"[WaLite] notif.click error: {e}")

        title = self.notification_senders.get(nid, "")
        tag = self.notification_tags.get(nid, "")
        if title and title != "WhatsApp":
            self._open_chat_in_page(title, tag)

        # 3. Type text into WhatsApp Web message box and trigger send
        if reply_text and reply_text.strip():
            safe_text = (
                reply_text.replace("\\", "\\\\")
                .replace("'", "\\'")
                .replace('"', '\\"')
                .replace("\n", "\\n")
            )
            js = f"""
            (function() {{
                let attempts = 0;
                function trySend() {{
                    attempts++;
                    const footer = document.querySelector('#main footer');
                    if (!footer) {{
                        if (attempts < 16) setTimeout(trySend, 200);
                        return;
                    }}
                    const box = footer.querySelector('[contenteditable="true"]');
                    if (!box) {{
                        if (attempts < 16) setTimeout(trySend, 200);
                        return;
                    }}
                    box.focus();
                    document.execCommand('selectAll', false, null);
                    document.execCommand('insertText', false, "{safe_text}");
                    box.dispatchEvent(new InputEvent('input', {{ bubbles: true, composed: true, data: "{safe_text}" }}));

                    setTimeout(() => {{
                        const sendBtn = footer.querySelector('button[aria-label*="Kirim"], button[aria-label*="Send"], [data-testid="send"]') ||
                                        footer.querySelector('span[data-icon="send"]')?.closest('button');
                        if (sendBtn) {{
                            sendBtn.click();
                        }} else {{
                            box.dispatchEvent(new KeyboardEvent('keydown', {{ key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }}));
                        }}
                    }}, 250);
                }}
                setTimeout(trySend, 300);
            }})();
            """
            self.window.web_view.page().runJavaScript(js)

    def _open_chat_in_page(self, title: str, tag: str = ""):
        safe_title = title.replace("\\", "\\\\").replace("'", "\\'")
        safe_tag = tag.replace("\\", "\\\\").replace("'", "\\'")
        js = f"""
        (function() {{
            if (window.__walite_open_chat) {{
                window.__walite_open_chat('{safe_title}', '{safe_tag}');
            }}
        }})();
        """
        self.window.web_view.page().runJavaScript(js)

    @pyqtSlot("uint", "uint")
    def _on_notification_closed(self, nid: int, reason: int):
        nid = int(nid)
        self._cleanup_nid(nid)

    def _render_avatar(self, img: QImage, title: str) -> str:
        if not img or img.isNull() or img.width() == 0:
            return str(ICON_PATH)
        try:
            tmp_dir = Path.home() / ".local" / "share" / APP_ID / "avatars"
            tmp_dir.mkdir(parents=True, exist_ok=True)
            clean_title = (
                "".join(c for c in title if c.isalnum() or c in (" ", "_", "-")).strip()
                or "avatar"
            )
            avatar_path = tmp_dir / f"{clean_title}.png"

            size = min(img.width(), img.height())
            circle_img = QImage(size, size, QImage.Format.Format_ARGB32)
            circle_img.fill(Qt.GlobalColor.transparent)

            painter = QPainter(circle_img)
            painter.setRenderHint(QPainter.RenderHint.Antialiasing, True)
            path = QPainterPath()
            path.addEllipse(0, 0, size, size)
            painter.setClipPath(path)
            painter.drawImage(0, 0, img)
            painter.end()

            if circle_img.save(str(avatar_path), "PNG"):
                return str(avatar_path)
        except Exception:
            pass
        return str(ICON_PATH)


class WaLiteMainWindow(QMainWindow):
    """Main Application Window for WaLite on Linux."""

    def __init__(self, profile: QWebEngineProfile):
        super().__init__()
        self.profile = profile
        self.really_quitting = False
        self.settings = QSettings(APP_ID, APP_NAME)

        self.setWindowTitle(APP_NAME)
        self.setMinimumSize(680, 500)

        # Restore previous window geometry (size, position, maximize state)
        saved_geom = self.settings.value("geometry")
        if saved_geom:
            self.restoreGeometry(saved_geom)
        else:
            self.resize(1024, 768)

        # Set window icon
        if ICON_PATH.exists():
            self.app_icon = QIcon(str(ICON_PATH))
            self.setWindowIcon(self.app_icon)
        else:
            self.app_icon = QIcon()

        # Initialize Web View with zero-flash dark background
        self.web_view = QWebEngineView(self)
        self.web_view.setStyleSheet("background-color: #111b21;")
        self.web_page = WaWebEnginePage(self.profile, self.web_view)
        self.web_view.setPage(self.web_page)
        self.setCentralWidget(self.web_view)

        # Restore saved zoom factor
        saved_zoom = self.settings.value("zoom_factor", 1.0, type=float)
        if 0.5 <= saved_zoom <= 2.5:
            self.web_view.setZoomFactor(saved_zoom)

        # Install Ctrl + Wheel Zoom Filter
        self.zoom_filter = ZoomWheelFilter(self)
        self.web_view.installEventFilter(self.zoom_filter)
        if self.web_view.focusProxy():
            self.web_view.focusProxy().installEventFilter(self.zoom_filter)

        # Handle file downloads
        self.profile.downloadRequested.connect(self._handle_download)

        # Setup System Tray Icon
        self._setup_tray()

        # Keyboard shortcuts
        QShortcut(QKeySequence("Ctrl+Q"), self, self._action_quit)
        QShortcut(QKeySequence("Ctrl+W"), self, self.hide)
        QShortcut(QKeySequence("Ctrl+R"), self, self.web_view.reload)
        QShortcut(QKeySequence("F5"), self, self.web_view.reload)
        QShortcut(QKeySequence("Ctrl+Shift+R"), self, self._hard_reload)

        # Zoom Shortcuts
        QShortcut(QKeySequence("Ctrl+="), self, self.zoom_in)
        QShortcut(QKeySequence("Ctrl++"), self, self.zoom_in)
        QShortcut(QKeySequence("Ctrl+-"), self, self.zoom_out)
        QShortcut(QKeySequence("Ctrl+0"), self, self.zoom_reset)

        # Load WhatsApp Web
        self.web_view.setUrl(QUrl(TARGET_URL))

    def zoom_in(self):
        new_zoom = min(2.5, round(self.web_view.zoomFactor() + 0.1, 2))
        self.web_view.setZoomFactor(new_zoom)
        self.settings.setValue("zoom_factor", new_zoom)

    def zoom_out(self):
        new_zoom = max(0.5, round(self.web_view.zoomFactor() - 0.1, 2))
        self.web_view.setZoomFactor(new_zoom)
        self.settings.setValue("zoom_factor", new_zoom)

    def zoom_reset(self):
        self.web_view.setZoomFactor(1.0)
        self.settings.setValue("zoom_factor", 1.0)

    def _hard_reload(self):
        self.profile.clearHttpCache()
        self.web_view.reload()

    def _setup_tray(self):
        if not QSystemTrayIcon.isSystemTrayAvailable():
            self.tray_icon = None
            return

        self.tray_icon = QSystemTrayIcon(self.app_icon, self)
        self.tray_icon.setToolTip(f"{APP_NAME} - WhatsApp Web")

        menu = QMenu(self)
        show_action = QAction("Buka WaLite", self)
        show_action.triggered.connect(self.show_and_activate)
        menu.addAction(show_action)

        reload_action = QAction("Muat Ulang Halaman", self)
        reload_action.triggered.connect(self.web_view.reload)
        menu.addAction(reload_action)

        menu.addSeparator()

        quit_action = QAction("Keluar", self)
        quit_action.triggered.connect(self._action_quit)
        menu.addAction(quit_action)

        self.tray_icon.setContextMenu(menu)
        self.tray_icon.activated.connect(self._on_tray_activated)
        self.tray_icon.show()

    def _on_tray_activated(self, reason: QSystemTrayIcon.ActivationReason):
        if reason in (
            QSystemTrayIcon.ActivationReason.Trigger,
            QSystemTrayIcon.ActivationReason.DoubleClick,
        ):
            if self.isVisible() and not self.isMinimized():
                self.hide()
            else:
                self.show_and_activate()

    def show_and_activate(self):
        self.show()
        if self.isMinimized():
            self.showNormal()
        self.raise_()
        self.activateWindow()
        self.web_view.setFocus()

    def activate_from_notification(self, token: str = None):
        if token:
            os.environ["XDG_ACTIVATION_TOKEN"] = token
        self.show()
        if self.isMinimized():
            self.showNormal()
        self.raise_()
        self.activateWindow()
        self.web_view.setFocus()
        if token:
            os.environ.pop("XDG_ACTIVATION_TOKEN", None)

    def _handle_download(self, download: QWebEngineDownloadRequest):
        suggested_name = download.suggestedFileName()
        dl_dir = QStandardPaths.writableLocation(
            QStandardPaths.StandardLocation.DownloadLocation
        )
        initial_path = os.path.join(dl_dir, suggested_name)

        target_path, _ = QFileDialog.getSaveFileName(
            self,
            "Simpan Berkas",
            initial_path,
            "Semua Berkas (*.*)",
        )

        if target_path:
            download.setDownloadDirectory(os.path.dirname(target_path))
            download.setDownloadFileName(os.path.basename(target_path))
            download.accept()
            if self.tray_icon:
                self.tray_icon.showMessage(
                    APP_NAME,
                    f"Mengunduh berkas: {os.path.basename(target_path)}",
                    QSystemTrayIcon.MessageIcon.Information,
                    3000,
                )
        else:
            download.cancel()

    def _action_quit(self):
        self.really_quitting = True
        self.settings.setValue("geometry", self.saveGeometry())
        self.settings.setValue("zoom_factor", self.web_view.zoomFactor())
        QApplication.quit()

    def closeEvent(self, event):
        if not self.really_quitting and self.tray_icon and self.tray_icon.isVisible():
            self.settings.setValue("geometry", self.saveGeometry())
            self.settings.setValue("zoom_factor", self.web_view.zoomFactor())
            event.ignore()
            self.hide()
            if not getattr(self, "_tray_notified", False):
                self._tray_notified = True
                self.tray_icon.showMessage(
                    APP_NAME,
                    "WaLite tetap berjalan di latar belakang.",
                    QSystemTrayIcon.MessageIcon.Information,
                    2000,
                )
        else:
            self.settings.setValue("geometry", self.saveGeometry())
            self.settings.setValue("zoom_factor", self.web_view.zoomFactor())
            event.accept()


def create_walite_profile(app: QApplication) -> QWebEngineProfile:
    """Create persistent, memory-capped Chromium profile for WhatsApp Web."""
    storage_root = (
        Path.home() / ".local" / "share" / APP_ID / "QtWebEngine"
    )
    storage_root.mkdir(parents=True, exist_ok=True)

    profile = QWebEngineProfile("walite-profile", app)
    profile.setPersistentStoragePath(str(storage_root))
    profile.setCachePath(str(storage_root / "Cache"))
    profile.setPersistentCookiesPolicy(
        QWebEngineProfile.PersistentCookiesPolicy.AllowPersistentCookies
    )
    profile.setHttpUserAgent(CHROME_UA)

    # Bound disk HTTP cache to 120MB
    profile.setHttpCacheType(QWebEngineProfile.HttpCacheType.DiskHttpCache)
    profile.setHttpCacheMaximumSize(120 * 1024 * 1024)

    settings = profile.settings()
    settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)
    settings.setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)
    settings.setAttribute(QWebEngineSettings.WebAttribute.PlaybackRequiresUserGesture, False)
    settings.setAttribute(QWebEngineSettings.WebAttribute.WebGLEnabled, True)
    settings.setAttribute(QWebEngineSettings.WebAttribute.Accelerated2dCanvasEnabled, True)
    settings.setAttribute(QWebEngineSettings.WebAttribute.AutoLoadImages, True)
    settings.setAttribute(QWebEngineSettings.WebAttribute.DnsPrefetchEnabled, True)
    settings.setAttribute(QWebEngineSettings.WebAttribute.ScrollAnimatorEnabled, True)
    settings.setAttribute(QWebEngineSettings.WebAttribute.FocusOnNavigationEnabled, False)

    # Inject WaLite Privacy Panel JS (Single Source of Truth)
    if PRIVACY_JS_PATH.exists():
        with open(PRIVACY_JS_PATH, "r", encoding="utf-8") as f:
            privacy_code = f.read()

        privacy_script = QWebEngineScript()
        privacy_script.setName("walite-privacy-panel")
        privacy_script.setSourceCode(privacy_code)
        privacy_script.setInjectionPoint(QWebEngineScript.InjectionPoint.DocumentReady)
        privacy_script.setWorldId(QWebEngineScript.ScriptWorldId.MainWorld)
        privacy_script.setRunsOnSubFrames(False)
        profile.scripts().insert(privacy_script)
    else:
        print(f"[WaLite Warning] Privacy script not found at {PRIVACY_JS_PATH}")

    # Inject minor styling cleanup and chat navigation helper
    cleanup_code = """
    (function() {
        if (!document.getElementById('walite-cleaner-style')) {
            const style = document.createElement('style');
            style.id = 'walite-cleaner-style';
            style.textContent = `
                html, body, #app { background-color: #111b21 !important; }
                body, #app, #main, #pane-side { cursor: default; }
                button, a, [role="button"], [data-tab], [data-icon], [data-testid*="btn"], [data-testid*="menu"], [data-testid*="audio-play"], [data-testid*="status"] {
                    cursor: pointer !important;
                }
                [data-testid*="banner"]:not(#main *):not([role="row"] *),
                [data-testid*="upsell"]:not(#main *):not([role="row"] *) {
                    display: none !important;
                }
            `;
            (document.head || document.documentElement).appendChild(style);
        }

        if (!window.__walite_open_chat) {
            window.__walite_open_chat = function(title, jid) {
                if (!title || title === 'WhatsApp') return false;
                const mainHeader = document.querySelector('#main header');
                if (mainHeader && (mainHeader.textContent.includes(title) || (jid && mainHeader.innerHTML.includes(jid.split('@')[0])))) {
                    return true;
                }
                const escaped = CSS.escape(title);
                let span = document.querySelector(`#pane-side span[title="${escaped}"]`);
                if (!span) {
                    const allSpans = document.querySelectorAll('#pane-side [role="row"] span[dir="auto"]');
                    for (const s of allSpans) {
                        if (s.textContent.trim().toLowerCase() === title.trim().toLowerCase()) {
                            span = s;
                            break;
                        }
                    }
                }
                if (span) {
                    const row = span.closest('[role="row"]') || span.closest('div[tabindex]');
                    if (row) {
                        row.click();
                        return true;
                    }
                }
                const searchBox = document.querySelector('div[contenteditable="true"][data-tab="3"]');
                if (searchBox) {
                    searchBox.focus();
                    document.execCommand('selectAll', false, null);
                    document.execCommand('insertText', false, title);
                    searchBox.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: title }));
                    setTimeout(() => {
                        const firstRow = document.querySelector('#pane-side [role="row"]');
                        if (firstRow) firstRow.click();
                    }, 350);
                    return true;
                }
                return false;
            };
        }
    })();
    """
    cleanup_script = QWebEngineScript()
    cleanup_script.setName("walite-cleanup")
    cleanup_script.setSourceCode(cleanup_code)
    cleanup_script.setInjectionPoint(QWebEngineScript.InjectionPoint.DocumentReady)
    cleanup_script.setWorldId(QWebEngineScript.ScriptWorldId.MainWorld)
    cleanup_script.setRunsOnSubFrames(False)
    profile.scripts().insert(cleanup_script)

    return profile


def setup_single_instance(app: QApplication, window: WaLiteMainWindow, server_name: str):
    """Setup QLocalServer to enforce a single running application instance."""
    server = QLocalServer(app)

    def on_new_connection():
        client = server.nextPendingConnection()
        if client:
            client.readyRead.connect(lambda: _handle_client_msg(client))

    def _handle_client_msg(client: QLocalSocket):
        msg = client.readAll().data().decode("utf-8", errors="ignore")
        if "ACTIVATE" in msg:
            window.show_and_activate()
        client.disconnectFromServer()

    server.newConnection.connect(on_new_connection)
    QLocalServer.removeServer(server_name)
    server.listen(server_name)


def main():
    # Performance & Memory Optimization Chromium Flags:
    sys_args = [
        sys.argv[0],
        "--enable-features=VaapiVideoDecoder,CanvasOopRasterization",
        "--enable-gpu-rasterization",
        "--enable-zero-copy",
        "--renderer-process-limit=2",
        "--process-per-site",
        "--js-flags=--max_old_space_size=512",
        "--disable-speech-api",
        "--disable-breakpad",
        "--disable-component-update",
        "--disable-features=Translate,MediaRouter,OptimizationHints,Feed,WebOTP,WebPayments,WebUSB",
        "--no-default-browser-check",
        "--no-first-run",
    ] + sys.argv[1:]

    # Check for already-running instance
    server_name = f"{APP_ID}_single_instance"
    probe_socket = QLocalSocket()
    probe_socket.connectToServer(server_name)
    if probe_socket.waitForConnected(400):
        probe_socket.write(b"ACTIVATE")
        probe_socket.flush()
        probe_socket.waitForBytesWritten(400)
        probe_socket.disconnectFromServer()
        sys.exit(0)

    app = QApplication(sys_args)
    app.setApplicationName(APP_NAME)
    app.setDesktopFileName(f"{APP_ID}.desktop")

    profile = create_walite_profile(app)
    window = WaLiteMainWindow(profile)
    notif_manager = DBusNotificationManager(window)
    profile.setNotificationPresenter(notif_manager.present_notification)

    setup_single_instance(app, window, server_name)

    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
