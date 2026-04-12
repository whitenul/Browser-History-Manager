<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, defineAsyncComponent, shallowRef, nextTick } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useStatsStore } from '@/stores/stats'
import { useUIStore } from '@/stores/ui'
import { getFaviconUrl, safeOpenUrl } from '@/utils/helpers'
import { useStatsNavigation } from '@/composables/useStatsNavigation'
import { useI18n } from '@/i18n'

const history = useHistoryStore()
const stats = useStatsStore()
const ui = useUIStore()
const { t } = useI18n()
const {
  HEAT_COLORS,
  isCurrentHeatCell,
  navigateWithTimeFilter,
  navigateWithDomainFilter,
} = useStatsNavigation()

const dayLabels = computed(() => [
  t('stats.weekdays.0'), t('stats.weekdays.1'), t('stats.weekdays.2'),
  t('stats.weekdays.3'), t('stats.weekdays.4'), t('stats.weekdays.5'), t('stats.weekdays.6'),
])

const timeRangeOptions = computed(() => [
  { value: 'all', label: t('common.all') },
  { value: 'today', label: t('common.today') },
  { value: '3days', label: t('history.filter.last3Days') },
  { value: 'week', label: t('history.filter.last7Days') },
  { value: 'month', label: t('history.filter.last30Days') },
])

function onHeatCellClick(cell: { day: number; hour: number; count: number }) {
  if (cell.count === 0) return
  const dayName = dayLabels.value[cell.day]
  const hourStr = String(cell.hour).padStart(2, '0')
  navigateWithTimeFilter(cell.day, cell.hour, cell.hour + 1, `${t('stats.weekPrefix')}${dayName} ${hourStr}:00-${hourStr}:59`)
}

function onTopSiteClick(domain: string) {
  navigateWithDomainFilter(domain, domain)
}

const SmartTimeline = shallowRef<any>(null)
const SmartAssistant = shallowRef<any>(null)
const BrowsingDNA = shallowRef<any>(null)
const EnhancedCharts = shallowRef<any>(null)

const loadedComponents = ref({
  timeline: false,
  assistant: false,
  dna: false,
  charts: false,
})

const scrollRestored = ref(false)
let scrollRestoreTimer: ReturnType<typeof setTimeout> | null = null
let scrollRafId: ReturnType<typeof requestAnimationFrame> | null = null

function restoreScrollPosition() {
  if (scrollRestored.value) return
  if (scrollRafId) cancelAnimationFrame(scrollRafId)
  const savedScroll = ui.getScrollPosition('stats')
  if (savedScroll <= 0) return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = requestAnimationFrame(() => {
      const el = document.querySelector('.stats-content') as HTMLElement
      if (!el) return
      if (el.scrollHeight > savedScroll) {
        el.scrollTop = savedScroll
        scrollRestored.value = true
      }
    })
  })
}

let loadTimeout: number | null = null

function loadComponent(name: 'timeline' | 'assistant' | 'dna' | 'charts') {
  if (loadedComponents.value[name]) return

  switch (name) {
    case 'timeline':
      import('@/components/business/SmartTimeline.vue').then(m => {
        SmartTimeline.value = m.default
        loadedComponents.value.timeline = true
      })
      break
    case 'assistant':
      import('@/components/business/SmartAssistant.vue').then(m => {
        SmartAssistant.value = m.default
        loadedComponents.value.assistant = true
      })
      break
    case 'dna':
      import('@/components/business/BrowsingDNA.vue').then(m => {
        BrowsingDNA.value = m.default
        loadedComponents.value.dna = true
      })
      break
    case 'charts':
      import('@/components/business/EnhancedCharts.vue').then(m => {
        EnhancedCharts.value = m.default
        loadedComponents.value.charts = true
      })
      break
  }
}

function loadAllComponents(immediate = false) {
  if (loadTimeout) {
    clearTimeout(loadTimeout)
  }

  const doLoad = () => {
    loadComponent('timeline')
    loadComponent('assistant')
    loadComponent('dna')
    loadComponent('charts')
  }

  if (immediate) {
    doLoad()
  } else {
    loadTimeout = window.setTimeout(doLoad, 100)
  }
}

