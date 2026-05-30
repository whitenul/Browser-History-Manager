(function () {
  'use strict';

  const IFRAME_NAME = 'mini-browser-iframe';
  const STORAGE_KEY = 'userScripts';

  function parseMeta(code) {
    const meta = {
      name: 'Unnamed',
      match: [],
      description: '',
    };
    const headerMatch = code.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
    if (!headerMatch) return meta;
    const header = headerMatch[1];
    const nameMatch = header.match(/@name\s+(.+)/);
    if (nameMatch) meta.name = nameMatch[1].trim();
    const descMatch = header.match(/@description\s+(.+)/);
    if (descMatch) meta.description = descMatch[1].trim();
    const matchRegex = /@match\s+(.+)/g;
    let m;
    while ((m = matchRegex.exec(header)) !== null) {
      meta.match.push(m[1].trim());
    }
    return meta;
  }

  function matchPattern(pattern, url) {
    try {
      var regexStr = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\/$/, '/?');
      return new RegExp('^' + regexStr + '$').test(url);
    } catch (e) {
      return false;
    }
  }

  function shouldRunInIframe() {
    try {
      return window.name === IFRAME_NAME || window.self !== window.top;
    } catch (e) {
      return true;
    }
  }

  function executeScript(script) {
    try {
      var fn = new Function(script.code);
      fn.call(window);
    } catch (e) {
      console.error('[HMM UserScript] Error in "' + script.name + '":', e);
    }
  }

  async function run() {
    if (!shouldRunInIframe()) return;

    var url = window.location.href;
    if (!url || url.startsWith('about:') || url.startsWith('chrome:') || url === 'about:blank') return;

    var data;
    try {
      data = await chrome.storage.local.get(STORAGE_KEY);
    } catch (e) {
      return;
    }

    var scripts = data[STORAGE_KEY];
    if (!Array.isArray(scripts)) return;

    var matched = scripts.filter(function (s) {
      if (!s.enabled) return false;
      if (!s.match || s.match.length === 0) return false;
      return s.match.some(function (pattern) {
        return matchPattern(pattern, url);
      });
    });

    if (matched.length === 0) return;

    matched.forEach(function (script) {
      executeScript(script);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
