<script setup lang="ts">
import { onMounted } from 'vue'
import { useReadingQueueStore } from '@/stores/readingQueue'
import { getFaviconUrl, safeOpenUrl, onFaviconError } from '@/utils/helpers'
import { useI18n } from '@/i18n'

const queue = useReadingQueueStore()
const { t } = useI18n()

onMounted(() => { queue.loadQueue() })

function openUrl(url: string) {
  safeOpenUrl(url)
}

function priorityLabel(p: number): string {
  if (p >= 0.8) return t('readingQueue.priority.highShort')
  if (p >= 0.5) return t('readingQueue.priority.mediumShort')
  return t('readingQueue.priority.lowShort')
}

function priorityColor(p: number): string {
  if (p >= 0.8) return '#ef4444'
  if (p >= 0.5) return '#f59e0b'
  return '#64748b'
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return t('readingQueue.minutesAgo', { count: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('readingQueue.hoursAgo', { count: hours })
  const days = Math.floor(hours / 24)
  return t('readingQueue.daysAgo', { count: days })
}
</script>

<template>
  <div class="queue-card">
    <div class="queue-header">
      <span class="i-lucide:bookmark-plus queue-header-icon" />
      <span class="queue-title">{{ t('readingQueue.title') }}</span>
      <span class="queue-count">{{ queue.count }}</span>
      <button v-if="queue.count > 0" class="clear-all-btn" @click="queue.clearQueue()">
        <span class="i-lucide:trash-2" />
      </button>
    </div>

    <div v-if="queue.count === 0" class="queue-empty">
      <span class="i-lucide:inbox empty-icon" />
      <div class="empty-text">{{ t('readingQueue.emptyText') }}</div>
      <div class="empty-hint">{{ t('readingQueue.emptyHint') }}</div>
    </div>

    <div v-else class="queue-list">
      <div v-for="item in queue.sortedItems" :key="item.url" class="queue-item">
        <img :src="getFaviconUrl(item.url)" class="item-favicon"
          @error="onFaviconError($event, item.url)" />
        <div class="item-info" @click="openUrl(item.url)">
          <div class="item-title">{{ item.title || item.domain }}</div>
          <div class="item-meta">
            <span class="item-domain">{{ item.domain }}</span>
            <span class="item-time">{{ timeAgo(item.addedAt) }}</span>
          </div>
          <div v-if="item.tags.length > 0" class="item-tags">
            <span v-for="tag in item.tags" :key="tag" class="item-tag">{{ t('tags.' + tag) }}</span>
          </div>
        </div>
        <span class="priority-badge" :style="{ color: priorityColor(item.priority), backgroundColor: priorityColor(item.priority) + '15' }">
          {{ priorityLabel(item.priority) }}
        </span>
        <button class="remove-btn" @click.stop="queue.removeFromQueue(item.url)">
          <span class="i-lucide:x" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.queue-card {
  padding: 14px; background: var(--app-surface);
  border: 1px solid var(--border-color); border-radius: var(--radius-lg);
}
.queue-header {
  display: flex; align-items: center; gap: 6px; margin-bottom: 10px;
}
.queue-header-icon { font-size: 16px; color: #f59e0b; }
.queue-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.queue-count {
  font-size: 10px; font-weight: 600; padding: 1px 6px;
  background: rgba(245,158,11,0.15); color: #f59e0b;
  border-radius: 4px;
}
.clear-all-btn {
  margin-left: auto; width: 20px; height: 20px;
  display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; color: var(--text-muted);
  cursor: pointer; font-size: 12px; border-radius: var(--radius-sm);
}
.clear-all-btn:hover { background: rgba(239,68,68,0.1); color: #ef4444; }

.queue-empty {
  text-align: center; padding: 16px 0;
}
.empty-icon { font-size: 24px; color: var(--text-muted); opacity: 0.5; }
.empty-text { font-size: 12px; color: var(--text-muted); margin-top: 6px; }
.empty-hint { font-size: 10px; color: var(--text-muted); opacity: 0.7; margin-top: 2px; }

.queue-list { display: flex; flex-direction: column; gap: 4px; max-height: 200px; overflow-y: auto; }
.queue-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; background: var(--app-bg);
  border-radius: var(--radius-md);
}
.item-favicon { width: 16px; height: 16px; border-radius: 2px; object-fit: contain; flex-shrink: 0; }
.item-info { flex: 1; min-width: 0; cursor: pointer; }
.item-title {
  font-size: 11px; font-weight: 500; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.item-meta { display: flex; gap: 6px; margin-top: 1px; }
.item-domain { font-size: 9px; color: var(--text-muted); }
.item-time { font-size: 9px; color: var(--text-muted); }
.item-tags { display: flex; gap: 2px; margin-top: 2px; }
.item-tag {
  font-size: 8px; padding: 0 4px; border-radius: 2px;
  background: rgba(99,102,241,0.1); color: #6366f1;
}
.priority-badge {
  font-size: 9px; font-weight: 600; padding: 1px 5px;
  border-radius: 3px; flex-shrink: 0;
}
.remove-btn {
  width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; color: var(--text-muted);
  cursor: pointer; font-size: 10px; border-radius: var(--radius-sm); flex-shrink: 0;
}
.remove-btn:hover { background: rgba(239,68,68,0.1); color: #ef4444; }
</style>
