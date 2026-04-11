<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useUIStore } from '@/stores/ui'

const ui = useUIStore()

interface TabInfo {
  id: number
  title: string
  url: string
  favIconUrl: string
  active: boolean
}

const tabs = ref<TabInfo[]>([])
const activeTab = ref<TabInfo | null>(null)
const loading = ref(true)

function getDomain(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

function isUsableFaviconUrl(url: string): boolean {
  return !!url && (url.startsWith('http://') || url.startsWith('https://'))
}

function resolveFavicon(tab: TabInfo): string {
  if (isUsableFaviconUrl(tab.favIconUrl)) return tab.favIconUrl
  if (tab.url) return getFaviconUrl(tab.url)
  return ''
}

function getFaviconUrl(url: string): string {
  const domain = getDomain(url)
  return `chrome://favicon/size/16/${domain}`
}

const hasTabsPermission = ref(true)

async function loadTabs() {
  loading.value = true
  try {
    const win = await chrome.windows.getCurrent()
    const result = await chrome.tabs.query({ windowId: win.id })
    let detailedTabs: chrome.tabs.Tab[]

    try {
      detailedTabs = await Promise.all(result.map(t => chrome.tabs.get(t.id!)))
      hasTabsPermission.value = true
    } catch {
      detailedTabs = result
      hasTabsPermission.value = false
    }

    tabs.value = detailedTabs.map((t, idx) => ({
      id: t.id!,
      title: t.title || (hasTabsPermission.value ? '无标题' : `标签 ${idx + 1}`),
      url: t.url || '',
      favIconUrl: t.favIconUrl || '',
      active: t.active,
    }))
    activeTab.value = tabs.value.find(t => t.active) || null
  } catch { /* ignore */ }
  finally { loading.value = false }
}

async function switchTab(tabId: number) {
  try {
    await chrome.tabs.update(tabId, { active: true })
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
    ui.notify('URL 已复制', 'success')
  }).catch(() => {
    ui.notify('复制失败', 'error')
  })
}

async function openNewTab() {
  try { await chrome.tabs.create({}) } catch { /* ignore */ }
}

let activatedListener: ((activeInfo: { tabId: number; windowId: number }) => void) | null = null
let updatedListener: ((_tabId: number, _changeInfo: any, tab: chrome.tabs.Tab) => void) | null = null
let removedListener: (() => void) | null = null

onMounted(() => {
  loadTabs()

  activatedListener = () => loadTabs()
  updatedListener = (_tabId, _changeInfo, tab) => { if (tab.active) loadTabs() }
  removedListener = () => loadTabs()

  chrome.tabs.onActivated.addListener(activatedListener)
  chrome.tabs.onUpdated.addListener(updatedListener)
  chrome.tabs.onRemoved.addListener(removedListener)
})

onUnmounted(() => {
  if (activatedListener) chrome.tabs.onActivated.removeListener(activatedListener)
  if (updatedListener) chrome.tabs.onUpdated.removeListener(updatedListener)
  if (removedListener) chrome.tabs.onRemoved.removeListener(removedListener)
})
</script>

<template>
  <div class="tab-manager">
    <div v-if="loading" class="tm-loading">
      <div class="tm-spinner" />
      <span>加载标签页...</span>
    </div>

    <template v-else>
      <div class="tm-current-card">
        <div class="tm-current-info">
          <img :src="activeTab ? resolveFavicon(activeTab) : ''" class="tm-current-favicon" />
          <div class="tm-current-detail">
            <div class="tm-current-title">{{ activeTab?.title || '未知页面' }}</div>
            <div class="tm-current-url">{{ getDomain(activeTab?.url || '') }}</div>
          </div>
        </div>
        <div class="tm-actions">
          <button class="tm-action-btn" title="刷新当前页" @click="refreshCurrentTab">
            <span class="i-lucide:refresh-cw" />
          </button>
          <button class="tm-action-btn" title="复制 URL" @click="copyCurrentUrl">
            <span class="i-lucide:copy" />
          </button>
          <button class="tm-action-btn" title="新建标签页" @click="openNewTab">
            <span class="i-lucide:plus" />
          </button>
        </div>
      </div>

      <div class="tm-section-header">
        <span class="i-lucide:layers tm-section-icon" />
        <span>所有标签页 ({{ tabs.length }})</span>
        <span v-if="!hasTabsPermission" class="tm-perm-hint">仅基础功能</span>
      </div>

      <div class="tm-tab-list">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['tm-tab-item', { active: tab.active }]"
          @click="switchTab(tab.id)"
        >
          <img :src="resolveFavicon(tab)" class="tm-tab-favicon" loading="lazy" />
          <div class="tm-tab-info">
            <div class="tm-tab-title">{{ tab.title }}</div>
            <div class="tm-tab-domain">{{ getDomain(tab.url) }}</div>
          </div>
          <button
            class="tm-tab-close"
            title="关闭标签页"
            @click="closeTab(tab.id, $event)"
          >
            <span class="i-lucide:x" />
          </button>
        </button>
        <div v-if="!tabs.length" class="tm-empty">暂无打开的标签页</div>
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
}

.tm-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  gap: 10px;
  color: var(--text-muted);
  font-size: 12px;
}
.tm-spinner {
  width: 20px; height: 20px;
  border: 2px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.tm-current-card {
  background: var(--app-surface);
  border: 1px solid var(--border-color);
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
  background: var(--app-bg);
}

.tm-current-detail {
  flex: 1;
  min-width: 0;
}

.tm-current-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tm-current-url {
  font-size: 11px;
  color: var(--text-muted);
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
  font-size: 12px;
  font-weight: 500;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.tm-action-btn:hover {
  background: var(--primary-light);
  color: var(--primary-color);
  border-color: var(--primary-color);
}

.tm-section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.tm-section-icon { font-size: 14px; color: var(--primary-color); }

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
  transition: all var(--transition-fast);
  text-align: left;
  width: 100%;
  color: inherit;
  font-family: inherit;
}
.tm-tab-item:hover {
  background: var(--primary-light);
}
.tm-tab-item.active {
  background: rgba(99,102,241,0.08);
  border-left: 3px solid var(--primary-color);
}

.tm-tab-favicon {
  width: 16px; height: 16px;
  border-radius: 4px;
  flex-shrink: 0;
  background: var(--app-bg);
}

.tm-tab-info {
  flex: 1;
  min-width: 0;
}

.tm-tab-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tm-tab-domain {
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  color: var(--text-muted);
  font-size: 11px;
  flex-shrink: 0;
  opacity: 0;
  transition: all var(--transition-fast);
}
.tm-tab-item:hover .tm-tab-close { opacity: 1; }
.tm-tab-close:hover {
  background: rgba(239,68,68,0.15);
  color: #ef4444;
}

.tm-perm-hint {
  margin-left: auto;
  font-size: 9px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(245,158,11,0.15);
  color: #f59e0b;
}

.tm-empty {
  text-align: center;
  padding: 24px 0;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
