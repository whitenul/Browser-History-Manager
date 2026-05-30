<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { useMiniBrowser } from '@/composables/useMiniBrowser'
import { useSuggestions, type SuggestionItem } from '@/composables/useSuggestions'
import { useStatsStore } from '@/stores/stats'
import { useThemeStore } from '@/stores/theme'
import { useUserScriptsStore } from '@/stores/userScripts'
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
const theme = useThemeStore()
const userScripts = useUserScriptsStore()
const { t } = useI18n()

const urlInput = ref<HTMLInputElement | null>(null)
const urlText = ref('')
const iframeRef = ref<HTMLIFrameElement | null>(null)
const isDragging = ref(false)
const showMoreMenu = ref(false)
let dragCounter = 0

// Mobile layout mode — constrain iframe to mobile viewport width
const isMobileLayout = ref(true)
const MOBILE_WIDTH = 375 // iPhone standard width

// Computed: zoom factor to scale mobile-width iframe to fill container
// When container is e.g. 380px wide and iframe is 375px, zoom ≈ 1.01
// The dynamic zoom ensures seamless fit regardless of sidebar width
const mobileZoom = computed(() => {
  if (!isMobileLayout.value) return browser.zoomLevel / 100
  // Base zoom from store + additional scaling for mobile fit
  return (browser.zoomLevel / 100) * 1
})

const showQuickEntry = computed(() => !browser.currentUrl && !browser.isLoading && !browser.loadError)
const topSites = computed(() => (stats.topSites || []).slice(0, 6))
const currentSuggestions = computed(() => suggestions.getSuggestions(urlText.value))

// Theme background
const bgType = computed(() => theme.background.type)
const bgGradient = computed(() => theme.background.type === 'gradient' ? theme.background.gradient : undefined)
const bgImageUrl = computed(() => theme.background.imageUrl)
const bgImageBlur = computed(() => theme.background.blur)
const bgImageOpacity = computed(() => theme.background.opacity)
const bgOverlayColor = computed(() => theme.background.overlayColor)
const bgOverlayOpacityVal = computed(() => theme.background.overlayOpacity)
const bgSize = computed(() => theme.background.size)
const isDarkMode = computed(() => theme.isDark)

const starPositions = computed(() => {
  const arr: { x: number; y: number; size: number; duration: number; delay: number }[] = []
  for (let i = 0; i < 50; i++) {
    const isStatic = Math.random() < 0.3
    const size = isStatic ? 1 + Math.random() : 1 + Math.random() * 2
    arr.push({ x: Math.random() * 100, y: Math.random() * 100, size, duration: 2 + Math.random() * 4, delay: Math.random() * 5 })
  }
  return arr
})

watch(() => browser.displayUrl, (val) => { urlText.value = val }, { immediate: true })

// Nav version watcher
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

// Message handler for iframe-buster.js
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

// Loading fallback timer
let loadingFallbackTimer: ReturnType<typeof setTimeout> | null = null
watch(() => browser.isLoading, (loading) => {
  if (loadingFallbackTimer) clearTimeout(loadingFallbackTimer)
  if (loading) {
    loadingFallbackTimer = setTimeout(() => { if (browser.isLoading) browser.onIframeLoad() }, 3000)
  }
})

// === Zoom: Ctrl key tracking for wheel capture over iframe ===
// Problem: Cross-origin iframes consume wheel events internally — they never bubble to parent.
// Solution: When Ctrl/Meta is held down, temporarily disable iframe pointer-events
// and show an invisible overlay that captures wheel events for zooming.
// When Ctrl is released, iframe interaction is restored immediately.
const ctrlHeld = ref(false)
function handleGlobalKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && !ctrlHeld.value) {
    ctrlHeld.value = true
    // Disable iframe interaction so wheel events reach our overlay
    nextTick(() => {
      const iframe = iframeRef.value
      if (iframe) (iframe as HTMLElement).style.pointerEvents = 'none'
    })
  }
}
function handleGlobalKeyUp(e: KeyboardEvent) {
  if (!(e.ctrlKey || e.metaKey) && ctrlHeld.value) {
    ctrlHeld.value = false
    // Restore iframe interaction
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
    // Restore iframe interaction on blur (user switched windows)
    nextTick(() => {
      const iframe = iframeRef.value
      if (iframe) (iframe as HTMLElement).style.pointerEvents = ''
    })
  })
  document.addEventListener('click', closeMoreMenu)
  window.addEventListener('message', onIframeMessage)

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
  // Restore iframe pointer-events on cleanup
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
  try {
    const iframe = iframeRef.value
    if (iframe?.contentWindow) {
      const actualUrl = iframe.contentWindow.location.href
      if (actualUrl && actualUrl !== 'about:blank' && actualUrl !== browser.currentUrl) {
        browser.updateUrlOnly(actualUrl)
      }
    }
  } catch { /* cross-origin */ }
  browser.onIframeLoad()
}

