<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch, onUnmounted } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useUIStore } from '@/stores/ui'
import { useStatsStore } from '@/stores/stats'
import { useReadingQueueStore } from '@/stores/readingQueue'
import { formatTime, formatDateTime, getFaviconUrl, highlightText, getGroupLabel, autoTag, TAG_COLORS } from '@/utils/helpers'
import type { HistoryRecord } from '@/utils/helpers'

const history = useHistoryStore()
const ui = useUIStore()
const stats = useStatsStore()
const readingQueue = useReadingQueueStore()

const searchInput = ref('')
const recordListRef = ref<HTMLElement | null>(null)
const focusedIndex = ref(-1)
const showBlacklist = ref(false)
const newBlacklistDomain = ref('')
const showDailySummary = ref(true)
const batchDeleteConfirm = ref(false)

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

const timeOptions = [
  { value: 'today', label: '今日' },
  { value: '3days', label: '近3天' },
  { value: 'week', label: '近7天' },
  { value: 'month', label: '近30天' },
  { value: 'all', label: '全部' },
]

const groupOptions = [
  { value: 'none', label: '不分组' },
  { value: 'domain', label: '按域名' },
  { value: 'timeline', label: '按时间' },
  { value: 'session', label: '按会话' },
  { value: 'custom', label: '自定义' },
]

const sortOptions = [
  { value: 'timeDesc', label: '最新' },
  { value: 'timeAsc', label: '最旧' },
  { value: 'visitDesc', label: '最常访问' },
  { value: 'visitAsc', label: '最少访问' },
]

const visibleRecords = computed(() => history.pagedRecords)
const showLoadMore = computed(() => history.pagedRecords.length < history.filteredRecords.length)
const selectedCount = computed(() => history.selectedRecords.size)

function onSearch(e: Event) {
  const val = (e.target as HTMLInputElement).value
  history.setSearch(val)
}

function onContextMenu(e: MouseEvent, record: HistoryRecord) {
  e.preventDefault()
  ui.openContextMenu(e.clientX, e.clientY, record)
}

