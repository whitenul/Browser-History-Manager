// heading-extractor.js — Content script for extracting page headings
// Inspired by HeadingsMap: proper visibility check, ARIA support, ancestor chain, outline algorithm

;(function () {
  'use strict'

  if (window.__headingExtractorLoaded) return
  window.__headingExtractorLoaded = true

  let overlayContainer = null
  let currentOverlay = null

  // ========== Visibility Detection (HeadingsMap-style) ==========

  /**
   * Check if an element is truly visible by checking itself AND all ancestors.
   * An element is hidden if any ancestor in the chain is display:none / visibility:hidden.
   * Also checks aria-hidden="true" for assistive technology visibility.
   */
  function isElementVisible(el) {
    // Check aria-hidden on the element itself
    if (el.getAttribute('aria-hidden') === 'true') return false

    // Walk up the ancestor chain
    let current = el
    while (current && current !== document.documentElement) {
      const style = window.getComputedStyle(current)
      if (style.display === 'none') return false
      if (style.visibility === 'hidden') return false
      // opacity:0 is a visual hide but element still occupies space
      // We consider it "potentially hidden" rather than fully hidden
      if (current !== el && style.opacity === '0') return false
      // Check aria-hidden on ancestors
      if (current.getAttribute('aria-hidden') === 'true') return false
      current = current.parentElement
    }

    // Check if element is inside a <template>, <script>, or <noscript>
    let node = el
    while (node && node !== document.documentElement) {
      const tag = node.tagName
      if (tag === 'TEMPLATE' || tag === 'SCRIPT' || tag === 'NOSCRIPT' || tag === 'STYLE') {
        return false
      }
      node = node.parentElement
    }

    // Check if element is detached from DOM
    if (!document.body.contains(el)) return false

    // Check if element has zero dimensions (collapsed)
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      // Could be a valid hidden heading, mark as potentially hidden
      return false
    }

    return true
  }

  /**
   * Check if element is inside a shadow root
   */
  function getShadowRoot(el) {
    let node = el.parentNode
    while (node) {
      if (node instanceof ShadowRoot) return node
      node = node.parentNode
    }
    return null
  }

  // ========== Content Area Detection ==========

  /**
   * Check if an element is inside the main document content area.
   * Filters out headings in navigation, banners, sidebars, footers, search areas.
   * This follows HeadingsMap's approach of focusing on document content headings
   * rather than UI chrome headings.
   *
   * Landmark roles that indicate non-content areas (per WAI-ARIA):
   * - navigation: nav area
   * - banner: page header/site identity
   * - contentinfo: footer/copyright
   * - complementary: sidebar/aside
   * - search: search box area
   * - form: form container (often navigation-related)
   */
  const NON_CONTENT_ROLES = new Set([
    'navigation', 'banner', 'contentinfo', 'complementary',
    'search', 'form', 'menubar', 'toolbar', 'status',
  ])

  const NON_CONTENT_TAGS = /^(NAV|HEADER|FOOTER|ASIDE|FORM)$/i

  /**
   * Check if element or any ancestor is inside a non-content landmark area.
   * Returns true if the heading IS in content area (should be included).
   */
  function isInContentArea(el) {
    let current = el.parentElement

    while (current && current !== document.documentElement && current !== document.body) {
      // Check ARIA landmark roles
      const role = current.getAttribute('role')
      if (role && NON_CONTENT_ROLES.has(role)) return false

      // Check semantic HTML5 elements that typically contain non-content
      const tag = current.tagName.toUpperCase()
      if (NON_CONTENT_TAGS.test(tag)) {
        // Exception: <header> and <footer> INSIDE <article> or <section>
        // are section headers/footers, NOT page chrome — allow those
        const parentTag = current.parentElement?.tagName?.toUpperCase()
        if ((tag === 'HEADER' || tag === 'FOOTER') &&
            (parentTag === 'ARTICLE' || parentTag === 'SECTION')) {
          // It's a section header/footer, not page chrome — keep going
        } else {
          return false
        }
      }

      // Skip past generic divs with ARIA roles that suggest non-content
      // e.g. role="navigation" on a div
      current = current.parentElement
    }

    return true
  }

  /**
   * Get the effective heading level for an element.
   * For native headings (h1-h6), use the tag number.
   * For role="heading" elements, use aria-level (default 2).
   */
  function getHeadingLevel(el) {
    const tag = el.tagName.toUpperCase()
    const match = tag.match(/^H([1-6])$/)
    if (match) return parseInt(match[1], 10)

    // role="heading" with aria-level
    if (el.getAttribute('role') === 'heading') {
      const ariaLevel = el.getAttribute('aria-level')
      if (ariaLevel) {
        const level = parseInt(ariaLevel, 10)
        if (level >= 1 && level <= 6) return level
      }
      return 2 // default per ARIA spec
    }

    return 0 // not a heading
  }

  /**
   * Check if an element is a heading (native or ARIA)
   */
  function isHeading(el) {
    const tag = el.tagName.toUpperCase()
    if (/^H[1-6]$/.test(tag)) return true
    if (el.getAttribute('role') === 'heading') return true
    return false
  }

  /**
   * Extract all headings from the page, following HeadingsMap's approach:
   * - Walk the DOM tree (not just querySelectorAll) to respect document order
   * - Check visibility including ancestor chain
   * - Support role="heading" with aria-level
   * - Detect sectioning roots (blockquote, details, fieldset, figure, td)
   *   that create independent outline contexts
   * - Detect sectioning content (article, aside, nav, section)
   *   that create new sections
   */
  function extractHeadings() {
    const result = []
    let lastLevel = 0
    let h1Found = false
    let index = 0

    /**
     * Recursively walk the DOM tree
     * @param {Node} node - Current node
     * @param {boolean} inSectioningRoot - Whether we're inside a sectioning root
     *   (blockquote, details, dialog, fieldset, figure, td)
     *   Sectioning roots create independent outline contexts — headings inside
     *   them don't participate in the main document outline
     */
    function walk(node, inSectioningRoot) {
      if (node.nodeType !== Node.ELEMENT_NODE) return

      const tag = node.tagName.toUpperCase()

      // Skip script, style, noscript, template
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEMPLATE') return

      // Skip SVG and MathML namespaces
      if (node.namespaceURI && node.namespaceURI !== 'http://www.w3.org/1999/xhtml') return

      // Check if this is a sectioning root (creates independent outline)
      const isSectioningRoot = /^(BLOCKQUOTE|DETAILS|DIALOG|FIELDSET|FIGURE|TD|TH)$/.test(tag)

      // Check if this is sectioning content (creates new section in outline)
      const isSectioningContent = /^(ARTICLE|ASIDE|NAV|SECTION)$/.test(tag)

      // Check if this element is a heading
      if (isHeading(node)) {
        const level = getHeadingLevel(node)
        const text = node.textContent?.trim() || ''
        const visible = isElementVisible(node)
        const inRoot = inSectioningRoot

        // Filter: skip headings in non-content areas (nav, sidebar, header, footer, etc.)
        if (!isInContentArea(node)) {
          // Still track level for error detection, but don't include in results
          if (level > 0) lastLevel = level
          // Recurse into children but skip this heading
          const childInRoot = inSectioningRoot || isSectioningRoot
          const shadowRoot = node.shadowRoot
          if (shadowRoot) {
            for (const child of shadowRoot.children) walk(child, childInRoot)
          }
          for (const child of node.children) walk(child, childInRoot)
          return
        }

        if (level === 1) h1Found = true

        // Detect level errors: skipped levels (e.g. h1 → h3)
        let levelError = null
        if (lastLevel > 0 && level > lastLevel + 1) {
          levelError = 'skipped'
        }

        // Assign unique id if missing
        if (!node.id) {
          node.id = `__toc_heading_${index}`
        }

        const rect = node.getBoundingClientRect()

        result.push({
          id: node.id,
          text,
          level,
          top: rect.top + window.scrollY,
          isVisible: visible,
          isHidden: !visible,
          isEmpty: text.length === 0,
          levelError,
          tagName: node.tagName.toLowerCase(),
          inSectioningRoot: inRoot,
          isAriaHeading: node.getAttribute('role') === 'heading',
        })

        lastLevel = level
        index++
      }

      // Recurse into children
      // If inside a sectioning root, pass that flag down
      const childInRoot = inSectioningRoot || isSectioningRoot

      // Handle shadow DOM
      const shadowRoot = node.shadowRoot
      if (shadowRoot) {
        for (const child of shadowRoot.children) {
          walk(child, childInRoot)
        }
      }

      // Handle regular children
      for (const child of node.children) {
        walk(child, childInRoot)
      }
    }

    // Start walking from body
    walk(document.body, false)

    return {
      headings: result,
      hasNoH1: !h1Found && result.length > 0,
    }
  }

  // ========== Page Highlight (HeadingsMap-style overlay) ==========

  function highlightHeading(headingId) {
    removeHighlight()

    const el = document.getElementById(headingId)
    if (!el) return

    if (!overlayContainer) {
      overlayContainer = document.createElement('div')
      overlayContainer.className = 'toc-overlay-container'
      overlayContainer.style.cssText = 'position:absolute;top:0;left:0;right:0;pointer-events:none;z-index:10000000;overflow:hidden;'
      document.body.appendChild(overlayContainer)
    }

    const rect = el.getBoundingClientRect()
    const scrollTop = window.scrollY
    const scrollLeft = window.scrollX

    const overlay = document.createElement('div')
    overlay.className = 'toc-highlight-overlay'
    overlay.style.cssText = `
      position: absolute;
      top: ${rect.top + scrollTop}px;
      left: ${rect.left + scrollLeft}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      outline: 2px solid rgba(59, 130, 246, 0.6);
      outline-offset: 2px;
      background: rgba(59, 130, 246, 0.08);
      border-radius: 2px;
      pointer-events: none;
      transition: opacity 0.3s ease;
    `

    const label = document.createElement('div')
    label.className = 'toc-highlight-label'
    const level = el.tagName.charAt(1)
    label.textContent = `H${level}`
    label.style.cssText = `
      position: absolute;
      top: -22px;
      right: 0;
      font-size: 11px;
      font-weight: 700;
      font-family: system-ui, sans-serif;
      background: #3b82f6;
      color: #fff;
      padding: 1px 6px;
      border-radius: 3px 3px 0 0;
      line-height: 18px;
      pointer-events: none;
    `
    overlay.appendChild(label)
    overlayContainer.appendChild(overlay)
    currentOverlay = overlay

    setTimeout(() => removeHighlight(), 2500)
  }

  function removeHighlight() {
    if (currentOverlay) {
      currentOverlay.style.opacity = '0'
      setTimeout(() => {
        if (currentOverlay?.parentNode) currentOverlay.parentNode.removeChild(currentOverlay)
        currentOverlay = null
      }, 300)
    }
  }

  function scrollToHeading(headingId) {
    const el = document.getElementById(headingId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setTimeout(() => highlightHeading(headingId), 300)
    }
  }

  // ========== Message Listener ==========

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'extractHeadings') {
      try {
        const data = extractHeadings()
        sendResponse({
          success: true,
          headings: data.headings,
          hasNoH1: data.hasNoH1,
          url: location.href,
          title: document.title,
        })
      } catch (err) {
        sendResponse({ success: false, error: err.message || String(err), headings: [] })
      }
      return true
    }

    if (msg.action === 'scrollToHeading') {
      try {
        scrollToHeading(msg.headingId)
        sendResponse({ success: true })
      } catch (err) {
        sendResponse({ success: false, error: err.message || String(err) })
      }
      return true
    }

    if (msg.action === 'removeHighlight') {
      removeHighlight()
      sendResponse({ success: true })
      return true
    }
  })
})()
