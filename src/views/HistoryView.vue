<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch, onUnmounted } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useUIStore } from '@/stores/ui'
import { useStatsStore } from '@/stores/stats'
import { useReadingQueueStore } from '@/stores/readingQueue'
import { formatTime, formatDateTime, getFaviconUrl, highlightText, getGroupLabel, autoTag, TAG_COLORS, onFaviconError, getEntityForDomain } from '@/utils/helpers'
import type { HistoryRecord } from '@/utils/helpers'
import { useI18n } from '@/i18n'

const history = useHistoryStore()
const ui = useUIStore()
const stats = useStatsStore()
const readingQueue = useReadingQueueStore()
const { t } = useI18n()

const searchInput = ref('')
const recordListRef = ref<HTMLElement | null>(null)
const focusedIndex = ref(-1)
const showBlacklist = ref(false)
const newBlacklistDomain = ref('')
const showDailySummary = ref(true)
const batchDeleteConfirm = ref(false)
const showScrollTop = ref(false)

watch(() => history.searchKeyword, (v) => {
  searchInput.value = v
}, { immediate: true })

const dailySummary = computed(() => {
  const today = new Date()
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const todayRecords = history.allRecords.filter(r => r.lastVisitTime >= startOfDay)
  const domainMap = new Map<string, number>()
  todayRecords.forEach(r => domainMap.set(r.domain, (domainMap.get(r.domain) || 0) + 1))
  const topDomain = Array.from(domainMap.entries()).sort((a, b) => b[1] - a[1])[0]
  return {
    count: todayRecords.length,
    topDomain: topDomain ? topDomain[0] : '',
    topDomainCount: topDomain ? topDomain[1] : 0,
    productivity: stats.productivity.score,
  }
})

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

const visibleRecords = computed(() => history.pagedRecords)
const showLoadMore = computed(() => history.pagedRecords.length < history.filteredRecords.length)
const selectedCount = computed(() => history.selectedRecords.size)

function onSearch(e: Event) {
  const val = (e.target as HTMLInputElement).value
  history.setSearch(val)
}

function onContextMenu(e: MouseEvent, record: HistoryRecord) {
  e.preventDefault()
  ui.openContextMenu(e.clientX, e.clientY, 'history', record)
}

function getSessionLabel(key: string, records?: HistoryRecord[]): string {
  if (!records?.length) return key
  const first = records[0]
  const last = records[records.length - 1]
  const start = formatDateTime(first.lastVisitTime)
  const end = formatTime(last.lastVisitTime, t)
  return `${start} ~ ${end}`
}

function onRecordAction(record: HistoryRecord, action: string) {
  switch (action) {
    case 'open': history.openRecord(record.url); break
    case 'favorite': ui.openBookmarkPicker(record); break
    case 'delete': ui.openDeleteConfirm(record); break
    case 'tag': ui.openTagModal(record.url); break
  }
}

function onScroll(e: Event) {
  const el = e.target as HTMLElement
  showScrollTop.value = el.scrollTop > 300
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
    history.loadMore()
  }
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

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault()
    const input = document.querySelector('.search-input') as HTMLInputElement
    input?.focus()
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    focusedIndex.value = Math.min(focusedIndex.value + 1, visibleRecords.value.length - 1)
    scrollToFocused()
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    focusedIndex.value = Math.max(focusedIndex.value - 1, 0)
    scrollToFocused()
  }
  if (e.key === 'Enter' && focusedIndex.value >= 0) {
    const record = visibleRecords.value[focusedIndex.value]
    if (record) history.openRecord(record.url)
  }
  if (e.key === 'Delete' && focusedIndex.value >= 0) {
    const record = visibleRecords.value[focusedIndex.value]
    if (record) ui.openDeleteConfirm(record)
  }
}

