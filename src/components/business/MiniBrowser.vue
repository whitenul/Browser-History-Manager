<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted} from 'vue'
import { useMiniBrowser } from '@/composables/useMiniBrowser'
import { useStatsStore } from '@/stores/stats'
import { getFaviconUrl, onFaviconError } from '@/utils/helpers'
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
} = useMiniBrowser()

const stats = useStatsStore()
const { t } = useI18n()

const urlInput = ref<HTMLInputElement | null>(null)
const urlText = ref('')
const iframeRef = ref<HTMLIFrameElement | null>(null)
const isDragging = ref(false)
const iframeKey = ref(0)
let dragCounter = 0

const showQuickEntry = computed(() => !browser.currentUrl && !browser.isLoading && !browser.loadError)
const showIframe = computed(() => browser.currentUrl && !browser.loadError && !showQuickEntry.value)
const topSites = computed(() => stats.topSites.slice(0, 6))

watch(() => browser.displayUrl, (url) => {
  if (url) urlText.value = url
})

function focusUrl() {
  nextTick(() => { urlInput.value?.focus(); urlInput.value?.select() })
}

function onUrlKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') onUrlSubmit(urlText.value)
  else if (e.key === 'Escape') { urlText.value = browser.displayUrl; urlInput.value?.blur() }
}

function openSite(domain: string) { browser.navigate(`https://${domain}`) }

function handleDragEnter(e: DragEvent) { e.preventDefault(); dragCounter++; isDragging.value = true; onDragEnter(e) }
function handleDragLeave(e: DragEvent) { e.preventDefault(); dragCounter--; if (dragCounter <= 0) { dragCounter = 0; isDragging.value = false }; onDragLeave(e) }
function handleDrop(e: DragEvent) { e.preventDefault(); dragCounter = 0; isDragging.value = false; onDrop(e) }

function handleLoad() { browser.onIframeLoad() }

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
  await nextTick()
  if (browser.currentUrl) {
    const iframe = iframeRef.value
    if (iframe) { setupLoadListener(iframe); iframe.src = browser.currentUrl }
  } else if (!browser.currentUrl && !browser.isLoading && !browser.loadError) {
    focusUrl()
  }
})
</script>

