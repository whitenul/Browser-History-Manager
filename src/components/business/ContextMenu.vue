<script setup lang="ts">
import { computed } from 'vue'
import { useUIStore, type ContextMenuTargetType } from '@/stores/ui'
import { useHistoryStore } from '@/stores/history'
import { useBookmarksStore } from '@/stores/bookmarks'
import { safeOpenUrl, autoTag } from '@/utils/helpers'
import { useI18n } from '@/i18n'

const ui = useUIStore()
const history = useHistoryStore()
const bookmarks = useBookmarksStore()
const { t } = useI18n()

const menuStyle = computed(() => {
  const menuWidth = 180, menuHeight = 360
  const x = Math.min(ui.contextMenuPos.x, window.innerWidth - menuWidth - 8)
  const y = Math.min(ui.contextMenuPos.y, window.innerHeight - menuHeight - 8)
  return { left: Math.max(4, x) + 'px', top: Math.max(4, y) + 'px' }
})

const targetType = computed<ContextMenuTargetType | null>(() => ui.contextMenuTarget?.type ?? null)

interface MenuItem {
  action: string
  icon: string
  label: string
  danger?: boolean
  dividerBefore?: boolean
}

const menuItems = computed<MenuItem[]>(() => {
  if (!ui.contextMenuTarget) return []
  const type = ui.contextMenuTarget.type

  if (type === 'history') {
    return [
      { action: 'open', icon: 'i-lucide:external-link', label: t('contextMenu.openLink') },
      { action: 'newTab', icon: 'i-lucide:plus-circle', label: t('contextMenu.openInNewTab') },
      { action: 'copyUrl', icon: 'i-lucide:copy', label: t('contextMenu.copyUrl') },
      { action: 'favorite', icon: 'i-lucide:star', label: t('contextMenu.toggleFavorite'), dividerBefore: true },
      { action: 'tag', icon: 'i-lucide:tag', label: t('contextMenu.manageTags') },
      { action: 'recategorize', icon: 'i-lucide:shuffle', label: t('contextMenu.recategorize') },
      { action: 'preview', icon: 'i-lucide:eye', label: t('contextMenu.preview') },
      { action: 'delete', icon: 'i-lucide:trash-2', label: t('contextMenu.delete'), danger: true, dividerBefore: true },
    ]
  }

  if (type === 'bookmark') {
    const node = ui.contextMenuTarget.data
    if (node.isFolder) {
      return [
        { action: 'bmOpenAll', icon: 'i-lucide:layout-grid', label: t('contextMenu.openAll') },
        { action: 'bmRename', icon: 'i-lucide:pencil', label: t('contextMenu.rename'), dividerBefore: true },
        { action: 'bmNewSubfolder', icon: 'i-lucide:folder-plus', label: t('contextMenu.newSubfolder') },
        { action: 'bmMove', icon: 'i-lucide:folder-input', label: t('contextMenu.moveTo') },
        { action: 'bmDelete', icon: 'i-lucide:trash-2', label: t('contextMenu.delete'), danger: true, dividerBefore: true },
      ]
    }
    return [
      { action: 'open', icon: 'i-lucide:external-link', label: t('contextMenu.openLink') },
      { action: 'newTab', icon: 'i-lucide:plus-circle', label: t('contextMenu.openInNewTab') },
      { action: 'copyUrl', icon: 'i-lucide:copy', label: t('contextMenu.copyUrl') },
      { action: 'bmRename', icon: 'i-lucide:pencil', label: t('contextMenu.rename'), dividerBefore: true },
      { action: 'bmMove', icon: 'i-lucide:folder-input', label: t('contextMenu.moveTo') },
      { action: 'bmDelete', icon: 'i-lucide:trash-2', label: t('contextMenu.delete'), danger: true, dividerBefore: true },
    ]
  }

  return []
})

function handleAction(action: string) {
  if (!ui.contextMenuTarget) return
  const { type, data } = ui.contextMenuTarget

  if (type === 'history') {
    handleHistoryAction(action, data)
  } else if (type === 'bookmark') {
    handleBookmarkAction(action, data)
  }

  ui.closeContextMenu()
}

function handleHistoryAction(action: string, record: any) {
  switch (action) {
    case 'open': history.openRecord(record.url); break
    case 'newTab': safeOpenUrl(record.url, false); break
    case 'copyUrl': navigator.clipboard.writeText(record.url); ui.notify(t('contextMenu.copiedUrl'), 'info'); break
    case 'favorite': history.toggleFavorite(record.url); break
    case 'tag': ui.openTagModal(record.url); break
    case 'preview': ui.openPreview(record); break
    case 'recategorize': {
      const currentTags = autoTag(record.url, record.title)
      if (currentTags.length > 0) ui.openTagModal(record.url)
      break
    }
    case 'delete': ui.openDeleteConfirm(record); break
  }
}

function handleBookmarkAction(action: string, node: any) {
  switch (action) {
    case 'open': safeOpenUrl(node.url); break
    case 'newTab': safeOpenUrl(node.url, false); break
    case 'copyUrl': navigator.clipboard.writeText(node.url); ui.notify(t('contextMenu.copiedUrl'), 'info'); break
    case 'bmOpenAll': openAllInFolder(node); break
    case 'bmRename': ui.openBookmarkEdit(node); break
    case 'bmNewSubfolder': ui.openNewFolder(node.id); break
    case 'bmMove': ui.openBookmarkMove(node); break
    case 'bmDelete': bookmarks.deleteBookmark(node.id); break
  }
}

function openAllInFolder(node: any) {
  if (!node.children) return
  for (const child of node.children) {
    if (child.url) safeOpenUrl(child.url, false)
    else if (child.isFolder) openAllInFolder(child)
  }
}
</script>

<template>
  <div class="ctx-overlay" @click="ui.closeContextMenu()" @contextmenu.prevent="ui.closeContextMenu()">
    <div class="ctx-menu" :style="menuStyle" @click.stop>
      <template v-for="item in menuItems" :key="item.action">
        <div v-if="item.dividerBefore" class="ctx-divider" />
        <button class="ctx-item" :class="{ danger: item.danger }" @click="handleAction(item.action)">
          <span :class="item.icon" class="ctx-icon" />{{ item.label }}
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.ctx-overlay {
  position: fixed; inset: 0; z-index: 200;
}
.ctx-menu {
  position: fixed; min-width: 160px;
  background: var(--color-bg-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
  padding: 4px; animation: fadeIn 100ms ease;
}
.ctx-item {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 7px 12px; border: none;
  background: transparent; color: var(--color-text-primary);
  font-size: var(--fs-md); cursor: pointer; border-radius: var(--radius-sm);
  transition: background var(--transition-hover);
}
.ctx-item:hover { background: var(--color-primary-light); }
.ctx-item.danger { color: var(--color-danger); }
.ctx-item.danger:hover { background: var(--color-danger-light); }
.ctx-icon { font-size: var(--fs-lg); color: var(--color-text-muted); }
.ctx-item.danger .ctx-icon { color: var(--color-danger); }
.ctx-divider { height: 1px; background: var(--color-border); margin: 4px 0; }
@keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
</style>