function openUrl(url: string) {
  safeOpenUrl(url)
}

watch(() => history.allRecords.length, (len) => {
  if (len > 0) {
    stats.computeStats(history.allRecords)
    loadAllComponents()
  }
}, { immediate: true })

watch(() => stats.timeRange, () => {
  stats.computeStats(history.allRecords)
})

watch(
  () => [loadedComponents.value.timeline, loadedComponents.value.assistant, loadedComponents.value.dna, loadedComponents.value.charts],
  ([tl, as, dn, ch]) => {
    if (tl && as && dn && ch) {
      if (scrollRestoreTimer) clearTimeout(scrollRestoreTimer)
      scrollRestoreTimer = setTimeout(() => restoreScrollPosition(), 16)
    }
  }
)

onMounted(() => {
  const isReturning = ui.navStack.length > 0
    ? ui.navStack[ui.navStack.length - 1].tab === 'stats'
    : false

  restoreScrollPosition()

  if (history.allRecords.length > 0) {
    loadAllComponents(isReturning)
  }
})

onUnmounted(() => {
  if (loadTimeout) {
    clearTimeout(loadTimeout)
  }
  if (scrollRestoreTimer) {
    clearTimeout(scrollRestoreTimer)
  }
  if (scrollRafId) {
    cancelAnimationFrame(scrollRafId)
  }
})
</script>

