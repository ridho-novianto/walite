/* Walite Download Manager */
(function () {
  'use strict';
  if (window.__WALITE_DOWNLOAD_MANAGER__) return;
  window.__WALITE_DOWNLOAD_MANAGER__ = true;

  const TEAL = '#00a884';

  // Keep blob URLs alive in memory so users have time to decide
  const originalRevoke = URL.revokeObjectURL;
  URL.revokeObjectURL = function (url) {
    setTimeout(() => {
      try { originalRevoke.call(URL, url); } catch (_) {}
    }, 60000);
  };

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
        console.warn('[Walite] showSaveFilePicker fallback:', e);
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
      }, 2000);
      statusEl.style.color = TEAL;
      statusEl.textContent = '✓ Unduhan dikirim ke browser!';
      setTimeout(closeDialog, 1200);
      return true;
    } catch (err) {
      console.error('[Walite] Download fallback error:', err);
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

    // Header
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

    hdr.appendChild(title);
    hdr.appendChild(closeBtn);
    card.appendChild(hdr);

    // File Preview Info Box
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
    sizeEl.textContent = blob && blob.size ? formatBytes(blob.size) : 'Ukuran tidak diketahui';

    infoEl.appendChild(nameEl);
    infoEl.appendChild(sizeEl);
    fileBox.appendChild(iconEl);
    fileBox.appendChild(infoEl);
    card.appendChild(fileBox);

    // Status / Message
    const statusEl = document.createElement('div');
    statusEl.style.fontSize = '12px';
    statusEl.style.minHeight = '18px';
    statusEl.style.marginBottom = '12px';
    statusEl.style.color = '#8696a0';
    statusEl.textContent = 'Pilih tindakan untuk berkas ini:';
    card.appendChild(statusEl);

    // Actions Group
    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.flexDirection = 'column';
    actions.style.gap = '8px';

    // 1. Save As / Save Button
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

    // 2. Open Button
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
        console.error('[Walite] Open error:', err);
      }
    });
    actions.appendChild(btnOpen);

    // 3. Cancel Button
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
      // Try to infer extension from url or mime
      const urlExt = url.split('.').pop().split('?')[0];
      if (urlExt && urlExt.length <= 4) filename += '.' + urlExt;
    }

    try {
      const res = await fetch(url);
      const blob = await res.blob();
      showDownloadModal(blob, filename, url);
    } catch (e) {
      console.warn('[Walite] Could not pre-fetch blob:', e);
      // If fetch fails, show modal with fallback url
      showDownloadModal(null, filename, url);
    }
  }

  // Intercept HTMLAnchorElement.prototype.click
  const originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    const href = this.href || this.getAttribute('href') || '';
    const download = this.download || this.getAttribute('download');
    if (href.startsWith('blob:') || download) {
      handleDownloadIntercept(href, download || 'download');
      return;
    }
    return originalClick.apply(this, arguments);
  };

  // Intercept DOM clicks on anchor elements
  document.addEventListener('click', function (e) {
    const a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (a) {
      const href = a.href || a.getAttribute('href') || '';
      const download = a.download || a.getAttribute('download');
      if (href.startsWith('blob:') || download) {
        e.preventDefault();
        e.stopPropagation();
        handleDownloadIntercept(href, download || 'download');
      }
    }
  }, true);
})();

