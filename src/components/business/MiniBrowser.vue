<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useMiniBrowser } from '@/composables/useMiniBrowser'
import { useStatsStore } from '@/stores/stats'
import { useHistoryStore } from '@/stores/history'
import { useBookmarksStore } from '@/stores/bookmarks'
import { getFaviconUrl, onFaviconError, getDomain } from '@/utils/helpers'
import { useI18n } from '@/i18n'

const emit = defineEmits<{ (e: 'close'): void }>()

const {
  browser,
  exitBrowsingMode,
  onUrlSubmit,
  addToQueue,
  onDrop,
  onDragOver,
  onDragEnter,
  onDragLeave,
  zoomIn, zoomOut, resetZoom,
} = useMiniBrowser()

const stats = useStatsStore()
const history = useHistoryStore()
const bookmarks = useBookmarksStore()
const { t } = useI18n()

const urlInput = ref<HTMLInputElement | null>(null)
const urlText = ref('')
const iframeRef = ref<HTMLIFrameElement | null>(null)
const isDragging = ref(false)
const iframeKey = ref(0)
const showSuggestions = ref(false)
const selectedSuggestionIndex = ref(-1)
const containerRef = ref<HTMLDivElement | null>(null)
let dragCounter = 0

interface SuggestionItem {
  type: 'history' | 'bookmark' | 'search'
  title: string
  url: string
  domain?: string
  visitCount?: number
  lastVisitTime?: number
}

const showQuickEntry = computed(() => !browser.currentUrl && !browser.isLoading && !browser.loadError)
const showIframe = computed(() => browser.currentUrl && !browser.loadError && !showQuickEntry.value)
const topSites = computed(() => stats.topSites.slice(0, 6))

const suggestions = computed<SuggestionItem[]>(() => {
  const keyword = urlText.value.trim().toLowerCase()
  if (!keyword || keyword.startsWith('http://') || keyword.startsWith('https://')) {
    return []
  }

  const results: SuggestionItem[] = []
  const seenUrls = new Set<string>()

  const historyMatches = history.allRecords
    .filter((record: any) => {
      const titleMatch = record.title?.toLowerCase().includes(keyword)
      const urlMatch = record.url.toLowerCase().includes(keyword)
      const domainMatch = record.domain?.toLowerCase().includes(keyword)
      return titleMatch || urlMatch || domainMatch
    })
    .slice(0, 5)

  for (const record of historyMatches) {
    if (!seenUrls.has(record.url)) {
      seenUrls.add(record.url)
      results.push({
        type: 'history',
        title: record.title || record.domain || record.url,
        url: record.url,
        domain: record.domain,
        visitCount: record.visitCount,
        lastVisitTime: record.lastVisitTime,
      })
    }
  }

  function searchBookmarks(nodes: typeof bookmarks.allBookmarks): void {
    for (const node of nodes) {
      if (results.length >= 8) return
      
      if (node.url) {
        const titleMatch = node.title.toLowerCase().includes(keyword)
        const urlMatch = node.url.toLowerCase().includes(keyword)
        const domainMatch = node.domain?.toLowerCase().includes(keyword)
        
        if ((titleMatch || urlMatch || domainMatch) && !seenUrls.has(node.url)) {
          seenUrls.add(node.url)
          results.push({
            type: 'bookmark',
            title: node.title,
            url: node.url,
            domain: node.domain,
          })
        }
      }
      
      if (node.children && results.length < 8) {
        searchBookmarks(node.children)
      }
    }
  }
  
  searchBookmarks(bookmarks.allBookmarks)

  if (results.length < 8 && !keyword.includes(' ')) {
    results.push({
      type: 'search',
      title: `${t('browser.searchFor')} "${urlText.value}"`,
      url: `https://www.google.com/search?q=${encodeURIComponent(urlText.value)}`,
    })
  }

  return results.slice(0, 8)
})

watch(() => browser.displayUrl, (url) => {
  if (url) urlText.value = url
})

watch(urlText, () => {
  selectedSuggestionIndex.value = -1
  showSuggestions.value = suggestions.value.length > 0
})

function focusUrl() {
  nextTick(() => { urlInput.value?.focus(); urlInput.value?.select() })
}

function onUrlKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (suggestions.value.length > 0) {
      selectedSuggestionIndex.value = Math.min(selectedSuggestionIndex.value + 1, suggestions.value.length - 1)
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (suggestions.value.length > 0) {
      selectedSuggestionIndex.value = Math.max(selectedSuggestionIndex.value - 1, -1)
    }
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (selectedSuggestionIndex.value >= 0 && selectedSuggestionIndex.value < suggestions.value.length) {
      selectSuggestion(suggestions.value[selectedSuggestionIndex.value])
    } else {
      onUrlSubmit(urlText.value)
    }
  } else if (e.key === 'Escape') {
    e.preventDefault()
    if (showSuggestions.value) {
      showSuggestions.value = false
    } else {
      urlText.value = browser.displayUrl
    }
  }
}

function selectSuggestion(item: SuggestionItem) {
  urlText.value = item.url
  showSuggestions.value = false
  onUrlSubmit(item.url)
}

function openSite(domain: string) { browser.navigate(`https://${domain}`) }

function handleDragEnter(e: DragEvent) { e.preventDefault(); dragCounter++; isDragging.value = true; onDragEnter(e) }
function handleDragLeave(e: DragEvent) { e.preventDefault(); dragCounter--; if (dragCounter <= 0) { dragCounter = 0; isDragging.value = false }; onDragLeave(e) }
function handleDrop(e: DragEvent) { e.preventDefault(); dragCounter = 0; isDragging.value = false; onDrop(e) }

function handleLoad() { 
  browser.onIframeLoad()
}

function setupLoadListener(el: HTMLIFrameElement | null) {
  if (!el) return
  el.removeEventListener('load', handleLoad)
  el.addEventListener('load', handleLoad, { once: true })
}

async function doRefresh() {
  browser.refresh()
  urlText.value = browser.displayUrl
  iframeKey.value++
  await nextTick()
  const f = iframeRef.value
  if (f && browser.currentUrl) { setupLoadListener(f); f.src = browser.currentUrl }
}

async function doRetry() {
  iframeKey.value++
  await nextTick()
  const f = iframeRef.value
  if (f && browser.currentUrl) { setupLoadListener(f); f.src = browser.currentUrl }
}

watch(() => browser.currentUrl, async (url) => {
  await nextTick()
  if (!url) return
  // Skip iframe reload for internal navigation (SPA route changes)
  if (browser.isInternalNavigation) return
  iframeKey.value++
  await nextTick()
  const iframe = iframeRef.value
  if (iframe) { setupLoadListener(iframe); iframe.src = url }
})

watch(() => browser.isLoading, async (loading) => {
  if (loading) {
    await nextTick()
    const iframe = iframeRef.value
    if (iframe && browser.currentUrl) setupLoadListener(iframe)
  }
})

onMounted(async () => {
  window.addEventListener('message', handleIframeMessage)
  
  // Add keyboard shortcut listener for zoom (Ctrl + +/-/0)
  window.addEventListener('keydown', handleKeyboardZoom, { capture: true })
  console.log('[MiniBrowser] Keyboard zoom shortcuts attached')
  
  await nextTick()
  
  if (browser.currentUrl) {
    const iframe = iframeRef.value
    if (iframe) { setupLoadListener(iframe); iframe.src = browser.currentUrl }
  } else if (!browser.currentUrl && !browser.isLoading && !browser.loadError) {
    focusUrl()
  }
})

function handleIframeMessage(e: MessageEvent) {
  if (e.source !== iframeRef.value?.contentWindow) return
  
  if (e.data?.type === '__iframe_navigate__' && e.data?.url) {
    if (e.data.isInternalNavigation) {
      browser.updateUrlOnly(e.data.url)
    } else {
      browser.navigate(e.data.url)
    }
  }
}

// Video playback recovery on focus
function handleIframeFocus() {
  console.log('[MiniBrowser] iframe focused, attempting to resume video playback')
  try {
    const iframe = iframeRef.value
    if (iframe?.contentDocument) {
      const videos = iframe.contentDocument.querySelectorAll('video')
      videos.forEach((video) => {
        if (!video.paused) return
        video.play().then(() => {
          console.log('[MiniBrowser] Video resumed successfully')
        }).catch((err: unknown) => {
          console.warn('[MiniBrowser] Cannot resume video (needs user interaction):', err)
        })
      })
    }
  } catch(err: unknown) {
    console.warn('[MiniBrowser] Error resuming video:', err)
  }
}

onUnmounted(() => {
  window.removeEventListener('message', handleIframeMessage)
  window.removeEventListener('keydown', handleKeyboardZoom, { capture: true })
  console.log('[MiniBrowser] Keyboard zoom shortcuts removed')
})

