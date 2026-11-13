#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    webview::{DownloadEvent, NewWindowResponse, PermissionKind, PermissionResponse},
    Manager, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_opener::OpenerExt;

const TARGET_URL: &str = "https://web.whatsapp.com";
const BROWSER_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,Translate,HideCursorWhileTyping \
    --disable-background-networking \
    --disable-default-apps \
    --disable-extensions \
    --disable-sync \
    --no-first-run \
    --renderer-process-limit=2 \
    --disable-background-timer-throttling \
    --disable-renderer-backgrounding \
    --disable-backgrounding-occluded-windows";

fn get_persistent_data_dir() -> PathBuf {
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

fn is_safe_external_scheme(scheme: &str) -> bool {
    matches!(scheme, "http" | "https" | "mailto" | "tel")
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

fn main() {
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
                .title("Walite")
                .inner_size(1024.0, 768.0)
                .min_inner_size(680.0, 500.0)
                .data_directory(data_dir)
                .additional_browser_args(BROWSER_ARGS)
                .disable_drag_drop_handler()
                .drag_and_drop(true)
                .initialization_script(include_str!("../wa-privacy-panel.js"))
                .initialization_script(include_str!("../wa-download-manager.js"));

            #[cfg(target_os = "windows")]
            {
                let _ = std::process::Command::new("ie4uinit.exe")
                    .arg("-show")
                    .spawn();
            }

            if let Some(icon) = app.default_window_icon() {
                builder = builder.icon(icon.clone())?;
            }

            #[cfg(not(debug_assertions))]
            {
                builder = builder.devtools(false);
            }

            // Navigation handler
            let app_handle_nav = app_handle.clone();
            builder = builder.on_navigation(move |url| {
                if is_allowed_internal_url(url) {
                    true
                } else {
                    if is_safe_external_scheme(url.scheme()) {
                        let _ = app_handle_nav.opener().open_url(url.as_str(), None::<&str>);
                    }
                    false
                }
            });

            // New window handler (e.g. window.open, target="_blank")
            let app_handle_window = app_handle.clone();
            builder = builder.on_new_window(move |url, _features| {
                if is_allowed_internal_url(&url) {
                    return NewWindowResponse::Allow;
                }
                if is_safe_external_scheme(url.scheme()) {
                    let _ = app_handle_window.opener().open_url(url.as_str(), None::<&str>);
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

            // System tray setup
            let open_item = MenuItem::with_id(app, "open", "Buka Walite", true, None::<&str>)?;
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

            if let Some(icon) = app.default_window_icon() {
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
        .expect("error while running Walite application");
}
