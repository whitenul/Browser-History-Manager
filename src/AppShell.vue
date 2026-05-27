<script setup lang="ts">
import { onMounted, onUnmounted, computed, defineAsyncComponent, onErrorCaptured, ref } from 'vue'
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
const PageTocView = defineAsyncComponent(() => import('@/views/PageTocView.vue'))
const ThemeModal = defineAsyncComponent(() => import('@/components/business/ThemeModal.vue'))
const DeleteConfirmModal = defineAsyncComponent(() => import('@/components/business/DeleteConfirmModal.vue'))
const TagModal = defineAsyncComponent(() => import('@/components/business/TagModal.vue'))
const GroupRuleModal = defineAsyncComponent(() => import('@/components/business/GroupRuleModal.vue'))
const ContextMenu = defineAsyncComponent(() => import('@/components/business/ContextMenu.vue'))
const PreviewPanel = defineAsyncComponent(() => import('@/components/business/PreviewPanel.vue'))
const BookmarkPickerModal = defineAsyncComponent(() => import('@/components/business/BookmarkPickerModal.vue'))
const CommandPalette = defineAsyncComponent(() => import('@/components/business/CommandPalette.vue'))
const MiniBrowser = defineAsyncComponent(() => import('@/components/business/MiniBrowser.vue'))

import { useMiniBrowser } from '@/composables/useMiniBrowser'

const ui = useUIStore()
const groupStore = useTabGroupStore()
const optimizer = useTabOptimizerStore()
const theme = useThemeStore()
const history = useHistoryStore()
const { t } = useI18n()
const { enterBrowsingMode, exitBrowsingMode } = useMiniBrowser()

const isSidebar = document.location.pathname.includes('sidebar')

const hasError = ref(false)
const errorMessage = ref('')
onErrorCaptured((err) => {
  console.error('[AppShell] Component error:', err)
  hasError.value = true
  errorMessage.value = err instanceof Error ? err.message : String(err)
  return false
})

const starPositions = computed(() => {
  const arr: { x: number; y: number; size: number; duration: number; delay: number }[] = []
  for (let i = 0; i < 50; i++) {
    const isStatic = Math.random() < 0.3
    const size = isStatic ? 1 + Math.random() : 1 + Math.random() * 2
    arr.push({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size,
      duration: 2 + Math.random() * 4,
      delay: Math.random() * 5,
    })
  }
  return arr
})

const tabTitles: Record<string, string> = {
  tabs: t('nav.tabs'),
  history: t('nav.history'),
  stats: t('nav.stats'),
  bookmarks: t('nav.bookmarks'),
  toc: t('nav.toc'),
  settings: t('nav.settings'),
}

const headerTitle = computed(() => tabTitles[ui.activeTab] || (isSidebar ? t('nav.tabs') : t('nav.history')))

const allTabs = [
  { id: 'tabs' as const, label: t('nav.tabs'), icon: 'i-lucide:globe', sidebarOnly: true },
  { id: 'history' as const, label: t('nav.history'), icon: 'i-lucide:clock' },
  { id: 'toc' as const, label: t('nav.toc'), icon: 'i-lucide:list' },
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
  if (e.key === 'Escape' && ui.isBrowsingMode) {
    e.preventDefault()
    exitBrowsingMode()
  }
}
</script>

