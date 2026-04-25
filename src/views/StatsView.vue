<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useStatsStore } from '@/stores/stats'
import { useUIStore } from '@/stores/ui'
import { getFaviconUrl, safeOpenUrl } from '@/utils/helpers'
import { useStatsNavigation } from '@/composables/useStatsNavigation'
import SmartTimeline from '@/components/business/SmartTimeline.vue'
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

const showProdPopup = ref(false)
const hoveredCell = ref<{ day: number; hour: number; count: number } | null>(null)
const tooltipPos = ref({ x: 0, y: 0 })
const clickedCellKey = ref<string | null>(null)

const prodLevelClass = computed(() => stats.productivity.level)
const prodLevelLabel = computed(() => t('stats.prodLevel.' + stats.productivity.level))

function onHeatCellClick(cell: { day: number; hour: number; count: number }) {
  if (cell.count === 0) return
  const key = `${cell.day}-${cell.hour}`
  clickedCellKey.value = key
  setTimeout(() => {
    if (clickedCellKey.value === key) clickedCellKey.value = null
  }, 300)
  const dayName = dayLabels.value[cell.day]
  const hourStr = String(cell.hour).padStart(2, '0')
  navigateWithTimeFilter(cell.day, cell.hour, cell.hour + 1, `${t('stats.weekPrefix')}${dayName} ${hourStr}:00-${hourStr}:59`)
}

function onHeatCellEnter(cell: { day: number; hour: number; count: number }, event: MouseEvent) {
  hoveredCell.value = cell
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const wrapper = target.closest('.heatmap-wrapper')
  if (wrapper) {
    const wrapperRect = wrapper.getBoundingClientRect()
    tooltipPos.value = {
      x: rect.left - wrapperRect.left + rect.width / 2,
      y: rect.top - wrapperRect.top,
    }
  }
}

function onHeatCellLeave() {
  hoveredCell.value = null
}

const tooltipText = computed(() => {
  if (!hoveredCell.value) return ''
  const cell = hoveredCell.value
  const dayName = dayLabels.value[cell.day]
  return t('stats.heatCellTitle', { day: dayName, hour: cell.hour, count: cell.count })
})

function onTopSiteClick(domain: string) {
  navigateWithDomainFilter(domain, domain)
}

function openUrl(url: string) {
  safeOpenUrl(url)
}

function toggleProdPopup() {
  showProdPopup.value = !showProdPopup.value
}

const statsViewRef = ref<HTMLElement | null>(null)

function onDocClick(e: MouseEvent) {
  if (!showProdPopup.value) return
  const target = e.target as HTMLElement
  if (target.closest('.overview-item--prod')) return
  if (target.closest('.prod-popup')) return
  showProdPopup.value = false
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))

watch(() => history.allRecords.length, (len) => {
  if (len > 0) {
    stats.computeStats(history.allRecords)
  }
}, { immediate: true })

