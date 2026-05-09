(function() {
  'use strict'
  try {
    const selfProxy = window.self
    Object.defineProperty(window, 'top', {
      get: function() { return selfProxy },
      configurable: true
    })
    Object.defineProperty(window, 'parent', {
      get: function() { return selfProxy },
      configurable: true
    })
    Object.defineProperty(window, 'frameElement', {
      get: function() { return null },
      configurable: true
    })
    const origLocation = window.location
    try {
      Object.defineProperty(window, 'location', {
        get: function() { return origLocation },
        set: function() {},
        configurable: true
      })
    } catch(e) {}
    if (window !== window.top) {
      window.addEventListener('beforeunload', function(e) {
        e.stopImmediatePropagation()
      }, true)
    }
  } catch(e) {}
})()
