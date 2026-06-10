<script setup lang="ts">
import { computed } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useUIStore } from '@/stores/ui'
import { useReadingQueueStore } from '@/stores/readingQueue'
import { formatTime, getFaviconUrl, highlightText, TAG_COLORS, onFaviconError } from '@/utils/helpers'
import type { HistoryRecord } from '@/utils/helpers'
import { useI18n } from '@/i18n'

const history = useHistoryStore()
const ui = useUIStore()
const readingQueue = useReadingQueueStore()
const { t } = useI18n()

const props = defineProps<{
  record: HistoryRecord
  focused: boolean
  selected: boolean
  selectMode: boolean
  searchKeyword: string
  doubleClickMode: boolean
}>()

defineEmits<{
  click: [record: HistoryRecord]
  dblclick: [record: HistoryRecord]
  contextmenu: [event: MouseEvent, record: HistoryRecord]
}>()

// 缓存高亮结果，无关键词时直接返回原文本
const highlightedTitle = computed(() =>
  props.searchKeyword ? highlightText(props.record.title, props.searchKeyword) : props.record.title
)
const highlightedDomain = computed(() =>
  props.searchKeyword ? highlightText(props.record.domain, props.searchKeyword) : props.record.domain
)
// 缓存 isInQueue 结果，避免模板中 3 次重复调用
const isInQueue = computed(() => readingQueue.isInQueue(props.record.url))
const queueToggleTitle = computed(() =>
  isInQueue.value ? t('readingQueue.removeFromQueue') : t('readingQueue.addToQueue')
)
const queueIcon = computed(() =>
  isInQueue.value ? 'i-lucide:bookmark-check' : 'i-lucide:clock'
)
</script>

<template>
  <div
    class="record-item"
    :class="{ focused, selected }"
    :title="record.title"
    @contextmenu="$emit('contextmenu', $event, record)"
  >
    <!-- 选择框 -->
    <label v-if="selectMode" class="select-check" @click.stop="$emit('click', record)">
      <input type="checkbox" :checked="selected" />
    </label>

    <!-- Favicon -->
    <div class="record-favicon">
      <img :src="getFaviconUrl(record.url)" alt="" class="favicon-img"
        @error="onFaviconError($event, record.url)" />
    </div>

    <!-- 信息区 -->
    <div class="record-info"
      @click="selectMode ? $emit('click', record) : (!doubleClickMode ? $emit('click', record) : undefined)"
      @dblclick="!selectMode && doubleClickMode ? $emit('dblclick', record) : undefined">
      <div class="record-title" v-html="highlightedTitle" />
      <div class="record-meta">
        <span v-html="highlightedDomain" />
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

    <!-- 操作按钮 -->
    <div class="record-actions" v-if="!selectMode">
      <button class="action-btn"
        :class="{ 'queue-active': isInQueue }"
        :title="queueToggleTitle"
        @click.stop="readingQueue.toggleQueue(record.url, record.title, record.domain, record.tags || [])">
        <span :class="queueIcon" />
      </button>
      <button class="action-btn bookmark-btn" :title="t('preview.addToBookmarks')"
        @click.stop="ui.openBookmarkPicker(record)">
        <span class="i-lucide:bookmark-plus" />
      </button>
      <button class="action-btn" :title="t('common.open')" @click.stop="$emit('click', record)">
        <span class="i-lucide:external-link" />
      </button>
      <button class="action-btn danger" :title="t('common.delete')" @click.stop="ui.openDeleteConfirm(record)">
        <span class="i-lucide:trash-2" />
      </button>
    </div>
  </div>
</template>

<style scoped>
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
</style>
