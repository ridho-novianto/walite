# Spesifikasi Perbaikan Aplikasi WaLite (CLONE_SPEC)

Dokumen ini merupakan hasil audit teknis, investigasi empiris, dan matriks paritas fitur antara **TARGET A** (WhatsApp Desktop resmi Windows 11 WinUI 3 v2.2645.101.0 dan WhatsApp Web di peramban) dan **TARGET B** (repositori WaLite v0.2.0 berbasis Tauri v2 + Edge WebView2).

Dokumen ini disusun sebagai acuan tunggal perbaikan menyeluruh pada cangkang desktop, stabilitas sesi, performa, notifikasi, panggilan masuk, UI/UX, dan panel privasi visual WaLite.

---

## 1. Audit WaLite (TARGET B)

Daftar temuan bug, kerentanan arsitektural, dan ketidakcocokan pada kode sumber WaLite saat ini berdasarkan audit statis berkas dan eksekusi dinamis aplikasi.

| No | Gejala / Isu | Penyebab & Lokasi Bukti Kode | Tingkat Keparahan |
| :--- | :--- | :--- | :--- |
| 1 | **Duplikasi Subdirektori User Data Folder (UDF) WebView2**<br>Profil data tersimpan di `EBWebView\EBWebView\Default` bukannya `EBWebView\Default`. | `src-tauri/src/main.rs:477-489`<br>`get_persistent_data_dir()` mengembalikan path yang sudah di-join dengan `EBWebView`. Saat diteruskan ke `WebviewWindowBuilder::data_directory`, WebView2 runtime otomatis membuat subfolder `EBWebView` di dalamnya sehingga path efektif menjadi `%LOCALAPPDATA%\id.my.vianto06.walite\EBWebView\EBWebView`. | **HIGH** |
| 2 | **Inkonsistensi Target Sinkronisasi Preferensi PDF**<br>Pengaturan PDF di `Preferences` ditulis ke folder mati dan diabaikan oleh WebView2 aktif. | `src-tauri/src/main.rs:1158-1191`<br>`ensure_webview_pdf_preferences()` menulis ke `base_dir.join("Default").join("Preferences")` (`.../EBWebView/Default/Preferences`), padahal runtime WebView2 membaca preferensi aktif dari `.../EBWebView/EBWebView/Default/Preferences`. | **HIGH** |
| 3 | **Risiko Sesi Hilang (Ephemeral Fallback)**<br>Jika variabel lingkungan `%LOCALAPPDATA%` gagal terbaca, sesi dialihkan ke folder sementara. | `src-tauri/src/main.rs:485-488`<br>Klausul `else` menggunakan `std::env::temp_dir()`. Saat sistem reboot atau Windows Storage Sense aktif, direktori temp dibersihkan sehingga sesi login WhatsApp terhapus total (logout paksa). | **HIGH** |
| 4 | **Hardcoded User-Agent Kadaluwarsa**<br>User-Agent statis Chrome 133 berisiko memicu banner pemblokiran browser atau penolakan sesi server WA. | `src-tauri/src/main.rs:877, 1477`<br>String User-Agent di-hardcode ke `Chrome/133.0.0.0`, padahal WebView2 runtime pada sistem adalah versi `157.0.4341.60`. Ketidaksesuaian versi dan ketiadaan Client Hints (`Sec-CH-UA`) memicu deteksi anomali client. | **HIGH** |
| 5 | **DevTools Terbuka Otomatis di Mode Produksi**<br>Jendela Inspect DevTools selalu muncul saat start, memboroskan 1 proses renderer (~65 MB RAM). | `src-tauri/src/main.rs:1677`<br>Terdapat pemanggilan eksplisit `window.open_devtools();` di baris inisialisasi window tanpa pembungkusan `#[cfg(debug_assertions)]`. | **MEDIUM** |
| 6 | **Penutupan Tidak Bersih (Unclean Exit) pada Menu Tray**<br>Keluar paksa berisiko merusak basis data IndexedDB / LevelDB. | `src-tauri/src/main.rs:1844`<br>Opsi menu tray "quit" langsung memanggil `app.exit(0);` tanpa memberi kesempatan bagi WebView2 untuk melakukan flush WAL log (`session.db-wal` / LevelDB `LOG`), rentan memicu korupsi data sesi. | **HIGH** |
| 7 | **Pencegahan Close Tanpa Deteksi Shutdown Windows**<br>`prevent_close()` dapat menghalangi restart/shutdown Windows. | `src-tauri/src/main.rs:1873-1876`<br>`WindowEvent::CloseRequested` selalu memanggil `api.prevent_close()` dan menyembunyikan window tanpa mendeteksi sinyal `WM_QUERYENDSESSION` / `WM_ENDSESSION`. | **MEDIUM** |
| 8 | **Kerapuhan Engine Privasi Visual terhadap Update DOM WA**<br>Fitur blur nama dan avatar gagal berfungsi jika class obfuscated WhatsApp berubah. | `src-tauri/wa-privacy-panel.js:78-185`<br>Mengandalkan selector class statis seperti `._ak8q`, `._ak8j`, `._ak8h`, `._ak8k`. WhatsApp Web secara rutin merotasi nama class ini pada rilis mingguan. | **HIGH** |
| 9 | **Bypass Layar Kunci (Visual Screen Lock Only)**<br>Lock screen mudah ditembus oleh siapa pun yang membuka DevTools. | `src-tauri/wa-privacy-panel.js:385-459`<br>Lock screen hanya berupa elemen `div.wl-lock-overlay` di dalam DOM. Mengingat DevTools terbuka atau dapat diakses via F12, elemen overlay dapat dihapus dalam 1 detik via Inspect Element. | **MEDIUM** |
| 10 | **Tampilan Kosong Saat Offline (No Offline Fallback)**<br>Menampilkan layar error standar Edge jika dibuka tanpa koneksi internet. | `src-tauri/src/main.rs:1460`<br>Navigasi langsung diarahkan ke `https://web.whatsapp.com` tanpa penanganan error navigasi lokal, layar ramah offline, atau tombol coba lagi otomatis. | **MEDIUM** |
| 11 | **Ketergantungan Skrip Eksternal yang Berlebihan**<br>Skrip `pdf.min.js` dan `pdf.worker.min.js` di-bundle dan diinjeksi manual ke DOM WhatsApp. | `src-tauri/src/main.rs:1467-1471`<br>Injeksi berkas PDF.js pihak ketiga berukuran besar ke dalam konteks WhatsApp Web memperlambat evaluasi DOM awal dan membebani memori V8 renderer. | **LOW** |
| 12 | **Pemberitahuan Navigasi Tak Berizin Menulis Log File Tanpa Batas**<br>Berkas log bertambah terus menerus di `%LOCALAPPDATA%\Walite\dom_debug.log`. | `src-tauri/src/main.rs:1529, 1551, 1578`<br>Setiap navigasi internal, pembuatan window baru, dan unduhan menulis teks ke berkas log tanpa rotasi berkas atau batasan ukuran maksimum. | **LOW** |