<template>
  <div v-if="hasError" class="error-boundary">
    <span class="i-lucide:alert-triangle error-icon" />
    <p class="error-text">{{ errorMessage || 'Something went wrong' }}</p>
    <button class="error-retry" @click="hasError = false; errorMessage = ''">Retry</button>
  </div>
  <div v-else :class="['app-shell', isSidebar ? 'app-shell--sidebar' : 'app-shell--popup', { 'has-gradient': theme.background.type === 'gradient', 'has-stars': theme.background.type === 'stars', 'has-aurora': theme.background.type === 'aurora', 'has-image': theme.background.type === 'image' }]" :style="{ '--gradient-bg': theme.background.type === 'gradient' ? theme.background.gradient : undefined }">
    <!-- Aurora background -->
    <div v-if="theme.background.type === 'aurora'" class="aurora-bg">
      <div class="aurora-blob" />
      <div class="aurora-blob" />
      <div class="aurora-blob" />
    </div>
    <!-- Star field background -->
    <div v-if="theme.background.type === 'stars'" class="star-field">
      <div v-for="i in 50" :key="i" class="star"
        :style="{
          left: starPositions[i-1]?.x + '%',
          top: starPositions[i-1]?.y + '%',
          width: starPositions[i-1]?.size + 'px',
          height: starPositions[i-1]?.size + 'px',
          '--duration': starPositions[i-1]?.duration + 's',
          animationDelay: starPositions[i-1]?.delay + 's',
        }"
      />
    </div>
    <!-- Gradient background -->
    <div v-if="theme.background.type === 'gradient'" class="gradient-bg" :style="{ background: theme.background.gradient }" />
    <!-- Image background -->
    <div v-if="theme.background.type === 'image'" class="bg-image-layer">
      <div class="bg-image" :style="{ backgroundImage: `url(${theme.background.imageUrl})`, backgroundSize: theme.background.size, filter: `blur(${theme.background.blur}px)`, opacity: theme.background.opacity }" />
      <div class="bg-overlay" :style="{ backgroundColor: theme.background.overlayColor, opacity: theme.background.overlayOpacity }" />
    </div>
    <!-- Noise overlay (for dark mode enhancement) -->
    <div v-if="theme.isDark && ['stars','aurora','image'].includes(theme.background.type)" class="noise-overlay" />
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
          <button class="btn-icon btn-ghost theme-toggle-btn" :title="t('theme.title')" @click="theme.toggleThemeModal()">
            <span class="i-lucide:palette" />
            <span :class="theme.isDark ? 'i-lucide:moon' : 'i-lucide:sun'" class="mode-indicator" />
          </button>
        </div>
        <div v-else class="shell-actions--compact">
          <!-- Tab tools: only show when on "页面" tab -->
          <template v-if="ui.activeTab === 'tabs'">
            <button :class="['action-btn', { active: groupStore.enabled }]" :title="groupStore.enabled ? 'Group ON' : 'Group OFF'"
              @click="groupStore.enabled ? groupStore.disableMode() : groupStore.enableMode()">
              <span class="i-lucide:layout-grid" />
            </button>
            <button :class="['action-btn', { active: ui.privacyMode }]" :title="ui.privacyMode ? 'Privacy ON' : 'Privacy OFF'"
              @click="ui.privacyMode = !ui.privacyMode; ui.savePrivacyMode()">
              <span class="i-lucide:eye-off" />
            </button>
            <button :class="['action-btn', { active: ui.showOptimizer }]" :title="ui.showOptimizer ? 'Optimizer ON' : 'Optimizer OFF'"
              @click="ui.showOptimizer = !ui.showOptimizer">
              <span class="i-lucide:zap" />
            </button>
          </template>
          <button class="action-btn" :title="t('commandPalette.placeholder')" @click="ui.showCommandPalette = true">
            <span class="i-lucide:terminal" />
          </button>
          <button class="action-btn" :title="t('theme.title')" @click="theme.toggleThemeModal()">
            <span :class="theme.isDark ? 'i-lucide:moon' : 'i-lucide:sun'" />
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
        </button>
      </nav>
    </header>

    <main :class="['shell-content', `shell-content--${ui.activeTab}`]">
      <Transition :name="ui.isNavigatingBack ? 'fade-fast' : 'fade'" mode="out-in">
        <TabManagerView v-if="ui.activeTab === 'tabs'" key="'tabs'" />
        <HistoryView v-else-if="ui.activeTab === 'history'" :key="'history'" />
        <StatsView v-else-if="ui.activeTab === 'stats'" :key="'stats'" />
        <BookmarksView v-else-if="ui.activeTab === 'bookmarks'" :key="'bookmarks'" />
        <PageTocView v-else-if="ui.activeTab === 'toc'" :key="'toc'" />
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

    <!-- Mini Browser Overlay (Sidebar only) -->
    <Teleport to="body">
      <Transition name="browser-overlay">
        <div v-if="ui.isBrowsingMode && isSidebar" class="browser-overlay">
          <MiniBrowser @close="exitBrowsingMode" />
        </div>
      </Transition>
    </Teleport>

    <!-- FAB Button (Sidebar only) -->
    <button
      v-if="isSidebar && !ui.isBrowsingMode"
      class="fab-browser"
      :title="t('browser.open')"
      @click="enterBrowsingMode"
    >
      <span class="i-lucide:globe" />
    </button>

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
.error-boundary {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  padding: 24px;
  color: var(--color-text-secondary);
}
.error-icon {
  font-size: 32px;
  color: var(--color-warning);
}
.error-text {
  font-size: 13px;
  text-align: center;
  max-width: 280px;
}
.error-retry {
  padding: 6px 16px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  color: var(--color-primary);
  cursor: pointer;
  transition: background var(--transition-hover);
}
.error-retry:hover {
  background: var(--color-primary-light);
}

.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: var(--color-bg-base);
  color: var(--color-text-primary);
  transition: background var(--transition-modal), color var(--transition-modal);
}

/* Atmospheric gradient for dark mode */
html.dark .app-shell::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background:
    radial-gradient(800px 600px at 80% 10%, rgba(124, 58, 237, 0.15), transparent 60%),
    radial-gradient(600px 500px at 10% 90%, rgba(6, 182, 212, 0.12), transparent 55%);
}

/* Stars/Aurora/Image mode: semi-transparent background so effects show through */
.app-shell.has-stars,
.app-shell.has-aurora,
.app-shell.has-image {
  background: rgba(var(--color-bg-surface-rgb), 0.85);
}

/* Ensure header and content sit above star field */
.app-shell > header,
.app-shell > main {
  position: relative;
  z-index: 1;
}

/* Gradient background layer */
.gradient-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

/* Image background layer */
.bg-image-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}
.bg-image {
  position: absolute;
  inset: -20px;
  background-position: center;
  background-repeat: no-repeat;
}
.bg-overlay {
  position: absolute;
  inset: 0;
}