<template>
  <div
    class="mb"
    :class="{ 'mb--drag': isDragging }"
    @drop="handleDrop"
    @dragover="onDragOver"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
  >
    <!-- Toolbar: always visible, never affected by mosaic -->
    <div class="mb-bar">
      <div class="mb-row">
        <span class="mb-icon mb-icon--sm">
          <span v-if="browser.currentUrl" :class="browser.currentUrl.startsWith('https://') ? 'i-lucide:lock' : 'i-lucide:unlock'" />
          <span v-else class="i-lucide:search" />
        </span>
        <input
          ref="urlInput"
          v-model="urlText"
          class="mb-input"
          :placeholder="t('browser.placeholder')"
          @keydown="onUrlKeydown"
          @focus="urlText = browser.currentUrl; ($event.target as HTMLInputElement).select()"
        />
        <button v-if="browser.loadError" class="mb-btn" :title="t('common.close')" @click="exitBrowsingMode(); emit('close')">
          <span class="i-lucide:x" />
        </button>
      </div>
      <div class="mb-tools">
        <button class="mb-tool" :title="t('browser.home')" @click="browser.goHome(); urlText = ''"><span class="i-lucide:home" /></button>
        <button class="mb-tool" :title="t('browser.back')" :disabled="!browser.canGoBack()" @click="browser.goBack()"><span class="i-lucide:chevron-left" /></button>
        <button class="mb-tool" :title="t('browser.forward')" :disabled="!browser.canGoForward()" @click="browser.goForward()"><span class="i-lucide:chevron-right" /></button>
        <button class="mb-tool" :title="t('browser.refresh')" :disabled="!browser.currentUrl" @click="doRefresh()"><span class="i-lucide:refresh-cw" :class="{ 'spin': browser.isLoading }" /></button>
        <div class="mb-spacer" />
        <button class="mb-tool mb-tool--accent" :title="t('browser.bookmark')" :disabled="!browser.currentUrl || browser.isLoading" @click="addToQueue()"><span class="i-lucide:bookmark" /></button>
        <button class="mb-tool" :title="t('browser.mosaic')" @click="browser.toggleMosaic()">
          <span :class="browser.isMosaicMode ? 'i-lucide:eye-off' : 'i-lucide:eye'" />
        </button>
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
          <button class="mb-btn mb-btn--primary" @click="browser.openInNewTab()"><span class="i-lucide:external-link" /> {{ t('browser.openInNewTab') }}</button>
          <button class="mb-btn" @click="browser.goHome(); urlText = ''"><span class="i-lucide:arrow-left" /> {{ t('browser.goBack') }}</button>
        </div>
      </div>

      <!-- Error: timeout -->
      <div v-else-if="browser.loadError === 'timeout'" class="mb-body mb-body--center">
        <span class="i-lucide:clock mb-err-icon" />
        <p class="mb-err-title">{{ t('browser.errorTitle') }}</p>
        <p class="mb-err-desc">{{ t('browser.errorTimeout') }}</p>
        <div class="mb-err-actions">
          <button class="mb-btn mb-btn--primary" @click="doRetry()"><span class="i-lucide:refresh-cw" /> {{ t('browser.tryAgain') }}</button>
          <button class="mb-btn" @click="browser.openInNewTab()"><span class="i-lucide:external-link" /> {{ t('browser.openInNewTab') }}</button>
        </div>
      </div>

      <!-- Error: invalid -->
      <div v-else-if="browser.loadError === 'invalid'" class="mb-body mb-body--center">
        <span class="i-lucide:alert-triangle mb-err-icon" />
        <p class="mb-err-title">{{ t('browser.errorTitle') }}</p>
        <p class="mb-err-desc">{{ t('browser.errorInvalid') }}</p>
        <button class="mb-btn mb-btn--primary" @click="browser.goHome(); urlText = ''; focusUrl()"><span class="i-lucide:arrow-left" /> {{ t('browser.goBack') }}</button>
      </div>

      <!-- Quick entry -->
      <div v-else-if="showQuickEntry" class="mb-body mb-body--center">
        <div class="mb-quick-grid">
          <button v-for="site in topSites" :key="site.domain" class="mb-quick-item" :title="site.domain" @click="openSite(site.domain)">
            <img :src="getFaviconUrl(site.domain)" class="mb-fav" @error="onFaviconError($event, `https://${site.domain}`)" />
            <span class="mb-quick-domain">{{ site.domain }}</span>
          </button>
        </div>
        <p class="mb-hint"><span class="i-lucide:pointer" /> {{ t('browser.dragHint') }}</p>
      </div>

      <!-- Iframe -->
      <iframe
        v-show="showIframe"
        :key="iframeKey"
        ref="iframeRef"
        class="mb-frame"
        sandbox="allow-scripts allow-forms allow-modals allow-popups allow-presentation allow-downloads allow-same-origin"
        referrerpolicy="no-referrer"
      />

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
.mb--drag { outline: 2px dashed var(--primary-color); outline-offset: -2px; }

/* ====== Toolbar ====== */
.mb-bar {
  flex-shrink: 0;
  padding: 6px 10px 4px;
  background: var(--app-surface);
  border-bottom: 1px solid var(--border-color);
  z-index: 10;
  position: relative;
}
.mb-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.mb-icon { display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 14px; flex-shrink: 0; }
.mb-icon--sm { width: 16px; height: 16px; font-size: 13px; }
.mb-input {
  flex: 1; min-width: 0; height: 28px; padding: 0 8px; font-size: 12px;
  color: var(--text-primary); background: var(--app-bg);
  border: 1px solid var(--border-color); border-radius: var(--radius-md); outline: none; transition: border-color 0.15s;
}
.mb-input:focus { border-color: var(--primary-color); }
.mb-input::placeholder { color: var(--text-muted); font-size: 11px; }

