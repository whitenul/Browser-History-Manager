﻿﻿﻿﻿﻿<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useHistoryStore } from '@/stores/history'
import { useI18n } from '@/i18n'

const ui = useUIStore()
const history = useHistoryStore()
const { t } = useI18n()
const newTagName = ref('')
const newTagColor = ref('#4f46e5')

const isDuplicate = computed(() => {
  const name = newTagName.value.trim().toLowerCase()
  return name && history.customTags.some(t => t.name.toLowerCase() === name)
})

function addTag() {
  const name = newTagName.value.trim()
  if (!name || isDuplicate.value) return
  history.addTag(name, newTagColor.value)
  newTagName.value = ''
}

function toggleTag(tagId: string) {
  if (ui.tagModalTarget) {
    history.toggleRecordTag(ui.tagModalTarget, tagId)
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="ui.closeTagModal()">
    <div class="modal-content">
      <div class="modal-header">
        <h3>{{ t('tagModal.title') }}</h3>
        <button class="close-btn" @click="ui.closeTagModal()">
          <span class="i-lucide:x" />
        </button>
      </div>

      <div class="tag-list">
        <div v-if="!history.customTags.length" class="empty-hint">{{ t('tagModal.noTags') }}</div>
        <div v-for="tag in history.customTags" :key="tag.id" class="tag-row">
          <span class="tag-dot" :style="{ background: tag.color }" />
          <span class="tag-name">{{ tag.name }}</span>
          <button
            class="toggle-btn"
            :class="{ active: ui.tagModalTarget && (history.recordTagsMap[ui.tagModalTarget] || []).includes(tag.id) }"
            @click="toggleTag(tag.id)"
          >
            {{ ui.tagModalTarget && (history.recordTagsMap[ui.tagModalTarget] || []).includes(tag.id) ? t('tagModal.added') : t('tagModal.add') }}
          </button>
          <button class="remove-btn" @click="history.removeTag(tag.id)">
            <span class="i-lucide:trash-2" />
          </button>
        </div>
      </div>

      <div class="add-tag-form">
        <input v-model="newTagName" type="text" :placeholder="t('tagModal.newTagPlaceholder')" class="tag-input" maxlength="10"
          :class="{ error: isDuplicate }" @keydown.enter="addTag" />
        <input v-model="newTagColor" type="color" class="color-input" />
        <button class="btn-primary" @click="addTag" :disabled="!newTagName.trim() || !!isDuplicate">
          {{ isDuplicate ? t('tagModal.duplicate') : t('tagModal.add') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: var(--color-bg-overlay);
  display: flex; align-items: center; justify-content: center;
  z-index: 100; animation: fadeIn var(--transition-hover);
}
.modal-content {
  width: 340px; max-height: 400px; overflow-y: auto;
  background: var(--color-bg-surface); border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg); padding: 20px;
  animation: slideUp var(--transition-modal);
}

.modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.modal-header h3 { font-size: var(--fs-2xl); font-weight: 600; margin: 0; color: var(--color-text-primary); }
.close-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: none; background: transparent;
  border-radius: var(--radius-sm); cursor: pointer; color: var(--color-text-muted); font-size: var(--fs-2xl);
}
.close-btn:hover { background: var(--color-primary-light); }

.tag-list { margin-bottom: 16px; }
.empty-hint { font-size: var(--fs-lg); color: var(--color-text-muted); text-align: center; padding: 16px; }

.tag-row {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 0; border-bottom: 1px solid var(--color-border);
}
.tag-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.tag-name { flex: 1; font-size: var(--fs-lg); font-weight: 500; color: var(--color-text-primary); }
.toggle-btn {
  padding: 3px 10px; font-size: var(--fs-base); font-weight: 500;
  border: 1px solid var(--color-border); background: transparent;
  border-radius: var(--radius-sm); cursor: pointer; color: var(--color-text-muted);
  transition: all var(--transition-hover);
}
.toggle-btn.active { background: var(--color-primary-light); color: var(--color-primary); border-color: var(--color-primary); }
.remove-btn {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border: none; background: transparent;
  border-radius: var(--radius-sm); cursor: pointer; color: var(--color-text-muted); font-size: var(--fs-lg);
}
.remove-btn:hover { color: var(--color-danger); }

.add-tag-form { display: flex; gap: 6px; align-items: center; }
.tag-input {
  flex: 1; padding: 6px 10px; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); font-size: var(--fs-md); outline: none;
  background: var(--color-bg-surface); color: var(--color-text-primary);
}
.tag-input:focus { border-color: var(--color-primary); }
.tag-input.error { border-color: var(--color-danger); }
.color-input { width: 32px; height: 32px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); cursor: pointer; padding: 2px; background: var(--color-bg-surface); }
.btn-primary {
  padding: 6px 14px; border: none; border-radius: var(--radius-sm);
  background: var(--color-primary); color: var(--color-text-inverse); font-size: var(--fs-md); font-weight: 500;
  cursor: pointer; transition: all var(--transition-hover);
}
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-primary:not(:disabled):hover { opacity: 0.9; }
</style>
