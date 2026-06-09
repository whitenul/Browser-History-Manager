<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { useMiniBrowser } from '@/composables/useMiniBrowser'
import { useSuggestions, type SuggestionItem } from '@/composables/useSuggestions'
import { useStatsStore } from '@/stores/stats'
import { useUserScriptsStore } from '@/stores/userScripts'
import { useBookmarksStore, type BookmarkFolder } from '@/stores/bookmarks'
import { getFaviconUrl, onFaviconError } from '@/utils/helpers'
import { useI18n } from '@/i18n'

const UserScriptsPanel = defineAsyncComponent(() => import('@/components/business/UserScriptsPanel.vue'))

const {
  browser,
  exitBrowsingMode,
  onUrlSubmit,
  zoomIn, zoomOut, resetZoom,
  onDrop, onDragOver,
} = useMiniBrowser()

const suggestions = useSuggestions()
const stats = useStatsStore()
const userScripts = useUserScriptsStore()
const bookmarks = useBookmarksStore()
const { t } = useI18n()

const urlInput = ref<HTMLInputElement | null>(null)
const urlText = ref('')
const iframeRef = ref<HTMLIFrameElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const showMoreMenu = ref(false)
const loadingProgress = ref(0)
const showBookmarkDialog = ref(false)
const selectedFolderId = ref<string>('')
const bookmarkTitle = ref('')
const bookmarkFeedback = ref<'add' | 'remove' | null>(null)
const pageTitle = ref('')
const virtualWidth = ref(1280)
const contentWidth = ref(0)
const contentHeight = ref(600)
let dragCounter = 0
let progressTimer: ReturnType<typeof setInterval> | null = null
let feedbackTimer: ReturnType<typeof setTimeout> | null = null
let resizeObserver: ResizeObserver | null = null

const showQuickEntry = computed(() => !browser.currentUrl && !browser.isLoading && !browser.loadError)
const topSites = computed(() => (stats.topSites || []).slice(0, 6))
const currentSuggestions = computed(() => suggestions.getSuggestions(urlText.value))

const currentDomain = computed(() => {
  if (!browser.currentUrl) return ''
  try { return new URL(browser.currentUrl).hostname.replace(/^www\./, '') } catch { return '' }
})

const currentFaviconUrl = computed(() => {
  if (!currentDomain.value) return ''
  return getFaviconUrl(currentDomain.value)
})

const isSecure = computed(() => browser.currentUrl?.startsWith('https://') ?? false)

const iframeScale = computed(() => {
  if (contentWidth.value <= 0) return 1
  const baseScale = contentWidth.value / virtualWidth.value
  const zoomFactor = browser.zoomLevel / 100
  return baseScale * zoomFactor
})

const iframeStyle = computed(() => {
  const scale = iframeScale.value
  const realH = Math.round(contentHeight.value / scale)
  return {
    width: `${virtualWidth.value}px`,
    height: `${realH}px`,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
  }
})

const isCurrentBookmarked = computed(() => {
  if (!browser.currentUrl) return false
  return bookmarks.isBookmarked(browser.currentUrl)
})

const folders = computed<BookmarkFolder[]>(() => bookmarks.bookmarkFolders)

watch(() => browser.displayUrl, (val) => { urlText.value = val }, { immediate: true })

let navDebounce: ReturnType<typeof setTimeout> | null = null
watch(() => browser.navVersion, async (v) => {
  if (v === 0) return
  if (navDebounce) clearTimeout(navDebounce)
  navDebounce = setTimeout(async () => {
    await nextTick()
    const iframe = iframeRef.value
    if (!iframe) return
    if (browser.currentUrl) {
      iframe.src = 'about:blank'
      await nextTick()
      iframe.addEventListener('load', handleLoad, { once: true })
      iframe.src = browser.currentUrl
    } else {
      iframe.src = 'about:blank'
      browser.onIframeLoad()
    }
  }, 50)
})

function onIframeMessage(e: MessageEvent) {
  if (!e.data || e.data.type !== '__iframe_navigate__') return
  const url = e.data.url
  if (!url || typeof url !== 'string' || url.length === 0) return
  if (e.data.isInternalNavigation) {
    browser.updateUrlOnly(url)
  } else {
    browser.navigate(url)
  }
}

let loadingFallbackTimer: ReturnType<typeof setTimeout> | null = null
watch(() => browser.isLoading, (loading) => {
  if (loadingFallbackTimer) clearTimeout(loadingFallbackTimer)
  if (loading) {
    startProgressSimulation()
    loadingFallbackTimer = setTimeout(() => { if (browser.isLoading) browser.onIframeLoad() }, 3000)
  } else {
    stopProgressSimulation()
    loadingProgress.value = 100
    setTimeout(() => { loadingProgress.value = 0 }, 350)
  }
})