function getSessionLabel(key: string, records?: HistoryRecord[]): string {
  if (!records?.length) return key
  const first = records[0]
  const last = records[records.length - 1]
  const start = formatDateTime(first.lastVisitTime)
  const end = formatTime(last.lastVisitTime)
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
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
    history.loadMore()
  }
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
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    focusedIndex.value = Math.max(focusedIndex.value - 1, 0)
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
        placeholder="搜索标题或网址... (Ctrl+F)"
        @input="onSearch"
      />
      <button class="cmd-trigger" @click="ui.showCommandPalette = true" title="命令面板 (Ctrl+K)">
        <span class="i-lucide:terminal" />
      </button>
      <button v-if="searchInput" class="clear-btn" @click="searchInput = ''; history.setSearchImmediate('')">
        <span class="i-lucide:x" />
      </button>
    </div>

    <div v-if="history.hasActiveFilter" class="active-filter-bar">
      <span class="filter-indicator">
        <span class="i-lucide:filter filter-indicator-icon" />
        {{ history.activeFilterLabel }}
      </span>
      <span class="filter-count">{{ history.filteredRecords.length }} 条结果</span>
      <button class="filter-clear-btn" @click="history.clearAllFilters(); searchInput = ''">
        <span class="i-lucide:x" /> 清除筛选
      </button>
    </div>

    <div v-if="showDailySummary && dailySummary.count > 0" class="daily-summary">
      <div class="summary-content">
        <span class="summary-item">
          <span class="i-lucide:eye summary-icon" />
          今日 <strong>{{ dailySummary.count }}</strong> 次浏览
        </span>
        <span v-if="dailySummary.topDomain" class="summary-item">
          <span class="i-lucide:trophy summary-icon" />
          最活跃 <strong>{{ dailySummary.topDomain }}</strong> ({{ dailySummary.topDomainCount }}次)
        </span>
        <span class="summary-item">
          <span class="i-lucide:zap summary-icon" />
          生产力 <strong :style="{ color: dailySummary.productivity >= 50 ? '#10b981' : '#ef4444' }">{{ dailySummary.productivity }}分</strong>
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
            title="展开前3组"
            @click="history.expandTopGroups(3)"
          >
            <span class="i-lucide:chevrons-down" />
          </button>
          <button
            v-if="history.groupMode === 'custom'"
            class="filter-btn xs icon-only"
            title="管理规则"
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
            多选
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
      <span class="batch-info">已选 {{ selectedCount }} 项</span>
      <button class="batch-btn" @click="history.selectAll()">全选</button>
      <button class="batch-btn" @click="history.clearSelection()">取消</button>
      <button class="batch-btn danger" :disabled="!selectedCount" @click="batchDeleteConfirm = true">删除</button>
    </div>

    <div class="blacklist-bar" v-if="showBlacklist">
      <div class="blacklist-form">
        <input v-model="newBlacklistDomain" type="text" placeholder="输入域名（如 google.com）" class="blacklist-input"
          @keydown.enter="if(newBlacklistDomain.trim()){history.addBlacklistDomain(newBlacklistDomain.trim());newBlacklistDomain=''}" />
        <button class="batch-btn" @click="if(newBlacklistDomain.trim()){history.addBlacklistDomain(newBlacklistDomain.trim());newBlacklistDomain=''}">添加</button>
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
        全部
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
      <span>自定义分组需要先创建规则，点击下方按钮打开规则管理</span>
      <button class="guide-btn" @click="ui.showGroupRuleModal = true">
        <span class="i-lucide:settings-2" />管理规则
      </button>
    </div>

    <div v-if="batchDeleteConfirm" class="confirm-overlay" @click.self="batchDeleteConfirm = false">
      <div class="confirm-dialog">
        <div class="confirm-title">确认批量删除</div>
        <div class="confirm-text">确定要删除已选中的 {{ selectedCount }} 条记录吗？此操作不可撤销。</div>
        <div class="confirm-actions">
          <button class="batch-btn" @click="batchDeleteConfirm = false">取消</button>
          <button class="batch-btn danger" @click="history.deleteRecords(history.filteredRecords.filter(r => history.selectedRecords.has(r.id))); batchDeleteConfirm = false">确认删除</button>
        </div>
      </div>
    </div>

    <div class="record-list" ref="recordListRef" @scroll="onScroll">
      <div v-if="history.isLoading" class="loading-state">
        <div class="spinner" />
        <span>正在加载...</span>
      </div>

      <div v-else-if="!visibleRecords.length" class="empty-state">
        <span class="i-lucide:clock empty-icon" />
        <p>暂无历史记录</p>
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
                {{ history.groupMode === 'session' ? getSessionLabel(groupKey, history.groupedResult.groups[groupKey]) : getGroupLabel(groupKey) }}
              </span>
              <span class="group-count">{{ history.groupedResult.groups[groupKey]?.length || 0 }}</span>
              <button v-if="history.groupMode === 'session'" class="restore-btn" @click.stop="history.restoreSession(groupKey)" title="恢复此会话">
                <span class="i-lucide:rotate-ccw" />恢复
              </button>
            </div>
            <template v-if="!history.collapsedSet.has(groupKey)">
              <div
                v-for="record in history.groupedResult.groups[groupKey]"
                :key="record.id"
                class="record-item"
                :class="{ focused: visibleRecords.indexOf(record) === focusedIndex, selected: history.selectedRecords.has(record.id) }"
                @contextmenu="onContextMenu($event, record)"
              >
                <label v-if="history.isSelectMode" class="select-check" @click.stop="history.toggleSelectRecord(record.id)">
                  <input type="checkbox" :checked="history.selectedRecords.has(record.id)" />
                </label>
                <div class="record-favicon">
                  <img :src="getFaviconUrl(record.url)" alt="" loading="lazy"
                    @error="($event.target as HTMLImageElement).style.display='none'; ($event.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden')" />
                  <span class="favicon-fallback hidden" :style="{ backgroundColor: record.domainColor }">
                    {{ record.domain.charAt(0).toUpperCase() }}
                  </span>
                </div>
                <div class="record-info" @click="history.isSelectMode ? history.toggleSelectRecord(record.id) : history.openRecord(record.url)">
                  <div class="record-title" v-html="highlightText(record.title, history.searchKeyword)" />
                  <div class="record-meta">
                    <span v-html="highlightText(record.domain, history.searchKeyword)" />
                    <span class="meta-dot">·</span>
                    <span>{{ formatTime(record.lastVisitTime) }}</span>
                    <span v-if="record.visitCount > 1" class="meta-dot">·</span>
                    <span v-if="record.visitCount > 1">{{ record.visitCount }}次</span>
                    <span class="auto-tags">
                      <span v-for="tag in autoTag(record.url, record.title)" :key="tag" class="auto-tag"
                        :style="{ backgroundColor: (TAG_COLORS[tag] || '#64748b') + '18', color: TAG_COLORS[tag] || '#64748b' }">
                        {{ tag }}
                      </span>
                    </span>
                  </div>
                </div>
                <div class="record-actions" v-if="!history.isSelectMode">
                  <button
                    class="action-btn"
                    :class="{ 'queue-active': readingQueue.isInQueue(record.url) }"
                    :title="readingQueue.isInQueue(record.url) ? '移出阅读队列' : '加入阅读队列'"
                    @click.stop="readingQueue.toggleQueue(record.url, record.title, record.domain, autoTag(record.url, record.title))"
                  >
                    <span :class="readingQueue.isInQueue(record.url) ? 'i-lucide:bookmark-check' : 'i-lucide:clock'" />
                  </button>
                  <button
                    class="action-btn bookmark-btn"
                    title="添加到书签"
                    @click.stop="ui.openBookmarkPicker(record)"
                  >
                    <span class="i-lucide:bookmark-plus" />
                  </button>
                  <button class="action-btn" title="打开" @click.stop="history.openRecord(record.url)">
                    <span class="i-lucide:external-link" />
                  </button>
                  <button class="action-btn danger" title="删除" @click.stop="ui.openDeleteConfirm(record)">
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
            @contextmenu="onContextMenu($event, record)"
          >
            <label v-if="history.isSelectMode" class="select-check" @click.stop="history.toggleSelectRecord(record.id)">
              <input type="checkbox" :checked="history.selectedRecords.has(record.id)" />
            </label>
            <div class="record-favicon">
              <img :src="getFaviconUrl(record.url)" alt="" loading="lazy"
                @error="($event.target as HTMLImageElement).style.display='none'; ($event.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden')" />
              <span class="favicon-fallback hidden" :style="{ backgroundColor: record.domainColor }">
                {{ record.domain.charAt(0).toUpperCase() }}
              </span>
            </div>
            <div class="record-info" @click="history.isSelectMode ? history.toggleSelectRecord(record.id) : history.openRecord(record.url)">
              <div class="record-title" v-html="highlightText(record.title, history.searchKeyword)" />
              <div class="record-meta">
                <span v-html="highlightText(record.domain, history.searchKeyword)" />
                <span class="meta-dot">·</span>
                <span>{{ formatTime(record.lastVisitTime) }}</span>
                <span v-if="record.visitCount > 1" class="meta-dot">·</span>
                <span v-if="record.visitCount > 1">{{ record.visitCount }}次</span>
                <span class="auto-tags">
                  <span v-for="tag in autoTag(record.url, record.title)" :key="tag" class="auto-tag"
                    :style="{ backgroundColor: (TAG_COLORS[tag] || '#64748b') + '18', color: TAG_COLORS[tag] || '#64748b' }">
                    {{ tag }}
                  </span>
                </span>
              </div>
            </div>
            <div class="record-actions" v-if="!history.isSelectMode">
              <button
                class="action-btn"
                :class="{ 'queue-active': readingQueue.isInQueue(record.url) }"
                :title="readingQueue.isInQueue(record.url) ? '移出阅读队列' : '加入阅读队列'"
                @click.stop="readingQueue.toggleQueue(record.url, record.title, record.domain, autoTag(record.url, record.title))"
              >
                <span :class="readingQueue.isInQueue(record.url) ? 'i-lucide:bookmark-check' : 'i-lucide:clock'" />
              </button>
              <button
                class="action-btn bookmark-btn"
                title="添加到书签"
                @click.stop="ui.openBookmarkPicker(record)"
              >
                <span class="i-lucide:bookmark-plus" />
              </button>
              <button class="action-btn" title="打开" @click.stop="history.openRecord(record.url)">
                <span class="i-lucide:external-link" />
              </button>
              <button class="action-btn danger" title="删除" @click.stop="ui.openDeleteConfirm(record)">
                <span class="i-lucide:trash-2" />
              </button>
            </div>
          </div>
        </template>

        <div v-if="showLoadMore" class="load-more" @click="history.loadMore()">
          加载更多...
        </div>
      </template>
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
  background: var(--app-surface);
  border-bottom: 1px solid var(--border-color);
}