watch(() => stats.timeRange, () => {
  stats.computeStats(history.allRecords)
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
      <div class="overview-strip">
        <div class="overview-item">
          <span class="overview-value">{{ stats.overview.totalVisits.toLocaleString() }}</span>
          <span class="overview-label">{{ t('stats.totalVisits') }}</span>
        </div>
        <div class="overview-item">
          <span class="overview-value">{{ stats.overview.weekVisits.toLocaleString() }}</span>
          <span class="overview-label">{{ t('stats.weeklyVisits') }}</span>
        </div>
        <div class="overview-item">
          <span class="overview-value">{{ stats.overview.dailyAvg }}</span>
          <span class="overview-label">{{ t('stats.dailyAvgVisits') }}</span>
        </div>
        <div class="overview-item">
          <span class="overview-value">{{ stats.overview.siteCount }}</span>
          <span class="overview-label">{{ t('stats.visitedSites') }}</span>
        </div>
        <div class="overview-item overview-item--prod" @click="toggleProdPopup">
          <span class="prod-dot" :class="prodLevelClass" />
          <span class="overview-value">{{ stats.productivity.score }}%</span>
          <span class="overview-label">{{ t('stats.productivity') }}</span>
          <Transition name="popup">
            <div v-if="showProdPopup" class="prod-popup" @click.stop>
              <div class="prod-popup-title">{{ t('stats.productivity') }}</div>
              <div class="prod-popup-row">
                <span class="prod-dot productive" />
                <span>{{ t('stats.productive') }}</span>
                <span class="prod-popup-count">{{ stats.productivity.productiveCount }}</span>
              </div>
              <div class="prod-popup-row">
                <span class="prod-dot unproductive" />
                <span>{{ t('stats.entertainment') }}</span>
                <span class="prod-popup-count">{{ stats.productivity.unproductiveCount }}</span>
              </div>
              <div class="prod-popup-row">
                <span class="prod-dot neutral" />
                <span>{{ t('stats.neutral') }}</span>
                <span class="prod-popup-count">{{ stats.productivity.neutralCount }}</span>
              </div>
              <div class="prod-popup-divider" />
              <div class="prod-popup-rhythm">
                <span class="i-lucide:sun prod-popup-icon" />
                <span>{{ t('stats.peak') }} {{ stats.rhythm.peakHour }}:00</span>
              </div>
              <div class="prod-popup-rhythm">
                <span class="i-lucide:calendar-days prod-popup-icon" />
                <span>{{ t('stats.weekPrefix') }}{{ dayLabels[stats.rhythm.peakDay] }}</span>
              </div>
              <div class="prod-popup-rhythm">
                <span class="i-lucide:layers prod-popup-icon" />
                <span>{{ t('stats.session') }} {{ stats.rhythm.avgSessionLength }}{{ t('stats.recordsUnit') }}</span>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <div class="stats-section">
        <div class="section-header">
          <span class="i-lucide:grid-3x3 section-icon" />
          <span>{{ t('stats.heatmap') }}</span>
        </div>
        <div class="heatmap-wrapper">
          <div class="heatmap">
            <div class="heatmap-labels">
              <span class="heatmap-day-label-spacer" />
              <span v-for="d in dayLabels" :key="d" class="heatmap-day-label">{{ d }}</span>
            </div>
            <div class="heatmap-body">
              <div class="heatmap-hour-labels">
                <span v-for="h in 24" :key="h-1" class="heatmap-hour-label" :class="{ 'is-visible': (h - 1) % 6 === 0 }">{{ (h - 1) % 6 === 0 ? String(h - 1).padStart(2, '0') : '' }}</span>
              </div>
              <div class="heatmap-grid">
                <div
                  v-for="(cell, idx) in stats.heatmap"
                  :key="idx"
                  class="heatmap-cell"
                  :class="{
                    'is-current': isCurrentHeatCell(cell),
                    'is-clickable': cell.count > 0,
                    'is-clicked': clickedCellKey === `${cell.day}-${cell.hour}`,
                  }"
                  :style="{ backgroundColor: HEAT_COLORS[cell.level] }"
                  @click="onHeatCellClick(cell)"
                  @mouseenter="onHeatCellEnter(cell, $event)"
                  @mouseleave="onHeatCellLeave"
                />
              </div>
              <div
                v-if="hoveredCell"
                class="heatmap-tooltip"
                :style="{ left: tooltipPos.x + 'px', top: tooltipPos.y + 'px' }"
              >
                {{ tooltipText }}
              </div>
            </div>
          </div>
        </div>
        <div class="heatmap-rhythm">
          <span class="i-lucide:sun rhythm-icon" />
          <span>{{ t('stats.peak') }} {{ stats.rhythm.peakHour }}:00</span>
          <span class="rhythm-sep" />
          <span class="i-lucide:layers rhythm-icon" />
          <span>{{ t('stats.session') }} {{ stats.rhythm.avgSessionLength }}{{ t('stats.recordsUnit') }}</span>
        </div>
      </div>

      <div class="stats-section">
        <div class="section-header">
          <span class="i-lucide:crown section-icon" />
          <span>{{ t('stats.topSitesTitle') }}</span>
        </div>
        <div class="top-sites-list">
          <div
            v-for="(site, idx) in stats.topSites.slice(0, 5)"
            :key="site.domain"
            class="top-site-item"
            @click="onTopSiteClick(site.domain)"
            @contextmenu.prevent="openUrl('https://' + site.domain)"
          >
            <img :src="site.favicon" class="site-favicon" @error="($event.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><circle cx=%2212%22 cy=%2212%22 r=%2210%22 fill=%22%2364748b%22/></svg>'">
            <span class="site-rank">{{ idx + 1 }}</span>
            <div class="site-info">
              <div class="site-domain">{{ site.domain }}</div>
              <div class="site-count">{{ t('stats.visitsCount', { count: site.count }) }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="stats-section">
        <div class="section-header">
          <span class="i-lucide:clock section-icon" />
          <span>{{ t('stats.smartTimeline') }}</span>
        </div>
        <SmartTimeline />
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
  position: sticky;
  top: 0;
  z-index: 5;
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
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.overview-strip {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 10px 8px;
  background: var(--app-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
}

.overview-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.overview-item--prod {
  cursor: pointer;
  position: relative;
  padding: 4px 8px;
  border-radius: var(--radius-md);
  transition: background 0.15s;
}

.overview-item--prod:hover {
  background: var(--primary-light);
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

.prod-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-block;
  margin-right: 2px;
}

.prod-dot.excellent { background: #10b981; }
.prod-dot.good { background: #6366f1; }
.prod-dot.fair { background: #f59e0b; }
.prod-dot.poor { background: #ef4444; }
.prod-dot.productive { background: #10b981; }
.prod-dot.unproductive { background: #ef4444; }
.prod-dot.neutral { background: #64748b; }

.prod-popup {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
  padding: 10px 12px;
  background: var(--app-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 20;
  min-width: 200px;
}

.prod-popup-title {
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.prod-popup-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  padding: 3px 0;
}

.prod-popup-count {
  margin-left: auto;
  font-weight: 600;
  color: var(--text-secondary);
}

.prod-popup-divider {
  height: 1px;
  background: var(--border-color);
  margin: 6px 0;
}

.prod-popup-rhythm {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  padding: 2px 0;
  color: var(--text-secondary);
}

.prod-popup-icon {
  font-size: 11px;
  color: var(--text-muted);
}

.popup-enter-active,
.popup-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.popup-enter-from,
.popup-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-4px);
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

.heatmap-wrapper {
  overflow-x: auto;
  position: relative;
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
  padding-top: 14px;
}

.heatmap-day-label-spacer {
  height: 0;
}

.heatmap-day-label {
  font-size: 9px;
  color: var(--text-muted);
  line-height: 12px;
  height: 12px;
  text-align: right;
}

.heatmap-body {
  display: flex;
  flex-direction: column;
  position: relative;
}

.heatmap-hour-labels {
  display: grid;
  grid-template-rows: 14px;
  grid-template-columns: repeat(24, 12px);
  gap: 2px;
  margin-bottom: 2px;
}

.heatmap-hour-label {
  font-size: 8px;
  color: var(--text-muted);
  text-align: center;
  line-height: 14px;
  overflow: visible;
  white-space: nowrap;
}

.heatmap-hour-label.is-visible {
  color: var(--text-secondary);
  font-weight: 500;
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
  transition: transform 0.12s ease, box-shadow 0.12s ease;
  position: relative;
}

.heatmap-cell.is-clickable {
  cursor: pointer;
}

.heatmap-cell.is-clickable:hover {
  transform: scale(1.4);
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.25);
  z-index: 2;
}

html.dark .heatmap-cell.is-clickable:hover {
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.5);
}

.heatmap-cell.is-current {
  box-shadow: 0 0 0 1.5px var(--heat-4);
  z-index: 1;
  animation: heatPulse 2s ease-in-out infinite;
}

@keyframes heatPulse {
  0%, 100% { box-shadow: 0 0 0 1.5px var(--heat-4); }
  50% { box-shadow: 0 0 0 2.5px var(--heat-3), 0 0 8px rgba(64, 196, 99, 0.3); }
}

.heatmap-cell.is-clicked {
  animation: heatClick 0.3s ease;
}

@keyframes heatClick {
  0% { transform: scale(1); }
  40% { transform: scale(0.75); }
  100% { transform: scale(1); }
}

.heatmap-tooltip {
  position: absolute;
  transform: translate(-50%, -100%);
  margin-top: -8px;
  padding: 4px 8px;
  font-size: 10px;
  font-weight: 500;
  color: #fff;
  background: #1b1f23;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

html.dark .heatmap-tooltip {
  background: #2d333b;
}

.heatmap-tooltip::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 4px solid #1b1f23;
}

html.dark .heatmap-tooltip::after {
  border-top-color: #2d333b;
}

.heatmap-rhythm {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 10px;
  color: var(--text-muted);
}

.rhythm-icon {
  font-size: 11px;
}

.rhythm-sep {
  width: 1px;
  height: 10px;
  background: var(--border-color);
}

.top-sites-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.top-site-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
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
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  width: 14px;
  text-align: center;
  flex-shrink: 0;
}

.site-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
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
  flex-shrink: 0;
}
</style>