function handleMoreAction(action: string) {
  const actions: Record<string, () => void> = {
    home: () => browser.goHome(),
    newTab: () => browser.openInNewTab(),
    mosaic: () => browser.toggleMosaic(),
    mobile: () => isMobileLayout.value = !isMobileLayout.value,
    zoomOut, zoomIn, resetZoom,
  }
  actions[action]?.()
  showMoreMenu.value = false
}

function closeMoreMenu(e: Event) {
  if (!(e.target as HTMLElement).closest('.mb-more-wrapper')) showMoreMenu.value = false
}

function handleFaviconError(event: Event, url: string) { onFaviconError(event, url) }
</script>

<template>
  <div class="mb-container"
    @dragenter="handleDragEnter" @dragover="onDragOver" @dragleave="handleDragLeave" @drop="handleDrop"
    @wheel.prevent="handleWheelZoom">

    <!-- Theme Background Layers -->
    <div v-if="bgType === 'aurora'" class="mb-bg aurora-bg"><div class="aurora-blob" /><div class="aurora-blob" /><div class="aurora-blob" /></div>
    <div v-if="bgType === 'stars'" class="mb-bg star-field">
      <div v-for="i in 50" :key="i" class="star"
        :style="{ left: starPositions[i-1]?.x + '%', top: starPositions[i-1]?.y + '%', width: starPositions[i-1]?.size + 'px', height: starPositions[i-1]?.size + 'px', '--duration': starPositions[i-1]?.duration + 's', animationDelay: starPositions[i-1]?.delay + 's' }" />
    </div>
    <div v-if="bgType === 'gradient'" class="mb-bg gradient-bg" :style="{ background: bgGradient }" />
    <div v-if="bgType === 'image'" class="mb-bg bg-image-layer">
      <div class="bg-image" :style="{ backgroundImage: `url(${bgImageUrl})`, backgroundSize: bgSize, filter: `blur(${bgImageBlur}px)`, opacity: bgImageOpacity }" />
      <div class="bg-overlay" :style="{ backgroundColor: bgOverlayColor, opacity: bgOverlayOpacityVal }" />
    </div>
    <div v-if="isDarkMode && ['stars','aurora','image'].includes(bgType)" class="mb-bg noise-overlay" />

    <!-- Drag overlay -->
    <div v-if="isDragging" class="mb-drag-overlay"><span class="i-lucide:cloud-upload" /><p>{{ t('browser.dropHere') }}</p></div>

    <!-- Header -->
    <div class="mb-header" :class="{ 'mb-header--mosaic': browser.isMosaicMode }">
      <button class="mb-btn" :disabled="!browser.canGoBack()" :title="t('browser.back')" @click="browser.goBack"><span class="i-lucide:chevron-left" /></button>
      <button class="mb-btn" :disabled="!browser.canGoForward()" :title="t('browser.forward')" @click="browser.goForward"><span class="i-lucide:chevron-right" /></button>
      <button class="mb-btn" :title="t('browser.refresh')" @click="browser.refresh"><span class="i-lucide:refresh-cw" /></button>

      <div class="mb-url-wrap">
        <input ref="urlInput" v-model="urlText" class="mb-url" :placeholder="t('browser.enterUrl')"
          @keydown="handleUrlKeydown" @focus="suggestions.showSuggestions.value = true" @blur="suggestions.hideSuggestions()" />
        <span v-if="browser.zoomLevel !== 100" class="mb-zoom-badge">{{ browser.zoomLevel }}%</span>

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

      <button v-if="browser.isMosaicMode" class="mb-btn mb-btn--mosaic-exit" :title="t('browser.disableMosaic')" @click="browser.toggleMosaic()"><span class="i-lucide:eye" /></button>

      <div class="mb-more-wrapper">
        <button class="mb-btn" :title="t('common.more')" @click.stop="showMoreMenu = !showMoreMenu"><span class="i-lucide:more-vertical" /></button>
        <transition name="mb-menu-fade">
          <div v-if="showMoreMenu" class="mb-more-menu" @click.stop>
            <button class="mb-more-item" @click="handleMoreAction('home')"><span class="i-lucide:home" />{{ t('browser.home') }}</button>
            <button class="mb-more-item" @click="handleMoreAction('newTab')"><span class="i-lucide:external-link" />{{ t('browser.openInNewTab') }}</button>
            <button class="mb-more-item" @click="handleMoreAction('mobile')">
              <span :class="isMobileLayout ? 'i-lucide:monitor' : 'i-lucide:smartphone'" />
              {{ isMobileLayout ? t('browser.desktopView') : t('browser.mobileView') }}
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

    <!-- Content area -->
    <div class="mb-content" :class="{ 'mb-content--mosaic': browser.isMosaicMode }">

      <!-- Quick entry -->
      <div v-if="showQuickEntry" class="mb-quick-entry">
        <div class="mb-quick-grid">
          <div v-for="site in topSites" :key="site.domain" class="mb-quick-item" @click="openSite(site.domain)">
            <img :src="getFaviconUrl(site.domain)" class="mb-quick-favicon" @error="(e: Event) => handleFaviconError(e, site.domain)" />
            <span class="mb-quick-domain">{{ site.domain }}</span>
          </div>
        </div>
      </div>

      <!--
        Mobile layout: iframe fixed at 375px (iPhone width), zoom-scaled to fill container.
        Websites see a 375px viewport → render mobile layout.
        CSS zoom scales visual + hit-testing coordinates correctly.
      -->
      <div v-if="isMobileLayout && browser.currentUrl" class="mb-phone-frame">
        <iframe ref="iframeRef" class="mb-frame mb-frame--mobile"
          :style="{ zoom: (browser.zoomLevel / 100) * (380 / MOBILE_WIDTH) }"
          referrerpolicy="no-referrer" name="mini-browser-iframe" />
      </div>

      <iframe v-else ref="iframeRef" class="mb-frame"
        :style="{ zoom: browser.zoomLevel / 100 }"
        referrerpolicy="no-referrer" name="mini-browser-iframe" />

      <!--
        Wheel capture overlay: only active when Ctrl/Meta is held down.
        When Ctrl is pressed, iframe gets pointer-events:none so wheel events
        reach this overlay instead of being consumed by the iframe.
        When Ctrl is released, iframe regains full interactivity immediately.
      -->
      <div v-if="ctrlHeld && browser.currentUrl" class="mb-wheel-overlay" @wheel.prevent="handleWheelZoom">
        <div class="mb-wheel-hint">
          <span class="i-lucide:zoom-in" /> {{ browser.zoomLevel }}%
        </div>
      </div>

      <div v-if="browser.isMosaicMode && browser.currentUrl" class="mb-mosaic-overlay" />
      <div v-if="browser.isLoading" class="mb-status"><span class="i-lucide:loader-2 mb-spinner" /><span>{{ t('browser.loading') }}</span></div>
      <div v-if="browser.loadError && !browser.isLoading" class="mb-status">
        <span class="i-lucide:alert-circle" /><span>{{ t('browser.loadError') }}</span>
        <button class="mb-retry" @click="browser.refresh">{{ t('browser.retry') }}</button>
      </div>
    </div>

    <!-- User Scripts Panel (slide-in from right) -->
    <Transition name="usp-slide">
      <div v-if="userScripts.showPanel" class="mb-usp-container">
        <UserScriptsPanel />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.mb-container { display: flex; flex-direction: column; height: 100%; position: relative; background: transparent; }