.search-icon { color: var(--text-muted); font-size: 14px; flex-shrink: 0; }

.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: var(--text-primary);
}
.search-input::placeholder { color: var(--text-muted); }

.cmd-trigger {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border: 1px solid var(--border-color);
  background: var(--app-surface); border-radius: var(--radius-sm);
  cursor: pointer; color: var(--text-muted); font-size: 12px;
  transition: all var(--transition-fast); flex-shrink: 0;
}
.cmd-trigger:hover { border-color: var(--primary-color); color: var(--primary-color); background: var(--primary-light); }

.daily-summary {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px; background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.06));
  border-bottom: 1px solid var(--border-color); flex-shrink: 0;
}
.summary-content {
  display: flex; align-items: center; gap: 12px; flex: 1;
  overflow-x: auto; white-space: nowrap;
}
.summary-item { font-size: 11px; color: var(--text-secondary); display: flex; align-items: center; gap: 3px; }
.summary-item strong { color: var(--text-primary); }
.summary-icon { font-size: 12px; color: var(--primary-color); }
.summary-close {
  width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; color: var(--text-muted);
  cursor: pointer; font-size: 12px; border-radius: var(--radius-sm); flex-shrink: 0;
}
.summary-close:hover { background: var(--primary-light); color: var(--text-secondary); }

