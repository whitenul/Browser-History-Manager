<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useThemeStore } from '@/stores/theme'
import { useHistoryStore } from '@/stores/history'
import { useUserScriptsStore } from '@/stores/userScripts'
import { useI18n } from '@/i18n'
import HistoryView from '@/views/HistoryView.vue'
import StatsView from '@/views/StatsView.vue'
import BookmarksView from '@/views/BookmarksView.vue'
import PageTocView from '@/views/PageTocView.vue'
import SettingsView from '@/views/SettingsView.vue'
import ThemeModal from '@/components/business/ThemeModal.vue'
import DeleteConfirmModal from '@/components/business/DeleteConfirmModal.vue'
import TagModal from '@/components/business/TagModal.vue'
import GroupRuleModal from '@/components/business/GroupRuleModal.vue'
import ContextMenu from '@/components/business/ContextMenu.vue'
import PreviewPanel from '@/components/business/PreviewPanel.vue'
import BookmarkPickerModal from '@/components/business/BookmarkPickerModal.vue'
import CommandPalette from '@/components/business/CommandPalette.vue'

const ui = useUIStore()
const theme = useThemeStore()
const history = useHistoryStore()
const userScripts = useUserScriptsStore()
const { t } = useI18n()

const tabTitles: Record<string, string> = {
  history: t('nav.history'),
  toc: t('nav.toc'),
  stats: t('nav.stats'),
  bookmarks: t('nav.bookmarks'),
  settings: t('nav.settings'),
}

const headerTitle = computed(() => tabTitles[ui.activeTab] || t('nav.history'))

const tabs = [
  { id: 'history' as const, label: t('nav.history'), icon: 'i-lucide:clock' },
  { id: 'toc' as const, label: t('nav.toc'), icon: 'i-lucide:list' },
  { id: 'stats' as const, label: t('nav.stats'), icon: 'i-lucide:bar-chart-3' },
  { id: 'bookmarks' as const, label: t('nav.bookmarks'), icon: 'i-lucide:bookmark' },
  { id: 'settings' as const, label: t('nav.settings'), icon: 'i-lucide:settings' },
]

onMounted(async () => {
  console.log('[POPUP] onMounted start')
  try {
    const result = await chrome.storage.local.get('sidebarMode')
    console.log('[POPUP] sidebarMode from storage:', result.sidebarMode)
    if (result.sidebarMode === true) {
      console.log('[POPUP] sidebarMode is true, attempting sidePanel.open...')
      const win = await chrome.windows.getCurrent()
      console.log('[POPUP] current window id:', win.id)
      await chrome.sidePanel.open({ windowId: win.id! })
      console.log('[POPUP] sidePanel.open succeeded, closing popup')
      window.close()
      return
    }
    console.log('[POPUP] sidebarMode is not true, showing popup normally')
  } catch (err: any) {
    console.error('[POPUP] Error in sidebar redirect:', err?.message || err)
  }
  await Promise.all([theme.loadTheme(), history.loadRecords(), userScripts.loadScripts()])
})
</script>

<template>
  <div class="app-container" :class="{ 'has-gradient': theme.background.type === 'gradient' }">
    <header class="app-header">
      <div class="header-title">{{ headerTitle }}</div>
      <div class="header-actions">
        <button class="icon-btn" @click="theme.showThemeModal = true" title="Theme">
          <span class="i-lucide:palette" />
        </button>
        <button class="icon-btn" @click="ui.showCommandPalette = true" title="Command Palette">
          <span class="i-lucide:command" />
        </button>
      </div>
    </header>

    <main class="app-main">
      <HistoryView v-if="ui.activeTab === 'history'" />
      <PageTocView v-else-if="ui.activeTab === 'toc'" />
      <StatsView v-else-if="ui.activeTab === 'stats'" />
      <BookmarksView v-else-if="ui.activeTab === 'bookmarks'" />
      <SettingsView v-else-if="ui.activeTab === 'settings'" />
    </main>

    <nav class="app-nav">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['nav-item', { active: ui.activeTab === tab.id }]"
        @click="ui.activeTab = tab.id"
      >
        <span :class="tab.icon" />
        <span class="nav-label">{{ tab.label }}</span>
      </button>
    </nav>

    <ThemeModal v-if="theme.showThemeModal" />
    <DeleteConfirmModal />
    <TagModal />
    <GroupRuleModal />
    <ContextMenu />
    <PreviewPanel />
    <BookmarkPickerModal />
    <CommandPalette />
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  width: 380px;
  height: 600px;
  background: var(--color-bg-base);
  color: var(--color-text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
  position: relative;
}
.app-container.has-gradient {
  background: var(--gradient-bg, var(--color-bg-base));
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  flex-shrink: 0;
}
.header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.header-actions {
  display: flex;
  gap: 4px;
}
.icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: 16px;
  transition: all var(--transition-hover);
}
.icon-btn:hover {
  background: var(--hover-bg);
  color: var(--color-text-primary);
}

.app-main {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.app-nav {
  display: flex;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  flex-shrink: 0;
  padding: 4px;
  gap: 2px;
}
.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 4px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: 11px;
  transition: all var(--transition-hover);
}
.nav-item:hover {
  background: var(--hover-bg);
  color: var(--color-text-primary);
}
.nav-item.active {
  color: var(--color-primary);
  background: var(--color-primary-light);
}
.nav-item span:first-child {
  font-size: 18px;
}
.nav-label {
  font-size: 10px;
  font-weight: 500;
}
</style>
