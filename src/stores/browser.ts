import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getDomain } from '@/utils/helpers'

const MAX_HISTORY = 50
const REDIRECT_DEBOUNCE = 1000
const LOAD_TIMEOUT = 8000
const STORAGE_KEY = 'browserState'

export interface BrowserState {
  currentUrl: string
  historyStack: string[]
  currentIndex: number
  isMosaicMode: boolean
  zoomLevel: number
}

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return raw
    const search = u.search ? u.search : ''
    const hash = u.hash ? u.hash : ''
    return `${u.protocol}//${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}${search}${hash}`
  } catch { return raw }
}

function resolveUrl(input: string): { url: string; type: 'direct' | 'search' | 'invalid' } {
  const trimmed = input.trim()
  if (!trimmed) return { url: '', type: 'invalid' }

  const blockedPrefixes = ['chrome://', 'edge://', 'blob:', 'data:', 'javascript:', 'about:']
  if (blockedPrefixes.some(p => trimmed.startsWith(p))) {
    return { url: '', type: 'invalid' }
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return { url: parsed.href, type: 'direct' }
      }
    } catch { return { url: '', type: 'invalid' } }
  }

  if (/^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(\/.*)?$/.test(trimmed)) {
    return { url: `https://${trimmed}`, type: 'direct' }
  }

  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(trimmed)) {
    return { url: `https://${trimmed}`, type: 'direct' }
  }

  return { url: `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`, type: 'search' }
}

