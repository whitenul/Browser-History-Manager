// heading-extractor.js — Content script for extracting page headings (h1-h5)
// Communicates with the extension via chrome.runtime.onMessage

;(function () {
  'use strict'

  // Avoid duplicate injection
  if (window.__headingExtractorLoaded) return
  window.__headingExtractorLoaded = true

  /**
   * Extract all h1-h5 headings from the page
   * Returns an array of { id, text, level, top }
   */
  function extractHeadings() {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5')
    const result = []

    headings.forEach((el, index) => {
      // Assign a unique id if the heading doesn't have one
      if (!el.id) {
        el.id = `__toc_heading_${index}`
      }
      const rect = el.getBoundingClientRect()
      result.push({
        id: el.id,
        text: el.textContent?.trim() || '',
        level: parseInt(el.tagName.charAt(1), 10), // 1-5
        top: rect.top + window.scrollY,
      })
    })

    return result
  }

  /**
   * Scroll to a heading by its id
   */
  function scrollToHeading(headingId) {
    const el = document.getElementById(headingId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Brief highlight effect
      el.style.transition = 'background-color 0.3s ease'
      el.style.backgroundColor = 'rgba(59, 130, 246, 0.15)'
      setTimeout(() => {
        el.style.backgroundColor = ''
      }, 1500)
    }
  }

  // Listen for messages from the extension
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'extractHeadings') {
      try {
        const headings = extractHeadings()
        sendResponse({ success: true, headings, url: location.href, title: document.title })
      } catch (err) {
        sendResponse({ success: false, error: err.message || String(err), headings: [] })
      }
      return true // async sendResponse
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
  })
})()
