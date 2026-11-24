/* WaLite Download Manager & Notification Enhancer */
(function () {
  'use strict';
  if (window.__WALITE_DM_INITIALIZED__) return;
  window.__WALITE_DM_INITIALIZED__ = true;

  // Linux WebKitGTK blob media buffer patch (fixes bogus MP4 atoms, corrupted H.264/AAC frames):
  // 1. A `blob:` video loaded with `preload=auto` (the default) is read through a buffering queue that
  //    hands the demuxer corrupted bytes: bogus MP4 atoms, broken H.264 and AAC frames, format not supported.
  //    With `preload=metadata` the same blob is read cleanly without atom corruption.
  // 2. With `preload=metadata` the element stops at HAVE_FUTURE_DATA; synthesize `canplaythrough` when readyState >= 3.
  // 3. WebKit produces no frames for a detached video; park it in a near-invisible box for canvas thumbnailing.
  // 4. WhatsApp hands video blobs to <img> tags which causes memory leaks; reject video URLs on <img>.
  (function initWebKitBlobMediaPatch() {
    try {
      var isLinux = typeof navigator !== 'undefined' && (/Linux|X11/i.test(navigator.userAgent) || /Linux/i.test(navigator.platform || ''));
      if (!isLinux) return;
      var MP = HTMLMediaElement.prototype;
      var src = Object.getOwnPropertyDescriptor(MP, "src");
      var pre = Object.getOwnPropertyDescriptor(MP, "preload");
      var rs = Object.getOwnPropertyDescriptor(MP, "readyState");
      if (!src || !pre || !rs || !src.set || !pre.set || !rs.get) return;
      var setAttr = Element.prototype.setAttribute;
      var isBlob = function (u) { return typeof u === "string" && u.slice(0, 5) === "blob:"; };

      var PARK = "position:fixed;left:0;top:0;width:64px;height:36px;overflow:hidden;opacity:0.004;pointer-events:none;z-index:2147483646";
      function park(el) {
        if (!(el instanceof HTMLVideoElement) || el.isConnected || el.parentNode || !document.body) return;
        var box = document.createElement("div");
        setAttr.call(box, "data-walite", "video-park");
        setAttr.call(box, "aria-hidden", "true");
        box.style.cssText = PARK;
        box.appendChild(el);
        document.body.appendChild(box);
        var observer = null, finished = false;
        var release = function () {
          if (finished) return;
          if (box.firstChild === el && isBlob(src.get.call(el))) return;
          finished = true;
          el.removeEventListener("emptied", release, true);
          if (observer) observer.disconnect();
          if (box.firstChild === el) box.removeChild(el);
          if (box.parentNode) box.parentNode.removeChild(box);
        };
        el.addEventListener("emptied", release, true);
        if (typeof MutationObserver === "function") {
          observer = new MutationObserver(release);
          observer.observe(box, { childList: true });
        }
      }

      var armed = new WeakSet();
      var savedPreload = new WeakMap();
      function arm(el) {
        if (!savedPreload.has(el)) savedPreload.set(el, el.getAttribute("preload"));
        if (pre.get.call(el) !== "none") pre.set.call(el, "metadata");
        park(el);
        if (armed.has(el)) return;
        armed.add(el);
        var synthesized = false, real = false;
        el.addEventListener("emptied", function () { synthesized = false; real = false; }, true);
        el.addEventListener("canplaythrough", function (e) {
          if (!e.isTrusted) return;
          if (synthesized) { e.stopImmediatePropagation(); return; }
          real = true;
        }, true);
        el.addEventListener("canplay", function (e) {
          if (!e.isTrusted) return;
          setTimeout(function () {
            if (real || synthesized || !isBlob(src.get.call(el)) || rs.get.call(el) < 3) return;
            synthesized = true;
            el.dispatchEvent(new Event("canplaythrough"));
          }, 0);
        }, true);
      }
      function disarm(el) {
        if (!savedPreload.has(el)) return;
        var was = savedPreload.get(el);
        savedPreload.delete(el);
        if (was === null) el.removeAttribute("preload"); else setAttr.call(el, "preload", was);
      }
      Object.defineProperty(MP, "src", {
        configurable: true, enumerable: src.enumerable, get: src.get,
        set: function (v) {
          try { if (isBlob(String(v))) arm(this); else disarm(this); } catch (e) {}
          return src.set.call(this, v);
        },
      });
      Object.defineProperty(MP, "preload", {
        configurable: true, enumerable: pre.enumerable, get: pre.get,
        set: function (v) {
          try {
            if (isBlob(src.get.call(this))) {
              savedPreload.set(this, String(v));
              if (String(v).toLowerCase() !== "none") v = "metadata";
            }
          } catch (e) {}
          return pre.set.call(this, v);
        },
      });
      Object.defineProperty(MP, "readyState", {
        configurable: true, enumerable: rs.enumerable,
        get: function () {
          var v = rs.get.call(this);
          try { if (v === 3 && armed.has(this) && isBlob(src.get.call(this))) return 4; } catch (e) {}
          return v;
        },
      });

      var videoUrls = new Map(), MAX_URLS = 512;
      var createURL = URL.createObjectURL, revokeURL = URL.revokeObjectURL;
      URL.createObjectURL = function (blob) {
        var url = createURL.apply(this, arguments);
        try {
          if (blob && /^video\//i.test(blob.type || "")) {
            if (videoUrls.size >= MAX_URLS) videoUrls.delete(videoUrls.keys().next().value);
            videoUrls.set(url, true);
          }
        } catch (e) {}
        return url;
      };
      URL.revokeObjectURL = function (url) {
        try { videoUrls.delete(url); } catch (e) {}
        if (typeof url === 'string' && url.startsWith('blob:')) {
          setTimeout(function () {
            try { revokeURL.call(URL, url); } catch (_) {}
          }, 300000);
          return;
        }
        return revokeURL.apply(this, arguments);
      };
      if (window.webkitURL && window.webkitURL.revokeObjectURL) {
        window.webkitURL.revokeObjectURL = URL.revokeObjectURL;
      }
      var NOT_AN_IMAGE = "data:image/png;base64,AAAA";
      var IP = HTMLImageElement.prototype;
      var isrc = Object.getOwnPropertyDescriptor(IP, "src");
      var refused = new WeakMap();
      if (isrc && isrc.set) {
        Object.defineProperty(IP, "src", {
          configurable: true, enumerable: isrc.enumerable,
          get: function () { return refused.has(this) ? refused.get(this) : isrc.get.call(this); },
          set: function (v) {
            try {
              if (videoUrls.has(String(v))) {
                refused.set(this, String(v));
                return isrc.set.call(this, NOT_AN_IMAGE);
              }
              refused.delete(this);
            } catch (e) {}
            return isrc.set.call(this, v);
          },
        });
      }

      Element.prototype.setAttribute = function (name, value) {
        try {
          var n = String(name).toLowerCase();
          if (this instanceof HTMLMediaElement) {
            if (n === "src") { if (isBlob(String(value))) arm(this); else disarm(this); }
            else if (n === "preload" && isBlob(src.get.call(this))) {
              savedPreload.set(this, String(value));
              if (String(value).toLowerCase() !== "none") value = "metadata";
            }
          } else if (n === "src" && this instanceof HTMLImageElement) {
            if (videoUrls.has(String(value))) {
              refused.set(this, String(value));
              value = NOT_AN_IMAGE;
            } else refused.delete(this);
          }
        } catch (e) {}
        return setAttr.call(this, name, value);
      };
    } catch (_) {}
  })();

  const WALITE_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAHPElEQVR42sVXaWxUVRS+974305m2M13oCgolbiwKtS3BhaQ1ImFpqVGmGAMaTcAIAv7QGEra19eiRv3hFg00MRq3hLYYdaZqcKMBQUtnKkobEJBYoGNLaZnOTNuZee9ez30zD960UxYl8abLW+495zvnfGd5BP3PS/yX5zCiFElIxvxGRhJDhLB/J+galoM1Cf17u3DbfbKS6H3pj5KYUzaXNeMq9boC4IrHC32w+6Upali1q2EFm1mS7/OF1eeNcuEMuRogVwKAwSpBt7jikPwAImgNXN5PzOI0wWLSNqljEQRg+uGyDWH2vqtI+lr3CJzlINi1A6AU3hH+w1Z0NpRhSt9KmZZxR/jCCFKCIQ8i+GfY0wP/Q0zFaZigWxhj95hSLTOVwFgPo3Sda4G8JyoH1iQcwZMqjx0od9e/aM21V4cG/PCY1SmC+t438+Uzk+GucEs3Iyw8iwWykal0h7Oo9unxMq8EQGM431zukd+zFWQ/6T917jtsEtc4523r4xskKpG9bdw98autVFJ1Jct/kfIEk/AFQ+xvCEllFATIJvHhwImYzGNe0SnXpc7IlkD5B65i6Qn+bn3HTlO+s1eVZZlO9BrCEpKw1zNVGAwfFVvueX1U80hn/TsIYuMskp7hwGUSfzYOgKMJ2F5VpZa75but2fYDo+f837qKa5cYgel7ubDulm7cXNWsJrJMyxy2inKPVLgbNqEIcjnvqjk1PhQ4UewBdTuIWzDsU03WaZmCEPBNby2qPa4rirMkdmbl/udt1JI8DRNyG3CloLWk7k2+TytUJIHHYosYrdfi3iEtSs5PXwDYNqTZTYWmgG8QM+bmMeXKuSe4wJXu7SUVHp6WUWuY1VYN1z8whnZjgh/iz7rxXMz36kAuC6A/uyvqDUweCw0GkeXEb42M0Fnm9ORkIhAbEdBUjWgQhlVHpEyG6QHY3MIBcc8wzFZrtT3ZLDCEXzEqMXgATwpAjy/GaAkUln08tioxtULeD5IkEweWpO8dCws11vx0XoV+0wjrqV+BEZ6JGbKoo5EzgUJ1D9/XzKqokTOxgoQnAogVi8pOKR0LwgxInQPa47O9I9w5vOJBoNO09HLXzwYxG9SREGIY/R6zawP8HYbqmMEY3tVGZEXzTIyY49gfB0IDoHc1WOmCFQxj5BS/+Wb52yGIqVdIEuGUmh0taOhls91iZlwMY0eWel7MBnHL4K6Xuw8x5VO+r6wUAgOh4anLlQOx10NR61r6h2TXQMSMjiMHVkQBY+152PD4T80DWEgtb5cXWDJSKsP+0WOMMi6mT0RqNewZglRPoqHIcVeJ7EGSRFwer8ClN5Y8FSn31D8qWsw7Ratpjjgc5ZJudDRN5KimsFUJ0gj0DqZmXVTP2FHebBijD2ERfxg6HwgB47YzRQXmIQdkyDoI2RdEFGYCT5qirJOpu6Qxwk8DP2qSMlI+4TKUsbBfUVDAqDM6kEgyg6kCBc+hAcEeCUKDmWdgyaHw0Ah4AJdacuymsT7/ZkKU/UwVkGizrIbGcxh2HbNk29CY19eu9Y8OKYsRoYwwJtluyrl9+GTfZ5pXGV5q6+n2GnWSmBLmaHLobbcDLFys6y8upPuUUOREyvQpoNzX7iyueTuUkumFOaDPnJGCIBKbEIUMEDjj2LsVbvlXCJfXdkNmMzGJt/tP9tdCL3gYsqQQHNLBs4tXSZ2ghjowJ1YH8C5rXloe9IJ79RymSH08+NdAC4TBoZHz1i0hoMra4JnzG1tLpH0Qi6bg2cHTkBV5cH4ukPJo8PRgfSRCC6AbNmilPdc+CzzwvqZrbxeeWIpjJZWnIkXiEAT9ezi8eHwP4ASD34szoN4/+L7UdFMuuH7kq/lbh4zkBhIeBHmz/cM0S5Nl6B04USeENvwcNKPXRvt9j7iK63bBc0vA5lXdRTuUS4odAvca3z+hy4ExIMMKGTGyoqNui21G1hvBnsG1zuLaj8cbFAdAF1TZ3nCjOMXaE/IFP+PxiwNYCiMWSTBiGdpxI7RsngkrO2WHJTe9adR7ocVZLDkSteO4sTw2ZFBVpKt56QFLtnGQYE0JADmkI9eq3IRpBPgSfa8pAMu3WvIyXgLlB5131lRpmc/HdyRfZiLS2zEwWSMTYtDd8GJrjo2M9Q8fgdPVEMevJxvLJeBHZzlZRgl6NXV61pzA6YEmV2HNI1xmIuvjAPCY8hSByfdeU7p1f8Q/NggKYQaguyHFzjGKGpLz024Y9fqCcOoHuHdDPe0VMFEpZjnA8CLIhiXJ+RlpI94hGNHxZldR7acJesEkHriUBQWUirPwqPmnLxe94I9ns7wM0m8NeKWMiGRqtETDCBlWocpFLgCA/XD/keX4rN08MzTFV/hqwpNNw0amG9u1vpYffjnDRFEaVmBOVkjAuXBrv/HshPS96u8CAOHALUSf58Z/7Vzu0+zip9tkmfJfvw3HA734cSrHavtVKr0+AK7T+gdG/thRvzZjzgAAAABJRU5ErkJggg==';
  const TEAL = '#00a884';

  // External links are handled cleanly by Tauri on_navigation / on_new_window in Rust.

  // Walite Navigation & Quick-Reply Bridge
  // 1. Permanently suppress beforeunload prompts on WhatsApp Web
  try {
    window.addEventListener('beforeunload', function (e) {
      e.stopImmediatePropagation();
      delete e.returnValue;
    }, true);
    window.onbeforeunload = null;
    Object.defineProperty(window, 'onbeforeunload', {
      get: () => null,
      set: () => {},
      configurable: true
    });
  } catch (_) {}

  function normalizeTitle(s) {
    if (!s) return '';
    return s
      .replace(/[\p{Emoji}\p{Extended_Pictographic}\u200d\uFE0F]/gu, '')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function simulateClick(el) {
    if (!el) return;
    const opts = {
      bubbles: true,
      cancelable: true,
      view: window,
      detail: 1,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true
    };
    try { el.dispatchEvent(new PointerEvent('pointerdown', opts)); } catch (_) {}
    try { el.dispatchEvent(new MouseEvent('mousedown', opts)); } catch (_) {}
    try { el.focus(); } catch (_) {}
    try { el.dispatchEvent(new PointerEvent('pointerup', opts)); } catch (_) {}
    try { el.dispatchEvent(new MouseEvent('mouseup', opts)); } catch (_) {}
    try { el.dispatchEvent(new MouseEvent('click', opts)); } catch (_) {}
    try { el.click(); } catch (_) {}
  }

  window.triggerWaliteTestNotification = function () {
    const testTitle = 'Budi Santoso';
    const testBody = 'Halo! Ketik teks balasan di kolom bawah lalu klik Kirim.';
    const testIcon = WALITE_ICON;
    const testTag = 'test-msg';

    dispatchWaliteAction('notify', {
      title: testTitle,
      body: testBody,
      icon: testIcon,
      tag: testTag
    });
  };

  function dispatchWaliteAction(action, params) {
    params = params || {};
    try {
      if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
        window.__TAURI_INTERNALS__.invoke('walite_action', Object.assign({ action: action }, params));
        return;
      }
    } catch (_) {}
    try {
      const q = new URLSearchParams(params).toString();
      window.location.href = 'walite-action://' + action + (q ? ('?' + q) : '');
    } catch (e) {
      console.warn('[WaLite] Action dispatch error:', e);
    }
  }
  window.dispatchWaliteAction = dispatchWaliteAction;

  window.__walite_accept_call = function () {
    try {
      const acceptBtn = document.querySelector(
        'button[data-testid*="call-accept"], button[data-testid*="call-answer"], button:has(span[data-icon="call-accept"]), button:has(span[data-icon="call"]), button[aria-label*="Jawab" i], button[aria-label*="Terima" i], button[aria-label*="Accept" i], button[aria-label*="Answer" i]'
      );
      if (acceptBtn) {
        simulateClick(acceptBtn);
        return true;
      }
      if (typeof window.require === 'function') {
        const callAction = window.require('WAWebCallAction') || window.require('WAWebVoip');
        if (callAction && typeof callAction.acceptCall === 'function') {
          callAction.acceptCall();
          return true;
        }
      }
    } catch (_) {}
    // Fallback: If not found, focus and bring main window to front so user can answer manually
    dispatchWaliteAction('open-chat', { title: 'Panggilan', tag: 'call-fallback' });
    return false;
  };

  window.__walite_decline_call = function () {
    try {
      const declineBtn = document.querySelector(
        'button[data-testid*="call-decline"], button[data-testid*="call-reject"], button:has(span[data-icon="call-decline"]), button:has(span[data-icon="end-call"]), button[aria-label*="Tolak" i], button[aria-label*="Decline" i], button[aria-label*="Reject" i], button[aria-label*="Dismiss" i]'
      );
      if (declineBtn) {
        simulateClick(declineBtn);
        return true;
      }
      if (typeof window.require === 'function') {
        const callAction = window.require('WAWebCallAction') || window.require('WAWebVoip');
        if (callAction && typeof callAction.rejectCall === 'function') {
          callAction.rejectCall();
          return true;
        }
      }
    } catch (_) {}
    // Fallback: If not found, focus main window so user can decline manually
    dispatchWaliteAction('open-chat', { title: 'Panggilan', tag: 'call-fallback' });
    return false;
  };

  const activeNotificationMap = new Map();

  window.__walite_on_notif_click = function (title, tag) {
    const cleanTitle = (title || '').trim();
    const cleanTag = (tag || '').trim();
    const norm = normalizeTitle(cleanTitle);

    // 1. WhatsApp Web's own onclick callback (the true native React handler!)
    let instance = null;
    if (cleanTag && activeNotificationMap.has(cleanTag)) {
      instance = activeNotificationMap.get(cleanTag);
    } else if (norm && activeNotificationMap.has(norm)) {
      instance = activeNotificationMap.get(norm);
    }
    if (instance && typeof instance.onclick === 'function') {
      try {
        instance.onclick({ currentTarget: instance, target: instance, type: 'click' });
        return true;
      } catch (err) {
        console.warn('[WaLite] notif onclick error, fallback to open_chat:', err);
      }
    }

    // 2. Direct DOM search and click
    return window.__walite_open_chat(cleanTitle, cleanTag);
  };

  if (!window.__walite_open_chat) {
    window.__walite_open_chat = function (title, jid) {
      if (!title || title === 'WhatsApp') return false;
      const cleanTitle = title.trim();
      const normTarget = normalizeTitle(cleanTitle);

      // If Settings or Profile drawer is currently open, click back button first
      const backBtn = document.querySelector('header button[aria-label*="Back" i], header button[aria-label*="Kembali" i], span[data-icon="back"], span[data-icon="arrow-left"]')?.closest('button');
      if (backBtn) {
        try { backBtn.click(); } catch (_) {}
      }

      // Check if already in this exact chat
      const mainHeader = document.querySelector('#main header');
      if (mainHeader) {
        const headerTitleEl = mainHeader.querySelector('span[title], [data-testid="cell-frame-title"], [dir="auto"]');
        const headerText = headerTitleEl ? (headerTitleEl.getAttribute('title') || headerTitleEl.textContent || '') : '';
        const normHeader = normalizeTitle(headerText);
        if (normHeader && normTarget && normHeader === normTarget) {
          const input = document.querySelector('#main footer [contenteditable="true"]');
          if (input) input.focus();
          return true;
        }
      }

      // 1. Search visible rows in pane-side
      const rows = document.querySelectorAll('#pane-side [role="row"], #pane-side [role="listitem"]');
      for (const r of rows) {
        const titleEl = r.querySelector('[data-testid="cell-frame-title"], span[title], ._ak8q, [dir="auto"]');
        const rowTitle = titleEl ? (titleEl.getAttribute('title') || titleEl.textContent || '').trim() : '';
        const normRow = normalizeTitle(rowTitle);
        if (normRow && normTarget && (normRow === normTarget || normRow.includes(normTarget) || normTarget.includes(normRow))) {
          const target = r.querySelector('div[role="gridcell"]') || r.querySelector('div[tabindex]') || titleEl || r;
          simulateClick(target);
          simulateClick(r);
          setTimeout(() => {
            const input = document.querySelector('#main footer [contenteditable="true"]');
            if (input) input.focus();
          }, 250);
          return true;
        }
      }

      // 2. Search by title attribute
      try {
        const escaped = CSS.escape(cleanTitle);
        const span = document.querySelector(`#pane-side span[title*="${escaped}" i]`);
        if (span) {
          const r = span.closest('[role="row"]') || span.closest('div[tabindex]') || span;
          const target = r.querySelector('div[role="gridcell"]') || span;
          simulateClick(target);
          simulateClick(r);
          setTimeout(() => {
            const input = document.querySelector('#main footer [contenteditable="true"]');
            if (input) input.focus();
          }, 250);
          return true;
        }
      } catch (_) {}

      // 3. Fallback: Search box in sidebar
      const searchBox = document.querySelector(
        '#side div[contenteditable="true"], div[data-tab="3"], [data-testid*="search-input"], [aria-label*="Cari" i], [aria-label*="Search" i]'
      );
      if (searchBox) {
        searchBox.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, cleanTitle);
        searchBox.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: cleanTitle }));
        setTimeout(() => {
          const firstRow = document.querySelector('#pane-side [role="row"], #pane-side [role="listitem"]');
          if (firstRow) {
            const target = firstRow.querySelector('div[role="gridcell"]') || firstRow.querySelector('span[title]') || firstRow;
            simulateClick(target);
            simulateClick(firstRow);
          }
          setTimeout(() => {
            const clearBtn = document.querySelector('#side button[aria-label*="Batal" i], #side button[aria-label*="Cancel" i], #side span[data-icon="x-alt"], #side span[data-icon="x"]')?.closest('button');
            if (clearBtn) clearBtn.click();
            const input = document.querySelector('#main footer [contenteditable="true"]');
            if (input) input.focus();
          }, 350);
        }, 350);
        return true;
      }

      // 4. JID / Phone fallback
      if (jid && jid.includes('@c.us')) {
        const phone = jid.split('@')[0].replace(/[^0-9]/g, '');
        if (phone.length >= 7) {
          const a = document.createElement('a');
          a.href = `https://web.whatsapp.com/send?phone=${phone}`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          return true;
        }
      }

      if (jid === 'test-notif' || jid === 'test-msg') {
        const input = document.querySelector('#main footer [contenteditable="true"]');
        if (input) input.focus();
        return true;
      }

      return false;
    };
  }

  let isSendingInlineReply = false;
  window.__walite_send_inline_reply = function (title, tag, text) {
    if (!text || !text.trim() || isSendingInlineReply) return;
    isSendingInlineReply = true;
    setTimeout(() => { isSendingInlineReply = false; }, 3000);

    // 1. Open the target contact chat
    window.__walite_on_notif_click(title, tag);

    // 2. Wait for the chat box, insert text, and click send exactly once
    let attempts = 0;
    function tryTypeAndSend() {
      attempts++;
      const footer = document.querySelector('#main footer');
      const box = footer ? footer.querySelector('[contenteditable="true"], div[role="textbox"]') : null;

      if (!box) {
        if (attempts < 15) setTimeout(tryTypeAndSend, 120);
        else {
          isSendingInlineReply = false;
          // Fallback: If compose box selector fails, unminimize and open chat directly so user can type
          window.__walite_on_notif_click(title, tag);
        }
        return;
      }

      box.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text.trim());
      box.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: text.trim() }));

      setTimeout(() => {
        const sendBtn = footer.querySelector(
          'button[data-testid="send"], button[aria-label*="Send" i], button[aria-label*="Kirim" i], span[data-icon="send"], span[data-icon="wds-ic-send-filled"]'
        )?.closest('button') || footer.querySelector('span[data-icon="send"]')?.closest('div[role="button"]');

        if (sendBtn && !sendBtn.disabled) {
          sendBtn.click();
        }
        setTimeout(() => { isSendingInlineReply = false; }, 400);
      }, 200);
    }

    setTimeout(tryTypeAndSend, 250);
  };

  // Notification & Incoming Message Engine
  let NativeBrowserNotification = (typeof window !== 'undefined' && window.Notification) ? window.Notification : null;
  const notifiedMessageSet = new Set();
  let isInitialSeeded = false;
  let lastChatSnippetMap = new Map();
  let lastReportedBadgeCount = -1;

  function getCleanSenderTitleText(rawTitle) {
    let title = (rawTitle || '').trim();
    title = title.replace(/^\d+\s*(pesan yang belum dibaca|pesan belum dibaca|unread messages?|unread)\s*/i, '');
    title = title.replace(/\s*\d+\s*(pesan yang belum dibaca|pesan belum dibaca|unread messages?|unread)$/i, '');
    return title.trim();
  }

  async function resolveMediaAsDataUrl(url) {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    if (url.startsWith('blob:')) {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result || '');
          reader.onerror = () => resolve('');
          reader.readAsDataURL(blob);
        });
      } catch (_) {
        return '';
      }
    }
    return '';
  }

  const IGNORED_MESSAGES_REGEX = /^(pesan\s+(terkirim|telah\s+dibaca|dibaca)|sent|delivered|read|typing|mengetik|centang)/i;

  function isIgnoredSystemMessage(body) {
    if (!body) return true;
    const b = body.trim().toLowerCase();
    return (
      IGNORED_MESSAGES_REGEX.test(b) ||
      b === 'pesan telah dibaca' ||
      b === 'pesan dibaca' ||
      b === 'dibaca' ||
      b === 'read' ||
      b === 'message read' ||
      b === 'pesan terkirim' ||
      b === 'terkirim' ||
      b === 'sent' ||
      b === 'delivered'
    );
  }

  function dispatchNotification(title, body, icon, tag, media) {
    let cleanTitle = getCleanSenderTitleText(title);
    let cleanBody = (body || '').trim();
    let cleanTag = (tag || cleanTitle).trim();

    // Check incoming call exclusively via tag attribute (never inspect body text!)
    const tagLower = cleanTag.toLowerCase();
    const isCall = tagLower.includes('call') || tagLower.includes('telepon') || tagLower.includes('voip');
    if (isCall) {
      dispatchWaliteAction('incoming-call', { caller: cleanTitle });
      return;
    }

    // Suppress notification if the chat is currently open and window is focused
    try {
      if (document.hasFocus() || !document.hidden) {
        const mainHeader = document.querySelector('#main header');
        if (mainHeader) {
          const headerTitleEl = mainHeader.querySelector('span[title], [data-testid="cell-frame-title"], [dir="auto"]');
          const activeTitle = headerTitleEl ? (headerTitleEl.getAttribute('title') || headerTitleEl.textContent || '').trim() : '';
          if (activeTitle && cleanTitle && normalizeTitle(activeTitle) === normalizeTitle(cleanTitle)) {
            return; // Chat is already open in focused window, suppress toast notification!
          }
        }
      }
    } catch (_) {}

    // Filter out read receipts, sent confirmations, typing status
    if (isIgnoredSystemMessage(cleanBody)) {
      return;
    }

    // Respect Privacy Settings (hide preview / hide name)
    try {
      const savedState = localStorage.getItem('wl:v1');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        if (parsed) {
          if (parsed.notifShowName === false) cleanTitle = 'WhatsApp';
          if (parsed.notifShowPreview === false) cleanBody = 'Pesan baru';
        }
      }
    } catch (_) {}

    // If title is generic "WhatsApp", extract real sender name from body if present ("Sender: Message")
    if (!cleanTitle || cleanTitle.toLowerCase() === 'whatsapp') {
      if (cleanBody && cleanBody.includes(':')) {
        const sepIdx = cleanBody.indexOf(':');
        const potentialSender = cleanBody.slice(0, sepIdx).trim();
        if (potentialSender.length > 0 && potentialSender.length < 50) {
          cleanTitle = getCleanSenderTitleText(potentialSender);
          cleanBody = cleanBody.slice(sepIdx + 1).trim();
        }
      }
    }

    // Permanent deduplication signature (Sender + Message)
    const sig = cleanTitle + ':::' + cleanBody;
    if (notifiedMessageSet.has(sig)) {
      return; // Already notified! NEVER repeat or loop!
    }
    notifiedMessageSet.add(sig);

    // Keep memory clean
    if (notifiedMessageSet.size > 200) {
      const first = notifiedMessageSet.values().next().value;
      notifiedMessageSet.delete(first);
    }

    // Dispatch native Windows notification
    dispatchWaliteAction('notify', {
      title: cleanTitle,
      body: cleanBody,
      tag: cleanTag
    });
  }

  // 1. Force Permissions API & Notification API to report 'granted'
  try {
    if (typeof Notification !== 'undefined') {
      Object.defineProperty(Notification, 'permission', {
        get: () => 'granted',
        configurable: true
      });
      Notification.requestPermission = function (cb) {
        if (typeof cb === 'function') cb('granted');
        return Promise.resolve('granted');
      };
    }
    if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      const origQuery = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = function (desc) {
        if (desc && desc.name === 'notifications') {
          return Promise.resolve({
            state: 'granted',
            name: 'notifications',
            onchange: null,
            addEventListener: function () {},
            removeEventListener: function () {},
            dispatchEvent: function () { return false; }
          });
        }
        return origQuery(desc);
      };
    }
  } catch (e) {
    console.warn('[WaLite] Permission mock error:', e);
  }

  // 2. Intercept window.Notification and ServiceWorkerRegistration.prototype.showNotification
  if (typeof window !== 'undefined') {
    function WaLiteNotification(title, options) {
      if (!(this instanceof WaLiteNotification)) {
        return new WaLiteNotification(title, options);
      }
      options = options || {};

      let cleanTitle = getCleanSenderTitleText(title);
      let cleanTag = (options.tag || cleanTitle).trim();

      dispatchNotification(title, options.body, options.icon, cleanTag, options.image);

      this.title = title;
      this.options = options;
      this.onclick = null;
      this.onclose = null;
      this.onerror = null;

      if (cleanTag) activeNotificationMap.set(cleanTag, this);
      if (cleanTitle) activeNotificationMap.set(normalizeTitle(cleanTitle), this);

      this.close = function () {};
      this.addEventListener = function (type, fn) {
        if (type === 'click') this.onclick = fn;
        if (type === 'close') this.onclose = fn;
      };
      this.removeEventListener = function () {};
    }

    if (NativeBrowserNotification) {
      WaLiteNotification.prototype = Object.create(NativeBrowserNotification.prototype);
      Object.assign(WaLiteNotification, NativeBrowserNotification);
    }
    // Always force permission to be 'granted'
    Object.defineProperty(WaLiteNotification, 'permission', {
      get: () => 'granted',
      set: () => {},
      configurable: true,
      enumerable: true
    });
    WaLiteNotification.requestPermission = function (cb) {
      if (typeof cb === 'function') cb('granted');
      return Promise.resolve('granted');
    };
    window.Notification = WaLiteNotification;

    if (typeof ServiceWorkerRegistration !== 'undefined' && ServiceWorkerRegistration.prototype) {
      ServiceWorkerRegistration.prototype.showNotification = function (title, options) {
        try {
          options = options || {};
          let cleanTitle = getCleanSenderTitleText(title);
          let cleanTag = (options.tag || cleanTitle).trim();
          dispatchNotification(title, options.body, options.icon, cleanTag, options.image);
        } catch (e) {
          console.warn('[WaLite] SW showNotification error:', e);
        }
        return Promise.resolve();
      };
    }
  }

  // Real-time Taskbar Badge Counter (Counts per unread contact/group conversation)
  (function initIncomingMessageDetector() {
    function updateUnreadAndBadge() {
      try {
        let unreadChatCount = 0;
        const rows = document.querySelectorAll('#pane-side [role="row"], #pane-side [role="listitem"]');
        for (const r of rows) {
          const hasUnread = r.querySelector(
            '[data-testid="icon-unread-count"], [aria-label*="unread" i], [aria-label*="belum dibaca" i], [data-icon*="unread"], [data-testid*="unread"]'
          );
          if (hasUnread) {
            unreadChatCount += 1;
          }
        }

        // Fallback: if rows are virtualized, count any visible badge elements
        if (unreadChatCount === 0) {
          const badgeEls = document.querySelectorAll(
            '[data-testid="icon-unread-count"], [aria-label*="unread" i], [aria-label*="belum dibaca" i]'
          );
          if (badgeEls.length > 0) {
            unreadChatCount = badgeEls.length;
          } else {
            const titleMatch = (document.title || '').match(/^\((\d+)\)/);
            if (titleMatch) unreadChatCount = 1;
          }
        }

        if (unreadChatCount !== lastReportedBadgeCount) {
          lastReportedBadgeCount = unreadChatCount;
          dispatchWaliteAction('badge', { count: String(unreadChatCount) });
        }
      } catch (err) {
        console.warn('[WaLite] updateUnreadAndBadge error:', err);
      }
    }

    function checkNotificationBanner() {
      try {
        const side = document.querySelector('#side') || document.body;
        if (!side) return;
        const bannerBtns = side.querySelectorAll('button, div[role="button"], span');
        for (const b of bannerBtns) {
          const t = (b.textContent || '').trim();
          if (
            t.includes('Nyalakan notifikasi desktop') ||
            t.includes('Turn on desktop notifications') ||
            t.includes('Aktifkan notifikasi desktop')
          ) {
            b.click();
            break;
          }
        }
      } catch (_) {}
    }

    function initObservers() {
      setInterval(updateUnreadAndBadge, 1500);
      setInterval(checkNotificationBanner, 4000);

      // VoIP / Video Call PiP Floating Window Detector
      let isCallActive = false;
      let isIncomingCall = false;
      function checkCallStatus() {
        try {
          const callEndBtn = document.querySelector(
            '[data-testid*="call-end"], span[data-icon="end-call"], button[aria-label*="Akhiri" i], button[aria-label*="End call" i], [data-icon="call-end"], div[data-testid*="video-call"], div:has(> video)'
          );
          const active = !!callEndBtn;
          if (active !== isCallActive) {
            isCallActive = active;
            dispatchWaliteAction('call-status', { active: String(active) });
          }

          // Check incoming call dialog button (never inspect chat body!)
          const acceptBtn = document.querySelector(
            'button[data-testid*="call-accept"], button[data-testid*="call-answer"], button:has(span[data-icon="call-accept"]), button:has(span[data-icon="call"]), button[aria-label*="Jawab" i], button[aria-label*="Terima" i], button[aria-label*="Accept" i]'
          );
          const incoming = !!acceptBtn;
          if (incoming !== isIncomingCall) {
            isIncomingCall = incoming;
            if (incoming) {
              let callerName = 'Kontak WhatsApp';
              const nameEl = acceptBtn.closest('div[role="dialog"], div')?.querySelector('span[title], span[dir="auto"], h2, [data-testid*="title"]');
              if (nameEl) callerName = (nameEl.getAttribute('title') || nameEl.textContent || '').trim() || callerName;
              dispatchWaliteAction('incoming-call', { caller: callerName });
            } else {
              dispatchWaliteAction('close-call-popup', {});
            }
          }

          if (isCallActive && document.hidden) {
            dispatchWaliteAction('enter-pip', {});
          }
        } catch (_) {}
      }

      document.addEventListener('visibilitychange', () => {
        if (isCallActive) {
          if (document.hidden) {
            dispatchWaliteAction('enter-pip', {});
          } else {
            dispatchWaliteAction('exit-pip', {});
          }
        }
      });

      setInterval(checkCallStatus, 1000);

      let lastDocTitle = document.title;
      setInterval(() => {
        const curTitle = document.title || '';
        if (curTitle !== lastDocTitle) {
          lastDocTitle = curTitle;
          updateUnreadAndBadge();

          // Sinyal panggilan dari mutasi document.title (tanpa membaca chat body!)
          const titleLower = curTitle.toLowerCase();
          if (titleLower.includes('panggilan') || titleLower.includes('incoming call') || titleLower.includes('berdering') || titleLower.includes('ringing')) {
            if (!isIncomingCall && !isCallActive) {
              isIncomingCall = true;
              dispatchWaliteAction('incoming-call', { caller: 'Kontak WhatsApp' });
            }
          } else if (titleLower.includes('panggilan tak terjawab') || titleLower.includes('missed call')) {
            dispatchWaliteAction('notify', { title: 'Panggilan Tak Terjawab', body: 'Panggilan tak terjawab', tag: 'missed-call' });
          }
        }
      }, 800);

      const titleEl = document.querySelector('title');
      if (titleEl) {
        new MutationObserver(() => {
          updateUnreadAndBadge();
        }).observe(titleEl, { childList: true, characterData: true, subtree: true });
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initObservers, 1500);
      });
    } else {
      setTimeout(initObservers, 1500);
    }
  })();

  // Cursor visibility enhancer: Prevents mouse cursor from disappearing in chat (#main)
  (function initCursorEnhancer() {
    function injectCursorStyle() {
      if (document.getElementById('wl-cursor-enhancer')) return;
      const style = document.createElement('style');
      style.id = 'wl-cursor-enhancer';
      style.textContent = `
        /* Enforce visible mouse pointer across WhatsApp Web & Chat (#main) */
        * { cursor: auto; }
        [style*="cursor: none"], [style*="cursor:none"] { cursor: default !important; }
        #main { cursor: default; }
        #main :is(button, a, [role="button"], [data-tab], [data-icon], [data-testid*="btn"], [data-testid*="menu"], [data-testid*="emoji"], [data-testid*="attach"], [data-testid*="audio-play"], [data-testid*="status"]) {
          cursor: pointer !important;
        }
        :is([contenteditable="true"], [role="textbox"], input, textarea, .selectable-text, .copyable-text) {
          cursor: text !important;
        }
        #pane-side {
          cursor: default;
        }
        #pane-side :is([role="row"], [role="listitem"]) {
          cursor: pointer !important;
        }
      `;
      (document.head || document.documentElement).appendChild(style);
    }

    if (document.head || document.documentElement) {
      injectCursorStyle();
    } else {
      document.addEventListener('DOMContentLoaded', injectCursorStyle);
    }
    document.addEventListener('DOMContentLoaded', injectCursorStyle);
    const cursorObs = new MutationObserver(() => {
      if (!document.getElementById('wl-cursor-enhancer')) injectCursorStyle();
    });
    if (document.documentElement) {
      cursorObs.observe(document.documentElement, { childList: true, subtree: true });
    }
  })();

  // Native Test Notification integration into WhatsApp Web Settings -> Notifications
  (function initWhatsAppSettingsTestButton() {
    function injectTestRow() {
      const existing = document.getElementById('walite-settings-test-card');

      // Check if user is currently looking at Settings -> Notifikasi
      let targetRow = null;
      const elements = document.querySelectorAll('span, div');
      for (const el of elements) {
        const t = (el.textContent || '').trim();
        if (t === 'Pesan' || t === 'Messages') {
          if (el.children.length === 0 && el.parentElement && !el.closest('#main') && !el.closest('#pane-side')) {
            targetRow = el.parentElement;
            break;
          }
        }
      }
      if (!targetRow) {
        for (const el of elements) {
          const t = (el.textContent || '').trim();
          if (t === 'Notifikasi pesan' || t === 'Message notifications' || t === 'Suara pesan masuk') {
            if (!el.closest('#main') && !el.closest('#pane-side')) {
              targetRow = el.closest('div[role="listitem"]') || el.closest('div[role="button"]') || el.closest('div[tabindex]') || el.parentElement.parentElement;
              break;
            }
          }
        }
      }

      // If user navigated away from Notifications settings, remove card
      if (!targetRow || !targetRow.parentElement) {
        if (existing) existing.remove();
        return;
      }

      if (existing) return;

      const container = targetRow.parentElement;
      const card = document.createElement('div');
      card.id = 'walite-settings-test-card';
      card.style.cssText = `
        margin: 12px 16px 16px 16px !important;
        padding: 12px 14px !important;
        background: #202c33 !important;
        border: 1px solid #00a884 !important;
        border-radius: 8px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 12px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
        cursor: pointer !important;
        box-sizing: border-box !important;
      `;
      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; pointer-events: none;">
          <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(0, 168, 132, 0.18); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <svg style="width: 17px; height: 17px; fill: #00a884;" viewBox="0 0 24 24">
              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
            </svg>
          </div>
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: 13px; font-weight: 600; color: #e9edef;">Tes Notifikasi & Balas Cepat</span>
            <span style="font-size: 11px; color: #8696a0;">Uji coba notifikasi melayang WaLite</span>
          </div>
        </div>
        <button type="button" style="
          background: #00a884;
          color: #111b21;
          border: none;
          border-radius: 6px;
          padding: 6px 12px;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
          white-space: nowrap;
        ">Uji Coba</button>
      `;

      function runTest(e) {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
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

      card.addEventListener('click', runTest);
      const btn = card.querySelector('button');
      if (btn) btn.addEventListener('click', runTest);

      container.insertBefore(card, targetRow);
    }

    const obs = new MutationObserver(injectTestRow);
    if (document.body) {
      obs.observe(document.body, { childList: true, subtree: true });
    }
    setInterval(injectTestRow, 600);
  })();

  // Safely Remove Desktop Upsell Banner across WhatsApp Web without freezing the UI thread
  function removeDesktopUpsell() {
    const isLoginPage = document.querySelector('canvas[aria-label*="Scan"]') || document.querySelector('[data-testid="qrcode"]');
    if (isLoginPage) return;

    const side = document.querySelector('#side') || document.querySelector('#app');
    if (!side) return;

    const selectors = [
      'span[data-icon="windows"]',
      'span[data-icon="microsoft"]',
      'span[data-icon*="whatsapp"]',
      'a[href*="whatsapp.com/download"]',
      'a[href*="aka.ms/uwp"]',
      '[data-testid*="banner"]',
      '[data-testid*="upsell"]'
    ];
    side.querySelectorAll(selectors.join(',')).forEach((el) => {
      if (el.closest('#main') || el.closest('[role="row"]') || el.closest('[data-testid="qrcode"]')) return;
      let p = el;
      for (let i = 0; i < 6 && p && p !== document.body && p !== document.documentElement; i++) {
        const text = p.textContent || '';
        if (
          text.includes('Dapatkan WhatsApp') ||
          text.includes('Get WhatsApp') ||
          text.includes('WhatsApp untuk Windows') ||
          text.includes('WhatsApp for Windows') ||
          p.matches('[data-testid*="banner"]') ||
          p.matches('[data-testid*="upsell"]') ||
          p.querySelector('a[href*="whatsapp.com/download"]') ||
          p.querySelector('a[href*="aka.ms/uwp"]')
        ) {
          p.style.setProperty('display', 'none', 'important');
          p.style.setProperty('height', '0', 'important');
          p.style.setProperty('max-height', '0', 'important');
          p.style.setProperty('margin', '0', 'important');
          p.style.setProperty('padding', '0', 'important');
          p.style.setProperty('overflow', 'hidden', 'important');
          p.style.setProperty('pointer-events', 'none', 'important');
          break;
        }
        p = p.parentElement;
      }
    });
  }

  // Debounce runner to prevent CPU thrashing
  let upsellDebounceTimer = null;
  function scheduleRemoveDesktopUpsell() {
    if (upsellDebounceTimer) return;
    upsellDebounceTimer = setTimeout(() => {
      upsellDebounceTimer = null;
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(removeDesktopUpsell, { timeout: 2000 });
      } else {
        removeDesktopUpsell();
      }
    }, 4000);
  }

  setInterval(removeDesktopUpsell, 10000);
  document.addEventListener('DOMContentLoaded', removeDesktopUpsell);

  // Polyfill window.chrome for WebKitGTK when using Chrome User-Agent
  if (navigator.userAgent.includes('Chrome') && typeof window.chrome === 'undefined') {
    window.chrome = {
      app: {
        isInstalled: false,
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }
      },
      runtime: {
        OnInstalledReason: {},
        OnRestartRequiredReason: {},
        PlatformArch: {},
        PlatformNaclArch: {},
        PlatformOs: {},
        RequestUpdateCheckStatus: {}
      },
      loadTimes: function () {},
      csi: function () {}
    };
  }

  // Web Audio Context Fix:
  // Automatically resumes any AudioContext that WebKitGTK suspends by default,
  // ensuring audio plays immediately and doesn't starve or freeze the GStreamer media pipeline
  (function initAudioContextFix() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const contexts = new Set();
    function resumeAll() {
      contexts.forEach((ctx) => {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      });
    }

    try {
      class PatchedAudioContext extends AudioCtx {
        constructor(...args) {
          super(...args);
          contexts.add(this);
          if (this.state === 'suspended') {
            this.resume().catch(() => {});
          }
          this.addEventListener('statechange', () => {
            if (this.state === 'suspended') {
              this.resume().catch(() => {});
            }
          });
        }
      }
      window.AudioContext = PatchedAudioContext;
      if (window.webkitAudioContext) window.webkitAudioContext = PatchedAudioContext;
    } catch (_) {}

    ['click', 'pointerdown', 'keydown', 'play'].forEach((evt) => {
      window.addEventListener(evt, resumeAll, true);
    });
  })();

  // Linux WebKitGTK Media & Video Enhancer:
  // Ensures HTML5 videos, status playback, and voice notes decode smoothly with inline playback and unmuted sound
  (function initMediaEnhancer() {
    function enhanceVideo(v) {
      if (!v) return;
      try {
        v.playsInline = true;
        v.setAttribute('playsinline', '');
        v.setAttribute('webkit-playsinline', '');
        // Ensure status and chat videos are unmuted so audio plays through system speakers
        if (v.muted) {
          v.muted = false;
        }
        if (v.volume < 1) {
          v.volume = 1.0;
        }
      } catch (_) {}
    }

    window.addEventListener(
      'error',
      function (e) {
        if (e.target && e.target.tagName === 'VIDEO') {
          const v = e.target;
          const err = v.error;
          console.error('[WaLite Video Error]', err ? `Code: ${err.code}, Msg: ${err.message}` : e);
        }
      },
      true
    );

    document.addEventListener(
      'play',
      function (e) {
        if (e.target && e.target.tagName === 'VIDEO') {
          const v = e.target;
          enhanceVideo(v);
          // WhatsApp Web's status viewer often sets muted = true right after mount;
          // re-unmute after a micro-delay to guarantee audio playback without synthetic button clicks
          setTimeout(() => {
            try {
              if (v.muted) v.muted = false;
              if (v.volume < 1) v.volume = 1.0;
            } catch (_) {}
          }, 100);
        }
      },
      true
    );

    document.addEventListener(
      'loadedmetadata',
      function (e) {
        if (e.target && e.target.tagName === 'VIDEO') {
          const v = e.target;
          enhanceVideo(v);
          setTimeout(() => {
            try {
              if (v.muted) v.muted = false;
              if (v.volume < 1) v.volume = 1.0;
            } catch (_) {}
          }, 100);
        }
      },
      true
    );
  })();

  // Linux & WebKitGTK drag-and-drop enhancer:
  // Prevents WebKitGTK from navigating away when dropping files from Linux file managers,
  // and allows WhatsApp Web's drop handlers to receive files seamlessly
  window.addEventListener(
    'dragover',
    (e) => {
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      e.preventDefault();
    },
    false
  );
  window.addEventListener(
    'dragenter',
    (e) => {
      e.preventDefault();
    },
    false
  );

  // Enable Native WhatsApp Web Calling & Calls Tab (Log Telepon)
  (function initWhatsAppWebCalling() {
    function hookModule(mod) {
      if (!mod || typeof mod.getABPropConfigValue !== 'function') return false;
      if (mod.getABPropConfigValue.__walite_hooked__) return true;

      const original = mod.getABPropConfigValue;
      const hooked = function (key) {
        switch (key) {
          case 'enable_web_calling':
          case 'enable_web_group_calling':
          case 'web_voip_call_tab_new_call':
          case 'web_voip_call_history':
          case 'web_voip_screen_sharing':
          case 'web_voip_call_control_in_header':
          case 'web_voip_camera_switching':
          case 'web_voip_desktop_screen_share':
            return true;
          case 'calling_disabled':
            return false;
          default:
            return original.apply(this, arguments);
        }
      };
      hooked.__walite_hooked__ = true;
      hooked.__walite_orig__ = original;
      mod.getABPropConfigValue = hooked;
      console.log('[WaLite] WAWebABProps hooked successfully: native Calling & Calls Tab enabled.');
      return true;
    }

    function checkHook() {
      try {
        if (typeof window.require === 'function') {
          const mod = window.require('WAWebABProps');
          if (hookModule(mod)) return true;
        }
      } catch (_) {}
      return false;
    }

    if (!checkHook()) {
      const interval = setInterval(() => {
        if (checkHook()) {
          clearInterval(interval);
        }
      }, 300);
      setTimeout(() => clearInterval(interval), 60000);
    }
  })();
})();