export const useBrowserStore = defineStore('browser', () => {
  const currentUrl = ref('')
  const displayUrl = ref('')
  const historyStack = ref<string[]>([])
  const currentIndex = ref(-1)
  const isMosaicMode = ref(false)
  const isLoading = ref(false)
  const loadError = ref<string | null>(null)
  const zoomLevel = ref(100)

  // Navigation tracking: increment this to signal iframe to reload
  const navVersion = ref(0)

  let lastNavigateTime = 0
  let lastSetUrl = ''
  let loadTimer: ReturnType<typeof setTimeout> | null = null
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleAutoSave() {
    clearTimeout(saveTimer!)
    saveTimer = setTimeout(() => { saveState().catch(() => {}) }, 500)
  }

  function startLoadTimer() {
    loadError.value = null
    clearTimeout(loadTimer!)
    loadTimer = setTimeout(() => {
      if (isLoading.value) {
        loadError.value = 'timeout'
        isLoading.value = false
      }
    }, LOAD_TIMEOUT)
  }

  function onIframeLoad() {
    clearTimeout(loadTimer!)
    isLoading.value = false
    loadError.value = null
  }

  function updateDisplayUrl(url: string) {
    if (isMosaicMode.value) {
      try {
        const u = new URL(url)
        const domain = getDomain(u.hostname)
        const maskedDomain = domain.split('.').map(() => '***').join('.')
        displayUrl.value = `${u.protocol}//${maskedDomain}`
      } catch {
        displayUrl.value = '***'
      }
    } else {
      displayUrl.value = url
    }
  }

  function pushHistory(url: string) {
    const now = Date.now()
    const normalized = normalizeUrl(url)

    if (normalized === lastSetUrl && now - lastNavigateTime < REDIRECT_DEBOUNCE) {
      if (currentIndex.value >= 0 && currentIndex.value < historyStack.value.length) {
        historyStack.value[currentIndex.value] = normalized
      }
    } else {
      historyStack.value = [...historyStack.value.slice(0, Math.max(0, currentIndex.value + 1)), normalized]
      if (historyStack.value.length > MAX_HISTORY) {
        historyStack.value = historyStack.value.slice(-MAX_HISTORY)
      }
      currentIndex.value = historyStack.value.length - 1
    }

    lastNavigateTime = now
    lastSetUrl = normalized
    currentUrl.value = normalized
    updateDisplayUrl(normalized)
    scheduleAutoSave()
  }

  /** Navigate to a new URL — triggers full iframe reload */
  function navigate(url: string) {
    const result = resolveUrl(url)
    if (result.type === 'invalid') {
      loadError.value = 'invalid'
      return
    }
    isLoading.value = true
    loadError.value = null
    startLoadTimer()
    pushHistory(result.url)
    navVersion.value++ // Signal iframe to reload
  }

  /** Update URL display only (for cross-origin iframe navigation we can't detect) */
  function updateUrlOnly(url: string) {
    const result = resolveUrl(url)
    if (result.type === 'invalid') return
    lastSetUrl = result.url
    currentUrl.value = normalizeUrl(result.url)
    updateDisplayUrl(currentUrl.value)
    scheduleAutoSave()
  }

  function goBack() {
    if (currentIndex.value > 0) {
      currentIndex.value--
      const url = historyStack.value[currentIndex.value]
      if (url) {
        isLoading.value = true
        loadError.value = null
        startLoadTimer()
        lastSetUrl = url
        currentUrl.value = url
        updateDisplayUrl(url)
        navVersion.value++ // Signal iframe to reload
        scheduleAutoSave()
      }
    }
  }

  function goForward() {
    if (currentIndex.value >= 0 && currentIndex.value < historyStack.value.length - 1) {
      currentIndex.value++
      const url = historyStack.value[currentIndex.value]
      if (url) {
        isLoading.value = true
        loadError.value = null
        startLoadTimer()
        lastSetUrl = url
        currentUrl.value = url
        updateDisplayUrl(url)
        navVersion.value++ // Signal iframe to reload
        scheduleAutoSave()
      }
    }
  }

  function refresh() {
    if (currentUrl.value) {
      isLoading.value = true
      loadError.value = null
      startLoadTimer()
      navVersion.value++ // Signal iframe to reload
    }
  }

  function goHome() {
    currentUrl.value = ''
    displayUrl.value = ''
    historyStack.value = []
    currentIndex.value = -1
    isMosaicMode.value = false
    loadError.value = null
    isLoading.value = false
    lastSetUrl = ''
    navVersion.value++
    scheduleAutoSave()
  }

  function toggleMosaic() {
    isMosaicMode.value = !isMosaicMode.value
    updateDisplayUrl(currentUrl.value)
    scheduleAutoSave()
  }

  function setZoom(level: number) {
    zoomLevel.value = Math.min(Math.max(25, level), 300)
    scheduleAutoSave()
  }

  async function saveState() {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEY]: {
          currentUrl: currentUrl.value,
          historyStack: historyStack.value,
          currentIndex: currentIndex.value,
          isMosaicMode: isMosaicMode.value,
          zoomLevel: zoomLevel.value,
        },
      })
    } catch { /* ignore */ }
  }

  async function restoreState() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY)
      const state = result[STORAGE_KEY] as BrowserState | undefined
      if (state?.currentUrl) {
        currentUrl.value = state.currentUrl
        historyStack.value = Array.isArray(state.historyStack) ? state.historyStack : []
        currentIndex.value = state.currentIndex ?? -1
        isMosaicMode.value = state.isMosaicMode || false
        zoomLevel.value = state.zoomLevel ?? 100
        updateDisplayUrl(state.currentUrl)
        // Don't increment navVersion here — the component's onMounted handles initial load
      }
    } catch { /* ignore */ }
  }

  /** Save state for next restore — called when exiting browsing mode */
  async function saveForRestore() {
    await saveState()
    // Don't call goHome() — keep the state for next restore
  }

  function canGoBack(): boolean { return currentIndex.value > 0 }
  function canGoForward(): boolean { return currentIndex.value >= 0 && currentIndex.value < historyStack.value.length - 1 }
  function getCurrentDomain(): string { return currentUrl.value ? getDomain(currentUrl.value) : '' }
  function openInNewTab() { if (currentUrl.value) window.open(currentUrl.value, '_blank') }

  return {
    currentUrl, displayUrl, historyStack, currentIndex,
    isMosaicMode, isLoading, loadError, zoomLevel, navVersion,
    onIframeLoad,
    navigate, updateUrlOnly, goBack, goForward, refresh,
    goHome, toggleMosaic, setZoom,
    saveState, restoreState, saveForRestore,
    canGoBack, canGoForward, getCurrentDomain,
    openInNewTab,
  }
})
