(function() {
  'use strict'
  
  // Detect if we're in an iframe
  const isInIframe = (function() {
    try {
      return window.self !== window.top
    } catch(e) {
      return true
    }
  })()

  if (!isInIframe) return
  
  const selfProxy = window.self

  // Override window.top, window.parent, and window.frameElement to prevent frame-busting
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

  // ====== URL Change Monitoring ======
  let lastUrl = location.href
  let notificationDebounce = null
  
  function notifyUrlChange(force) {
    force = !!force
    try {
      var currentUrl = location.href
      
      if (currentUrl !== lastUrl || force) {
        if (notificationDebounce) {
          clearTimeout(notificationDebounce)
        }
        
        notificationDebounce = setTimeout(function() {
          lastUrl = currentUrl
          
          var message = {
            type: '__iframe_navigate__',
            url: lastUrl,
            isInternalNavigation: true
          }
          
          try {
            window.parent.postMessage(message, '*')
          } catch(e) {}
        }, force ? 0 : 100)
      }
    } catch(e) {}
  }
  
  setTimeout(function() { notifyUrlChange(true) }, 500)
  setInterval(function() { notifyUrlChange() }, 200)
  
  window.addEventListener('popstate', function() {
    setTimeout(notifyUrlChange, 50)
  })
  
  window.addEventListener('hashchange', function() {
    setTimeout(notifyUrlChange, 50)
  })

  // ====== Navigation Interception ======
  
  var origLocation = window.location
  try {
    Object.defineProperty(window, 'location', {
      get: function() { return origLocation },
      set: function(url) {
        if (url && typeof url === 'string' && (url.startsWith('http') || url.startsWith('/'))) {
          notifyUrlChange(true)
        }
      },
      configurable: true
    })
  } catch(e) {}

  var origOpen = window.open
  window.open = function(url, target, features) {
    if (url && typeof url === 'string') {
      if (!url.startsWith('javascript:') && !url.startsWith('data:') && !url.startsWith('blob:')) {
        notifyUrlChange(true)
      }
    }
    return null
  }

  function interceptLink(e) {
    var target = e.target
    var a = target.closest ? target.closest('a') : null
    
    if (!a) {
      while (target && target !== document) {
        if (target.tagName === 'A' && target.href) {
          a = target
          break
        }
        target = target.parentNode
      }
    }
    
    if (!a) return

    var href = a.getAttribute('href')
    if (!href || href === '#' || href.startsWith('javascript:')) return

    var linkTarget = a.getAttribute('target')
    if (linkTarget === '_blank' || linkTarget === '_parent' || linkTarget === '_top') {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      
      window.parent.postMessage({ 
        type: '__iframe_navigate__', 
        url: href,
        isInternalNavigation: false
      }, '*')
      return false
    }

    if (href.startsWith('http://') || href.startsWith('https://')) {
      try {
        var linkUrl = new URL(href, location.origin)
        if (linkUrl.hostname !== location.hostname || 
            linkUrl.protocol !== location.protocol ||
            linkUrl.port !== location.port) {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          
          window.parent.postMessage({ 
            type: '__iframe_navigate__', 
            url: href,
            isInternalNavigation: false
          }, '*')
          return false
        }
      } catch(err) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        
        window.parent.postMessage({ 
          type: '__iframe_navigate__', 
          url: href,
          isInternalNavigation: false
        }, '*')
        return false
      }
    } else if (href.startsWith('//')) {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      
      window.parent.postMessage({ 
        type: '__iframe_navigate__', 
        url: 'https:' + href,
        isInternalNavigation: false
      }, '*')
      return false
    } else if (href.startsWith('/') && !href.startsWith('//')) {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      
      window.parent.postMessage({ 
        type: '__iframe_navigate__', 
        url: location.origin + href,
        isInternalNavigation: false
      }, '*')
      return false
    }
  }

  document.addEventListener('click', interceptLink, true)

  function interceptForm(e) {
    var form = e.target
    if (!form || form.tagName !== 'FORM') return
    
    var action = form.getAttribute('action') || location.href
    var method = (form.method || 'get').toLowerCase()
    
    if (method !== 'post') {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      
      window.parent.postMessage({ 
        type: '__iframe_navigate__', 
        url: action,
        isInternalNavigation: false
      }, '*')
    }
  }

  document.addEventListener('submit', interceptForm, true)

})()