watch(() => history.groupMode, (mode) => {
  if (mode === 'custom') {
    ui.showGroupRuleModal = true
  }
})

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  const savedScroll = ui.getScrollPosition('history')
  if (savedScroll > 0) {
    nextTick(() => {
      const el = document.querySelector('.record-list') as HTMLElement
      if (el) el.scrollTop = savedScroll
    })
  }
  ui.loadDoubleClickMode()
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="history-view">
    <div class="search-bar">
      <span class="i-lucide:search search-icon" />
      <input
        v-model="searchInput"
        type="text"
        class="search-input"
        :placeholder="t('history.searchPlaceholder')"
        @input="onSearch"
      />
      <button class="cmd-trigger" @click="ui.showCommandPalette = true" :title="t('commandPalette.placeholder')">
        <span class="i-lucide:terminal" />
      </button>
      <button v-if="searchInput" class="clear-btn" @click="searchInput = ''; history.setSearchImmediate('')">
        <span class="i-lucide:x" />
      </button>
    </div>

    <div v-if="history.hasActiveFilter" class="active-filter-bar">
      <span class="filter-indicator">
        <span class="i-lucide:filter filter-indicator-icon" />
        {{ history.searchKeyword ? t('history.searchLabel', { keyword: history.activeFilterLabel }) : history.activeFilterLabel }}
      </span>
      <span class="filter-count">{{ history.filteredRecords.length }} {{ t('history.recordsCount', { count: '' }).replace('{count}', '').trim() }}</span>
      <button class="filter-clear-btn" @click="history.clearAllFilters(); searchInput = ''">
        <span class="i-lucide:x" /> {{ t('common.clearFilter') }}
      </button>
    </div>

    <div v-if="showDailySummary && dailySummary.count > 0" class="daily-summary">
      <div class="summary-content">
        <span class="summary-item">
          <span class="i-lucide:eye summary-icon" />
          {{ t('history.todayVisits', { count: dailySummary.count }) }}
        </span>
        <span v-if="dailySummary.topDomain" class="summary-item">
          <span class="i-lucide:trophy summary-icon" />
          {{ t('stats.topSites') }} <strong>{{ dailySummary.topDomain }}</strong> ({{ t('history.visitCountLabel', { count: dailySummary.topDomainCount }) }})
        </span>
        <span class="summary-item">
          <span class="i-lucide:zap summary-icon" />
          {{ t('stats.productivity') }} <strong :style="{ color: dailySummary.productivity >= 50 ? 'var(--color-success)' : 'var(--color-danger)' }">{{ dailySummary.productivity }}{{ t('history.scoreUnit') }}</strong>
        </span>
      </div>
      <button class="summary-close" @click="showDailySummary = false">
        <span class="i-lucide:x" />
      </button>
    </div>

    <div class="filter-bar compact-all">
      <div class="filter-row">
        <div class="filter-group">
          <button
            v-for="opt in timeOptions"
            :key="opt.value"
            class="filter-btn xs"
            :class="{ active: history.timeRange === opt.value }"
            @click="history.setTimeRange(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
        <div class="filter-divider" />
        <div class="filter-group">
          <button
            v-for="opt in groupOptions"
            :key="opt.value"
            class="filter-btn xs"
            :class="{ active: history.groupMode === opt.value }"
            @click="history.setGroupMode(opt.value)"
          >
            {{ opt.label }}
          </button>
          <button
            v-if="history.groupMode !== 'none'"
            class="filter-btn xs icon-only"
            :title="t('history.expandTopGroups')"
            @click="history.expandTopGroups(3)"
          >
            <span class="i-lucide:chevrons-down" />
          </button>
          <button
            v-if="history.groupMode === 'custom'"
            class="filter-btn xs icon-only"
            :title="t('groupRule.title')"
            @click="ui.showGroupRuleModal = true"
          >
            <span class="i-lucide:settings-2" />
          </button>
        </div>
      </div>
      <div class="filter-row">
        <div class="filter-group">
          <button
            v-for="opt in sortOptions"
            :key="opt.value"
            class="filter-btn xs"
            :class="{ active: history.sortMode === opt.value }"
            @click="history.setSortMode(opt.value)"
          >
            {{ opt.label }}
          </button>
          <button
            class="filter-btn xs"
            :class="{ active: history.isSelectMode }"
            @click="history.toggleSelectMode()"
          >
            <span class="i-lucide:check-square" style="margin-right:2px;font-size:10px" />
            {{ t('history.selectMode') }}
          </button>
          <button
            v-if="history.blacklistedDomains.length"
            class="filter-btn xs"
            :class="{ active: showBlacklist }"
            @click="showBlacklist = !showBlacklist"
          >
            <span class="i-lucide:ban" style="margin-right:2px;font-size:10px" />
            {{ history.blacklistedDomains.length }}
          </button>
        </div>
      </div>
    </div>

    <div class="batch-bar" v-if="history.isSelectMode">
      <span class="batch-info">{{ t('history.selectedCount', { count: selectedCount }) }}</span>
      <button class="batch-btn" @click="history.selectAll()">{{ t('common.selectAll') }}</button>
      <button class="batch-btn" @click="history.clearSelection()">{{ t('common.cancel') }}</button>
      <button class="batch-btn danger" :disabled="!selectedCount" @click="batchDeleteConfirm = true">{{ t('common.delete') }}</button>
    </div>

    <div class="blacklist-bar" v-if="showBlacklist">
      <div class="blacklist-form">
        <input v-model="newBlacklistDomain" type="text" :placeholder="t('settings.blacklistPlaceholder')" class="blacklist-input"
          @keydown.enter="if(newBlacklistDomain.trim()){history.addBlacklistDomain(newBlacklistDomain.trim());newBlacklistDomain=''}" />
        <button class="batch-btn" @click="if(newBlacklistDomain.trim()){history.addBlacklistDomain(newBlacklistDomain.trim());newBlacklistDomain=''}">{{ t('common.add') }}</button>
      </div>
      <div class="blacklist-tags">
        <span v-for="d in history.blacklistedDomains" :key="d" class="blacklist-tag">
          {{ d }}
          <button class="tag-remove" @click="history.removeBlacklistDomain(d)">&times;</button>
        </span>
      </div>
    </div>

    <div class="tag-bar" v-if="history.customTags.length">
      <button
        class="tag-chip"
        :class="{ active: !history.activeTagId }"
        @click="history.activeTagId = null"
      >
        {{ t('common.all') }}
      </button>
      <button
        v-for="tag in history.customTags"
        :key="tag.id"
        class="tag-chip"
        :class="{ active: history.activeTagId === tag.id }"
        :style="{ '--tag-color': tag.color }"
        @click="history.activeTagId = history.activeTagId === tag.id ? null : tag.id"
      >
        {{ tag.name }}
      </button>
    </div>

    <div v-if="history.groupMode === 'custom' && !history.customRules.length" class="custom-guide">
      <span class="i-lucide:lightbulb guide-icon" />
      <span>{{ t('history.customGroupGuide') }}</span>
      <button class="guide-btn" @click="ui.showGroupRuleModal = true">
        <span class="i-lucide:settings-2" />{{ t('groupRule.title') }}
      </button>
    </div>

    <div v-if="batchDeleteConfirm" class="confirm-overlay" @click.self="batchDeleteConfirm = false">
      <div class="confirm-dialog">
        <div class="confirm-title">{{ t('deleteConfirm.title') }}</div>
        <div class="confirm-text">{{ t('history.deleteConfirm', { count: selectedCount }) }}</div>
        <div class="confirm-actions">
          <button class="batch-btn" @click="batchDeleteConfirm = false">{{ t('common.cancel') }}</button>
          <button class="batch-btn danger" @click="history.deleteRecords(history.filteredRecords.filter(r => history.selectedRecords.has(r.id))); batchDeleteConfirm = false">{{ t('common.confirm') }}</button>
        </div>
      </div>
    </div>

    <div class="record-list" ref="recordListRef" @scroll="onScroll">
      <div v-if="history.isLoading" class="loading-state">
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

      <div v-else-if="!visibleRecords.length" class="empty-state">
        <span class="i-lucide:clock empty-icon" />
        <p v-if="history.searchKeyword">{{ t('history.noResults') }}</p>
        <p v-else>{{ t('history.noResults') }}</p>
        <button v-if="history.searchKeyword" class="empty-action" @click="history.clearAllFilters(); searchInput = ''">
          <span class="i-lucide:x" /> {{ t('common.clearFilter') }}
        </button>
      </div>

      <template v-else>
        <template v-if="history.groupedResult">
          <template v-for="groupKey in history.groupedResult.order" :key="groupKey">
            <div
              class="group-header"
              :class="{ collapsed: history.collapsedSet.has(groupKey) }"
            >
              <span class="group-chevron-wrap" @click="history.toggleGroupCollapse(groupKey)">
                <span class="i-lucide:chevron-down group-chevron" />
              </span>
              <span class="group-name" @click="history.toggleGroupCollapse(groupKey)">
                {{ history.groupMode === 'session' ? getSessionLabel(groupKey, history.groupedResult.groups[groupKey]) : getGroupLabel(groupKey, t) }}
              </span>
              <span v-if="history.groupMode === 'domain' && getEntityForDomain(groupKey)" class="entity-badge">
                {{ getEntityForDomain(groupKey)!.names.zh }}
              </span>
              <span class="group-count">{{ history.groupedResult.groups[groupKey]?.length || 0 }}</span>
              <button v-if="history.groupMode === 'session'" class="restore-btn" @click.stop="history.restoreSession(groupKey)" :title="t('history.restoreSession')">
                <span class="i-lucide:rotate-ccw" />{{ t('common.restore') }}
              </button>
            </div>
            <template v-if="!history.collapsedSet.has(groupKey)">
              <div
                v-for="record in history.groupedResult.groups[groupKey]"
                :key="record.id"
                class="record-item"
                :class="{ focused: visibleRecords.indexOf(record) === focusedIndex, selected: history.selectedRecords.has(record.id) }"
                :title="record.title"
                @contextmenu="onContextMenu($event, record)"
              >
                <label v-if="history.isSelectMode" class="select-check" @click.stop="history.toggleSelectRecord(record.id)">
                  <input type="checkbox" :checked="history.selectedRecords.has(record.id)" />
                </label>
                <div class="record-favicon">
                  <img :src="getFaviconUrl(record.url)" alt="" class="favicon-img"
                    @error="onFaviconError($event, record.url)" />
                </div>
                <div class="record-info" @click="history.isSelectMode ? history.toggleSelectRecord(record.id) : (!ui.doubleClickMode ? history.openRecord(record.url) : undefined)" @dblclick="!history.isSelectMode && ui.doubleClickMode ? history.openRecord(record.url) : undefined">
                  <div class="record-title" v-html="highlightText(record.title, history.searchKeyword)" />
                  <div class="record-meta">
                    <span v-html="highlightText(record.domain, history.searchKeyword)" />
                    <span class="meta-dot">·</span>
                    <span>{{ formatTime(record.lastVisitTime, t) }}</span>
                    <span v-if="record.visitCount > 1" class="meta-dot">·</span>
                    <span v-if="record.visitCount > 1">{{ t('history.visitCountLabel', { count: record.visitCount }) }}</span>
                  </div>
                  <div v-if="record.tags?.length" class="auto-tags">
                    <span v-for="tag in record.tags" :key="tag" class="auto-tag"
                      :style="{ backgroundColor: (TAG_COLORS[tag] || 'var(--color-text-muted)') + '18', color: TAG_COLORS[tag] || 'var(--color-text-muted)' }">
                      {{ t('tags.' + tag) }}
                    </span>
                  </div>
                </div>
                <div class="record-actions" v-if="!history.isSelectMode">
                  <button
                    class="action-btn"
                    :class="{ 'queue-active': readingQueue.isInQueue(record.url) }"
                    :title="readingQueue.isInQueue(record.url) ? t('readingQueue.removeFromQueue') : t('readingQueue.addToQueue')"
                    @click.stop="readingQueue.toggleQueue(record.url, record.title, record.domain, record.tags || [])"
                  >
                    <span :class="readingQueue.isInQueue(record.url) ? 'i-lucide:bookmark-check' : 'i-lucide:clock'" />
                  </button>
                  <button
                    class="action-btn bookmark-btn"
                    :title="t('preview.addToBookmarks')"
                    @click.stop="ui.openBookmarkPicker(record)"
                  >
                    <span class="i-lucide:bookmark-plus" />
                  </button>
                  <button class="action-btn" :title="t('common.open')" @click.stop="history.openRecord(record.url)">
                    <span class="i-lucide:external-link" />
                  </button>
                  <button class="action-btn danger" :title="t('common.delete')" @click.stop="ui.openDeleteConfirm(record)">
                    <span class="i-lucide:trash-2" />
                  </button>
                </div>
              </div>
            </template>
          </template>
        </template>

        <template v-else>
          <div
            v-for="(record, idx) in visibleRecords"
            :key="record.id"
            class="record-item"
            :class="{ focused: idx === focusedIndex, selected: history.selectedRecords.has(record.id) }"
            :title="record.title"
            @contextmenu="onContextMenu($event, record)"
          >
            <label v-if="history.isSelectMode" class="select-check" @click.stop="history.toggleSelectRecord(record.id)">
              <input type="checkbox" :checked="history.selectedRecords.has(record.id)" />
            </label>
            <div class="record-favicon">
              <img :src="getFaviconUrl(record.url)" alt="" class="favicon-img"
                @error="onFaviconError($event, record.url)" />
            </div>
            <div class="record-info" @click="history.isSelectMode ? history.toggleSelectRecord(record.id) : (!ui.doubleClickMode ? history.openRecord(record.url) : undefined)" @dblclick="!history.isSelectMode && ui.doubleClickMode ? history.openRecord(record.url) : undefined">
              <div class="record-title" v-html="highlightText(record.title, history.searchKeyword)" />
              <div class="record-meta">
                <span v-html="highlightText(record.domain, history.searchKeyword)" />
                <span class="meta-dot">·</span>
                <span>{{ formatTime(record.lastVisitTime, t) }}</span>
                <span v-if="record.visitCount > 1" class="meta-dot">·</span>
                <span v-if="record.visitCount > 1">{{ t('history.visitCountLabel', { count: record.visitCount }) }}</span>
              </div>
              <div v-if="record.tags?.length" class="auto-tags">
                <span v-for="tag in record.tags" :key="tag" class="auto-tag"
                  :style="{ backgroundColor: (TAG_COLORS[tag] || 'var(--color-text-muted)') + '18', color: TAG_COLORS[tag] || 'var(--color-text-muted)' }">
                  {{ t('tags.' + tag) }}
                </span>
              </div>
            </div>
            <div class="record-actions" v-if="!history.isSelectMode">
              <button
                class="action-btn"
                :class="{ 'queue-active': readingQueue.isInQueue(record.url) }"
                :title="readingQueue.isInQueue(record.url) ? t('readingQueue.removeFromQueue') : t('readingQueue.addToQueue')"
                @click.stop="readingQueue.toggleQueue(record.url, record.title, record.domain, record.tags || [])"
              >
                <span :class="readingQueue.isInQueue(record.url) ? 'i-lucide:bookmark-check' : 'i-lucide:clock'" />
              </button>
              <button
                class="action-btn bookmark-btn"
                :title="t('preview.addToBookmarks')"
                @click.stop="ui.openBookmarkPicker(record)"
              >
                <span class="i-lucide:bookmark-plus" />
              </button>
              <button class="action-btn" :title="t('common.open')" @click.stop="history.openRecord(record.url)">
                <span class="i-lucide:external-link" />
              </button>
              <button class="action-btn danger" :title="t('common.delete')" @click.stop="ui.openDeleteConfirm(record)">
                <span class="i-lucide:trash-2" />
              </button>
            </div>
          </div>
        </template>

        <div v-if="showLoadMore" class="load-more" @click="history.loadMore()">
          {{ t('history.loadMore') }}
        </div>
      </template>

      <Transition name="scroll-top-fade">
        <button v-if="showScrollTop" class="scroll-top-btn" @click="scrollToTop" :title="t('common.back')">
          <span class="i-lucide:arrow-up" />
        </button>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.history-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
  transition: border-color var(--transition-hover), box-shadow var(--transition-hover);
}
.search-bar:focus-within {
  border-bottom-color: var(--color-primary);
  box-shadow: 0 1px 0 var(--color-primary);
}