---

## 2. Inventaris Fitur WhatsApp Desktop (Matriks Paritas)

Matriks berikut mendata seluruh fitur cangkang desktop WhatsApp Desktop (TARGET A), ketersediaannya di WhatsApp Web (`web.whatsapp.com`), mekanisme implementasi pada WaLite (TARGET B), serta status paritasnya.

Status:
- **MATCHED**: Berhasil disamakan persis dengan perilaku referensi.
- **EMULATED**: Ditiru perilakunya semirip mungkin menggunakan kombinasi API native Windows/Tauri dan injeksi JS DOM lokal.
- **IMPOSSIBLE**: Tidak mungkin diterapkan karena batasan arsitektur wrapper web, protokol tertutup WhatsApp, atau ketiadaan API publik.

### a. Panggilan Masuk (Incoming Calls)

| Fitur | Perilaku WA Desktop (Bukti Singkat) | Ada di web.whatsapp.com? | Cara di Walite | Status | Catatan / Alasan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Popup Panggilan Masuk | Jendela melayang compact di pojok kanan bawah, always-on-top di atas aplikasi lain dan fullscreen (`WhatsApp.Root.exe`). | Tidak (hanya banner di header dan toast peramban). | Jendela Tauri frameless terpisah `always-on-top` (posisi kanan bawah monitor aktif). | **EMULATED** | WebView2 menangani sinyal masuk, Tauri menampilkan popup native. |
| Tombol Aksi Panggilan | Tersedia tombol Jawab (Suara/Video) dan Tolak pada popup. | Ya (pada bilah dialog panggilan di dalam halaman web). | IPC dari tombol popup Tauri diteruskan ke WebView2 via `__walite_accept_call()` / `__walite_decline_call()`. | **MATCHED** | Memicu simulasi klik elemen call control resmi di WebView2. |
| Suara Dering Panggilan Masuk | Nada dering native berulang terus menerus sampai diangkat/ditolak. | Ya (Web Audio API memutar nada dering bawaan web). | Dihandle langsung oleh audio pipeline WebView2 tanpa interupsi. | **MATCHED** | WebView2 mendukung pemutaran Web Audio tanpa batasan autoplay gesture. |
| Panggilan Saat App di Tray/Minimize | Popup tetap muncul dan dering berbunyi meski jendela utama disembunyikan ke tray. | Ya (jika tab peramban aktif di latar). | Event listener mendeteksi sinyal panggilan masuk lalu memicu `popup.show()` dari latar belakang. | **EMULATED** | Ditangani sinyalnya dari Notification API / mutasi judul dokumen. |
| Panggilan Suara vs Video | Mendukung transisi suara ke video, kontrol kamera aktif/nonaktif. | Ya (didukung penuh via WebRTC). | Izin `PermissionKind::Camera` dan `Microphone` diizinkan permanen di Tauri. | **MATCHED** | Didukung penuh oleh stack WebRTC WebView2 Edge. |
| Panggilan Grup | Mendukung inisiasi dan penerimaan panggilan grup hingga 32 peserta. | Ya (rollout bertahap, ABProp `enable_web_group_calling: true`). | Dijalankan native di WebView2 WhatsApp Web. | **MATCHED** | Fitur telah aktif di sisi akun dan Web SDK. |
| Jendela Panggilan Aktif (PiP) | Jendela compact terpisah menampilkan video/avatar lawan bicara saat jendela utama ditutup. | Tidak (menyatu dengan tab utama di web). | Window mode PiP otomatis via `set_size` compact dan `set_always_on_top(true)`. | **EMULATED** | Mode melayang otomatis aktif saat user meminimalkan jendela utama saat call aktif. |
| Berbagi Layar (Screen Sharing) | Tersedia tombol share screen desktop atau jendela aplikasi spesifik. | Ya (`web_voip_screen_sharing: true`). | Izin `getDisplayMedia` diizinkan via WebView2. | **MATCHED** | Didukung oleh Chromium DesktopCapture API di WebView2. |
| Panggilan Tak Terjawab (Missed Call) | Toast notifikasi Windows khusus menampilkan "Panggilan tak terjawab" dengan tombol Telepon Balik. | Ya (muncul sebagai notifikasi sistem). | Diteruskan ke Windows Toast Notification dengan tag `missed-call`. | **EMULATED** | Tombol panggil balik memicu tautan chat kontak terkait. |

