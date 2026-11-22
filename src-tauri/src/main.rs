#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    webview::{DownloadEvent, NewWindowResponse, PermissionKind, PermissionResponse},
    Manager, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

static ALWAYS_ASK_SAVE_AS: AtomicBool = AtomicBool::new(false);
static SHOW_DOWNLOAD_NOTIF: AtomicBool = AtomicBool::new(true);
static LAST_SAVE_DIR: Mutex<Option<PathBuf>> = Mutex::new(None);
static LAST_CHOSEN_DOWNLOAD_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);
static LAST_ACTION_STAMP: Mutex<Option<(String, std::time::Instant)>> = Mutex::new(None);
static IS_CALL_ACTIVE: AtomicBool = AtomicBool::new(false);
static IS_PIP_MODE: AtomicBool = AtomicBool::new(false);
static SAVED_NORMAL_SIZE: Mutex<Option<(f64, f64)>> = Mutex::new(None);
static SAVED_NORMAL_POS: Mutex<Option<(i32, i32)>> = Mutex::new(None);

const TARGET_URL: &str = "https://web.whatsapp.com";
const BROWSER_ARGS: &str = "--disable-features=Translate,HideCursorWhileTyping,msSmartScreenProtection \
    --no-first-run \
    --disable-background-timer-throttling \
    --disable-renderer-backgrounding \
    --disable-backgrounding-occluded-windows";

#[cfg(target_os = "windows")]
#[repr(C)]
#[allow(non_snake_case)]
struct OPENFILENAMEW {
    lStructSize: u32,
    hwndOwner: *mut std::ffi::c_void,
    hInstance: *mut std::ffi::c_void,
    lpstrFilter: *const u16,
    lpstrCustomFilter: *mut u16,
    nMaxCustFilter: u32,
    nFilterIndex: u32,
    lpstrFile: *mut u16,
    nMaxFile: u32,
    lpstrFileTitle: *mut u16,
    nMaxFileTitle: u32,
    lpstrInitialDir: *const u16,
    lpstrTitle: *const u16,
    Flags: u32,
    nFileOffset: u16,
    nFileExtension: u16,
    lpstrDefExt: *const u16,
    lCustData: isize,
    lpfnHook: *mut std::ffi::c_void,
    lpTemplateName: *const u16,
    pvReserved: *mut std::ffi::c_void,
    dwReserved: u32,
    FlagsEx: u32,
}

#[cfg(target_os = "windows")]
fn show_windows_save_dialog(
    hwnd_owner: *mut std::ffi::c_void,
    default_dir: &std::path::Path,
    default_filename: &str,
) -> Option<PathBuf> {
    use std::os::windows::ffi::OsStrExt;

    #[link(name = "comdlg32")]
    extern "system" {
        fn GetSaveFileNameW(lpofn: *mut OPENFILENAMEW) -> i32;
    }

    const OFN_OVERWRITEPROMPT: u32 = 0x00000002;
    const OFN_PATHMUSTEXIST: u32 = 0x00000800;
    const OFN_EXPLORER: u32 = 0x00080000;
    const OFN_ENABLESIZING: u32 = 0x00800000;
    const OFN_NOCHANGEDIR: u32 = 0x00000008;

    let mut file_buf = vec![0u16; 1024];
    let default_name_wide: Vec<u16> = std::ffi::OsStr::new(default_filename)
        .encode_wide()
        .collect();
    let copy_len = default_name_wide.len().min(file_buf.len() - 1);
    file_buf[..copy_len].copy_from_slice(&default_name_wide[..copy_len]);

    let ext_opt = std::path::Path::new(default_filename)
        .extension()
        .and_then(|e| e.to_str());

    let filter_wide = if let Some(ext) = ext_opt {
        let part1 = format!("{} File (*.{})", ext.to_uppercase(), ext);
        let part2 = format!("*.{}", ext);
        let part3 = "All Files (*.*)";
        let part4 = "*.*";
        let mut f: Vec<u16> = Vec::new();
        f.extend(part1.encode_utf16());
        f.push(0);
        f.extend(part2.encode_utf16());
        f.push(0);
        f.extend(part3.encode_utf16());
        f.push(0);
        f.extend(part4.encode_utf16());
        f.push(0);
        f.push(0);
        f
    } else {
        let mut f: Vec<u16> = Vec::new();
        f.extend("All Files (*.*)".encode_utf16());
        f.push(0);
        f.extend("*.*".encode_utf16());
        f.push(0);
        f.push(0);
        f
    };

    let title = "Simpan Berkas Sebagai...\0";
    let title_wide: Vec<u16> = title.encode_utf16().collect();

    let mut init_dir_wide: Vec<u16> = default_dir.as_os_str().encode_wide().collect();
    init_dir_wide.push(0);

    let def_ext_wide: Option<Vec<u16>> = ext_opt.map(|e| {
        let mut v: Vec<u16> = std::ffi::OsStr::new(e).encode_wide().collect();
        v.push(0);
        v
    });

    let mut ofn: OPENFILENAMEW = unsafe { std::mem::zeroed() };
    ofn.lStructSize = std::mem::size_of::<OPENFILENAMEW>() as u32;
    ofn.hwndOwner = hwnd_owner;
    ofn.lpstrFilter = filter_wide.as_ptr();
    ofn.nFilterIndex = 1;
    ofn.lpstrFile = file_buf.as_mut_ptr();
    ofn.nMaxFile = file_buf.len() as u32;
    ofn.lpstrInitialDir = init_dir_wide.as_ptr();
    ofn.lpstrTitle = title_wide.as_ptr();
    ofn.lpstrDefExt = def_ext_wide.as_ref().map(|v| v.as_ptr()).unwrap_or(std::ptr::null());
    ofn.Flags = OFN_EXPLORER
        | OFN_OVERWRITEPROMPT
        | OFN_PATHMUSTEXIST
        | OFN_ENABLESIZING
        | OFN_NOCHANGEDIR;

    let success = unsafe { GetSaveFileNameW(&mut ofn) };
    if success != 0 {
        use std::os::windows::ffi::OsStringExt;
        let len = file_buf.iter().position(|&c| c == 0).unwrap_or(file_buf.len());
        let os_str = std::ffi::OsString::from_wide(&file_buf[..len]);
        Some(PathBuf::from(os_str))
    } else {
        None
    }
}