function handleKeyboardZoom(e: KeyboardEvent) {
  // Ctrl/Cmd + '+' or '=' to zoom in
  // Ctrl/Cmd + '-' to zoom out
  // Ctrl/Cmd + '0' to reset zoom
  
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
    if (e.key === '=' || e.key === '+') {
      e.preventDefault()
      e.stopPropagation()
      zoomIn()
      console.log('[MiniBrowser] Zoomed in to', browser.zoomLevel + '%')
    } else if (e.key === '-') {
      e.preventDefault()
      e.stopPropagation()
      zoomOut()
      console.log('[MiniBrowser] Zoomed out to', browser.zoomLevel + '%')
    } else if (e.key === '0') {
      e.preventDefault()
      e.stopPropagation()
      resetZoom()
      console.log('[MiniBrowser] Zoom reset to 100%')
    }
  }
}

function handleWheel(e: WheelEvent) {
  console.log('[MiniBrowser] Wheel event:', { ctrlKey: e.ctrlKey, metaKey: e.metaKey, deltaY: e.deltaY })
  
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    e.stopPropagation()
    const delta = e.deltaY !== 0 ? e.deltaY : e.deltaZ
    console.log('[MiniBrowser] Zoom triggered, delta:', delta)
    if (delta < 0) {
      zoomIn()
      console.log('[MiniBrowser] Zoomed in to', browser.zoomLevel + '%')
    } else if (delta > 0) {
      zoomOut()
      console.log('[MiniBrowser] Zoomed out to', browser.zoomLevel + '%')
    }
  }
}

function formatLastVisit(timestamp?: number): string {
  if (!timestamp) return ''
  const now = Date.now()
  const diff = now - timestamp
  
  if (diff < 60 * 1000) return t('browser.justNow')
  if (diff < 60 * 60 * 1000) return t('browser.minutesAgo', { count: Math.floor(diff / (60 * 1000)) })
  if (diff < 24 * 60 * 60 * 1000) return t('browser.hoursAgo', { count: Math.floor(diff / (60 * 60 * 1000)) })
  if (diff < 7 * 24 * 60 * 60 * 1000) return t('browser.daysAgo', { count: Math.floor(diff / (24 * 60 * 60 * 1000)) })
  
  return new Date(timestamp).toLocaleDateString()
}
</script>

