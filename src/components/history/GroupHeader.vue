<script setup lang="ts">
import { computed } from 'vue'
import { formatTime, formatDateTime, getGroupLabel, getEntityForDomain } from '@/utils/helpers'
import type { HistoryRecord } from '@/utils/helpers'
import { useI18n } from '@/i18n'

const props = defineProps<{
  groupKey: string
  groupMode: string
  records: HistoryRecord[]
  collapsed: boolean
}>()

defineEmits<{
  toggle: []
  restore: [groupKey: string]
}>()

const { t } = useI18n()

const displayLabel = computed(() => {
  if (props.groupMode === 'session' && props.records?.length) {
    const first = props.records[0]
    const last = props.records[props.records.length - 1]
    return `${formatDateTime(first.lastVisitTime)} ~ ${formatTime(last.lastVisitTime, t)}`
  }
  return getGroupLabel(props.groupKey, t)
})

const entityName = computed(() => {
  if (props.groupMode === 'domain') {
    return getEntityForDomain(props.groupKey)?.names.zh
  }
  return undefined
})
</script>

<template>
  <div class="group-header" :class="{ collapsed }">
    <span class="group-chevron-wrap" @click="$emit('toggle')">
      <span class="i-lucide:chevron-down group-chevron" />
    </span>
    <span class="group-name" @click="$emit('toggle')">
      {{ displayLabel }}
    </span>
    <span v-if="groupMode === 'domain' && entityName" class="entity-badge">
      {{ entityName }}
    </span>
    <span class="group-count">{{ records.length }}</span>
    <button v-if="groupMode === 'session'" class="restore-btn"
      @click.stop="$emit('restore', groupKey)" :title="t('history.restoreSession')">
      <span class="i-lucide:rotate-ccw" />{{ t('common.restore') }}
    </button>
  </div>
</template>

<style scoped>
.group-header {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; background: var(--color-bg-base);
  border-bottom: 1px solid var(--color-border);
  cursor: pointer; font-size: var(--fs-md); font-weight: 600;
  color: var(--color-text-secondary); user-select: none;
  transition: background var(--transition-hover);
}
.group-header:hover { background: var(--color-primary-light); }
.group-chevron-wrap { display: flex; align-items: center; }
.group-name { flex: 1; }
.entity-badge {
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--color-primary);
  background: var(--color-primary-light);
  padding: 1px 6px;
  border-radius: var(--radius-md);
  white-space: nowrap;
  margin-right: 4px;
}
.group-count { font-size: var(--fs-base); font-weight: 400; color: var(--color-text-muted); }
.group-chevron { font-size: var(--fs-xl); transition: transform var(--transition-hover); }
.group-header.collapsed .group-chevron { transform: rotate(-90deg); }
.restore-btn {
  display: flex; align-items: center; gap: 3px;
  padding: 2px 8px; font-size: var(--fs-base); font-weight: 500;
  color: var(--color-primary); background: var(--color-primary-light);
  border: 1px solid var(--color-primary); border-radius: var(--radius-sm);
  cursor: pointer; transition: all var(--transition-hover);
}
.restore-btn:hover { background: var(--color-primary); color: var(--color-text-inverse); }
</style>