function startProgressSimulation() {
  loadingProgress.value = 0
  stopProgressSimulation()
  progressTimer = setInterval(() => {
    if (loadingProgress.value < 30) loadingProgress.value += Math.random() * 8
    else if (loadingProgress.value < 60) loadingProgress.value += Math.random() * 4
    else if (loadingProgress.value < 85) loadingProgress.value += Math.random() * 1.5
    if (loadingProgress.value > 90) loadingProgress.value = 90
  }, 200)
}

function stopProgressSimulation() {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
}

const ctrlHeld = ref(false)
function handleGlobalKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && !ctrlHeld.value) {
    ctrlHeld.value = true
    nextTick(() => {
      const iframe = iframeRef.value
      if (iframe) (iframe as HTMLElement).style.pointerEvents = 'none'
    })
  }
}
function handleGlobalKeyUp(e: KeyboardEvent) {
  if (!(e.ctrlKey || e.metaKey) && ctrlHeld.value) {
    ctrlHeld.value = false
    nextTick(() => {
      const iframe = iframeRef.value
      if (iframe) (iframe as HTMLElement).style.pointerEvents = ''
    })
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeyboardZoom, { capture: true })
  window.addEventListener('keydown', handleGlobalKeyDown)
  window.addEventListener('keyup', handleGlobalKeyUp)
  window.addEventListener('blur', () => {
    ctrlHeld.value = false
    nextTick(() => {
      const iframe = iframeRef.value
      if (iframe) (iframe as HTMLElement).style.pointerEvents = ''
    })
  })
  document.addEventListener('click', closeMoreMenu)
  window.addEventListener('message', onIframeMessage)

  if (contentRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        contentWidth.value = entry.contentRect.width
        contentHeight.value = entry.contentRect.height
      }
    })
    resizeObserver.observe(contentRef.value)
  }

  bookmarks.loadBookmarks().catch(() => {})

  await nextTick()
  if (browser.currentUrl) {
    const iframe = iframeRef.value
    if (iframe) {
      iframe.addEventListener('load', handleLoad, { once: true })
      iframe.src = browser.currentUrl
    }
  } else {
    focusUrl()
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyboardZoom, { capture: true })
  window.removeEventListener('keydown', handleGlobalKeyDown)
  window.removeEventListener('keyup', handleGlobalKeyUp)
  document.removeEventListener('click', closeMoreMenu)
  window.removeEventListener('message', onIframeMessage)
  stopProgressSimulation()
  if (feedbackTimer) clearTimeout(feedbackTimer)
  if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null }
  const iframe = iframeRef.value
  if (iframe) (iframe as HTMLElement).style.pointerEvents = ''
})

function handleKeyboardZoom(e: KeyboardEvent) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
  if (e.key === '=' || e.key === '+') { e.preventDefault(); e.stopPropagation(); zoomIn() }
  else if (e.key === '-') { e.preventDefault(); e.stopPropagation(); zoomOut() }
  else if (e.key === '0') { e.preventDefault(); e.stopPropagation(); resetZoom() }
}

function handleWheelZoom(e: WheelEvent) {
  if (!(e.ctrlKey || e.metaKey)) return
  e.preventDefault()
  e.deltaY < 0 ? zoomIn() : e.deltaY > 0 ? zoomOut() : undefined
}

function focusUrl() { nextTick(() => { urlInput.value?.focus() }) }

function handleUrlKeydown(e: KeyboardEvent) {
  suggestions.handleKeydown(e, currentSuggestions.value, (item) => {
    if (item) { urlText.value = item.url; browser.navigate(item.url) }
    else { onUrlSubmit(urlText.value) }
  })
}

function selectSuggestion(item: SuggestionItem) {
  suggestions.selectItem(item)
  urlText.value = item.url
  browser.navigate(item.url)
}

function openSite(domain: string) { browser.navigate(`https://${domain}`) }

function handleDragEnter(e: DragEvent) { e.preventDefault(); dragCounter++; isDragging.value = true }
function handleDragLeave(e: DragEvent) { e.preventDefault(); dragCounter--; if (dragCounter <= 0) { dragCounter = 0; isDragging.value = false } }
function handleDrop(e: DragEvent) { e.preventDefault(); dragCounter = 0; isDragging.value = false; onDrop(e) }

function handleLoad() {
  const iframe = iframeRef.value
  if (!iframe || !browser.currentUrl) {
    browser.onIframeLoad()
    return
  }

  try {
    const doc = iframe.contentDocument
    if (doc && doc.URL && doc.URL.includes('chrome-error://')) {
      browser.onIframeLoad('blocked')
      return
    }
  } catch { /* cross-origin = page loaded successfully */ }

  try {
    if (iframe.contentWindow) {
      const actualUrl = iframe.contentWindow.location.href
      if (actualUrl && actualUrl !== 'about:blank' && actualUrl !== browser.currentUrl) {
        browser.updateUrlOnly(actualUrl)
      }
      try {
        const title = iframe.contentDocument?.title
        if (title) pageTitle.value = title
      } catch {}
    }
  } catch { /* cross-origin */ }
  browser.onIframeLoad()
}

