<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useStatsStore } from '@/stores/stats'
import { useUIStore } from '@/stores/ui'
import { autoTagDetailed, TAG_COLORS, getFaviconUrl, buildDomainGraph, SessionCoVisitAnalyzer, getEntityForDomain, type DomainGraphEdge } from '@/utils/helpers'
import { useStatsNavigation } from '@/composables/useStatsNavigation'
import { useI18n } from '@/i18n'

const history = useHistoryStore()
const stats = useStatsStore()
const ui = useUIStore()
const {
  HEAT_COLORS,
  isCurrentHeatCell,
  navigateWithTimeFilter,
  navigateWithTagFilter,
  navigateWithDomainFilter,
} = useStatsNavigation()
const { t } = useI18n()

const dayLabels = computed(() => [
  t('stats.weekdays.0'), t('stats.weekdays.1'), t('stats.weekdays.2'),
  t('stats.weekdays.3'), t('stats.weekdays.4'), t('stats.weekdays.5'), t('stats.weekdays.6'),
])

const activeTab = ref(0)
const trendRange = ref<'7d' | '30d'>('7d')
const hoveredHeatCell = ref<{ day: number; hour: number; count: number } | null>(null)
const heatTooltipPos = ref({ x: 0, y: 0 })
const hoveredTrendIdx = ref(-1)

const tagDistributionData = ref<{ tag: string; count: number; percentage: number; color: string }[]>([])

interface DomainRelationItem {
  domain: string
  favicon: string
  entityName: string
  visitCount: number
  expanded: boolean
  relations: Array<{
    domain: string
    favicon: string
    type: string
    typeLabel: string
    typeColor: string
    weight: number
  }>
}

const domainRelationData = ref<DomainRelationItem[]>([])

const RELATION_TYPE_LABELS: Record<string, string> = {
  'same-entity': 'stats.sameEntity',
  'parent-subsidiary': 'stats.parentSubsidiary',
  'sibling': 'stats.sibling',
  'session-co-visit': 'stats.coVisit',
}

const RELATION_TYPE_COLORS: Record<string, string> = {
  'same-entity': '#6366f1',
  'parent-subsidiary': '#8b5cf6',
  'sibling': '#a78bfa',
  'session-co-visit': '#94a3b8',
}

let tagDistFrame: number | null = null
let graphFrame: number | null = null

const TAG_CACHE = new Map<string, string[]>()

function getCachedTags(url: string, title: string): string[] {
  const key = `${url}|${title || ''}`
  let cached = TAG_CACHE.get(key)
  if (!cached) {
    cached = autoTagDetailed(url, title).map(t => t.tag)
    if (TAG_CACHE.size < 5000) {
      TAG_CACHE.set(key, cached)
    }
  }
  return cached
}

