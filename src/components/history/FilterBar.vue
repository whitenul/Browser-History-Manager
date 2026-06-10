<script setup lang="ts">
import { computed } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useUIStore } from '@/stores/ui'
import { useI18n } from '@/i18n'

const history = useHistoryStore()
const ui = useUIStore()
const { t } = useI18n()

const emit = defineEmits<{
  timeRangeChange: [value: string]
  groupModeChange: [value: string]
  sortModeChange: [value: string]
  expandTopGroups: []
  toggleSelectMode: []
  toggleBlacklist: []
}>()

const selectModeLabel = t('history.selectMode')
const expandTopGroupsTitle = t('history.expandTopGroups')
const groupRuleTitle = t('groupRule.title')

const timeOptions = computed(() => [
  { value: 'today', label: t('history.filter.today') },
  { value: '3days', label: t('history.filter.last3Days') },
  { value: 'week', label: t('history.filter.last7Days') },
  { value: 'month', label: t('history.filter.last30Days') },
  { value: 'all', label: t('history.filter.all') },
])

const groupOptions = computed(() => [
  { value: 'none', label: t('history.group.none') },
  { value: 'domain', label: t('history.group.domain') },
  { value: 'timeline', label: t('history.group.timeline') },
  { value: 'session', label: t('history.group.session') },
  { value: 'custom', label: t('history.group.custom') },
])

const sortOptions = computed(() => [
  { value: 'timeDesc', label: t('history.sort.timeDesc') },
  { value: 'timeAsc', label: t('history.sort.timeAsc') },
  { value: 'visitDesc', label: t('history.sort.visitsDesc') },
  { value: 'visitAsc', label: t('history.sort.visitsAsc') },
])

function handleTimeRangeChange(value: string) {
  history.setTimeRange(value)
  emit('timeRangeChange', value)
}

function handleGroupModeChange(value: string) {
  history.setGroupMode(value)
  emit('groupModeChange', value)
}

function handleSortModeChange(value: string) {
  history.setSortMode(value)
  emit('sortModeChange', value)
}

function handleExpandTopGroups() {
  history.expandTopGroups(3)
  emit('expandTopGroups')
}

function openGroupRuleModal() {
  ui.showGroupRuleModal = true
}
</script>

<template>
  <div class="filter-bar compact-all">
    <!-- 第一行：时间范围 + 分组模式 -->
    <div class="filter-row">
      <div class="filter-group">
        <button v-for="opt in timeOptions" :key="opt.value" class="filter-btn xs"
          :class="{ active: history.timeRange === opt.value }"
          @click="handleTimeRangeChange(opt.value)">
          {{ opt.label }}
        </button>
      </div>
      <div class="filter-divider" />
      <div class="filter-group">
        <button v-for="opt in groupOptions" :key="opt.value" class="filter-btn xs"
          :class="{ active: history.groupMode === opt.value }"
          @click="handleGroupModeChange(opt.value)">
          {{ opt.label }}
        </button>
        <button v-if="history.groupMode !== 'none'" class="filter-btn xs icon-only"
          :title="expandTopGroupsTitle" @click="handleExpandTopGroups">
          <span class="i-lucide:chevrons-down" />
        </button>
        <button v-if="history.groupMode === 'custom'" class="filter-btn xs icon-only"
          :title="groupRuleTitle" @click="openGroupRuleModal">
          <span class="i-lucide:settings-2" />
        </button>
      </div>
    </div>
    <!-- 第二行：排序 + 选择模式 + 黑名单 -->
    <div class="filter-row">
      <div class="filter-group">
        <button v-for="opt in sortOptions" :key="opt.value" class="filter-btn xs"
          :class="{ active: history.sortMode === opt.value }"
          @click="handleSortModeChange(opt.value)">
          {{ opt.label }}
        </button>
        <button class="filter-btn xs" :class="{ active: history.isSelectMode }" @click="emit('toggleSelectMode'); history.toggleSelectMode()">
          <span class="i-lucide:check-square" style="margin-right:2px;font-size:10px" />
          {{ selectModeLabel }}
        </button>
        <button v-if="history.blacklistedDomains.length" class="filter-btn xs"
          :class="{ active: false }" @click="$emit('toggleBlacklist')">
          <span class="i-lucide:ban" style="margin-right:2px;font-size:10px" />
          {{ history.blacklistedDomains.length }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filter-bar {
  padding: 4px 10px;
  border-bottom: 1px solid var(--color-border);
  overflow-x: auto;
  flex-shrink: 0;
}
.filter-bar.compact-all { padding: 4px 8px; }

.filter-row { display: flex; align-items: center; gap: 2px; }
.filter-row + .filter-row { margin-top: 2px; }

.filter-divider {
  width: 1px; height: 14px; background: var(--color-border);
  margin: 0 4px; flex-shrink: 0;
}

.filter-group { display: flex; gap: 2px; white-space: nowrap; }

.filter-btn {
  padding: 3px 8px; font-size: var(--fs-base); font-weight: 500;
  color: var(--color-text-muted); background: transparent;
  border: 1px solid transparent; border-radius: var(--radius-sm);
  cursor: pointer; transition: all var(--transition-hover);
}
.filter-btn:hover { background: var(--color-primary-light); color: var(--color-text-secondary); }
.filter-btn.active {
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-color: var(--color-primary);
  border-opacity: 0.3;
}

.filter-btn.xs { padding: 2px 6px; font-size: var(--fs-sm); display: flex; align-items: center; }
.filter-btn.icon-only { padding: 2px 4px; }
</style>
