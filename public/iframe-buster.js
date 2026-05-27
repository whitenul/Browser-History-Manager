// @ts-nocheck
(function() {
  'use strict'

  var isInIframe = false
  try {
    isInIframe = window.self !== window.top
  } catch(e) {
    isInIframe = true
  }

  if (!isInIframe) return

  var realParent = null
  try {
    realParent = window.parent
  } catch(e) {
    return
  }

  var selfProxy = window.self

  try { Object.defineProperty(window, 'top', { get: function() { return selfProxy }, configurable: true }) } catch(e) {}
  try { Object.defineProperty(window, 'parent', { get: function() { return selfProxy }, configurable: true }) } catch(e) {}
  try { Object.defineProperty(window, 'frameElement', { get: function() { return null }, configurable: true }) } catch(e) {}

  function sendToParent(data) {
    try {
      if (realParent && realParent !== selfProxy) {
        realParent.postMessage(data, '*')
      }
    } catch(e) {}
  }

  // ====== URL Change Monitoring ======
  var lastUrl = ''
  try { lastUrl = location.href } catch(e) { lastUrl = '' }
  var notificationDebounce = null

  function notifyUrlChange(force) {
    force = !!force
    try {
      var currentUrl = ''
      try { currentUrl = location.href } catch(e) { return }

      if (!currentUrl) return

      if (currentUrl !== lastUrl || force) {
        lastUrl = currentUrl

        if (notificationDebounce) {
          clearTimeout(notificationDebounce)
        }

        notificationDebounce = setTimeout(function() {
          sendToParent({
            type: '__iframe_navigate__',
            url: lastUrl,
            isInternalNavigation: true
          })
        }, force ? 0 : 100)
      }
    } catch(e) {}
  }

  setTimeout(function() { notifyUrlChange(true) }, 500)
  setInterval(function() { notifyUrlChange() }, 200)

  try {
    window.addEventListener('popstate', function() { setTimeout(notifyUrlChange, 50) })
    window.addEventListener('hashchange', function() { setTimeout(notifyUrlChange, 50) })
  } catch(e) {}

  // ====== Navigation Interception ======

  // Override window.open - always navigate internally
  var origOpen = window.open
  window.open = function(url, target, features) {
    if (url && typeof url === 'string') {
      url = String(url)
      if (url.length > 0 && !url.startsWith('javascript:') && !url.startsWith('data:') && !url.startsWith('blob:') && !url.startsWith('#')) {
        sendToParent({
          type: '__iframe_navigate__',
          url: url,
          isInternalNavigation: false,
          source: 'window.open'
        })
      }
    }
    return null
  }

  // Override location methods to intercept programmatic navigation
  try {
    var origLocation = window.location

    // Watch for href assignment
    var currentHref = ''
    try { currentHref = origLocation.href } catch(e) {}

    Object.defineProperty(window, 'location', {
      get: function() { return origLocation },
      set: function(url) {
        if (url && typeof url === 'string') {
          url = String(url)
          if (url.length > 0 && !url.startsWith('javascript:') && !url.startsWith('data:') && !url.startsWith('blob:')) {
            sendToParent({
              type: '__iframe_navigate__',
              url: url,
              isInternalNavigation: false,
              source: 'location.set'
            })
          }
        }
      },
      configurable: true
    })

    // Override location.assign and location.replace if they exist
    if (origLocation.assign) {
      origLocation.assign = function(url) {
        if (url && typeof url === 'string') {
          url = String(url)
          if (url.length > 0 && !url.startsWith('javascript:') && !url.startsWith('data:')) {
            sendToParent({
              type: '__iframe_navigate__',
              url: url,
              isInternalNavigation: false,
              source: 'location.assign'
            })
          }
        }
      }
    }

    if (origLocation.replace) {
      origLocation.replace = function(url) {
        if (url && typeof url === 'string') {
          url = String(url)
          if (url.length > 0 && !url.startsWith('javascript:') && !url.startsWith('data:')) {
            sendToParent({
              type: '__iframe_navigate__',
              url: url,
              isInternalNavigation: false,
              source: 'location.replace'
            })
          }
        }
      }
    }
  } catch(e) {}

  // Intercept ALL link clicks - force internal navigation
  function interceptLink(e) {
    var target = e.target
    var a = null

    try {
      if (target && typeof target.closest === 'function') {
        a = target.closest('a')
      }
    } catch(err) {}

    if (!a) {
      try {
        var t = target
        while (t && t !== document) {
          if (t.tagName === 'A' || t.tagName === 'AREA') {
            a = t
            break
          }
          t = t.parentNode
        }
      } catch(err) {}
    }

    if (!a) return

    var href = ''
    try { href = a.getAttribute('href') || '' } catch(err) { return }

    if (!href || href === '#' || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('ftp:')) return

    e.preventDefault()
    try { e.stopPropagation() } catch(err) {}
    try { e.stopImmediatePropagation() } catch(err) {}

    var resolvedUrl = href
    if (href.indexOf('//') === 0) {
      resolvedUrl = 'https:' + href
    } else if (href.charAt(0) === '/' && href.charAt(1) !== '/') {
      var origin = ''
      try { origin = location.origin } catch(err) {}
      resolvedUrl = origin + href
    }

    sendToParent({
      type: '__iframe_navigate__',
      url: resolvedUrl,
      isInternalNavigation: false,
      source: 'link.click'
    })

    return false
  }

  try {
    document.addEventListener('click', interceptLink, true)
  } catch(e) {}

  // Also intercept middle-click / context menu on links
  try {
    document.addEventListener('auxclick', function(e) {
      if (e.button === 1) {
        interceptLink(e)
      }
    }, true)
  } catch(e) {}

  // Intercept form submissions
  function interceptForm(e) {
    var form = null
    try { form = e.target } catch(err) { return }
    if (!form || form.tagName !== 'FORM') return

    var action = ''
    try { action = form.getAttribute('action') || '' } catch(err) {}
    if (!action) {
      try { action = location.href } catch(err) { action = '' }
    }

    var method = ''
    try { method = (form.method || 'get').toLowerCase() } catch(err) { method = 'get' }

    if (method !== 'post') {
      e.preventDefault()
      try { e.stopPropagation() } catch(err) {}
      try { e.stopImmediatePropagation() } catch(err) {}

      sendToParent({
        type: '__iframe_navigate__',
        url: action,
        isInternalNavigation: false,
        source: 'form.submit'
      })
    }
  }

  try {
    document.addEventListener('submit', interceptForm, true)
  } catch(e) {}

  // Intercept base tag changes
  try {
    var origBase = document.createElement.bind(document)
    document.createElement = function(tagName) {
      var el = origBase(tagName)
      if (tagName && tagName.toLowerCase() === 'base') {
        var origSetAttribute = el.setAttribute.bind(el)
        el.setAttribute = function(name, value) {
          if (name && name.toLowerCase() === 'href' && value && typeof value === 'string') {
            // Allow base href changes but log them
          }
          return origSetAttribute(name, value)
        }
      }
      return el
    }
  } catch(e) {}

})()