<template>
  <div ref="containerRef" class="mb" :class="{ 'mb--drag': isDragging }" 
    @drop="handleDrop" 
    @dragover="onDragOver"
    @dragenter="handleDragEnter" 
    @dragleave="handleDragLeave">
    <!-- Toolbar: always visible, never affected by mosaic -->
    <div class="mb-bar">
      <div class="mb-row">
        <span class="mb-icon mb-icon--sm">
          <span v-if="browser.currentUrl"
            :class="browser.currentUrl.startsWith('https://') ? 'i-lucide:lock' : 'i-lucide:unlock'" />
          <span v-else class="i-lucide:search" />
        </span>
        <div class="mb-input-wrapper">
          <input ref="urlInput" v-model="urlText" class="mb-input" :placeholder="t('browser.placeholder')"
            @keydown="onUrlKeydown" @focus="urlText = browser.currentUrl; ($event.target as HTMLInputElement).select()"
            @input="showSuggestions = true" 
            type="text"
            autocomplete="off"
            spellcheck="false" />
          
          <Transition name="suggestion-fade">
            <div v-if="showSuggestions && suggestions.length > 0" class="suggestion-dropdown">
              <div v-for="(item, index) in suggestions" :key="item.url"
                class="suggestion-item"
                :class="{ 'suggestion-item--selected': index === selectedSuggestionIndex }"
                @click="selectSuggestion(item)"
                @mouseenter="selectedSuggestionIndex = index">
                <span class="suggestion-icon">
                  <img v-if="item.type !== 'search'" :src="getFaviconUrl(item.domain || item.url)" 
                    class="suggestion-favicon" 
                    @error="onFaviconError($event, item.url)" />
                  <span v-else class="i-lucide:search" />
                </span>
                <div class="suggestion-content">
                  <div class="suggestion-title">{{ item.title }}</div>
                  <div class="suggestion-url">{{ item.url }}</div>
                </div>
                <div class="suggestion-meta">
                  <span v-if="item.type === 'history' && item.visitCount" class="suggestion-badge">
                    {{ item.visitCount }}
                  </span>
                  <span v-if="item.lastVisitTime" class="suggestion-time">
                    {{ formatLastVisit(item.lastVisitTime) }}
                  </span>
                  <span class="suggestion-type" :class="`suggestion-type--${item.type}`">
                    {{ item.type === 'history' ? 'H' : item.type === 'bookmark' ? 'B' : 'S' }}
                  </span>
                </div>
              </div>
            </div>
          </Transition>
        </div>
        <button v-if="browser.loadError" class="mb-btn" :title="t('common.close')"
          @click="exitBrowsingMode(); emit('close')">
          <span class="i-lucide:x" />
        </button>
      </div>
      <div class="mb-tools">
        <button class="mb-tool" :title="t('browser.home')" @click="browser.goHome(); urlText = ''"><span
            class="i-lucide:home" /></button>
        <button class="mb-tool" :title="t('browser.back')" :disabled="!browser.canGoBack()"
          @click="browser.goBack()"><span class="i-lucide:chevron-left" /></button>
        <button class="mb-tool" :title="t('browser.forward')" :disabled="!browser.canGoForward()"
          @click="browser.goForward()"><span class="i-lucide:chevron-right" /></button>
        <button class="mb-tool" :title="t('browser.refresh')" :disabled="!browser.currentUrl" @click="doRefresh()"><span
            class="i-lucide:refresh-cw" :class="{ 'spin': browser.isLoading }" /></button>
        <div class="mb-spacer" />
        <button class="mb-tool" :title="t('browser.zoomOut')" @click="zoomOut()"><span
            class="i-lucide:minus" /></button>
        <span class="mb-zoom-level">{{ browser.zoomLevel }}%</span>
        <button class="mb-tool" :title="t('browser.zoomIn')" @click="zoomIn()"><span class="i-lucide:plus" /></button>
        <button class="mb-tool" :title="t('browser.resetZoom')" @click="resetZoom()"><span
            class="i-lucide:maximize-2" /></button>
        <div class="mb-spacer" />
        <button class="mb-tool mb-tool--accent" :title="t('browser.bookmark')"
          :disabled="!browser.currentUrl || browser.isLoading" @click="addToQueue()"><span
            class="i-lucide:bookmark" /></button>
        <button class="mb-tool" :title="t('browser.mosaic')" @click="browser.toggleMosaic()">
          <span :class="browser.isMosaicMode ? 'i-lucide:eye-off' : 'i-lucide:eye'" />
        </button>
        <button class="mb-tool" :title="t('browser.close')" @click="exitBrowsingMode(); emit('close')"><span
            class="i-lucide:x" /></button>
      </div>
    </div>

    <!-- Content area: mosaic applies here only -->
    <div class="mb-content" :class="{ 'mb-content--mosaic': browser.isMosaicMode }">
      <!-- Loading -->
      <div v-if="browser.isLoading" class="mb-body mb-body--center">
        <span class="i-lucide:loader-2 mb-spin" />
        <span class="mb-text--muted">{{ t('common.loading') }}</span>
      </div>

      <!-- Error: blocked -->
      <div v-else-if="browser.loadError === 'blocked'" class="mb-body mb-body--center">
        <span class="i-lucide:shield-alert mb-err-icon" />
        <p class="mb-err-title">{{ t('browser.errorTitle') }}</p>
        <p class="mb-err-desc">{{ t('browser.errorBlocked') }}</p>
        <p v-if="browser.currentUrl" class="mb-err-url">{{ browser.currentUrl }}</p>
        <div class="mb-err-actions">
          <button class="mb-btn mb-btn--primary" @click="browser.openInNewTab()"><span class="i-lucide:external-link" />
            {{ t('browser.openInNewTab') }}</button>
          <button class="mb-btn" @click="browser.goHome(); urlText = ''"><span class="i-lucide:arrow-left" /> {{
            t('browser.goBack') }}</button>
        </div>
      </div>

      <!-- Error: timeout -->
      <div v-else-if="browser.loadError === 'timeout'" class="mb-body mb-body--center">
        <span class="i-lucide:clock mb-err-icon" />
        <p class="mb-err-title">{{ t('browser.errorTitle') }}</p>
        <p class="mb-err-desc">{{ t('browser.errorTimeout') }}</p>
        <div class="mb-err-actions">
          <button class="mb-btn mb-btn--primary" @click="doRetry()"><span class="i-lucide:refresh-cw" /> {{
            t('browser.tryAgain') }}</button>
          <button class="mb-btn" @click="browser.openInNewTab()"><span class="i-lucide:external-link" /> {{
            t('browser.openInNewTab') }}</button>
        </div>
      </div>

      <!-- Error: invalid -->
      <div v-else-if="browser.loadError === 'invalid'" class="mb-body mb-body--center">
        <span class="i-lucide:alert-triangle mb-err-icon" />
        <p class="mb-err-title">{{ t('browser.errorTitle') }}</p>
        <p class="mb-err-desc">{{ t('browser.errorInvalid') }}</p>
        <button class="mb-btn mb-btn--primary" @click="browser.goHome(); urlText = ''; focusUrl()"><span
            class="i-lucide:arrow-left" /> {{ t('browser.goBack') }}</button>
      </div>

      <!-- Quick entry -->
      <div v-else-if="showQuickEntry" class="mb-body mb-body--center">
        <div class="mb-quick-grid">
          <button v-for="site in topSites" :key="site.domain" class="mb-quick-item" :title="site.domain"
            @click="openSite(site.domain)">
            <img :src="getFaviconUrl(site.domain)" class="mb-fav"
              @error="onFaviconError($event, `https://${site.domain}`)" />
            <span class="mb-quick-domain">{{ site.domain }}</span>
          </button>
        </div>
        <p class="mb-hint"><span class="i-lucide:pointer" /> {{ t('browser.dragHint') }}</p>
      </div>

      <!-- Iframe -->
      <iframe v-show="showIframe" :key="iframeKey" ref="iframeRef" class="mb-frame"
        :style="{ transform: `scale(${browser.zoomLevel / 100})`, transformOrigin: '0 0', width: `${10000 / browser.zoomLevel}%`, height: `${10000 / browser.zoomLevel}%` }"
        sandbox="allow-scripts allow-forms allow-modals allow-popups allow-presentation allow-downloads"
        referrerpolicy="no-referrer"
        name="mini-browser-iframe"
        @focus="handleIframeFocus" />

      <!-- Mosaic overlay inside content area only -->
      <div v-if="browser.isMosaicMode && browser.currentUrl" class="mb-mosaic-overlay" />
    </div>

    <!-- Drag overlay -->
    <Transition name="mb-fade">
      <div v-if="isDragging" class="mb-drag-overlay">
        <span class="i-lucide:link mb-drag-icon" />
        <span>{{ t('browser.dropHint') }}</span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.mb {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--app-bg);
  overflow: hidden;
  position: relative;
}