fn open_folder_and_select(path_str: &str) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::ffi::OsStrExt;
        let arg = format!("/select,\"{}\"", path_str);
        let wide_arg: Vec<u16> = std::ffi::OsStr::new(&arg).encode_wide().chain(Some(0)).collect();
        let wide_explorer: Vec<u16> = std::ffi::OsStr::new("explorer.exe").encode_wide().chain(Some(0)).collect();
        unsafe {
            #[link(name = "shell32")]
            extern "system" {
                fn ShellExecuteW(
                    hwnd: *mut std::ffi::c_void,
                    lpOperation: *const u16,
                    lpFile: *const u16,
                    lpParameters: *const u16,
                    lpDirectory: *const u16,
                    nShowCmd: i32,
                ) -> isize;
            }
            const SW_SHOWNORMAL: i32 = 1;
            ShellExecuteW(
                std::ptr::null_mut(),
                std::ptr::null(),
                wide_explorer.as_ptr(),
                wide_arg.as_ptr(),
                std::ptr::null(),
                SW_SHOWNORMAL,
            );
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Some(parent) = std::path::Path::new(path_str).parent() {
            open_file_with_default_app(&parent.to_string_lossy());
        }
    }
}

fn show_download_finished_toast(_app: &tauri::AppHandle, path: &std::path::Path) {
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Berkas");
    let path_clone = path.to_path_buf();

    #[cfg(target_os = "windows")]
    {
        use tauri_winrt_notification::Toast;
        const APP_ID: &str = "id.my.vianto06.walite";
        let mut toast = Toast::new(APP_ID);
        toast = toast.title("Unduhan Selesai");
        toast = toast.text1(file_name);
        toast = toast.add_button("Buka Berkas", "open_file");
        toast = toast.add_button("Buka Folder", "open_folder");

        let p1 = path_clone.clone();
        toast = toast.on_activated(move |action| {
            let path_str = p1.to_string_lossy().to_string();
            match action.as_deref() {
                Some("open_folder") => {
                    open_folder_and_select(&path_str);
                }
                _ => {
                    open_file_with_default_app(&path_str);
                }
            }
            Ok(())
        });

        if toast.show().is_err() {
            let p2 = path_clone.clone();
            let mut fb = Toast::new(Toast::POWERSHELL_APP_ID);
            fb = fb.title("Unduhan Selesai");
            fb = fb.text1(file_name);
            fb = fb.add_button("Buka Berkas", "open_file");
            fb = fb.add_button("Buka Folder", "open_folder");
            fb = fb.on_activated(move |action| {
                let path_str = p2.to_string_lossy().to_string();
                match action.as_deref() {
                    Some("open_folder") => {
                        open_folder_and_select(&path_str);
                    }
                    _ => {
                        open_file_with_default_app(&path_str);
                    }
                }
                Ok(())
            });
            let _ = fb.show();
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        use tauri_plugin_notification::NotificationExt;
        let _ = _app.notification().builder()
            .title("Unduhan Selesai")
            .body(file_name)
            .show();
    }
}

fn show_native_message_notification(
    app: &tauri::AppHandle,
    title: &str,
    body: &str,
    tag: &str,
) {
    #[cfg(target_os = "windows")]
    {
        use winrt_toast_reborn::content::input::InputType;
        use winrt_toast_reborn::{
            Action, ActivatedAction, Input, Text, Toast, ToastManager,
        };
        const APP_ID: &str = "id.my.vianto06.walite";

        let app_handle = app.clone();
        let title_str = title.to_string();
        let tag_str = tag.to_string();

        let is_call = body.to_lowercase().contains("telepon")
            || body.to_lowercase().contains("panggilan")
            || body.to_lowercase().contains("call")
            || tag.to_lowercase().contains("call");

        let mut toast = Toast::new();
        toast
            .tag(tag)
            .launch("open")
            .text1(title)
            .text2(Text::new(body));

        if is_call {
            toast.scenario(winrt_toast_reborn::Scenario::IncomingCall);
            toast.action(Action::new("Jawab", "accept_call", ""));
            toast.action(Action::new("Tolak", "decline_call", ""));
        } else {
            toast.input(
                Input::new("replyBox", InputType::Text)
                    .with_placeholder("Ketik balasan cepat...")
            );
            toast.action(
                Action::new("Kirim", "reply", "").with_input_id("replyBox")
            );
            toast.action(
                Action::new("Buka Chat", "open", "")
            );
        }

        let manager = ToastManager::new(APP_ID);
        let res = manager
            .on_activated(Some("replyBox"), move |action: Option<ActivatedAction>| {
                if let Some(ref act) = action {
                    if act.arg == "accept_call" {
                        if let Some(main_win) = app_handle.get_webview_window("main") {
                            let _ = main_win.show();
                            let _ = main_win.unminimize();
                            let _ = main_win.set_focus();
                            let js = "if(typeof window.__walite_accept_call==='function') window.__walite_accept_call();";
                            let _ = main_win.eval(js);
                        }
                        return;
                    }
                    if act.arg == "decline_call" {
                        if let Some(main_win) = app_handle.get_webview_window("main") {
                            let js = "if(typeof window.__walite_decline_call==='function') window.__walite_decline_call();";
                            let _ = main_win.eval(js);
                        }
                        return;
                    }
                }

                let mut is_reply = false;
                let mut reply_text = String::new();

                if let Some(ref act) = action {
                    if let Some(text) = act.values.get("replyBox") {
                        let trimmed = text.trim();
                        if !trimmed.is_empty() {
                            is_reply = true;
                            reply_text = trimmed.to_string();
                        }
                    }
                }

                if is_reply {
                    if let Some(main_win) = app_handle.get_webview_window("main") {
                        let js = format!(
                            "if(typeof window.__walite_send_inline_reply==='function') window.__walite_send_inline_reply('{}','{}','{}');",
                            escape_js_str(&title_str),
                            escape_js_str(&tag_str),
                            escape_js_str(&reply_text)
                        );
                        let _ = main_win.eval(&js);
                    }
                } else {
                    if let Some(main_win) = app_handle.get_webview_window("main") {
                        let _ = main_win.show();
                        let _ = main_win.unminimize();
                        let _ = main_win.set_focus();

                        #[cfg(target_os = "windows")]
                        if let Ok(hwnd) = main_win.hwnd() {
                            unsafe {
                                #[link(name = "user32")]
                                extern "system" {
                                    fn ShowWindow(hWnd: *mut std::ffi::c_void, nCmdShow: i32) -> i32;
                                    fn SetForegroundWindow(hWnd: *mut std::ffi::c_void) -> i32;
                                    fn BringWindowToTop(hWnd: *mut std::ffi::c_void) -> i32;
                                }
                                const SW_RESTORE: i32 = 9;
                                ShowWindow(hwnd.0, SW_RESTORE);
                                BringWindowToTop(hwnd.0);
                                SetForegroundWindow(hwnd.0);
                            }
                        }

                        let js = format!(
                            "if(typeof window.__walite_on_notif_click==='function') window.__walite_on_notif_click('{}','{}');",
                            escape_js_str(&title_str),
                            escape_js_str(&tag_str)
                        );
                        let _ = main_win.eval(&js);
                    }
                }
            })
            .show(&toast);

        if res.is_err() {
            let app_handle_fb = app.clone();
            let title_fb = title.to_string();
            let tag_fb = tag.to_string();
            let manager_fb = ToastManager::new(ToastManager::POWERSHELL_AUM_ID);
            let _ = manager_fb
                .on_activated(Some("replyBox"), move |action: Option<ActivatedAction>| {
                    if let Some(ref act) = action {
                        if act.arg == "accept_call" {
                            if let Some(main_win) = app_handle_fb.get_webview_window("main") {
                                let _ = main_win.show();
                                let _ = main_win.unminimize();
                                let _ = main_win.set_focus();
                                let js = "if(typeof window.__walite_accept_call==='function') window.__walite_accept_call();";
                                let _ = main_win.eval(js);
                            }
                            return;
                        }
                        if act.arg == "decline_call" {
                            if let Some(main_win) = app_handle_fb.get_webview_window("main") {
                                let js = "if(typeof window.__walite_decline_call==='function') window.__walite_decline_call();";
                                let _ = main_win.eval(js);
                            }
                            return;
                        }
                    }

                    let mut is_reply = false;
                    let mut reply_text = String::new();

                    if let Some(ref act) = action {
                        if let Some(text) = act.values.get("replyBox") {
                            let trimmed = text.trim();
                            if !trimmed.is_empty() {
                                is_reply = true;
                                reply_text = trimmed.to_string();
                            }
                        }
                    }

                    if is_reply {
                        if let Some(main_win) = app_handle_fb.get_webview_window("main") {
                            let js = format!(
                                "if(typeof window.__walite_send_inline_reply==='function') window.__walite_send_inline_reply('{}','{}','{}');",
                                escape_js_str(&title_fb),
                                escape_js_str(&tag_fb),
                                escape_js_str(&reply_text)
                            );
                            let _ = main_win.eval(&js);
                        }
                    } else {
                        if let Some(main_win) = app_handle_fb.get_webview_window("main") {
                            let _ = main_win.show();
                            let _ = main_win.unminimize();
                            let _ = main_win.set_focus();

                            #[cfg(target_os = "windows")]
                            if let Ok(hwnd) = main_win.hwnd() {
                                unsafe {
                                    #[link(name = "user32")]
                                    extern "system" {
                                        fn ShowWindow(hWnd: *mut std::ffi::c_void, nCmdShow: i32) -> i32;
                                        fn SetForegroundWindow(hWnd: *mut std::ffi::c_void) -> i32;
                                        fn BringWindowToTop(hWnd: *mut std::ffi::c_void) -> i32;
                                    }
                                    const SW_RESTORE: i32 = 9;
                                    ShowWindow(hwnd.0, SW_RESTORE);
                                    BringWindowToTop(hwnd.0);
                                    SetForegroundWindow(hwnd.0);
                                }
                            }

                            let js = format!(
                                "if(typeof window.__walite_on_notif_click==='function') window.__walite_on_notif_click('{}','{}');",
                                escape_js_str(&title_fb),
                                escape_js_str(&tag_fb)
                            );
                            let _ = main_win.eval(&js);
                        }
                    }
                })
                .show(&toast);
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        use tauri_plugin_notification::NotificationExt;
        let _ = app.notification().builder()
            .title(title)
            .body(body)
            .show();
    }
}

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

fn open_file_with_default_app(path: &str) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::ffi::OsStrExt;
        let wide_path: Vec<u16> = std::ffi::OsStr::new(path).encode_wide().chain(Some(0)).collect();
        let wide_open: Vec<u16> = std::ffi::OsStr::new("open").encode_wide().chain(Some(0)).collect();
        unsafe {
            #[link(name = "shell32")]
            extern "system" {
                fn ShellExecuteW(
                    hwnd: *mut std::ffi::c_void,
                    lpOperation: *const u16,
                    lpFile: *const u16,
                    lpParameters: *const u16,
                    lpDirectory: *const u16,
                    nShowCmd: i32,
                ) -> isize;
            }
            const SW_SHOWNORMAL: i32 = 1;
            let ret = ShellExecuteW(
                std::ptr::null_mut(),
                wide_open.as_ptr(),
                wide_path.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                SW_SHOWNORMAL,
            );
            if ret <= 32 {
                use std::os::windows::process::CommandExt;
                const CREATE_NO_WINDOW: u32 = 0x08000000;
                let _ = std::process::Command::new("cmd")
                    .args(["/C", "start", "", path])
                    .creation_flags(CREATE_NO_WINDOW)
                    .spawn();
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::process::Command::new("xdg-open")
            .arg(path)
            .spawn();
    }
}

fn enter_pip_mode(window: &tauri::WebviewWindow) {
    if IS_PIP_MODE.load(Ordering::SeqCst) {
        return;
    }
    if let Ok(size) = window.inner_size() {
        let mut saved_size = SAVED_NORMAL_SIZE.lock().unwrap();
        *saved_size = Some((size.width as f64, size.height as f64));
    }
    if let Ok(pos) = window.outer_position() {
        let mut saved_pos = SAVED_NORMAL_POS.lock().unwrap();
        *saved_pos = Some((pos.x, pos.y));
    }
    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
        width: 340.0,
        height: 230.0,
    }));
    if let Ok(Some(monitor)) = window.primary_monitor() {
        let scale = monitor.scale_factor();
        let mon_size = monitor.size();
        let pip_w = (340.0 * scale) as i32;
        let pip_h = (230.0 * scale) as i32;
        let x = mon_size.width as i32 - pip_w - (20.0 * scale) as i32;
        let y = mon_size.height as i32 - pip_h - (60.0 * scale) as i32;
        let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
    }
    let _ = window.set_always_on_top(true);
    IS_PIP_MODE.store(true, Ordering::SeqCst);
}