.search-icon { color: var(--color-text-muted); font-size: var(--fs-xl); flex-shrink: 0; }

.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: var(--fs-lg);
  color: var(--color-text-primary);
}
.search-input::placeholder { color: var(--color-text-muted); }

.cmd-trigger {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border: 1px solid var(--color-border);
  background: var(--color-bg-surface); border-radius: var(--radius-sm);
  cursor: pointer; color: var(--color-text-muted); font-size: var(--fs-md);
  transition: all var(--transition-hover); flex-shrink: 0;
}
.cmd-trigger:hover { border-color: var(--color-primary); color: var(--color-primary); background: var(--color-primary-light); }

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

.clear-btn {
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border: none;
  background: var(--color-border); border-radius: 50%;
  cursor: pointer; color: var(--color-text-muted); font-size: var(--fs-md);
}
.clear-btn:hover { opacity: 0.8; }

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

.batch-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px; background: var(--color-primary-light);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.batch-info { font-size: var(--fs-md); color: var(--color-primary); font-weight: 500; flex: 1; }
.batch-btn {
  padding: 3px 10px; font-size: var(--fs-base); border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); background: var(--color-bg-surface);
  color: var(--color-text-secondary); cursor: pointer;
}
.batch-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
.batch-btn.danger { color: var(--color-danger); border-color: var(--color-danger); }
.batch-btn.danger:hover { background: var(--color-danger-light); }
.batch-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.tag-bar {
  display: flex; gap: 6px; padding: 6px 12px;
  overflow-x: auto; border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.tag-chip {
  padding: 2px 10px; font-size: var(--fs-base); font-weight: 500;
  color: var(--color-text-muted); background: var(--color-bg-surface);
  border: 1px solid var(--color-border); border-radius: var(--radius-lg);
  cursor: pointer; transition: all var(--transition-hover);
}
.tag-chip:hover { border-color: var(--color-text-muted); }
.tag-chip.active {
  background: var(--tag-color, var(--color-primary));
  color: var(--color-text-inverse);
  border-color: var(--tag-color, var(--color-primary));
}

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

.record-list { flex: 1; overflow-y: auto; padding: 0; }

.loading-state, .empty-state {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 12px; padding: 48px 16px;
  color: var(--color-text-muted); font-size: var(--fs-lg);
}

.spinner {
  width: 24px; height: 24px; border: 2px solid var(--color-border);
  border-top-color: var(--color-primary); border-radius: 50%;
  animation: spin 0.6s linear infinite;
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

.record-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border-bottom: 1px solid var(--color-border);
  position: relative; cursor: default;
}
.record-item::after {
  content: ''; position: absolute; inset: 0;
  background: var(--color-primary-light); border-radius: 0;
  opacity: 0; transition: opacity var(--transition-hover);
  pointer-events: none; z-index: 0;
}
.record-item:hover::after { opacity: 1; }
.record-item > * { position: relative; z-index: 1; }
.record-item.focused::after { opacity: 1; }
.record-item.selected { background: var(--color-primary-light); border-left: 3px solid var(--color-primary); }

.select-check {
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; cursor: pointer; flex-shrink: 0;
}
.select-check input { cursor: pointer; }

.record-favicon {
  width: 28px; height: 28px; border-radius: var(--radius-sm);
  overflow: hidden; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.record-favicon img, .favicon-img {
  width: 100%; height: 100%; object-fit: contain;
  transition: opacity var(--transition-hover);
}
.favicon-img[src=""] { opacity: 0; }
.favicon-fallback {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  color: var(--color-text-inverse); font-size: var(--fs-md); font-weight: 600;
  border-radius: var(--radius-sm);
}
.favicon-fallback.hidden { display: none; }

.record-info { flex: 1; min-width: 0; cursor: pointer; }
.record-title {
  font-size: var(--fs-lg); font-weight: 500; color: var(--color-text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.record-meta {
  font-size: var(--fs-base); color: var(--color-text-muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin-top: 2px;
  display: flex; align-items: center; gap: 0;
}
.meta-dot { margin: 0 4px; }

.record-actions {
  display: flex; gap: 2px;
  opacity: 0;
  transition: opacity var(--transition-hover);
}
.record-item:hover .record-actions,
.record-item.focused .record-actions {
  opacity: 1;
}

.action-btn {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border: none; background: transparent;
  border-radius: var(--radius-sm); cursor: pointer;
  color: var(--color-text-muted); font-size: var(--fs-xl);
  transition: color var(--transition-hover), background-color var(--transition-hover);
  will-change: color, background-color;
}
.action-btn:hover { background: var(--color-primary-light); color: var(--color-text-secondary); }
.action-btn.active { color: var(--color-warning); }
.action-btn.danger { color: var(--color-danger); }
.action-btn.danger:hover { color: var(--color-danger); background: var(--color-danger-light); }
.action-btn.queue-active { color: var(--color-warning); background: var(--color-warning-light); }

.auto-tags { display: flex; gap: 3px; margin-top: 2px; flex-wrap: wrap; }
.auto-tag {
  font-size: var(--fs-xs); padding: 0 4px; border-radius: var(--radius-sm);
  font-weight: 500; white-space: nowrap; line-height: 14px;
}
.bookmark-btn { color: var(--color-primary); }
.bookmark-btn:hover { background: var(--color-primary-light); color: var(--color-primary); }

.load-more {
  padding: 12px; text-align: center; font-size: var(--fs-md);
  color: var(--color-text-muted); cursor: pointer;
  transition: color var(--transition-hover);
}
.load-more:hover { color: var(--color-primary); }

.confirm-overlay {
  position: fixed; inset: 0; background: var(--color-bg-overlay);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
  animation: confirm-overlay-in 0.15s ease;
}
@keyframes confirm-overlay-in { from { opacity: 0; } to { opacity: 1; } }
.confirm-dialog {
  width: 280px; background: var(--color-bg-surface); border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg); padding: 20px;
  animation: confirm-dialog-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes confirm-dialog-in { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
.confirm-title { font-size: var(--fs-xl); font-weight: 600; color: var(--color-text-primary); margin-bottom: 8px; }
.confirm-text { font-size: var(--fs-md); color: var(--color-text-secondary); margin-bottom: 16px; line-height: 1.5; }
.confirm-actions { display: flex; gap: 8px; justify-content: flex-end; }

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