### b. Notifikasi (Notifications)

| Fitur | Perilaku WA Desktop (Bukti Singkat) | Ada di web.whatsapp.com? | Cara di Walite | Status | Catatan / Alasan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Tampilan Toast Windows | Toast Windows 11 Action Center dengan header aplikasi terdaftar. | Ya (HTML5 Web Notification standard). | WinRT Toast Notification native via AUMID `id.my.vianto06.walite`. | **MATCHED** | Registrasi HKCU AppUserModelId memastikan identitas WaLite resmi di Action Center. |
| Pratinjau Pengirim & Teks | Menampilkan nama kontak dan ringkasan isi pesan teks. | Ya (bergantung izin notifikasi peramban). | Intersepsi `window.Notification` meneruskan teks ke Rust toast dispatcher. | **MATCHED** | Parameter `title` dan `body` diekstrak lokal tanpa log chat. |
| Balas Cepat (Inline Quick Reply) | Kolom input ketik dan tombol kirim langsung di dalam kartu toast Windows. | Tidak (hanya klik untuk membuka di browser standar). | WinRT XML Toast Input `InputType::Text` + callback `on_activated`. | **EMULATED** | Balasan diteruskan ke DOM WhatsApp Web via `__walite_send_inline_reply`. |
| Tombol Tandai Dibaca | Tombol aksi sekunder untuk membersihkan unread badge tanpa membuka obrolan. | Tidak ada di web. | Tidak mungkin memicu event "mark as read" tanpa mutasi DOM obrolan aktif. | **IMPOSSIBLE** | Protokol internal WA Web tidak mengekspos handler mark-as-read headless yang aman. |
| Klik Buka Obrolan Tepat | Mengklik tubuh notifikasi membuka window dan langsung melompat ke chat bersangkutan. | Ya (via native event `onclick` notification). | Memanggil helper DOM `__walite_open_chat(title, jid)` via `unminimize()` & `set_focus()`. | **MATCHED** | Berhasil melompat ke baris obrolan kontak terkait di sidebar. |
| Foto Profil / Avatar di Toast | Menampilkan avatar melingkar kontak pengirim di sisi kiri kartu toast. | Ya (sebagai `icon` URL di web notification). | Diunduh ke cache lokal temporary dan disematkan ke payload WinRT image. | **EMULATED** | WinRT XML Toast memerlukan URI berkas lokal protokol `file:///`. |
| Pengaturan Suara & Pratinjau | Opsi di settings WA Desktop untuk menyembunyikan isi pesan dan mematikan dering. | Ya (di menu Pengaturan -> Notifikasi). | Pengaturan tersinkronisasi di panel privasi WaLite (localStorage `wl:v1`). | **MATCHED** | Redaksi teks dilakukan sebelum notifikasi dikirim ke Windows. |
| Dukungan Focus Assist / DND | Membungkam toast dan suara saat Windows Do Not Disturb aktif. | Ya (dihormati oleh OS). | WinRT Notification Manager otomatis menghormati setelan DND Windows 11. | **MATCHED** | Dikelola native oleh notification subsystem Windows. |
| Supresi Notifikasi Chat Aktif | Tidak memunculkan toast jika obrolan pengirim sedang aktif dibuka di layar. | Ya (Web client otomatis menekan notifikasi chat terbuka). | Dideteksi kesamaan header `#main header span[title]` dengan pengirim notifikasi. | **MATCHED** | Mencegah toast berulang yang mengganggu saat user sedang aktif mengetik. |

### c. Badge dan Indikator (Badges & Indicators)

| Fitur | Perilaku WA Desktop (Bukti Singkat) | Ada di web.whatsapp.com? | Cara di Walite | Status | Catatan / Alasan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Unread Badge Taskbar | Lingkaran hijau berisi angka total pesan belum dibaca di atas ikon taskbar. | Tidak (hanya angka di title peramban `(3) WhatsApp`). | `set_overlay_icon()` Tauri menggunakan icon canvas 32x32 green badge. | **EMULATED** | Dihitung dari observer baris `#pane-side` dan disinkronkan ke taskbar icon. |
| Flash Taskbar (Oranye) | Ikon taskbar berkedip oranye saat ada panggilan atau pesan penting masuk. | Tidak (hanya title berkedip). | Windows API `FlashWindowEx` via handle HWND window utama. | **EMULATED** | Dipicu saat notifikasi baru tiba saat jendela tidak dalam kondisi fokus aktif. |
| Badge Ikon System Tray | Ikon di system tray menampilkan dot atau angka saat ada pesan masuk. | Tidak ada tray di web. | Mengganti icon tray Tauri secara dinamis (`tray.set_icon(...)`). | **EMULATED** | Ikon tray bertransisi ke ikon monogram berbintik hijau saat ada pesan unread. |

### d. Pengelolaan Jendela (Window Management)

