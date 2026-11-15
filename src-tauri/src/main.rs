#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    webview::{DownloadEvent, NewWindowResponse, PermissionKind, PermissionResponse},
    Manager, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

const TARGET_URL: &str = "https://web.whatsapp.com";
const BROWSER_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,Translate,HideCursorWhileTyping,msSmartScreenProtection \
    --no-first-run \
    --disable-background-timer-throttling \
    --disable-renderer-backgrounding \
    --disable-backgrounding-occluded-windows";

fn get_persistent_data_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            PathBuf::from(local_app_data)
                .join("id.my.vianto06.walite")
                .join("EBWebView")
        } else {
            std::env::temp_dir()
                .join("id.my.vianto06.walite")
                .join("EBWebView")
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(xdg) = std::env::var("XDG_DATA_HOME") {
            PathBuf::from(xdg).join("id.my.vianto06.walite")
        } else if let Ok(home) = std::env::var("HOME") {
            PathBuf::from(home)
                .join(".local")
                .join("share")
                .join("id.my.vianto06.walite")
        } else {
            std::env::temp_dir().join("id.my.vianto06.walite")
        }
    }
}

fn is_safe_external_scheme(scheme: &str) -> bool {
    matches!(scheme, "http" | "https" | "mailto" | "tel")
}

fn open_in_default_browser(url: &str) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let res = std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", url])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
        if res.is_err() {
            let _ = std::process::Command::new("cmd")
                .args(["/C", "start", "", url])
                .creation_flags(CREATE_NO_WINDOW)
                .spawn();
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::process::Command::new("xdg-open")
            .arg(url)
            .spawn();
    }
}

fn is_allowed_internal_url(url: &Url) -> bool {
    if url.scheme() == "blob" || url.scheme() == "data" || url.as_str() == "about:blank" {
        return true;
    }
    if url.scheme() == "https" {
        if let Some(host) = url.host_str() {
            if host == "web.whatsapp.com"
                || host.ends_with(".whatsapp.com")
                || host.ends_with(".whatsapp.net")
                || host.ends_with(".fbcdn.net")
            {
                return true;
            }
        }
    }
    false
}

fn get_unique_download_path(dir: &std::path::Path, file_name: &str) -> PathBuf {
    let mut target = dir.join(file_name);
    if !target.exists() {
        return target;
    }
    let p = std::path::Path::new(file_name);
    let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("download");
    let ext = p.extension().and_then(|s| s.to_str());
    let mut counter = 1;
    loop {
        let candidate = match ext {
            Some(e) => format!("{} ({}).{}", stem, counter, e),
            None => format!("{} ({})", stem, counter),
        };
        target = dir.join(candidate);
        if !target.exists() {
            return target;
        }
        counter += 1;
    }
}

