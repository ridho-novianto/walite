/* Walite Privacy */
(function () {
  'use strict';
  if (window.__WALITE_INITIALIZED__) return;
  window.__WALITE_INITIALIZED__ = true;

  const STORAGE_KEY = 'wl:v1';
  const TEAL = '#34937F';
  const GRAY = '#cfcfcf';

  const SELECTORS = {
    names: '#pane-side [dir="auto"],#pane-side span[title],#main header [dir="auto"]',
    avatars: '#pane-side img,#main header img,#main .message-in img,#main .message-out img,img[data-testid*="user-avatar"]',
    lastMessage: '#pane-side [dir="ltr"],#pane-side [role="row"] span:not([title])',
    messages: '#main .message-in,#main .message-out,#main [data-pre-plain-text],#main .selectable-text',
    media: '#main [data-testid*="media"],#main [data-testid*="audio"],#main img:not([alt*="emoji"]):not([data-plain-text]),#main video',
    input: '#main footer [contenteditable="true"],#main footer [data-testid="conversation-compose-box-input"],#main footer'
  };

  const DEFAULT_STATE = {
    version: 1, overall: true, blurNames: true, blurAvatars: true, blurLastMsg: true,
    blurMessages: true, blurMedia: true, blurInput: true, autoLock: false, autoLockMinutes: 10,
    showShieldBtn: true, hasPassword: false, passwordHash: null, passwordSalt: null
  };

  let state = Object.assign({}, DEFAULT_STATE);
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') state = Object.assign({}, DEFAULT_STATE, parsed);
    }
  } catch (e) {
    console.warn('[Walite] Storage load error:', e);
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { console.warn('[Walite] Storage save error:', e); }
  }

  async function hashPassword(pw, salt) {
    const enc = new TextEncoder();
    const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    const b = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, k, 256);
    return new Uint8Array(b);
  }

  function constantTimeCompare(a, b) {
    if (a.length !== b.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
    return d === 0;
  }

  function u8ToB64(u8) {
    let s = '';
    for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return window.btoa(s);
  }

  function b64ToU8(b64) {
    const s = window.atob(b64);
    const u8 = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8;
  }

  function scope(prefix, str) {
    return str.split(',').map((s) => prefix + ' ' + s.trim()).join(',');
  }

  const CSS_RULES = `${scope('html.wl-overall-active.wl-blur-names', SELECTORS.names)}{filter:blur(8px)!important;transition:filter .18s;}html.wl-overall-active.wl-blur-names #pane-side [role="row"]:hover [dir="auto"],html.wl-overall-active.wl-blur-names #pane-side [role="row"]:hover span[title],html.wl-overall-active.wl-blur-names #main header:hover [dir="auto"]{filter:none!important;}${scope('html.wl-overall-active.wl-blur-avatars', SELECTORS.avatars)}{filter:blur(9px)!important;transition:filter .18s;}html.wl-overall-active.wl-blur-avatars #pane-side [role="row"]:hover img,html.wl-overall-active.wl-blur-avatars #main header:hover img,html.wl-overall-active.wl-blur-avatars .message-in:hover img,html.wl-overall-active.wl-blur-avatars .message-out:hover img{filter:none!important;}${scope('html.wl-overall-active.wl-blur-lastmsg', SELECTORS.lastMessage)}{filter:blur(6px)!important;transition:filter .18s;}html.wl-overall-active.wl-blur-lastmsg #pane-side [role="row"]:hover [dir="ltr"],html.wl-overall-active.wl-blur-lastmsg #pane-side [role="row"]:hover span{filter:none!important;}${scope('html.wl-overall-active.wl-blur-messages', SELECTORS.messages)}{filter:blur(8px)!important;transition:filter .18s;}html.wl-overall-active.wl-blur-messages .message-in:hover,html.wl-overall-active.wl-blur-messages .message-out:hover{filter:none!important;}${scope('html.wl-overall-active.wl-blur-media', SELECTORS.media)}{filter:blur(14px)!important;transition:filter .18s;}html.wl-overall-active.wl-blur-media [data-testid*="media"]:hover,html.wl-overall-active.wl-blur-media .message-in:hover img,html.wl-overall-active.wl-blur-media .message-out:hover img{filter:none!important;}${scope('html.wl-overall-active.wl-blur-input', SELECTORS.input)}{filter:blur(7px)!important;transition:filter .18s;}html.wl-overall-active.wl-blur-input #main footer:hover,html.wl-overall-active.wl-blur-input #main footer:focus-within{filter:none!important;}.wl-shield-btn{position:fixed;bottom:22px;right:22px;width:40px;height:40px;border-radius:50%;background:${TEAL};box-shadow:0 3px 10px rgba(0,0,0,.28);cursor:pointer;z-index:99998;display:flex;align-items:center;justify-content:center;user-select:none;transition:transform .15s;}.wl-shield-btn:hover{transform:scale(1.08);}.wl-shield-btn.wl-hidden{display:none!important;}.wl-shield-btn svg{width:22px;height:22px;fill:none;stroke:#fff;stroke-width:2.2;}.wl-panel{position:fixed;bottom:72px;right:22px;width:315px;background:#fff;color:#111b21;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.2);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13px;z-index:99998;display:none;flex-direction:column;border:1px solid #e1e4e8;}.wl-panel.wl-open{display:flex;}.wl-panel-header{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#f7f9fa;border-bottom:1px solid #eaeaea;font-weight:600;}.wl-panel-header-actions{display:flex;align-items:center;gap:6px;}.wl-panel-btn-icon{background:none;border:none;font-size:14px;cursor:pointer;color:#667781;padding:2px 4px;border-radius:4px;}.wl-panel-btn-icon:hover{background:#e9edef;color:#111b21;}.wl-panel-close-btn{font-size:18px;line-height:1;}.wl-panel-body{padding:4px 14px 12px;display:flex;flex-direction:column;max-height:480px;overflow-y:auto;}.wl-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f2f5;}.wl-label-group{display:flex;flex-direction:column;}.wl-row-label{font-size:13px;font-weight:500;}.wl-row-subtext{font-size:11px;color:#667781;}.wl-switch{position:relative;display:inline-block;width:38px;height:20px;flex-shrink:0;}.wl-switch input{opacity:0;width:0;height:0;}.wl-slider{position:absolute;cursor:pointer;inset:0;background:${GRAY};transition:.2s;border-radius:20px;}.wl-slider:before{position:absolute;content:"";height:14px;width:14px;left:3px;bottom:3px;background:#fff;transition:.2s;border-radius:50%;}input:checked+.wl-slider{background:${TEAL};}input:checked+.wl-slider:before{transform:translateX(18px);}.wl-btn-lock{width:100%;background:${TEAL};color:#fff;border:none;padding:9px;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer;margin-top:10px;display:flex;align-items:center;justify-content:center;gap:6px;}.wl-link-action,.wl-link-about{background:none;border:none;cursor:pointer;padding:0;}.wl-link-action{color:${TEAL};font-size:12px;text-decoration:underline;margin-top:8px;align-self:flex-start;}.wl-link-about{color:#667781;font-size:11px;margin-top:8px;align-self:center;}.wl-number-input{width:44px;padding:3px 5px;border:1px solid #d1d7db;border-radius:6px;font-size:12px;text-align:center;}.wl-lock-overlay{position:fixed;inset:0;z-index:999999;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);background:rgba(17,27,33,.72);display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}.wl-lock-card{background:#fff;padding:24px 20px;border-radius:14px;box-shadow:0 16px 36px rgba(0,0,0,.35);width:310px;display:flex;flex-direction:column;align-items:center;text-align:center;}.wl-lock-icon{width:48px;height:48px;border-radius:50%;background:#e7f5f1;display:flex;align-items:center;justify-content:center;margin-bottom:12px;}.wl-lock-icon svg{width:24px;height:24px;fill:none;stroke:${TEAL};stroke-width:2.2;}.wl-lock-title{font-size:17px;font-weight:600;margin-bottom:4px;}.wl-lock-desc{font-size:12px;color:#667781;margin-bottom:14px;line-height:1.4;}.wl-lock-input{width:100%;padding:9px 11px;border:1px solid #d1d7db;border-radius:8px;font-size:13px;box-sizing:border-box;outline:none;margin-bottom:6px;}.wl-lock-error{font-size:12px;color:#ea0038;margin-bottom:8px;min-height:16px;}.wl-lock-submit-btn{width:100%;background:${TEAL};color:#fff;border:none;padding:9px;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer;}.wl-lock-submit-btn:disabled{background:#a0a6aa;cursor:not-allowed;}.wl-modal-overlay{position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}.wl-modal-card{background:#fff;padding:20px;border-radius:12px;width:320px;box-shadow:0 10px 28px rgba(0,0,0,.25);}.wl-modal-title{font-size:15px;font-weight:600;margin-bottom:8px;}.wl-modal-body{font-size:12px;color:#3b4a54;line-height:1.5;margin-bottom:14px;}.wl-modal-actions{display:flex;justify-content:flex-end;gap:8px;}.wl-modal-btn{padding:6px 12px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;}.wl-modal-btn-cancel{background:#f0f2f5;border:1px solid #d1d7db;color:#111b21;}.wl-modal-btn-primary{background:${TEAL};border:none;color:#fff;}`;

  function applyStyles() {
    try {
      if ('adoptedStyleSheets' in document) {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(CSS_RULES);
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
        return;
      }
    } catch (_) {}
    const s = el('style');
    s.textContent = CSS_RULES;
    (document.head || document.documentElement).appendChild(s);
  }

  function updateHtmlClasses() {
    const h = document.documentElement;
    h.classList.toggle('wl-overall-active', !!state.overall);
    [
      ['wl-blur-names', state.blurNames],
      ['wl-blur-avatars', state.blurAvatars],
      ['wl-blur-lastmsg', state.blurLastMsg],
      ['wl-blur-messages', state.blurMessages],
      ['wl-blur-media', state.blurMedia],
      ['wl-blur-input', state.blurInput]
    ].forEach(([c, v]) => h.classList.toggle(c, !!v));
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function createSvg(pathD) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', pathD);
    svg.appendChild(p);
    return svg;
  }

  function createSwitch(checked, onChange) {
    const l = el('label', 'wl-switch');
    const inp = el('input');
    inp.type = 'checkbox';
    inp.checked = !!checked;
    inp.addEventListener('change', () => onChange(inp.checked));
    l.appendChild(inp);
    l.appendChild(el('span', 'wl-slider'));
    return { container: l, input: inp };
  }

  function createRow(title, sub, ctrl) {
    const r = el('div', 'wl-row');
    const g = el('div', 'wl-label-group');
    g.appendChild(el('span', 'wl-row-label', title));
    if (sub) g.appendChild(el('span', 'wl-row-subtext', sub));
    r.appendChild(g);
    if (ctrl) r.appendChild(ctrl);
    return r;
  }

  let isPanelOpen = false;
  let isLocked = false;
  let lockOverlayEl = null;
  let shieldBtnEl = null;
  let shieldToggleInput = null;
  let failedAttempts = 0;
  let lastActiveTimestamp = Date.now();

  function triggerScreenLock() {
    if (isLocked) return;
    isLocked = true;
    showLockOverlay();
  }

  function updateShieldVisibility() {
    if (!shieldBtnEl) return;
    shieldBtnEl.classList.toggle('wl-hidden', !state.showShieldBtn);
    if (shieldToggleInput) shieldToggleInput.checked = !!state.showShieldBtn;
  }

  function toggleShieldVisibility() {
    state.showShieldBtn = !state.showShieldBtn;
    updateShieldVisibility();
    saveState();
  }

  function showLockOverlay() {
    if (lockOverlayEl && lockOverlayEl.parentNode) lockOverlayEl.parentNode.removeChild(lockOverlayEl);
    const ov = el('div', 'wl-lock-overlay');
    lockOverlayEl = ov;

    const cd = el('div', 'wl-lock-card');
    const ic = el('div', 'wl-lock-icon');
    ic.appendChild(createSvg('M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 6c1.66 0 3 1.34 3 3v2h1v5H8v-5h1v-2c0-1.66 1.34-3 3-3zm-1 5h2v-2c0-.55-.45-1-1-1s-1 .45-1 1v2z'));
    cd.appendChild(ic);

    cd.appendChild(el('div', 'wl-lock-title', 'Walite Terkunci'));
    cd.appendChild(el('div', 'wl-lock-desc', state.hasPassword
      ? 'Masukkan kata sandi untuk melanjutkan sesi WhatsApp Web.'
      : 'Layar privasi aktif. Klik tombol di bawah untuk membuka kunci.'));

    let pw = null, err = null;
    if (state.hasPassword) {
      pw = el('input', 'wl-lock-input');
      pw.type = 'password';
      pw.placeholder = 'Kata sandi pengunci layar';
      pw.autocomplete = 'off';
      cd.appendChild(pw);
      err = el('div', 'wl-lock-error');
      cd.appendChild(err);
    }

    const btn = el('button', 'wl-lock-submit-btn', 'Buka Kunci');
    cd.appendChild(btn);

    async function attemptUnlock() {
      if (!state.hasPassword) { unlockOk(); return; }
      const val = pw ? pw.value : '';
      if (!val) { if (err) err.textContent = 'Kata sandi tidak boleh kosong'; return; }
      btn.disabled = true;
      try {
        const salt = b64ToU8(state.passwordSalt);
        const stored = b64ToU8(state.passwordHash);
        const derived = await hashPassword(val, salt);
        if (constantTimeCompare(derived, stored)) {
          failedAttempts = 0;
          unlockOk();
        } else {
          failedAttempts++;
          const d = Math.min(Math.pow(2, failedAttempts - 1), 30);
          if (err) err.textContent = `Kata sandi salah. Tunggu ${d} detik...`;
          setTimeout(() => {
            if (err) err.textContent = 'Silakan coba lagi.';
            if (btn) btn.disabled = false;
          }, d * 1000);
        }
      } catch (e) {
        console.error('[Walite] Unlock error:', e);
        btn.disabled = false;
      }
    }

    function unlockOk() {
      isLocked = false;
      lastActiveTimestamp = Date.now();
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      lockOverlayEl = null;
    }

    btn.addEventListener('click', attemptUnlock);
    if (pw) pw.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptUnlock(); });
    ov.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Tab') {
        e.preventDefault();
        if (pw) pw.focus(); else btn.focus();
      }
    });

    ov.appendChild(cd);
    document.body.appendChild(ov);
    setTimeout(() => { if (pw) pw.focus(); else btn.focus(); }, 50);
  }

  function showPasswordDialog() {
    const mod = el('div', 'wl-modal-overlay');
    const cd = el('div', 'wl-modal-card');
    cd.appendChild(el('div', 'wl-modal-title', state.hasPassword ? 'Ubah / Hapus Sandi Layar' : 'Atur Sandi Layar Privasi'));
    cd.appendChild(el('div', 'wl-modal-body', 'Pengaman privasi layar visual, bukan enkripsi data penyimpanan lokal.'));

    let oldInp = null;
    if (state.hasPassword) {
      oldInp = el('input', 'wl-lock-input');
      oldInp.type = 'password';
      oldInp.placeholder = 'Kata sandi saat ini';
      cd.appendChild(oldInp);
    }

    const newInp = el('input', 'wl-lock-input');
    newInp.type = 'password';
    newInp.placeholder = state.hasPassword ? 'Sandi baru (kosongkan untuk hapus)' : 'Sandi baru';
    cd.appendChild(newInp);

    const err = el('div', 'wl-lock-error');
    cd.appendChild(err);

    const act = el('div', 'wl-modal-actions');
    const cBtn = el('button', 'wl-modal-btn wl-modal-btn-cancel', 'Batal');
    cBtn.addEventListener('click', () => { if (mod.parentNode) mod.parentNode.removeChild(mod); });
    act.appendChild(cBtn);

    const sBtn = el('button', 'wl-modal-btn wl-modal-btn-primary', 'Simpan');
    sBtn.addEventListener('click', async () => {
      sBtn.disabled = true;
      try {
        if (state.hasPassword && oldInp) {
          const s = b64ToU8(state.passwordSalt);
          const h = b64ToU8(state.passwordHash);
          const d = await hashPassword(oldInp.value, s);
          if (!constantTimeCompare(d, h)) {
            err.textContent = 'Kata sandi saat ini salah';
            sBtn.disabled = false;
            return;
          }
        }
        const val = newInp.value.trim();
        if (!val) {
          state.hasPassword = false;
          state.passwordHash = null;
          state.passwordSalt = null;
        } else {
          const s = crypto.getRandomValues(new Uint8Array(16));
          const h = await hashPassword(val, s);
          state.hasPassword = true;
          state.passwordHash = u8ToB64(h);
          state.passwordSalt = u8ToB64(s);
        }
        saveState();
        if (mod.parentNode) mod.parentNode.removeChild(mod);
      } catch (e) {
        console.error('[Walite] Save password error:', e);
        err.textContent = 'Gagal memproses kata sandi';
        sBtn.disabled = false;
      }
    });
    act.appendChild(sBtn);
    cd.appendChild(act);
    mod.appendChild(cd);
    document.body.appendChild(mod);
  }

  function showAboutDialog() {
    const mod = el('div', 'wl-modal-overlay');
    const cd = el('div', 'wl-modal-card');
    cd.appendChild(el('div', 'wl-modal-title', 'Tentang Walite'));

    const bd = el('div', 'wl-modal-body');
    const p1 = el('p', '', 'Walite v0.1.1');
    p1.style.fontWeight = '600';
    bd.appendChild(p1);

    const p2 = el('p', '', 'Copyright © 2026 Ridho Novianto');
    p2.style.margin = '4px 0 8px';
    bd.appendChild(p2);

    const p3 = el('p', '', 'Proyek independen. Tidak berafiliasi dengan WhatsApp LLC atau Meta Platforms, Inc.');
    p3.style.color = '#667781';
    p3.style.fontSize = '11px';
    bd.appendChild(p3);

    cd.appendChild(bd);

    const act = el('div', 'wl-modal-actions');
    const cBtn = el('button', 'wl-modal-btn wl-modal-btn-primary', 'Tutup');
    cBtn.addEventListener('click', () => { if (mod.parentNode) mod.parentNode.removeChild(mod); });
    act.appendChild(cBtn);
    cd.appendChild(act);

    mod.appendChild(cd);
    document.body.appendChild(mod);
  }

  function buildUI() {
    if (document.getElementById('wl-root-container')) return;

    const root = el('div');
    root.id = 'wl-root-container';

    // 1. Floating shield button (bottom: 22px; right: 22px;)
    const shieldBtn = el('div', 'wl-shield-btn');
    shieldBtn.title = 'Walite Privacy Panel (Alt+Z)';
    shieldBtn.appendChild(createSvg('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'));
    shieldBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isPanelOpen = !isPanelOpen;
      panel.classList.toggle('wl-open', isPanelOpen);
    });
    shieldBtnEl = shieldBtn;
    updateShieldVisibility();
    root.appendChild(shieldBtn);

    // 2. Popup Panel (bottom: 72px; right: 22px;)
    const panel = el('div', 'wl-panel');
    panel.addEventListener('click', (e) => { e.stopPropagation(); });

    const header = el('div', 'wl-panel-header');
    header.appendChild(el('span', '', 'Walite Privacy'));

    const headerActions = el('div', 'wl-panel-header-actions');
    const hideBtn = el('button', 'wl-panel-btn-icon', '–');
    hideBtn.title = 'Sembunyikan tombol mengambang (Alt+H)';
    hideBtn.addEventListener('click', () => toggleShieldVisibility());

    const closeBtn = el('button', 'wl-panel-btn-icon wl-panel-close-btn', '×');
    closeBtn.addEventListener('click', () => {
      isPanelOpen = false;
      panel.classList.remove('wl-open');
    });

    headerActions.appendChild(hideBtn);
    headerActions.appendChild(closeBtn);
    header.appendChild(headerActions);
    panel.appendChild(header);

    const body = el('div', 'wl-panel-body');

    // 1. Overall Switch (Alt+Z)
    const overallSwitch = createSwitch(state.overall, (val) => {
      state.overall = val;
      updateHtmlClasses();
      saveState();
    });
    body.appendChild(createRow('Overall Switch', '(Alt+Z)', overallSwitch.container));

    // 2. Granular Toggles
    const granularOptions = [
      { key: 'blurNames', label: 'Users/Group names', sub: '#pane-side & header' },
      { key: 'blurAvatars', label: 'Profile pictures', sub: 'Chat list, header, group' },
      { key: 'blurLastMsg', label: 'Last messages preview', sub: 'Chat list snippets' },
      { key: 'blurMessages', label: 'All messages in chat', sub: '.message-in & .message-out' },
      { key: 'blurMedia', label: 'Media preview', sub: 'Images, videos, docs' },
      { key: 'blurInput', label: 'Text input', sub: '#main footer' }
    ];

    granularOptions.forEach((opt) => {
      const sw = createSwitch(state[opt.key], (val) => {
        state[opt.key] = val;
        updateHtmlClasses();
        saveState();
      });
      body.appendChild(createRow(opt.label, opt.sub, sw.container));
    });

    // Toggle Floating Shield Button
    const shieldToggle = createSwitch(state.showShieldBtn, (val) => {
      state.showShieldBtn = val;
      updateShieldVisibility();
      saveState();
    });
    shieldToggleInput = shieldToggle.input;
    body.appendChild(createRow('Tombol Mengambang', 'Tampilkan ikon shield (Alt+H)', shieldToggle.container));

    // 3. Auto lock screen (N minutes)
    const autoLockGroup = el('div');
    autoLockGroup.style.display = 'flex';
    autoLockGroup.style.alignItems = 'center';
    autoLockGroup.style.gap = '6px';

    const minInput = el('input', 'wl-number-input');
    minInput.type = 'number';
    minInput.min = '1';
    minInput.max = '120';
    minInput.value = state.autoLockMinutes;
    minInput.addEventListener('change', () => {
      let v = parseInt(minInput.value, 10);
      if (isNaN(v) || v < 1) v = 1;
      state.autoLockMinutes = v;
      minInput.value = v;
      saveState();
    });

    const autoLockSwitch = createSwitch(state.autoLock, (val) => {
      state.autoLock = val;
      saveState();
    });

    autoLockGroup.appendChild(minInput);
    autoLockGroup.appendChild(autoLockSwitch.container);
    body.appendChild(createRow('Auto lock screen', `Kunci saat idle (${state.autoLockMinutes} mnt)`, autoLockGroup));

    // 4. Lock screen Button (Alt+X)
    const lockBtn = el('button', 'wl-btn-lock');
    const lockBtnSvg = createSvg('M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 6h2v2h-2zm0 4h2v6h-2z');
    lockBtnSvg.style.width = '16px';
    lockBtnSvg.style.height = '16px';
    lockBtnSvg.style.fill = 'none';
    lockBtnSvg.style.stroke = '#ffffff';
    lockBtn.appendChild(lockBtnSvg);
    lockBtn.appendChild(el('span', '', 'Lock screen (Alt+X)'));
    lockBtn.addEventListener('click', () => {
      isPanelOpen = false;
      panel.classList.remove('wl-open');
      triggerScreenLock();
    });
    body.appendChild(lockBtn);

    // 5. Link Set Lock Screen Password
    const setPwLink = el('button', 'wl-link-action', 'Set Lock Screen Password');
    setPwLink.addEventListener('click', () => showPasswordDialog());
    body.appendChild(setPwLink);

    // 6. About Dialog link
    const aboutLink = el('button', 'wl-link-about', 'About Walite');
    aboutLink.addEventListener('click', () => showAboutDialog());
    body.appendChild(aboutLink);

    panel.appendChild(body);
    root.appendChild(panel);
    document.body.appendChild(root);

    // Outside click closes panel
    document.addEventListener('click', () => {
      if (isPanelOpen) {
        isPanelOpen = false;
        panel.classList.remove('wl-open');
      }
    });
  }

  // Keyboard Shortcuts (Alt+Z: Toggle Panel, Alt+X: Lock Screen, Alt+H: Toggle Floating Shield)
  window.addEventListener('keydown', (e) => {
    if (e.altKey) {
      if (e.code === 'KeyZ') {
        e.preventDefault();
        const panel = document.querySelector('.wl-panel');
        if (panel) {
          isPanelOpen = !isPanelOpen;
          panel.classList.toggle('wl-open', isPanelOpen);
        }
      } else if (e.code === 'KeyX') {
        e.preventDefault();
        triggerScreenLock();
      } else if (e.code === 'KeyH') {
        e.preventDefault();
        toggleShieldVisibility();
      }
    }
  }, true);

  // Passive Activity Listeners for Idle Detection
  ['mousemove', 'keydown', 'mousedown', 'touchstart', 'wheel'].forEach((ev) => {
    window.addEventListener(ev, () => { lastActiveTimestamp = Date.now(); }, { passive: true });
  });

  setInterval(() => {
    if (state.autoLock && !isLocked) {
      const idleMs = Date.now() - lastActiveTimestamp;
      const thresholdMs = (state.autoLockMinutes || 10) * 60 * 1000;
      if (idleMs >= thresholdMs) triggerScreenLock();
    }
  }, 15000);

  function init() {
    applyStyles();
    updateHtmlClasses();
    buildUI();

    const bodyObserver = new MutationObserver(() => {
      if (!document.getElementById('wl-root-container')) buildUI();
    });
    if (document.body) bodyObserver.observe(document.body, { childList: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