/* ========== Popup Mode (原有行为完全保留) ========== */
.app-shell--popup {
  width: var(--app-width);
  height: var(--app-max-height);
}

.shell-header--popup {
  display: flex;
  flex-direction: column;
  background: var(--header-bg);
  color: var(--header-text);
  flex-shrink: 0;
  transition: background var(--transition-modal), color var(--transition-modal);
}

.app-shell--popup.has-gradient .shell-header--popup {
  background: var(--gradient-bg);
  color: var(--header-text);
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
  font-size: 16px; transition: all var(--transition-hover); flex-shrink: 0;
}
.btn-back:hover { background: var(--header-hover-bg); }
.shell-title {
  font-size: 16px; font-weight: 600; margin: 0;
  letter-spacing: -0.01em;
  transition: all var(--transition-hover);
}
.shell-count { font-size: 12px; opacity: 0.75; }

.shell-actions { display: flex; gap: 6px; }
.shell-actions .btn-icon {
  color: inherit; opacity: 0.8;
  width: 32px; height: 32px; font-size: 16px;
}
.shell-actions .btn-icon:hover { opacity: 1; background: var(--header-hover-bg); }
.shell-actions .btn-icon.active {
  color: var(--color-primary);
  background: var(--color-primary-light);
}

/* Theme toggle with mode indicator */
.theme-toggle-btn {
  position: relative;
}
.mode-indicator {
  position: absolute;
  top: 2px; right: 2px;
  font-size: 9px;
  opacity: 0.9;
  color: inherit;
  pointer-events: none;
}

.shell-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  flex-shrink: 0;
  transition: background var(--transition-modal), border-color var(--transition-modal);
}

.shell-tab {
  flex: 1 1 auto; display: flex; align-items: center; justify-content: center;
  gap: 5px; padding: 10px 8px; font-size: 12px; font-weight: 500;
  color: var(--color-text-muted);
  background: none; border: none; border-bottom: 2px solid transparent;
  cursor: pointer; transition: color var(--transition-hover), border-color var(--transition-hover), background-color var(--transition-hover);
  white-space: nowrap;
  will-change: color, border-color;
}
.shell-tab:hover {
  color: var(--color-text-secondary);
  background: var(--color-primary-light);
}
.shell-tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}
.tab-icon { font-size: 13px; }

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
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  font-size: 11px;
  cursor: pointer;
  transition: all var(--transition-hover);
}
.shell-tool:hover { background: var(--color-primary-light); }
.shell-tool.active { color: var(--color-primary); background: var(--color-primary-light); }

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
  background: var(--header-bg);
  color: var(--header-text);
  flex-shrink: 0;
  padding: 8px 16px 0;
  transition: background var(--transition-modal), color var(--transition-modal);
}

.app-shell--sidebar.has-gradient .shell-header--sidebar {
  background: var(--gradient-bg);
  color: var(--header-text);
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

.app-shell--sidebar .action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  font-size: 14px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: inherit;
  opacity: 0.8;
  transition: all var(--transition-hover);
}

.app-shell--sidebar .action-btn:hover {
  opacity: 1;
  background: var(--header-hover-bg);
}

.app-shell--sidebar .action-btn.active {
  color: var(--color-primary);
  background: var(--color-primary-light);
  opacity: 1;
}

.app-shell--sidebar .shell-tabs {
  margin-top: 6px;
}

.app-shell--sidebar .shell-tab {
  padding: 8px 2px;
  font-size: 12px;
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
  box-shadow: var(--shadow-lg); animation: slideUp var(--transition-modal);
}
.toast.success { background: var(--color-success); color: var(--color-text-inverse); }
.toast.error { background: var(--color-danger); color: var(--color-text-inverse); }
.toast.info { background: var(--color-info); color: var(--color-text-inverse); }

.undo-toast {
  display: flex; align-items: center; gap: 10px;
  background: var(--toast-bg); color: var(--toast-text);
  cursor: pointer; padding: 8px 12px;
}
.undo-btn {
  padding: 3px 10px; border: 1px solid var(--color-primary-light);
  border-radius: var(--radius-sm); background: var(--color-primary-light);
  color: var(--color-primary); font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all var(--transition-hover);
}
.undo-btn:hover { background: var(--color-primary); color: var(--color-text-inverse); }

.toast-enter-active { transition: all 200ms ease; }
.toast-leave-active { transition: all 300ms ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(10px); }

/* ========== Mini Browser Overlay ========== */
.browser-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9998;
  /* Transparent — MiniBrowser renders its own theme background layers internally */
  background: transparent;
}

.browser-overlay-enter-active,
.browser-overlay-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.browser-overlay-enter-from,
.browser-overlay-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* FAB Button */
.fab-browser {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: var(--color-primary);
  color: var(--color-text-inverse);
  font-size: 22px;
  cursor: pointer;
  z-index: 100;
  box-shadow: var(--shadow-fab);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-hover);
}
.fab-browser:hover {
  transform: scale(1.08);
  box-shadow: var(--shadow-fab-hover);
}
.fab-browser:active {
  transform: scale(0.95);
}
</style>
