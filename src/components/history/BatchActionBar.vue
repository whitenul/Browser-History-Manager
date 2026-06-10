<script setup lang="ts">
import { useI18n } from '@/i18n'

const { t } = useI18n()

interface Props {
  selectedCount: number
}
defineProps<Props>()

const emit = defineEmits<{
  selectAll: []
  clearSelection: []
  delete: []
}>()
</script>

<template>
  <div class="batch-bar">
    <span class="batch-info">{{ t('history.selectedCount', { count: selectedCount }) }}</span>
    <button class="batch-btn" @click="$emit('selectAll')">{{ t('common.selectAll') }}</button>
    <button class="batch-btn" @click="$emit('clearSelection')">{{ t('common.cancel') }}</button>
    <button class="batch-btn danger" :disabled="!selectedCount" @click="$emit('delete')">{{ t('common.delete') }}</button>
  </div>
</template>

<style scoped>
@import '@/styles/batch-btn.css';

.batch-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px; background: var(--color-primary-light);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.batch-info { font-size: var(--fs-md); color: var(--color-primary); font-weight: 500; flex: 1; }
</style>