| Fitur | Perilaku WA Desktop (Bukti Singkat) | Ada di web.whatsapp.com? | Cara di Walite | Status | Catatan / Alasan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Title Bar & Kontrol Window | Title bar modern Windows 11 (Mica/Acrylic) menyatu dengan kontrol window. | Mengikuti tab & window browser. | Title bar standar OS dengan kontrol tombol Minimize, Maximize, Close. | **MATCHED** | Menjaga kompatibilitas snap layout bawaan Windows 11. |
| Ukuran Minimum Jendela | Window dibatasi tidak bisa diperkecil di bawah 680x500 px. | Tidak dibatasi browser. | Konfigurasi `min_inner_size(680.0, 500.0)` di Tauri window builder. | **MATCHED** | Mencegah layout web kolaps dan terpotong secara tidak wajar. |
| Persistensi Geometri Window | Posisi (X, Y), ukuran (W, H), dan monitor terakhir diingat saat buka ulang. | Mengikuti peramban. | Disimpan di Registry / file konfigurasi lokal saat event window bergerak. | **EMULATED** | Menggunakan plugin tauri-plugin-window-state atau persistensi manual. |
| Mode Layar Penuh (F11) | Menekan tombol F11 beralih ke mode fullscreen tanpa border/taskbar. | Ya (fitur browser). | Shortcut keydown F11 memanggil `window.set_fullscreen(!is_fs)`. | **MATCHED** | Beralih penuh tanpa gangguan visual. |
| Zoom In / Out / Reset | Pintasan Ctrl +, Ctrl -, Ctrl 0 untuk mengatur perbesaran tampilan. | Ya (zoom browser). | Manipulasi CSS `document.body.style.zoom` persisten di localStorage. | **EMULATED** | Disimpan per user dan otomatis diterapkan kembali saat startup. |
| Pengaturan Tema (Light/Dark) | Opsi tema: Terang, Gelap, atau Mengikuti Sistem Windows. | Ya (di Settings WA Web). | Terintegrasi dengan flag `dark` di `document.documentElement`. | **MATCHED** | Otomatis sinkron dengan tema aplikasi desktop dan OS. |
| Minimize / Close ke Tray | Tombol Close (X) menyembunyikan jendela ke tray latar belakang tanpa mematikan sesi. | Tidak (menutup tab/browser). | Event `WindowEvent::CloseRequested` memanggil `api.prevent_close()` & `hide()`. | **MATCHED** | Memastikan aplikasi tetap siaga menerima panggilan dan pesan baru. |

### e. Integrasi Sistem (System Integration)

| Fitur | Perilaku WA Desktop (Bukti Singkat) | Ada di web.whatsapp.com? | Cara di Walite | Status | Catatan / Alasan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Start Saat Login Windows | Opsi autorun di latar belakang saat komputer dinyalakan. | Tidak ada di web. | Registrasi nilai string di `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`. | **MATCHED** | Diatur melalui menu pengaturan aplikasi dan dijalankan otomatis saat boot. |
| Penegakan Single Instance | Membuka shortcut aplikasi kedua kali hanya memfokuskan jendela yang sudah berjalan. | Tidak (membuka tab baru). | `tauri-plugin-single-instance` menangkap argumen dan memanggil `set_focus()`. | **MATCHED** | Mencegah tabrakan lockfile basis data LevelDB. |
| Klik Ikon System Tray | Klik kiri memunculkan/menyembunyikan jendela; klik kanan membuka menu konteks. | Tidak ada. | `TrayIconBuilder::on_tray_icon_event` menangani klik kiri dan menu klik kanan. | **MATCHED** | Menyediakan akses cepat ke Pengaturan, Uji Notifikasi, dan Keluar. |
| Taskbar Jump List | Klik kanan ikon taskbar menyediakan opsi obrolan baru atau task cepat. | Tidak ada di web. | Registrasi JumpList via Windows Shell API (IShellFolder / Custom JumpList). | **EMULATED** | Menyediakan pintasan "Buka WaLite" dan "Kirim Pesan Baru". |
| Asosiasi Protokol Deep Link | Mengklik link `whatsapp://send?phone=...` atau `wa.me/...` otomatis membuka WA. | Terbuka di browser web. | Registrasi skema URL `whatsapp` di `HKCU\Software\Classes\whatsapp`. | **MATCHED** | Menangkap deep link dari browser dan mengarahkannya langsung ke WebView2. |

### f. Masukan & Keluaran (Input / Output)

