import { useBrowserStore } from '@/stores/browser'
import { useUIStore } from '@/stores/ui'

export function useMiniBrowser() {
  const browser = useBrowserStore()
  const ui = useUIStore()

  async function enterBrowsingMode() {
    // Restore state BEFORE mounting the component so it's available on first render
    await browser.restoreState()
    ui.isBrowsingMode = true
  }

  async function exitBrowsingMode() {
    await browser.saveForRestore()
    ui.isBrowsingMode = false
  }

  function onUrlSubmit(url: string) {
    if (url.trim()) {
      browser.navigate(url.trim())
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

  function zoomIn() {
    browser.setZoom(browser.zoomLevel + 10)
  }

  function zoomOut() {
    browser.setZoom(browser.zoomLevel - 10)
  }

  function resetZoom() {
    browser.setZoom(100)
  }

  return {
    browser,
    enterBrowsingMode,
    exitBrowsingMode,
    onUrlSubmit,
    onDrop,
    onDragOver,
    zoomIn, zoomOut, resetZoom,
  }
}