.clear-btn {
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border: none;
  background: var(--border-color); border-radius: 50%;
  cursor: pointer; color: var(--text-muted); font-size: 12px;
}
.clear-btn:hover { opacity: 0.8; }

.active-filter-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; margin: 0 0 6px;
  background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2);
  border-radius: var(--radius-md); font-size: 11px;
}
.filter-indicator {
  display: flex; align-items: center; gap: 4px;
  color: #6366f1; font-weight: 600;
}
.filter-indicator-icon { font-size: 12px; }
.filter-count { color: var(--text-muted); font-size: 10px; }
.filter-clear-btn {
  margin-left: auto; display: flex; align-items: center; gap: 3px;
  padding: 2px 8px; border: 1px solid rgba(99,102,241,0.3);
  border-radius: var(--radius-sm); background: transparent;
  color: #6366f1; font-size: 10px; font-weight: 500;
  cursor: pointer; transition: all var(--transition-fast);
}
.filter-clear-btn:hover { background: rgba(99,102,241,0.12); }

.filter-bar {
  padding: 4px 10px;
  border-bottom: 1px solid var(--border-color);
  overflow-x: auto;
  flex-shrink: 0;
}
.filter-bar.compact-all { padding: 4px 8px; }

.filter-row { display: flex; align-items: center; gap: 2px; }
.filter-row + .filter-row { margin-top: 2px; }