.mb--drag {
  outline: 2px dashed var(--primary-color);
  outline-offset: -2px;
}

/* ====== Toolbar ====== */
.mb-bar {
  flex-shrink: 0;
  padding: 6px 10px 4px;
  background: var(--app-surface);
  border-bottom: 1px solid var(--border-color);
  z-index: 10;
  position: relative;
}

.mb-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  position: relative;
}

.mb-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 14px;
  flex-shrink: 0;
}

.mb-icon--sm {
  width: 16px;
  height: 16px;
  font-size: 13px;
}

.mb-input-wrapper {
  flex: 1;
  min-width: 0;
  position: relative;
}

.mb-input {
  width: 100%;
  height: 28px;
  padding: 0 8px;
  font-size: 12px;
  color: var(--text-primary);
  background: var(--app-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  outline: none;
  transition: border-color 0.15s;
}

.mb-input:focus {
  border-color: var(--primary-color);
}

.mb-input::placeholder {
  color: var(--text-muted);
  font-size: 11px;
}

.suggestion-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--app-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-height: 280px;
  overflow-y: auto;
  z-index: 100;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  transition: background 0.1s;
  border-bottom: 1px solid var(--border-color);
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:hover,
.suggestion-item--selected {
  background: var(--primary-light);
}

.suggestion-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.suggestion-favicon {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  object-fit: contain;
}

.suggestion-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.suggestion-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.suggestion-url {
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.suggestion-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.suggestion-badge {
  font-size: 9px;
  padding: 1px 4px;
  background: var(--primary-light);
  color: var(--primary-color);
  border-radius: 3px;
  font-weight: 600;
}

.suggestion-time {
  font-size: 9px;
  color: var(--text-muted);
}

.suggestion-type {
  font-size: 8px;
  padding: 1px 3px;
  border-radius: 2px;
  font-weight: 700;
  min-width: 14px;
  text-align: center;
}

.suggestion-type--history {
  background: #dbeafe;
  color: #3b82f6;
}

.suggestion-type--bookmark {
  background: #d1fae5;
  color: #10b981;
}

.suggestion-type--search {
  background: #fef3c7;
  color: #f59e0b;
}

html.dark .suggestion-type--history {
  background: rgba(59, 130, 246, 0.2);
}

html.dark .suggestion-type--bookmark {
  background: rgba(16, 185, 129, 0.2);
}

html.dark .suggestion-type--search {
  background: rgba(245, 158, 11, 0.2);
}

.mb-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--app-surface);
  color: var(--text-primary);
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.mb-btn:hover {
  background: var(--primary-light);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.mb-btn--primary {
  background: var(--primary-color);
  color: #fff;
  border-color: var(--primary-color);
}

.mb-btn--primary:hover {
  filter: brightness(1.1);
}

.mb-btn:has(.i-lucide:x):hover {
  background: #fee2e2;
  border-color: #ef4444;
  color: #ef4444;
}

.mb-tools {
  display: flex;
  align-items: center;
  gap: 1px;
}

.mb-tool {
  width: 28px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.mb-tool:hover:not(:disabled) {
  background: var(--primary-light);
  color: var(--primary-color);
}

.mb-tool:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.mb-tool--accent:hover:not(:disabled) {
  background: rgba(16, 185, 129, 0.08);
  color: #10b981;
}

.mb-spacer {
  flex: 1;
}

.mb-zoom-level {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  min-width: 36px;
  text-align: center;
  user-select: none;
}

/* ====== Content Area ====== */
.mb-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

/* ====== Body States ====== */
.mb-body {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px;
  overflow-y: auto;
}

.mb-body--center {
  text-align: center;
}

.mb-spin {
  animation: spin 0.8s linear infinite;
  color: var(--primary-color);
  font-size: 24px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.mb-text--muted {
  font-size: 12px;
  color: var(--text-muted);
}

.mb-err-icon {
  font-size: 32px;
  color: #f59e0b;
}

.mb-err-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.mb-err-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
  max-width: 260px;
  line-height: 1.5;
}

.mb-err-url {
  font-size: 10px;
  color: var(--text-muted);
  word-break: break-all;
  max-width: 280px;
  font-family: monospace;
  background: var(--app-bg);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  margin: 0;
}

.mb-err-actions {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

/* Quick entry - no title, grid only */
.mb-quick-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  max-width: 260px;
}

.mb-quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 10px 8px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s;
}

.mb-quick-item:hover {
  background: var(--primary-light);
  border-color: var(--border-color);
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.mb-fav {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  object-fit: contain;
}

.mb-quick-domain {
  font-size: 9px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 70px;
  font-weight: 500;
}

.mb-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--text-muted);
  opacity: 0.6;
  margin-top: 16px;
}

/* Iframe */
.mb-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
  background: #fff;
}

