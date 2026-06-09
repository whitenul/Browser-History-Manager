﻿﻿﻿﻿﻿<script setup lang="ts">
import { useUIStore } from '@/stores/ui'
import { useHistoryStore } from '@/stores/history'
import { escapeHtml } from '@/utils/helpers'
import { useI18n } from '@/i18n'

const ui = useUIStore()
const history = useHistoryStore()
const { t } = useI18n()

async function confirmDelete() {
  if (ui.deleteTarget) {
    await history.deleteRecord(ui.deleteTarget)
    ui.notify(t('deleteConfirm.deleted'))
  }
  ui.closeDeleteConfirm()
}
</script>

<template>
  <div class="modal-overlay" @click.self="ui.closeDeleteConfirm()">
    <div class="modal-content glass-panel">
      <div class="modal-header">
        <h3>{{ t('deleteConfirm.title') }}</h3>
      </div>
      <p class="modal-text">{{ t('deleteConfirm.recordMessage') }}</p>
      <div v-if="ui.deleteTarget" class="record-preview">
        <div class="preview-title">{{ ui.deleteTarget.title }}</div>
        <div class="preview-url">{{ ui.deleteTarget.url }}</div>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" @click="ui.closeDeleteConfirm()">{{ t('deleteConfirm.cancel') }}</button>
        <button class="btn-danger" @click="confirmDelete()">{{ t('deleteConfirm.delete') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: var(--color-bg-overlay);
  backdrop-filter: blur(var(--glass-blur));
  display: flex; align-items: center; justify-content: center;
  z-index: 100; animation: fadeIn var(--transition-hover);
}
.modal-content {
  width: 320px; border-radius: var(--radius-xl);
  box-shadow: var(--shadow-modal); padding: 20px;
  animation: slideUp var(--transition-modal);
}
.modal-header h3 { font-size: var(--fs-2xl); font-weight: 600; margin: 0 0 12px; color: var(--color-text-primary); }
.modal-text { font-size: var(--fs-lg); color: var(--color-text-secondary); margin: 0 0 12px; }

.record-preview {
  padding: 10px; background: var(--color-bg-base); border-radius: var(--radius-md);
  margin-bottom: 16px;
}
.preview-title { font-size: var(--fs-lg); font-weight: 500; color: var(--color-text-primary); margin-bottom: 4px; word-break: break-all; }
.preview-url { font-size: var(--fs-base); color: var(--color-text-muted); word-break: break-all; }

.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
.btn-secondary {
  padding: 7px 16px; font-size: var(--fs-md); font-weight: 500;
  color: var(--color-text-secondary); background: var(--color-bg-surface);
  border: 1px solid var(--color-border); border-radius: var(--radius-md);
  cursor: pointer; transition: all var(--transition-hover);
}
.btn-secondary:hover { border-color: var(--color-primary); color: var(--color-primary); }
</style>
