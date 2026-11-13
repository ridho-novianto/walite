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

    tauri::Builder::default()
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
                        | PermissionKind::Camera => PermissionResponse::Allow,
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

            #[cfg(not(debug_assertions))]
            {
                builder = builder.devtools(false);
            }

            // Navigation handler: keep Walite on WhatsApp Web, open external links in browser
            builder = builder.on_navigation(move |url| {
                let url_str = url.as_str();
                let is_internal_app = url_str == "about:blank" || {
                    if url.scheme() == "https" {
                        url.host_str() == Some("web.whatsapp.com")
                    } else {
                        false
                    }
                };

                if is_internal_app {
                    true
                } else {
                    if is_safe_external_scheme(url.scheme()) {
                        open_in_default_browser(url_str);
                    }
                    false
                }
            });

            // New window handler (e.g. target="_blank", window.open)
            builder = builder.on_new_window(move |url, _features| {
                let url_str = url.as_str();
                if url_str == "about:blank" || url_str.is_empty() {
                    return NewWindowResponse::Deny;
                }
                if url.scheme() == "blob" || url.scheme() == "data" {
                    return NewWindowResponse::Allow;
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