async function handleBookmarkClick() {
  if (!browser.currentUrl) return
  if (isCurrentBookmarked.value) {
    await bookmarks.removeBookmarkByUrl(browser.currentUrl)
    showFeedback('remove')
  } else {
    if (folders.value.length > 0) {
      selectedFolderId.value = folders.value[0].id
    }
    bookmarkTitle.value = pageTitle.value || currentDomain.value || browser.currentUrl
    showBookmarkDialog.value = true
  }
  showMoreMenu.value = false
}

async function confirmAddBookmark() {
  if (!browser.currentUrl) return
  const title = bookmarkTitle.value || currentDomain.value || browser.currentUrl
  await bookmarks.addBookmark(browser.currentUrl, title, selectedFolderId.value || undefined)
  showBookmarkDialog.value = false
  showFeedback('add')
}

function showFeedback(type: 'add' | 'remove') {
  if (feedbackTimer) clearTimeout(feedbackTimer)
  bookmarkFeedback.value = type
  feedbackTimer = setTimeout(() => { bookmarkFeedback.value = null }, 1500)
}

function handleMoreAction(action: string) {
  const actions: Record<string, () => void> = {
    home: () => browser.goHome(),
    newTab: () => browser.openInNewTab(),
    mosaic: () => browser.toggleMosaic(),
    bookmark: handleBookmarkClick,
    zoomOut, zoomIn, resetZoom,
  }
  actions[action]?.()
  if (action !== 'bookmark') showMoreMenu.value = false
}

function closeMoreMenu(e: Event) {
  if (!(e.target as HTMLElement).closest('.mb-more-wrapper')) showMoreMenu.value = false
}

function handleFaviconError(event: Event, url: string) { onFaviconError(event, url) }

function getErrorDetail(): { icon: string; title: string; message: string } {
  const err = browser.loadError
  if (err === 'timeout') {
    return {
      icon: 'i-lucide:clock',
      title: t('browser.errorTitle'),
      message: t('browser.errorTimeout'),
    }
  }
  if (err === 'blocked' || err === 'invalid') {
    return {
      icon: 'i-lucide:shield-alert',
      title: t('browser.errorTitle'),
      message: t('browser.errorBlocked'),
    }
  }
  return {
    icon: 'i-lucide:wifi-off',
    title: t('browser.errorTitle'),
    message: t('browser.errorBlocked'),
  }
}
</script>

