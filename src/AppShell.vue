<script setup lang="ts">
import { onMounted, onUnmounted, computed, defineAsyncComponent } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useTabGroupStore } from '@/stores/tabGroup'
import { useTabOptimizerStore } from '@/stores/tabOptimizer'
import { useThemeStore } from '@/stores/theme'
import { useHistoryStore } from '@/stores/history'
import { useI18n } from '@/i18n'
const HistoryView = defineAsyncComponent(() => import('@/views/HistoryView.vue'))
const StatsView = defineAsyncComponent(() => import('@/views/StatsView.vue'))
const BookmarksView = defineAsyncComponent(() => import('@/views/BookmarksView.vue'))
const SettingsView = defineAsyncComponent(() => import('@/views/SettingsView.vue'))
const TabManagerView = defineAsyncComponent(() => import('@/views/TabManagerView.vue'))
const ThemeModal = defineAsyncComponent(() => import('@/components/business/ThemeModal.vue'))
const DeleteConfirmModal = defineAsyncComponent(() => import('@/components/business/DeleteConfirmModal.vue'))
const TagModal = defineAsyncComponent(() => import('@/components/business/TagModal.vue'))
const GroupRuleModal = defineAsyncComponent(() => import('@/components/business/GroupRuleModal.vue'))
const ContextMenu = defineAsyncComponent(() => import('@/components/business/ContextMenu.vue'))
const PreviewPanel = defineAsyncComponent(() => import('@/components/business/PreviewPanel.vue'))
const BookmarkPickerModal = defineAsyncComponent(() => import('@/components/business/BookmarkPickerModal.vue'))
const CommandPalette = defineAsyncComponent(() => import('@/components/business/CommandPalette.vue'))

const ui = useUIStore()
const groupStore = useTabGroupStore()
const optimizer = useTabOptimizerStore()
const theme = useThemeStore()
const history = useHistoryStore()
const { t } = useI18n()

const isSidebar = document.location.pathname.includes('sidebar')

const tabTitles: Record<string, string> = {
  tabs: t('nav.tabs'),
  history: t('nav.history'),
  stats: t('nav.stats'),
  bookmarks: t('nav.bookmarks'),
  settings: t('nav.settings'),
}

const headerTitle = computed(() => tabTitles[ui.activeTab] || (isSidebar ? t('nav.tabs') : t('nav.history')))

const allTabs = [
  { id: 'tabs' as const, label: t('nav.tabs'), icon: 'i-lucide:globe', sidebarOnly: true },
  { id: 'history' as const, label: t('nav.history'), icon: 'i-lucide:clock' },
  { id: 'stats' as const, label: t('nav.stats'), icon: 'i-lucide:bar-chart-3' },
  { id: 'bookmarks' as const, label: t('nav.bookmarks'), icon: 'i-lucide:bookmark' },
  { id: 'settings' as const, label: t('nav.settings'), icon: 'i-lucide:settings' },
]

const visibleTabs = computed(() => allTabs.filter(t => !t.sidebarOnly || isSidebar))

onMounted(async () => {
  if (isSidebar && ui.activeTab === 'history') {
    ui.switchTab('tabs')
  }
  await Promise.all([theme.loadTheme(), history.loadRecords()])

  try {
    const result = await chrome.storage.local.get('appSettings')
    if (result.appSettings) {
      const s = result.appSettings as Record<string, any>
      if (s.defaultTimeRange) history.setTimeRange(s.defaultTimeRange)
      if (s.defaultGroupMode) history.setGroupMode(s.defaultGroupMode)
      if (s.defaultSortMode) history.setSortMode(s.defaultSortMode)
    }
  } catch { /* ignore */ }

  document.addEventListener('keydown', onGlobalKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onGlobalKeydown)
})

function onGlobalKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    ui.showCommandPalette = !ui.showCommandPalette
  }
}
</script>