fn restore_from_pip_mode(window: &tauri::WebviewWindow) {
    if !IS_PIP_MODE.load(Ordering::SeqCst) {
        return;
    }
    let _ = window.set_always_on_top(false);
    let size = SAVED_NORMAL_SIZE.lock().unwrap().unwrap_or((1024.0, 768.0));
    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
        width: size.0,
        height: size.1,
    }));
    if let Some(pos) = *SAVED_NORMAL_POS.lock().unwrap() {
        let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: pos.0,
            y: pos.1,
        }));
    }
    IS_PIP_MODE.store(false, Ordering::SeqCst);
}

fn is_allowed_internal_url(url: &Url) -> bool {
    let scheme = url.scheme();
    if scheme == "blob"
        || scheme == "data"
        || scheme == "about"
        || scheme == "chrome-extension"
        || scheme == "edge-extension"
        || scheme == "chrome"
        || scheme == "chrome-untrusted"
        || scheme == "edge"
        || scheme == "filesystem"
    {
        return true;
    }
    if scheme == "https" || scheme == "http" {
        if let Some(host) = url.host_str() {
            let h = host.to_lowercase();
            if h == "web.whatsapp.com"
                || h.ends_with(".whatsapp.com")
                || h.ends_with(".whatsapp.net")
                || h.ends_with(".fbcdn.net")
                || h.ends_with(".facebook.com")
                || h.ends_with(".meta.com")
                || h.ends_with(".adobe.com")
                || h.ends_with(".adobe.io")
                || h.ends_with(".acrobat.com")
                || h.ends_with(".adobelogin.com")
                || h.ends_with(".demdex.net")
                || h.ends_with(".typekit.net")
                || h.ends_with(".adobeaemcloud.com")
                || h.ends_with(".adobedtm.com")
                || h.ends_with(".adast.adobe.io")
                || h.ends_with(".adobecanvas.com")
                || h.ends_with(".documentcloud.adobe.com")
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

fn create_badge_icon(count: i64) -> Vec<u8> {
    const W: usize = 32;
    const H: usize = 32;
    let mut rgba = vec![0u8; W * H * 4];

    // Anti-aliased circle at center (15.5, 15.5) with radius 14.5
    for y in 0..H {
        for x in 0..W {
            let dx = (x as f32) - 15.5;
            let dy = (y as f32) - 15.5;
            let dist = (dx * dx + dy * dy).sqrt();
            let idx = (y * W + x) * 4;

            if dist <= 14.8 {
                let alpha = if dist > 13.8 {
                    ((14.8 - dist) * 255.0) as u8
                } else {
                    255
                };
                // WhatsApp vibrant badge green (#25D366 / #00a884)
                rgba[idx] = 0;       // R
                rgba[idx + 1] = 168; // G
                rgba[idx + 2] = 132; // B
                rgba[idx + 3] = alpha;
            }
        }
    }

    // 5x7 font (5 bits wide, 7 bits high)
    let font_5x7: [[u8; 7]; 10] = [
        [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110], // 0
        [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110], // 1
        [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111], // 2
        [0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110], // 3
        [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010], // 4
        [0b11111, 0b10000, 0b10000, 0b11110, 0b00001, 0b00001, 0b11110], // 5
        [0b01110, 0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110], // 6
        [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000], // 7
        [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110], // 8
        [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00001, 0b01110], // 9
    ];

    if count >= 1 && count <= 9 {
        let glyph = font_5x7[count as usize];
        // Center 5x7 scaled by 2 (10x14) in 32x32: offset_x = 11, offset_y = 9
        let offset_x = 11;
        let offset_y = 9;

        for (r, row) in glyph.iter().enumerate() {
            for c in 0..5 {
                if (row & (1 << (4 - c))) != 0 {
                    // Draw bold 2x2 pixels for each bit
                    for dy in 0..2 {
                        for dx in 0..2 {
                            let px = offset_x + c * 2 + dx;
                            let py = offset_y + r * 2 + dy;
                            if px < W && py < H {
                                let idx = (py * W + px) * 4;
                                rgba[idx] = 255;
                                rgba[idx + 1] = 255;
                                rgba[idx + 2] = 255;
                                rgba[idx + 3] = 255;
                            }
                        }
                    }
                }
            }
        }
    } else if count > 9 {
        // Draw "9+" in 32x32
        // '9' using 4x7 at x=6, '+' at x=18
        let glyph9_4x7: [u8; 7] = [
            0b1110,
            0b1001,
            0b1001,
            0b1111,
            0b0001,
            0b0001,
            0b1110,
        ];
        // Scale '9' by 2 (8x14)
        for (r, row) in glyph9_4x7.iter().enumerate() {
            for c in 0..4 {
                if (row & (1 << (3 - c))) != 0 {
                    for dy in 0..2 {
                        for dx in 0..2 {
                            let px = 6 + c * 2 + dx;
                            let py = 9 + r * 2 + dy;
                            if px < W && py < H {
                                let idx = (py * W + px) * 4;
                                rgba[idx] = 255;
                                rgba[idx + 1] = 255;
                                rgba[idx + 2] = 255;
                                rgba[idx + 3] = 255;
                            }
                        }
                    }
                }
            }
        }
        // Bold '+' at x=18, y=13 (8x8 cross)
        for y in 12..18 {
            for x in 19..21 {
                let idx = (y * W + x) * 4;
                rgba[idx] = 255;
                rgba[idx + 1] = 255;
                rgba[idx + 2] = 255;
                rgba[idx + 3] = 255;
            }
        }
        for y in 14..16 {
            for x in 17..23 {
                let idx = (y * W + x) * 4;
                rgba[idx] = 255;
                rgba[idx + 1] = 255;
                rgba[idx + 2] = 255;
                rgba[idx + 3] = 255;
            }
        }
    }

    rgba
}

fn escape_js_str(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('\'', "\\'")
        .replace('\"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

fn base64_encode(data: &[u8]) -> String {
    const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0];
        let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };
        out.push(TABLE[(b0 >> 2) as usize] as char);
        out.push(TABLE[(((b0 & 3) << 4) | (b1 >> 4)) as usize] as char);
        if chunk.len() > 1 {
            out.push(TABLE[(((b1 & 15) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(TABLE[(b2 & 63) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

fn open_or_create_account2(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("account_2") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        return;
    }

    let data_dir = get_persistent_data_dir()
        .parent()
        .map(|p| p.join("EBWebView_Account2"))
        .unwrap_or_else(|| get_persistent_data_dir().join("Account2"));
    let _ = std::fs::create_dir_all(&data_dir);

    let main_url = TARGET_URL.parse().expect("valid target url");
    let mut builder = WebviewWindowBuilder::new(app, "account_2", WebviewUrl::External(main_url))
        .title("WaLite - Akun 2")
        .inner_size(1024.0, 768.0)
        .min_inner_size(680.0, 500.0)
        .data_directory(data_dir)
        .additional_browser_args(BROWSER_ARGS)
        .disable_drag_drop_handler()
        .initialization_script(include_str!("../pdf.worker.min.js"))
        .initialization_script(include_str!("../pdf.min.js"))
        .initialization_script(include_str!("../wa-privacy-panel.js"))
        .initialization_script(include_str!("../wa-zapzap-features.js"))
        .initialization_script(include_str!("../wa-download-manager.js"));

    #[cfg(target_os = "windows")]
    {
        builder = builder.drag_and_drop(false);
        builder = builder.user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
        );
    }

    #[cfg(target_os = "linux")]
    {
        builder = builder.user_agent(
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
        );
    }

    let app_nav = app.clone();
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

    builder = builder.on_new_window(move |url, _features| {
        let url_str = url.as_str();
        if url_str == "about:blank" || url_str.is_empty() {
            return NewWindowResponse::Deny;
        }
        if url.scheme() == "blob" || url.scheme() == "data" {
            return NewWindowResponse::Allow;
        }
        if is_allowed_internal_url(&url) {
            return NewWindowResponse::Allow;
        }
        if is_safe_external_scheme(url.scheme()) {
            open_in_default_browser(url_str);
        }
        NewWindowResponse::Deny
    });

    if let Ok(win) = builder.build() {
        let _ = win.show();
    }
}

fn handle_walite_action(app: &tauri::AppHandle, url: &Url) -> bool {
    if url.scheme() != "walite-action" {
        return false;
    }
    let action = url
        .host_str()
        .filter(|h| !h.is_empty())
        .unwrap_or_else(|| url.path().trim_start_matches('/'));
    let mut params = std::collections::HashMap::new();
    for (k, v) in url.query_pairs() {
        params.insert(k.to_string(), v.to_string());
    }

    // Only deduplicate actions that might repeat unintentionally (like open-file, open-folder, send-reply)
    // Never block notifications!
    if action != "notify" {
        let action_key = format!("{}:{}:{:?}", action, url.path(), params.get("path").or(params.get("text")));
        let mut last_stamp = LAST_ACTION_STAMP.lock().unwrap();
        let now = std::time::Instant::now();
        if let Some((ref last_key, last_time)) = *last_stamp {
            if last_key == &action_key && now.duration_since(last_time).as_millis() < 400 {
                return true;
            }
        }
        *last_stamp = Some((action_key, now));
    }

    match action {
        "debug-log" => {
            if let Some(msg) = params.get("msg") {
                if let Ok(appdata) = std::env::var("LOCALAPPDATA") {
                    let log_file = std::path::PathBuf::from(appdata).join("Walite").join("dom_debug.log");
                    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(log_file) {
                        use std::io::Write;
                        let _ = writeln!(f, "[DEBUG] {}", msg);
                    }
                }
            }
        }
        "notify" => {
            let title = params.get("title").cloned().unwrap_or_default();
            let body = params.get("body").cloned().unwrap_or_default();
            let tag = params.get("tag").cloned().unwrap_or_default();
            show_native_message_notification(app, &title, &body, &tag);
        }
        "open-chat" => {
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
                            fn ShowWindow(hWnd: *mut std::ffi::c_void, nCmdShow: i32) -> i32;
                            fn SetForegroundWindow(hWnd: *mut std::ffi::c_void) -> i32;
                            fn BringWindowToTop(hWnd: *mut std::ffi::c_void) -> i32;
                        }
                        const SW_RESTORE: i32 = 9;
                        ShowWindow(hwnd.0, SW_RESTORE);
                        BringWindowToTop(hwnd.0);
                        SetForegroundWindow(hwnd.0);
                    }
                }

                let safe_title = escape_js_str(&title);
                let safe_tag = escape_js_str(&tag);
                let js = format!(
                    "(function(){{ function _go(n){{ if(window.__walite_on_notif_click){{ if(!window.__walite_on_notif_click('{}','{}') && n<12){{ setTimeout(function(){{_go(n+1);}}, 150); }} }}else if(n<12){{ setTimeout(function(){{_go(n+1);}}, 150); }} }} _go(0); }})();",
                    safe_title, safe_tag
                );
                let _ = main_win.eval(&js);
            }
        }
        "shortcuts" => {
            if let Some(main_win) = app.get_webview_window("main") {
                let _ = main_win.show();
                let _ = main_win.unminimize();
                let _ = main_win.set_focus();
                let _ = main_win.eval("if(typeof window.waliteOpenShortcutsGuide==='function') window.waliteOpenShortcutsGuide();");
            }
        }
        "open-account" => {
            open_or_create_account2(app);
        }
        "badge" => {
            if let Some(count_str) = params.get("count") {
                let count: i64 = count_str.parse().unwrap_or(0);
                if let Some(main_win) = app.get_webview_window("main") {
                    if count > 0 {
                        let _ = main_win.set_title(&format!("({}) WaLite", count));
                        let rgba = create_badge_icon(count);
                        let img = tauri::image::Image::new_owned(rgba, 32, 32);
                        let _ = main_win.set_overlay_icon(Some(img));
                    } else {
                        let _ = main_win.set_title("WaLite");
                        let _ = main_win.set_overlay_icon(None);
                    }
                }
            }
        }
        "enter-pip" => {
            if let Some(main_win) = app.get_webview_window("main") {
                enter_pip_mode(&main_win);
            }
        }
        "exit-pip" => {
            if let Some(main_win) = app.get_webview_window("main") {
                restore_from_pip_mode(&main_win);
            }
        }
        "call-status" => {
            let active = params.get("active").map(|s| s == "true").unwrap_or(false);
            IS_CALL_ACTIVE.store(active, Ordering::SeqCst);
            if !active && IS_PIP_MODE.load(Ordering::SeqCst) {
                if let Some(main_win) = app.get_webview_window("main") {
                    restore_from_pip_mode(&main_win);
                }
            }
        }
        "accept-call" => {
            if let Some(main_win) = app.get_webview_window("main") {
                let _ = main_win.show();
                let _ = main_win.unminimize();
                let _ = main_win.set_focus();
                let js = "if (window.__walite_accept_call) window.__walite_accept_call();";
                let _ = main_win.eval(js);
            }
        }
        "decline-call" => {
            if let Some(main_win) = app.get_webview_window("main") {
                let js = "if (window.__walite_decline_call) window.__walite_decline_call();";
                let _ = main_win.eval(js);
            }
        }
        "open-devtools" => {
            if let Some(main_win) = app.get_webview_window("main") {
                main_win.open_devtools();
            }
        }
        "open-last-download" => {
            let last = LAST_CHOSEN_DOWNLOAD_PATH.lock().unwrap().clone();
            if let Some(path) = last {
                if path.exists() {
                    open_file_with_default_app(&path.to_string_lossy());
                }
            }
        }
        "open-file" => {
            if let Some(path_str) = params.get("path") {
                let path = std::path::Path::new(path_str);
                if path.exists() {
                    open_file_with_default_app(path_str);
                }
            }
        }
        "open-folder" => {
            if let Some(path_str) = params.get("path") {
                open_folder_and_select(path_str);
            }
        }
        "set-setting" => {
            if let Some(key) = params.get("key") {
                if let Some(val) = params.get("val") {
                    let bool_val = val == "true" || val == "1";
                    match key.as_str() {
                        "saveAs" => {
                            ALWAYS_ASK_SAVE_AS.store(bool_val, Ordering::SeqCst);
                        }
                        "downloadNotif" => {
                            SHOW_DOWNLOAD_NOTIF.store(bool_val, Ordering::SeqCst);
                        }
                        "autoStart" => {
                            set_run_on_startup(bool_val);
                        }
                        _ => {}
                    }
                }
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
    path: Option<String>,
    key: Option<String>,
    val: Option<String>,
) {
    let mut params = std::collections::HashMap::new();
    if let Some(t) = title { params.insert("title".to_string(), t); }
    if let Some(b) = body { params.insert("body".to_string(), b); }
    if let Some(i) = icon { params.insert("icon".to_string(), i); }
    if let Some(g) = tag { params.insert("tag".to_string(), g); }
    if let Some(x) = text { params.insert("text".to_string(), x); }
    if let Some(p) = path { params.insert("path".to_string(), p); }
    if let Some(k) = key { params.insert("key".to_string(), k); }
    if let Some(v) = val { params.insert("val".to_string(), v); }

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

#[tauri::command]
fn read_pdf_file(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
fn ensure_webview_pdf_preferences() {
    let base_dirs = vec![
        get_persistent_data_dir(),
        get_persistent_data_dir()
            .parent()
            .map(|p| p.join("EBWebView_Account2"))
            .unwrap_or_else(|| get_persistent_data_dir().join("Account2")),
    ];

    for base_dir in base_dirs {
        let default_dir = base_dir.join("Default");
        let _ = std::fs::create_dir_all(&default_dir);
        let prefs_path = default_dir.join("Preferences");

        let mut json = if prefs_path.exists() {
            std::fs::read_to_string(&prefs_path)
                .ok()
                .and_then(|c| serde_json::from_str::<serde_json::Value>(&c).ok())
                .unwrap_or_else(|| serde_json::json!({}))
        } else {
            serde_json::json!({})
        };

        if let Some(obj) = json.as_object_mut() {
            let plugins = obj.entry("plugins").or_insert_with(|| serde_json::json!({}));
            if let Some(p_obj) = plugins.as_object_mut() {
                p_obj.insert("always_open_pdf_externally".to_string(), serde_json::json!(false));
            }
            if let Ok(serialized) = serde_json::to_string(&json) {
                let _ = std::fs::write(&prefs_path, serialized);
            }
        }
    }
}

#[test]
fn test_url_parse() {
    let u = Url::parse("walite-action://debug-log?msg=hello_world").unwrap();
    println!("scheme: {}", u.scheme());
    println!("host: {:?}", u.host_str());
    println!("path: {}", u.path());
    for (k, v) in u.query_pairs() {
        println!("query: {} = {}", k, v);
    }
}

fn set_run_on_startup(enable: bool) {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::HKEY_CURRENT_USER;
        use winreg::RegKey;
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok((key, _)) = hkcu.create_subkey(r"Software\Microsoft\Windows\CurrentVersion\Run") {
            if enable {
                if let Ok(exe) = std::env::current_exe() {
                    let exe_path = format!("\"{}\"", exe.to_string_lossy());
                    let _ = key.set_value("WaLite", &exe_path);
                }
            } else {
                let _ = key.delete_value("WaLite");
            }
        }
    }
}

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

        #[link(name = "user32")]
        extern "system" {
            fn SystemParametersInfoW(uiAction: u32, uiParam: u32, pvParam: *mut std::ffi::c_void, fWinIni: u32) -> i32;
        }
        const SPI_SETMOUSEVANISH: u32 = 0x1021;
        // Disable Windows "hide mouse pointer while typing" feature to resolve WebView2 disappearing cursor
        let _ = SystemParametersInfoW(SPI_SETMOUSEVANISH, 0, std::ptr::null_mut(), 0);
    }

    // Register AUMID in HKCU\Software\Classes\AppUserModelId\id.my.vianto06.walite
    // so Windows Action Center and WinRT Toast Notification Manager recognize it as "WaLite"
    {
        use winreg::enums::HKEY_CURRENT_USER;
        use winreg::RegKey;
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok((key, _)) = hkcu.create_subkey(format!(r"Software\Classes\AppUserModelId\{}", APP_ID)) {
            let _ = key.set_value("DisplayName", &"WaLite");
            if let Ok(exe) = std::env::current_exe() {
                let _ = key.set_value("IconUri", &exe.to_string_lossy().to_string());
            }
        }

        // Also create/update Start Menu shortcut so Action Center displays "WaLite" with icon
        if let (Ok(exe), Ok(appdata)) = (std::env::current_exe(), std::env::var("APPDATA")) {
            let programs = std::path::PathBuf::from(appdata)
                .join("Microsoft")
                .join("Windows")
                .join("Start Menu")
                .join("Programs");
            let lnk = programs.join("WaLite.lnk");
            if !lnk.exists() {
                use std::os::windows::process::CommandExt;
                const CREATE_NO_WINDOW: u32 = 0x08000000;
                let ps = format!(
                    "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('{}');$s.TargetPath='{}';$s.Save()",
                    lnk.display(),
                    exe.display()
                );
                let _ = std::process::Command::new("powershell")
                    .args(["-NoProfile", "-NonInteractive", "-Command", &ps])
                    .creation_flags(CREATE_NO_WINDOW)
                    .status();
            }
        }
        // Auto-start with Windows (pure desktop app experience)
        set_run_on_startup(true);
    }
}

fn main() {
    #[cfg(target_os = "windows")]
    {
        ensure_webview_pdf_preferences();
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
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![walite_action, read_pdf_file])
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();

                for arg in argv {
                    if let Some(code) = arg.strip_prefix("--eval=") {
                        let _ = window.eval(code);
                    }
                }
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
                .initialization_script(include_str!("../pdf.worker.min.js"))
                .initialization_script(include_str!("../pdf.min.js"))
                .initialization_script(include_str!("../wa-privacy-panel.js"))
                .initialization_script(include_str!("../wa-zapzap-features.js"))
                .initialization_script(include_str!("../wa-download-manager.js"));

            #[cfg(target_os = "windows")]
            {
                builder = builder.drag_and_drop(false);
                builder = builder.user_agent(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
                );
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
                    let allowed = is_allowed_internal_url(&url);
                    if let Ok(appdata) = std::env::var("LOCALAPPDATA") {
                        let log_file = std::path::PathBuf::from(appdata).join("Walite").join("dom_debug.log");
                        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(log_file) {
                            use std::io::Write;
                            let _ = writeln!(f, "[NAV] allowed={} url={}", allowed, url_str);
                        }
                    }
                    if allowed {
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
                let allowed = is_allowed_internal_url(&url);
                if let Ok(appdata) = std::env::var("LOCALAPPDATA") {
                    let log_file = std::path::PathBuf::from(appdata).join("Walite").join("dom_debug.log");
                    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(log_file) {
                        use std::io::Write;
                        let _ = writeln!(f, "[NEW_WINDOW] allowed={} url={}", allowed, url_str);
                    }
                }
                if url_str == "about:blank" || url_str.is_empty() {
                    return NewWindowResponse::Deny;
                }
                if url.scheme() == "blob" || url.scheme() == "data" {
                    return NewWindowResponse::Allow;
                }
                if allowed {
                    return NewWindowResponse::Allow;
                }
                if is_safe_external_scheme(url.scheme()) {
                    open_in_default_browser(url_str);
                }
                NewWindowResponse::Deny
            });

            // Download handler: save to user's download folder
            let app_handle_dl = app_handle.clone();
            builder = builder.on_download(move |webview, event| {
                match event {
                    DownloadEvent::Requested { url, destination } => {
                        if let Ok(appdata) = std::env::var("LOCALAPPDATA") {
                            let log_file = std::path::PathBuf::from(appdata).join("Walite").join("dom_debug.log");
                            if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(log_file) {
                                use std::io::Write;
                                let _ = writeln!(f, "[DOWNLOAD] url={} dest={}", url, destination.display());
                            }
                        }
                        let dl_dir = app_handle_dl
                            .path()
                            .download_dir()
                            .unwrap_or_else(|_| PathBuf::from("."));
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

                        let ask_save_as = ALWAYS_ASK_SAVE_AS.load(Ordering::SeqCst);

                        #[cfg(target_os = "windows")]
                        if ask_save_as {
                            let hwnd = webview
                                .window()
                                .hwnd()
                                .map(|h| h.0)
                                .unwrap_or(std::ptr::null_mut());
                            let initial_dir = {
                                let last = LAST_SAVE_DIR.lock().unwrap();
                                last.as_ref()
                                    .filter(|p| p.is_dir())
                                    .cloned()
                                    .unwrap_or_else(|| dl_dir.clone())
                            };

                            if let Some(chosen_path) =
                                show_windows_save_dialog(hwnd, &initial_dir, &file_name)
                            {
                                if let Some(parent) = chosen_path.parent() {
                                    let mut last = LAST_SAVE_DIR.lock().unwrap();
                                    *last = Some(parent.to_path_buf());
                                }
                                *LAST_CHOSEN_DOWNLOAD_PATH.lock().unwrap() = Some(chosen_path.clone());
                                *destination = chosen_path;
                                return true;
                            } else {
                                // User cancelled the Save As dialog
                                return false;
                            }
                        }

                        let fallback_path = get_unique_download_path(&dl_dir, &file_name);
                        *LAST_CHOSEN_DOWNLOAD_PATH.lock().unwrap() = Some(fallback_path.clone());
                        *destination = fallback_path;
                        true
                    }
                    DownloadEvent::Finished { url: _, path, success } => {
                        let chosen = LAST_CHOSEN_DOWNLOAD_PATH.lock().unwrap().take();
                        let final_path = path.or(chosen);
                        if success {
                            if let Some(ref saved_path) = final_path {
                                if saved_path.extension().map_or(false, |ext| ext.eq_ignore_ascii_case("pdf")) {
                                    if let Ok(bytes) = std::fs::read(saved_path) {
                                        const CHUNK_SIZE: usize = 200_000;
                                        let _ = webview.eval("window.__walitePdfChunks = [];");
                                        for chunk in bytes.chunks(CHUNK_SIZE) {
                                            let b64 = base64_encode(chunk);
                                            let _ = webview.eval(&format!("window.__walitePdfChunks.push('{}');", b64));
                                        }
                                        let fname = saved_path.file_name().and_then(|n| n.to_str()).unwrap_or("Dokumen.pdf");
                                        let js = format!("window.waliteAssembleAndOpenPdf && window.waliteAssembleAndOpenPdf('{}');", escape_js_str(fname));
                                        let _ = webview.eval(&js);
                                    }
                                }
                            }
                        }
                        if success && SHOW_DOWNLOAD_NOTIF.load(Ordering::SeqCst) {
                            if let Some(saved_path) = final_path {
                                show_download_finished_toast(&app_handle_dl, &saved_path);
                            }
                        }
                        true
                    }
                    _ => true,
                }
            });

            let window = builder.build()?;
            let _ = window.show();
            window.open_devtools();

            let window_clone = window.clone();
            window.on_window_event(move |event| {
                match event {
                    WindowEvent::Focused(focused) => {
                        if *focused && IS_PIP_MODE.load(Ordering::SeqCst) {
                            restore_from_pip_mode(&window_clone);
                        }
                    }
                    _ => {}
                }
            });

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
            let settings_item = MenuItem::with_id(app, "settings", "Pengaturan (Ctrl+P)", true, None::<&str>)?;
            let devtools_item = MenuItem::with_id(app, "devtools", "Inspect / DevTools (F12)", true, None::<&str>)?;
            let test_item = MenuItem::with_id(app, "test_notif", "🔔 Uji Coba Notifikasi", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Keluar", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&open_item, &settings_item, &devtools_item, &test_item, &quit_item])?;

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
                    "devtools" => {
                        if let Some(window) = app.get_webview_window("main") {
                            window.open_devtools();
                        }
                    }
                    "settings" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                            let _ = window.eval("if(typeof window.waliteOpenSettings==='function') window.waliteOpenSettings();");
                        }
                    }
                    "test_notif" => {
                        show_native_message_notification(
                            app,
                            "Budi Santoso",
                            "Halo! Ketik teks balasan di kolom bawah lalu klik Kirim.",
                            "test-notif"
                        );
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