<template>
  <div class="stats-view">
    <div class="stats-header">
      <div class="stats-title">
        <span class="i-lucide:bar-chart-3 stats-title-icon" />
        <span>{{ t('stats.overview') }}</span>
      </div>
      <div class="time-range-selector">
        <button
          v-for="opt in timeRangeOptions"
          :key="opt.value"
          class="range-btn"
          :class="{ active: stats.timeRange === opt.value }"
          @click="stats.timeRange = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <div class="stats-content">
      <div v-if="stats.isLoading" class="loading-overlay">
        <div class="loading-spinner" />
        <span>{{ t('stats.loading') }}</span>
      </div>

      <div class="overview-cards">
        <div class="overview-card">
          <div class="overview-icon" style="background: rgba(99,102,241,0.12); color: #6366f1;">
            <span class="i-lucide:eye" />
          </div>
          <div class="overview-info">
            <div class="overview-value">{{ stats.overview.totalVisits.toLocaleString() }}</div>
            <div class="overview-label">{{ t('stats.totalVisits') }}</div>
          </div>
        </div>
        <div class="overview-card">
          <div class="overview-icon" style="background: rgba(16,185,129,0.12); color: #10b981;">
            <span class="i-lucide:calendar" />
          </div>
          <div class="overview-info">
            <div class="overview-value">{{ stats.overview.weekVisits.toLocaleString() }}</div>
            <div class="overview-label">{{ t('stats.weeklyVisits') }}</div>
          </div>
        </div>
        <div class="overview-card">
          <div class="overview-icon" style="background: rgba(245,158,11,0.12); color: #f59e0b;">
            <span class="i-lucide:trending-up" />
          </div>
          <div class="overview-info">
            <div class="overview-value">{{ stats.overview.dailyAvg }}</div>
            <div class="overview-label">{{ t('stats.dailyAvgVisits') }}</div>
          </div>
        </div>
        <div class="overview-card">
          <div class="overview-icon" style="background: rgba(139,92,246,0.12); color: #8b5cf6;">
            <span class="i-lucide:globe" />
          </div>
          <div class="overview-info">
            <div class="overview-value">{{ stats.overview.siteCount }}</div>
            <div class="overview-label">{{ t('stats.visitedSites') }}</div>
          </div>
        </div>
      </div>

      <div class="stats-section heat-section">
        <div class="section-header">
          <span class="i-lucide:grid-3x3 section-icon" />
          <span>{{ t('stats.heatmap') }}</span>
        </div>
        <div class="heatmap-wrapper">
          <div class="heatmap">
            <div class="heatmap-labels">
              <span v-for="d in dayLabels" :key="d" class="heatmap-day-label">{{ d }}</span>
            </div>
            <div class="heatmap-grid">
              <div
                v-for="(cell, idx) in stats.heatmap"
                :key="idx"
                class="heatmap-cell"
                :class="{
                  'is-current': isCurrentHeatCell(cell),
                  'is-clickable': cell.count > 0,
                  'hour-mark': cell.hour % 6 === 0,
                }"
                :style="{ backgroundColor: HEAT_COLORS[cell.level] }"
                :title="t('stats.heatCellTitle', { day: dayLabels[cell.day], hour: cell.hour, count: cell.count })"
                @click="onHeatCellClick(cell)"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="lower-grid">
        <div class="stats-section top-sites-section">
          <div class="section-header">
            <span class="i-lucide:crown section-icon" />
            <span>{{ t('stats.topSitesTitle') }}</span>
          </div>
          <div class="top-sites-list">
            <div
              v-for="(site, idx) in stats.topSites"
              :key="site.domain"
              class="top-site-item"
              @click="onTopSiteClick(site.domain)"
              @contextmenu.prevent="openUrl('https://' + site.domain)"
            >
              <img :src="site.favicon" class="site-favicon" @error="($event.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><circle cx=%2212%22 cy=%2212%22 r=%2210%22 fill=%22%2364748b%22/></svg>'">
              <div class="site-rank" :style="{ backgroundColor: site.color }">{{ idx + 1 }}</div>
              <div class="site-info">
                <div class="site-domain">{{ site.domain }}</div>
                <div class="site-count">{{ t('stats.visitsCount', { count: site.count }) }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="right-column">
          <div class="stats-section productivity-section">
            <div class="section-header">
              <span class="i-lucide:zap section-icon" />
              <span>{{ t('stats.productivity') }}</span>
              <span class="prod-level" :class="stats.productivity.level">{{ t('stats.prodLevel.' + stats.productivity.level) }}</span>
            </div>
            <div class="prod-score">
              <div class="prod-ring">
                <svg viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border-color)" stroke-width="8" />
                  <circle
                    cx="50" cy="50" r="40"
                    fill="none"
                    stroke="#10b981"
                    stroke-width="8"
                    stroke-linecap="round"
                    :stroke-dasharray="`${stats.productivity.score * 2.51} 251`"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div class="prod-value">{{ stats.productivity.score }}<span class="prod-unit">%</span></div>
              </div>
              <div class="prod-breakdown">
                <div class="prod-row">
                  <span class="prod-dot productive" />
                  <span>{{ t('stats.productive') }}</span>
                  <span class="prod-count">{{ stats.productivity.productiveCount }}</span>
                </div>
                <div class="prod-row">
                  <span class="prod-dot unproductive" />
                  <span>{{ t('stats.entertainment') }}</span>
                  <span class="prod-count">{{ stats.productivity.unproductiveCount }}</span>
                </div>
                <div class="prod-row">
                  <span class="prod-dot neutral" />
                  <span>{{ t('stats.neutral') }}</span>
                  <span class="prod-count">{{ stats.productivity.neutralCount }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="stats-section rhythm-section">
            <div class="section-header">
              <span class="i-lucide:clock section-icon" />
              <span>{{ t('stats.browsingRhythm') }}</span>
              <span class="rhythm-pattern">{{ t('stats.rhythmTypes.' + stats.rhythm.pattern) }}</span>
            </div>
            <div class="rhythm-info">
              <div class="rhythm-item">
                <span class="i-lucide:sun rhythm-icon" />
                <span>{{ t('stats.peak') }}: {{ stats.rhythm.peakHour }}:00</span>
              </div>
              <div class="rhythm-item">
                <span class="i-lucide:calendar-days rhythm-icon" />
                <span>{{ t('stats.weekPrefix') }}{{ dayLabels[stats.rhythm.peakDay] }}</span>
              </div>
              <div class="rhythm-item">
                <span class="i-lucide:layers rhythm-icon" />
                <span>{{ t('stats.session') }}: {{ stats.rhythm.avgSessionLength }} {{ t('stats.recordsUnit') }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="advanced-sections">
        <component :is="SmartTimeline" v-if="loadedComponents.timeline" />
        <component :is="SmartAssistant" v-if="loadedComponents.assistant" />
        <component :is="BrowsingDNA" v-if="loadedComponents.dna" />
        <component :is="EnhancedCharts" v-if="loadedComponents.charts" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--app-bg);
  color: var(--text-primary);
}

