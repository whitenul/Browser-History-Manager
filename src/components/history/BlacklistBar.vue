<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '@/i18n'

const { t } = useI18n()

interface Props {
  blacklistedDomains: string[]
}
defineProps<Props>()

const emit = defineEmits<{
  addDomain: [domain: string]
  removeDomain: [domain: string]
}>()

const newDomain = ref('')

function handleAdd() {
  const trimmed = newDomain.value.trim()
  if (trimmed) {
    emit('addDomain', trimmed)
    newDomain.value = ''
  }
}
</script>

<template>
  <div class="blacklist-bar">
    <div class="blacklist-form">
      <input v-model="newDomain" type="text" :placeholder="t('settings.blacklistPlaceholder')" class="blacklist-input"
        @keydown.enter="handleAdd" />
      <button class="batch-btn" @click="handleAdd">{{ t('common.add') }}</button>
    </div>
    <div class="blacklist-tags">
      <span v-for="d in blacklistedDomains" :key="d" class="blacklist-tag">
        {{ d }}
        <button class="tag-remove" @click="$emit('removeDomain', d)">&times;</button>
      </span>
    </div>
  </div>
</template>

<style scoped>
@import '@/styles/batch-btn.css';

.blacklist-bar {
  padding: 8px 12px; background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border); flex-shrink: 0;
}
.blacklist-form { display: flex; gap: 6px; margin-bottom: 6px; }
.blacklist-input {
  flex: 1; padding: 5px 8px; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); font-size: var(--fs-md); outline: none;
  background: var(--color-bg-base); color: var(--color-text-primary);
}
.blacklist-input:focus { border-color: var(--color-primary); }
.blacklist-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.blacklist-tag {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; font-size: var(--fs-base); color: var(--color-text-secondary);
  background: var(--color-primary-light); border-radius: var(--radius-lg);
}
.tag-remove {
  border: none; background: none; cursor: pointer;
  color: var(--color-text-muted); font-size: var(--fs-lg); line-height: 1; padding: 0;
}
.tag-remove:hover { color: var(--color-danger); }
</style>