.mb-btn {
  display: flex; align-items: center; justify-content: center; gap: 4px;
  height: 26px; padding: 0 8px; border: 1px solid var(--border-color);
  border-radius: var(--radius-sm); background: var(--app-surface);
  color: var(--text-primary); font-size: 11px; cursor: pointer; white-space: nowrap; transition: all 0.15s;
}
.mb-btn:hover { background: var(--primary-light); border-color: var(--primary-color); color: var(--primary-color); }
.mb-btn--primary { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }
.mb-btn--primary:hover { filter: brightness(1.1); }
.mb-btn:has(.i-lucide:x):hover { background: #fee2e2; border-color: #ef4444; color: #ef4444; }

.mb-tools { display: flex; align-items: center; gap: 1px; }
.mb-tool {
  width: 28px; height: 26px; display: flex; align-items: center; justify-content: center;
  border: none; border-radius: var(--radius-sm); background: transparent;
  color: var(--text-muted); font-size: 14px; cursor: pointer; transition: all 0.15s; flex-shrink: 0;
}
.mb-tool:hover:not(:disabled) { background: var(--primary-light); color: var(--primary-color); }
.mb-tool:disabled { opacity: 0.3; cursor: not-allowed; }
.mb-tool--accent:hover:not(:disabled) { background: rgba(16,185,129,0.08); color: #10b981; }
.mb-spacer { flex: 1; }

/* ====== Content Area ====== */
.mb-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

/* ====== Body States ====== */
.mb-body { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 20px; overflow-y: auto; }
.mb-body--center { text-align: center; }

.mb-spin { animation: spin 0.8s linear infinite; color: var(--primary-color); font-size: 24px; }
@keyframes spin { to { transform: rotate(360deg); } }
.mb-text--muted { font-size: 12px; color: var(--text-muted); }

.mb-err-icon { font-size: 32px; color: #f59e0b; }
.mb-err-title { font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0; }
.mb-err-desc { font-size: 12px; color: var(--text-secondary); margin: 0; max-width: 260px; line-height: 1.5; }
.mb-err-url { font-size: 10px; color: var(--text-muted); word-break: break-all; max-width: 280px; font-family: monospace; background: var(--app-bg); padding: 4px 8px; border-radius: var(--radius-sm); margin: 0; }
.mb-err-actions { display: flex; gap: 6px; margin-top: 4px; }

/* Quick entry - no title, grid only */
.mb-quick-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-width: 260px; }
.mb-quick-item { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 10px 8px; border-radius: var(--radius-md); border: 1px solid transparent; background: transparent; cursor: pointer; transition: all 0.15s; }
.mb-quick-item:hover { background: var(--primary-light); border-color: var(--border-color); transform: translateY(-2px); box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.mb-fav { width: 22px; height: 22px; border-radius: 4px; object-fit: contain; }
.mb-quick-domain { font-size: 9px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70px; font-weight: 500; }
.mb-hint { display: flex; align-items: center; gap: 4px; font-size: 10px; color: var(--text-muted); opacity: 0.6; margin-top: 16px; }

/* Iframe */
.mb-frame { position: absolute; inset: 0; width: 100%; height: 100%; border: none; background: #fff; }
html.dark .mb-frame { background: #1e293b; }

/* ====== Mosaic Mode (content area only) ====== */
.mb-content--mosaic .mb-frame {
  filter: blur(24px) saturate(0.2) brightness(0.55) contrast(0.85);
  transition: filter 250ms ease;
}
.mb-content--mosaic .mb-frame:hover {
  filter: blur(12px) saturate(0.35) brightness(0.65) contrast(0.9);
}

.mb-mosaic-overlay {
  position: absolute; inset: 0; pointer-events: none; z-index: 3;
  background-image:
    repeating-linear-gradient(0deg, rgba(128,128,128,0.18) 0 1px, transparent 1px 7px),
    repeating-linear-gradient(90deg, rgba(128,128,128,0.18) 0 1px, transparent 1px 7px);
}
html.dark .mb-mosaic-overlay {
  background-image:
    repeating-linear-gradient(0deg, rgba(255,255,255,0.07) 0 1px, transparent 1px 7px),
    repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0 1px, transparent 1px 7px);
}

/* Drag overlay */
.mb-drag-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; background: rgba(79,70,229,0.06); z-index: 20; pointer-events: none; }
.mb-drag-icon { font-size: 28px; color: var(--primary-color); }
.mb-drag-overlay span:last-child { font-size: 12px; font-weight: 500; color: var(--primary-color); }

.mb-fade-enter-active, .mb-fade-leave-active { transition: opacity 150ms; }
.mb-fade-enter-from, .mb-fade-leave-to { opacity: 0; }
</style>
