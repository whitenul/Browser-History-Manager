<script setup lang="ts">
import { computed, ref } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useUIStore } from '@/stores/ui'
import { formatTime, getFaviconUrl, autoTag, TAG_COLORS, safeOpenUrl, onFaviconError } from '@/utils/helpers'
import type { HistoryRecord } from '@/utils/helpers'
import { useI18n } from '@/i18n'

const history = useHistoryStore()
const ui = useUIStore()
const { t } = useI18n()

interface TimeSegment {
  key: string
  label: string
  icon: string
  hourRange: [number, number]
  color: string
  records: HistoryRecord[]
}

const SEGMENT_DEFS = computed(() => [
  { key: 'night0', label: t('timeline.segments.night'), icon: 'i-lucide:moon', hourRange: [0, 6] as [number, number], color: '#6366f1' },
  { key: 'dawn', label: t('timeline.segments.dawn'), icon: 'i-lucide:sunrise', hourRange: [6, 9] as [number, number], color: '#fbbf24' },
  { key: 'morning', label: t('timeline.segments.morning'), icon: 'i-lucide:sun', hourRange: [9, 12] as [number, number], color: '#f59e0b' },
  { key: 'noon', label: t('timeline.segments.noon'), icon: 'i-lucide:cloud-sun', hourRange: [12, 14] as [number, number], color: '#fb923c' },
  { key: 'afternoon', label: t('timeline.segments.afternoon'), icon: 'i-lucide:briefcase', hourRange: [14, 18] as [number, number], color: '#3b82f6' },
  { key: 'evening', label: t('timeline.segments.evening'), icon: 'i-lucide:sunset', hourRange: [18, 21] as [number, number], color: '#ec4899' },
  { key: 'night1', label: t('timeline.segments.night'), icon: 'i-lucide:moon', hourRange: [21, 24] as [number, number], color: '#8b5cf6' },
])

const todayStart = computed(() => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
})

const yesterdayStart = computed(() => todayStart.value - 86400000)

const todayRecords = computed(() =>
  history.allRecords.filter(r => r.lastVisitTime >= todayStart.value)
)

const yesterdayRecords = computed(() =>
  history.allRecords.filter(r =>
    r.lastVisitTime >= yesterdayStart.value && r.lastVisitTime < todayStart.value
  )
)

const segments = computed<TimeSegment[]>(() => {
  return SEGMENT_DEFS.value.map(def => {
    const now = new Date()
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const start = base.getTime() + def.hourRange[0] * 3600000
    const end = base.getTime() + def.hourRange[1] * 3600000
    const records = todayRecords.value.filter(r => r.lastVisitTime >= start && r.lastVisitTime < end)
    return { ...def, records }
  })
})

const maxSegmentCount = computed(() =>
  Math.max(1, ...segments.value.map(s => s.records.length))
)

const activePeriod = computed(() => {
  const sorted = [...segments.value].sort((a, b) => b.records.length - a.records.length)
  return sorted[0]
})

const topDomain = computed(() => {
  const map = new Map<string, number>()
  todayRecords.value.forEach(r => map.set(r.domain, (map.get(r.domain) || 0) + 1))
  const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  return sorted[0]?.[0] || '-'
})

const storySummary = computed(() => {
  const total = todayRecords.value.length
  if (total === 0) return t('timeline.noRecordsToday')
  return t('timeline.browsedPagesActive', { count: total, label: activePeriod.value.label })
})

const yesterdayDiffPercent = computed(() => {
  const todayCount = todayRecords.value.length
  const yesterdayCount = yesterdayRecords.value.length
  if (yesterdayCount === 0) return null
  return Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100)
})

const yesterdayComparison = computed(() => {
  if (yesterdayDiffPercent.value === null) return null
  const abs = Math.abs(yesterdayDiffPercent.value)
  if (yesterdayDiffPercent.value >= 0) return t('timeline.vsYesterdayMore', { percent: abs })
  return t('timeline.vsYesterdayLess', { percent: abs })
})

function getSegmentBarWidth(seg: TimeSegment): string {
  const ratio = seg.records.length / maxSegmentCount.value
  return Math.max(4, ratio * 100) + '%'
}

function getSegmentDots(seg: TimeSegment) {
  const domainMap = new Map<string, { domain: string; count: number; favicon: string }>()
  seg.records.forEach(r => {
    const existing = domainMap.get(r.domain)
    if (existing) existing.count++
    else domainMap.set(r.domain, { domain: r.domain, count: 1, favicon: getFaviconUrl(r.url) })
  })
  return Array.from(domainMap.values()).sort((a, b) => b.count - a.count).slice(0, 8)
}

const currentHour = new Date().getHours()

