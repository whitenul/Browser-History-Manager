<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useUIStore } from '@/stores/ui'
import { useI18n } from '@/i18n'
import type { HistoryRecord } from '@/utils/helpers'
import RecordItem from './RecordItem.vue'
import GroupHeader from './GroupHeader.vue'

interface Props {
  isLoading: boolean
  searchKeyword: string
  groupMode: string
  groupedResult: { order: string[]; groups: Record<string, HistoryRecord[]> } | null
  collapsedSet: Set<string>
  selectedRecords: Set<string>
  isSelectMode: boolean
  doubleClickMode: boolean
  focusedIndex: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  scroll: [event: Event]
  loadMore: []
  clearFilter: []
}>()

const history = useHistoryStore()
const ui = useUIStore()
const { t } = useI18n()

const recordListRef = ref<HTMLElement | null>(null)
const showScrollTop = ref(false)

const visibleRecords = computed(() => history.pagedRecords)
const showLoadMore = computed(() => history.pagedRecords.length < history.filteredRecords.length)

// 预构建 record.id -> index 的 Map，避免分组模式下 indexOf O(n) 查找
const recordIndexMap = computed(() => {
  const map = new Map<string, number>()
  for (let i = 0; i < visibleRecords.value.length; i++) {
    map.set(visibleRecords.value[i].id, i)
  }
  return map
})

function handleScroll(e: Event) {
  const el = e.target as HTMLElement
  showScrollTop.value = el.scrollTop > 300
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
    history.loadMore()
  }
  emit('scroll', e)
}

function handleRecordClick(record: HistoryRecord) {
  if (props.isSelectMode) {
    history.toggleSelectRecord(record.id)
  } else if (!props.doubleClickMode) {
    history.openRecord(record.url)
  }
}

function handleRecordDoubleClick(record: HistoryRecord) {
  if (!props.isSelectMode && props.doubleClickMode) {
    history.openRecord(record.url)
  }
}

function handleContextMenu(event: MouseEvent, record: HistoryRecord) {
  ui.openContextMenu(event.clientX, event.clientY, 'history', record)
}

function handleToggleGroup(groupKey: string) {
  history.toggleGroupCollapse(groupKey)
}

function handleRestoreSession(groupKey: string) {
  history.restoreSession(groupKey)
}

function handleClearFilter() {
  history.clearAllFilters()
  emit('clearFilter')
}

function scrollToTop() {
  const el = recordListRef.value
  if (el) el.scrollTo({ top: 0, behavior: 'smooth' })
}

