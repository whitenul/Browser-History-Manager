<script setup lang="ts">
import { useUIStore } from '@/stores/ui'
import { useHistoryStore } from '@/stores/history'
import { safeOpenUrl } from '@/utils/helpers'
import { useI18n } from '@/i18n'

const ui = useUIStore()
const history = useHistoryStore()
const { t } = useI18n()

function handleAction(action: string) {
  const record = ui.contextMenuTarget
  if (!record) return
  switch (action) {
    case 'open': history.openRecord(record.url); break
    case 'newTab': safeOpenUrl(record.url, false); break
    case 'copyUrl': navigator.clipboard.writeText(record.url); ui.notify(t('contextMenu.copiedUrl'), 'info'); break
    case 'favorite': history.toggleFavorite(record.url); break
    case 'tag': ui.openTagModal(record.url); break
    case 'preview': ui.openPreview(record); break
    case 'delete': ui.openDeleteConfirm(record); break
  }
  ui.closeContextMenu()
}
</script>

<template>
  <div class="ctx-overlay" @click="ui.closeContextMenu()" @contextmenu.prevent="ui.closeContextMenu()">
    <div class="ctx-menu" :style="{ left: ui.contextMenuPos.x + 'px', top: ui.contextMenuPos.y + 'px' }" @click.stop>
      <button class="ctx-item" @click="handleAction('open')">
        <span class="i-lucide:external-link ctx-icon" />{{ t('contextMenu.openLink') }}
      </button>
      <button class="ctx-item" @click="handleAction('newTab')">
        <span class="i-lucide:plus-circle ctx-icon" />{{ t('contextMenu.openInNewTab') }}
      </button>
      <button class="ctx-item" @click="handleAction('copyUrl')">
        <span class="i-lucide:copy ctx-icon" />{{ t('contextMenu.copyUrl') }}
      </button>
      <div class="ctx-divider" />
      <button class="ctx-item" @click="handleAction('favorite')">
        <span class="i-lucide:star ctx-icon" />{{ t('contextMenu.toggleFavorite') }}
      </button>
      <button class="ctx-item" @click="handleAction('tag')">
        <span class="i-lucide:tag ctx-icon" />{{ t('contextMenu.manageTags') }}
      </button>
      <button class="ctx-item" @click="handleAction('preview')">
        <span class="i-lucide:eye ctx-icon" />{{ t('contextMenu.preview') }}
      </button>
      <div class="ctx-divider" />
      <button class="ctx-item danger" @click="handleAction('delete')">
        <span class="i-lucide:trash-2 ctx-icon" />{{ t('contextMenu.delete') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.ctx-overlay {
  position: fixed; inset: 0; z-index: 200;
}
.ctx-menu {
  position: fixed; min-width: 160px;
  background: var(--app-surface); border: 1px solid var(--border-color);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
  padding: 4px; animation: fadeIn 100ms ease;
}
.ctx-item {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 7px 12px; border: none;
  background: transparent; color: var(--text-primary);
  font-size: 12px; cursor: pointer; border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}
.ctx-item:hover { background: var(--primary-light); }
.ctx-item.danger { color: #ef4444; }
.ctx-item.danger:hover { background: rgba(239,68,68,0.1); }
.ctx-icon { font-size: 13px; color: var(--text-muted); }
.ctx-item.danger .ctx-icon { color: #ef4444; }
.ctx-divider { height: 1px; background: var(--border-color); margin: 4px 0; }
@keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
</style>
