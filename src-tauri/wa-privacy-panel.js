/* WaLite Privacy */
(function () {
  'use strict';
  if (window.__WALITE_INITIALIZED__) return;
  window.__WALITE_INITIALIZED__ = true;

  const STORAGE_KEY = 'wl:v1';
  const TEAL = '#00a884';
  const GRAY = '#374248';

  const DEFAULT_STATE = {
    version: 2, overall: false, blurNames: true, blurAvatars: true, blurLastMsg: true,
    blurMessages: true, blurMedia: true, blurInput: false, autoLock: false, autoLockMinutes: 10,
    showShieldBtn: true, hasPassword: false, passwordHash: null, passwordSalt: null,
    saveAs: true, downloadNotif: true, autoStart: false, experimentalQuickReply: false, reducedMotion: true, customCSS: '', customJS: '', customCSSEnabled: false, customJSEnabled: false,
    notifShowName: true, notifShowPreview: true, notifShowPhoto: true, notifSound: true, respectDnd: true
  };

  let state = Object.assign({}, DEFAULT_STATE);
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        if (!parsed.version || parsed.version < 2) {
          parsed.overall = false;
          parsed.blurInput = false;
          parsed.version = 2;
        }
        state = Object.assign({}, DEFAULT_STATE, parsed);
      }
    }
  } catch (e) {
    console.warn(e);
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { console.warn(e); }
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

  function u8ToB64(u8) { return window.btoa(String.fromCharCode(...u8)); }
  function b64ToU8(b64) { return Uint8Array.from(window.atob(b64), (c) => c.charCodeAt(0)); }

  const CSS_RULES = `
/* Mouse pointer and layout containment on chat list items */
#pane-side :is(div[role="row"], [role="listitem"]) { cursor: pointer; contain: content; }

/* Reduced Motion (Kurangi Animasi) */
html.wl-reduced-motion *, html.wl-reduced-motion *::before, html.wl-reduced-motion *::after {
  transition: none !important;
  animation-duration: 0.001ms !important;
}
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation-duration: 0.001ms !important; }
}

/* 1. Contact & Group Names (blurNames) */
html.wl-overall-active.wl-blur-names #pane-side :is(div[role="row"], [role="listitem"]) :is([data-testid="cell-frame-title"], [data-testid="cell-frame-title"] *, span[title][dir="auto"], header span[dir="auto"], span[title]._ak8q, span[title]._ak8j) { filter: blur(8px) !important; }
html.wl-overall-active.wl-blur-names #pane-side :is(div[role="row"], [role="listitem"]):hover :is([data-testid="cell-frame-title"], [data-testid="cell-frame-title"] *, span[title], header span[dir="auto"]) { filter: none !important; }
html.wl-overall-active.wl-blur-names #main header :is(span[title], [dir="auto"], [data-testid="conversation-info-header-chat-title"]) { filter: blur(8px) !important; }
html.wl-overall-active.wl-blur-names #main header:hover :is(span[title], [dir="auto"], [data-testid="conversation-info-header-chat-title"]) { filter: none !important; }

/* 2. Profile Pictures (blurAvatars) */
html.wl-overall-active.wl-blur-avatars #pane-side :is(div[role="row"], [role="listitem"]) :is(
  img:not([data-plain-text], .emoji, [alt*="emoji"], [data-testid*="emoji"]),
  canvas,
  svg,
  [data-icon*="default"],
  [data-icon*="group"],
  [data-icon*="community"],
  [data-icon*="user"],
  [data-icon*="avatar"],
  [data-icon*="channel"],
  [data-icon*="newsletter"],
  [data-testid*="avatar"],
  [data-testid="cell-frame-icon"],
  [data-testid="cell-frame-icon"] *,
  div[style*="border-radius"] :is(img, svg, canvas),
  ._ak8h,
  ._ak8h *
):not([data-testid="cell-frame-title"] *):not(span[title] *):not([data-testid*="last-msg"] *):not([data-icon*="check"] *):not([data-icon*="pinned"] *):not([data-icon*="muted"] *):not([data-icon*="status"] *):not([data-icon*="down"] *):not([data-icon*="menu"] *):not([data-icon*="sticker"] *):not([data-icon*="audio"] *) { filter: blur(9px) !important; }
html.wl-overall-active.wl-blur-avatars #pane-side :is(div[role="row"], [role="listitem"]):hover :is(
  img:not([data-plain-text], .emoji, [alt*="emoji"], [data-testid*="emoji"]),
  canvas,
  svg,
  [data-icon*="default"],
  [data-icon*="group"],
  [data-icon*="community"],
  [data-icon*="user"],
  [data-icon*="avatar"],
  [data-icon*="channel"],
  [data-icon*="newsletter"],
  [data-testid*="avatar"],
  [data-testid="cell-frame-icon"],
  [data-testid="cell-frame-icon"] *,
  div[style*="border-radius"] :is(img, svg, canvas),
  ._ak8h,
  ._ak8h *
):not([data-testid="cell-frame-title"] *):not(span[title] *):not([data-testid*="last-msg"] *):not([data-icon*="check"] *):not([data-icon*="pinned"] *):not([data-icon*="muted"] *):not([data-icon*="status"] *):not([data-icon*="down"] *):not([data-icon*="menu"] *):not([data-icon*="sticker"] *):not([data-icon*="audio"] *) { filter: none !important; }
html.wl-overall-active.wl-blur-avatars #main header :is(
  img:not([data-plain-text], .emoji, [alt*="emoji"], [data-testid*="emoji"]),
  canvas,
  svg,
  [data-icon*="default"],
  [data-icon*="group"],
  [data-icon*="community"],
  [data-icon*="user"],
  [data-icon*="avatar"],
  [data-icon*="channel"],
  [data-icon*="newsletter"],
  [data-testid*="avatar"],
  [data-testid="cell-frame-icon"],
  [data-testid="cell-frame-icon"] *,
  div[style*="border-radius"] :is(img, svg, canvas),
  ._ak8h,
  ._ak8h *
):not([data-testid="cell-frame-title"] *):not(span[title] *):not([dir="auto"] *):not([data-icon*="down"] *):not([data-icon*="menu"] *) { filter: blur(9px) !important; }
html.wl-overall-active.wl-blur-avatars #main header:hover :is(
  img:not([data-plain-text], .emoji, [alt*="emoji"], [data-testid*="emoji"]),
  canvas,
  svg,
  [data-icon*="default"],
  [data-icon*="group"],
  [data-icon*="community"],
  [data-icon*="user"],
  [data-icon*="avatar"],
  [data-icon*="channel"],
  [data-icon*="newsletter"],
  [data-testid*="avatar"],
  [data-testid="cell-frame-icon"],
  [data-testid="cell-frame-icon"] *,
  div[style*="border-radius"] :is(img, svg, canvas),
  ._ak8h,
  ._ak8h *
):not([data-testid="cell-frame-title"] *):not(span[title] *):not([dir="auto"] *):not([data-icon*="down"] *):not([data-icon*="menu"] *) { filter: none !important; }
html.wl-overall-active.wl-blur-avatars #main div[role="row"] :is(
  img:not([data-plain-text], .emoji, [alt*="emoji"], [data-testid*="emoji"]),
  canvas,
  svg,
  [data-icon*="default"],
  [data-icon*="group"],
  [data-icon*="community"],
  [data-icon*="user"],
  [data-icon*="avatar"],
  ._ak8h,
  ._ak8h *
):not([data-testid*="msg-container"] *):not([data-icon*="check"] *):not([data-icon*="status"] *):not([data-icon*="audio"] *):not([data-icon*="mic"] *) { filter: blur(9px) !important; }
html.wl-overall-active.wl-blur-avatars #main div[role="row"]:hover :is(
  img:not([data-plain-text], .emoji, [alt*="emoji"], [data-testid*="emoji"]),
  canvas,
  svg,
  [data-icon*="default"],
  [data-icon*="group"],
  [data-icon*="community"],
  [data-icon*="user"],
  [data-icon*="avatar"],
  ._ak8h,
  ._ak8h *
):not([data-testid*="msg-container"] *):not([data-icon*="check"] *):not([data-icon*="status"] *):not([data-icon*="audio"] *):not([data-icon*="mic"] *) { filter: none !important; }

/* 3. Last Messages Preview in Pane-side (blurLastMsg) */
html.wl-overall-active.wl-blur-lastmsg #pane-side :is(div[role="row"], [role="listitem"]) :is([data-testid*="last-msg"], [data-testid*="last-msg"] *, [data-testid="cell-frame-secondary"], [data-testid="cell-frame-secondary"] *, span[dir="ltr"]:not([title]):not([data-testid="cell-frame-title"] *):not(header *), ._ak8k) { filter: blur(6px) !important; }
html.wl-overall-active.wl-blur-lastmsg #pane-side :is(div[role="row"], [role="listitem"]):hover :is([data-testid*="last-msg"], [data-testid*="last-msg"] *, [data-testid="cell-frame-secondary"], [data-testid="cell-frame-secondary"] *, span[dir="ltr"]:not([title]):not([data-testid="cell-frame-title"] *):not(header *), ._ak8k) { filter: none !important; }

/* 4. All Messages in Active Chat Room (blurMessages) */
html.wl-overall-active.wl-blur-messages #main :is(.message-in, .message-out, div[data-testid*="msg-container"]) { filter: blur(8px) !important; }
html.wl-overall-active.wl-blur-messages #main div[role="row"]:hover :is(.message-in, .message-out, div[data-testid*="msg-container"]),
html.wl-overall-active.wl-blur-messages #main :is(.message-in, .message-out, div[data-testid*="msg-container"]):hover { filter: none !important; }

/* 5. Media Preview in #main (blurMedia) */
html.wl-overall-active.wl-blur-media #main div[role="row"] :is([data-testid*="media"], [data-testid*="audio"], [data-testid*="video"], [data-testid*="sticker"], [data-testid*="document"], [data-testid*="doc"], [data-testid*="file"], [data-testid*="attachment"], div:has(> span[data-icon*="document"]), div:has(> span[data-icon*="attach"]), div:has(> span[data-icon*="audio-file"]), img:not([alt*="emoji"],[data-plain-text],.emoji,[data-testid*="emoji"]), video, canvas) { filter: blur(12px) !important; }
html.wl-overall-active.wl-blur-media #main div[role="row"]:hover :is([data-testid*="media"], [data-testid*="audio"], [data-testid*="video"], [data-testid*="sticker"], [data-testid*="document"], [data-testid*="doc"], [data-testid*="file"], [data-testid*="attachment"], img, video, canvas),
html.wl-overall-active.wl-blur-media #main :is([data-testid*="media"], [data-testid*="audio"], [data-testid*="video"], [data-testid*="sticker"], [data-testid*="document"], [data-testid*="doc"], [data-testid*="file"], [data-testid*="attachment"], img, video, canvas):hover { filter: none !important; }

/* 6. Compose Input in Footer (blurInput) */
html.wl-overall-active:not(.wl-blur-input) #main footer, html.wl-overall-active:not(.wl-blur-input) #main footer * { filter: none !important; }
html.wl-overall-active.wl-blur-input #main footer :is([contenteditable="true"], [data-testid*="compose"], div[role="textbox"]) { filter: blur(7px) !important; }
html.wl-overall-active.wl-blur-input #main footer:is(:hover, :focus-within) :is([contenteditable="true"], [data-testid*="compose"], div[role="textbox"]) { filter: none !important; }

/* Safety & Cleanup */
:is([data-testid*="panel-emoji"],[data-testid*="emoji-panel"],[data-testid*="picker"]),:is([data-testid*="panel-emoji"],[data-testid*="emoji-panel"],[data-testid*="picker"]) *{filter:none!important;}
#pane-side [data-testid*="upsell"],#pane-side [data-testid*="banner"]{display:none!important;height:0!important;max-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;pointer-events:none!important;}
.wl-shield-btn{position:fixed;bottom:22px;right:22px;width:42px;height:42px;border-radius:50%;background:${TEAL};box-shadow:0 4px 14px rgba(0,0,0,.4);cursor:pointer;z-index:99998;display:flex;align-items:center;justify-content:center;user-select:none;transition:transform .15s,opacity .2s;}.wl-shield-btn:hover{transform:scale(1.08);}.wl-shield-btn.wl-hidden{display:none!important;opacity:0!important;pointer-events:none!important;}.wl-shield-btn svg{width:22px;height:22px;fill:none;stroke:#fff;stroke-width:2.2;}
.wl-panel{position:fixed;bottom:74px;right:22px;width:320px;background:rgba(32,44,51,.96);backdrop-filter:blur(16px);color:#e9edef;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.5);font-family:inherit;font-size:13px;z-index:99998;display:none;flex-direction:column;border:1px solid rgba(134,150,160,.18);}
.wl-panel.wl-open{display:flex!important;}
.wl-panel-header{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:rgba(17,27,33,.85);border-bottom:1px solid #222e35;font-weight:600;color:#e9edef;}
.wl-panel-header-actions{display:flex;align-items:center;gap:6px;}
.wl-panel-btn-icon{background:none;border:none;font-size:14px;cursor:pointer;color:#8696a0;padding:2px 6px;border-radius:4px;transition:background .15s,color .15s;}
.wl-panel-btn-icon:hover{background:#202c33;color:#e9edef;}
.wl-panel-close-btn{font-size:18px;line-height:1;}
.wl-panel-body{padding:4px 14px 12px;display:flex;flex-direction:column;max-height:480px;overflow-y:auto;}
.wl-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222e35;}
.wl-label-group{display:flex;flex-direction:column;}
.wl-row-label{font-size:13px;font-weight:500;color:#e9edef;}
.wl-row-subtext{font-size:11px;color:#8696a0;}
.wl-switch{position:relative;display:inline-block;width:38px;height:20px;flex-shrink:0;}
.wl-switch input{opacity:0;width:0;height:0;}
.wl-slider{position:absolute;cursor:pointer;inset:0;background:${GRAY};transition:.2s;border-radius:20px;}
.wl-slider:before{position:absolute;content:"";height:14px;width:14px;left:3px;bottom:3px;background:#fff;transition:.2s;border-radius:50%;}
input:checked+.wl-slider{background:${TEAL};}
input:checked+.wl-slider:before{transform:translateX(18px);}
:is(.wl-btn-lock,.wl-lock-submit-btn,.wl-modal-btn-primary){background:${TEAL};color:#111b21;border:none;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer;}
:is(.wl-btn-lock,.wl-lock-submit-btn){width:100%;padding:9px;}
:is(.wl-btn-lock,.wl-lock-submit-btn):hover{background:#06cf9c;}
.wl-btn-lock{margin-top:10px;display:flex;align-items:center;justify-content:center;gap:6px;}

.wl-link-action,.wl-link-about{background:none;border:none;cursor:pointer;padding:0;}
.wl-link-action{color:${TEAL};font-size:12px;text-decoration:underline;margin-top:8px;align-self:flex-start;}
.wl-link-about{color:#8696a0;font-size:11px;margin-top:8px;align-self:center;}
.wl-link-about:hover{color:#e9edef;}
.wl-number-input{width:44px;padding:3px 5px;background:#111b21;color:#e9edef;border:1px solid #2a3942;border-radius:6px;font-size:12px;text-align:center;}
:is(.wl-lock-overlay,.wl-modal-overlay){position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;font-family:inherit;}
.wl-lock-overlay{backdrop-filter:blur(18px);background:rgba(11,20,26,.8);}
.wl-modal-overlay{background:rgba(0,0,0,.6);}
:is(.wl-lock-card,.wl-modal-card){background:#202c33;color:#e9edef;border-radius:14px;box-shadow:0 16px 40px rgba(0,0,0,.6);border:1px solid #2a3942;box-sizing:border-box;}
.wl-lock-card{padding:24px 20px;width:310px;display:flex;flex-direction:column;align-items:center;text-align:center;}
.wl-modal-card{padding:20px;width:320px;}
.wl-lock-icon{width:48px;height:48px;border-radius:50%;background:rgba(0,168,132,.15);display:flex;align-items:center;justify-content:center;margin-bottom:12px;}
.wl-lock-icon svg{width:24px;height:24px;fill:none;stroke:${TEAL};stroke-width:2.2;}
.wl-lock-title{font-size:17px;font-weight:600;margin-bottom:4px;color:#e9edef;}
.wl-lock-desc{font-size:12px;color:#8696a0;margin-bottom:14px;line-height:1.4;}
.wl-lock-input{width:100%;padding:9px 11px;background:#111b21;color:#e9edef;border:1px solid #2a3942;border-radius:8px;font-size:13px;box-sizing:border-box;outline:none;margin-bottom:6px;}
.wl-lock-error{font-size:12px;color:#f15c6d;margin-bottom:8px;min-height:16px;}
.wl-lock-submit-btn:disabled{background:#374248;color:#8696a0;cursor:not-allowed;}
.wl-modal-title{font-size:15px;font-weight:600;margin-bottom:8px;color:#e9edef;}
.wl-modal-body{font-size:12px;color:#8696a0;line-height:1.5;margin-bottom:14px;}
.wl-modal-actions{display:flex;justify-content:flex-end;gap:8px;}
.wl-modal-btn{padding:6px 12px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;}
.wl-modal-btn-cancel{background:#111b21;border:1px solid #2a3942;color:#8696a0;}`;

  function applyStyles() {
    let s = document.getElementById('walite-privacy-css');
    if (!s) {
      s = document.createElement('style');
      s.id = 'walite-privacy-css';
      (document.head || document.documentElement).appendChild(s);
    }
    s.textContent = CSS_RULES;
    try {
      if ('adoptedStyleSheets' in document) {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(CSS_RULES);
        if (!document.adoptedStyleSheets.some(x => x._walite)) {
          sheet._walite = true;
          document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
        }
      }
    } catch (_) {}

    // Apply User Custom CSS (ZapZap Feature)
    applyCustomCSS();
  }

  function applyCustomCSS() {
    let customEl = document.getElementById('walite-custom-user-css');
    if (!state.customCSSEnabled || !state.customCSS) {
      if (customEl) customEl.remove();
      return;
    }
    if (!customEl) {
      customEl = document.createElement('style');
      customEl.id = 'walite-custom-user-css';
      (document.head || document.documentElement).appendChild(customEl);
    }
    customEl.textContent = state.customCSS;
  }

  function applyCustomJS() {
    if (!state.customJSEnabled || !state.customJS) return;
    try {
      const fn = new Function(state.customJS);
      fn();
    } catch (err) {
      console.warn('[WaLite Custom JS Error]', err);
    }
  }

  function updateHtmlClasses() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) Object.assign(state, JSON.parse(saved));
    } catch (_) {}

    const h = document.documentElement;
    h.classList.toggle('wl-overall-active', !!state.overall);
    h.classList.toggle('wl-reduced-motion', state.reducedMotion !== false);
    [
      ['wl-blur-names', state.blurNames],
      ['wl-blur-avatars', state.blurAvatars],
      ['wl-blur-lastmsg', state.blurLastMsg],
      ['wl-blur-messages', state.blurMessages],
      ['wl-blur-media', state.blurMedia],
      ['wl-blur-input', state.blurInput]
    ].forEach(([c, v]) => h.classList.toggle(c, !!v));
  }
  window.waliteUpdateHtmlClasses = updateHtmlClasses;

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
    if (!shieldBtnEl) {
      shieldBtnEl = document.querySelector('.wl-shield-btn');
    }
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
    cd.append(ic, el('div', 'wl-lock-title', 'WaLite Terkunci'));
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
        console.error(e);
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
    cd.append(el('div', 'wl-modal-title', state.hasPassword ? 'Ubah / Hapus Sandi Layar' : 'Atur Sandi Layar Privasi'));
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
        console.error(e);
        err.textContent = 'Gagal memproses kata sandi';
        sBtn.disabled = false;
      }
    });
    act.appendChild(sBtn);
    cd.append(act); mod.append(cd); document.body.appendChild(mod);
  }

  function showAboutDialog() {
    const mod = el('div', 'wl-modal-overlay');
    const cd = el('div', 'wl-modal-card');
    cd.append(el('div', 'wl-modal-title', 'Tentang WaLite'));

    const bd = el('div', 'wl-modal-body');
    const p1 = el('p', '', 'WaLite v0.1.13');
    p1.style.fontWeight = '600';
    p1.style.color = '#e9edef';
    bd.appendChild(p1);

    const p2 = el('p', '', 'Copyright © 2026 Ridho Novianto');
    p2.style.margin = '4px 0 8px';
    bd.appendChild(p2);

    const p3 = el('p', '', 'Proyek independen. Tidak berafiliasi dengan WhatsApp LLC atau Meta Platforms, Inc.');
    p3.style.color = '#8696a0';
    p3.style.fontSize = '11px';
    bd.appendChild(p3);

    cd.appendChild(bd);

    const act = el('div', 'wl-modal-actions');
    const cBtn = el('button', 'wl-modal-btn wl-modal-btn-primary', 'Tutup');
    cBtn.addEventListener('click', () => { if (mod.parentNode) mod.parentNode.removeChild(mod); });
    act.appendChild(cBtn);
    cd.append(act); mod.append(cd); document.body.appendChild(mod);
  }

  function showCustomCodeDialog() {
    const mod = el('div', 'wl-modal-overlay');
    const cd = el('div', 'wl-modal-card');
    cd.style.width = '420px';
    cd.append(el('div', 'wl-modal-title', 'Custom CSS & JavaScript (ZapZap)'));

    const bd = el('div', 'wl-modal-body');
    const desc = el('p', '', 'Tambahkan gaya tampilan CSS atau skrip JS kustom Anda sendiri.');
    desc.style.marginBottom = '10px';
    bd.appendChild(desc);

    const cssLabel = el('label', '', 'Custom CSS:');
    cssLabel.style.cssText = 'font-size:12px; font-weight:600; color:#e9edef; display:block; margin-bottom:4px;';
    const cssTextarea = el('textarea', '', state.customCSS || '');
    cssTextarea.placeholder = '/* Contoh: body { filter: contrast(105%); } */';
    cssTextarea.style.cssText = 'width:100%; height:80px; box-sizing:border-box; background:#111b21; color:#e9edef; border:1px solid #2a3942; border-radius:6px; padding:6px; font-family:monospace; font-size:11px; resize:vertical; outline:none; margin-bottom:10px;';

    const jsLabel = el('label', '', 'Custom JavaScript:');
    jsLabel.style.cssText = 'font-size:12px; font-weight:600; color:#e9edef; display:block; margin-bottom:4px;';
    const jsTextarea = el('textarea', '', state.customJS || '');
    jsTextarea.placeholder = '// Skrip kustom Anda di sini...';
    jsTextarea.style.cssText = 'width:100%; height:80px; box-sizing:border-box; background:#111b21; color:#e9edef; border:1px solid #2a3942; border-radius:6px; padding:6px; font-family:monospace; font-size:11px; resize:vertical; outline:none; margin-bottom:10px;';

    bd.appendChild(cssLabel);
    bd.appendChild(cssTextarea);
    bd.appendChild(jsLabel);
    bd.appendChild(jsTextarea);
    cd.appendChild(bd);

    const act = el('div', 'wl-modal-actions');
    const cancelBtn = el('button', 'wl-modal-btn wl-modal-btn-cancel', 'Batal');
    cancelBtn.addEventListener('click', () => { if (mod.parentNode) mod.parentNode.removeChild(mod); });

    const saveBtn = el('button', 'wl-modal-btn wl-modal-btn-primary', 'Simpan & Terapkan');
    saveBtn.addEventListener('click', () => {
      state.customCSS = cssTextarea.value;
      state.customCSSEnabled = !!cssTextarea.value.trim();
      state.customJS = jsTextarea.value;
      state.customJSEnabled = !!jsTextarea.value.trim();
      saveState();
      applyCustomCSS();
      applyCustomJS();
      if (mod.parentNode) mod.parentNode.removeChild(mod);
    });

    act.appendChild(cancelBtn);
    act.appendChild(saveBtn);
    cd.append(act); mod.append(cd); document.body.appendChild(mod);
  }

  function buildUI() {
    if (document.getElementById('wl-root-container')) return;

    const root = el('div');
    root.id = 'wl-root-container';
    const shieldBtn = el('div', 'wl-shield-btn');
    shieldBtn.title = 'WaLite Privacy Panel (Alt+Z)';
    shieldBtn.appendChild(createSvg('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'));
    shieldBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof window.waliteOpenSettings === 'function') {
        window.waliteOpenSettings('privacy');
      }
    });
    shieldBtnEl = shieldBtn;
    updateShieldVisibility();
    root.appendChild(shieldBtn);
    const panel = el('div', 'wl-panel');
    panel.addEventListener('click', (e) => { e.stopPropagation(); });

    const header = el('div', 'wl-panel-header');
    header.appendChild(el('span', '', 'WaLite Privacy'));

    const headerActions = el('div', 'wl-panel-header-actions');
    const hideBtn = el('button', 'wl-panel-btn-icon', '–');
    hideBtn.title = 'Sembunyikan tombol mengambang (Alt+H)';
    hideBtn.addEventListener('click', () => toggleShieldVisibility());

    const closeBtn = el('button', 'wl-panel-btn-icon wl-panel-close-btn', '×');
    closeBtn.addEventListener('click', () => {
      isPanelOpen = false;
      panel.classList.remove('wl-open');
    });

    headerActions.append(hideBtn, closeBtn);
    header.appendChild(headerActions);
    panel.append(header); const body = el('div', 'wl-panel-body');
    const overallSwitch = createSwitch(state.overall, (val) => {
      state.overall = val;
      updateHtmlClasses();
      saveState();
    });
    body.appendChild(createRow('Overall Switch', '(Alt+Z)', overallSwitch.container));
    [
      ['blurNames', 'Users/Group names', '#pane-side & header'],
      ['blurAvatars', 'Profile pictures', 'Photos, initials & placeholders'],
      ['blurLastMsg', 'Last messages preview', 'Chat list snippets'],
      ['blurMessages', 'All messages in chat', '.message-in & .message-out'],
      ['blurMedia', 'Media preview', 'Images, videos, docs'],
      ['blurInput', 'Text input', '#main footer']
    ].forEach(([k, label, sub]) => {
      const sw = createSwitch(state[k], (val) => {
        state[k] = val;
        updateHtmlClasses();
        saveState();
      });
      body.appendChild(createRow(label, sub, sw.container));
    });
    const shieldToggle = createSwitch(state.showShieldBtn, (val) => {
      state.showShieldBtn = val;
      updateShieldVisibility();
      saveState();
    });
    shieldToggleInput = shieldToggle.input;
    body.appendChild(createRow('Tombol Mengambang', 'Tampilkan ikon shield (Alt+H)', shieldToggle.container));

    const motionToggle = createSwitch(state.reducedMotion !== false, (val) => {
      state.reducedMotion = val;
      updateHtmlClasses();
      saveState();
    });
    body.appendChild(createRow('Kurangi Animasi', 'Matikan transisi berat agar scroll responsif', motionToggle.container));

    function sendDownloadSetting(key, val) {
      if (typeof window.dispatchWaliteAction === 'function') {
        window.dispatchWaliteAction('set-setting', { key: key, val: String(val) });
      } else {
        try {
          const q = new URLSearchParams({ key: key, val: String(val), _t: String(Date.now()) }).toString();
          window.location.href = 'walite-action://set-setting?' + q;
        } catch (_) {}
      }
    }

    const saveAsSwitch = createSwitch(state.saveAs !== false, (val) => {
      state.saveAs = val;
      saveState();
      sendDownloadSetting('saveAs', val);
    });
    body.appendChild(createRow('Tanya Lokasi Unduh', 'Dialog Save As sebelum mengunduh', saveAsSwitch.container));

    const dlNotifSwitch = createSwitch(state.downloadNotif !== false, (val) => {
      state.downloadNotif = val;
      saveState();
      sendDownloadSetting('downloadNotif', val);
    });
    body.appendChild(createRow('Notifikasi Unduhan', 'Opsi buka berkas & folder saat selesai', dlNotifSwitch.container));

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

    autoLockGroup.append(minInput, autoLockSwitch.container);
    body.appendChild(createRow('Kunci Otomatis', `Kunci saat idle (${state.autoLockMinutes} mnt)`, autoLockGroup));

    /* ZapZap Notification Privacy Settings */
    const notifSectionHeader = el('div');
    notifSectionHeader.style.cssText = 'font-size:11px; font-weight:700; color:#00a884; margin-top:10px; margin-bottom:2px; text-transform:uppercase; letter-spacing:0.5px;';
    notifSectionHeader.textContent = 'Privasi Notifikasi (ZapZap)';
    body.appendChild(notifSectionHeader);

    const notifNameSwitch = createSwitch(state.notifShowName !== false, (val) => {
      state.notifShowName = val;
      saveState();
    });
    body.appendChild(createRow('Nama Kontak', 'Tampilkan nama pengirim di notifikasi', notifNameSwitch.container));

    const notifMsgSwitch = createSwitch(state.notifShowPreview !== false, (val) => {
      state.notifShowPreview = val;
      saveState();
    });
    body.appendChild(createRow('Pratinjau Pesan', 'Tampilkan isi pesan teks di notifikasi', notifMsgSwitch.container));

    const notifPhotoSwitch = createSwitch(state.notifShowPhoto !== false, (val) => {
      state.notifShowPhoto = val;
      saveState();
    });
    body.appendChild(createRow('Foto Profil', 'Tampilkan avatar pengirim di notifikasi', notifPhotoSwitch.container));

    const notifSoundSwitch = createSwitch(state.notifSound !== false, (val) => {
      state.notifSound = val;
      window.__waliteAudioMuted = !val;
      saveState();
    });
    body.appendChild(createRow('Suara Notifikasi', 'Bunyikan nada saat pesan masuk', notifSoundSwitch.container));

    const dndSwitch = createSwitch(state.respectDnd !== false, (val) => {
      state.respectDnd = val;
      saveState();
    });
    body.appendChild(createRow('Mode Hening / DND', 'Heningkan nada saat Jangan Ganggu', dndSwitch.container));

    /* ZapZap Quick Feature Buttons */
    const zapzapActionGroup = el('div');
    zapzapActionGroup.style.cssText = 'display:flex; flex-direction:column; gap:6px; margin-top:8px; border-top:1px solid #222e35; padding-top:10px;';

    const directChatBtn = el('button', 'wl-btn-action');
    directChatBtn.style.cssText = 'background:#202c33; border:1px solid #2a3942; color:#e9edef; padding:8px 10px; border-radius:8px; font-size:12px; font-weight:500; cursor:pointer; display:flex; align-items:center; gap:8px; width:100%;';
    directChatBtn.innerHTML = `
      <svg style="width:15px;height:15px;fill:none;stroke:#00a884;stroke-width:2" viewBox="0 0 24 24">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
      </svg>
      <span>Kirim Pesan ke Nomor Baru (Ctrl+M)</span>
    `;
    directChatBtn.addEventListener('click', () => {
      isPanelOpen = false;
      panel.classList.remove('wl-open');
      if (typeof window.waliteOpenDirectChat === 'function') window.waliteOpenDirectChat();
    });

    const compactChatBtn = el('button', 'wl-btn-action');
    compactChatBtn.style.cssText = 'background:#202c33; border:1px solid #2a3942; color:#e9edef; padding:8px 10px; border-radius:8px; font-size:12px; font-weight:500; cursor:pointer; display:flex; align-items:center; gap:8px; width:100%;';
    compactChatBtn.innerHTML = `
      <svg style="width:15px;height:15px;fill:none;stroke:#00a884;stroke-width:2" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="9" y1="3" x2="9" y2="21"/>
      </svg>
      <span>Ringkas / Luaskan Chat List (Ctrl+Alt+C)</span>
    `;
    compactChatBtn.addEventListener('click', () => {
      if (typeof window.waliteToggleCompactChat === 'function') window.waliteToggleCompactChat();
    });

    const curSavedZoom = Math.round((parseFloat(localStorage.getItem('walite.zoomLevel')) || 1.0) * 100);
    const zoomGroup = el('div');
    zoomGroup.style.cssText = 'display:flex; align-items:center; justify-content:space-between; background:#111b21; border:1px solid #2a3942; border-radius:8px; padding:4px 8px;';
    zoomGroup.innerHTML = `
      <span style="font-size:12px; color:#8696a0;">Ukuran Tampilan (Zoom)</span>
      <div style="display:flex; gap:4px;">
        <button id="wl-zoom-out" style="background:#202c33; border:none; color:#e9edef; padding:2px 8px; border-radius:4px; font-size:13px; font-weight:bold; cursor:pointer;">-</button>
        <button id="wl-zoom-reset" class="wl-zoom-display" style="background:#202c33; border:none; color:#00a884; font-weight:700; padding:2px 6px; border-radius:4px; font-size:11px; cursor:pointer;">${curSavedZoom}%</button>
        <button id="wl-zoom-in" style="background:#202c33; border:none; color:#e9edef; padding:2px 8px; border-radius:4px; font-size:13px; font-weight:bold; cursor:pointer;">+</button>
      </div>
    `;
    zoomGroup.querySelector('#wl-zoom-out').addEventListener('click', () => {
      if (typeof window.waliteZoomOut === 'function') window.waliteZoomOut();
    });
    zoomGroup.querySelector('#wl-zoom-reset').addEventListener('click', () => {
      if (typeof window.waliteResetZoom === 'function') window.waliteResetZoom();
    });
    zoomGroup.querySelector('#wl-zoom-in').addEventListener('click', () => {
      if (typeof window.waliteZoomIn === 'function') window.waliteZoomIn();
    });

    const nativeLockBtn = el('button', 'wl-btn-action');
    nativeLockBtn.style.cssText = 'background:#202c33; border:1px solid #2a3942; color:#e9edef; padding:8px 10px; border-radius:8px; font-size:12px; font-weight:500; cursor:pointer; display:flex; align-items:center; gap:8px; width:100%;';
    nativeLockBtn.innerHTML = `
      <svg style="width:15px;height:15px;fill:none;stroke:#00a884;stroke-width:2" viewBox="0 0 24 24">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0110 0v4"/>
      </svg>
      <span>Kunci Resmi WhatsApp (Ctrl+Alt+L)</span>
    `;
    nativeLockBtn.addEventListener('click', () => {
      isPanelOpen = false;
      panel.classList.remove('wl-open');
      const ev = new KeyboardEvent('keydown', { key: 'l', code: 'KeyL', ctrlKey: true, altKey: true, bubbles: true });
      document.dispatchEvent(ev);
    });

    const shortcutsBtn = el('button', 'wl-btn-action');
    shortcutsBtn.style.cssText = 'background:#202c33; border:1px solid #2a3942; color:#e9edef; padding:8px 10px; border-radius:8px; font-size:12px; font-weight:500; cursor:pointer; display:flex; align-items:center; gap:8px; width:100%;';
    shortcutsBtn.innerHTML = `
      <svg style="width:15px;height:15px;fill:none;stroke:#00a884;stroke-width:2" viewBox="0 0 24 24">
        <rect x="2" y="4" width="20" height="16" rx="2" ry="2"/>
        <line x1="6" y1="8" x2="6" y2="8"/>
        <line x1="10" y1="8" x2="10" y2="8"/>
        <line x1="14" y1="8" x2="14" y2="8"/>
        <line x1="18" y1="8" x2="18" y2="8"/>
        <line x1="7" y1="16" x2="17" y2="16"/>
      </svg>
      <span>Pintasan Keyboard (Ctrl+/)</span>
    `;
    shortcutsBtn.addEventListener('click', () => {
      isPanelOpen = false;
      panel.classList.remove('wl-open');
      if (typeof window.waliteOpenShortcutsGuide === 'function') window.waliteOpenShortcutsGuide();
    });

    const accountBtn = el('button', 'wl-btn-action');
    accountBtn.style.cssText = 'background:#202c33; border:1px solid #2a3942; color:#e9edef; padding:8px 10px; border-radius:8px; font-size:12px; font-weight:500; cursor:pointer; display:flex; align-items:center; gap:8px; width:100%;';
    accountBtn.innerHTML = `
      <svg style="width:15px;height:15px;fill:none;stroke:#00a884;stroke-width:2" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87"/>
        <path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
      <span>Buka Akun 2 (Multi-Akun ZapZap)</span>
    `;
    accountBtn.addEventListener('click', () => {
      isPanelOpen = false;
      panel.classList.remove('wl-open');
      if (typeof window.dispatchWaliteAction === 'function') {
        window.dispatchWaliteAction('open-account', { id: '2' });
      } else {
        try { window.location.href = 'walite-action://open-account?id=2'; } catch (_) {}
      }
    });

    zapzapActionGroup.append(directChatBtn, compactChatBtn, accountBtn, zoomGroup, nativeLockBtn, shortcutsBtn);
    body.appendChild(zapzapActionGroup);

    const lockBtn = el('button', 'wl-btn-lock');
    const lockBtnSvg = createSvg('M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 6h2v2h-2zm0 4h2v6h-2z');
    lockBtnSvg.style.width = '16px';
    lockBtnSvg.style.height = '16px';
    lockBtnSvg.style.fill = 'none';
    lockBtnSvg.style.stroke = '#111b21';
    lockBtn.appendChild(lockBtnSvg);
    lockBtn.appendChild(el('span', '', 'Lock screen (Alt+X)'));
    lockBtn.addEventListener('click', () => {
      isPanelOpen = false;
      panel.classList.remove('wl-open');
      triggerScreenLock();
    });
    body.appendChild(lockBtn);
    const setPwLink = el('button', 'wl-link-action', 'Set Lock Screen Password');
    setPwLink.addEventListener('click', () => showPasswordDialog());
    body.appendChild(setPwLink);
    const customCodeLink = el('button', 'wl-link-action', 'Custom CSS / JS (ZapZap)');
    customCodeLink.addEventListener('click', () => showCustomCodeDialog());
    body.appendChild(customCodeLink);
    const settingsLink = el('button', 'wl-link-action', '⚙️ Pengaturan Lengkap (Ctrl+P)');
    settingsLink.style.color = '#00a884';
    settingsLink.style.fontWeight = '600';
    settingsLink.addEventListener('click', () => {
      isPanelOpen = false;
      panel.classList.remove('wl-open');
      if (typeof window.waliteOpenSettings === 'function') window.waliteOpenSettings();
    });
    body.appendChild(settingsLink);
    const aboutLink = el('button', 'wl-link-about', 'About WaLite');
    aboutLink.addEventListener('click', () => showAboutDialog());
    body.appendChild(aboutLink);

    panel.append(body); root.append(panel); document.body.appendChild(root);
    document.addEventListener('click', () => {
      if (isPanelOpen) {
        isPanelOpen = false;
        panel.classList.remove('wl-open');
      }
    });
  }
  let lastKeyHandledTime = 0;
  function handleGlobalKeyDown(e) {
    if (e.altKey) {
      const code = e.code || '';
      const key = (e.key || '').toLowerCase();
      if (code === 'KeyZ' || key === 'z' || code === 'KeyX' || key === 'x' || code === 'KeyH' || key === 'h' || code === 'KeyN' || key === 'n') {
        const now = Date.now();
        if (now - lastKeyHandledTime < 150) return;
        lastKeyHandledTime = now;

        if (code === 'KeyZ' || key === 'z') {
          e.preventDefault();
          e.stopPropagation();
          if (typeof window.waliteOpenSettings === 'function') {
            window.waliteOpenSettings('privacy');
          }
        } else if (code === 'KeyX' || key === 'x') {
          e.preventDefault();
          e.stopPropagation();
          triggerScreenLock();
        } else if (code === 'KeyH' || key === 'h') {
          e.preventDefault();
          e.stopPropagation();
          toggleShieldVisibility();
        } else if (code === 'KeyN' || key === 'n') {
          e.preventDefault();
          e.stopPropagation();
          if (typeof window.triggerWaliteTestNotification === 'function') {
            window.triggerWaliteTestNotification();
          } else {
            try {
              new window.Notification('Budi Santoso', {
                body: 'Halo! Ini pesan tes notifikasi dan balas cepat dari WaLite.',
                tag: 'test-notification'
              });
            } catch (_) {}
          }
        }
      }
    }
  }
  window.addEventListener('keydown', handleGlobalKeyDown, true);
  document.addEventListener('keydown', handleGlobalKeyDown, true);
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
    applyCustomJS();
    buildUI();

    setTimeout(() => {
      try {
        if (typeof window.dispatchWaliteAction === 'function') {
          window.dispatchWaliteAction('set-setting', { key: 'saveAs', val: String(state.saveAs !== false) });
          window.dispatchWaliteAction('set-setting', { key: 'downloadNotif', val: String(state.downloadNotif !== false) });
          window.dispatchWaliteAction('set-setting', { key: 'autoStart', val: String(state.autoStart === true) });
          window.dispatchWaliteAction('set-setting', { key: 'experimentalQuickReply', val: String(state.experimentalQuickReply === true) });
        }
      } catch (_) {}
    }, 500);

    let checkQueued = false;
    const observer = new MutationObserver(() => {
      if (checkQueued) return;
      checkQueued = true;
      requestAnimationFrame(() => {
        checkQueued = false;
        if (!document.getElementById('walite-privacy-css')) applyStyles();
        if (!document.getElementById('wl-root-container')) buildUI();
      });
    });
    if (document.body) {
      observer.observe(document.body, { childList: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
