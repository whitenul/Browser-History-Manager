import { useBrowserStore } from '@/stores/browser'
import { useUIStore } from '@/stores/ui'
import { useReadingQueueStore } from '@/stores/readingQueue'
import { useI18n } from '@/i18n'

export function useMiniBrowser() {
  const browser = useBrowserStore()
  const ui = useUIStore()
  const readingQueue = useReadingQueueStore()
  const { t } = useI18n()

  async function enterBrowsingMode() {
    ui.isBrowsingMode = true
    await browser.restoreState()
  }

  async function exitBrowsingMode() {
    await browser.resetAndSave()
    ui.isBrowsingMode = false
  }

  function onUrlSubmit(url: string) {
    if (url.trim()) {
      browser.navigate(url.trim())
    }
  }

  function addToQueue() {
    if (browser.currentUrl) {
      const domain = browser.getCurrentDomain()
      readingQueue.toggleQueue(browser.currentUrl, '', domain, [])
      ui.notify(t('browser.addedToQueue'), 'success')
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()

    const dt = e.dataTransfer
    if (!dt) return

    let url = dt.getData('text/uri-list')?.split('\n')[0]?.trim() || ''
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      browser.navigate(url)
      return
    }

    url = dt.getData('text/plain')?.trim() || ''
    if (url) {
      const urlMatch = url.match(/https?:\/\/[^\s<>"']+/)
      if (urlMatch) {
        browser.navigate(urlMatch[0])
        return
      }
      if (/^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/.test(url)) {
        browser.navigate(url)
        return
      }
      browser.navigate(url)
    }
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'link'
  }

  function onDragEnter(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  return {
    browser, ui,
    enterBrowsingMode,
    exitBrowsingMode,
    onUrlSubmit,
    addToQueue,
    onDrop,
    onDragOver,
    onDragEnter,
    onDragLeave,
  }
}