<template>
  <div class="mb-container"
    @dragenter="handleDragEnter" @dragover="onDragOver" @dragleave="handleDragLeave" @drop="handleDrop"
    @wheel.prevent="handleWheelZoom">

    <!-- Drag overlay -->
    <div v-if="isDragging" class="mb-drag-overlay"><span class="i-lucide:cloud-upload" /><p>{{ t('browser.dropHere') }}</p></div>

    <!-- Header -->
    <div class="mb-header" :class="{ 'mb-header--mosaic': browser.isMosaicMode }">
      <button class="mb-btn" :disabled="!browser.canGoBack()" :title="t('browser.back')" @click="browser.goBack"><span class="i-lucide:chevron-left" /></button>
      <button class="mb-btn" :disabled="!browser.canGoForward()" :title="t('browser.forward')" @click="browser.goForward"><span class="i-lucide:chevron-right" /></button>
      <button class="mb-btn" :title="t('browser.refresh')" @click="browser.refresh">
        <span :class="browser.isLoading ? 'i-lucide:loader-2 mb-spin' : 'i-lucide:refresh-cw'" />
      </button>

      <div class="mb-url-wrap">
        <div class="mb-url-inner" :class="{ 'mb-url-inner--loading': browser.isLoading }">
          <img v-if="currentFaviconUrl && browser.currentUrl && !browser.isLoading" :src="currentFaviconUrl" class="mb-url-favicon" @error="(e: Event) => onFaviconError(e, currentDomain)" />
          <span v-else-if="browser.isLoading" class="mb-url-loading-spinner" />
          <span v-else-if="browser.currentUrl" class="mb-url-security" :class="isSecure ? 'mb-url-security--secure' : 'mb-url-security--insecure'" :title="isSecure ? t('browser.secure') : t('browser.insecure')">
            <span :class="isSecure ? 'i-lucide:lock' : 'i-lucide:unlock'" />
          </span>
          <input ref="urlInput" v-model="urlText" class="mb-url" :placeholder="t('browser.enterUrl')"
            @keydown="handleUrlKeydown" @focus="suggestions.showSuggestions.value = true" @blur="suggestions.hideSuggestions()" />
          <span v-if="browser.zoomLevel !== 100" class="mb-zoom-badge">{{ browser.zoomLevel }}%</span>
        </div>

        <div v-if="suggestions.showSuggestions.value && currentSuggestions.length > 0" class="mb-suggestions">
          <div v-for="(item, idx) in currentSuggestions" :key="item.url + idx"
            class="mb-suggestion" :class="{ 'mb-suggestion--active': idx === suggestions.selectedIndex.value }"
            @mousedown.prevent="selectSuggestion(item)">
            <span class="mb-suggestion-icon" :class="item.type === 'history' ? 'i-lucide:history' : item.type === 'bookmark' ? 'i-lucide:bookmark' : 'i-lucide:search'" />
            <div class="mb-suggestion-info">
              <div class="mb-suggestion-title">{{ item.title }}</div>
              <div class="mb-suggestion-url">{{ item.domain || item.url }}</div>
            </div>
            <span v-if="item.visitCount" class="mb-suggestion-count">{{ item.visitCount }}</span>
          </div>
        </div>
      </div>

      <button v-if="browser.currentUrl" class="mb-btn mb-btn--bookmark" :class="{ 'mb-btn--bookmarked': isCurrentBookmarked }" :title="isCurrentBookmarked ? t('browser.removeBookmark') : t('browser.addBookmark')" @click="handleBookmarkClick">
        <span :class="isCurrentBookmarked ? 'i-lucide:bookmark-check' : 'i-lucide:bookmark'" />
      </button>

      <button v-if="browser.isMosaicMode" class="mb-btn mb-btn--mosaic-exit" :title="t('browser.disableMosaic')" @click="browser.toggleMosaic()"><span class="i-lucide:eye" /></button>

      <div class="mb-more-wrapper">
        <button class="mb-btn" :title="t('common.more')" @click.stop="showMoreMenu = !showMoreMenu"><span class="i-lucide:more-vertical" /></button>
        <transition name="mb-menu-fade">
          <div v-if="showMoreMenu" class="mb-more-menu" @click.stop>
            <button class="mb-more-item" @click="handleMoreAction('home')"><span class="i-lucide:home" />{{ t('browser.home') }}</button>
            <button class="mb-more-item" @click="handleMoreAction('newTab')"><span class="i-lucide:external-link" />{{ t('browser.openInNewTab') }}</button>
            <button class="mb-more-item" @click="handleMoreAction('bookmark')">
              <span :class="isCurrentBookmarked ? 'i-lucide:bookmark-check' : 'i-lucide:bookmark'" />
              {{ isCurrentBookmarked ? t('browser.removeBookmark') : t('browser.addBookmark') }}
            </button>
            <button class="mb-more-item" @click="handleMoreAction('mosaic')">
              <span :class="browser.isMosaicMode ? 'i-lucide:eye-off' : 'i-lucide:eye'" />
              {{ browser.isMosaicMode ? t('browser.disableMosaic') : t('browser.enableMosaic') }}
            </button>
            <div class="mb-more-divider" />
            <button class="mb-more-item" @click="userScripts.togglePanel(); showMoreMenu = false">
              <span class="i-lucide:code" />
              {{ t('userscripts.title') }}
              <span v-if="userScripts.scripts.filter(s => s.enabled).length" class="mb-more-badge">{{ userScripts.scripts.filter(s => s.enabled).length }}</span>
            </button>
            <div class="mb-more-divider" />
            <div class="mb-zoom-row">
              <button class="mb-more-item" @click="handleMoreAction('zoomOut')"><span class="i-lucide:zoom-out" /></button>
              <span class="mb-zoom-value">{{ browser.zoomLevel }}%</span>
              <button class="mb-more-item" @click="handleMoreAction('zoomIn')"><span class="i-lucide:zoom-in" /></button>
              <button class="mb-more-item" @click="handleMoreAction('resetZoom')"><span class="i-lucide:rotate-ccw" /></button>
            </div>
          </div>
        </transition>
      </div>

      <button class="mb-btn mb-btn--close" :title="t('common.close')" @click="exitBrowsingMode"><span class="i-lucide:x" /></button>
    </div>

    <!-- Progress bar -->
    <div class="mb-progress-bar" :class="{ 'mb-progress-bar--active': loadingProgress > 0 }">
      <div class="mb-progress-fill" :style="{ width: loadingProgress + '%' }" />
    </div>

    <!-- Content area -->
    <div ref="contentRef" class="mb-content" :class="{ 'mb-content--mosaic': browser.isMosaicMode }">

      <!-- Quick entry -->
      <div v-if="showQuickEntry" class="mb-quick-entry">
        <div v-if="topSites.length" class="mb-quick-grid">
          <div v-for="site in topSites" :key="site.domain" class="mb-quick-item" @click="openSite(site.domain)">
            <img :src="getFaviconUrl(site.domain)" class="mb-quick-favicon" @error="(e: Event) => handleFaviconError(e, site.domain)" />
            <span class="mb-quick-domain">{{ site.domain }}</span>
          </div>
        </div>
        <div v-else class="mb-quick-empty">
          <span class="i-lucide:globe mb-quick-empty-icon" />
          <p>{{ t('browser.enterUrl') }}</p>
        </div>
      </div>

      <div class="mb-frame-wrapper">
        <iframe ref="iframeRef" class="mb-frame" :style="iframeStyle" referrerpolicy="no-referrer" name="mini-browser-iframe" />
      </div>

      <!-- Loading overlay -->
      <Transition name="mb-loading-fade">
        <div v-if="browser.isLoading" class="mb-loading-overlay">
          <div class="mb-loading-indicator">
            <div class="mb-loading-spinner" />
            <span class="mb-loading-text">{{ currentDomain }}</span>
          </div>
        </div>
      </Transition>

      <div v-if="ctrlHeld && browser.currentUrl" class="mb-wheel-overlay" @wheel.prevent="handleWheelZoom">
        <div class="mb-wheel-hint">
          <span class="i-lucide:zoom-in" /> {{ browser.zoomLevel }}%
        </div>
      </div>

      <div v-if="browser.isMosaicMode && browser.currentUrl" class="mb-mosaic-overlay" />

      <!-- Error page -->
      <div v-if="browser.loadError && !browser.isLoading" class="mb-error-page">
        <div class="mb-error-content">
          <span :class="getErrorDetail().icon" class="mb-error-icon" />
          <h3 class="mb-error-title">{{ getErrorDetail().title }}</h3>
          <p class="mb-error-message">{{ getErrorDetail().message }}</p>
          <div class="mb-error-url" v-if="browser.currentUrl">{{ browser.currentUrl }}</div>
          <div class="mb-error-actions">
            <button class="mb-error-retry" @click="browser.refresh">
              <span class="i-lucide:refresh-cw" />{{ t('browser.retry') }}
            </button>
            <button class="mb-error-newtab" @click="browser.openInNewTab()">
              <span class="i-lucide:external-link" />{{ t('browser.openInNewTab') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Bookmark dialog -->
    <Transition name="mb-dialog-fade">
      <div v-if="showBookmarkDialog" class="mb-dialog-overlay" @click.self="showBookmarkDialog = false">
        <div class="mb-dialog">
          <div class="mb-dialog-header">
            <span class="i-lucide:bookmark" />
            {{ t('browser.addBookmark') }}
          </div>
          <div class="mb-dialog-body">
            <div class="mb-dialog-field">
              <label>{{ t('browser.name') || '名称' }}</label>
              <input v-model="bookmarkTitle" class="mb-dialog-input" />
            </div>
            <div class="mb-dialog-field">
              <label>{{ t('browser.folder') || '文件夹' }}</label>
              <select v-model="selectedFolderId" class="mb-dialog-select">
                <option v-for="folder in folders" :key="folder.id" :value="folder.id">
                  {{ '\u00A0\u00A0'.repeat(folder.depth) }}📁 {{ folder.title }}
                </option>
              </select>
            </div>
          </div>
          <div class="mb-dialog-actions">
            <button class="mb-dialog-cancel" @click="showBookmarkDialog = false">{{ t('userscripts.cancel') || '取消' }}</button>
            <button class="mb-dialog-confirm" @click="confirmAddBookmark">{{ t('browser.addBookmark') }}</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Bookmark feedback toast -->
    <Transition name="mb-toast-fade">
      <div v-if="bookmarkFeedback" class="mb-feedback-toast" :class="{ 'mb-feedback-toast--add': bookmarkFeedback === 'add', 'mb-feedback-toast--remove': bookmarkFeedback === 'remove' }">
        <span :class="bookmarkFeedback === 'add' ? 'i-lucide:bookmark-check' : 'i-lucide:bookmark-minus'" />
        {{ bookmarkFeedback === 'add' ? t('browser.addBookmark') : t('browser.removeBookmark') }}
      </div>
    </Transition>

    <!-- User Scripts Panel (slide-in from right) -->
    <Transition name="usp-slide">
      <div v-if="userScripts.showPanel" class="mb-usp-container">
        <UserScriptsPanel />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.mb-container { display: flex; flex-direction: column; height: 100%; position: relative; background: var(--color-bg-base); }

.mb-bg { position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: -1; overflow: hidden; }

.mb-header {
  display: flex; align-items: center; gap: 4px; padding: 6px 8px;
  background: var(--glass-header-bg, rgba(255,255,255,0.85));
  border-bottom: 1px solid var(--color-border); flex-shrink: 0;
  position: relative; z-index: 10;
}
.mb-header--mosaic .mb-url { filter: blur(4px); }

.mb-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: none; border-radius: var(--radius-sm);
  background: transparent; color: var(--color-text-secondary); cursor: pointer;
  transition: background var(--transition-hover), color var(--transition-hover);
  flex-shrink: 0; font-size: var(--fs-xl);
}
.mb-btn:hover:not(:disabled) { background: var(--color-primary-light); color: var(--color-primary); }
.mb-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.mb-btn--close:hover:not(:disabled) { background: var(--color-danger-light); color: var(--color-danger); }
.mb-btn--mosaic-exit { background: var(--color-warning-light); color: var(--color-warning); animation: pulse-glow 2s ease-in-out infinite; }
.mb-btn--bookmark { color: var(--color-text-muted); }
.mb-btn--bookmark:hover { color: var(--color-warning); background: var(--color-warning-light); }
.mb-btn--bookmarked { color: var(--color-warning); }
@keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.4) } 50% { box-shadow: 0 0 0 4px rgba(245,158,11,0.1) } }