function isCurrentSegment(seg: TimeSegment): boolean {
  return currentHour >= seg.hourRange[0] && currentHour < seg.hourRange[1]
}

function getYesterdaySegmentCount(seg: TimeSegment): number {
  const now = new Date()
  const yesterdayBase = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const start = yesterdayBase.getTime() + seg.hourRange[0] * 3600000
  const end = yesterdayBase.getTime() + seg.hourRange[1] * 3600000
  return yesterdayRecords.value.filter(r => r.lastVisitTime >= start && r.lastVisitTime < end).length
}

const expandedSegment = ref<string | null>(null)

function toggleExpand(key: string) {
  expandedSegment.value = expandedSegment.value === key ? null : key
}
</script>

<template>
  <div class="smart-timeline">
    <div class="story-card">
      <div class="story-header">
        <span class="i-lucide:book-open story-icon" />
        <span class="story-title">{{ t('timeline.title') }}</span>
      </div>
      <div class="story-stats">
        <div class="story-stat">
          <span class="story-stat-value">{{ todayRecords.length }}</span>
          <span class="story-stat-label">{{ t('timeline.totalVisits') }}</span>
        </div>
        <div class="story-stat">
          <span class="story-stat-value">{{ activePeriod.label }}</span>
          <span class="story-stat-label">{{ t('timeline.mostActive') }}</span>
        </div>
        <div class="story-stat">
          <span class="story-stat-value story-stat-domain">{{ topDomain }}</span>
          <span class="story-stat-label">{{ t('timeline.topDomain') }}</span>
        </div>
        <div v-if="yesterdayComparison" class="story-stat">
          <span class="story-stat-value" :class="yesterdayDiffPercent !== null && yesterdayDiffPercent >= 0 ? 'stat-up' : 'stat-down'">
            {{ yesterdayComparison }}
          </span>
          <span class="story-stat-label">{{ t('timeline.vsYesterday') }}</span>
        </div>
      </div>
      <div class="story-summary">{{ storySummary }}</div>
    </div>

    <div class="timeline-section">
      <div class="timeline-title">
        <span class="i-lucide:clock timeline-icon" />
        {{ t('timeline.timeline') }}
      </div>
      <div class="timeline-body">
        <div
          v-for="seg in segments"
          :key="seg.key"
          class="segment"
          :class="{ 'segment-active': isCurrentSegment(seg), 'segment-expanded': expandedSegment === seg.key }"
        >
          <div class="segment-header" @click="toggleExpand(seg.key)">
            <span :class="seg.icon" class="segment-icon" :style="{ color: seg.color }" />
            <span class="segment-label">{{ seg.label }}</span>
            <span class="segment-range">{{ String(seg.hourRange[0]).padStart(2, '0') }}:00-{{ String(seg.hourRange[1]).padStart(2, '0') }}:00</span>
            <span class="segment-count">{{ seg.records.length }}</span>
            <span class="i-lucide:chevron-down segment-expand-icon" :class="{ rotated: expandedSegment === seg.key }" />
          </div>
          <div class="segment-bar-row">
            <div class="segment-bar-track">
              <div class="segment-bar-fill" :style="{ width: getSegmentBarWidth(seg), backgroundColor: seg.color }" />
            </div>
            <div class="segment-dots">
              <img
                v-for="dot in getSegmentDots(seg)"
                :key="dot.domain"
                :src="dot.favicon"
                class="segment-dot"
                :title="dot.domain"
                @error="($event.target as HTMLImageElement).style.display = 'none'"
              />
            </div>
          </div>
          <div class="segment-compare" v-if="seg.records.length > 0 || getYesterdaySegmentCount(seg) > 0">
            <span class="compare-label">{{ t('timeline.yesterdaySameTime') }}</span>
            <span class="compare-value">{{ getYesterdaySegmentCount(seg) }}{{ t('timeline.times') }}</span>
            <span v-if="seg.records.length > 0 && getYesterdaySegmentCount(seg) > 0" class="compare-diff" :class="seg.records.length >= getYesterdaySegmentCount(seg) ? 'stat-up' : 'stat-down'">
              {{ seg.records.length >= getYesterdaySegmentCount(seg) ? '+' : '' }}{{ Math.round(((seg.records.length - getYesterdaySegmentCount(seg)) / getYesterdaySegmentCount(seg)) * 100) }}%
            </span>
          </div>
          <div v-if="expandedSegment === seg.key && seg.records.length > 0" class="segment-detail">
            <div class="segment-detail-list">
              <div v-for="r in seg.records.slice(0, 10)" :key="r.id" class="segment-detail-item" @click="history.openRecord(r.url)">
                <img :src="getFaviconUrl(r.url)" class="detail-favicon" @error="onFaviconError($event, r.url)" />
                <span class="detail-title">{{ r.title || r.domain }}</span>
                <span class="detail-time">{{ formatTime(r.lastVisitTime, t) }}</span>
              </div>
              <div v-if="seg.records.length > 10" class="detail-more">
                {{ t('timeline.moreRecords', { count: seg.records.length - 10 }) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.smart-timeline {
  display: flex; flex-direction: column; gap: 10px;
  max-width: 400px; width: 100%;
}

.story-card {
  padding: 12px; background: var(--app-surface);
  border: 1px solid var(--border-color); border-radius: 10px;
}
.story-header {
  display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
}
.story-icon { font-size: 14px; color: var(--primary-color); }
.story-title { font-size: 12px; font-weight: 600; color: var(--text-primary); }
.story-stats {
  display: flex; gap: 6px; margin-bottom: 8px;
}
.story-stat {
  flex: 1; text-align: center; padding: 6px 4px;
  background: var(--app-bg); border-radius: 6px;
}
.story-stat-value {
  display: block; font-size: 12px; font-weight: 700;
  color: var(--text-primary); white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
.story-stat-domain { font-size: 10px; }
.story-stat-label {
  display: block; font-size: 9px; color: var(--text-muted); margin-top: 2px;
}
.stat-up { color: #10b981; }
.stat-down { color: #ef4444; }
.story-summary {
  font-size: 11px; color: var(--text-secondary); line-height: 1.5;
  padding: 6px 8px; background: var(--app-bg); border-radius: 6px;
}

.timeline-section {
  padding: 10px 12px; background: var(--app-surface);
  border: 1px solid var(--border-color); border-radius: 10px;
}
.timeline-title {
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px;
}
.timeline-icon { font-size: 12px; color: var(--primary-color); }
.timeline-body { display: flex; flex-direction: column; gap: 4px; }

.segment {
  border-radius: 6px; padding: 6px 8px;
  background: var(--app-bg); transition: background 0.2s;
  border: 1px solid transparent;
}
.segment-active {
  border-color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-light) 8%, var(--app-bg));
}
.segment-expanded {
  background: color-mix(in srgb, var(--primary-light) 5%, var(--app-bg));
}

.segment-header {
  display: flex; align-items: center; gap: 5px; cursor: pointer;
  user-select: none;
}
.segment-icon { font-size: 12px; flex-shrink: 0; }
.segment-label { font-size: 11px; font-weight: 600; color: var(--text-primary); }
.segment-range { font-size: 9px; color: var(--text-muted); }
.segment-count {
  font-size: 10px; font-weight: 700; color: var(--text-secondary);
  margin-left: auto; min-width: 16px; text-align: right;
}
.segment-expand-icon {
  font-size: 12px; color: var(--text-muted); transition: transform 0.2s; flex-shrink: 0;
}
.segment-expand-icon.rotated { transform: rotate(180deg); }

.segment-bar-row {
  display: flex; align-items: center; gap: 6px; margin-top: 4px;
}
.segment-bar-track {
  flex: 1; height: 5px; background: var(--border-color);
  border-radius: 3px; overflow: hidden;
}
.segment-bar-fill {
  height: 100%; border-radius: 3px; transition: width 0.4s ease;
  min-width: 4px;
}
.segment-dots {
  display: flex; gap: 2px; flex-shrink: 0;
}
.segment-dot {
  width: 14px; height: 14px; border-radius: 50%;
  border: 1px solid var(--border-color); object-fit: cover;
  background: var(--app-surface);
}

.segment-compare {
  display: flex; align-items: center; gap: 4px; margin-top: 3px;
}
.compare-label { font-size: 9px; color: var(--text-muted); }
.compare-value { font-size: 9px; color: var(--text-secondary); font-weight: 600; }
.compare-diff { font-size: 9px; font-weight: 600; }

.segment-detail {
  margin-top: 6px; padding-top: 6px;
  border-top: 1px solid var(--border-color);
}
.segment-detail-list {
  display: flex; flex-direction: column; gap: 2px;
}
.segment-detail-item {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 6px; border-radius: 4px; cursor: pointer;
  transition: background 0.15s;
}
.segment-detail-item:hover { background: var(--border-color); }
.detail-favicon {
  width: 14px; height: 14px; border-radius: 2px; flex-shrink: 0;
  object-fit: contain;
}
.detail-title {
  flex: 1; font-size: 10px; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.detail-time { font-size: 9px; color: var(--text-muted); flex-shrink: 0; }
.detail-more {
  font-size: 9px; color: var(--text-muted); padding: 2px 6px; text-align: center;
}
</style>
