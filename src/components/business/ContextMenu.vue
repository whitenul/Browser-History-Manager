<script setup lang="ts">
import { useUIStore } from '@/stores/ui'
import { useHistoryStore } from '@/stores/history'

const ui = useUIStore()
const history = useHistoryStore()

function handleAction(action: string) {
  const record = ui.contextMenuTarget
  if (!record) return
  switch (action) {
    case 'open': history.openRecord(record.url); break
    case 'newTab': chrome.tabs.create({ url: record.url, active: false }); break
    case 'copyUrl': navigator.clipboard.writeText(record.url); ui.notify('已复制链接', 'info'); break
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
        <span class="i-lucide:external-link ctx-icon" />打开链接
      </button>
      <button class="ctx-item" @click="handleAction('newTab')">
        <span class="i-lucide:plus-circle ctx-icon" />新标签页打开
      </button>
      <button class="ctx-item" @click="handleAction('copyUrl')">
        <span class="i-lucide:copy ctx-icon" />复制链接
      </button>
      <div class="ctx-divider" />
      <button class="ctx-item" @click="handleAction('favorite')">
        <span class="i-lucide:star ctx-icon" />切换收藏
      </button>
      <button class="ctx-item" @click="handleAction('tag')">
        <span class="i-lucide:tag ctx-icon" />管理标签
      </button>
      <button class="ctx-item" @click="handleAction('preview')">
        <span class="i-lucide:eye ctx-icon" />预览
      </button>
      <div class="ctx-divider" />
      <button class="ctx-item danger" @click="handleAction('delete')">
        <span class="i-lucide:trash-2 ctx-icon" />删除
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