html.dark .mb-frame {
  background: #1e293b;
}

/* ====== Mosaic Mode (content area only) ====== */
.mb-content--mosaic .mb-frame {
  filter: blur(24px) saturate(0.2) brightness(0.55) contrast(0.85);
  transition: filter 250ms ease;
}

.mb-content--mosaic .mb-frame:hover {
  filter: blur(12px) saturate(0.35) brightness(0.65) contrast(0.9);
}

.mb-mosaic-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
  background-image:
    repeating-linear-gradient(0deg, rgba(128, 128, 128, 0.18) 0 1px, transparent 1px 7px),
    repeating-linear-gradient(90deg, rgba(128, 128, 128, 0.18) 0 1px, transparent 1px 7px);
}

html.dark .mb-mosaic-overlay {
  background-image:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.07) 0 1px, transparent 1px 7px),
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.07) 0 1px, transparent 1px 7px);
}

/* Drag overlay */
.mb-drag-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(79, 70, 229, 0.06);
  z-index: 20;
  pointer-events: none;
}

.mb-drag-icon {
  font-size: 28px;
  color: var(--primary-color);
}

.mb-drag-overlay span:last-child {
  font-size: 12px;
  font-weight: 500;
  color: var(--primary-color);
}

.mb-fade-enter-active,
.mb-fade-leave-active {
  transition: opacity 150ms;
}

.mb-fade-enter-from,
.mb-fade-leave-to {
  opacity: 0;
}

.suggestion-fade-enter-active,
.suggestion-fade-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}

.suggestion-fade-enter-from,
.suggestion-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>