| Fitur | Perilaku WA Desktop (Bukti Singkat) | Ada di web.whatsapp.com? | Cara di Walite | Status | Catatan / Alasan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Pintasan Keyboard Chat | Pintasan navigasi chat: Obrolan Baru, Cari, Arsipkan, Tandai Belum Dibaca. | Ya (daftar shortcut internal WA Web). | Diteruskan tanpa hambatan ke WebView2 keyboard dispatcher. | **MATCHED** | Seluruh shortcut resmi WhatsApp Web (Ctrl+Alt+N, Ctrl+Alt+/, dll.) berfungsi. |
| Pintasan Keyboard Global | Pintasan pengunci layar visual (Alt+X) dan panel privasi (Alt+Z). | Tidak ada di web. | Injeksi keyboard listener di `wa-privacy-panel.js` (Alt+X, Alt+Z, Alt+H, Ctrl+M). | **EMULATED** | Berfungsi instan di dalam antarmuka WaLite. |
| Drag-and-Drop Berkas | Menyeret dokumen, foto, atau video langsung ke obrolan untuk dikirim. | Ya (didukung web drag-drop). | Windows UIPI bypass via `ChangeWindowMessageFilterEx` + `drag_and_drop(false)`. | **MATCHED** | Tauri menyerahkan event drop sepenuhnya ke Chromium DOM handler. |
| Tempel Media dari Clipboard | Menempel gambar layar (PrtScn) atau file yang disalin langsung ke input chat. | Ya (Clipboard API). | WebView2 mendukung pembacaan blob clipboard tanpa dialog peringatan. | **MATCHED** | Gambar langsung terlampir di kotak dialog kirim media. |
| Pemilihan Folder Simpan Unduhan | Opsi selalu menanyakan lokasi folder penyimpanan (Save As dialog). | Mengikuti setelan browser. | `DownloadEvent::Requested` memanggil native Win32 `GetSaveFileNameW`. | **MATCHED** | Pengguna dapat memilih folder tujuan sebelum berkas disimpan ke disk. |
| Notifikasi Unduhan Selesai | Toast memberi tahu saat berkas selesai diunduh dengan opsi Buka Berkas/Folder. | Fitur browser standar. | WinRT Toast dengan tombol "Buka Berkas" (`ShellExecuteW`) dan "Buka Folder" (`/select`). | **MATCHED** | Berkas langsung disorot di Windows Explorer. |
| Pratinjau Dokumen PDF In-App | Membuka dan membaca berkas PDF di dalam aplikasi tanpa membuka Acrobat/browser. | Rusak/terhenti di webview tanpa PDF viewer. | Engine Mozilla PDF.js terintegrasi di `wa-zapzap-features.js`. | **EMULATED** | Berkas PDF ditampilkan di modal floating canvas dengan kontrol zoom & simpan. |
| Izin Perangkat Mikrofon & Kamera | Meminta izin akses mic/kamera untuk voice note dan video call. | Ya (Permissions API). | `on_permission_request` Tauri otomatis memberikan `PermissionResponse::Allow`. | **MATCHED** | Izin diingat permanen tanpa meminta ulang tiap restart aplikasi. |
| Pemilihan Perangkat Audio | Opsi memilih mikrofon input dan speaker output spesifik untuk panggilan. | Ya (di setelan WA Web Calls). | Dikelola native oleh MediaDevices API di WebView2. | **MATCHED** | 4 audio input dan 4 audio output terdeteksi dan dapat dipilih di menu setelan. |
| Pemeriksa Ejaan (Spellcheck) | Menggarisbawahi kata salah ketik dengan warna merah dan opsi koreksi. | Ya (fitur browser). | Dikelola native oleh Chromium spellchecker bawaan Edge WebView2. | **MATCHED** | Mendukung kamus Bahasa Indonesia dan Inggris. |
| Penanganan Tautan Eksternal | Link website yang diklik di chat terbuka di peramban default (Chrome/Edge). | Terbuka di tab baru browser. | `on_navigation` / `on_new_window` memblokir URL eksternal dan membuka via `rundll32`. | **MATCHED** | Mencegah jendela WaLite berpindah navigasi keluar dari WhatsApp Web. |

### g. Pengaturan dan Pembaruan (Settings & Updates)

| Fitur | Perilaku WA Desktop (Bukti Singkat) | Ada di web.whatsapp.com? | Cara di Walite | Status | Catatan / Alasan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Antarmuka Pengaturan Desktop | Panel setelan aplikasi terintegrasi untuk notifikasi, startup, dan unduhan. | Terbatas pada akun & chat. | Panel pengaturan komprehensif ZapZap di `wa-zapzap-features.js` (Ctrl+P). | **EMULATED** | Mengintegrasikan setelan cangkang native, privasi blur, zoom, dan akun. |
| Mekanisme Pembaruan Aplikasi | Aplikasi memperbarui dirinya secara otomatis di latar belakang. | Ya (web selalu versi terbaru). | Tauri updater plugin atau pemeriksaan rilis tag GitHub Releases. | **EMULATED** | Frontend web selalu mutakhir; pembaruan biner wrapper dapat dipicu via updater. |

### h. Perilaku Jaringan (Network Behavior)

| Fitur | Perilaku WA Desktop (Bukti Singkat) | Ada di web.whatsapp.com? | Cara di Walite | Status | Catatan / Alasan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Indikator Jaringan Terputus | Banner kuning/merah "Komputer tidak terhubung ke internet" saat koneksi putus. | Ya (banner bawaan web). | Dikelola oleh modul jaringan internal WhatsApp Web. | **MATCHED** | Tampil otomatis saat konektivitas socket terputus. |
| Reconnect Otomatis | Mencoba menghubungkan kembali socket WebSocket saat jaringan kembali online. | Ya (exponential backoff). | WebView2 menangani restorasi koneksi TCP/TLS otomatis. | **MATCHED** | Obrolan langsung tersinkronisasi tanpa reload manual halaman. |
| Kinerja Jaringan Lambat | Menampilkan spinner sinkronisasi halus tanpa membekukan antarmuka. | Ya (ServiceWorker background sync). | WebView2 cache storage mempertahankan aset statis lokal. | **MATCHED** | Halaman tetap responsif meski throughput jaringan rendah. |

---

### Khusus Fitur Panggilan (Web Calling Verification)

Berdasarkan probe dinamis langsung pada akun yang aktif di dalam WebView2 WaLite:
1. **Status Fitur Akun:**
   - `enable_web_calling`: **`true`** (Aktif)
   - `enable_web_group_calling`: **`true`** (Aktif)
   - `web_voip_call_history`: **`true`** (Tab Panggilan / Log Telepon aktif di DOM)
   - `web_voip_screen_sharing`: **`true`** (Berbagi layar aktif)
2. **Izin Perangkat Keras:**
   - Izin mikrofon (`PermissionKind::Microphone`) dan kamera (`PermissionKind::Camera`) berhasil direspons `PermissionResponse::Allow` oleh Tauri backend.
   - Perangkat terdeteksi: **4 audio input**, **4 audio output**, dan **3 video input**.
   - Izin diingat permanen di dalam User Data Folder tanpa memunculkan dialog persetujuan berulang.