.filter-divider {
  width: 1px; height: 14px; background: var(--border-color);
  margin: 0 4px; flex-shrink: 0;
}

.filter-group { display: flex; gap: 2px; white-space: nowrap; }

.filter-btn {
  padding: 3px 8px; font-size: 11px; font-weight: 500;
  color: var(--text-muted); background: transparent;
  border: 1px solid transparent; border-radius: var(--radius-sm);
  cursor: pointer; transition: all var(--transition-fast);
}
.filter-btn:hover { background: var(--primary-light); color: var(--text-secondary); }
.filter-btn.active {
  background: var(--primary-light);
  color: var(--primary-color);
  border-color: var(--primary-color);
  border-opacity: 0.3;
}

.filter-btn.xs { padding: 2px 6px; font-size: 10px; display: flex; align-items: center; }
.filter-btn.icon-only { padding: 2px 4px; }

.batch-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px; background: var(--primary-light);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}
.batch-info { font-size: 12px; color: var(--primary-color); font-weight: 500; flex: 1; }
.batch-btn {
  padding: 3px 10px; font-size: 11px; border: 1px solid var(--border-color);
  border-radius: var(--radius-sm); background: var(--app-surface);
  color: var(--text-secondary); cursor: pointer;
}
.batch-btn:hover { border-color: var(--primary-color); color: var(--primary-color); }
.batch-btn.danger { color: #ef4444; border-color: #ef4444; }
.batch-btn.danger:hover { background: #fef2f2; }
.batch-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.tag-bar {
  display: flex; gap: 6px; padding: 6px 12px;
  overflow-x: auto; border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.tag-chip {
  padding: 2px 10px; font-size: 11px; font-weight: 500;
  color: var(--text-muted); background: var(--app-surface);
  border: 1px solid var(--border-color); border-radius: 12px;
  cursor: pointer; transition: all var(--transition-fast);
}
.tag-chip:hover { border-color: var(--text-muted); }
.tag-chip.active {
  background: var(--tag-color, var(--primary-color));
  color: white;
  border-color: var(--tag-color, var(--primary-color));
}

.custom-guide {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; margin: 8px 12px;
  background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2);
  border-radius: var(--radius-md); font-size: 12px; color: var(--text-secondary);
}
.guide-icon { font-size: 16px; color: #f59e0b; flex-shrink: 0; }
.guide-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 12px; border: 1px solid var(--primary-color); border-radius: var(--radius-sm);
  background: var(--primary-light); color: var(--primary-color); font-size: 11px;
  cursor: pointer; font-weight: 500; transition: all var(--transition-fast);
  margin-left: auto; flex-shrink: 0;
}
.guide-btn:hover { background: var(--primary-color); color: white; }

.record-list { flex: 1; overflow-y: auto; padding: 0; }

.loading-state, .empty-state {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 12px; padding: 48px 16px;
  color: var(--text-muted); font-size: 13px;
}

.spinner {
  width: 24px; height: 24px; border: 2px solid var(--border-color);
  border-top-color: var(--primary-color); border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.empty-icon { font-size: 36px; opacity: 0.4; }

.group-header {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; background: var(--app-bg);
  border-bottom: 1px solid var(--border-color);
  cursor: pointer; font-size: 12px; font-weight: 600;
  color: var(--text-secondary); user-select: none;
  transition: background var(--transition-fast);
}
.group-header:hover { background: var(--primary-light); }
.group-chevron-wrap { display: flex; align-items: center; }
.group-name { flex: 1; }
.group-count { font-size: 11px; font-weight: 400; color: var(--text-muted); }
.group-chevron { font-size: 14px; transition: transform var(--transition-fast); }
.group-header.collapsed .group-chevron { transform: rotate(-90deg); }
.restore-btn {
  display: flex; align-items: center; gap: 3px;
  padding: 2px 8px; font-size: 11px; font-weight: 500;
  color: var(--primary-color); background: var(--primary-light);
  border: 1px solid var(--primary-color); border-radius: var(--radius-sm);
  cursor: pointer; transition: all var(--transition-fast);
}
.restore-btn:hover { background: var(--primary-color); color: white; }

.blacklist-bar {
  padding: 8px 12px; background: var(--app-surface);
  border-bottom: 1px solid var(--border-color); flex-shrink: 0;
}
.blacklist-form { display: flex; gap: 6px; margin-bottom: 6px; }
.blacklist-input {
  flex: 1; padding: 5px 8px; border: 1px solid var(--border-color);
  border-radius: var(--radius-sm); font-size: 12px; outline: none;
  background: var(--app-bg); color: var(--text-primary);
}
.blacklist-input:focus { border-color: var(--primary-color); }
.blacklist-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.blacklist-tag {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; font-size: 11px; color: var(--text-secondary);
  background: var(--primary-light); border-radius: 10px;
}
.tag-remove {
  border: none; background: none; cursor: pointer;
  color: var(--text-muted); font-size: 13px; line-height: 1; padding: 0;
}
.tag-remove:hover { color: #ef4444; }

.record-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border-bottom: 1px solid var(--border-color);
  transition: background var(--transition-fast); cursor: default;
}
.record-item:hover { background: var(--primary-light); }
.record-item.focused { background: var(--primary-light); }
.record-item.selected { background: var(--primary-light); border-left: 3px solid var(--primary-color); }

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
.record-favicon img { width: 100%; height: 100%; object-fit: contain; }
.favicon-fallback {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  color: white; font-size: 12px; font-weight: 600;
  border-radius: var(--radius-sm);
}
.favicon-fallback.hidden { display: none; }

.record-info { flex: 1; min-width: 0; cursor: pointer; }
.record-title {
  font-size: 13px; font-weight: 500; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.record-meta {
  font-size: 11px; color: var(--text-muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin-top: 2px;
}
.meta-dot { margin: 0 4px; }

.record-actions {
  display: flex; gap: 2px;
  transition: opacity var(--transition-fast);
}

.action-btn {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border: none; background: transparent;
  border-radius: var(--radius-sm); cursor: pointer;
  color: var(--text-muted); font-size: 14px;
  transition: all var(--transition-fast);
}
.action-btn:hover { background: var(--primary-light); color: var(--text-secondary); }
.action-btn.active { color: #f59e0b; }
.action-btn.danger:hover { color: #ef4444; background: rgba(239,68,68,0.1); }
.action-btn.queue-active { color: #f59e0b; background: rgba(245,158,11,0.1); }

.auto-tags { display: inline-flex; gap: 3px; margin-left: 4px; }
.auto-tag {
  font-size: 9px; padding: 0 4px; border-radius: 3px;
  font-weight: 500; white-space: nowrap; line-height: 14px;
}
.bookmark-btn { color: #6366f1; }
.bookmark-btn:hover { background: rgba(99,102,241,0.12); color: #4f46e5; }

.load-more {
  padding: 12px; text-align: center; font-size: 12px;
  color: var(--text-muted); cursor: pointer;
  transition: color var(--transition-fast);
}
.load-more:hover { color: var(--primary-color); }

.confirm-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.confirm-dialog {
  width: 280px; background: var(--app-surface); border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg); padding: 20px;
}
.confirm-title { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; }
.confirm-text { font-size: 12px; color: var(--text-secondary); margin-bottom: 16px; line-height: 1.5; }
.confirm-actions { display: flex; gap: 8px; justify-content: flex-end; }
</style>
