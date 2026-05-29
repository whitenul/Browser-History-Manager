<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useTabOptimizerStore } from '@/stores/tabOptimizer'
import { useTabGroupStore } from '@/stores/tabGroup'
import { getFaviconUrl, getDomain, onFaviconError, autoTag, TAG_COLORS, debounce } from '@/utils/helpers'
import { useI18n } from '@/i18n'

const ui = useUIStore()
const optimizer = useTabOptimizerStore()
const groupStore = useTabGroupStore()
const { t } = useI18n()

interface TabInfo {
  id: number
  title: string
  url: string
  favIconUrl: string
  active: boolean
  discarded: boolean
  pinned: boolean
}

const tabs = ref<TabInfo[]>([])
const activeTab = ref<TabInfo | null>(null)
const loading = ref(true)
const suspendResult = ref('')
const tabSearch = ref('')

const filteredTabs = computed(() => {
  if (!tabSearch.value) return tabs.value
  const q = tabSearch.value.toLowerCase()
  return tabs.value.filter(t =>
    t.title?.toLowerCase().includes(q) || t.url?.toLowerCase().includes(q)
  )
})

function resolveFavicon(tab: TabInfo): string {
  if (tab.url) return getFaviconUrl(tab.url)
  return ''
}

const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6']

function letterAvatar(url: string): string {
  let label = '?'
  let color = AVATAR_COLORS[0]
  try {
    const hostname = new URL(url).hostname
    const parts = hostname.replace(/^www\./, '').split('.')
    label = (parts[0] || '?')[0].toUpperCase()
    const hash = hostname.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    color = AVATAR_COLORS[hash % AVATAR_COLORS.length]
  } catch { /* keep defaults */ }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="28" height="28"><rect width="32" height="32" rx="8" fill="${color}"/><text x="16" y="20" text-anchor="middle" fill="#fff" font-size="15" font-weight="600" font-family="-apple-system, BlinkMacSystemFont, sans-serif">${label}</text></svg>`
}

const hasTabsPermission = ref(true)
let _loading = false
let _initialLoad = true

async function loadTabs() {
  if (_loading) return
  _loading = true
  if (_initialLoad) loading.value = true
  try {
    const win = await chrome.windows.getCurrent()
    const result = await chrome.tabs.query({ windowId: win.id })

    hasTabsPermission.value = true

    const rawTabs: chrome.tabs.Tab[] = result
    optimizer.syncFromQuery(rawTabs)

    tabs.value = rawTabs.map((tab, idx) => ({
      id: tab.id!,
      title: tab.title || t('tabs.noTitle'),
      url: tab.url || '',
      favIconUrl: tab.favIconUrl || '',
      active: tab.active,
      discarded: tab.discarded ?? false,
      pinned: tab.pinned ?? false,
    }))
    activeTab.value = tabs.value.find(t => t.active) || null
  } catch { /* ignore */ }
  finally { loading.value = false; _loading = false; _initialLoad = false }
}

async function switchTab(tabId: number) {
  try {
    await chrome.tabs.update(tabId, { active: true })
    activeTab.value = tabs.value.find(t => t.id === tabId) || null
  } catch { /* ignore */ }
}

async function closeTab(tabId: number, event: Event) {
  event.stopPropagation()
  try {
    await chrome.tabs.remove(tabId)
  } catch { /* ignore */ }
}

async function refreshCurrentTab() {
  if (!activeTab.value) return
  try { await chrome.tabs.reload(activeTab.value.id) } catch { /* ignore */ }
}

function copyCurrentUrl() {
  if (!activeTab.value?.url) return
  navigator.clipboard.writeText(activeTab.value.url).then(() => {
    ui.notify(t('tabs.urlCopied'), 'success')
  }).catch(() => {
    ui.notify(t('tabs.copyFailed'), 'error')
  })
}

async function openNewTab() {
  const tab = await chrome.tabs.create({})
  if (groupStore.enabled && tab.id) {
    await groupStore.ensureGrouped([tab.id])
  }
}

async function handleSuspendIdle() {
  const count = await optimizer.suspendIdleTabs()
  suspendResult.value = count > 0 ? t('tabs.suspendedResult', { count, mb: count * 50 }) : t('tabs.noIdleToSuspend')
  await loadTabs()
  setTimeout(() => { suspendResult.value = '' }, 3000)
}

async function handleCloseDuplicates() {
  const count = await optimizer.closeDuplicateTabs()
  suspendResult.value = count > 0 ? t('tabs.closedDuplicatesResult', { count, mb: count * 50 }) : t('tabs.noDuplicatesFound')
  await loadTabs()
  setTimeout(() => { suspendResult.value = '' }, 3000)
}

async function handleSuspendAll() {
  const count = await optimizer.suspendAllInactive()
  suspendResult.value = count > 0 ? t('tabs.suspendedAllResult', { count, mb: count * 50 }) : t('tabs.noTabsToSuspend')
  await loadTabs()
  setTimeout(() => { suspendResult.value = '' }, 3000)
}

let activatedListener: ((activeInfo: { tabId: number; windowId: number }) => void) | null = null
let updatedListener: ((_tabId: number, _changeInfo: any, tab: chrome.tabs.Tab) => void) | null = null
let removedListener: ((tabId: number, _removeInfo: chrome.tabs.OnRemovedInfo) => void) | null = null

const debouncedRefreshData = debounce(() => { loadTabs() }, 250)

onMounted(async () => {
  loadTabs()
  await groupStore.init()
  await optimizer.loadSettings()
  await ui.loadDoubleClickMode()
  await ui.loadPrivacyMode()

  activatedListener = () => { debouncedRefreshData() }
  updatedListener = (_tabId, _changeInfo, tab) => {
    if (tab.active) debouncedRefreshData()
  }
  removedListener = () => { debouncedRefreshData() }

  chrome.tabs.onActivated.addListener(activatedListener)
  chrome.tabs.onUpdated.addListener(updatedListener)
  chrome.tabs.onRemoved.addListener(removedListener)
})

onUnmounted(() => {
  if (activatedListener) chrome.tabs.onActivated.removeListener(activatedListener)
  if (updatedListener) chrome.tabs.onUpdated.removeListener(updatedListener)
  if (removedListener) chrome.tabs.onRemoved.removeListener(removedListener)
})

const activeTabCount = computed(() => tabs.value.filter(t => !t.discarded).length)
const discardedCount = computed(() => tabs.value.filter(t => t.discarded).length)
</script>

<template>
  <div class="tab-manager">
    <div v-if="loading" class="tm-loading">
      <div class="tm-spinner" />
      <span>{{ t('tabs.loading') }}</span>
    </div>

    <template v-else>
      <div class="tm-current-card">
        <template v-if="!ui.privacyMode">
        <div class="tm-current-info">
          <img :src="activeTab ? resolveFavicon(activeTab) : ''" class="tm-current-favicon" @error="activeTab && onFaviconError($event, activeTab.url)" />
          <div class="tm-current-detail">
            <div class="tm-current-title">{{ activeTab?.title || t('tabs.unknownPage') }}</div>
            <div class="tm-current-url">{{ getDomain(activeTab?.url || '') }}</div>
          </div>
        </div>
        </template>
        <template v-else>
        <div class="tm-privacy-active">
          <div class="tm-privacy-avatar" v-html="letterAvatar(activeTab?.url || '')" />
          <span class="tm-privacy-label">{{ t('tabs.activeTab') }}</span>
        </div>
        </template>
        <div class="tm-actions">
          <button class="tm-action-btn" :title="t('tabs.refreshCurrent')" @click="refreshCurrentTab">
            <span class="i-lucide:refresh-cw" />
          </button>
          <button class="tm-action-btn" :title="t('tabs.copyUrl')" @click="copyCurrentUrl">
            <span class="i-lucide:copy" />
          </button>
          <button class="tm-action-btn" :title="t('tabs.newTab')" @click="openNewTab">
            <span class="i-lucide:plus" />
          </button>
        </div>
      </div>

      <div v-if="ui.showOptimizer" class="tm-optimizer-panel">
        <div class="tm-mem-bar">
          <div class="tm-mem-label">
            <span>{{ t('tabs.activeTabsCount', { active: activeTabCount, total: tabs.length }) }}</span>
            <span>{{ t('tabs.aboutMemory', { mb: optimizer.estimatedMemoryMB }) }}</span>
          </div>
          <div class="tm-mem-track">
            <div class="tm-mem-fill" :style="{ width: `${Math.min(100, (activeTabCount / Math.max(tabs.length, 1)) * 100)}%` }" />
          </div>
        </div>

        <div v-if="optimizer.duplicateGroups.length > 0" class="tm-opt-section">
          <div class="tm-opt-header">
            <span class="i-lucide:copy" />
            <span>{{ t('tabs.duplicateTabsCount', { count: optimizer.duplicateGroups.length }) }}</span>
          </div>
          <button class="tm-opt-btn tm-opt-btn--warn" @click="handleCloseDuplicates">
            <span class="i-lucide:x-circle" />
            {{ t('tabs.closeDuplicatesSave', { mb: optimizer.duplicateGroups.reduce((s, g) => s + g.savedMemory, 0) }) }}
          </button>
        </div>

        <div v-if="optimizer.idleTabs.length > 0" class="tm-opt-section">
          <div class="tm-opt-header">
            <span class="i-lucide:moon" />
            <span>{{ t('tabs.idleTabsCount', { count: optimizer.idleTabs.length }) }}</span>
          </div>
          <button class="tm-opt-btn tm-opt-btn--primary" @click="handleSuspendIdle">
            <span class="i-lucide:snowflake" />
            {{ t('tabs.suspendIdleSave', { mb: optimizer.idleTabs.length * 50 }) }}
          </button>
        </div>

        <div class="tm-opt-section">
          <button class="tm-opt-btn" @click="handleSuspendAll">
            <span class="i-lucide:cloud-snow" />
            {{ t('tabs.suspendAllInactive') }}
          </button>
        </div>

        <div v-if="suspendResult" class="tm-opt-result">{{ suspendResult }}</div>
      </div>

      <div class="tm-section-header">
        <span class="i-lucide:layers tm-section-icon" />
        <span>{{ t('tabs.allTabs') }} ({{ tabs.length }})</span>
        <span v-if="discardedCount > 0" class="tm-suspended-badge">{{ t('tabs.suspendedCount', { count: discardedCount }) }}</span>
        <span v-if="!hasTabsPermission" class="tm-perm-hint">{{ t('tabs.basicFeaturesOnly') }}</span>
      </div>

      <div v-if="tabs.length > 5" class="tm-search">
        <span class="i-lucide:search tm-search-icon" />
        <input v-model="tabSearch" class="tm-search-input" :placeholder="t('tabs.searchTabs')" />
        <button v-if="tabSearch" class="tm-search-clear" @click="tabSearch = ''">
          <span class="i-lucide:x" />
        </button>
      </div>

      <div class="tm-tab-list">
        <button
          v-for="(tab, idx) in filteredTabs"
          :key="tab.id"
          :title="ui.privacyMode ? undefined : tab.title"
          :class="['tm-tab-item', { active: tab.active, discarded: tab.discarded, 'tm-privacy-item': ui.privacyMode }]"
          @click="!ui.doubleClickMode ? switchTab(tab.id) : undefined"
          @dblclick="ui.doubleClickMode ? switchTab(tab.id) : undefined"
        >
          <template v-if="!ui.privacyMode">
          <img :src="resolveFavicon(tab)" class="tm-tab-favicon" @error="onFaviconError($event, tab.url)" />
          <div class="tm-tab-info">
            <div class="tm-tab-title">{{ tab.title }}</div>
            <div class="tm-tab-domain">{{ getDomain(tab.url) }}</div>
            <div v-if="autoTag(tab.url, tab.title).length" class="tm-tab-tags">
              <span v-for="tag in autoTag(tab.url, tab.title).slice(0, 2)" :key="tag" class="tm-tab-tag"
                :style="{ backgroundColor: (TAG_COLORS[tag] || '#64748b') + '18', color: TAG_COLORS[tag] || '#64748b' }">
                {{ t('tags.' + tag) }}
              </span>
            </div>
          </div>
          <span v-if="tab.discarded" class="tm-discarded-tag">{{ t('tabs.discarded') }}</span>
          <span v-if="tab.pinned" class="i-lucide:pin tm-pin-icon" />
          </template>
          <template v-else>
          <div class="tm-privacy-avatar" v-html="letterAvatar(tab.url)" />
          <span class="tm-privacy-index">{{ idx + 1 }}</span>
          </template>
          <button
            class="tm-tab-close"
            :title="t('tabs.closeTabTitle')"
            @click="closeTab(tab.id, $event)"
          >
            <span class="i-lucide:x" />
          </button>
        </button>
      <div v-if="!tabs.length" class="tm-empty">{{ t('tabs.noOpenTabs') }}</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tab-manager {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
}

.tm-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  gap: 10px;
  color: var(--color-text-muted);
  font-size: var(--fs-md);
}
.tm-spinner {
  width: 20px; height: 20px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.tm-current-card {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 12px;
}

.tm-current-info {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.tm-current-favicon {
  width: 28px; height: 28px;
  border-radius: 6px;
  flex-shrink: 0;
  background: var(--color-bg-base);
}

.tm-current-detail {
  flex: 1;
  min-width: 0;
}

.tm-current-title {
  font-size: var(--fs-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tm-current-url {
  font-size: var(--fs-base);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.tm-actions {
  display: flex;
  gap: 6px;
}

.tm-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 7px 0;
  font-size: var(--fs-md);
  font-weight: 500;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-hover);
}
.tm-action-btn:hover {
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.tm-optimizer-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  background: var(--color-primary-light);
  border: 1px solid var(--color-primary-light);
  cursor: pointer;
  font-size: var(--fs-md);
  font-weight: 600;
  color: var(--color-text-secondary);
  transition: all var(--transition-hover);
}
.tm-optimizer-toggle:hover {
  background: var(--color-primary-light);
}
.tm-optimizer-badge {
  margin-left: auto;
  font-size: var(--fs-sm);
  font-weight: 600;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: var(--color-success-light);
  color: var(--color-success);
}
.tm-toggle-arrow {
  font-size: var(--fs-xl);
  transition: transform 0.2s;
}
.tm-toggle-arrow.rotated {
  transform: rotate(180deg);
}

.tm-optimizer-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  animation: slideDown 0.2s ease;
}
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.tm-mem-bar {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tm-mem-label {
  display: flex;
  justify-content: space-between;
  font-size: var(--fs-base);
  color: var(--color-text-muted);
}
.tm-mem-track {
  height: 6px;
  background: var(--color-bg-base);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.tm-mem-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-success), var(--color-primary));
  border-radius: var(--radius-sm);
  transition: width 0.3s;
}

.tm-opt-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tm-opt-header {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: var(--fs-base);
  font-weight: 600;
  color: var(--color-text-secondary);
}

.tm-opt-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  font-size: var(--fs-base);
  font-weight: 500;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-hover);
  width: 100%;
  text-align: left;
}
.tm-opt-btn:hover {
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-color: var(--color-primary);
}
.tm-opt-btn--primary {
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-color: var(--color-primary-light);
}
.tm-opt-btn--primary:hover {
  background: var(--color-primary-light);
}
.tm-opt-btn--warn {
  background: var(--color-warning-light);
  color: var(--color-warning);
  border-color: var(--color-warning-light);
}
.tm-opt-btn--warn:hover {
  background: var(--color-warning-light);
}

.tm-opt-result {
  font-size: var(--fs-base);
  color: var(--color-success);
  font-weight: 500;
  text-align: center;
  padding: 4px;
  animation: fadeIn 0.3s;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.tm-section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-md);
  font-weight: 600;
  color: var(--color-text-secondary);
}

.tm-section-icon { font-size: var(--fs-xl); color: var(--color-primary); }

.tm-suspended-badge {
  margin-left: auto;
  font-size: var(--fs-xs);
  font-weight: 500;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.tm-search {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; background: var(--color-bg-surface);
  border: 1px solid var(--color-border); border-radius: var(--radius-lg);
  margin-bottom: 4px;
}
.tm-search-icon { color: var(--color-text-muted); font-size: var(--fs-xl); }
.tm-search-input {
  flex: 1; border: none; background: none; outline: none;
  font-size: var(--fs-lg); color: var(--color-text-primary);
}
.tm-search-clear {
  background: none; border: none; cursor: pointer;
  color: var(--color-text-muted); font-size: var(--fs-xl); padding: 0;
}
.tm-search-clear:hover { color: var(--color-text-primary); }

.tm-tab-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  overflow-y: auto;
}

.tm-tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all var(--transition-hover);
  text-align: left;
  width: 100%;
  color: inherit;
  font-family: inherit;
}
.tm-tab-item:hover {
  background: var(--color-primary-light);
}
.tm-tab-item.active {
  background: var(--color-primary-light);
  border-left: 3px solid var(--color-primary);
}
.tm-tab-item.discarded {
  opacity: 0.5;
}
.tm-tab-item.discarded .tm-tab-title {
  font-style: italic;
}

.tm-tab-favicon {
  width: 16px; height: 16px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  background: var(--color-bg-base);
}

.tm-tab-info {
  flex: 1;
  min-width: 0;
}

.tm-tab-title {
  font-size: var(--fs-md);
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tm-tab-domain {
  font-size: var(--fs-sm);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tm-tab-tags {
  display: flex; gap: 3px; margin-top: 2px;
}
.tm-tab-tag {
  font-size: var(--fs-xs); padding: 0 4px; border-radius: var(--radius-sm);
  font-weight: 500; white-space: nowrap; line-height: 13px;
}

.tm-discarded-tag {
  font-size: var(--fs-xs);
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  background: var(--color-primary-light);
  color: var(--color-primary);
  flex-shrink: 0;
}

.tm-pin-icon {
  font-size: var(--fs-sm);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.tm-tab-close {
  width: 22px; height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: var(--fs-base);
  flex-shrink: 0;
  opacity: 0;
  transition: all var(--transition-hover);
}
.tm-tab-item:hover .tm-tab-close { opacity: 1; }
.tm-tab-close:hover {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.tm-perm-hint {
  margin-left: auto;
  font-size: var(--fs-xs);
  font-weight: 500;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  background: var(--color-warning-light);
  color: var(--color-warning);
}



.tm-privacy-active {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
}

.tm-privacy-avatar {
  flex-shrink: 0;
  line-height: 0;
}
.tm-privacy-avatar :deep(svg) { display: block; }

.tm-privacy-label {
  font-size: var(--fs-md);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.tm-privacy-item {
  padding: 6px 10px !important;
  gap: 8px !important;
}

.tm-privacy-index {
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--color-text-muted);
  min-width: 16px;
  text-align: center;
}
</style>