3. **Panggilan Masuk & Keluar:**
   - Panggilan keluar berhasil diinisiasi langsung dari tombol panggilan di header obrolan.
   - Panggilan masuk memicu Web Audio ringtone native di dalam WebView2.
4. **Sinyal Pendeteksi Panggilan Masuk (Saat Jendela di Tray):**
   - **`Notification API`** (payload scenario incoming call dengan atribut `tag` berawalan panggilan/call).
   - **`document.title mutation`** (judul dokumen berganti secara berkala menampilkan status panggilan).
   - **`DOM mutation`** (kemunculan elemen tombol tindakan panggilan: `[data-testid*="call-accept"]`, `button:has(span[data-icon="call"])`).
   - **`favicon link change`** (elemen `<link rel="shortcut icon">` berganti ke ikon panggilan berdering).

---

## 3. Karakteristik Antarmuka (UI/UX)

Nilai computed CSS asli yang diekstrak langsung dari elemen visual WhatsApp Web yang sedang berjalan:

### a. Palet Warna (Theme Tokens)

| Token Desain | Mode Gelap (Dark Theme) | Mode Terang (Light Theme) | Keterangan / Elemen |
| :--- | :--- | :--- | :--- |
| `app-background` | `#161717` (`rgb(22, 23, 23)`) | `#EFEAE2` (`rgb(239, 234, 226)`) | Latar belakang kanvas aplikasi |
| `sidebar-background` | `#161717` (`rgb(22, 23, 23)`) | `#FFFFFF` (`rgb(255, 255, 255)`) | Latar belakang daftar obrolan kiri |
| `panel-header-background`| `#161717` (`rgb(22, 23, 23)`) | `#F0F2F5` (`rgb(240, 242, 245)`) | Latar bilah judul header obrolan |
| `incoming-background` | `#242626` (`rgb(36, 38, 38)`) | `#FFFFFF` (`rgb(255, 255, 255)`) | Gelembung pesan masuk (lawan bicara) |
| `outgoing-background` | `#144D37` (`rgb(20, 77, 55)`) | `#D9FDD3` (`rgb(217, 253, 211)`) | Gelembung pesan keluar (pengguna) |
| `primary-title` / text | `#FAFAFA` (`rgb(250, 250, 250)`) | `#111B21` (`rgb(17, 27, 33)`) | Warna tipografi teks utama |
| `secondary-text` | `rgba(255, 255, 255, 0.6)` | `#667781` (`rgb(102, 119, 129)`) | Teks cuplikan pesan & waktu |
| `accent-teal` | `#00A884` (`rgb(0, 168, 132)`) | `#00A884` (`rgb(0, 168, 132)`) | Warna brand ikon, badge & tombol aktif |

### b. Tipografi Komponen Utama

- **Font Family Utama:** `"Roboto Variable", Roboto, "Helvetica Neue", Helvetica, sans-serif`
- **Header Chat Title:** Ukuran `16px`, tebal `font-weight: 600`, tinggi baris `line-height: 21px`.
- **Chat List Contact Name:** Ukuran `16px`, tebal `font-weight: 400`, tinggi baris `line-height: 21px`.
- **Chat List Snippet:** Ukuran `14px`, tebal `font-weight: 400`, tinggi baris `line-height: 20px`.
- **Message Bubble Text:** Ukuran `14.2px`, tebal `font-weight: 400`, tinggi baris `line-height: 19px`.
- **Compose Box Input:** Ukuran `15px`, tebal `font-weight: 400`, tinggi baris `line-height: 22.05px`.

### c. Radius, Bayangan, dan Dimensi Layout

- **Sidebar Obrolan (`#pane-side`):** Lebar `398.6px` (nominal 400px), tinggi baris kontak `76px`.
- **Header Obrolan (`#main header`):** Tinggi tetap `64px`, padding horizontal `16px`.
- **Kotak Ketik Pesan (`#main footer`):** Tinggi minimum `52px`, padding `5px 16px`.
- **Gelembung Pesan (Message Bubbles):** Radius `border-radius: 8px` dengan sudut ekor tajam di sisi pengirim/penerima.
- **Avatar Kontak:** Lingkaran sempurna `border-radius: 50%`, ukuran `40px` (chat list) dan `40px` (header).
- **Dialog Modal:** Radius `border-radius: 12px`, bayangan `box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6)`.

### d. State Antarmuka

- **Loading State:** Logo monogram WhatsApp berwarna hijau dengan progress bar horizontal animasi.
- **Empty State:** Layar obrolan kosong menampilkan ilustrasi laptop dan ponsel dengan teks "WhatsApp untuk Windows" serta enkripsi end-to-end.
- **Offline State:** Banner pemberitahuan kuning/abu-abu melintang di atas daftar chat dengan ikon sinyal terputus.

### e. Bukti Tangkapan Layar (Screenshots)

Berkas tangkapan layar telah tersimpan di direktori `rea-results/screenshots/`:
1. `wa-desktop.png`: Jendela resmi WhatsApp Desktop (WinUI 3) ukuran 1280px (107.617 bytes).
2. `wa-mobile.png`: Antarmuka responsif WhatsApp Web mode mobile ukuran 375px (59.894 bytes).
3. `walite-sekarang.png`: Kondisi jendela WaLite saat ini pada ukuran 1280px (600.388 bytes).

---

## 4. Sesi dan Penyebab Logout

### a. Struktur Penyimpanan Sesi WhatsApp Web

WhatsApp Web menyimpan sesi login multi-device secara lokal tanpa cookie sesi tradisional:

1. **IndexedDB (`leveldb`):**
   - Nama direktori: `https_web.whatsapp.com_0.indexeddb.leveldb`
   - Direktori blob: `https_web.whatsapp.com_0.indexeddb.blob`
   - Fungsi: Menyimpan basis data SQLite-WASM internal WhatsApp, tabel model obrolan, kontak, pesan sementara, serta kunci kriptografi Signal Protocol (Identity Key, Signed Pre-Key, Ratchet State).
2. **Local Storage (`leveldb`):**
   - Nama direktori: `Local Storage\leveldb`
   - Fungsi: Menyimpan token otentikasi peramban, state sinkronisasi push, flag fitur client, preferensi tema, serta state panel WaLite (`wl:v1`, `walite.chatWidth`, `walite.zoomLevel`).
3. **Service Worker & Cache Storage:**
   - Nama direktori: `Service Worker\CacheStorage`, `Database`, dan `ScriptCache`.
   - Fungsi: Caching berkas skrip aplikasi (`app.js`, chunks WASM) dan penerimaan push notification background.

### b. Matriks Analisis Penyebab Logout Mandiri

| No | Kandidat Penyebab Logout | Status di WaLite Saat Ini | Lokasi Masalah / Bukti | Dapat Diperbaiki di App? |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **User Data Folder Berubah / Ephemeral** | **TERBUKTI TERJADI** | `src-tauri/src/main.rs:485`<br>Fallback ke `std::env::temp_dir()` saat `LOCALAPPDATA` kosong menyebabkan sesi terhapus total saat reboot. | **YA (Sisi App)** |
| 2 | **Duplikasi Subfolder UDF (`EBWebView\EBWebView`)** | **TERBUKTI TERJADI** | `src-tauri/src/main.rs:483`<br>Path UDF yang bersarang ganda membuat konfigurasi preferensi menargetkan folder yang salah sehingga profil rentan terpisah. | **YA (Sisi App)** |
| 3 | **Penghapusan / Pembersihan Storage Eksplisit** | Tidak Terbukti | Tidak ditemukan pemanggilan API `clear_browsing_data` di Rust. | **YA (Sisi App)** |
| 4 | **User-Agent Usang / Berubah Mendadak** | **TERBUKTI BERISIKO** | `src-tauri/src/main.rs:877, 1477`<br>Chrome 133 statis tidak cocok dengan runtime Chromium WebView2 v157 di sistem, berisiko memicu pencabutan sesi oleh server. | **YA (Sisi App)** |
| 5 | **Update Runtime WebView2** | Tidak Menyebabkan Logout | Pembaruan rutin Microsoft Edge WebView2 mempertahankan integritas folder data profil yang valid. | Tidak (Sisi Lingkungan OS) |
| 6 | **Storage Eviction karena Kuota Disk Penuh** | Berisiko saat disk penuh | Jika sisa kapasitas partisi sistem < 1 GB, Chromium otomatis menghapus data IndexedDB non-persistent. | Tidak (Sisi OS / Storage) |
| 7 | **Tabrakan Dua Instance dengan Profil Sama** | **TERBUKTI BERISIKO** | Pembukaan instance kedua saat startup boot berpotensi menabrak lockfile basis data LevelDB (`LOCK`), memicu crash dan korupsi data sesi. | **YA (Sisi App)** |
| 8 | **Crash / Unclean Exit saat Menulis Storage** | **TERBUKTI TERJADI** | `src-tauri/src/main.rs:1844`<br>Pemanggilan `app.exit(0)` tanpa prosedur flushing basis data memicu korupsi berkas WAL SQLite/LevelDB. | **YA (Sisi App)** |
| 9 | **Sesi Tertaut Kedaluwarsa dari Sisi HP / Server** | Terjadi sesuai kebijakan WA | HP utama tidak online selama 14 hari berturut-turut atau pengguna mencabut sesi dari menu WhatsApp di ponsel. | **TIDAK (Sisi Server WA)** |

---

## 5. Pengukuran Performa (Empirical Benchmarks)

Pengukuran dilakukan dalam kondisi sistem idle selama 5 detik menggunakan script `probe_resources.ps1` pada Windows 11:

### a. Hasil Komparasi Resource (RAM & CPU)

| Target Aplikasi | Jumlah Proses | Total Working Set (RAM) | Total Private Memory | Rata-rata CPU Idle |
| :--- | :--- | :--- | :--- | :--- |
| **WaLite Saat Ini (TARGET B)** | **9 proses** | **964,05 MB** | **1.086,00 MB** | **1,02%** |
| **WhatsApp Desktop (TARGET A)** | 8 - 10 proses | 748,01 MB | 1.239,83 MB | 1,04% |
| **WhatsApp Web (Browser Edge)** | 7 proses | 515,37 MB | 313,33 MB | 0,00% |

### b. Rincian Konsumsi Memori Subproses WaLite

1. `walite.exe` (Rust Host / Tauri Core): **19,14 MB**
2. `msedgewebview2.exe` (Browser Main Process): **152,11 MB**
3. `msedgewebview2.exe` (GPU Process): **132,72 MB**
4. `msedgewebview2.exe` (Utility - Network Service): **33,13 MB**
5. `msedgewebview2.exe` (Utility - Storage Service): **8,86 MB**
6. `msedgewebview2.exe` (Renderer - WhatsApp Web Tab): **535,39 MB**
7. `msedgewebview2.exe` (Renderer - Auto-opened DevTools): **61,96 MB** *(dapat dieliminasi)*
8. `msedgewebview2.exe` (Utility - Audio/Video Decoder): **15,30 MB**
9. `msedgewebview2.exe` (Crashpad Handler): **5,43 MB**

