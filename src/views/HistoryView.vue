<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useUIStore } from '@/stores/ui'
import { useI18n } from '@/i18n'
import { useKeyboardNavigation } from '@/composables/useKeyboardNavigation'
import { useDailySummary } from '@/composables/useDailySummary'

import SearchBar from '@/components/history/SearchBar.vue'
import FilterBar from '@/components/history/FilterBar.vue'
import BatchActionBar from '@/components/history/BatchActionBar.vue'
import RecordList from '@/components/history/RecordList.vue'
import DailySummary from '@/components/history/DailySummary.vue'
import BlacklistBar from '@/components/history/BlacklistBar.vue'
import TagBar from '@/components/history/TagBar.vue'
import ConfirmDialog from '@/components/history/ConfirmDialog.vue'

const history = useHistoryStore()
const ui = useUIStore()
const { t } = useI18n()

// 本地状态
const showBlacklist = ref(false)
const showDailySummary = ref(true)
const batchDeleteConfirm = ref(false)

// 键盘导航
const { focusedIndex, resetFocusedIndex } = useKeyboardNavigation(computed(() => history.pagedRecords))

// 每日摘要（带缓存）
const { dailySummary } = useDailySummary()

// 监听分组模式变化
watch(() => history.groupMode, (mode) => {
  if (mode === 'custom') {
    ui.showGroupRuleModal = true
  }
})

// 生命周期
onMounted(() => {
  const savedScroll = ui.getScrollPosition('history')
  if (savedScroll > 0) {
    nextTick(() => {
      const el = document.querySelector('.record-list') as HTMLElement
      if (el) el.scrollTop = savedScroll
    })
  }
  ui.loadDoubleClickMode()
})

// 事件处理
function handleSearch() {
  resetFocusedIndex()
}

function handleClearFilter() {
  resetFocusedIndex()
}

function handleBatchDeleteConfirm() {
  history.deleteRecords(history.filteredRecords.filter(r => history.selectedRecords.has(r.id)))
  batchDeleteConfirm.value = false
  resetFocusedIndex()
}
</script>

<template>
  <div class="history-view">
    <!-- 搜索栏 -->
    <SearchBar @search="handleSearch" @clear="handleClearFilter" />

    <!-- 活跃过滤器提示 -->
    <div v-if="history.hasActiveFilter" class="active-filter-bar">
      <span class="filter-indicator">
        <span class="i-lucide:filter filter-indicator-icon" />
        {{ history.searchKeyword ? t('history.searchLabel', { keyword: history.activeFilterLabel }) : history.activeFilterLabel }}
      </span>
      <span class="filter-count">{{ history.filteredRecords.length }} {{ t('history.recordsCount', { count: '' }).replace('{count}', '').trim() }}</span>
      <button class="filter-clear-btn" @click="handleClearFilter">
        <span class="i-lucide:x" /> {{ t('common.clearFilter') }}
      </button>
    </div>

    <!-- 每日摘要 -->
    <DailySummary
      v-if="showDailySummary && dailySummary.count > 0"
      :summary="dailySummary"
      @close="showDailySummary = false"
    />

    <!-- 过滤栏 -->
    <FilterBar @toggle-blacklist="showBlacklist = !showBlacklist" />

    <!-- 批量操作栏 -->
    <BatchActionBar
      v-if="history.isSelectMode"
      :selected-count="history.selectedRecords.size"
      @select-all="history.selectAll()"
      @clear-selection="history.clearSelection()"
      @delete="batchDeleteConfirm = true"
    />

    <!-- 黑名单管理栏 -->
    <BlacklistBar
      v-if="showBlacklist"
      :blacklisted-domains="history.blacklistedDomains"
      @add-domain="history.addBlacklistDomain($event)"
      @remove-domain="history.removeBlacklistDomain($event)"
    />

    <!-- 标签过滤栏 -->
    <TagBar
      v-if="history.customTags.length"
      :tags="history.customTags"
      :active-tag-id="history.activeTagId"
      @select-tag="history.activeTagId = $event"
    />

    <!-- 自定义分组引导 -->
    <div v-if="history.groupMode === 'custom' && !history.customRules.length" class="custom-guide">
      <span class="i-lucide:lightbulb guide-icon" />
      <span>{{ t('history.customGroupGuide') }}</span>
      <button class="guide-btn" @click="ui.showGroupRuleModal = true">
        <span class="i-lucide:settings-2" />{{ t('groupRule.title') }}
      </button>
    </div>

    <!-- 记录列表 -->
    <RecordList
      ref="recordListRef"
      :is-loading="history.isLoading"
      :search-keyword="history.searchKeyword"
      :group-mode="history.groupMode"
      :grouped-result="history.groupedResult"
      :collapsed-set="history.collapsedSet"
      :selected-records="history.selectedRecords"
      :is-select-mode="history.isSelectMode"
      :double-click-mode="ui.doubleClickMode"
      :focused-index="focusedIndex"
      @clear-filter="handleClearFilter"
    />

    <!-- 批量删除确认对话框 -->
    <ConfirmDialog
      v-if="batchDeleteConfirm"
      :title="t('deleteConfirm.title')"
      :message="t('history.deleteConfirm', { count: history.selectedRecords.size })"
      @confirm="handleBatchDeleteConfirm"
      @cancel="batchDeleteConfirm = false"
    />
  </div>
</template>

<style scoped>
.history-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.active-filter-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; margin: 0 0 6px;
  background: var(--color-primary-light); border: 1px solid var(--color-primary);
  border-radius: var(--radius-md); font-size: var(--fs-base);
}
.filter-indicator {
  display: flex; align-items: center; gap: 4px;
  color: var(--color-primary); font-weight: 600;
}
.filter-indicator-icon { font-size: var(--fs-md); }
.filter-count { color: var(--color-text-muted); font-size: var(--fs-sm); }
.filter-clear-btn {
  margin-left: auto; display: flex; align-items: center; gap: 3px;
  padding: 2px 8px; border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm); background: transparent;
  color: var(--color-primary); font-size: var(--fs-sm); font-weight: 500;
  cursor: pointer; transition: all var(--transition-hover);
}
.filter-clear-btn:hover { background: var(--color-primary-light); }

.custom-guide {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; margin: 8px 12px;
  background: var(--color-primary-light); border: 1px solid var(--color-primary);
  border-radius: var(--radius-md); font-size: var(--fs-md); color: var(--color-text-secondary);
}
.guide-icon { font-size: var(--fs-2xl); color: var(--color-warning); flex-shrink: 0; }
.guide-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 12px; border: 1px solid var(--color-primary); border-radius: var(--radius-sm);
  background: var(--color-primary-light); color: var(--color-primary); font-size: var(--fs-base);
  cursor: pointer; font-weight: 500; transition: all var(--transition-hover);
  margin-left: auto; flex-shrink: 0;
}
.guide-btn:hover { background: var(--color-primary); color: var(--color-text-inverse); }
</style>
