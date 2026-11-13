/* Walite Download Manager & Notification Enhancer */
(function () {
  'use strict';
  if (window.__WALITE_DM_INITIALIZED__) return;
  window.__WALITE_DM_INITIALIZED__ = true;

  const WALITE_ICON = 'data:image/png;base64,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';
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
        console.warn('[Walite] SaveAs fallback:', e);
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
    card.style.cssText = 'width:340px;max-width:92vw;padding:18px 20px 16px;background:rgba(32,44,51,0.96);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.12);border-radius:12px;box-shadow:0 16px 40px rgba(0,0,0,0.55);';

    const hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;';

    const title = document.createElement('div');
    title.style.cssText = 'font-size:14px;font-weight:600;color:#e9edef;letter-spacing:0.2px;';
    title.textContent = 'Unduh Berkas';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'wl-panel-btn-icon';
    closeBtn.textContent = '×';
    closeBtn.style.cssText = 'background:none;border:none;font-size:18px;color:#8696a0;cursor:pointer;line-height:1;padding:2px 6px;border-radius:4px;';
    closeBtn.addEventListener('click', closeDialog);

    hdr.append(title, closeBtn);
    card.appendChild(hdr);

    const fileBox = document.createElement('div');
    fileBox.style.cssText = 'background:#111b21;border-radius:8px;padding:10px 12px;margin-bottom:12px;display:flex;align-items:center;gap:12px;border:1px solid #222e35;';

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
    btnSave.style.cssText = 'background:#00a884;color:#111b21;border:none;border-radius:7px;padding:9px 14px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;font-weight:600;cursor:pointer;transition:background .15s;';
    btnSave.append(createSaveSvg(), document.createTextNode('Simpan Sebagai...'));
    btnSave.addEventListener('click', () => {
      saveWithPicker(blob, filename, statusEl, btnSave);
    });
    actions.appendChild(btnSave);

    const btnOpen = document.createElement('button');
    btnOpen.style.cssText = 'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#e9edef;border-radius:7px;padding:8px 14px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;font-weight:500;cursor:pointer;transition:background .15s;';
    btnOpen.append(createOpenSvg(), document.createTextNode('Buka Langsung'));
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
    btnCancel.style.cssText = 'background:none;border:none;color:#8696a0;font-size:12px;cursor:pointer;margin-top:4px;align-self:center;padding:4px;';
    btnCancel.textContent = 'Batal';
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

      // External link check: open in default browser
      if (href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:'))) {
        try {
          const u = new URL(href, window.location.href);
          if (u.hostname !== 'web.whatsapp.com') {
            e.preventDefault();
            e.stopPropagation();
            window.open(u.href, '_blank');
          }
        } catch (_) {}
      }
    }
  }, true);

  // Brand Notifications as WaLite and set Logo Icon
  if ('Notification' in window) {
    const OriginalNotification = window.Notification;
    window.Notification = function (title, options) {
      options = options || {};
      const appTitle = title ? ('WaLite • ' + title) : 'WaLite';
      if (!options.icon || options.icon.includes('whatsapp') || options.icon.includes('blob:')) {
        options.icon = WALITE_ICON;
      }
      options.badge = WALITE_ICON;
      return new OriginalNotification(appTitle, options);
    };
    Object.assign(window.Notification, OriginalNotification);
    window.Notification.prototype = OriginalNotification.prototype;
    if (OriginalNotification.permission) {
      try {
        Object.defineProperty(window.Notification, 'permission', {
          get: () => OriginalNotification.permission
        });
      } catch (_) {}
    }
  }

  // Permanently Remove Desktop Upsell Banner
  function removeDesktopUpsell() {
    const selectors = [
      'span[data-icon="windows"]',
      'span[data-icon="microsoft"]',
      'span[data-icon*="whatsapp"]',
      'a[href*="whatsapp.com/download"]',
      'a[href*="aka.ms/uwp"]',
      '[data-testid*="banner"]',
      '[data-testid*="upsell"]'
    ];
    document.querySelectorAll(selectors.join(',')).forEach((el) => {
      let p = el;
      for (let i = 0; i < 6 && p; i++) {
        if (p.textContent && (p.textContent.includes('Dapatkan WhatsApp') || p.textContent.includes('Get WhatsApp') || p.textContent.includes('WhatsApp untuk Windows') || p.textContent.includes('WhatsApp for Windows'))) {
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

    try {
      const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const val = node.nodeValue;
        if (val && (val.includes('Dapatkan WhatsApp') || val.includes('Get WhatsApp') || val.includes('WhatsApp untuk Windows') || val.includes('WhatsApp for Windows'))) {
          let p = node.parentElement;
          for (let i = 0; i < 6 && p; i++) {
            if (p.parentElement && (p.parentElement.id === 'pane-side' || p.getAttribute('role') === 'alert' || p.querySelector('a') || p.clientHeight > 0)) {
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
        }
      }
    } catch (_) {}
  }

  setInterval(removeDesktopUpsell, 1000);
  document.addEventListener('DOMContentLoaded', removeDesktopUpsell);
  const obs = new MutationObserver(removeDesktopUpsell);
  if (document.body) obs.observe(document.body, { childList: true, subtree: true });
})();
