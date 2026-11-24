// probe_css.js
// Script 2 of 2 in _probe: Mengukur computed CSS, layout, token warna (light + dark), tipografi,
// radius, bayangan, padding/margin/gap komponen utama WhatsApp Web, serta verifikasi panggilan.

(function () {
  function getComputed(el, props) {
    if (!el) return null;
    const cs = window.getComputedStyle(el);
    const result = {};
    props.forEach(p => {
      result[p] = cs.getPropertyValue(p) || cs[p] || '';
    });
    return result;
  }

  const props = [
    'color', 'background-color', 'font-family', 'font-size', 'font-weight',
    'line-height', 'border-radius', 'box-shadow', 'padding-top', 'padding-right',
    'padding-bottom', 'padding-left', 'margin-top', 'margin-right', 'margin-bottom',
    'margin-left', 'width', 'height', 'gap', 'border', 'border-color'
  ];

  // 1. CSS Custom Properties / Theme Tokens (Dark & Light)
  const rootStyle = window.getComputedStyle(document.documentElement);
  const bodyStyle = window.getComputedStyle(document.body);
  const isDarkMode = document.documentElement.classList.contains('dark') ||
                     document.body.classList.contains('dark') ||
                     window.matchMedia('(prefers-color-scheme: dark)').matches;

  const tokenNames = [
    '--app-background', '--sidebar-background', '--main-background',
    '--panel-header-background', '--panel-header-height',
    '--incoming-background', '--incoming-background-rgb',
    '--outgoing-background', '--outgoing-background-rgb',
    '--message-primary', '--message-secondary',
    '--primary-title', '--primary-strong',
    '--conversation-panel-background', '--compose-box-background',
    '--compose-primary', '--border-default', '--border-strong',
    '--teal', '--teal-light', '--teal-hover', '--accent',
    '--shadow-light', '--shadow-bubble'
  ];

  const tokens = {};
  tokenNames.forEach(t => {
    const val = rootStyle.getPropertyValue(t).trim() || bodyStyle.getPropertyValue(t).trim();
    if (val) tokens[t] = val;
  });

  // 2. Component Layout & Computed CSS
  // Sidebar / Chat list
  const paneSide = document.querySelector('#pane-side');
  const chatRow = document.querySelector('#pane-side [role="row"], #pane-side [role="listitem"]');
  const chatTitle = chatRow ? chatRow.querySelector('[data-testid="cell-frame-title"], span[title], ._ak8q') : null;
  const chatSnippet = chatRow ? chatRow.querySelector('[data-testid*="last-msg"], ._ak8k, span[dir="ltr"]') : null;

  // Header chat
  const mainHeader = document.querySelector('#main header');
  const mainHeaderTitle = mainHeader ? mainHeader.querySelector('span[title], [dir="auto"]') : null;

  // Check all stylesheets for CSS variables (both dark and light)
  const lightTokens = {};
  const darkTokens = {};
  try {
    for (const sheet of document.styleSheets) {
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;
        for (const rule of rules) {
          if (rule.selectorText) {
            const sel = rule.selectorText.toLowerCase();
            const isDark = sel.includes('.dark') || sel.includes('[data-theme="dark"]');
            const isLight = sel === ':root' || sel.includes('.light') || sel === 'body';
            if (rule.style) {
              for (let i = 0; i < rule.style.length; i++) {
                const prop = rule.style[i];
                if (prop.startsWith('--')) {
                  const val = rule.style.getPropertyValue(prop).trim();
                  if (isDark) darkTokens[prop] = val;
                  else if (isLight && !lightTokens[prop]) lightTokens[prop] = val;
                }
              }
            }
          }
        }
      } catch (_) {}
    }
  } catch (_) {}

  // Message bubble inspection (search broadly in document)
  const anyMsgIn = document.querySelector('.message-in, [data-testid*="msg-container"]:not(.message-out), div[class*="message-in"]');
  const anyMsgOut = document.querySelector('.message-out, div[class*="message-out"]');
  const inBubble = anyMsgIn ? (anyMsgIn.querySelector('div[class*="copyable-text"]') || anyMsgIn) : null;
  const outBubble = anyMsgOut ? (anyMsgOut.querySelector('div[class*="copyable-text"]') || anyMsgOut) : null;

  // Composer
  const mainFooter = document.querySelector('#main footer');
  const composeBox = mainFooter ? mainFooter.querySelector('[contenteditable="true"], div[role="textbox"]') : null;
  const sendBtn = mainFooter ? mainFooter.querySelector('button[data-testid="send"], span[data-icon="send"]') : null;

  // Dialog / Modal
  const dialogEl = document.querySelector('[role="dialog"], .wl-modal-card, .wl-lock-card');

  // Settings screen / drawer
  const settingsEl = document.querySelector('[data-testid="settings-screen"], [data-testid="drawer-left"]');

  const components = {
    theme: {
      mode: isDarkMode ? 'dark' : 'light',
      rootTokens: tokens,
      lightTokens: {
        '--app-background': lightTokens['--app-background'] || '#EFEAE2',
        '--incoming-background': lightTokens['--incoming-background'] || '#FFFFFF',
        '--outgoing-background': lightTokens['--outgoing-background'] || '#D9FDD3',
        '--primary-title': lightTokens['--primary-title'] || '#111B21',
        '--message-primary': lightTokens['--message-primary'] || '#111B21',
        '--panel-header-background': lightTokens['--panel-header-background'] || '#F0F2F5',
        '--sidebar-background': lightTokens['--sidebar-background'] || '#FFFFFF'
      },
      darkTokens: {
        '--app-background': darkTokens['--app-background'] || '#161717',
        '--incoming-background': darkTokens['--incoming-background'] || '#242626',
        '--outgoing-background': darkTokens['--outgoing-background'] || '#144D37',
        '--primary-title': darkTokens['--primary-title'] || '#FAFAFA',
        '--message-primary': darkTokens['--message-primary'] || '#FAFAFA',
        '--panel-header-background': darkTokens['--panel-header-background'] || '#161717',
        '--sidebar-background': darkTokens['--sidebar-background'] || '#161717'
      }
    },
    sidebar: {
      paneSide: getComputed(paneSide, ['background-color', 'width', 'max-width', 'min-width', 'overflow-y']),
      chatRow: getComputed(chatRow, props),
      chatTitle: getComputed(chatTitle, ['color', 'font-family', 'font-size', 'font-weight', 'line-height']),
      chatSnippet: getComputed(chatSnippet, ['color', 'font-size', 'line-height'])
    },
    header: {
      mainHeader: getComputed(mainHeader, ['height', 'min-height', 'background-color', 'border-bottom', 'padding-left', 'padding-right']),
      headerTitle: getComputed(mainHeaderTitle, ['color', 'font-family', 'font-size', 'font-weight', 'line-height'])
    },
    bubbles: {
      incoming: getComputed(inBubble, props),
      outgoing: getComputed(outBubble, props)
    },
    composer: {
      footer: getComputed(mainFooter, ['min-height', 'background-color', 'border-top', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right']),
      composeBox: getComputed(composeBox, props),
      sendButton: getComputed(sendBtn, ['width', 'height', 'color', 'background-color', 'border-radius'])
    },
    dialog: getComputed(dialogEl, props),
    settings: getComputed(settingsEl, props)
  };

  // 3. Web Calling Verification
  let callingFeatures = {
    webCallingABProp: false,
    webGroupCallingABProp: false,
    callHistoryABProp: false,
    screenSharingABProp: false,
    callsTabInDom: false,
    callButtonInHeader: false,
    audioInputDevices: 0,
    audioOutputDevices: 0,
    videoInputDevices: 0,
    callSignalSources: ['Notification API (tag/title)', 'document.title mutation', 'DOM mutation ([data-testid*="call"])', 'favicon link change']
  };

  try {
    if (typeof window.require === 'function') {
      const ab = window.require('WAWebABProps');
      if (ab && typeof ab.getABPropConfigValue === 'function') {
        callingFeatures.webCallingABProp = !!ab.getABPropConfigValue('enable_web_calling');
        callingFeatures.webGroupCallingABProp = !!ab.getABPropConfigValue('enable_web_group_calling');
        callingFeatures.callHistoryABProp = !!ab.getABPropConfigValue('web_voip_call_history');
        callingFeatures.screenSharingABProp = !!ab.getABPropConfigValue('web_voip_screen_sharing');
      }
    }
  } catch (e) {
    callingFeatures.abError = String(e);
  }

  // Check header for call buttons (voice call, video call)
  if (mainHeader) {
    callingFeatures.callButtonInHeader = !!mainHeader.querySelector(
      'button[aria-label*="panggilan" i], button[aria-label*="call" i], span[data-icon="audio-call"], span[data-icon="video-call"]'
    );
  }

  // Check sidebar navigation for Calls tab (ikon telepon / calls)
  const navSidebar = document.querySelector('header, #side, [role="navigation"]');
  if (navSidebar) {
    callingFeatures.callsTabInDom = !!navSidebar.querySelector(
      'button[aria-label*="Panggilan" i], button[aria-label*="Calls" i], span[data-icon="call"], span[data-icon="phone"], [data-testid*="calls"]'
    );
  }

  // Media devices count check
  if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      devices.forEach(d => {
        if (d.kind === 'audioinput') callingFeatures.audioInputDevices++;
        if (d.kind === 'audiooutput') callingFeatures.audioOutputDevices++;
        if (d.kind === 'videoinput') callingFeatures.videoInputDevices++;
      });
      sendResults();
    }).catch(() => {
      sendResults();
    });
  } else {
    sendResults();
  }

  function sendResults() {
    const payload = {
      computedStyles: components,
      calling: callingFeatures
    };
    const jsonStr = JSON.stringify(payload);
    // Send to dom_debug.log in chunks or full base64
    if (typeof window.dispatchWaliteAction === 'function') {
      window.dispatchWaliteAction('debug-log', { msg: 'PROBE_CSS_RESULT:' + jsonStr });
    }
  }
})();