.mb-spin { animation: mb-spin-anim 0.8s linear infinite; }
@keyframes mb-spin-anim { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }

.mb-url-wrap { flex: 1; position: relative; min-width: 120px; }
.mb-url-inner {
  display: flex; align-items: center; gap: 0;
  border: 1px solid var(--color-border); border-radius: var(--radius-md);
  background: var(--color-bg-surface); overflow: hidden;
  transition: border-color var(--transition-hover), box-shadow var(--transition-hover);
}
.mb-url-inner:focus-within { border-color: var(--color-primary); box-shadow: 0 0 0 2px var(--color-primary-light); }
.mb-url-inner--loading { border-color: var(--color-primary-light); }

.mb-url-favicon {
  width: 16px; height: 16px; margin-left: 8px; border-radius: 2px; flex-shrink: 0;
}

.mb-url-loading-spinner {
  width: 16px; height: 16px; margin-left: 8px; flex-shrink: 0;
  border: 2px solid var(--color-border); border-top-color: var(--color-primary);
  border-radius: 50%; animation: mb-spin-anim 0.6s linear infinite;
}

.mb-url-security {
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; margin-left: 6px; flex-shrink: 0; font-size: 12px;
}
.mb-url-security--secure { color: #10b981; }
.mb-url-security--insecure { color: #f59e0b; }

.mb-url {
  flex: 1; padding: 6px 40px 6px 8px; border: none; outline: none; background: transparent;
  color: var(--color-text-primary); font-size: var(--fs-md); min-width: 0;
}
.mb-zoom-badge {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  font-size: var(--fs-sm); color: var(--color-text-muted); background: var(--color-bg-base);
  padding: 1px 5px; border-radius: var(--radius-full); pointer-events: none;
}

.mb-progress-bar {
  height: 3px; background: transparent; flex-shrink: 0; overflow: hidden;
  position: relative; z-index: 11;
  transition: height 0.2s ease;
}
.mb-progress-bar--active { height: 3px; }
.mb-progress-fill {
  height: 100%; background: var(--color-primary);
  transition: width 0.2s ease-out; border-radius: 0 1px 1px 0;
  box-shadow: 0 0 8px rgba(99,102,241,0.4);
}

.mb-suggestions {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0;
  background: var(--color-bg-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); box-shadow: var(--shadow-lg);
  z-index: 100; max-height: 240px; overflow-y: auto;
}
.mb-suggestion { display: flex; align-items: center; gap: 8px; padding: 8px 10px; cursor: pointer; transition: background 0.1s; }
.mb-suggestion:hover, .mb-suggestion--active { background: var(--color-primary-light); }
.mb-suggestion-icon { font-size: var(--fs-xl); color: var(--color-text-muted); flex-shrink: 0; }
.mb-suggestion-info { flex: 1; min-width: 0; }
.mb-suggestion-title { font-size: var(--fs-md); color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mb-suggestion-url { font-size: var(--fs-sm); color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mb-suggestion-count { font-size: var(--fs-sm); color: var(--color-text-muted); background: var(--color-bg-base); padding: 1px 5px; border-radius: var(--radius-full); }

.mb-more-wrapper { position: relative; flex-shrink: 0; }
.mb-more-menu {
  position: absolute; top: calc(100% + 4px); right: 0; min-width: 200px;
  background: var(--color-bg-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); box-shadow: var(--shadow-lg); z-index: 200; padding: 4px;
}
.mb-more-item {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px;
  border: none; background: transparent; color: var(--color-text-primary);
  font-size: var(--fs-md); border-radius: var(--radius-sm); cursor: pointer;
  transition: background var(--transition-hover), color var(--transition-hover); text-align: left;
}
.mb-more-item:hover { background: var(--color-primary-light); color: var(--color-primary); }
.mb-more-item span:first-child { font-size: var(--fs-xl); width: 16px; text-align: center; }
.mb-more-divider { height: 1px; background: var(--color-border); margin: 4px 0; }
.mb-zoom-row { display: flex; align-items: center; justify-content: center; gap: 2px; padding: 4px 0; }
.mb-zoom-row .mb-more-item { width: auto; padding: 6px 8px; }
.mb-zoom-value { font-size: var(--fs-md); font-weight: 600; color: var(--color-text-primary); min-width: 40px; text-align: center; }
.mb-menu-fade-enter-active, .mb-menu-fade-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.mb-menu-fade-enter-from, .mb-menu-fade-leave-to { opacity: 0; transform: translateY(-4px); }

.mb-content { flex: 1; position: relative; min-height: 0; overflow: hidden; }
.mb-content--mosaic { filter: blur(8px); pointer-events: none; }

.mb-frame-wrapper {
  position: absolute; inset: 0; overflow: hidden;
}
.mb-frame { border: none; display: block; }

.mb-loading-overlay {
  position: absolute; inset: 0; z-index: 4;
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 40px; pointer-events: none;
}
.mb-loading-indicator {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 16px; border-radius: var(--radius-full);
  background: var(--glass-header-bg, rgba(255,255,255,0.9));
  backdrop-filter: blur(8px); box-shadow: var(--shadow-sm);
}
.mb-loading-spinner {
  width: 16px; height: 16px; border: 2px solid var(--color-border);
  border-top-color: var(--color-primary); border-radius: 50%;
  animation: mb-spin-anim 0.6s linear infinite;
}
.mb-loading-text {
  font-size: var(--fs-sm); color: var(--color-text-secondary);
  max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.mb-loading-fade-enter-active { transition: opacity 0.2s ease; }
.mb-loading-fade-leave-active { transition: opacity 0.3s ease 0.1s; }
.mb-loading-fade-enter-from, .mb-loading-fade-leave-to { opacity: 0; }

.mb-wheel-overlay {
  position: absolute; inset: 0; z-index: 20;
}
.mb-wheel-hint {
  position: absolute; bottom: 20px; right: 20px;
  display: flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: var(--radius-full);
  background: rgba(0,0,0,0.7); color: #fff;
  font-size: var(--fs-lg); font-weight: 600;
  backdrop-filter: blur(8px); pointer-events: none;
  animation: hint-pop 0.2s ease-out;
}
@keyframes hint-pop { from { opacity: 0; transform: scale(0.9) } to { opacity: 1; transform: scale(1) } }

.mb-mosaic-overlay { position: absolute; inset: 0; z-index: 10; pointer-events: none; }

.mb-error-page {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: var(--glass-header-bg, rgba(255,255,255,0.92)); z-index: 5;
  backdrop-filter: blur(8px);
}
.mb-error-content { text-align: center; max-width: 300px; padding: 24px; }
.mb-error-icon { font-size: 48px; color: var(--color-text-muted); margin-bottom: 16px; display: inline-block; }
.mb-error-title { font-size: 18px; font-weight: 700; color: var(--color-text-primary); margin: 0 0 8px; }
.mb-error-message { font-size: 13px; color: var(--color-text-secondary); line-height: 1.6; margin: 0 0 12px; }
.mb-error-url {
  font-size: 11px; color: var(--color-text-muted); font-family: monospace;
  background: var(--color-bg-base); padding: 6px 10px; border-radius: var(--radius-sm);
  word-break: break-all; margin-bottom: 16px;
}
.mb-error-actions { display: flex; gap: 8px; justify-content: center; }
.mb-error-retry {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border: 1px solid var(--color-primary);
  border-radius: var(--radius-md); background: var(--color-primary);
  color: var(--color-text-inverse); font-size: var(--fs-md); cursor: pointer;
  transition: filter var(--transition-hover);
}
.mb-error-retry:hover { filter: brightness(1.1); }
.mb-error-newtab {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border: 1px solid var(--color-border);
  border-radius: var(--radius-md); background: transparent;
  color: var(--color-text-secondary); font-size: var(--fs-md); cursor: pointer;
  transition: border-color var(--transition-hover), color var(--transition-hover);
}
.mb-error-newtab:hover { border-color: var(--color-primary); color: var(--color-primary); }

.mb-drag-overlay {
  position: absolute; inset: 0; background: var(--color-primary-light);
  border: 2px dashed var(--color-primary); z-index: 1000;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; color: var(--color-primary); font-size: var(--fs-2xl); font-weight: 600;
}
.mb-drag-overlay span:first-child { font-size: 3.69rem; }

.mb-quick-entry {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  padding: 20px; background: var(--glass-header-bg, rgba(255,255,255,0.85)); z-index: 5;
}
.mb-quick-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; max-width: 400px; width: 100%; }
.mb-quick-item {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 16px; border-radius: var(--radius-md); background: var(--color-bg-base);
  cursor: pointer; transition: background var(--transition-hover), transform var(--transition-hover);
}
.mb-quick-item:hover { background: var(--color-primary-light); transform: translateY(-2px); }
.mb-quick-favicon { width: 32px; height: 32px; border-radius: var(--radius-sm); }
.mb-quick-domain {
  font-size: var(--fs-base); color: var(--color-text-secondary); text-align: center;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
}

.mb-quick-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; color: var(--color-text-muted);
}
.mb-quick-empty-icon { font-size: 48px; opacity: 0.3; }
.mb-quick-empty p { font-size: var(--fs-lg); margin: 0; }

.mb-dialog-overlay {
  position: absolute; inset: 0; z-index: 60;
  background: rgba(0,0,0,0.3); backdrop-filter: blur(2px);
  display: flex; align-items: center; justify-content: center;
}
.mb-dialog {
  background: var(--color-bg-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
  width: 280px; overflow: hidden;
}
.mb-dialog-header {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 16px; font-size: var(--fs-lg); font-weight: 700;
  color: var(--color-primary); border-bottom: 1px solid var(--color-border);
}
.mb-dialog-header span { font-size: var(--fs-xl); }
.mb-dialog-body { padding: 16px; }
.mb-dialog-field { margin-bottom: 12px; }
.mb-dialog-field:last-child { margin-bottom: 0; }
.mb-dialog-field label {
  display: block; font-size: var(--fs-sm); font-weight: 600;
  color: var(--color-text-muted); margin-bottom: 6px;
}
.mb-dialog-input, .mb-dialog-select {
  width: 100%; padding: 8px 10px; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); background: var(--color-bg-base);
  color: var(--color-text-primary); font-size: var(--fs-md);
  outline: none; transition: border-color var(--transition-hover);
}
.mb-dialog-input:focus, .mb-dialog-select:focus { border-color: var(--color-primary); }
.mb-dialog-input:disabled { opacity: 0.6; }
.mb-dialog-actions {
  display: flex; gap: 8px; padding: 12px 16px;
  border-top: 1px solid var(--color-border);
}
.mb-dialog-cancel {
  flex: 1; padding: 8px 0; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); background: transparent;
  color: var(--color-text-secondary); font-size: var(--fs-md); cursor: pointer;
  transition: border-color var(--transition-hover);
}
.mb-dialog-cancel:hover { border-color: var(--color-primary); }
.mb-dialog-confirm {
  flex: 1; padding: 8px 0; border: none;
  border-radius: var(--radius-sm); background: var(--color-primary);
  color: var(--color-text-inverse); font-size: var(--fs-md); font-weight: 600;
  cursor: pointer; transition: filter var(--transition-hover);
}
.mb-dialog-confirm:hover { filter: brightness(1.1); }
.mb-dialog-fade-enter-active, .mb-dialog-fade-leave-active { transition: opacity 0.15s ease; }
.mb-dialog-fade-enter-from, .mb-dialog-fade-leave-to { opacity: 0; }

.mb-feedback-toast {
  position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: var(--radius-full);
  font-size: var(--fs-md); font-weight: 600; z-index: 70;
  backdrop-filter: blur(8px); box-shadow: var(--shadow-md);
}
.mb-feedback-toast--add { background: rgba(16,185,129,0.9); color: #fff; }
.mb-feedback-toast--remove { background: rgba(239,68,68,0.9); color: #fff; }
.mb-toast-fade-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.mb-toast-fade-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.mb-toast-fade-enter-from { opacity: 0; transform: translateX(-50%) translateY(8px); }
.mb-toast-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(-8px); }

.mb-usp-container {
  position: absolute; top: 0; right: 0; bottom: 0; width: 260px;
  z-index: 50; box-shadow: -4px 0 16px rgba(0,0,0,0.15);
}
.usp-slide-enter-active, .usp-slide-leave-active { transition: transform 0.2s ease, opacity 0.2s ease; }
.usp-slide-enter-from, .usp-slide-leave-to { transform: translateX(100%); opacity: 0; }

.mb-more-badge {
  margin-left: auto; font-size: var(--fs-xs); font-weight: 600;
  padding: 0 5px; border-radius: var(--radius-full);
  background: var(--color-primary-light); color: var(--color-primary); line-height: 16px;
}
</style>
