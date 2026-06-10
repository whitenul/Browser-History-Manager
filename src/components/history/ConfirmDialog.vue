<template>
  <div class="confirm-overlay" @click.self="$emit('cancel')">
    <div class="confirm-dialog">
      <div class="confirm-title">{{ title }}</div>
      <div class="confirm-text">{{ message }}</div>
      <div class="confirm-actions">
        <button class="batch-btn" @click="$emit('cancel')">{{ t('common.cancel') }}</button>
        <button class="batch-btn danger" @click="$emit('confirm')">{{ t('common.confirm') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '@/i18n'

const { t } = useI18n()

defineProps<{
  title: string
  message: string
}>()

defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<style scoped>
@import '@/styles/batch-btn.css';

.confirm-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-bg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  animation: confirm-overlay-in 0.15s ease;
}
@keyframes confirm-overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.confirm-dialog {
  width: 280px;
  background: var(--color-bg-surface);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  padding: 20px;
  animation: confirm-dialog-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes confirm-dialog-in {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

.confirm-title {
  font-size: var(--fs-xl);
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 8px;
}
.confirm-text {
  font-size: var(--fs-md);
  color: var(--color-text-secondary);
  margin-bottom: 16px;
  line-height: 1.5;
}
.confirm-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
