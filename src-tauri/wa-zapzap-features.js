/* WaLite x ZapZap Core Enhancer (Lightweight Edition) */
(function () {
  'use strict';
  if (window.__WALITE_ZAPZAP_INITIALIZED__) return;
  window.__WALITE_ZAPZAP_INITIALIZED__ = true;

  // PDF handling is managed directly by WaLite in-app Mozilla PDF.js engine
  try {
    Object.defineProperty(navigator, 'pdfViewerEnabled', {
      get: () => false,
      configurable: true,
      enumerable: true
    });
    if (typeof Navigator !== 'undefined' && Navigator.prototype) {
      Object.defineProperty(Navigator.prototype, 'pdfViewerEnabled', {
        get: () => false,
        configurable: true,
        enumerable: true
      });
    }
  } catch (_) { }

  /* =========================================================================
     IN-APP PDF VIEWER (Mozilla PDF.js Engine with Full Controls & Canvas)
     ========================================================================= */
  function ensurePdfWorker() {
    if (window.pdfjsLib && window.pdfjsWorker) {
      window.pdfjsLib.PDFWorker._mainThreadWorkerMessageHandler = window.pdfjsWorker.WorkerMessageHandler;
    }
  }
  ensurePdfWorker();

  let pdfViewerCurrentDoc = null;
  let pdfViewerScale = 1.0;
  let pdfViewerCurrentBlob = null;
  let pdfViewerCurrentName = 'Dokumen.pdf';

  function createPdfModalHtml() {
    let modal = document.getElementById('walite-pdf-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'walite-pdf-modal';
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(11, 20, 26, 0.96);
      backdrop-filter: blur(10px);
      z-index: 999999;
      display: none;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      user-select: none;
    `;

    modal.innerHTML = `
      <style>
        .walite-pdf-bar {
          height: 54px;
          min-height: 54px;
          background: #202c33;
          border-bottom: 1px solid #2a3942;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          z-index: 10;
        }
        .walite-pdf-title-box {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          flex: 1;
        }
        .walite-pdf-icon-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          background: #ea4335;
          color: #fff;
          border-radius: 6px;
          font-weight: 700;
          font-size: 11px;
          letter-spacing: 0.5px;
          flex-shrink: 0;
        }
        .walite-pdf-meta {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .walite-pdf-filename {
          color: #e9edef;
          font-size: 14px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .walite-pdf-page-count {
          color: #8696a0;
          font-size: 12px;
          font-weight: 400;
        }
        .walite-pdf-ctrls {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .walite-pdf-btn {
          background: #2a3942;
          border: 1px solid rgba(255,255,255,0.06);
          color: #e9edef;
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: background 0.15s ease, transform 0.1s ease;
        }
        .walite-pdf-btn:hover {
          background: #374248;
        }
        .walite-pdf-btn:active {
          transform: scale(0.97);
        }
        .walite-pdf-zoom-val {
          color: #8696a0;
          font-size: 12px;
          font-weight: 600;
          min-width: 44px;
          text-align: center;
        }
        .walite-pdf-btn-download {
          background: #00a884;
          color: #111b21;
          font-weight: 700;
          border: none;
        }
        .walite-pdf-btn-download:hover {
          background: #02906f;
        }
        .walite-pdf-btn-close {
          background: transparent;
          color: #8696a0;
          border: none;
          font-size: 18px;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
        }
        .walite-pdf-btn-close:hover {
          background: rgba(255,255,255,0.08);
          color: #e9edef;
        }
        .walite-pdf-body {
          flex: 1;
          overflow-y: auto;
          overflow-x: auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 30px 20px 60px 20px;
          gap: 24px;
          background: #0b141a;
        }
        .walite-pdf-page-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          transition: transform 0.15s ease;
        }
        .walite-pdf-page-wrapper canvas {
          background: #ffffff;
          border-radius: 4px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.5);
          max-width: 95vw;
        }
        .walite-pdf-page-label {
          color: #8696a0;
          font-size: 11px;
          font-weight: 500;
          margin-top: 8px;
        }
        .walite-pdf-loading {
          color: #8696a0;
          font-size: 15px;
          margin: auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
      </style>
      <div class="walite-pdf-bar">
        <div class="walite-pdf-title-box">
          <div class="walite-pdf-icon-badge">PDF</div>
          <div class="walite-pdf-meta">
            <span class="walite-pdf-filename" id="walite-pdf-filename-text">Dokumen</span>
            <span class="walite-pdf-page-count" id="walite-pdf-page-count-text">Memuat...</span>
          </div>
        </div>
        <div class="walite-pdf-ctrls">
          <button class="walite-pdf-btn" id="walite-pdf-btn-zoom-out" title="Perkecil">−</button>
          <span class="walite-pdf-zoom-val" id="walite-pdf-zoom-val-text">100%</span>
          <button class="walite-pdf-btn" id="walite-pdf-btn-zoom-in" title="Perbesar">+</button>
          <button class="walite-pdf-btn walite-pdf-btn-download" id="walite-pdf-btn-save" title="Unduh / Simpan ke Komputer">
            <svg style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2.2;" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Simpan
          </button>
          <button class="walite-pdf-btn-close" id="walite-pdf-btn-close-el" title="Tutup (Esc)">✕</button>
        </div>
      </div>
      <div class="walite-pdf-body" id="walite-pdf-body-pages">
        <div class="walite-pdf-loading" id="walite-pdf-loading-indicator">
          <span>Memuat pratinjau dokumen PDF...</span>
        </div>
      </div>
    `;

    if (document.body) {
      document.body.appendChild(modal);
    } else {
      (document.documentElement || document.head).appendChild(modal);
    }

    const closeBtn = modal.querySelector('#walite-pdf-btn-close-el');
    closeBtn.onclick = closePdfModal;

    const zoomInBtn = modal.querySelector('#walite-pdf-btn-zoom-in');
    zoomInBtn.onclick = () => {
      if (pdfViewerScale < 2.0) {
        pdfViewerScale = Math.min(2.0, pdfViewerScale + 0.2);
        applyPdfZoom();
      }
    };

    const zoomOutBtn = modal.querySelector('#walite-pdf-btn-zoom-out');
    zoomOutBtn.onclick = () => {
      if (pdfViewerScale > 0.6) {
        pdfViewerScale = Math.max(0.6, pdfViewerScale - 0.2);
        applyPdfZoom();
      }
    };

    const saveBtn = modal.querySelector('#walite-pdf-btn-save');
    saveBtn.onclick = () => {
      if (!pdfViewerCurrentBlob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(pdfViewerCurrentBlob);
      a.download = pdfViewerCurrentName || 'Dokumen.pdf';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 100);
    };

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        closePdfModal();
      }
    });

    return modal;
  }

  function closePdfModal() {
    const modal = document.getElementById('walite-pdf-modal');
    if (modal) {
      modal.style.display = 'none';
      const body = modal.querySelector('#walite-pdf-body-pages');
      if (body) body.innerHTML = '';
    }
    pdfViewerCurrentDoc = null;

    // Close underlying WhatsApp Web stuck viewer if any
    try {
      const waClose = document.querySelector('header [data-icon="x"], header [aria-label*="tutup" i], header [aria-label*="close" i], span[data-icon="x"]')?.closest('button');
      if (waClose) waClose.click();
    } catch (_) {}
  }

  function applyPdfZoom() {
    const modal = document.getElementById('walite-pdf-modal');
    if (!modal) return;
    const zoomText = modal.querySelector('#walite-pdf-zoom-val-text');
    if (zoomText) zoomText.textContent = `${Math.round(pdfViewerScale * 100)}%`;

    const wrappers = modal.querySelectorAll('.walite-pdf-page-wrapper');
    wrappers.forEach(w => {
      w.style.transform = `scale(${pdfViewerScale})`;
      w.style.transformOrigin = 'top center';
    });
  }

  async function openInAppPdf(data, fileName) {
    ensurePdfWorker();

    let retries = 0;
    while (!window.pdfjsLib && retries < 25) {
      await new Promise(r => setTimeout(r, 80));
      ensurePdfWorker();
      retries++;
    }

    if (!window.pdfjsLib) return;

    fileName = fileName || window.__walitePendingPdfName || 'Dokumen.pdf';
    pdfViewerCurrentName = fileName;
    pdfViewerScale = 1.0;

    let uint8Array;
    try {
      if (data instanceof Blob) {
        pdfViewerCurrentBlob = data;
        const buf = await data.arrayBuffer();
        uint8Array = new Uint8Array(buf);
      } else if (data instanceof ArrayBuffer) {
        uint8Array = new Uint8Array(data);
        pdfViewerCurrentBlob = new Blob([uint8Array], { type: 'application/pdf' });
      } else if (data instanceof Uint8Array) {
        uint8Array = data;
        pdfViewerCurrentBlob = new Blob([uint8Array], { type: 'application/pdf' });
      } else {
        return;
      }
    } catch (_) {
      return;
    }

    const modal = createPdfModalHtml();
    modal.style.display = 'flex';

    const filenameText = modal.querySelector('#walite-pdf-filename-text');
    if (filenameText) filenameText.textContent = fileName;

    const pageCountText = modal.querySelector('#walite-pdf-page-count-text');
    if (pageCountText) pageCountText.textContent = 'Memuat dokumen...';

    const pagesContainer = modal.querySelector('#walite-pdf-body-pages');
    pagesContainer.innerHTML = `
      <div class="walite-pdf-loading" id="walite-pdf-loading-indicator">
        <span>Menyiapkan halaman dokumen...</span>
      </div>
    `;

    try {
      const loadingTask = window.pdfjsLib.getDocument({ data: uint8Array });
      const pdf = await loadingTask.promise;
      pdfViewerCurrentDoc = pdf;

      if (pageCountText) pageCountText.textContent = `${pdf.numPages} Halaman`;
      pagesContainer.innerHTML = '';

      const dpr = window.devicePixelRatio || 1.5;
      const baseWidth = Math.min(850, Math.max(500, window.innerWidth - 120));

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const scale = baseWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale: scale * dpr });

        const wrapper = document.createElement('div');
        wrapper.className = 'walite-pdf-page-wrapper';

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;

        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;

        const pageLabel = document.createElement('div');
        pageLabel.className = 'walite-pdf-page-label';
        pageLabel.textContent = `Halaman ${i} dari ${pdf.numPages}`;

        wrapper.appendChild(canvas);
        wrapper.appendChild(pageLabel);
        pagesContainer.appendChild(wrapper);
      }
    } catch (err) {
      console.warn('[WaLite PDF] render error:', err);
      pagesContainer.innerHTML = `
        <div class="walite-pdf-loading" style="color:#ea4335;">
          <span>Gagal menampilkan pratinjau PDF.</span>
        </div>
      `;
    }
  }

  function waliteLog(msg) {
    try {
      window.open('https://web.whatsapp.com/?walite_debug=' + encodeURIComponent(msg));
    } catch (_) {}
  }

  window.waliteOpenPdf = openInAppPdf;
  window.waliteAssembleAndOpenPdf = function (fileName) {
    try {
      const chunks = window.__walitePdfChunks || [];
      window.__walitePdfChunks = [];
      let totalBinary = '';
      for (let i = 0; i < chunks.length; i++) {
        totalBinary += atob(chunks[i]);
      }
      const len = totalBinary.length;
      const uint8 = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        uint8[i] = totalBinary.charCodeAt(i);
      }
      openInAppPdf(uint8, fileName);
    } catch (err) {
      console.warn('[WaLite] Assemble PDF error:', err);
    }
  };
  window.waliteOnPdfFileReady = async function (filePath, fileName) {
    waliteLog('PDF file ready on disk: ' + filePath + ' (' + fileName + ')');
    try {
      if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
        const bytes = await window.__TAURI_INTERNALS__.invoke('read_pdf_file', { path: filePath });
        if (bytes) {
          const uint8 = new Uint8Array(bytes);
          openInAppPdf(uint8, fileName);
          return;
        }
      }
    } catch (err) {
      console.warn('[WaLite] read_pdf_file invoke error:', err);
    }
    if (window.__waliteLastPdfBlob) {
      openInAppPdf(window.__waliteLastPdfBlob, fileName);
    }
  };

  // Intercept URL.createObjectURL for PDF Blobs & click events
  (function initPdfCapture() {
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = function (obj) {
      const url = origCreate.apply(this, arguments);
      try {
        if (obj instanceof Blob) {
          const processBlob = async () => {
            let isPdf = obj.type === 'application/pdf' || (obj.name && String(obj.name).toLowerCase().endsWith('.pdf'));
            if (!isPdf && obj.size > 20) {
              try {
                const head = await obj.slice(0, 5).text();
                if (head && head.startsWith('%PDF')) isPdf = true;
              } catch (_) {}
            }
            if (isPdf) {
              window.__waliteLastPdfBlob = obj;
              window.__waliteLastPdfUrl = url;
              const name = obj.name || window.__walitePendingPdfName || 'Dokumen.pdf';
              waliteLog('Captured PDF blob: ' + name + ' size=' + obj.size);
              openInAppPdf(obj, name);
            }
          };
          processBlob().catch(() => {});
        }
      } catch (_) {}
      return url;
    };

    // Track clicks on document bubbles to capture filename
    document.addEventListener('click', (e) => {
      const target = e.target;
      if (!target) return;
      const row = target.closest('[data-testid*="msg"], [role="row"], div[role="button"], div');
      if (row) {
        const text = row.innerText || row.textContent || '';
        const match = text.match(/([a-zA-Z0-9_\-.\s()\[\]]+\.pdf)/i);
        if (match) {
          window.__walitePendingPdfName = match[1].trim();
          window.__walitePendingPdfTime = Date.now();
          waliteLog('Clicked PDF bubble: ' + window.__walitePendingPdfName);
        }
      }
    }, true);

    // Watch for WhatsApp Web stuck PDF screens (infinite spinner or "Tidak bisa membuka")
    function rescuePdfViewer() {
      try {
        const allText = document.body ? document.body.innerText : '';
        const matchPdf = allText.match(/([a-zA-Z0-9_\-.\s()\[\]]+\.pdf)/i);
        const hasSpinner = !!document.querySelector('span[data-icon="spinner"], circle, [role="status"], svg circle');
        const hasError = allText.includes('Tidak bisa membuka') || allText.includes("couldn't open");

        if (matchPdf && (hasSpinner || hasError)) {
          const fileName = matchPdf[1].trim();

          // If blob already captured, open it immediately
          if (window.__waliteLastPdfBlob) {
            const modal = document.getElementById('walite-pdf-modal');
            if (!modal || modal.style.display !== 'flex') {
              waliteLog('Rescue: Opening in-app PDF with captured blob for ' + fileName);
              openInAppPdf(window.__waliteLastPdfBlob, fileName);
            }
          } else {
            // Find download button in header or on center error screen
            let dlBtn = document.querySelector('button span[data-icon="download"], span[data-icon="download"], button[aria-label*="download" i], button[aria-label*="unduh" i]')?.closest('button');
            if (!dlBtn) {
              const allBtns = document.querySelectorAll('button');
              for (const b of allBtns) {
                const t = (b.innerText || b.textContent || '').trim();
                if (t === 'Unduh file' || t === 'Download file' || t.includes('Unduh') || t.includes('Download')) {
                  dlBtn = b;
                  break;
                }
              }
            }
            if (dlBtn && !dlBtn._waliteAutoClicked) {
              dlBtn._waliteAutoClicked = true;
              waliteLog('Rescue: Auto-clicking download button for ' + fileName);
              dlBtn.click();
            }
          }
        }
      } catch (_) {}

      // Check embeds
      try {
        const embeds = document.querySelectorAll('embed[src^="blob:"], object[data^="blob:"], iframe[src^="blob:"]');
        for (const emb of embeds) {
          if (!emb._waliteHandled) {
            emb._waliteHandled = true;
            const src = emb.src || emb.data;
            fetch(src)
              .then(r => r.blob())
              .then(b => {
                b.slice(0, 5).text().then(m => {
                  if (m.startsWith('%PDF')) {
                    openInAppPdf(b, window.__walitePendingPdfName || 'Dokumen.pdf');
                  }
                });
              })
              .catch(() => {});
          }
        }
      } catch (_) {}
    }

    const pdfObs = new MutationObserver(rescuePdfViewer);
    if (document.body) {
      pdfObs.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        if (document.body) pdfObs.observe(document.body, { childList: true, subtree: true });
      });
    }
    setInterval(rescuePdfViewer, 400);
  })();

  /* =========================================================================
     1. WebRTC Privacy Shield (Mencegah Kebocoran IP Asli via ICE Candidate)
     ========================================================================= */
  try {
    const originalRTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
    if (originalRTCPeerConnection) {
      const patchedRTCPeerConnection = function (...args) {
        const pc = new originalRTCPeerConnection(...args);
        const originalAddIceCandidate = pc.addIceCandidate;
        pc.addIceCandidate = function (candidate, successCallback, failureCallback) {
          if (candidate && candidate.candidate) {
            if (candidate.candidate.includes('typ host') || candidate.candidate.includes('typ srflx')) {
              candidate.candidate = candidate.candidate.replace(/([0-9]{1,3}\.){3}[0-9]{1,3}/g, '0.0.0.0');
              candidate.candidate = candidate.candidate.replace(/[0-9a-fA-F]{1,4}(:[0-9a-fA-F]{0,4}){2,7}/g, '::');
            }
          }
          if (arguments.length > 1) {
            return originalAddIceCandidate.apply(this, arguments);
          } else {
            return originalAddIceCandidate.call(this, candidate)
              .then(successCallback)
              .catch(failureCallback);
          }
        };
        return pc;
      };
      patchedRTCPeerConnection.prototype = originalRTCPeerConnection.prototype;
      try { window.RTCPeerConnection = patchedRTCPeerConnection; } catch (_) { }
      try { window.webkitRTCPeerConnection = patchedRTCPeerConnection; } catch (_) { }
    }
  } catch (_) { }

  /* =========================================================================
     2. Ctrl + Arrow Navigation Fix (Di dalam Composer WhatsApp Web)
     ========================================================================= */
  document.addEventListener('keydown', function (e) {
    if (!e.ctrlKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const el = sel.anchorNode && sel.anchorNode.parentElement;
    if (!el || !el.closest('[contenteditable="true"]')) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const direction = e.key === 'ArrowLeft' ? 'left' : 'right';
    const alter = e.shiftKey ? 'extend' : 'move';
    sel.modify(alter, direction, 'word');
  }, true);

  /* =========================================================================
     3. Notification Sound Guard (Bisa dibisukan saat DND/Mute)
     ========================================================================= */
  window.__waliteAudioMuted = false;
  const isMessageTone = (media) =>
    media.tagName === "AUDIO" &&
    !media.isConnected &&
    !media.loop &&
    (media.currentSrc || media.src || "").startsWith("https://static.whatsapp.net/");

  const originalAudioPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    if (window.__waliteAudioMuted && isMessageTone(this)) {
      return Promise.resolve();
    }
    return originalAudioPlay.apply(this, args);
  };

  /* =========================================================================
     4. Natural Left Chat Panel Resizer (Zero Green Lines, Zero React Crashes)
     ========================================================================= */
  const compactAttribute = 'data-walite-chat-list-compact';
  const root = document.documentElement;

  // Clean up any legacy handles or splitters
  try {
    root.removeAttribute('data-walite-dragging');
    root.removeAttribute('data-walite-chat-width');
    const oldEls = document.querySelectorAll('.walite-chat-list-resize-handle, .walite-resize-handle, #walite-chat-splitter, #walite-natural-resizer');
    oldEls.forEach(el => el.remove());
  } catch (_) { }

  // CSS for natural sizing and compact mode
  const resizableStyleEl = document.createElement('style');
  resizableStyleEl.id = 'walite-resizable-css';
  resizableStyleEl.textContent = `
    :root[data-walite-chat-width] div:has(> #side) {
      flex: 0 0 var(--walite-chat-width) !important;
      max-width: var(--walite-chat-width) !important;
      width: var(--walite-chat-width) !important;
      min-width: 180px !important;
    }
    :root[data-walite-chat-width] div:has(> #side) + div {
      flex: 1 1 0% !important;
      max-width: none !important;
      min-width: 300px !important;
    }
    :root[data-walite-chat-width] #side {
      width: 100% !important;
      max-width: 100% !important;
    }
    :root[${compactAttribute}] #side header,
    :root[${compactAttribute}] #side [role="search"],
    :root[${compactAttribute}] #side [role="searchbox"],
    :root[${compactAttribute}] #side [data-testid="chat-list-filters"],
    :root[${compactAttribute}] #side [data-testid="cell-frame-title"],
    :root[${compactAttribute}] #side [data-testid*="last-msg"],
    :root[${compactAttribute}] #side [data-testid="cell-frame-secondary"] {
      display: none !important;
    }
    :root[${compactAttribute}] #side div[role="row"],
    :root[${compactAttribute}] #side [role="listitem"] {
      justify-content: center !important;
      padding-inline: 0 !important;
    }
    #walite-natural-resizer {
      position: fixed;
      top: 0;
      bottom: 0;
      width: 14px;
      margin-left: -7px;
      cursor: col-resize !important;
      z-index: 99999;
      touch-action: none;
      outline: none;
      background: transparent !important;
      user-select: none;
      pointer-events: auto !important;
    }
  `;
  (document.head || document.documentElement).appendChild(resizableStyleEl);

  let naturalResizerEl = null;
  let isDraggingNaturalHandle = false;

  function findChatColumn() {
    const side = document.getElementById('side');
    if (!side) return null;
    let col = side;
    while (col.parentElement && col.parentElement !== document.body) {
      const parent = col.parentElement;
      const comp = window.getComputedStyle(parent);
      if (comp.display === 'flex' && comp.flexDirection.startsWith('row') && col.nextElementSibling) {
        return col;
      }
      col = parent;
    }
    return side.parentElement || side;
  }

  function applyPanelWidth(width) {
    const col = findChatColumn();
    if (!col) return;
    const minW = 200;
    const maxW = Math.max(minW, window.innerWidth - 300);
    const clamped = Math.min(Math.max(Math.round(width), minW), maxW);

    root.style.setProperty('--walite-chat-width', `${clamped}px`);
    root.setAttribute('data-walite-chat-width', '');

    col.style.setProperty('flex', `0 0 ${clamped}px`, 'important');
    col.style.setProperty('max-width', `${clamped}px`, 'important');
    col.style.setProperty('width', `${clamped}px`, 'important');
    col.style.setProperty('min-width', `${minW}px`, 'important');

    const side = document.getElementById('side');
    if (side) {
      side.style.setProperty('width', '100%', 'important');
      side.style.setProperty('max-width', '100%', 'important');
    }

    const rightCol = col.nextElementSibling;
    if (rightCol) {
      rightCol.style.setProperty('flex', '1 1 0%', 'important');
      rightCol.style.setProperty('min-width', '300px', 'important');
      rightCol.style.removeProperty('max-width');
    }

    try {
      localStorage.setItem('walite.chatWidth', String(clamped));
    } catch (_) { }

    updateResizerLocation();
  }

  function resetPanelWidth() {
    const col = findChatColumn();
    if (col) {
      col.style.removeProperty('flex');
      col.style.removeProperty('max-width');
      col.style.removeProperty('width');
      col.style.removeProperty('min-width');
      const rightCol = col.nextElementSibling;
      if (rightCol) {
        rightCol.style.removeProperty('flex');
        rightCol.style.removeProperty('min-width');
      }
    }
    root.removeAttribute('data-walite-chat-width');
    root.style.removeProperty('--walite-chat-width');
    try {
      localStorage.removeItem('walite.chatWidth');
    } catch (_) { }
    updateResizerLocation();
  }

  function updateResizerLocation() {
    if (isDraggingNaturalHandle) return;
    const col = findChatColumn();
    if (!col || !naturalResizerEl) {
      if (naturalResizerEl) naturalResizerEl.style.display = 'none';
      return;
    }
    const rect = col.getBoundingClientRect();
    if (rect.width <= 0) {
      naturalResizerEl.style.display = 'none';
      return;
    }
    naturalResizerEl.style.display = 'block';
    naturalResizerEl.style.left = `${rect.right}px`;
    naturalResizerEl.style.top = `${rect.top}px`;
    naturalResizerEl.style.height = `${rect.height}px`;
  }

  function setupNaturalResizer() {
    if (!document.body) return;
    if (!naturalResizerEl) {
      naturalResizerEl = document.createElement('div');
      naturalResizerEl.id = 'walite-natural-resizer';
      naturalResizerEl.title = 'Tarik untuk mengatur lebar panel (Klik 2x untuk reset)';
      document.body.appendChild(naturalResizerEl);

      let startX = 0;
      let startWidth = 0;

      const onMouseMove = (e) => {
        if (!isDraggingNaturalHandle) return;
        const delta = e.clientX - startX;
        applyPanelWidth(startWidth + delta);
      };

      const onMouseUp = () => {
        if (!isDraggingNaturalHandle) return;
        isDraggingNaturalHandle = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMouseMove, { capture: true });
        window.removeEventListener('mouseup', onMouseUp, { capture: true });
        updateResizerLocation();
      };

      naturalResizerEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const col = findChatColumn();
        if (!col) return;

        isDraggingNaturalHandle = true;
        startX = e.clientX;
        startWidth = col.getBoundingClientRect().width;

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        window.addEventListener('mousemove', onMouseMove, { capture: true });
        window.addEventListener('mouseup', onMouseUp, { capture: true });

        e.preventDefault();
        e.stopPropagation();
      });

      naturalResizerEl.addEventListener('dblclick', (e) => {
        resetPanelWidth();
        e.preventDefault();
        e.stopPropagation();
      });
    }

    const saved = localStorage.getItem('walite.chatWidth');
    if (saved && !isDraggingNaturalHandle) {
      const w = parseInt(saved, 10);
      if (!isNaN(w) && w >= 200) {
        applyPanelWidth(w);
      }
    }

    updateResizerLocation();
  }

  window.addEventListener('resize', updateResizerLocation);
  window.addEventListener('mousemove', (e) => {
    if (isDraggingNaturalHandle) return;
    const col = findChatColumn();
    if (!col) return;
    const rect = col.getBoundingClientRect();
    if (Math.abs(e.clientX - rect.right) < 40) {
      updateResizerLocation();
    }
  }, { passive: true });
  setInterval(setupNaturalResizer, 600);

  function toggleCompactChat() {
    const isCompact = root.hasAttribute(compactAttribute);
    if (isCompact) {
      root.removeAttribute(compactAttribute);
      const saved = localStorage.getItem('walite.chatWidth');
      if (saved) applyPanelWidth(parseInt(saved, 10));
      else resetPanelWidth();
    } else {
      root.setAttribute(compactAttribute, '');
      applyPanelWidth(85);
    }
  }

  window.waliteToggleCompactChat = toggleCompactChat;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupNaturalResizer);
  } else {
    setupNaturalResizer();
  }

  /* =========================================================================
     5. Dialog Kirim Pesan ke Nomor Baru (ZapZap "Direct Chat" Ctrl+M)
     ========================================================================= */
  let directChatDialogEl = null;

  function showDirectChatDialog() {
    if (directChatDialogEl && directChatDialogEl.parentNode) {
      directChatDialogEl.remove();
    }

    const overlay = document.createElement('div');
    overlay.className = 'walite-modal-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.65);
      backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center;
      z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      background: #202c33; color: #e9edef; width: 380px; border-radius: 14px;
      box-shadow: 0 16px 40px rgba(0,0,0,0.6); border: 1px solid #2a3942;
      padding: 22px; display: flex; flex-direction: column; gap: 14px;
    `;

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:8px;">
          <svg style="width:20px;height:20px;fill:none;stroke:#00a884;stroke-width:2" viewBox="0 0 24 24">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
          </svg>
          <span style="font-size:15px; font-weight:600; color:#e9edef;">Kirim Pesan ke Nomor Baru</span>
        </div>
        <button id="wl-dc-close" style="background:none; border:none; color:#8696a0; cursor:pointer; font-size:18px; line-height:1;">&times;</button>
      </div>
      <p style="font-size:12px; color:#8696a0; margin:0;">Mulai obrolan WhatsApp tanpa perlu menyimpan kontak di HP terlebih dahulu.</p>
      
      <div style="display:flex; gap:8px;">
        <input id="wl-dc-cc" type="text" value="+62" placeholder="Kode" style="width:70px; padding:9px 10px; background:#111b21; color:#e9edef; border:1px solid #2a3942; border-radius:8px; font-size:13px; outline:none; text-align:center;" />
        <input id="wl-dc-phone" type="tel" placeholder="Contoh: 81234567890" style="flex:1; padding:9px 12px; background:#111b21; color:#e9edef; border:1px solid #2a3942; border-radius:8px; font-size:13px; outline:none;" />
      </div>

      <textarea id="wl-dc-msg" placeholder="Pesan pembuka (opsional)..." rows="3" style="width:100%; box-sizing:border-box; padding:9px 12px; background:#111b21; color:#e9edef; border:1px solid #2a3942; border-radius:8px; font-size:13px; outline:none; resize:none;"></textarea>

      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:4px;">
        <button id="wl-dc-cancel" style="padding:8px 14px; background:#111b21; border:1px solid #2a3942; color:#8696a0; border-radius:8px; font-size:12px; font-weight:500; cursor:pointer;">Batal</button>
        <button id="wl-dc-submit" style="padding:8px 16px; background:#00a884; border:none; color:#111b21; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer;">Buka Chat</button>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    directChatDialogEl = overlay;

    const phoneInp = card.querySelector('#wl-dc-phone');
    const ccInp = card.querySelector('#wl-dc-cc');
    const msgInp = card.querySelector('#wl-dc-msg');
    phoneInp.focus();

    const closeDialog = () => { overlay.remove(); directChatDialogEl = null; };
    card.querySelector('#wl-dc-close').onclick = closeDialog;
    card.querySelector('#wl-dc-cancel').onclick = closeDialog;

    const submit = () => {
      let cc = ccInp.value.replace(/[^0-9]/g, '');
      let phone = phoneInp.value.replace(/[^0-9]/g, '');
      if (!phone) {
        phoneInp.style.borderColor = '#f15c6d';
        return;
      }
      // If user typed 0812..., convert leading 0
      if (phone.startsWith('0')) {
        phone = phone.substring(1);
      }
      const fullNumber = `${cc}${phone}`;
      const msg = encodeURIComponent(msgInp.value.trim());
      closeDialog();

      // Navigate to internal WhatsApp Web chat URL
      const targetUrl = `https://web.whatsapp.com/send?phone=${fullNumber}${msg ? `&text=${msg}` : ''}`;

      // Use hidden link click to allow WhatsApp Web internal router to take over seamlessly
      const a = document.createElement('a');
      a.href = targetUrl;
      document.body.appendChild(a);
      a.click();
      a.remove();
    };

    card.querySelector('#wl-dc-submit').onclick = submit;
    phoneInp.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
    msgInp.onkeydown = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(); };
    overlay.onkeydown = (e) => { if (e.key === 'Escape') closeDialog(); };
  }

  window.waliteOpenDirectChat = showDirectChatDialog;

  /* =========================================================================
     6. Zoom & Keyboard Shortcuts Handler (ZapZap Suite)
     ========================================================================= */
  const savedZoomKey = 'walite.zoomLevel';
  let currentZoom = parseFloat(localStorage.getItem(savedZoomKey)) || 1.0;

  function updateAllZoomDisplays() {
    const percent = Math.round(currentZoom * 100);
    const percentStr = percent + '%';

    const valZoom = document.getElementById('val-zoom');
    if (valZoom) valZoom.textContent = percentStr;

    const slider = document.getElementById('wl-zoom-slider');
    if (slider) slider.value = percent;

    const wlZoomResets = document.querySelectorAll('#wl-zoom-reset, .wl-zoom-display');
    wlZoomResets.forEach((el) => {
      el.textContent = percentStr;
    });
  }

  function applyZoom(zoom) {
    currentZoom = Math.min(2.0, Math.max(0.5, Math.round(zoom * 100) / 100));
    localStorage.setItem(savedZoomKey, String(currentZoom));
    document.body.style.zoom = String(currentZoom);
    if (typeof syncHandlePosition === 'function') syncHandlePosition();
    updateAllZoomDisplays();
  }

  // Restore saved zoom
  if (currentZoom !== 1.0) {
    try { document.body.style.zoom = String(currentZoom); } catch (_) { }
  }

  window.waliteZoomIn = () => applyZoom(currentZoom + 0.05);
  window.waliteZoomOut = () => applyZoom(currentZoom - 0.05);
  window.waliteResetZoom = () => applyZoom(1.0);
  window.waliteApplyZoom = applyZoom;
  window.waliteGetZoom = () => currentZoom;
  window.waliteUpdateZoomDisplays = updateAllZoomDisplays;

  /* =========================================================================
     7. Clipboard Spreadsheet Table Formatter (ZapZap Feature)
     ========================================================================= */
  document.addEventListener('paste', function (e) {
    if (!e.clipboardData) return;
    const active = document.activeElement;
    if (!active || !active.closest('[contenteditable="true"]')) return;

    const html = e.clipboardData.getData('text/html');
    if (html && html.includes('<table') && html.length < 1500000) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const table = doc.querySelector('table');
        if (table) {
          const rows = [];
          const trs = table.querySelectorAll('tr');
          trs.forEach((tr) => {
            const cols = [];
            tr.querySelectorAll('td, th').forEach((cell) => {
              cols.push((cell.textContent || '').replace(/\s+/g, ' ').trim());
            });
            if (cols.length > 0) rows.push(cols.join(' | '));
          });

          if (rows.length > 0) {
            e.preventDefault();
            e.stopImmediatePropagation();
            const formattedTable = rows.join('\n');
            document.execCommand('insertText', false, formattedTable);
          }
        }
      } catch (_) { }
    }
  }, true);

  /* =========================================================================
     9. Keyboard Shortcuts Guide Modal (ZapZap Feature)
     ========================================================================= */
  let shortcutsModalEl = null;

  function showShortcutsGuide() {
    if (shortcutsModalEl && shortcutsModalEl.parentNode) {
      shortcutsModalEl.remove();
    }

    const overlay = document.createElement('div');
    overlay.className = 'walite-modal-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.7);
      backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center;
      z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      background: #202c33; color: #e9edef; width: 560px; max-width: 90vw; max-height: 85vh;
      border-radius: 12px; box-shadow: 0 16px 40px rgba(0,0,0,0.6); border: 1px solid #2a3942;
      display: flex; flex-direction: column; overflow: hidden;
    `;

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; background:#111b21; border-bottom:1px solid #222e35;">
        <div style="display:flex; align-items:center; gap:8px;">
          <svg style="width:20px;height:20px;fill:none;stroke:#00a884;stroke-width:2" viewBox="0 0 24 24">
            <rect x="2" y="4" width="20" height="16" rx="2" ry="2"/>
            <line x1="6" y1="8" x2="6" y2="8"/>
            <line x1="10" y1="8" x2="10" y2="8"/>
            <line x1="14" y1="8" x2="14" y2="8"/>
            <line x1="18" y1="8" x2="18" y2="8"/>
            <line x1="6" y1="12" x2="6" y2="12"/>
            <line x1="18" y1="12" x2="18" y2="12"/>
            <line x1="7" y1="16" x2="17" y2="16"/>
          </svg>
          <span style="font-size:15px; font-weight:600; color:#e9edef;">Pintasan Keyboard (Shortcuts)</span>
        </div>
        <button id="wl-sc-close" style="background:none; border:none; color:#8696a0; cursor:pointer; font-size:20px; line-height:1;">&times;</button>
      </div>

      <div style="padding:16px 20px; overflow-y:auto; display:flex; flex-direction:column; gap:16px; font-size:12.5px;">
        <div>
          <div style="font-size:11px; font-weight:700; color:#00a884; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Fitur WaLite & ZapZap</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; background:#111b21; padding:6px 10px; border-radius:6px; border:1px solid #222e35;">
              <span style="color:#e9edef;">Chat Nomor Baru</span>
              <span style="background:#202c33; border:1px solid #2a3942; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:11px; color:#00a884;">Ctrl + M</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; background:#111b21; padding:6px 10px; border-radius:6px; border:1px solid #222e35;">
              <span style="color:#e9edef;">Compact Chat List</span>
              <span style="background:#202c33; border:1px solid #2a3942; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:11px; color:#00a884;">Ctrl + Alt + C</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; background:#111b21; padding:6px 10px; border-radius:6px; border:1px solid #222e35;">
              <span style="color:#e9edef;">Kunci Layar Sandi</span>
              <span style="background:#202c33; border:1px solid #2a3942; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:11px; color:#00a884;">Alt + X</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; background:#111b21; padding:6px 10px; border-radius:6px; border:1px solid #222e35;">
              <span style="color:#e9edef;">Panel Privasi Shield</span>
              <span style="background:#202c33; border:1px solid #2a3942; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:11px; color:#00a884;">Alt + Z</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; background:#111b21; padding:6px 10px; border-radius:6px; border:1px solid #222e35;">
              <span style="color:#e9edef;">Perbesar Tampilan</span>
              <span style="background:#202c33; border:1px solid #2a3942; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:11px; color:#00a884;">Ctrl + (+)</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; background:#111b21; padding:6px 10px; border-radius:6px; border:1px solid #222e35;">
              <span style="color:#e9edef;">Perkecil Tampilan</span>
              <span style="background:#202c33; border:1px solid #2a3942; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:11px; color:#00a884;">Ctrl + (-)</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; background:#111b21; padding:6px 10px; border-radius:6px; border:1px solid #222e35;">
              <span style="color:#e9edef;">Reset Zoom 100%</span>
              <span style="background:#202c33; border:1px solid #2a3942; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:11px; color:#00a884;">Ctrl + 0</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; background:#111b21; padding:6px 10px; border-radius:6px; border:1px solid #222e35;">
              <span style="color:#e9edef;">Pintasan Bantuan</span>
              <span style="background:#202c33; border:1px solid #2a3942; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:11px; color:#00a884;">Ctrl + /</span>
            </div>
          </div>
        </div>

        <div>
          <div style="font-size:11px; font-weight:700; color:#8696a0; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Pintasan WhatsApp Web</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; background:#111b21; padding:6px 10px; border-radius:6px; border:1px solid #222e35;">
              <span style="color:#e9edef;">Kunci Resmi WhatsApp</span>
              <span style="background:#202c33; border:1px solid #2a3942; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:11px; color:#8696a0;">Ctrl + Alt + L</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; background:#111b21; padding:6px 10px; border-radius:6px; border:1px solid #222e35;">
              <span style="color:#e9edef;">Obrolan Baru</span>
              <span style="background:#202c33; border:1px solid #2a3942; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:11px; color:#8696a0;">Ctrl + Alt + N</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; background:#111b21; padding:6px 10px; border-radius:6px; border:1px solid #222e35;">
              <span style="color:#e9edef;">Cari Obrolan</span>
              <span style="background:#202c33; border:1px solid #2a3942; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:11px; color:#8696a0;">Ctrl + Alt + /</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; background:#111b21; padding:6px 10px; border-radius:6px; border:1px solid #222e35;">
              <span style="color:#e9edef;">Tutup Obrolan</span>
              <span style="background:#202c33; border:1px solid #2a3942; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:11px; color:#8696a0;">Escape</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; background:#111b21; padding:6px 10px; border-radius:6px; border:1px solid #222e35;">
              <span style="color:#e9edef;">Tandai Belum Dibaca</span>
              <span style="background:#202c33; border:1px solid #2a3942; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:11px; color:#8696a0;">Ctrl+Alt+Shift+U</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; background:#111b21; padding:6px 10px; border-radius:6px; border:1px solid #222e35;">
              <span style="color:#e9edef;">Arsipkan Obrolan</span>
              <span style="background:#202c33; border:1px solid #2a3942; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:11px; color:#8696a0;">Ctrl+Alt+Shift+E</span>
            </div>
          </div>
        </div>
      </div>

      <div style="padding:12px 20px; background:#111b21; border-top:1px solid #222e35; display:flex; justify-content:flex-end;">
        <button id="wl-sc-ok" style="padding:8px 18px; background:#00a884; border:none; color:#111b21; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">Tutup</button>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    shortcutsModalEl = overlay;

    const closeFn = () => { overlay.remove(); shortcutsModalEl = null; };
    card.querySelector('#wl-sc-close').onclick = closeFn;
    card.querySelector('#wl-sc-ok').onclick = closeFn;
    overlay.onkeydown = (e) => { if (e.key === 'Escape') closeFn(); };
  }

  window.waliteOpenShortcutsGuide = showShortcutsGuide;

  /* =========================================================================
     10. Comprehensive ZapZap Settings Panel (Clone of ZapZap Settings Modal)
     ========================================================================= */
  let settingsModalEl = null;

  function showSettingsModal(initialTab = 'privacy') {
    if (settingsModalEl && settingsModalEl.parentNode) {
      settingsModalEl.remove();
    }

    // Read latest state
    let state = {};
    try {
      const raw = localStorage.getItem('wl:v1');
      if (raw) state = JSON.parse(raw);
    } catch (_) { }

    const overlay = document.createElement('div');
    overlay.className = 'walite-modal-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.75);
      backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center;
      z-index: 999999; font-family: "Segoe UI Variable Text", "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      background: #111b21; color: #e9edef; width: 820px; height: 580px; max-width: 94vw; max-height: 90vh;
      border-radius: 12px; box-shadow: 0 24px 64px rgba(0,0,0,0.75); border: 1px solid #222e35;
      display: flex; overflow: hidden;
    `;

    const tabs = [
      { id: 'privacy', label: 'Privasi Visual', icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' },
      { id: 'appearance', label: 'Tampilan & Zoom', icon: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/>' },
      { id: 'direct_chat', label: 'Kirim Pesan Baru', icon: '<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>' },
      { id: 'notifications', label: 'Notifikasi & Unduhan', icon: '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>' },
      { id: 'about', label: 'Tentang & Pintasan', icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>' }
    ];

    let currentTabId = initialTab;

    // Sidebar
    const navCol = document.createElement('div');
    navCol.style.cssText = `
      width: 230px; background: #202c33; border-right: 1px solid #222e35; display: flex;
      flex-direction: column; padding: 14px 10px; gap: 4px; overflow-y: auto; flex-shrink: 0;
    `;

    const brandHeader = document.createElement('div');
    brandHeader.style.cssText = 'padding: 4px 10px 12px; display:flex; align-items:center; gap:8px; border-bottom:1px solid #2a3942; margin-bottom:8px;';
    brandHeader.innerHTML = `
      <div style="width:24px; height:24px; border-radius:50%; background:#00a884; display:flex; align-items:center; justify-content:center;">
        <svg style="width:14px;height:14px;fill:none;stroke:#111b21;stroke-width:2.5" viewBox="0 0 24 24">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </div>
      <div>
        <div style="font-size:14px; font-weight:700; color:#e9edef;">WaLite</div>
        <div style="font-size:10px; color:#8696a0;">Pengaturan & Kontrol ZapZap</div>
      </div>
    `;
    navCol.appendChild(brandHeader);

    // Right Content Area
    const contentCol = document.createElement('div');
    contentCol.style.cssText = 'flex: 1; display: flex; flex-direction: column; min-width: 0; background: #111b21;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:16px 24px; border-bottom:1px solid #222e35;';
    header.innerHTML = `
      <span id="wl-settings-title" style="font-size:16px; font-weight:600; color:#e9edef;">Pengaturan</span>
      <button id="wl-settings-close" style="background:none; border:none; color:#8696a0; cursor:pointer; font-size:22px; line-height:1; padding:2px 6px; border-radius:4px;">&times;</button>
    `;
    contentCol.appendChild(header);

    const bodyArea = document.createElement('div');
    bodyArea.style.cssText = 'flex:1; padding:20px 24px; overflow-y:auto; display:flex; flex-direction:column; gap:16px;';
    contentCol.appendChild(bodyArea);

    card.appendChild(navCol);
    card.appendChild(contentCol);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    settingsModalEl = overlay;

    const closeBtn = card.querySelector('#wl-settings-close');
    const closeFn = () => { overlay.remove(); settingsModalEl = null; };
    closeBtn.onclick = closeFn;
    overlay.onkeydown = (e) => { if (e.key === 'Escape') closeFn(); };

    // Helper functions for UI rows
    function createSettingRow(title, desc, controlHtml) {
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid rgba(134,150,160,0.12);">
          <div style="padding-right:16px;">
            <div style="font-size:13px; font-weight:500; color:#e9edef;">${title}</div>
            ${desc ? `<div style="font-size:11.5px; color:#8696a0; margin-top:2px;">${desc}</div>` : ''}
          </div>
          <div>${controlHtml}</div>
        </div>
      `;
    }

    function createSwitchHtml(id, checked) {
      return `
        <label class="wl-switch" style="position:relative; display:inline-block; width:38px; height:20px;">
          <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} style="opacity:0; width:0; height:0;">
          <span style="position:absolute; cursor:pointer; inset:0; background:${checked ? '#00a884' : '#374248'}; transition:.2s; border-radius:20px;">
            <span style="position:absolute; content:''; height:14px; width:14px; left:3px; bottom:3px; background:#fff; transition:.2s; border-radius:50%; transform:${checked ? 'translateX(18px)' : 'none'};"></span>
          </span>
        </label>
      `;
    }

    function renderTab(tabId) {
      currentTabId = tabId;
      const tabDef = tabs.find(t => t.id === tabId);
      card.querySelector('#wl-settings-title').textContent = tabDef.label;

      // Update active nav button
      navCol.querySelectorAll('.wl-nav-btn').forEach(btn => {
        const isActive = btn.dataset.tab === tabId;
        btn.style.background = isActive ? '#2a3942' : 'transparent';
        btn.style.color = isActive ? '#00a884' : '#8696a0';
        btn.style.fontWeight = isActive ? '600' : '500';
      });

      // Render content
      if (tabId === 'privacy') {
        bodyArea.innerHTML = `
          <div style="background:#202c33; border:1px solid #2a3942; border-radius:10px; padding:12px 18px;">
            <div style="font-size:12px; font-weight:700; color:#00a884; text-transform:uppercase; margin-bottom:6px;">Master Privacy Switch</div>
            ${createSettingRow('Privasi Keseluruhan (Master Switch)', 'Aktifkan seluruh pengaburan visual sekaligus (Alt+Z)', createSwitchHtml('sw-overall', state.overall))}
          </div>

          <div style="background:#202c33; border:1px solid #2a3942; border-radius:10px; padding:12px 18px;">
            <div style="font-size:12px; font-weight:700; color:#00a884; text-transform:uppercase; margin-bottom:6px;">Elemen Pengaburan (Hover-to-Reveal)</div>
            ${createSettingRow('Nama Kontak & Grup', 'Kaburkan nama di daftar obrolan & header', createSwitchHtml('sw-blurNames', state.blurNames))}
            ${createSettingRow('Foto Profil / Avatar', 'Kaburkan foto profil kontak, grup, & status', createSwitchHtml('sw-blurAvatars', state.blurAvatars))}
            ${createSettingRow('Cuplikan Pesan Terakhir', 'Kaburkan pratinjau pesan di daftar obrolan kiri', createSwitchHtml('sw-blurLastMsg', state.blurLastMsg))}
            ${createSettingRow('Seluruh Isi Pesan Obrolan', 'Kaburkan gelembung pesan di dalam obrolan', createSwitchHtml('sw-blurMessages', state.blurMessages))}
            ${createSettingRow('Pratinjau Media (Foto/Video)', 'Kaburkan media gambar, video, dan stiker', createSwitchHtml('sw-blurMedia', state.blurMedia))}
            ${createSettingRow('Teks Kolom Pengetikan', 'Kaburkan teks yang sedang Anda ketik di footer', createSwitchHtml('sw-blurInput', state.blurInput))}
          </div>

          <div style="background:#202c33; border:1px solid #2a3942; border-radius:10px; padding:12px 18px;">
            <div style="font-size:12px; font-weight:700; color:#00a884; text-transform:uppercase; margin-bottom:6px;">Layar Kunci Sandi (PBKDF2 SHA-256)</div>
            ${createSettingRow('Kunci Otomatis (Auto-Lock)', `Kunci layar saat komputer idle (${state.autoLockMinutes || 10} menit)`, createSwitchHtml('sw-autoLock', state.autoLock))}
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
              <span style="font-size:12px; color:#8696a0;">Gunakan kata sandi mandiri untuk melindungi layar (Alt+X)</span>
              <button id="btn-lock-pw" style="background:#00a884; border:none; color:#111b21; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">Atur Sandi</button>
            </div>
          </div>
        `;

        const PRIVACY_CLASS_MAP = {
          blurNames: 'wl-blur-names',
          blurAvatars: 'wl-blur-avatars',
          blurLastMsg: 'wl-blur-lastmsg',
          blurMessages: 'wl-blur-messages',
          blurMedia: 'wl-blur-media',
          blurInput: 'wl-blur-input',
        };

        // Wire switches
        ['overall', 'blurNames', 'blurAvatars', 'blurLastMsg', 'blurMessages', 'blurMedia', 'blurInput', 'autoLock'].forEach(key => {
          const inp = bodyArea.querySelector(`#sw-${key}`);
          if (inp) {
            inp.onchange = () => {
              state[key] = inp.checked;
              localStorage.setItem('wl:v1', JSON.stringify(state));
              const span = inp.nextElementSibling;
              if (span) {
                span.style.background = inp.checked ? '#00a884' : '#374248';
                const dot = span.firstElementChild;
                if (dot) dot.style.transform = inp.checked ? 'translateX(18px)' : 'none';
              }
              const html = document.documentElement;
              if (key === 'overall') {
                html.classList.toggle('wl-overall-active', inp.checked);
              } else if (PRIVACY_CLASS_MAP[key]) {
                html.classList.toggle(PRIVACY_CLASS_MAP[key], inp.checked);
              }
              if (typeof window.waliteUpdateHtmlClasses === 'function') {
                window.waliteUpdateHtmlClasses();
              }
            };
          }
        });

        const pwBtn = bodyArea.querySelector('#btn-lock-pw');
        if (pwBtn) {
          pwBtn.onclick = () => {
            closeFn();
            const panel = document.querySelector('.wl-panel');
            if (panel) panel.classList.add('wl-open');
          };
        }
      } else if (tabId === 'accounts') {
        bodyArea.innerHTML = `
          <div style="background:#202c33; border:1px solid #2a3942; border-radius:10px; padding:14px 18px;">
            <div style="font-size:12px; font-weight:700; color:#00a884; text-transform:uppercase; margin-bottom:6px;">Profil WhatsApp Web (ZapZap Multi-Account)</div>
            <p style="font-size:12px; color:#8696a0; margin:0 0 12px;">WaLite mendukung multi-akun independen dengan sesi login dan direktori cache terisolasi secara permanen.</p>

            <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:#111b21; border-radius:8px; border:1px solid #222e35; margin-bottom:8px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:36px; height:36px; border-radius:50%; background:#00a884; color:#111b21; display:flex; align-items:center; justify-content:center; font-weight:700;">1</div>
                <div>
                  <div style="font-size:13px; font-weight:600; color:#e9edef;">Akun Utama (Default)</div>
                  <div style="font-size:11px; color:#00a884;">Sesi Aktif di Jendela Ini</div>
                </div>
              </div>
              <span style="font-size:11px; background:#202c33; padding:4px 8px; border-radius:4px; color:#8696a0; border:1px solid #2a3942;">Aktif</span>
            </div>

            <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:#111b21; border-radius:8px; border:1px solid #222e35;">
              <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:36px; height:36px; border-radius:50%; background:#2a3942; color:#8696a0; display:flex; align-items:center; justify-content:center; font-weight:700;">2</div>
                <div>
                  <div style="font-size:13px; font-weight:600; color:#e9edef;">Akun Kedua (Terpisah)</div>
                  <div style="font-size:11px; color:#8696a0;">Profil Sesi Mandiri (EBWebView_Account2)</div>
                </div>
              </div>
              <button id="btn-open-acc2" style="background:#00a884; border:none; color:#111b21; padding:6px 14px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">Buka Akun 2</button>
            </div>
          </div>
        `;

        const acc2Btn = bodyArea.querySelector('#btn-open-acc2');
        if (acc2Btn) {
          acc2Btn.onclick = () => {
            if (typeof window.dispatchWaliteAction === 'function') {
              window.dispatchWaliteAction('open-account', { id: '2' });
            } else {
              try { window.location.href = 'walite-action://open-account?id=2'; } catch (_) { }
            }
            closeFn();
          };
        }
      } else if (tabId === 'appearance') {
        const curZoom = Math.round(currentZoom * 100);
        bodyArea.innerHTML = `
          <div style="background:#202c33; border:1px solid #2a3942; border-radius:10px; padding:14px 18px;">
            <div style="font-size:12px; font-weight:700; color:#00a884; text-transform:uppercase; margin-bottom:6px;">Tata Letak Daftar Chat (ZapZap Resizable)</div>
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0;">
              <div>
                <div style="font-size:13px; font-weight:500; color:#e9edef;">Mode Ringkas (Compact Chat List)</div>
                <div style="font-size:11.5px; color:#8696a0; margin-top:2px;">Sembunyikan teks cuplikan dan tampilkan daftar chat berukuran avatar (Ctrl+Alt+C)</div>
              </div>
              <button id="btn-toggle-compact" style="background:#202c33; border:1px solid #2a3942; color:#00a884; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">Ubah Mode</button>
            </div>
          </div>

          <div style="background:#202c33; border:1px solid #2a3942; border-radius:10px; padding:14px 18px;">
            <div style="font-size:12px; font-weight:700; color:#00a884; text-transform:uppercase; margin-bottom:6px;">Ukuran Tampilan (Zoom)</div>
            <div style="display:flex; flex-direction:column; gap:12px; padding:6px 0;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-size:13px; font-weight:500; color:#e9edef;">Skala Tampilan WhatsApp Web</div>
                  <div style="font-size:11.5px; color:#8696a0; margin-top:2px;">Atur perbesaran teks dan elemen secara realtime</div>
                </div>
                <div style="font-size:16px; font-weight:700; color:#00a884;" id="val-zoom">${curZoom}%</div>
              </div>
              <div style="display:flex; align-items:center; gap:10px;">
                <button id="btn-zm-out" style="background:#111b21; border:1px solid #2a3942; color:#e9edef; width:34px; height:34px; border-radius:6px; font-size:16px; font-weight:bold; cursor:pointer;">-</button>
                <input type="range" id="wl-zoom-slider" min="50" max="200" step="5" value="${curZoom}" style="flex:1; accent-color:#00a884; cursor:pointer;">
                <button id="btn-zm-in" style="background:#111b21; border:1px solid #2a3942; color:#e9edef; width:34px; height:34px; border-radius:6px; font-size:16px; font-weight:bold; cursor:pointer;">+</button>
                <button id="btn-zm-rst" style="background:#111b21; border:1px solid #2a3942; color:#e9edef; padding:6px 12px; height:34px; border-radius:6px; font-size:12px; cursor:pointer;">100%</button>
              </div>
            </div>
          </div>
        `;

        bodyArea.querySelector('#btn-toggle-compact').onclick = () => {
          if (typeof window.waliteToggleCompactChat === 'function') window.waliteToggleCompactChat();
        };
        bodyArea.querySelector('#btn-zm-out').onclick = () => {
          applyZoom(currentZoom - 0.05);
        };
        bodyArea.querySelector('#btn-zm-in').onclick = () => {
          applyZoom(currentZoom + 0.05);
        };
        bodyArea.querySelector('#btn-zm-rst').onclick = () => {
          applyZoom(1.0);
        };
        const sliderEl = bodyArea.querySelector('#wl-zoom-slider');
        if (sliderEl) {
          sliderEl.oninput = (e) => {
            applyZoom(parseInt(e.target.value, 10) / 100);
          };
        }
      } else if (tabId === 'direct_chat') {
        bodyArea.innerHTML = `
          <div style="background:#202c33; border:1px solid #2a3942; border-radius:10px; padding:18px; display:flex; flex-direction:column; gap:14px;">
            <div>
              <div style="font-size:14px; font-weight:600; color:#e9edef;">Mulai Obrolan Tanpa Simpan Nomor</div>
              <div style="font-size:12px; color:#8696a0; margin-top:2px;">Kirim pesan langsung ke nomor WhatsApp mana pun tanpa perlu menambahkannya ke buku kontak telepon.</div>
            </div>

            <div style="display:flex; gap:8px;">
              <input id="set-dc-cc" type="text" value="+62" placeholder="Kode" style="width:70px; padding:9px 10px; background:#111b21; color:#e9edef; border:1px solid #2a3942; border-radius:8px; font-size:13px; outline:none; text-align:center;" />
              <input id="set-dc-phone" type="tel" placeholder="Nomor telepon (contoh: 81234567890)" style="flex:1; padding:9px 12px; background:#111b21; color:#e9edef; border:1px solid #2a3942; border-radius:8px; font-size:13px; outline:none;" />
            </div>

            <textarea id="set-dc-msg" placeholder="Pesan pembuka opsional..." rows="3" style="width:100%; box-sizing:border-box; padding:9px 12px; background:#111b21; color:#e9edef; border:1px solid #2a3942; border-radius:8px; font-size:13px; outline:none; resize:none;"></textarea>

            <div style="display:flex; justify-content:flex-end; gap:8px;">
              <button id="set-dc-submit" style="padding:9px 20px; background:#00a884; border:none; color:#111b21; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;">Buka Chat</button>
            </div>
          </div>
        `;

        const ccInp = bodyArea.querySelector('#set-dc-cc');
        const phoneInp = bodyArea.querySelector('#set-dc-phone');
        const msgInp = bodyArea.querySelector('#set-dc-msg');
        const submitBtn = bodyArea.querySelector('#set-dc-submit');

        const doSend = () => {
          let cc = ccInp.value.replace(/[^0-9]/g, '');
          let phone = phoneInp.value.replace(/[^0-9]/g, '');
          if (!phone) {
            phoneInp.style.borderColor = '#f15c6d';
            return;
          }
          if (phone.startsWith('0')) phone = phone.substring(1);
          const fullNumber = `${cc}${phone}`;
          const msg = encodeURIComponent(msgInp.value.trim());
          closeFn();

          const targetUrl = `https://web.whatsapp.com/send?phone=${fullNumber}${msg ? `&text=${msg}` : ''}`;
          const a = document.createElement('a');
          a.href = targetUrl;
          document.body.appendChild(a);
          a.click();
          a.remove();
        };

        submitBtn.onclick = doSend;
        phoneInp.onkeydown = (e) => { if (e.key === 'Enter') doSend(); };
        msgInp.onkeydown = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) doSend(); };
      } else if (tabId === 'notifications') {
        bodyArea.innerHTML = `
          <div style="background:#202c33; border:1px solid #2a3942; border-radius:10px; padding:14px 18px;">
            <div style="font-size:12px; font-weight:700; color:#00a884; text-transform:uppercase; margin-bottom:6px;">Notifikasi Desktop (Windows Action Center)</div>
            ${createSettingRow('Nama Kontak', 'Tampilkan nama pengirim di kartu notifikasi', createSwitchHtml('sw-notifName', state.notifShowName !== false))}
            ${createSettingRow('Pratinjau Pesan', 'Tampilkan isi pesan teks di kartu notifikasi', createSwitchHtml('sw-notifMsg', state.notifShowPreview !== false))}
            ${createSettingRow('Suara Notifikasi', 'Bunyikan nada dering saat pesan masuk diterima', createSwitchHtml('sw-notifSound', state.notifSound !== false))}
            ${createSettingRow('Mode Hening / DND', 'Heningkan suara saat Windows Jangan Ganggu aktif', createSwitchHtml('sw-respectDnd', state.respectDnd !== false))}
            ${createSettingRow('Balas Cepat Notifikasi (Eksperimental)', 'Mati secara default. Dapat berhenti bekerja jika tampilan WhatsApp Web berubah (fallback: otomatis buka obrolan)', createSwitchHtml('sw-expQuickReply', state.experimentalQuickReply === true))}
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding-top:10px; border-top:1px solid rgba(134,150,160,0.12);">
              <span style="font-size:12px; color:#8696a0;">Uji coba tampilan notifikasi di Windows Anda</span>
              <button id="btn-test-notif" style="background:#00a884; border:none; color:#111b21; padding:7px 14px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">🔔 Tes Notifikasi Sekarang</button>
            </div>
          </div>

          <div style="background:#202c33; border:1px solid #2a3942; border-radius:10px; padding:14px 18px;">
            <div style="font-size:12px; font-weight:700; color:#00a884; text-transform:uppercase; margin-bottom:6px;">Sistem & Pengunduhan Berkas</div>
            ${createSettingRow('Jalankan Saat Windows Menyala', 'Buka WaLite otomatis di latar belakang saat komputer dinyalakan', createSwitchHtml('sw-autoStart', state.autoStart === true))}
            ${createSettingRow('Tanya Lokasi Simpan (Save As)', 'Tampilkan dialog pemilihan folder sebelum berkas disimpan', createSwitchHtml('sw-saveAs', state.saveAs !== false))}
            ${createSettingRow('Notifikasi Selesai Unduh', 'Beri tahu melalui notifikasi saat berkas selesai diunduh', createSwitchHtml('sw-dlNotif', state.downloadNotif !== false))}
          </div>
        `;

        const testNotifBtn = bodyArea.querySelector('#btn-test-notif');
        if (testNotifBtn) {
          testNotifBtn.onclick = () => {
            if (typeof window.triggerWaliteTestNotification === 'function') {
              window.triggerWaliteTestNotification();
            }
          };
        }

        const syncField = (key, val, inp) => {
          state[key] = val;
          localStorage.setItem('wl:v1', JSON.stringify(state));
          const span = inp.nextElementSibling;
          if (span) {
            span.style.background = val ? '#00a884' : '#374248';
            const dot = span.firstElementChild;
            if (dot) dot.style.transform = val ? 'translateX(18px)' : 'none';
          }
        };

        const autoStartSw = bodyArea.querySelector('#sw-autoStart');
        if (autoStartSw) {
          autoStartSw.onchange = (e) => {
            syncField('autoStart', e.target.checked, e.target);
            if (typeof window.dispatchWaliteAction === 'function') {
              window.dispatchWaliteAction('set-setting', { key: 'autoStart', val: String(e.target.checked) });
            }
          };
        }
        bodyArea.querySelector('#sw-notifName').onchange = (e) => syncField('notifShowName', e.target.checked, e.target);
        bodyArea.querySelector('#sw-notifMsg').onchange = (e) => syncField('notifShowPreview', e.target.checked, e.target);
        bodyArea.querySelector('#sw-notifSound').onchange = (e) => {
          syncField('notifSound', e.target.checked, e.target);
          window.__waliteAudioMuted = !e.target.checked;
        };
        bodyArea.querySelector('#sw-respectDnd').onchange = (e) => syncField('respectDnd', e.target.checked, e.target);
        const expQuickReplySw = bodyArea.querySelector('#sw-expQuickReply');
        if (expQuickReplySw) {
          expQuickReplySw.onchange = (e) => {
            syncField('experimentalQuickReply', e.target.checked, e.target);
            if (typeof window.dispatchWaliteAction === 'function') {
              window.dispatchWaliteAction('set-setting', { key: 'experimentalQuickReply', val: String(e.target.checked) });
            }
          };
        }
        bodyArea.querySelector('#sw-saveAs').onchange = (e) => {
          syncField('saveAs', e.target.checked, e.target);
          if (typeof window.dispatchWaliteAction === 'function') {
            window.dispatchWaliteAction('set-setting', { key: 'saveAs', val: String(e.target.checked) });
          }
        };
        bodyArea.querySelector('#sw-dlNotif').onchange = (e) => {
          syncField('downloadNotif', e.target.checked, e.target);
          if (typeof window.dispatchWaliteAction === 'function') {
            window.dispatchWaliteAction('set-setting', { key: 'downloadNotif', val: String(e.target.checked) });
          }
        };
      } else if (tabId === 'about') {
        bodyArea.innerHTML = `
          <div style="background:#202c33; border:1px solid #2a3942; border-radius:10px; padding:18px; text-align:center;">
            <div style="width:48px; height:48px; border-radius:50%; background:#00a884; margin:0 auto 8px; display:flex; align-items:center; justify-content:center;">
              <svg style="width:26px;height:26px;fill:none;stroke:#111b21;stroke-width:2.2" viewBox="0 0 24 24">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div style="font-size:17px; font-weight:700; color:#e9edef;">WaLite</div>
            <div style="font-size:12px; color:#00a884; font-weight:600; margin-top:2px;">Lightweight WhatsApp Web Wrapper</div>
            <div style="font-size:11px; color:#8696a0; margin-top:4px;">Versi 0.2.0 • Rust + Tauri v2 Engine • Lisensi MIT</div>
          </div>

          <div style="background:#202c33; border:1px solid #2a3942; border-radius:10px; padding:14px 18px;">
            <div style="font-size:12px; font-weight:700; color:#00a884; text-transform:uppercase; margin-bottom:8px;">Pintasan Keyboard Penting</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; background:#111b21; padding:6px 10px; border-radius:6px; border:1px solid #222e35;">
                <span style="font-size:12px; color:#e9edef;">Buka Pengaturan</span>
                <span style="background:#202c33; border:1px solid #2a3942; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:11px; color:#00a884;">Ctrl + P</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; background:#111b21; padding:6px 10px; border-radius:6px; border:1px solid #222e35;">
                <span style="font-size:12px; color:#e9edef;">Chat Nomor Baru</span>
                <span style="background:#202c33; border:1px solid #2a3942; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:11px; color:#00a884;">Ctrl + M</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; background:#111b21; padding:6px 10px; border-radius:6px; border:1px solid #222e35;">
                <span style="font-size:12px; color:#e9edef;">Compact Chat List</span>
                <span style="background:#202c33; border:1px solid #2a3942; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:11px; color:#00a884;">Ctrl + Alt + C</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; background:#111b21; padding:6px 10px; border-radius:6px; border:1px solid #222e35;">
                <span style="font-size:12px; color:#e9edef;">Kunci Layar Sandi</span>
                <span style="background:#202c33; border:1px solid #2a3942; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:11px; color:#00a884;">Alt + X</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; background:#111b21; padding:6px 10px; border-radius:6px; border:1px solid #222e35;">
                <span style="font-size:12px; color:#e9edef;">Kunci WhatsApp Web</span>
                <span style="background:#202c33; border:1px solid #2a3942; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:11px; color:#00a884;">Ctrl + Alt + L</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; background:#111b21; padding:6px 10px; border-radius:6px; border:1px solid #222e35;">
                <span style="font-size:12px; color:#e9edef;">Zoom In / Out</span>
                <span style="background:#202c33; border:1px solid #2a3942; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:11px; color:#00a884;">Ctrl + (+/-)</span>
              </div>
            </div>
          </div>
        `;
      }
    }

    // Build Nav List
    tabs.forEach(tab => {
      const btn = document.createElement('div');
      btn.className = 'wl-nav-btn';
      btn.dataset.tab = tab.id;
      btn.style.cssText = `
        display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:8px;
        font-size:12.5px; font-weight:500; color:#8696a0; cursor:pointer; transition:all 0.15s ease;
      `;
      btn.innerHTML = `
        <svg style="width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;flex-shrink:0;" viewBox="0 0 24 24">
          ${tab.icon}
        </svg>
        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${tab.label}</span>
      `;
      btn.onmouseenter = () => { if (currentTabId !== tab.id) btn.style.color = '#e9edef'; };
      btn.onmouseleave = () => { if (currentTabId !== tab.id) btn.style.color = '#8696a0'; };
      btn.onclick = () => renderTab(tab.id);
      navCol.appendChild(btn);
    });

    renderTab(initialTab);
  }

  window.waliteOpenSettings = showSettingsModal;

  /* =========================================================================
     11. Global Keyboard Shortcuts Handler
     ========================================================================= */
  window.addEventListener('keydown', (e) => {
    // Ctrl + P: Buka Pengaturan Lengkap (ZapZap Settings)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P') && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      showSettingsModal();
    }
    // Ctrl + M: Kirim pesan ke nomor baru
    if ((e.ctrlKey || e.metaKey) && (e.key === 'm' || e.key === 'M') && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      showDirectChatDialog();
    }
    // Ctrl + Alt + C: Toggle Compact Chat List
    if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      e.stopPropagation();
      window.waliteToggleCompactChat();
    }
    // Ctrl + / or Ctrl + Shift + ?: Panduan Pintasan Keyboard
    if ((e.ctrlKey || e.metaKey) && (e.key === '/' || e.key === '?')) {
      e.preventDefault();
      e.stopPropagation();
      showShortcutsGuide();
    }
    // F12: Buka Developer Tools / Console Inspect
    if (e.key === 'F12') {
      e.preventDefault();
      if (typeof window.dispatchWaliteAction === 'function') {
        window.dispatchWaliteAction('open-devtools', {});
      }
    }
    // Zoom: Ctrl + Plus, Ctrl + Minus, Ctrl + 0
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        applyZoom(currentZoom + 0.1);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        applyZoom(currentZoom - 0.1);
      } else if (e.key === '0') {
        e.preventDefault();
        applyZoom(1.0);
      }
    }
  }, true);

  /* =========================================================================
     12. Bootstrap & Layout Watcher
     ========================================================================= */
  function initZapZapEnhancements() {
    if (typeof syncLayout === 'function') syncLayout();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initZapZapEnhancements);
  } else {
    initZapZapEnhancements();
  }
})();