.mb-bg { position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: -1; overflow: hidden; }

/* Header */
.mb-header {
  display: flex; align-items: center; gap: 4px; padding: 6px 8px;
  background: var(--glass-header-bg, rgba(255,255,255,0.85));
  border-bottom: 1px solid var(--color-border); flex-shrink: 0;
  position: relative; z-index: 10;
}
.mb-header--mosaic .mb-url { filter: blur(4px); }

/* Buttons */
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
@keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.4) } 50% { box-shadow: 0 0 0 4px rgba(245,158,11,0.1) } }

/* URL bar */
.mb-url-wrap { flex: 1; position: relative; min-width: 120px; }
.mb-url {
  width: 100%; padding: 6px 40px 6px 10px; border: 1px solid var(--color-border);
  border-radius: var(--radius-md); background: var(--color-bg-surface);
  color: var(--color-text-primary); font-size: var(--fs-md); outline: none;
  transition: border-color var(--transition-hover), box-shadow var(--transition-hover);
}
.mb-url:focus { border-color: var(--color-primary); box-shadow: 0 0 0 2px var(--color-primary-light); }
.mb-zoom-badge {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  font-size: var(--fs-sm); color: var(--color-text-muted); background: var(--color-bg-base);
  padding: 1px 5px; border-radius: var(--radius-full); pointer-events: none;
}

