/* Walite Download Manager & Notification Enhancer */
(function () {
  'use strict';
  if (window.__WALITE_DM_INITIALIZED__) return;
  window.__WALITE_DM_INITIALIZED__ = true;

  const WALITE_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAHPElEQVR42sVXaWxUVRS+974305m2M13oCgolbiwKtS3BhaQ1ImFpqVGmGAMaTcAIAv7QGEra19eiRv3hFg00MRq3hLYYdaZqcKMBQUtnKkobEJBYoGNLaZnOTNuZee9ez30zD960UxYl8abLW+495zvnfGd5BP3PS/yX5zCiFElIxvxGRhJDhLB/J+galoM1Cf17u3DbfbKS6H3pj5KYUzaXNeMq9boC4IrHC32w+6Upali1q2EFm1mS7/OF1eeNcuEMuRogVwKAwSpBt7jikPwAImgNXN5PzOI0wWLSNqljEQRg+uGyDWH2vqtI+lr3CJzlINi1A6AU3hH+w1Z0NpRhSt9KmZZxR/jCCFKCIQ8i+GfY0wP/Q0zFaZigWxhj95hSLTOVwFgPo3Sda4G8JyoH1iQcwZMqjx0od9e/aM21V4cG/PCY1SmC+t438+Uzk+GucEs3Iyw8iwWykal0h7Oo9unxMq8EQGM431zukd+zFWQ/6T917jtsEtc4523r4xskKpG9bdw98autVFJ1Jct/kfIEk/AFQ+xvCEllFATIJvHhwImYzGNe0SnXpc7IlkD5B65i6Qn+bn3HTlO+s1eVZZlO9BrCEpKw1zNVGAwfFVvueX1U80hn/TsIYuMskp7hwGUSfzYOgKMJ2F5VpZa75but2fYDo+f837qKa5cYgel7ubDulm7cXNWsJrJMyxy2inKPVLgbNqEIcjnvqjk1PhQ4UewBdTuIWzDsU03WaZmCEPBNby2qPa4rirMkdmbl/udt1JI8DRNyG3CloLWk7k2+TytUJIHHYosYrdfi3iEtSs5PXwDYNqTZTYWmgG8QM+bmMeXKuSe4wJXu7SUVHp6WUWuY1VYN1z8whnZjgh/iz7rxXMz36kAuC6A/uyvqDUweCw0GkeXEb42M0Fnm9ORkIhAbEdBUjWgQhlVHpEyG6QHY3MIBcc8wzFZrtT3ZLDCEXzEqMXgATwpAjy/GaAkUln08tioxtULeD5IkEweWpO8dCws11vx0XoV+0wjrqV+BEZ6JGbKoo5EzgUJ1D9/XzKqokTOxgoQnAogVi8pOKR0LwgxInQPa47O9I9w5vOJBoNO09HLXzwYxG9SREGIY/R6zawP8HYbqmMEY3tVGZEXzTIyY49gfB0IDoHc1WOmCFQxj5BS/+Wb52yGIqVdIEuGUmh0taOhls91iZlwMY0eWel7MBnHL4K6Xuw8x5VO+r6wUAgOh4anLlQOx10NR61r6h2TXQMSMjiMHVkQBY+152PD4T80DWEgtb5cXWDJSKsP+0WOMMi6mT0RqNewZglRPoqHIcVeJ7EGSRFwer8ClN5Y8FSn31D8qWsw7Ratpjjgc5ZJudDRN5KimsFUJ0gj0DqZmXVTP2FHebBijD2ERfxg6HwgB47YzRQXmIQdkyDoI2RdEFGYCT5qirJOpu6Qxwk8DP2qSMlI+4TKUsbBfUVDAqDM6kEgyg6kCBc+hAcEeCUKDmWdgyaHw0Ah4AJdacuymsT7/ZkKU/UwVkGizrIbGcxh2HbNk29CY19eu9Y8OKYsRoYwwJtluyrl9+GTfZ5pXGV5q6+n2GnWSmBLmaHLobbcDLFys6y8upPuUUOREyvQpoNzX7iyueTuUkumFOaDPnJGCIBKbEIUMEDjj2LsVbvlXCJfXdkNmMzGJt/tP9tdCL3gYsqQQHNLBs4tXSZ2ghjowJ1YH8C5rXloe9IJ79RymSH08+NdAC4TBoZHz1i0hoMra4JnzG1tLpH0Qi6bg2cHTkBV5cH4ukPJo8PRgfSRCC6AbNmilPdc+CzzwvqZrbxeeWIpjJZWnIkXiEAT9ezi8eHwP4ASD34szoN4/+L7UdFMuuH7kq/lbh4zkBhIeBHmz/cM0S5Nl6B04USeENvwcNKPXRvt9j7iK63bBc0vA5lXdRTuUS4odAvca3z+hy4ExIMMKGTGyoqNui21G1hvBnsG1zuLaj8cbFAdAF1TZ3nCjOMXaE/IFP+PxiwNYCiMWSTBiGdpxI7RsngkrO2WHJTe9adR7ocVZLDkSteO4sTw2ZFBVpKt56QFLtnGQYE0JADmkI9eq3IRpBPgSfa8pAMu3WvIyXgLlB5131lRpmc/HdyRfZiLS2zEwWSMTYtDd8GJrjo2M9Q8fgdPVEMevJxvLJeBHZzlZRgl6NXV61pzA6YEmV2HNI1xmIuvjAPCY8hSByfdeU7p1f8Q/NggKYQaguyHFzjGKGpLz024Y9fqCcOoHuHdDPe0VMFEpZjnA8CLIhiXJ+RlpI94hGNHxZldR7acJesEkHriUBQWUirPwqPmnLxe94I9ns7wM0m8NeKWMiGRqtETDCBlWocpFLgCA/XD/keX4rN08MzTFV/hqwpNNw0amG9u1vpYffjnDRFEaVmBOVkjAuXBrv/HshPS96u8CAOHALUSf58Z/7Vzu0+zip9tkmfJfvw3HA734cSrHavtVKr0+AK7T+gdG/thRvzZjzgAAAABJRU5ErkJggg==';
  const TEAL = '#00a884';

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return '🖼️';
    if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) return '🎬';
    if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'opus'].includes(ext)) return '🎵';
    if (['pdf'].includes(ext)) return '📕';
    if (['doc', 'docx'].includes(ext)) return '📘';
    if (['xls', 'xlsx'].includes(ext)) return '📗';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '🗜️';
    return '📄';
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
        setTimeout(closeDialog, 1200);
        return true;
      } catch (e) {
        btnSave.disabled = false;
        if (e.name === 'AbortError') {
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
      setTimeout(closeDialog, 1200);
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
    card.style.width = '360px';
    card.style.maxWidth = '90vw';

    const hdr = document.createElement('div');
    hdr.style.display = 'flex';
    hdr.style.alignItems = 'center';
    hdr.style.justifyContent = 'space-between';
    hdr.style.marginBottom = '12px';

    const title = document.createElement('div');
    title.className = 'wl-modal-title';
    title.textContent = 'Unduh Berkas';
    title.style.margin = '0';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'wl-panel-btn-icon';
    closeBtn.textContent = '×';
    closeBtn.style.fontSize = '18px';
    closeBtn.addEventListener('click', closeDialog);

    hdr.append(title, closeBtn);
    card.appendChild(hdr);

    const fileBox = document.createElement('div');
    fileBox.style.background = '#111b21';
    fileBox.style.borderRadius = '8px';
    fileBox.style.padding = '12px';
    fileBox.style.marginBottom = '14px';
    fileBox.style.display = 'flex';
    fileBox.style.alignItems = 'center';
    fileBox.style.gap = '10px';
    fileBox.style.border = '1px solid #222e35';

    const iconEl = document.createElement('div');
    iconEl.style.fontSize = '26px';
    iconEl.textContent = getFileIcon(filename);

    const infoEl = document.createElement('div');
    infoEl.style.overflow = 'hidden';
    infoEl.style.display = 'flex';
    infoEl.style.flexDirection = 'column';
    infoEl.style.gap = '2px';

    const nameEl = document.createElement('div');
    nameEl.style.color = '#e9edef';
    nameEl.style.fontWeight = '600';
    nameEl.style.fontSize = '13px';
    nameEl.style.whiteSpace = 'nowrap';
    nameEl.style.overflow = 'hidden';
    nameEl.style.textOverflow = 'ellipsis';
    nameEl.textContent = filename;
    nameEl.title = filename;

    const sizeEl = document.createElement('div');
    sizeEl.style.color = '#8696a0';
    sizeEl.style.fontSize = '11px';
    sizeEl.textContent = blob && blob.size ? formatBytes(blob.size) : 'Ukuran berkas';

    infoEl.append(nameEl, sizeEl);
    fileBox.append(iconEl, infoEl);
    card.appendChild(fileBox);

    const statusEl = document.createElement('div');
    statusEl.style.fontSize = '12px';
    statusEl.style.minHeight = '18px';
    statusEl.style.marginBottom = '12px';
    statusEl.style.color = '#8696a0';
    statusEl.textContent = 'Pilih tindakan untuk berkas ini:';
    card.appendChild(statusEl);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.flexDirection = 'column';
    actions.style.gap = '8px';

    const btnSave = document.createElement('button');
    btnSave.className = 'wl-modal-btn wl-modal-btn-primary';
    btnSave.style.padding = '10px 14px';
    btnSave.style.display = 'flex';
    btnSave.style.alignItems = 'center';
    btnSave.style.justifyContent = 'center';
    btnSave.style.gap = '8px';
    btnSave.style.fontSize = '13px';
    btnSave.textContent = '💾 Simpan Sebagai... (Save As)';
    btnSave.addEventListener('click', () => {
      saveWithPicker(blob, filename, statusEl, btnSave);
    });
    actions.appendChild(btnSave);

    const btnOpen = document.createElement('button');
    btnOpen.className = 'wl-modal-btn wl-modal-btn-cancel';
    btnOpen.style.padding = '9px 14px';
    btnOpen.style.display = 'flex';
    btnOpen.style.alignItems = 'center';
    btnOpen.style.justifyContent = 'center';
    btnOpen.style.gap = '8px';
    btnOpen.style.fontSize = '13px';
    btnOpen.style.color = '#e9edef';
    btnOpen.textContent = '📂 Buka Berkas (Open)';
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
    btnCancel.style.marginTop = '6px';
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

  // Intercept DOM clicks ONLY on actual download triggers
  document.addEventListener('click', function (e) {
    const a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (a) {
      const downloadAttr = a.getAttribute('download');
      const downloadProp = a.download;
      const hasDownload = downloadAttr !== null || (typeof downloadProp === 'string' && downloadProp.length > 0);
      if (hasDownload) {
        const href = a.href || a.getAttribute('href') || '';
        if (href) {
          e.preventDefault();
          e.stopPropagation();
          handleDownloadIntercept(href, downloadAttr || downloadProp || 'download');
        }
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

  // Hide Desktop Upsell Banner
  function removeDesktopUpsell() {
    const elms = document.querySelectorAll('span[data-icon="windows"], span[data-icon="microsoft"], a[href*="whatsapp.com/download"], a[href*="aka.ms/uwp"]');
    elms.forEach((el) => {
      let p = el.parentElement;
      for (let i = 0; i < 5 && p; i++) {
        if (p.textContent && (p.textContent.includes('Dapatkan WhatsApp') || p.textContent.includes('Get WhatsApp'))) {
          p.style.setProperty('display', 'none', 'important');
          p.style.setProperty('height', '0', 'important');
          p.style.setProperty('margin', '0', 'important');
          p.style.setProperty('padding', '0', 'important');
          break;
        }
        p = p.parentElement;
      }
    });
  }

  setInterval(removeDesktopUpsell, 1500);
  document.addEventListener('DOMContentLoaded', removeDesktopUpsell);
})();
