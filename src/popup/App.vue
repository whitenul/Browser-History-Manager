<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useThemeStore } from '@/stores/theme'
import { useHistoryStore } from '@/stores/history'
import { useI18n } from '@/i18n'
import HistoryView from '@/views/HistoryView.vue'
import StatsView from '@/views/StatsView.vue'
import BookmarksView from '@/views/BookmarksView.vue'
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
const { t } = useI18n()

const tabTitles: Record<string, string> = {
  history: t('nav.history'),
  stats: t('nav.stats'),
  bookmarks: t('nav.bookmarks'),
  settings: t('nav.settings'),
}

const headerTitle = computed(() => tabTitles[ui.activeTab] || t('nav.history'))

const tabs = [
  { id: 'history' as const, label: t('nav.history'), icon: 'i-lucide:clock' },
  { id: 'stats' as const, label: t('nav.stats'), icon: 'i-lucide:bar-chart-3' },
  { id: 'bookmarks' as const, label: t('nav.bookmarks'), icon: 'i-lucide:bookmark' },
  { id: 'settings' as const, label: t('nav.settings'), icon: 'i-lucide:settings' },
]

onMounted(async () => {
  await Promise.all([theme.loadTheme(), history.loadRecords()])
})
</script>

<template>
  <div class="app-container" :class="{ 'has-gradient': theme.activeGradient }">
    <header class="app-header">
      <div class="header-left">
        <button v-if="ui.canGoBack" class="btn-back" @click="ui.goBack()" :title="t('common.back')">
          <span class="i-lucide:arrow-left" />
        </button>
        <h1 class="header-title">{{ headerTitle }}</h1>
        <span v-if="ui.activeTab === 'history' && history.displayedRecords.length" class="header-count">
          {{ history.displayedRecords.length }}
        </span>
      </div>
      <div class="header-actions">
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
    </header>

    <nav class="app-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-item"
        :class="{ active: ui.activeTab === tab.id }"
        @click="ui.switchTab(tab.id); ui.clearNavStack()"
      >
        <span :class="tab.icon" class="tab-icon" />
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </nav>

    <main class="app-content">
      <Transition :name="ui.isNavigatingBack ? 'fade-fast' : 'fade'" mode="out-in">
        <HistoryView v-if="ui.activeTab === 'history'" :key="'history'" />
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
    <CommandPalette />

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
.app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--app-bg);
  color: var(--text-primary);
  transition: background var(--transition-normal), color var(--transition-normal);
}

.app-container.has-gradient :deep(.app-header) {
  background: var(--gradient-bg);
  color: white;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: var(--header-height);
  background: var(--app-header-bg);
  color: var(--app-header-text);
  flex-shrink: 0;
  transition: background var(--transition-normal), color var(--transition-normal);
}

.header-left {
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
.header-title {
  font-size: 16px; font-weight: 600; margin: 0;
  letter-spacing: -0.01em;
  transition: all var(--transition-fast);
}
.header-count { font-size: 12px; opacity: 0.75; }

.header-actions { display: flex; gap: 6px; }
.header-actions .btn-icon {
  color: inherit; opacity: 0.8;
  width: 32px; height: 32px; font-size: 16px;
}
.header-actions .btn-icon:hover { opacity: 1; background: rgba(255,255,255,0.15); }

.app-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  background: var(--app-surface);
  flex-shrink: 0;
  transition: background var(--transition-normal), border-color var(--transition-normal);
}

.tab-item {
  flex: 1; display: flex; align-items: center; justify-content: center;
  gap: 6px; padding: 10px 0; font-size: 13px; font-weight: 500;
  color: var(--text-muted);
  background: none; border: none; border-bottom: 2px solid transparent;
  cursor: pointer; transition: all var(--transition-fast);
}
.tab-item:hover {
  color: var(--text-secondary);
  background: var(--primary-light);
}
.tab-item.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}

.tab-icon { font-size: 14px; }
.app-content { flex: 1; overflow: hidden; }

.fade-enter-active, .fade-leave-active { transition: opacity 60ms ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.fade-fast-enter-active, .fade-fast-leave-active { transition: opacity 30ms ease-out; }
.fade-fast-enter-from, .fade-fast-leave-to { opacity: 0; }

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