/* Suggestions */
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

/* More menu */
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

/* Content */
.mb-content { flex: 1; position: relative; min-height: 0; overflow: auto; }
.mb-content--mosaic { filter: blur(8px); pointer-events: none; }

/* Phone frame — seamless container, no padding/border/radius */
.mb-phone-frame {
  display: block;
  height: 100%;
  overflow: hidden;
}
.mb-frame--mobile {
  width: 375px; /* iPhone viewport width → triggers mobile layout */
  height: 100%;
}

/* Iframe base */
.mb-frame { width: 100%; height: 100%; border: none; display: block; }

/* Wheel capture overlay — shown only when Ctrl/Meta is held */
.mb-wheel-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  /* Captures wheel events while Ctrl is held; iframe underneath has pointer-events disabled via JS */
}
.mb-wheel-hint {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: var(--radius-full);
  background: rgba(0,0,0,0.7);
  color: #fff;
  font-size: var(--fs-lg);
  font-weight: 600;
  backdrop-filter: blur(8px);
  pointer-events: none;
  animation: hint-pop 0.2s ease-out;
}
@keyframes hint-pop { from { opacity: 0; transform: scale(0.9) } to { opacity: 1; transform: scale(1) } }

/* Mosaic overlay */
.mb-mosaic-overlay { position: absolute; inset: 0; z-index: 10; pointer-events: none; }

/* Status overlays */
.mb-status {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px;
  background: var(--glass-header-bg, rgba(255,255,255,0.85));
  color: var(--color-text-secondary); font-size: var(--fs-xl); z-index: 5;
}
.mb-spinner { animation: spin 1s linear infinite; font-size: var(--fs-4xl); }
@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
.mb-retry {
  padding: 6px 16px; border: 1px solid var(--color-primary);
  border-radius: var(--radius-md); background: var(--color-primary);
  color: var(--color-text-inverse); font-size: var(--fs-md); cursor: pointer;
  transition: filter var(--transition-hover);
}
.mb-retry:hover { filter: brightness(1.1); }

/* Drag overlay */
.mb-drag-overlay {
  position: absolute; inset: 0; background: var(--color-primary-light);
  border: 2px dashed var(--color-primary); z-index: 1000;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; color: var(--color-primary); font-size: var(--fs-2xl); font-weight: 600;
}
.mb-drag-overlay span:first-child { font-size: 3.69rem; }

/* Quick entry */
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

/* User Scripts Panel */
.mb-usp-container {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 260px;
  z-index: 50;
  box-shadow: -4px 0 16px rgba(0,0,0,0.15);
}

.usp-slide-enter-active,
.usp-slide-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.usp-slide-enter-from,
.usp-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.mb-more-badge {
  margin-left: auto;
  font-size: var(--fs-xs);
  font-weight: 600;
  padding: 0 5px;
  border-radius: var(--radius-full);
  background: var(--color-primary-light);
  color: var(--color-primary);
  line-height: 16px;
}
</style>