function scrollToFocused() {
  nextTick(() => {
    const el = document.querySelector('.record-item.focused') as HTMLElement
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

defineExpose({ scrollToTop, scrollToFocused })
</script>

<template>
  <div class="record-list" ref="recordListRef" @scroll="handleScroll">
    <!-- 加载骨架屏 -->
    <div v-if="isLoading" class="loading-state">
      <div class="skeleton-list">
        <div v-for="i in 6" :key="i" class="skeleton-item">
          <div class="skeleton-avatar" />
          <div class="skeleton-lines">
            <div class="skeleton-line skeleton-line--title" />
            <div class="skeleton-line skeleton-line--meta" />
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!visibleRecords.length" class="empty-state">
      <span class="i-lucide:clock empty-icon" />
      <p>{{ t('history.noResults') }}</p>
      <button v-if="searchKeyword" class="empty-action" @click="handleClearFilter">
        <span class="i-lucide:x" /> {{ t('common.clearFilter') }}
      </button>
    </div>

    <!-- 记录列表 -->
    <template v-else>
      <!-- 分组模式 -->
      <template v-if="groupedResult">
        <template v-for="groupKey in groupedResult.order" :key="groupKey">
          <GroupHeader
            :group-key="groupKey"
            :group-mode="groupMode"
            :records="groupedResult.groups[groupKey]"
            :collapsed="collapsedSet.has(groupKey)"
            @toggle="handleToggleGroup(groupKey)"
            @restore="handleRestoreSession"
          />
          <template v-if="!collapsedSet.has(groupKey)">
            <RecordItem
              v-for="record in groupedResult.groups[groupKey]"
              :key="record.id"
              :record="record"
              :focused="recordIndexMap.get(record.id) === focusedIndex"
              :selected="selectedRecords.has(record.id)"
              :select-mode="isSelectMode"
              :search-keyword="searchKeyword"
              :double-click-mode="doubleClickMode"
              @click="handleRecordClick"
              @dblclick="handleRecordDoubleClick"
              @contextmenu="handleContextMenu"
            />
          </template>
        </template>
      </template>

      <!-- 非分组模式 -->
      <template v-else>
        <RecordItem
          v-for="(record, idx) in visibleRecords"
          :key="record.id"
          :record="record"
          :focused="idx === focusedIndex"
          :selected="selectedRecords.has(record.id)"
          :select-mode="isSelectMode"
          :search-keyword="searchKeyword"
          :double-click-mode="doubleClickMode"
          @click="handleRecordClick"
          @dblclick="handleRecordDoubleClick"
          @contextmenu="handleContextMenu"
        />
      </template>

      <!-- 加载更多 -->
      <div v-if="showLoadMore" class="load-more" @click="history.loadMore()">
        {{ t('history.loadMore') }}
      </div>
    </template>

    <!-- 回到顶部按钮 -->
    <Transition name="scroll-top-fade">
      <button v-if="showScrollTop" class="scroll-top-btn" @click="scrollToTop" :title="t('common.back')">
        <span class="i-lucide:arrow-up" />
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.record-list { flex: 1; overflow-y: auto; padding: 0; }

.loading-state, .empty-state {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 12px; padding: 48px 16px;
  color: var(--color-text-muted); font-size: var(--fs-lg);
}

.skeleton-list { width: 100%; padding: 0; }
.skeleton-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border-bottom: 1px solid var(--color-border);
}
.skeleton-avatar {
  width: 28px; height: 28px; border-radius: var(--radius-sm);
  background: var(--color-border); flex-shrink: 0;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}
.skeleton-lines { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.skeleton-line {
  height: 12px; border-radius: var(--radius-sm);
  background: var(--color-border);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}
.skeleton-line--title { width: 65%; }
.skeleton-line--meta { width: 40%; height: 10px; }
@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.empty-icon { font-size: 36px; opacity: 0.4; }

.empty-action {
  display: flex; align-items: center; gap: 4px;
  padding: 6px 14px; font-size: var(--fs-md); font-weight: 500;
  color: var(--color-primary); background: var(--color-primary-light);
  border: 1px solid var(--color-primary); border-radius: var(--radius-sm);
  cursor: pointer; transition: all var(--transition-hover);
}
.empty-action:hover { background: var(--color-primary); color: var(--color-text-inverse); }

.load-more {
  padding: 12px; text-align: center; font-size: var(--fs-md);
  color: var(--color-text-muted); cursor: pointer;
  transition: color var(--transition-hover);
}
.load-more:hover { color: var(--color-primary); }

.scroll-top-btn {
  position: sticky; bottom: 16px; float: right; margin-right: 12px;
  width: 32px; height: 32px; border-radius: 50%;
  border: 1px solid var(--color-border); background: var(--color-bg-surface);
  color: var(--color-text-muted); font-size: var(--fs-lg);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  box-shadow: var(--shadow-md); transition: all var(--transition-hover);
  z-index: 10;
}
.scroll-top-btn:hover { color: var(--color-primary); border-color: var(--color-primary); background: var(--color-primary-light); }
.scroll-top-fade-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.scroll-top-fade-leave-active { transition: opacity 0.15s ease; }
.scroll-top-fade-enter-from { opacity: 0; transform: scale(0.8); }
.scroll-top-fade-leave-to { opacity: 0; }
</style>