<template>
  <div :class="['app-shell', isSidebar ? 'app-shell--sidebar' : 'app-shell--popup', { 'has-gradient': theme.activeGradient }]">
    <header :class="isSidebar ? 'shell-header--sidebar' : 'shell-header--popup'">
      <div class="shell-top">
        <div class="shell-left">
          <button v-if="ui.canGoBack" class="btn-back" @click="ui.goBack()" :title="t('common.back')">
            <span class="i-lucide:arrow-left" />
          </button>
          <h1 class="shell-title">{{ headerTitle }}</h1>
          <span v-if="ui.activeTab === 'history' && history.displayedRecords.length && !isSidebar" class="shell-count">
            {{ history.displayedRecords.length }} {{ t('history.recordsCount', { count: '' }).replace('{count}', '').trim() }}
          </span>
        </div>
        <div v-if="!isSidebar" class="shell-actions">
          <button class="btn-icon btn-ghost" :title="t('commandPalette.placeholder')" @click="ui.showCommandPalette = true">
            <span class="i-lucide:terminal" />
          </button>
          <button v-if="ui.activeTab === 'history'" class="btn-icon btn-ghost" :title="t('history.exportCsv')" @click="history.doExport()">
            <span class="i-lucide:download" />
          </button>
          <button class="btn-icon btn-ghost" :title="t('theme.title')" @click="theme.toggleThemeModal()">
            <span class="i-lucide:palette" />
          </button>
        </div>
        <div v-else class="shell-actions--compact">
          <button class="btn-icon btn-ghost btn-sm" :title="t('commandPalette.placeholder')" @click="ui.showCommandPalette = true">
            <span class="i-lucide:terminal-square" />
          </button>
        </div>
      </div>

      <nav class="shell-tabs">
        <button
          v-for="tab in visibleTabs"
          :key="tab.id"
          :class="['shell-tab', { active: ui.activeTab === tab.id }]"
          @click="ui.switchTab(tab.id); ui.clearNavStack()"
        >
          <span :class="tab.icon" class="tab-icon" />
          <span class="tab-label">{{ tab.label }}</span>
          <span v-if="tab.id === 'tabs'" class="shell-tab-tools">
            <span :class="['shell-tool', { active: groupStore.enabled }]" :title="groupStore.enabled ? 'Group ON' : 'Group OFF'"
              @click.stop="groupStore.enabled ? groupStore.disableMode() : groupStore.enableMode()">
              <span class="i-lucide:layout-grid" />
            </span>
            <span :class="['shell-tool', { active: ui.privacyMode }]" :title="ui.privacyMode ? 'Privacy ON' : 'Privacy OFF'"
              @click.stop="ui.privacyMode = !ui.privacyMode; ui.savePrivacyMode()">
              <span class="i-lucide:eye-off" />
            </span>
            <span :class="['shell-tool', { active: ui.showOptimizer }]" :title="ui.showOptimizer ? 'Optimizer ON' : 'Optimizer OFF'"
              @click.stop="ui.showOptimizer = !ui.showOptimizer">
              <span class="i-lucide:zap" />
            </span>
          </span>
        </button>
      </nav>
    </header>

    <main :class="['shell-content', `shell-content--${ui.activeTab}`]">
      <Transition :name="ui.isNavigatingBack ? 'fade-fast' : 'fade'" mode="out-in">
        <TabManagerView v-if="ui.activeTab === 'tabs'" key="'tabs'" />
        <HistoryView v-else-if="ui.activeTab === 'history'" :key="'history'" />
        <StatsView v-else-if="ui.activeTab === 'stats'" :key="'stats'" />
        <BookmarksView v-else-if="ui.activeTab === 'bookmarks'" :key="'bookmarks'" />
        <SettingsView v-else :key="'settings'" />
      </Transition>
    </main>

    <ThemeModal v-if="theme.showThemeModal" />
    <DeleteConfirmModal v-if="ui.showDeleteConfirm" />
    <TagModal v-if="ui.showTagModal" />
    <GroupRuleModal v-if="ui.showGroupRuleModal" />
    <ContextMenu v-if="ui.showContextMenu" />
    <PreviewPanel v-if="ui.showPreview" />
    <BookmarkPickerModal v-if="ui.showBookmarkPicker" />
    <CommandPalette v-if="ui.showCommandPalette" />

    <Teleport to="body">
      <Transition name="toast">
        <div v-if="ui.showUndoToast" class="toast undo-toast" @click="ui.executeUndo()">
          <span>{{ ui.undoLabel }}</span>
          <button class="undo-btn">{{ t('toast.undo') }}</button>
        </div>
        <div v-else-if="ui.showToast" class="toast" :class="ui.toastType">
          {{ ui.toastMessage }}
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--app-bg);
  color: var(--text-primary);
  transition: background var(--transition-normal), color var(--transition-normal);
}

/* ========== Popup Mode (原有行为完全保留) ========== */
.app-shell--popup {
  width: 380px;
  height: 580px;
}

.shell-header--popup {
  display: flex;
  flex-direction: column;
  background: var(--app-header-bg);
  color: var(--app-header-text);
  flex-shrink: 0;
  transition: background var(--transition-normal), color var(--transition-normal);
}

.app-shell--popup.has-gradient .shell-header--popup {
  background: var(--gradient-bg);
  color: white;
}

.shell-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: var(--header-height);
}

