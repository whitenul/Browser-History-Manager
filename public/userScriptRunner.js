(function () {
  'use strict';
  var IFRAME_NAME = 'mini-browser-iframe';
  var STORAGE_KEY = 'userScripts';

  function matchPattern(pattern, url) {
    if (!pattern || !url) return false;
    try {
      var regexStr = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\/$/, '/?');
      return new RegExp('^' + regexStr + '$').test(url);
    } catch (e) { return false; }
  }

  function isMainWorldReady() {
    return document.documentElement.getAttribute('data-hmm-main-ready') === 'true';
  }

  function sendToMainWorld(name, code) {
    window.dispatchEvent(new CustomEvent('__hmm_inject', {
      detail: { name: name, code: code }
    }));
  }

  async function run() {
    var isMiniBrowser = false;
    try { isMiniBrowser = window.name === IFRAME_NAME; } catch (e) { return; }
    if (!isMiniBrowser) return;

    var url = window.location.href;
    if (!url || url.startsWith('about:') || url.startsWith('chrome:') || url.startsWith('chrome-extension:') || url === 'about:blank') return;

    console.warn('[HMM-CS] MiniBrowser iframe detected, url=' + url);

    var scripts;
    try {
      var data = await chrome.storage.local.get(STORAGE_KEY);
      scripts = data[STORAGE_KEY];
    } catch (e) {
      console.error('[HMM-CS] Storage error:', e);
    }

    if (!Array.isArray(scripts) || scripts.length === 0) {
      try {
        var bgData = await chrome.runtime.sendMessage({ action: 'hmmGetScripts' });
        if (bgData && Array.isArray(bgData.scripts) && bgData.scripts.length > 0) {
          scripts = bgData.scripts;
        }
      } catch (e) { /* ignore */ }
    }

    if (!Array.isArray(scripts) || scripts.length === 0) {
      console.warn('[HMM-CS] No scripts available');
      return;
    }

    var matched = scripts.filter(function (s) {
      if (!s.enabled || !s.match || s.match.length === 0) return false;
      return s.match.some(function (p) { return matchPattern(p, url); });
    });

    if (matched.length === 0) {
      console.warn('[HMM-CS] No matched scripts for', url);
      return;
    }

    console.warn('[HMM-CS] Matched', matched.length, 'script(s)');

    // Check if MAIN world bridge is ready (DOM attribute set by userScriptMainWorld.js)
    var ready = isMainWorldReady();
    if (!ready) {
      // Wait up to 2 seconds for MAIN world bridge
      for (var i = 0; i < 40; i++) {
        await new Promise(function (r) { setTimeout(r, 50); });
        if (isMainWorldReady()) { ready = true; break; }
      }
    }

    if (ready) {
      console.warn('[HMM-CS] ✅ MAIN world bridge ready, injecting scripts');
      for (var j = 0; j < matched.length; j++) {
        sendToMainWorld(matched[j].name, matched[j].code);
      }
    } else {
      console.warn('[HMM-CS] ⚠️ MAIN world bridge NOT ready, trying background injection');
      try {
        var response = await chrome.runtime.sendMessage({
          action: 'hmmInjectFallback',
          url: url,
          scripts: matched.map(function (s) { return { name: s.name, code: s.code }; })
        });
        if (response && response.success) {
          console.warn('[HMM-CS] ✅ Background injection succeeded');
        } else {
          console.warn('[HMM-CS] Background injection failed, trying <script> tag');
          for (var k = 0; k < matched.length; k++) {
            var script = document.createElement('script');
            script.textContent = matched[k].code;
            (document.head || document.documentElement).appendChild(script);
            script.remove();
            console.warn('[HMM-CS] <script> tag injection attempted (may be CSP blocked):', matched[k].name);
          }
        }
      } catch (e) {
        console.error('[HMM-CS] All injection methods failed:', e);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
