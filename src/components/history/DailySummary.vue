<template>
  <div class="daily-summary">
    <div class="summary-content">
      <span class="summary-item">
        <span class="i-lucide:eye summary-icon" />
        {{ t('history.todayVisits', { count: summary.count }) }}
      </span>
      <span v-if="summary.topDomain" class="summary-item">
        <span class="i-lucide:trophy summary-icon" />
        {{ t('stats.topSites') }} <strong>{{ summary.topDomain }}</strong> ({{ t('history.visitCountLabel', { count: summary.topDomainCount }) }})
      </span>
      <span class="summary-item">
        <span class="i-lucide:zap summary-icon" />
        {{ t('stats.productivity') }} <strong :style="{ color: summary.productivity >= 50 ? 'var(--color-success)' : 'var(--color-danger)' }">{{ summary.productivity }}{{ t('history.scoreUnit') }}</strong>
      </span>
    </div>
    <button class="summary-close" @click="$emit('close')">
      <span class="i-lucide:x" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '@/i18n'

interface Props {
  summary: {
    count: number
    topDomain: string
    topDomainCount: number
    productivity: number
  }
}

defineProps<Props>()
defineEmits<{
  close: []
}>()

const { t } = useI18n()
</script>

<style scoped>
.daily-summary {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px; background: var(--color-primary-light);
  border-bottom: 1px solid var(--color-border); flex-shrink: 0;
}
.summary-content {
  display: flex; align-items: center; gap: 12px; flex: 1;
  overflow-x: auto; white-space: nowrap;
}
.summary-item { font-size: var(--fs-base); color: var(--color-text-secondary); display: flex; align-items: center; gap: 3px; }
.summary-item strong { color: var(--color-text-primary); }
.summary-icon { font-size: var(--fs-md); color: var(--color-primary); }
.summary-close {
  width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; color: var(--color-text-muted);
  cursor: pointer; font-size: var(--fs-md); border-radius: var(--radius-sm); flex-shrink: 0;
}
.summary-close:hover { background: var(--color-primary-light); color: var(--color-text-secondary); }
</style>