fn escape_js_str(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('\'', "\\'")
        .replace('\"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

fn handle_walite_action(app: &tauri::AppHandle, url: &Url) -> bool {
    if url.scheme() != "walite-action" {
        return false;
    }
    let action = url.host_str().unwrap_or("");
    let mut params = std::collections::HashMap::new();
    for (k, v) in url.query_pairs() {
        params.insert(k.to_string(), v.to_string());
    }

    match action {
        "notify" => {
            let title = params.get("title").cloned().unwrap_or_default();
            let body = params.get("body").cloned().unwrap_or_default();
            let icon = params.get("icon").cloned().unwrap_or_default();
            let tag = params.get("tag").cloned().unwrap_or_default();

            if let Some(toast_win) = app.get_webview_window("toast") {
                if let Ok(Some(monitor)) = app.primary_monitor() {
                    let scale = monitor.scale_factor();
                    let size = monitor.size();
                    let toast_w = (380.0 * scale) as i32;
                    let toast_h = (135.0 * scale) as i32;
                    let margin_x = (20.0 * scale) as i32;
                    let margin_y = (60.0 * scale) as i32;
                    let x = size.width as i32 - toast_w - margin_x;
                    let y = size.height as i32 - toast_h - margin_y;
                    let _ = toast_win.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
                }

                let safe_title = escape_js_str(&title);
                let safe_body = escape_js_str(&body);
                let safe_icon = escape_js_str(&icon);
                let safe_tag = escape_js_str(&tag);
                let js = format!(
                    "if (window.showToast) window.showToast('{}', '{}', '{}', '{}');",
                    safe_title, safe_body, safe_icon, safe_tag
                );
                let _ = toast_win.eval(&js);

                #[cfg(target_os = "windows")]
                if let Ok(hwnd) = toast_win.hwnd() {
                    unsafe {
                        #[link(name = "user32")]
                        extern "system" {
                            fn ShowWindow(hWnd: *mut std::ffi::c_void, nCmdShow: i32) -> i32;
                        }
                        const SW_SHOWNOACTIVATE: i32 = 4;
                        ShowWindow(hwnd.0, SW_SHOWNOACTIVATE);
                    }
                }
                #[cfg(not(target_os = "windows"))]
                let _ = toast_win.show();
            }
        }
        "open-chat" => {
            if let Some(toast_win) = app.get_webview_window("toast") {
                let _ = toast_win.hide();
            }
            let title = params.get("title").cloned().unwrap_or_default();
            let tag = params.get("tag").cloned().unwrap_or_default();
            if let Some(main_win) = app.get_webview_window("main") {
                let _ = main_win.show();
                let _ = main_win.unminimize();
                let _ = main_win.set_focus();

                #[cfg(target_os = "windows")]
                if let Ok(hwnd) = main_win.hwnd() {
                    unsafe {
                        #[link(name = "user32")]
                        extern "system" {
                            fn SetForegroundWindow(hWnd: *mut std::ffi::c_void) -> i32;
                            fn BringWindowToTop(hWnd: *mut std::ffi::c_void) -> i32;
                        }
                        BringWindowToTop(hwnd.0);
                        SetForegroundWindow(hwnd.0);
                    }
                }

                let safe_title = escape_js_str(&title);
                let safe_tag = escape_js_str(&tag);
                let js = format!(
                    "if (window.__walite_open_chat) window.__walite_open_chat('{}', '{}');",
                    safe_title, safe_tag
                );
                let _ = main_win.eval(&js);
            }
        }
        "send-reply" => {
            let title = params.get("title").cloned().unwrap_or_default();
            let tag = params.get("tag").cloned().unwrap_or_default();
            let text = params.get("text").cloned().unwrap_or_default();
            if let Some(main_win) = app.get_webview_window("main") {
                let safe_title = escape_js_str(&title);
                let safe_tag = escape_js_str(&tag);
                let safe_text = escape_js_str(&text);
                let js = format!(
                    "if (window.__walite_send_reply) window.__walite_send_reply('{}', '{}', '{}');",
                    safe_title, safe_tag, safe_text
                );
                let _ = main_win.eval(&js);
            }
        }
        "close-toast" => {
            if let Some(toast_win) = app.get_webview_window("toast") {
                let _ = toast_win.hide();
            }
        }
        _ => {}
    }
    true
}

#[tauri::command]
fn walite_action(
    app: tauri::AppHandle,
    action: String,
    title: Option<String>,
    body: Option<String>,
    icon: Option<String>,
    tag: Option<String>,
    text: Option<String>,
) {
    let mut params = std::collections::HashMap::new();
    if let Some(t) = title { params.insert("title".to_string(), t); }
    if let Some(b) = body { params.insert("body".to_string(), b); }
    if let Some(i) = icon { params.insert("icon".to_string(), i); }
    if let Some(g) = tag { params.insert("tag".to_string(), g); }
    if let Some(x) = text { params.insert("text".to_string(), x); }

    let mut query = String::new();
    for (k, v) in &params {
        if !query.is_empty() { query.push('&'); }
        let enc_k = k.replace('&', "%26").replace('=', "%3D").replace('?', "%3F");
        let enc_v = v.replace('&', "%26").replace('=', "%3D").replace('?', "%3F");
        query.push_str(&format!("{}={}", enc_k, enc_v));
    }
    let dummy_url = format!("walite-action://{}?{}", action, query);
    if let Ok(parsed) = Url::parse(&dummy_url) {
        handle_walite_action(&app, &parsed);
    }
}

#[cfg(target_os = "windows")]
fn init_windows_app_identity() {
    use std::os::windows::ffi::OsStrExt;
    const APP_ID: &str = "id.my.vianto06.walite";
    let wide_id: Vec<u16> = std::ffi::OsStr::new(APP_ID).encode_wide().chain(Some(0)).collect();
    unsafe {
        #[link(name = "shell32")]
        extern "system" {
            fn SetCurrentProcessExplicitAppUserModelID(AppID: *const u16) -> i32;
            fn SHChangeNotify(wEventId: i32, uFlags: u32, dwItem1: *const std::ffi::c_void, dwItem2: *const std::ffi::c_void);
        }
        let _ = SetCurrentProcessExplicitAppUserModelID(wide_id.as_ptr());
        const SHCNE_ASSOCCHANGED: i32 = 0x08000000;
        const SHCNF_IDLIST: u32 = 0x0000;
        SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, std::ptr::null(), std::ptr::null());
    }
}

fn main() {
    #[cfg(target_os = "windows")]
    {
        std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", BROWSER_ARGS);
        init_windows_app_identity();
    }

    #[cfg(target_os = "linux")]
    {
        // Expose SharedArrayBuffer in the webview. WhatsApp Web's Chrome codepath
        // runs its wasm media/crypto workers on SharedArrayBuffer. Distro WebKitGTK ships it
        // OFF by default, causing media/crypto processing to hang or fail.
        if std::env::var_os("JSC_useSharedArrayBuffer").is_none() {
            std::env::set_var("JSC_useSharedArrayBuffer", "1");
        }
        // Keep UI GPU compositing enabled across all Linux hardware (Intel, AMD, NVIDIA).
        // Leaving GPU compositing enabled ensures 60-144 FPS smooth scrolling, zero typing lag,
        // and low CPU utilization.
        // Disable GStreamer GL & DMA-BUF video sinks to prevent uninitialized EGL/GBM YUV textures
        // (which cause solid green video cards and playback failures on NVIDIA drivers).
        // The Cairo video sink renders video frames directly to standard system memory surfaces with
        // 100% color accuracy, zero green artifacts, and continuous audio/video playback.
        if std::env::var("WEBKIT_GST_DISABLE_GL_SINK").is_err() {
            std::env::set_var("WEBKIT_GST_DISABLE_GL_SINK", "1");
        }
        if std::env::var("WEBKIT_GST_DMABUF_SINK_DISABLED").is_err() {
            std::env::set_var("WEBKIT_GST_DMABUF_SINK_DISABLED", "1");
        }
        if std::env::var("GST_GL_DISABLE").is_err() {
            std::env::set_var("GST_GL_DISABLE", "1");
        }
        if std::env::var("__NV_DISABLE_EXPLICIT_SYNC").is_err() {
            std::env::set_var("__NV_DISABLE_EXPLICIT_SYNC", "1");
        }
        // Enable WebKitGTK Web Inspector remote debugging on localhost:9222
        if std::env::var("WEBKIT_INSPECTOR_SERVER").is_err() {
            std::env::set_var("WEBKIT_INSPECTOR_SERVER", "127.0.0.1:9222");
        }
        // Enable NVIDIA NVDEC hardware decoders (nvh264dec, nvh265dec) with rank 260.
        // NVDEC decodes H.264/H.265 directly with dedicated GPU ASICs (0% CPU, high FPS, full PPS/B-frame support).
        // With GL sinks disabled, NVDEC outputs directly to standard system memory surfaces (video/x-raw NV12),
        // completely avoiding green screen artifacts while avoiding avdec_h264's PPS errors.
        // Disable Vulkan & VA-API decoders to prevent VulkanImage memory mismatches and NVIDIA VA-API conflicts.
        if std::env::var("GST_VAAPI_ALL_DRIVERS_DISABLE").is_err() {
            std::env::set_var("GST_VAAPI_ALL_DRIVERS_DISABLE", "1");
        }
        std::env::set_var(
            "GST_PLUGIN_FEATURE_RANK",
            "glupload:NONE,glcolorconvert:NONE,glimagesink:NONE,glimagesinkelement:NONE,\
             glsinkbin:NONE,qmlglsink:NONE,\
             nvh264dec:260,nvh265dec:260,nvvp8dec:NONE,nvvp9dec:NONE,nvav1dec:NONE,\
             nvjpegdec:NONE,nvmpeg4videodec:NONE,nvmpeg2videodec:NONE,nvmpegvideodec:NONE,\
             vulkanh264dec:NONE,vulkanh265dec:NONE,vulkanvp9dec:NONE,vulkanav1dec:NONE,\
             vaapih264dec:NONE,vaapih265dec:NONE,vaapivp8dec:NONE,vaapivp9dec:NONE,\
             openh264dec:NONE,openh264enc:NONE,\
             h264parse:258,fdkaacdec:256,faad:200,avdec_aac:64,avdec_aac_fixed:64,avdec_aac_latm:64",
        );

        // Quiet GStreamer scanner warnings (level 1 = errors only) to keep terminal output clean
        if std::env::var("GST_DEBUG").is_err() {
            std::env::set_var("GST_DEBUG", "1");
        }

        // GStreamer plugin discovery for Linux (AppImage & Native):
        // Ensure GStreamer discovers host plugins properly. In AppImage, linuxdeploy's AppRun.wrapped
        // hardcodes GST_PLUGIN_SYSTEM_PATH_1_0 to $APPDIR/usr/lib/gstreamer-1.0 (which does not exist in AppImage).
        // We MUST unconditionally override it with existing host plugin paths; otherwise GStreamer fails to find
        // essential elements (appsrc, appsink, autoaudiosink), causing WebKitWebProcess to freeze/crash on chat opening or media.
        // We canonicalize paths so symlinks like /usr/lib64 -> /usr/lib don't cause duplicate scanning.
        let plugin_dirs = [
            "/usr/lib/gstreamer-1.0",
            "/usr/lib/x86_64-linux-gnu/gstreamer-1.0",
            "/usr/lib64/gstreamer-1.0",
            "/usr/local/lib/gstreamer-1.0",
            "/usr/local/lib/x86_64-linux-gnu/gstreamer-1.0",
            "/usr/local/lib64/gstreamer-1.0",
        ];
        let mut found_dirs: Vec<PathBuf> = Vec::new();
        for d in plugin_dirs {
            let p = std::path::Path::new(d);
            if p.is_dir() {
                if let Ok(canon) = p.canonicalize() {
                    if !found_dirs.contains(&canon) {
                        found_dirs.push(canon);
                    }
                }
            }
        }
        if !found_dirs.is_empty() {
            let path_str = found_dirs
                .iter()
                .filter_map(|p| p.to_str())
                .collect::<Vec<_>>()
                .join(":");
            std::env::set_var("GST_PLUGIN_SYSTEM_PATH_1_0", &path_str);
            std::env::set_var("GST_PLUGIN_PATH_1_0", &path_str);
        }

        let scanners = [
            "/usr/lib/gstreamer-1.0/gst-plugin-scanner",
            "/usr/lib/x86_64-linux-gnu/gstreamer1.0/gstreamer-1.0/gst-plugin-scanner",
            "/usr/lib/x86_64-linux-gnu/gstreamer-1.0/gst-plugin-scanner",
            "/usr/libexec/gstreamer-1.0/gst-plugin-scanner",
            "/usr/lib64/gstreamer-1.0/gst-plugin-scanner",
        ];
        for s in scanners {
            if std::path::Path::new(s).exists() {
                std::env::set_var("GST_PLUGIN_SCANNER", s);
                break;
            }
        }

        // AppImage compatibility: When running inside an AppImage on rolling/modern distros
        // (Arch, Fedora, openSUSE), AppImage bundles older libraries (like liblzma from Ubuntu 22.04).
        // Sanitize LD_LIBRARY_PATH for child processes (WebKitWebProcess, gst-plugin-scanner) so
        // they link against modern host libraries without version symbol conflicts.
        if let Ok(appdir) = std::env::var("APPDIR") {
            if let Ok(ld_path) = std::env::var("LD_LIBRARY_PATH") {
                let filtered: Vec<&str> = ld_path
                    .split(':')
                    .filter(|p| !p.is_empty() && !p.starts_with(&appdir))
                    .collect();
                if filtered.is_empty() {
                    std::env::remove_var("LD_LIBRARY_PATH");
                } else {
                    std::env::set_var("LD_LIBRARY_PATH", filtered.join(":"));
                }
            }
        }
    }

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![walite_action])
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .on_permission_request(|webview, kind| {
            if let Ok(url) = webview.url() {
                if is_allowed_internal_url(&url) {
                    match kind {
                        PermissionKind::Notifications
                        | PermissionKind::Microphone
                        | PermissionKind::Camera
                        | PermissionKind::Autoplay => PermissionResponse::Allow,
                        _ => PermissionResponse::Default,
                    }
                } else {
                    PermissionResponse::Deny
                }
            } else {
                PermissionResponse::Deny
            }
        })
        .setup(|app| {
            let data_dir = get_persistent_data_dir();
            let _ = std::fs::create_dir_all(&data_dir);

            let main_url = TARGET_URL.parse().expect("valid target url");
            let app_handle = app.handle().clone();

            let mut builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(main_url))
                .title("WaLite")
                .inner_size(1024.0, 768.0)
                .min_inner_size(680.0, 500.0)
                .data_directory(data_dir)
                .additional_browser_args(BROWSER_ARGS)
                .disable_drag_drop_handler()
                .initialization_script(include_str!("../wa-privacy-panel.js"))
                .initialization_script(include_str!("../wa-download-manager.js"));

            #[cfg(target_os = "windows")]
            {
                builder = builder.drag_and_drop(false);
            }

            #[cfg(target_os = "linux")]
            {
                // Deliver standard Google Chrome on Linux User Agent matching modern Chrome releases.
                // This causes WhatsApp Web to serve standard web media (H.264/AAC MP4 & WebM)
                // matching Linux web capabilities.
                builder = builder.user_agent(
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
                );
            }

            #[cfg(target_os = "windows")]
            {
                let _ = std::process::Command::new("ie4uinit.exe")
                    .arg("-show")
                    .spawn();
            }

            #[cfg(target_os = "windows")]
            let app_icon = tauri::image::Image::from_app_icon_resource(128)
                .or_else(|_| tauri::image::Image::from_app_icon_resource(32))
                .ok();
            #[cfg(not(target_os = "windows"))]
            let app_icon: Option<tauri::image::Image<'static>> = None;

            let final_icon = app_icon.as_ref().or_else(|| app.default_window_icon());

            if let Some(icon) = final_icon {
                builder = builder.icon(icon.clone())?;
            }

            // Enable Web Inspector & DevTools (right-click Inspect Element)
            builder = builder.devtools(true);

            // Navigation handler: keep Walite on WhatsApp Web, open external links in browser.
            // On Linux, navigation policy and full autoplay permissions are managed directly via
            // WebKitGTK's decide-policy signal in `with_webview` to avoid Wry overriding autoplay policies.
            #[cfg(not(target_os = "linux"))]
            {
                let app_nav = app_handle.clone();
                builder = builder.on_navigation(move |url| {
                    if url.scheme() == "walite-action" {
                        handle_walite_action(&app_nav, url);
                        return false;
                    }
                    let url_str = url.as_str();
                    if is_allowed_internal_url(&url) {
                        true
                    } else {
                        if is_safe_external_scheme(url.scheme()) {
                            open_in_default_browser(url_str);
                        }
                        false
                    }
                });
            }

            // New window handler (e.g. target="_blank", window.open)
            builder = builder.on_new_window(move |url, _features| {
                let url_str = url.as_str();
                if url_str == "about:blank" || url_str.is_empty() {
                    return NewWindowResponse::Deny;
                }
                if url.scheme() == "blob" || url.scheme() == "data" {
                    return NewWindowResponse::Allow;
                }
                if is_allowed_internal_url(&url) {
                    // Internal WhatsApp frames, Flows cache, and PDF viewer should NOT spawn external browser
                    return NewWindowResponse::Deny;
                }
                if is_safe_external_scheme(url.scheme()) {
                    open_in_default_browser(url_str);
                }
                NewWindowResponse::Deny
            });

            // Download handler: save to user's download folder
            let app_handle_dl = app_handle.clone();
            builder = builder.on_download(move |_webview, event| {
                match event {
                    DownloadEvent::Requested { url, destination } => {
                        if let Ok(dl_dir) = app_handle_dl.path().download_dir() {
                            let file_name = destination
                                .file_name()
                                .and_then(|n| n.to_str())
                                .filter(|s| !s.is_empty())
                                .map(|s| s.to_string())
                                .unwrap_or_else(|| {
                                    url.path_segments()
                                        .and_then(|mut s| s.next_back())
                                        .filter(|s| !s.is_empty() && s.contains('.'))
                                        .map(|s| s.to_string())
                                        .unwrap_or_else(|| {
                                            let now = std::time::SystemTime::now()
                                                .duration_since(std::time::UNIX_EPOCH)
                                                .unwrap_or_default()
                                                .as_secs();
                                            format!("walite_download_{}.bin", now)
                                        })
                                });
                            *destination = get_unique_download_path(&dl_dir, &file_name);
                        }
                        true
                    }
                    DownloadEvent::Finished { .. } => true,
                    _ => true,
                }
            });

            let window = builder.build()?;
            let _ = window.show();

            // Build secondary toast window for interactive Quick-Reply notifications
            let toast_url = WebviewUrl::App("toast.html".into());
            let mut toast_builder = WebviewWindowBuilder::new(app, "toast", toast_url)
                .title("WaLite Notification")
                .inner_size(380.0, 135.0)
                .resizable(false)
                .decorations(false)
                .transparent(true)
                .always_on_top(true)
                .skip_taskbar(true)
                .visible(false);

            #[cfg(target_os = "windows")]
            {
                toast_builder = toast_builder.drag_and_drop(false);
            }

            let toast_app_nav = app_handle.clone();
            toast_builder = toast_builder.on_navigation(move |url| {
                if url.scheme() == "walite-action" {
                    handle_walite_action(&toast_app_nav, url);
                    return false;
                }
                false
            });

            let _toast_win = toast_builder.build()?;

            #[cfg(target_os = "linux")]
            {
                use webkit2gtk::glib::Cast;
                use webkit2gtk::*;
                let app_handle_linux = app_handle.clone();
                let _ = window.with_webview(move |webview| {
                    let inner = webview.inner();
                    if let Some(settings) = inner.settings() {
                        settings.set_media_playback_requires_user_gesture(false);
                        // Enable MediaSource (MSE) so WhatsApp Web modern status features (audio notes,
                        // music, stickers, video) pass client capability checks without showing
                        // "Anda telah menerima status, tetapi versi WhatsApp Anda tidak mendukungnya".
                        settings.set_enable_mediasource(true);
                        settings.set_enable_webaudio(true);
                        settings.set_enable_webgl(true);
                        settings.set_enable_media_stream(true);
                        settings.set_enable_media_capabilities(true);
                        settings.set_enable_encrypted_media(true);
                        settings.set_enable_webrtc(true);
                        // Disable site-specific quirks so WebKitGTK doesn't override Chrome UA with an ancient Safari UA
                        settings.set_enable_site_specific_quirks(false);
                    }

                    // Enforce AutoplayPolicy::Allow on ALL navigations so video and status audio
                    // are never muted by WebKitGTK's default ALLOW_WITHOUT_SOUND policy.
                    // Also handles internal navigation and routes external links to host browser.
                    inner.connect_decide_policy(move |_wv, decision, decision_type| {
                        if decision_type == PolicyDecisionType::NavigationAction {
                            if let Some(policy) = decision.dynamic_cast_ref::<NavigationPolicyDecision>() {
                                if let Some(nav_action) = policy.navigation_action() {
                                    if let Some(uri_req) = nav_action.request() {
                                        if let Some(uri) = uri_req.uri() {
                                            let uri_str = uri.as_str();
                                            if let Ok(parsed_url) = Url::parse(uri_str) {
                                                if parsed_url.scheme() == "walite-action" {
                                                    handle_walite_action(&app_handle_linux, &parsed_url);
                                                    decision.ignore();
                                                    return true;
                                                }
                                                if is_allowed_internal_url(&parsed_url) {
                                                    let policies = WebsitePolicies::builder()
                                                        .autoplay(AutoplayPolicy::Allow)
                                                        .build();
                                                    decision.use_with_policies(&policies);
                                                    return true;
                                                } else {
                                                    decision.ignore();
                                                    if is_safe_external_scheme(parsed_url.scheme()) {
                                                        open_in_default_browser(uri_str);
                                                    }
                                                    return true;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            let policies = WebsitePolicies::builder()
                                .autoplay(AutoplayPolicy::Allow)
                                .build();
                            decision.use_with_policies(&policies);
                            return true;
                        }
                        false
                    });
                });
            }

            if let Some(icon) = final_icon {
                let _ = window.set_icon(icon.clone());
            }

            #[cfg(target_os = "windows")]
            if let Ok(hwnd) = window.hwnd() {
                unsafe {
                    #[link(name = "user32")]
                    extern "system" {
                        fn GetModuleHandleW(lpModuleName: *const u16) -> isize;
                        fn LoadIconW(hInstance: isize, lpIconName: *const u16) -> isize;
                        fn SendMessageW(hWnd: *mut std::ffi::c_void, Msg: u32, wParam: usize, lParam: isize) -> isize;
                        fn ChangeWindowMessageFilterEx(
                            hWnd: *mut std::ffi::c_void,
                            message: u32,
                            action: u32,
                            pChangeFilterStruct: *mut std::ffi::c_void,
                        ) -> i32;
                    }
                    let h_instance = GetModuleHandleW(std::ptr::null());
                    // 32512 is IDI_APPLICATION used by winres/tauri-build
                    let mut h_icon = LoadIconW(h_instance, 32512 as *const u16);
                    if h_icon == 0 {
                        h_icon = LoadIconW(h_instance, 1 as *const u16);
                    }
                    if h_icon != 0 {
                        const WM_SETICON: u32 = 0x0080;
                        const ICON_SMALL: usize = 0;
                        const ICON_BIG: usize = 1;
                        SendMessageW(hwnd.0, WM_SETICON, ICON_BIG, h_icon);
                        SendMessageW(hwnd.0, WM_SETICON, ICON_SMALL, h_icon);
                    }

                    // Ensure Windows Explorer drag-and-drop messages bypass any UIPI restrictions
                    const WM_DROPFILES: u32 = 0x0233;
                    const WM_COPYDATA: u32 = 0x004A;
                    const WM_COPYGLOBALDATA: u32 = 0x0049;
                    const MSGFLT_ALLOW: u32 = 1;
                    let _ = ChangeWindowMessageFilterEx(hwnd.0, WM_DROPFILES, MSGFLT_ALLOW, std::ptr::null_mut());
                    let _ = ChangeWindowMessageFilterEx(hwnd.0, WM_COPYDATA, MSGFLT_ALLOW, std::ptr::null_mut());
                    let _ = ChangeWindowMessageFilterEx(hwnd.0, WM_COPYGLOBALDATA, MSGFLT_ALLOW, std::ptr::null_mut());
                }
            }

            // System tray setup
            let open_item = MenuItem::with_id(app, "open", "Buka WaLite", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Keluar", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&open_item, &quit_item])?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                });

            if let Some(icon) = final_icon {
                tray_builder = tray_builder.icon(icon.clone());
            }

            tray_builder.build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running WaLite application");
}
