<script setup lang="ts">
import { useUIStore } from '@/stores/ui'
import { useHistoryStore } from '@/stores/history'
import { escapeHtml } from '@/utils/helpers'

const ui = useUIStore()
const history = useHistoryStore()

async function confirmDelete() {
  if (ui.deleteTarget) {
    await history.deleteRecord(ui.deleteTarget)
    ui.notify('已删除记录')
  }
  ui.closeDeleteConfirm()
}
</script>

<template>
  <div class="modal-overlay" @click.self="ui.closeDeleteConfirm()">
    <div class="modal-content">
      <div class="modal-header">
        <h3>确认删除</h3>
      </div>
      <p class="modal-text">确定要删除这条历史记录吗？此操作不可撤销。</p>
      <div v-if="ui.deleteTarget" class="record-preview">
        <div class="preview-title">{{ ui.deleteTarget.title }}</div>
        <div class="preview-url">{{ ui.deleteTarget.url }}</div>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" @click="ui.closeDeleteConfirm()">取消</button>
        <button class="btn-danger" @click="confirmDelete()">删除</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 100; animation: fadeIn var(--transition-fast);
}
.modal-content {
  width: 320px; background: var(--app-surface); border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg); padding: 20px;
  animation: slideUp var(--transition-normal);
}
.modal-header h3 { font-size: 16px; font-weight: 600; margin: 0 0 12px; color: var(--text-primary); }
.modal-text { font-size: 13px; color: var(--text-secondary); margin: 0 0 12px; }

.record-preview {
  padding: 10px; background: var(--app-bg); border-radius: var(--radius-md);
  margin-bottom: 16px;
}
.preview-title { font-size: 13px; font-weight: 500; color: var(--text-primary); margin-bottom: 4px; word-break: break-all; }
.preview-url { font-size: 11px; color: var(--text-muted); word-break: break-all; }

.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
</style>