function computeTagDistribution() {
  const records = history.allRecords
  if (records.length === 0) return

  const sampleSize = Math.min(500, records.length)
  const step = Math.max(1, Math.floor(records.length / sampleSize))
  const tagMap = new Map<string, number>()

  for (let i = 0; i < records.length; i += step) {
    const r = records[i]
    const tags = getCachedTags(r.url, r.title)
    for (const t of tags) {
      tagMap.set(t, (tagMap.get(t) || 0) + 1)
    }
  }

  const total = Array.from(tagMap.values()).reduce((s, v) => s + v, 0) || 1
  tagDistributionData.value = Array.from(tagMap.entries())
    .map(([tag, count]) => ({
      tag,
      count,
      percentage: Math.round((count / total) * 100),
      color: TAG_COLORS[tag] || '#64748b',
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

function computeDomainRelation() {
  const records = history.allRecords
  if (records.length === 0) return

  const domainMap = new Map<string, number>()
  for (let i = 0; i < records.length; i++) {
    const r = records[i]
    domainMap.set(r.domain, (domainMap.get(r.domain) || 0) + 1)
  }

  const { nodes: graphNodes, edges: entityEdges } = buildDomainGraph(domainMap, 15)

  const coVisitAnalyzer = new SessionCoVisitAnalyzer(5 * 60 * 1000)
  coVisitAnalyzer.analyzeSessions(records, 50)
  const coVisitEdges = coVisitAnalyzer.getCoVisitEdges(2)

  const allEdges: DomainGraphEdge[] = [...entityEdges]
  const existingEdgeKeys = new Set(
    entityEdges.map(e => [e.source, e.target].sort().join('|'))
  )
  for (const ce of coVisitEdges) {
    const key = [ce.source, ce.target].sort().join('|')
    if (!existingEdgeKeys.has(key)) {
      allEdges.push(ce)
      existingEdgeKeys.add(key)
    }
  }

  const domainEdges = new Map<string, Array<{ domain: string; type: string; weight: number }>>()
  for (const e of allEdges) {
    const a = domainEdges.get(e.source) || []
    a.push({ domain: e.target, type: e.type, weight: e.weight })
    domainEdges.set(e.source, a)

    const b = domainEdges.get(e.target) || []
    b.push({ domain: e.source, type: e.type, weight: e.weight })
    domainEdges.set(e.target, b)
  }

  const { t } = useI18n()
  domainRelationData.value = graphNodes.map(n => {
    const entity = n.entity
    const edges = domainEdges.get(n.domain) || []
    return {
      domain: n.domain,
      favicon: getFaviconUrl(`https://${n.domain}`),
      entityName: entity?.names?.zh || entity?.name || '',
      visitCount: n.visitCount,
      expanded: false,
      relations: edges
        .sort((a, b) => b.weight - a.weight)
        .map(e => ({
          domain: e.domain,
          favicon: getFaviconUrl(`https://${e.domain}`),
          type: e.type,
          typeLabel: t(RELATION_TYPE_LABELS[e.type] || 'stats.coVisit'),
          typeColor: RELATION_TYPE_COLORS[e.type] || '#94a3b8',
          weight: e.weight,
        })),
    }
  }).filter(item => item.relations.length > 0)
}

function toggleRelationExpand(idx: number) {
  domainRelationData.value[idx].expanded = !domainRelationData.value[idx].expanded
}

onMounted(() => {
  tagDistFrame = requestAnimationFrame(() => computeTagDistribution())
  graphFrame = requestAnimationFrame(() => computeDomainRelation())
})

onUnmounted(() => {
  if (tagDistFrame) cancelAnimationFrame(tagDistFrame)
  if (graphFrame) cancelAnimationFrame(graphFrame)
})

function isTab(n: number) { return activeTab.value === n }

const tabs = computed(() => [
  { label: t('charts.heatmap'), icon: 'i-lucide:grid-3x3' },
  { label: t('charts.trend'), icon: 'i-lucide:trending-up' },
  { label: t('charts.tagDistribution'), icon: 'i-lucide:pie-chart' },
  { label: t('charts.domainRelation'), icon: 'i-lucide:git-branch' },
])

function onHeatCellClick(cell: { day: number; hour: number; count: number }) {
  if (cell.count === 0) return
  const dayName = dayLabels.value[cell.day]
  const hourStr = String(cell.hour).padStart(2, '0')
  navigateWithTimeFilter(cell.day, cell.hour, cell.hour + 1, t('charts.heatCellTime', { day: dayName, hour: hourStr }))
}

function onHeatCellHover(cell: { day: number; hour: number; count: number }, event: MouseEvent) {
  hoveredHeatCell.value = cell
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const parentRect = (event.currentTarget as HTMLElement).closest('.heatmap-wrapper')!.getBoundingClientRect()
  heatTooltipPos.value = {
    x: rect.left - parentRect.left + rect.width / 2,
    y: rect.top - parentRect.top - 4,
  }
}

function onHeatCellLeave() {
  hoveredHeatCell.value = null
}

const trendData = computed(() => {
  if (trendRange.value === '7d') {
    return stats.weeklyTrend.map(item => ({
      label: t('stats.weekPrefix') + dayLabels.value[item.dayIndex],
      count: item.count,
    }))
  }
  const now = new Date()
  const dayBuckets = new Map<string, number>()
  const records = history.allRecords
  for (let i = 0; i < records.length; i++) {
    const r = records[i]
    const d = new Date(r.lastVisitTime)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    dayBuckets.set(key, (dayBuckets.get(key) || 0) + 1)
  }
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (29 - i))
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    const label = `${d.getMonth() + 1}/${d.getDate()}`
    return { label, count: dayBuckets.get(key) || 0 }
  })
})

const maxTrend = computed(() => Math.max(...trendData.value.map(t => t.count), 1))

const trendPoints = computed(() => {
  const data = trendData.value
  const w = 340
  const h = 120
  const padX = 30
  const padY = 10
  const plotW = w - padX * 2
  const plotH = h - padY * 2
  const max = maxTrend.value
  return data.map((item, i) => ({
    x: padX + (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2),
    y: padY + plotH - (max > 0 ? (item.count / max) * plotH : 0),
    ...item,
  }))
})

const trendPolyline = computed(() =>
  trendPoints.value.map(p => `${p.x},${p.y}`).join(' ')
)

const trendAreaPath = computed(() => {
  const pts = trendPoints.value
  if (pts.length === 0) return ''
  const h = 120
  const padY = 10
  const plotH = h - padY * 2
  const bottom = padY + plotH
  let d = `M${pts[0].x},${bottom}`
  pts.forEach(p => { d += ` L${p.x},${p.y}` })
  d += ` L${pts[pts.length - 1].x},${bottom} Z`
  return d
})

const trendYLabels = computed(() => {
  const max = maxTrend.value
  const step = Math.ceil(max / 4)
  return Array.from({ length: 5 }, (_, i) => step * i)
})

const tagDonutSegments = computed(() => {
  const data = tagDistributionData.value
  const total = data.reduce((s, d) => s + d.count, 0) || 1
  const cx = 80
  const cy = 80
  const r = 60
  const innerR = 38
  let startAngle = -Math.PI / 2
  return data.map(d => {
    const angle = (d.count / total) * 2 * Math.PI
    const endAngle = startAngle + angle
    const largeArc = angle > Math.PI ? 1 : 0
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const ix1 = cx + innerR * Math.cos(endAngle)
    const iy1 = cy + innerR * Math.sin(endAngle)
    const ix2 = cx + innerR * Math.cos(startAngle)
    const iy2 = cy + innerR * Math.sin(startAngle)
    const path = [
      `M${x1},${y1}`,
      `A${r},${r} 0 ${largeArc} 1 ${x2},${y2}`,
      `L${ix1},${iy1}`,
      `A${innerR},${innerR} 0 ${largeArc} 0 ${ix2},${iy2}`,
      'Z',
    ].join(' ')
    const midAngle = startAngle + angle / 2
    startAngle = endAngle
    return { ...d, path, midAngle }
  })
})

function onTagSegmentClick(tag: string) {
  navigateWithTagFilter(tag, t('charts.tagFilterLabel', { tag: t('tags.' + tag) }))
}

</script>

<template>
  <div class="enhanced-charts">
    <div class="tab-bar">
      <button
        v-for="(tab, idx) in tabs"
        :key="idx"
        class="tab-btn"
        :class="{ active: activeTab === idx }"
        @click="activeTab = idx"
      >
        <span :class="tab.icon" class="tab-icon" />
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </div>

    <div class="tab-content">
      <div v-if="isTab(0)" class="heatmap-wrapper">
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
              @click="onHeatCellClick(cell)"
              @mouseenter="onHeatCellHover(cell, $event)"
              @mouseleave="onHeatCellLeave"
            />
          </div>
        </div>
        <div
          v-if="hoveredHeatCell"
          class="heat-tooltip"
          :style="{ left: heatTooltipPos.x + 'px', top: heatTooltipPos.y + 'px' }"
        >
          <div class="heat-tooltip-title">
            {{ t('charts.heatCellTime', { day: dayLabels[hoveredHeatCell.day], hour: String(hoveredHeatCell.hour).padStart(2, '0') }) }}
          </div>
          <div class="heat-tooltip-count">{{ t('charts.visitCount', { count: hoveredHeatCell.count }) }}</div>
        </div>
      </div>

      <div v-if="isTab(1)" class="trend-wrapper">
        <div class="trend-range-toggle">
          <button
            class="range-btn"
            :class="{ active: trendRange === '7d' }"
            @click="trendRange = '7d'"
          >{{ t('charts.days7') }}</button>
          <button
            class="range-btn"
            :class="{ active: trendRange === '30d' }"
            @click="trendRange = '30d'"
          >{{ t('charts.days30') }}</button>
        </div>
        <svg class="trend-svg" viewBox="0 0 340 140" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--primary-color)" stop-opacity="0.3" />
              <stop offset="100%" stop-color="var(--primary-color)" stop-opacity="0.02" />
            </linearGradient>
          </defs>
          <g class="trend-grid">
            <line
              v-for="(val, i) in trendYLabels"
              :key="'grid-' + i"
              :x1="30"
              :y1="10 + (120 - 20) * (1 - val / maxTrend)"
              :x2="310"
              :y2="10 + (120 - 20) * (1 - val / maxTrend)"
              stroke="var(--border-color)"
              stroke-width="0.5"
              stroke-dasharray="3,3"
            />
            <text
              v-for="(val, i) in trendYLabels"
              :key="'label-' + i"
              :x="26"
              :y="10 + (120 - 20) * (1 - val / maxTrend) + 3"
              text-anchor="end"
              fill="var(--text-muted)"
              font-size="8"
            >{{ val }}</text>
          </g>
          <path :d="trendAreaPath" fill="url(#trendGrad)" />
          <polyline
            :points="trendPolyline"
            fill="none"
            stroke="var(--primary-color)"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
          <g class="trend-dots">
            <circle
              v-for="(pt, i) in trendPoints"
              :key="i"
              :cx="pt.x"
              :cy="pt.y"
              :r="hoveredTrendIdx === i ? 4 : 2.5"
              :fill="hoveredTrendIdx === i ? 'var(--primary-color)' : 'var(--app-surface)'"
              :stroke="'var(--primary-color)'"
              stroke-width="1.5"
              @mouseenter="hoveredTrendIdx = i"
              @mouseleave="hoveredTrendIdx = -1"
              style="cursor: pointer"
            />
          </g>
          <g class="trend-x-labels">
            <text
              v-for="(pt, i) in trendPoints"
              :key="'xl-' + i"
              :x="pt.x"
              :y="138"
              text-anchor="middle"
              fill="var(--text-muted)"
              font-size="7"
            >{{ trendRange === '7d' ? pt.label : (i % 5 === 0 ? pt.label : '') }}</text>
          </g>
          <g v-if="hoveredTrendIdx >= 0" class="trend-hover-info">
            <rect
              :x="trendPoints[hoveredTrendIdx].x - 30"
              :y="trendPoints[hoveredTrendIdx].y - 24"
              width="60"
              height="18"
              rx="4"
              fill="var(--app-surface)"
              stroke="var(--border-color)"
              stroke-width="0.5"
            />
            <text
              :x="trendPoints[hoveredTrendIdx].x"
              :y="trendPoints[hoveredTrendIdx].y - 12"
              text-anchor="middle"
              fill="var(--text-primary)"
              font-size="9"
              font-weight="600"
            >{{ trendPoints[hoveredTrendIdx].count }}</text>
          </g>
        </svg>
      </div>

      <div v-if="isTab(2)" class="tag-wrapper">
        <div class="tag-chart-area">
          <svg class="tag-svg" viewBox="0 0 160 160">
            <g
              v-for="(seg, i) in tagDonutSegments"
              :key="i"
              class="tag-segment"
              @click="onTagSegmentClick(seg.tag)"
            >
              <path
                :d="seg.path"
                :fill="seg.color"
                :opacity="0.85"
                stroke="var(--app-bg)"
                stroke-width="1"
                style="cursor: pointer; transition: opacity 0.2s"
              />
            </g>
            <text x="80" y="76" text-anchor="middle" fill="var(--text-primary)" font-size="16" font-weight="700">
              {{ tagDistributionData.reduce((s, d) => s + d.count, 0) }}
            </text>
            <text x="80" y="92" text-anchor="middle" fill="var(--text-muted)" font-size="9">
              {{ t('charts.totalTags') }}
            </text>
          </svg>
        </div>
        <div class="tag-legend">
          <div
            v-for="(item, i) in tagDistributionData"
            :key="i"
            class="tag-legend-item"
            @click="onTagSegmentClick(item.tag)"
          >
            <span class="tag-legend-dot" :style="{ backgroundColor: item.color }" />
            <span class="tag-legend-name">{{ t('tags.' + item.tag) }}</span>
            <span class="tag-legend-count">{{ item.count }}</span>
            <span class="tag-legend-pct">{{ item.percentage }}%</span>
          </div>
        </div>
      </div>

      <div v-if="isTab(3)" class="domain-relation-tab">
        <div v-if="domainRelationData.length === 0" class="relation-empty">
          {{ t('stats.noRelationData') }}
        </div>
        <div v-for="(item, idx) in domainRelationData" :key="item.domain" class="relation-group">
          <div class="relation-header" @click="toggleRelationExpand(idx)">
            <span class="i-lucide:chevron-down relation-chevron" :class="{ expanded: item.expanded }" />
            <img :src="item.favicon" class="relation-favicon" @error="($event.target as HTMLImageElement).style.display = 'none'" />
            <span class="relation-domain">{{ item.domain }}</span>
            <span v-if="item.entityName" class="relation-entity">{{ item.entityName }}</span>
            <span class="relation-count">{{ item.relations.length }}</span>
          </div>
          <div v-if="item.expanded" class="relation-list">
            <div v-for="rel in item.relations" :key="rel.domain" class="relation-item" @click="navigateWithDomainFilter(rel.domain, rel.domain)">
              <img :src="rel.favicon" class="relation-item-favicon" @error="($event.target as HTMLImageElement).style.display = 'none'" />
              <span class="relation-item-domain">{{ rel.domain }}</span>
              <span class="relation-type-badge" :style="{ color: rel.typeColor, background: rel.typeColor + '18' }">{{ rel.typeLabel }}</span>
              <span class="relation-weight">{{ Math.round(rel.weight * 100) }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.enhanced-charts {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--app-bg);
  color: var(--text-primary);
}