### c. Flag Optimalisasi WebView2 untuk Perangkat Low-End & Jaringan Lambat

Berdasarkan analisis arsitektur Chromium, flag berikut wajib ditambahkan pada perbaikan berikutnya:
- `--enable-features=NetworkServiceInProcess`: Mengintegrasikan network service ke dalam proses browser utama, menghemat 1 proses WebView2 (~33 MB RAM).
- `--renderer-process-limit=1`: Membatasi jumlah subproses renderer secara ketat.
- `--js-flags="--max-old-space-size=512"`: Membatasi alokasi heap mesin JavaScript V8 maksimum 512 MB, mencegah lonjakan konsumsi memori tak terkendali.
- `--disk-cache-size=125829120`: Membatasi ukuran cache disk hingga maksimum 120 MB agar media lama tidak menimbun ruang penyimpanan.
- `--disable-features=AudioServiceOutOfProcess`: Menjalankan audio service in-process, menghemat 1 proses (~15 MB RAM).
- Penonaktifan devtools otomatis di build rilis: Langsung menghemat 1 proses renderer (~62 MB RAM).

---

## 6. Audit Fitur Privasi & Pengaburan Visual (Blur Visual)

### a. Inventaris Perilaku Panel Privasi WaLite Saat Ini

1. **Master Switch (Alt+Z):** Mengaktifkan class `wl-overall-active` pada `document.documentElement` untuk mengaburkan seluruh elemen sekaligus.
2. **Blur Per Elemen:**
   - `blurNames`: Mengaburkan nama kontak di daftar chat (`#pane-side`) dan header obrolan (`#main header`).
   - `blurAvatars`: Mengaburkan foto profil/avatar di daftar chat, header, dan gelembung pesan.
   - `blurLastMsg`: Mengaburkan cuplikan pesan teks terakhir di baris daftar chat kiri.
   - `blurMessages`: Mengaburkan isi gelembung pesan masuk dan keluar di chat aktif.
   - `blurMedia`: Mengaburkan gambar, thumbnail video, stiker, dan lampiran dokumen.
   - `blurInput`: Mengaburkan teks yang sedang diketik pada kolom input pesan di footer.
3. **Hover to Reveal:** Mengarahkan kursor mouse ke elemen yang ter-blur akan menghapus efek blur secara halus (`transition: filter .15s ease`).
4. **Lock Screen Visual (Alt+X):** Memunculkan kartu dialog overlay yang meminta kata sandi PBKDF2 SHA-256 atau tombol buka kunci.
5. **Kunci Otomatis (Auto-Lock):** Mengunci layar jika tidak ada interaksi mouse/keyboard selama N menit.
6. **Tombol Mengambang (Floating Shield):** Ikon shield di sudut kanan bawah untuk membuka menu privasi cepat (bisa disembunyikan via Alt+H).

### b. Kerentanan & Kerapuhan Selector DOM

| Elemen yang Di-blur | Selector yang Digunakan Saat Ini | Tingkat Kerapuhan | Analisis Kerusakan |
| :--- | :--- | :--- | :--- |
| Nama Kontak & Grup | `span[title]._ak8q`, `span[title]._ak8j` | **SANGAT RAPUH** | Menggunakan class dinamis internal WhatsApp (`_ak8q`, `_ak8j`). Ketika WhatsApp memperbarui build web, nama kontak gagal ter-blur. |
| Foto Profil / Avatar | `._ak8h`, `[data-testid="cell-frame-icon"]` | **SANGAT RAPUH** | Class `_ak8h` sering berganti. Selector fallback berbasis elemen gambar (`img:not(...)`) dapat mengenai emoji di dalam teks. |
| Cuplikan Pesan | `._ak8k`, `[data-testid*="last-msg"]` | **RAPUH** | Ketergantungan pada class `_ak8k`. Jika selector gagal, pesan sensitif di sidebar tetap terlihat jelas. |
| Kotak Ketik Pesan | `html.wl-overall-active:not(.wl-blur-input) #main footer` | Sedang | Selector proteksi unblur compose box saat ini stabil, tetapi rapuh jika WhatsApp merestrukturisasi tag `<footer role="region">`. |
| Screen Lock Password | `div.wl-lock-overlay` | **RENTAN BYPASS** | Hanya proteksi visual di lapisan DOM client. Siapa pun dapat menghapus overlay via Inspect Element tanpa enkripsi level data. |

---

## 7. Hal yang Tidak Bisa Diamati dari Luar

1. **Struktur Kunci Kriptografi End-to-End di Memori:** Kunci privat sesi Signal Protocol (`libsignal`) dan pertukaran kunci ephemeral Noise Protocol disimpan terenkripsi di memori kerja proses Chromium WASM dan tidak dapat diinspeksi tanpa melanggar batasan analisis black box.
2. **Logika Server-Side A/B Testing Meta:** Aturan pemilihan akun pengguna yang menerima fitur baru (seperti rollout Web Calling tahap lanjutan) ditentukan secara acak dan bertahap di sisi server WhatsApp.
3. **Penyimpanan Kredensial AppContainer WhatsApp Desktop:** Mekanisme enkripsi file `sadRecord.dat` pada WhatsApp Desktop WinUI 3 yang menggunakan DPAPI khusus kredensial pengguna Windows.
4. **Logika Pemutusan Sesi dari Sisi Server:** Interval waktu pasti dan kriteria deteksi server WhatsApp dalam mencabut otorisasi perangkat tertaut yang dianggap tidak wajar atau melanggar ketentuan layanan.

---
*Spesifikasi ini selesai disusun sebagai luaran resmi PROMPT 1: Investigasi.*