.shell-left {
  display: flex;
  align-items: center;
  gap: 6px;
}
.btn-back {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: none; background: transparent;
  border-radius: var(--radius-sm); cursor: pointer; color: inherit;
  font-size: 16px; transition: all var(--transition-fast); flex-shrink: 0;
}
.btn-back:hover { background: rgba(255,255,255,0.15); }
.shell-title {
  font-size: 16px; font-weight: 600; margin: 0;
  letter-spacing: -0.01em;
  transition: all var(--transition-fast);
}
.shell-count { font-size: 12px; opacity: 0.75; }

.shell-actions { display: flex; gap: 6px; }
.shell-actions .btn-icon {
  color: inherit; opacity: 0.8;
  width: 32px; height: 32px; font-size: 16px;
}
.shell-actions .btn-icon:hover { opacity: 1; background: rgba(255,255,255,0.15); }

.shell-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  background: var(--app-surface);
  flex-shrink: 0;
  transition: background var(--transition-normal), border-color var(--transition-normal);
}

.shell-tab {
  flex: 1 1 auto; display: flex; align-items: center; justify-content: center;
  gap: 6px; padding: 10px 8px; font-size: 13px; font-weight: 500;
  color: var(--text-muted);
  background: none; border: none; border-bottom: 2px solid transparent;
  cursor: pointer; transition: all var(--transition-fast);
  white-space: nowrap;
}
.shell-tab:hover {
  color: var(--text-secondary);
  background: var(--primary-light);
}
.shell-tab.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}
.tab-icon { font-size: 14px; }

.shell-tab-tools {
  display: flex;
  align-items: center;
  gap: 1px;
  margin-left: 4px;
}

.shell-tool {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px; height: 20px;
  border-radius: 4px;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.shell-tool:hover { background: rgba(148,163,184,0.1); }
.shell-tool.active { color: #10b981; }
.shell-tool.active:nth-child(3) { color: #8b5cf6; }
.shell-tool.active:nth-child(5) { color: #f59e0b; }

.app-shell--popup .shell-content {
  flex: 1;
  overflow: hidden;
}

/* ========== Sidebar Mode (参考 Bookmark Sidebar + Sidemark 精简设计) ========== */
.app-shell--sidebar {
  width: 100%;
  height: 100vh;
}

.shell-header--sidebar {
  display: flex;
  flex-direction: column;
  background: var(--app-header-bg);
  color: var(--app-header-text);
  flex-shrink: 0;
  padding: 8px 16px 0;
  transition: background var(--transition-normal), color var(--transition-normal);
}

.app-shell--sidebar.has-gradient .shell-header--sidebar {
  background: var(--gradient-bg);
  color: white;
}

.app-shell--sidebar .shell-top {
  height: auto;
  padding: 0;
  min-height: 32px;
}

.app-shell--sidebar .shell-title {
  font-size: 15px;
}

.app-shell--sidebar .shell-actions--compact {
  display: flex;
  gap: 2px;
}

.app-shell--sidebar .btn-sm {
  width: 28px;
  height: 28px;
  font-size: 14px;
}

.app-shell--sidebar .shell-tabs {
  margin-top: 6px;
}

.app-shell--sidebar .shell-tab {
  padding: 8px 0;
  font-size: 13px;
}

.app-shell--sidebar .shell-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 16px;
}

/* Sidebar mode: override body constraints from main.css */
.app-shell--sidebar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

:global(body:has(.app-shell--sidebar)) {
  width: 100% !important;
  max-height: none !important;
  height: 100vh !important;
}

/* ========== 共享动画 ========== */
.fade-enter-active, .fade-leave-active { transition: opacity 60ms ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.fade-fast-enter-active, .fade-fast-leave-active { transition: opacity 30ms ease-out; }
.fade-fast-enter-from, .fade-fast-leave-to { opacity: 0; }

/* ========== Toast ========== */
.toast {
  position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
  padding: 8px 16px; border-radius: var(--radius-md);
  font-size: 13px; font-weight: 500; z-index: 9999;
  box-shadow: var(--shadow-lg); animation: slideUp var(--transition-normal);
}
.toast.success { background: #10b981; color: white; }
.toast.error { background: #ef4444; color: white; }
.toast.info { background: #3b82f6; color: white; }

.undo-toast {
  display: flex; align-items: center; gap: 10px;
  background: #1e293b; color: #e2e8f0;
  cursor: pointer; padding: 8px 12px;
}
.undo-btn {
  padding: 3px 10px; border: 1px solid rgba(99,102,241,0.5);
  border-radius: var(--radius-sm); background: rgba(99,102,241,0.2);
  color: #818cf8; font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all var(--transition-fast);
}
.undo-btn:hover { background: #6366f1; color: white; }

.toast-enter-active { transition: all 200ms ease; }
.toast-leave-active { transition: all 300ms ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(10px); }
</style>