.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--app-surface);
  flex-shrink: 0;
}

.stats-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}

.stats-title-icon {
  font-size: 18px;
  color: var(--primary-color);
}

.time-range-selector {
  display: flex;
  gap: 4px;
}

.range-btn {
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.range-btn:hover {
  background: var(--primary-light);
}

.range-btn.active {
  background: var(--primary-light);
  color: var(--primary-color);
  border-color: var(--primary-color);
}

.stats-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.loading-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  gap: 12px;
  color: var(--text-muted);
  font-size: 12px;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.overview-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 8px;
  background: var(--app-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
}

.overview-icon {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
}

.overview-value {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
}

.overview-label {
  font-size: 9px;
  color: var(--text-muted);
}

.heat-section {
  margin-bottom: 12px;
}

.stats-section {
  background: var(--app-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 12px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 10px;
}

.section-icon {
  font-size: 14px;
  color: var(--primary-color);
}

.heat-section {
  margin-bottom: 12px;
}

.heatmap-wrapper {
  overflow-x: auto;
}

.heatmap {
  display: flex;
  gap: 4px;
  align-items: stretch;
  min-width: fit-content;
}

.heatmap-labels {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex-shrink: 0;
}

.heatmap-day-label {
  font-size: 9px;
  color: var(--text-muted);
  line-height: 12px;
  height: 12px;
  text-align: right;
}

.heatmap-grid {
  display: grid;
  grid-template-rows: repeat(7, 12px);
  grid-auto-flow: column;
  grid-auto-columns: 12px;
  gap: 2px;
}

.heatmap-cell {
  border-radius: 2px;
  transition: background-color 0.15s ease;
}

.heatmap-cell.is-clickable {
  cursor: pointer;
}

.heatmap-cell.is-clickable:hover {
  outline: 1.5px solid var(--primary-color);
  z-index: 1;
}

.heatmap-cell.is-current {
  outline: 1.5px solid var(--primary-color);
  z-index: 2;
}

.heatmap-cell.hour-mark {
  border-bottom: 2px solid var(--border-color);
}

.top-sites-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.top-site-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.top-site-item:hover {
  background: var(--primary-light);
}

.site-favicon {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  flex-shrink: 0;
}

.site-rank {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
}

.site-domain {
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.site-count {
  font-size: 9px;
  color: var(--text-muted);
}

.prod-level {
  margin-left: auto;
  font-size: 9px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}

.prod-level.excellent { background: rgba(16,185,129,0.15); color: #10b981; }
.prod-level.good { background: rgba(99,102,241,0.15); color: #6366f1; }
.prod-level.fair { background: rgba(245,158,11,0.15); color: #f59e0b; }
.prod-level.poor { background: rgba(239,68,68,0.15); color: #ef4444; }

.prod-breakdown {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.prod-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
}

.prod-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.prod-dot.productive { background: #10b981; }
.prod-dot.unproductive { background: #ef4444; }
.prod-dot.neutral { background: #64748b; }

.prod-count {
  margin-left: auto;
  font-weight: 600;
  color: var(--text-secondary);
}

.rhythm-pattern {
  margin-left: auto;
  font-size: 9px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(139,92,246,0.15);
  color: #8b5cf6;
}

.rhythm-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rhythm-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.rhythm-icon {
  font-size: 12px;
  color: var(--text-muted);
}

.lower-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}

.right-column {
  display: flex;
  flex-direction: row;
  gap: 12px;
  flex-wrap: wrap;
}

.productivity-section {
  flex: 1;
  min-width: 0;
}

.rhythm-section {
  flex: 1;
  min-width: 0;
}

.prod-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.prod-ring {
  position: relative;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
}

.prod-ring svg {
  width: 100%;
  height: 100%;
}

.prod-value {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 14px;
  font-weight: 700;
}

.prod-unit {
  font-size: 9px;
  font-weight: 400;
}

.advanced-sections {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