.tab-bar {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  background: var(--app-surface);
  flex-shrink: 0;
}

.tab-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
  font-size: 10px;
}

.tab-btn:hover {
  color: var(--text-secondary);
  background: var(--primary-light);
}

.tab-btn.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}

.tab-icon {
  font-size: 14px;
}

.tab-label {
  font-size: 10px;
  font-weight: 500;
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.heatmap-wrapper {
  position: relative;
}

.heatmap {
  padding: 4px 0;
  display: flex;
  gap: 4px;
  align-items: stretch;
}

.heatmap-labels {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 0;
  flex-shrink: 0;
}

.heatmap-day-label {
  font-size: 8px;
  color: var(--text-muted);
  line-height: 10px;
  height: 10px;
  text-align: right;
}

.heatmap-grid {
  display: grid;
  grid-template-rows: repeat(7, 10px);
  grid-auto-flow: column;
  grid-auto-columns: 10px;
  gap: 2px;
  flex: 1;
}

.heatmap-cell {
  border-radius: 2px;
  transition: background-color 0.2s ease;
}

.heatmap-cell.is-clickable {
  cursor: pointer;
}

.heatmap-cell.is-clickable:hover {
  outline: 1.5px solid var(--primary-color);
  z-index: 1;
}

.heatmap-cell.is-current {
  animation: pulse-border 2s ease-in-out infinite;
  outline: 1.5px solid var(--primary-color);
  z-index: 2;
}

.heatmap-cell.hour-mark {
  border-bottom: 2px solid var(--border-color);
}

@keyframes pulse-border {
  0%, 100% { outline-color: var(--primary-color); outline-offset: 0; }
  50% { outline-color: rgba(99, 102, 241, 0.3); outline-offset: 1px; }
}

.heat-tooltip {
  position: absolute;
  transform: translate(-50%, -100%);
  background: var(--app-surface);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 6px 10px;
  pointer-events: none;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  white-space: nowrap;
}

.heat-tooltip-title {
  font-size: 10px;
  color: var(--text-secondary);
  margin-bottom: 2px;
}

.heat-tooltip-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary-color);
}

