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

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function createFileIconBadge(filename) {
    const ext = (filename.includes('.') ? filename.split('.').pop() : 'FILE').slice(0, 4).toUpperCase();
    const div = document.createElement('div');
    div.style.cssText = 'width:42px;height:44px;background:rgba(0,168,132,0.14);border:1px solid rgba(0,168,132,0.3);border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;';

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.style.cssText = 'width:18px;height:18px;fill:none;stroke:#00a884;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;';
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z');
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', '14 2 14 8 20 8');
    icon.append(path, polyline);

    const badge = document.createElement('span');
    badge.textContent = ext;
    badge.style.cssText = 'font-size:9px;font-weight:700;color:#00a884;letter-spacing:0.5px;margin-top:2px;line-height:1;';

    div.append(icon, badge);
    return div;
  }

  function createSaveSvg() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.style.cssText = 'width:16px;height:16px;fill:none;stroke:#111b21;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;';
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('points', '7 10 12 15 17 10');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '12'); line.setAttribute('y1', '15');
    line.setAttribute('x2', '12'); line.setAttribute('y2', '3');
    svg.append(path, poly, line);
    return svg;
  }

  function createOpenSvg() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.style.cssText = 'width:15px;height:15px;fill:none;stroke:#e9edef;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;';
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('points', '15 3 21 3 21 9');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '10'); line.setAttribute('y1', '14');
    line.setAttribute('x2', '21'); line.setAttribute('y2', '3');
    svg.append(path, poly, line);
    return svg;
  }

  let activeDialog = null;

  function closeDialog() {
    if (activeDialog && activeDialog.parentNode) {
      activeDialog.parentNode.removeChild(activeDialog);
    }
    activeDialog = null;
  }

  async function saveWithPicker(blob, filename, statusEl, btnSave) {
    if ('showSaveFilePicker' in window) {
      try {
        const ext = filename.includes('.') ? filename.split('.').pop() : '';
        const opts = { suggestedName: filename };
        if (ext) {
          opts.types = [{
            description: ext.toUpperCase() + ' File',
            accept: { [blob.type || 'application/octet-stream']: ['.' + ext] }
          }];
        }
        btnSave.disabled = true;
        statusEl.textContent = 'Menunggu pemilihan folder...';
        const handle = await window.showSaveFilePicker(opts);
        statusEl.textContent = 'Menyimpan berkas ke disk...';
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        statusEl.style.color = TEAL;
        statusEl.textContent = '✓ Berkas berhasil disimpan!';
        setTimeout(closeDialog, 1000);
        return true;
      } catch (e) {
        btnSave.disabled = false;
        if (e.name === 'AbortError') {
          statusEl.style.color = '#8696a0';
          statusEl.textContent = 'Penyimpanan dibatalkan.';
          return false;
        }
        console.warn('[WaLite] SaveAs fallback:', e);
        statusEl.textContent = 'Mencoba cara penyimpanan alternatif...';
      }
    }

    // Fallback: standard anchor download
    try {
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u;
      a.download = filename;
      document.body.appendChild(a);
      originalClick.call(a);
      setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(u);
      }, 3000);
      statusEl.style.color = TEAL;
      statusEl.textContent = '✓ Unduhan dikirim ke browser!';
      setTimeout(closeDialog, 1000);
      return true;
    } catch (err) {
      statusEl.style.color = '#f15c6d';
      statusEl.textContent = 'Gagal menyimpan berkas.';
      btnSave.disabled = false;
      return false;
    }
  }

  function showDownloadModal(blob, filename, url) {
    closeDialog();

    const overlay = document.createElement('div');
    overlay.className = 'wl-modal-overlay';
    activeDialog = overlay;

    const card = document.createElement('div');
    card.className = 'wl-modal-card';
    card.style.cssText =
      'width:360px;max-width:92vw;padding:20px 22px 18px;background:rgba(24,34,41,0.96);backdrop-filter:blur(24px) saturate(180%);border:1px solid rgba(255,255,255,0.1);border-radius:14px;box-shadow:0 24px 48px -12px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.06);font-family:Segoe UI,system-ui,-apple-system,sans-serif;';

    const hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;';

    const titleBox = document.createElement('div');
    titleBox.style.cssText = 'display:flex;align-items:center;gap:8px;';

    const titleIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    titleIcon.setAttribute('viewBox', '0 0 24 24');
    titleIcon.style.cssText = 'width:16px;height:16px;fill:none;stroke:#00a884;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;';
    const tPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tPath.setAttribute('d', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4');
    const tPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    tPoly.setAttribute('points', '7 10 12 15 17 10');
    const tLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tLine.setAttribute('x1', '12'); tLine.setAttribute('y1', '15');
    tLine.setAttribute('x2', '12'); tLine.setAttribute('y2', '3');
    titleIcon.append(tPath, tPoly, tLine);

    const title = document.createElement('div');
    title.style.cssText = 'font-size:14px;font-weight:600;color:#e9edef;letter-spacing:0.2px;';
    title.textContent = 'Unduh Berkas';
    titleBox.append(titleIcon, title);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'wl-panel-btn-icon';
    closeBtn.textContent = '×';
    closeBtn.style.cssText = 'background:none;border:none;font-size:18px;color:#8696a0;cursor:pointer;line-height:1;padding:2px 8px;border-radius:6px;transition:background .15s,color .15s;';
    closeBtn.onmouseenter = () => { closeBtn.style.background = 'rgba(255,255,255,0.08)'; closeBtn.style.color = '#e9edef'; };
    closeBtn.onmouseleave = () => { closeBtn.style.background = 'none'; closeBtn.style.color = '#8696a0'; };
    closeBtn.addEventListener('click', closeDialog);

    hdr.append(titleBox, closeBtn);
    card.appendChild(hdr);

    const fileBox = document.createElement('div');
    fileBox.style.cssText = 'background:rgba(17,27,33,0.7);border-radius:10px;padding:12px 14px;margin-bottom:14px;display:flex;align-items:center;gap:12px;border:1px solid rgba(255,255,255,0.06);';

    const iconEl = createFileIconBadge(filename);

    const infoEl = document.createElement('div');
    infoEl.style.cssText = 'overflow:hidden;display:flex;flex-direction:column;gap:3px;flex:1;';

    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'color:#e9edef;font-weight:500;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    nameEl.textContent = filename;
    nameEl.title = filename;

    const sizeEl = document.createElement('div');
    sizeEl.style.cssText = 'color:#8696a0;font-size:11px;';
    sizeEl.textContent = blob && blob.size ? formatBytes(blob.size) : 'Ukuran berkas';

    infoEl.append(nameEl, sizeEl);
    fileBox.append(iconEl, infoEl);
    card.appendChild(fileBox);

    const statusEl = document.createElement('div');
    statusEl.style.cssText = 'font-size:12px;min-height:18px;margin-bottom:12px;color:#8696a0;';
    statusEl.textContent = 'Pilih tindakan untuk berkas ini:';
    card.appendChild(statusEl);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

    const btnSave = document.createElement('button');
    btnSave.style.cssText = 'background:linear-gradient(180deg,#00b890 0%,#009e7c 100%);color:#111b21;border:none;border-radius:8px;padding:10px 16px;display:flex;align-items:center;justify-content:center;gap:10px;font-size:13px;font-weight:600;cursor:pointer;transition:transform .12s,background .15s,box-shadow .15s;box-shadow:0 2px 8px rgba(0,168,132,0.35);';
    btnSave.append(createSaveSvg(), document.createTextNode('Simpan Sebagai...'));
    btnSave.onmouseenter = () => { btnSave.style.transform = 'translateY(-1px)'; btnSave.style.boxShadow = '0 4px 12px rgba(0,168,132,0.45)'; };
    btnSave.onmouseleave = () => { btnSave.style.transform = 'none'; btnSave.style.boxShadow = '0 2px 8px rgba(0,168,132,0.35)'; };
    btnSave.addEventListener('click', () => {
      saveWithPicker(blob, filename, statusEl, btnSave);
    });
    actions.appendChild(btnSave);

    const btnOpen = document.createElement('button');
    btnOpen.style.cssText = 'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#e9edef;border-radius:8px;padding:9px 16px;display:flex;align-items:center;justify-content:center;gap:10px;font-size:13px;font-weight:500;cursor:pointer;transition:background .15s,border-color .15s;';
    btnOpen.append(createOpenSvg(), document.createTextNode('Buka Langsung'));
    btnOpen.onmouseenter = () => { btnOpen.style.background = 'rgba(255,255,255,0.1)'; btnOpen.style.borderColor = 'rgba(255,255,255,0.2)'; };
    btnOpen.onmouseleave = () => { btnOpen.style.background = 'rgba(255,255,255,0.06)'; btnOpen.style.borderColor = 'rgba(255,255,255,0.12)'; };
    btnOpen.addEventListener('click', () => {
      try {
        const openUrl = url || URL.createObjectURL(blob);
        window.open(openUrl, '_blank');
        statusEl.textContent = 'Membuka berkas...';
        setTimeout(closeDialog, 600);
      } catch (err) {
        console.error(err);
      }
    });
    actions.appendChild(btnOpen);

    const btnCancel = document.createElement('button');
    btnCancel.className = 'wl-link-about';
    btnCancel.style.cssText = 'background:none;border:none;color:#8696a0;font-size:12px;font-weight:500;cursor:pointer;margin-top:4px;align-self:center;padding:4px 10px;border-radius:4px;transition:color .15s;';
    btnCancel.textContent = 'Batal';
    btnCancel.onmouseenter = () => { btnCancel.style.color = '#e9edef'; };
    btnCancel.onmouseleave = () => { btnCancel.style.color = '#8696a0'; };
    btnCancel.addEventListener('click', closeDialog);
    actions.appendChild(btnCancel);

    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  async function handleDownloadIntercept(url, rawFilename) {
    let filename = rawFilename || 'file';
    if (!filename.includes('.')) {
      const urlExt = url.split('.').pop().split('?')[0];
      if (urlExt && urlExt.length <= 4) filename += '.' + urlExt;
    }

    try {
      const res = await fetch(url);
      const blob = await res.blob();
      showDownloadModal(blob, filename, url);
    } catch (e) {
      showDownloadModal(null, filename, url);
    }
  }

  // Intercept anchor clicks ONLY when an explicit download is requested
  const originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    const downloadAttr = this.getAttribute('download');
    const downloadProp = this.download;
    const hasDownload = downloadAttr !== null || (typeof downloadProp === 'string' && downloadProp.length > 0);
    if (hasDownload) {
      const href = this.href || this.getAttribute('href') || '';
      const filename = downloadAttr || downloadProp || 'download';
      if (href) {
        handleDownloadIntercept(href, filename);
        return;
      }
    }
    return originalClick.apply(this, arguments);
  };

  // Intercept DOM clicks on downloads and external links
  document.addEventListener('click', function (e) {
    const a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (a) {
      const href = a.href || a.getAttribute('href') || '';
      const downloadAttr = a.getAttribute('download');
      const downloadProp = a.download;
      const hasDownload = downloadAttr !== null || (typeof downloadProp === 'string' && downloadProp.length > 0);
      if (hasDownload) {
        if (href) {
          e.preventDefault();
          e.stopPropagation();
          handleDownloadIntercept(href, downloadAttr || downloadProp || 'download');
          return;
        }
      }

      // External link check: open in default browser (exclude WhatsApp internal services like Flows & PDF viewer)
      if (href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:'))) {
        try {
          const u = new URL(href, window.location.href);
          const isInternal =
            u.hostname === 'web.whatsapp.com' ||
            u.hostname.endsWith('.whatsapp.com') ||
            u.hostname.endsWith('.whatsapp.net') ||
            u.hostname.endsWith('.fbcdn.net');
          if (!isInternal) {
            e.preventDefault();
            e.stopPropagation();
            window.open(u.href, '_blank');
          }
        } catch (_) {}
      }
    }
  }, true);

  // Walite Navigation & Quick-Reply Bridge
  function simulateClick(el) {
    if (!el) return;
    const opts = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.click();
  }

  function dispatchWaliteAction(action, params) {
    params = params || {};
    try {
      if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
        window.__TAURI_INTERNALS__.invoke('walite_action', {
          action: action,
          title: params.title || null,
          body: params.body || null,
          icon: params.icon || null,
          tag: params.tag || null,
          text: params.text || null
        }).catch(function (err) {
          console.warn('[WaLite] Invoke action error:', err);
        });
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

  if (!window.__walite_open_chat) {
    window.__walite_open_chat = function (title, jid) {
      if (!title || title === 'WhatsApp') return false;
      const cleanTitle = title.trim();

      // 1. If currently inside the target chat, return true
      const mainHeader = document.querySelector('#main header');
      if (mainHeader && (
        mainHeader.textContent.toLowerCase().includes(cleanTitle.toLowerCase()) ||
        (jid && mainHeader.innerHTML.includes(jid.split('@')[0]))
      )) {
        return true;
      }

      // 2. Search visible rows in pane-side
      const rows = document.querySelectorAll('#pane-side [role="row"], #pane-side [role="listitem"], #pane-side div[tabindex]');
      for (const r of rows) {
        const text = r.textContent || '';
        if (text.toLowerCase().includes(cleanTitle.toLowerCase())) {
          simulateClick(r);
          return true;
        }
      }

      // 3. Search by title attribute
      const escaped = CSS.escape(cleanTitle);
      const span = document.querySelector(`#pane-side span[title="${escaped}"]`);
      if (span) {
        const r = span.closest('[role="row"]') || span.closest('div[tabindex]') || span;
        simulateClick(r);
        return true;
      }

      // 4. Fallback: Search box in sidebar
      const searchBox = document.querySelector(
        '#side div[contenteditable="true"], div[data-tab="3"], [data-testid*="search-input"], [aria-label*="Cari"], [aria-label*="Search"]'
      );
      if (searchBox) {
        searchBox.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, cleanTitle);
        searchBox.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: cleanTitle }));
        setTimeout(() => {
          const firstRow = document.querySelector('#pane-side [role="row"], #pane-side [role="listitem"]');
          if (firstRow) simulateClick(firstRow);
        }, 350);
        return true;
      }
      return false;
    };
  }

  if (!window.__walite_send_reply) {
    window.__walite_send_reply = function (title, tag, text) {
      if (!text || !text.trim()) return;
      if (window.__walite_open_chat) {
        window.__walite_open_chat(title, tag);
      }
      let attempts = 0;
      function trySend() {
        attempts++;
        const footer = document.querySelector('#main footer');
        if (!footer) {
          if (attempts < 25) setTimeout(trySend, 120);
          return;
        }
        const box = footer.querySelector('[contenteditable="true"], div[role="textbox"]');
        if (!box) {
          if (attempts < 25) setTimeout(trySend, 120);
          return;
        }
        box.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, text);
        box.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: text }));

        setTimeout(() => {
          const sendBtn = footer.querySelector('button[aria-label*="Kirim"], button[aria-label*="Send"], [data-testid="send"]') ||
                          footer.querySelector('span[data-icon="send"]')?.closest('button');
          if (sendBtn) {
            simulateClick(sendBtn);
          } else {
            box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
          }
        }, 180);
      }
      setTimeout(trySend, 250);
    };
  }

  // Brand Notifications as WaLite and set Logo Icon & Quick-Reply Toast
  if ('Notification' in window) {
    const OriginalNotification = window.Notification;
    const isWindows = typeof navigator !== 'undefined' && (/Win/i.test(navigator.platform || '') || /Windows/i.test(navigator.userAgent || ''));
    const isLinux = typeof navigator !== 'undefined' && (/Linux|X11/i.test(navigator.userAgent) || /Linux/i.test(navigator.platform || ''));

    window.Notification = function (title, options) {
      options = options || {};
      const rawTitle = (title || 'WhatsApp').trim();
      const rawBody = (options.body || '').trim();
      const rawTag = (options.tag || '').trim();
      const rawIcon = (options.icon || '').trim();

      // On Windows, dispatch to WaLite Quick-Reply Toast window
      if (isWindows) {
        dispatchWaliteAction('notify', {
          title: rawTitle,
          body: rawBody,
          icon: rawIcon,
          tag: rawTag
        });

        const dummyNotif = {
          title: rawTitle,
          body: rawBody,
          tag: rawTag,
          icon: rawIcon,
          onclick: null,
          onclose: null,
          onerror: null,
          close: function () {
            dispatchWaliteAction('close-toast', {});
          },
          addEventListener: function (type, listener) {
            if (type === 'click') this.onclick = listener;
            if (type === 'close') this.onclose = listener;
          },
          removeEventListener: function () {}
        };
        window.__active_walite_notification = dummyNotif;
        return dummyNotif;
      }

      const appTitle = rawTitle ? ('WaLite • ' + rawTitle) : 'WaLite';
      if (!isLinux) {
        if (!options.icon || options.icon.includes('whatsapp') || options.icon.includes('blob:')) {
          options.icon = WALITE_ICON;
        }
        options.badge = WALITE_ICON;
      } else {
        if (options.icon && (options.icon.startsWith('data:') || options.icon.startsWith('blob:'))) {
          delete options.icon;
        }
        delete options.badge;
      }
      try {
        return new OriginalNotification(appTitle, options);
      } catch (err) {
        console.warn('[WaLite] Notification dispatch error:', err);
      }
    };
    Object.assign(window.Notification, OriginalNotification);
    window.Notification.prototype = OriginalNotification.prototype;

    try {
      Object.defineProperty(window.Notification, 'permission', {
        get: () => 'granted',
        configurable: true
      });
      window.Notification.requestPermission = function (cb) {
        const p = Promise.resolve('granted');
        if (typeof cb === 'function') cb('granted');
        return p;
      };
    } catch (_) {}

    // Intercept ServiceWorker showNotification to route to WaLite Quick-Reply Toast
    if (typeof ServiceWorkerRegistration !== 'undefined' && ServiceWorkerRegistration.prototype.showNotification) {
      const origShowNotification = ServiceWorkerRegistration.prototype.showNotification;
      ServiceWorkerRegistration.prototype.showNotification = function (title, options) {
        try {
          window.Notification(title, options);
        } catch (e) {
          console.warn('[WaLite] SW showNotification error:', e);
        }
        return origShowNotification.apply(this, arguments);
      };
    }
  }

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
        #main,
        #main :is([role="row"], .message-in, .message-out, [data-testid*="msg"], .copyable-text, .selectable-text, [data-pre-plain-text]) {
          cursor: default !important;
        }
        #main :is(button, a, [role="button"], [data-tab], [data-icon], [data-testid*="btn"], [data-testid*="menu"], [data-testid*="emoji"], [data-testid*="attach"], [data-testid*="audio-play"], [data-testid*="status"]) {
          cursor: pointer !important;
        }
        #main footer :is([contenteditable="true"], [role="textbox"], input, textarea) {
          cursor: text !important;
        }
        #pane-side {
          cursor: default;
        }
        #pane-side :is([role="row"], [role="listitem"], [tabindex="-1"]) {
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

  // Cursor visibility enhancer: Prevents mouse cursor from disappearing in chat (#main)
  (function initCursorEnhancer() {
    function injectCursorStyle() {
      if (document.getElementById('wl-cursor-enhancer')) return;
      const style = document.createElement('style');
      style.id = 'wl-cursor-enhancer';
      style.textContent = `
        /* Enforce visible mouse pointer across WhatsApp Web */
        body, #app, #main, #pane-side { cursor: default; }
        [style*="cursor: none"], [style*="cursor:none"] { cursor: default !important; }
        button, a, [role="button"], [data-tab], [data-icon], [data-testid*="btn"], [data-testid*="menu"], [data-testid*="emoji"], [data-testid*="attach"], [data-testid*="audio-play"], [data-testid*="status"] {
          cursor: pointer !important;
        }
        footer :is([contenteditable="true"], [role="textbox"], input, textarea) {
          cursor: text !important;
        }

        /* Suppress WhatsApp desktop upsell banners */
        [data-testid*="banner"]:not(#main *):not([role="row"] *),
        [data-testid*="upsell"]:not(#main *):not([role="row"] *) {
          display: none !important;
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
  })();

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
})();
