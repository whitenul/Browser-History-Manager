import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface HeadingItem {
  id: string
  text: string
  level: number // 1-5
  top: number
}

export const usePageTocStore = defineStore('pageToc', () => {
  const headings = ref<HeadingItem[]>([])
  const loading = ref(false)
  const error = ref('')
  const pageTitle = ref('')
  const pageUrl = ref('')
  const activeHeadingId = ref('')
  const debugInfo = ref('')

  async function extractHeadings() {
    loading.value = true
    error.value = ''
    debugInfo.value = ''

    try {
      // Get the active tab in the current window
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })

      if (!tab?.id) {
        error.value = 'noTab'
        headings.value = []
        return
      }

      // Cannot inject into chrome://, edge://, about:, chrome-extension:// pages
      const url = tab.url || ''
      if (
        url.startsWith('chrome://') ||
        url.startsWith('edge://') ||
        url.startsWith('about:') ||
        url.startsWith('chrome-extension://') ||
        url.startsWith('devtools://')
      ) {
        error.value = 'restrictedPage'
        headings.value = []
        return
      }

      // Primary path: send message to content script (auto-injected via manifest)
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractHeadings' })

        if (response?.success) {
          headings.value = response.headings || []
          pageTitle.value = response.title || tab.title || ''
          pageUrl.value = response.url || tab.url || ''
          if (headings.value.length === 0) {
            error.value = 'noHeadings'
          }
          return
        }
        // Content script responded but extraction failed
        error.value = 'extractFailed'
        headings.value = []
        debugInfo.value = `CS responded but failed: ${response?.error || 'unknown'}`
        return
      } catch (sendErr: any) {
        // sendMessage failed — content script not present on this tab
        debugInfo.value = `sendMessage failed: ${sendErr?.message || String(sendErr)}`
      }

      // Fallback: inject content script programmatically, then retry
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['heading-extractor.js'],
        })
      } catch (injectErr: any) {
        const errMsg = injectErr?.message || String(injectErr)
        debugInfo.value += ` | executeScript failed: ${errMsg}`

        if (errMsg.includes('Cannot access') || errMsg.includes('not allowed') || errMsg.includes('permission')) {
          error.value = 'noPermission'
        } else if (errMsg.includes('no tab') || errMsg.includes('not found') || errMsg.includes('closed')) {
          error.value = 'tabClosed'
        } else {
          error.value = 'injectFailed'
        }
        headings.value = []
        return
      }

      // Retry sendMessage after injection
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractHeadings' })

        if (response?.success) {
          headings.value = response.headings || []
          pageTitle.value = response.title || tab.title || ''
          pageUrl.value = response.url || tab.url || ''
          if (headings.value.length === 0) {
            error.value = 'noHeadings'
          }
        } else {
          error.value = 'extractFailed'
          headings.value = []
          debugInfo.value += ` | retry CS responded but failed: ${response?.error}`
        }
      } catch (retryErr: any) {
        debugInfo.value += ` | retry sendMessage failed: ${retryErr?.message || String(retryErr)}`
        error.value = 'extractFailed'
        headings.value = []
      }
    } catch (err: any) {
      debugInfo.value = `Unexpected error: ${err?.message || String(err)}`
      error.value = 'extractFailed'
      headings.value = []
    } finally {
      loading.value = false
    }
  }

  async function scrollToHeading(headingId: string) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
      if (tab?.id) {
        activeHeadingId.value = headingId
        await chrome.tabs.sendMessage(tab.id, { action: 'scrollToHeading', headingId })
      }
    } catch { /* ignore */ }
  }

  function clearHeadings() {
    headings.value = []
    error.value = ''
    pageTitle.value = ''
    pageUrl.value = ''
    activeHeadingId.value = ''
    debugInfo.value = ''
  }

  return {
    headings, loading, error, pageTitle, pageUrl, activeHeadingId, debugInfo,
    extractHeadings, scrollToHeading, clearHeadings,
  }
})