.trend-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.trend-range-toggle {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}

.range-btn {
  padding: 2px 10px;
  font-size: 10px;
  font-weight: 500;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.range-btn:hover {
  background: var(--primary-light);
}

.range-btn.active {
  background: var(--primary-light);
  color: var(--primary-color);
  border-color: var(--primary-color);
}

.trend-svg {
  width: 100%;
  height: auto;
}

.tag-wrapper {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.tag-chart-area {
  flex-shrink: 0;
  width: 140px;
}

.tag-svg {
  width: 100%;
  height: auto;
}

.tag-segment path:hover {
  opacity: 1 !important;
  filter: brightness(1.15);
}

.tag-legend {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.tag-legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 4px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}

.tag-legend-item:hover {
  background: var(--primary-light);
}

.tag-legend-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tag-legend-name {
  font-size: 10px;
  color: var(--text-primary);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tag-legend-count {
  font-size: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.tag-legend-pct {
  font-size: 10px;
  color: var(--text-secondary);
  font-weight: 500;
  width: 30px;
  text-align: right;
  flex-shrink: 0;
}

.domain-relation-tab {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.relation-empty {
  text-align: center;
  padding: 20px;
  font-size: 11px;
  color: var(--text-muted);
}

.relation-group {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
}

.relation-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.relation-header:hover {
  background: var(--primary-light);
}

.relation-chevron {
  font-size: 12px;
  color: var(--text-muted);
  transition: transform 0.2s;
  flex-shrink: 0;
}

.relation-chevron.expanded {
  transform: rotate(0deg);
}

.relation-chevron:not(.expanded) {
  transform: rotate(-90deg);
}

.relation-favicon {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  flex-shrink: 0;
}

.relation-domain {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-primary);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.relation-entity {
  font-size: 9px;
  font-weight: 500;
  color: var(--primary-color);
  background: var(--primary-light);
  padding: 1px 5px;
  border-radius: 6px;
  white-space: nowrap;
  flex-shrink: 0;
}

.relation-count {
  font-size: 9px;
  color: var(--text-muted);
  background: var(--app-bg);
  padding: 1px 5px;
  border-radius: 6px;
  flex-shrink: 0;
}

.relation-list {
  border-top: 1px solid var(--border-color);
  background: var(--app-bg);
}

.relation-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px 5px 26px;
  cursor: pointer;
  transition: background 0.15s;
}

.relation-item:hover {
  background: var(--primary-light);
}

.relation-item-favicon {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
}

.relation-item-domain {
  font-size: 10px;
  color: var(--text-secondary);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.relation-type-badge {
  font-size: 8px;
  font-weight: 500;
  padding: 1px 4px;
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
}

.relation-weight {
  font-size: 9px;
  color: var(--text-muted);
  flex-shrink: 0;
}
</style>
