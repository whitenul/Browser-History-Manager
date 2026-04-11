<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useStatsStore } from '@/stores/stats'
import { useUIStore } from '@/stores/ui'
import { autoTagDetailed, TAG_COLORS, getFaviconUrl } from '@/utils/helpers'
import { useStatsNavigation } from '@/composables/useStatsNavigation'

const history = useHistoryStore()
const stats = useStatsStore()
const ui = useUIStore()
const {
  HEAT_COLORS,
  DAY_LABELS: dayLabels,
  isCurrentHeatCell,
  navigateWithTimeFilter,
  navigateWithTagFilter,
} = useStatsNavigation()

const activeTab = ref(0)
const trendRange = ref<'7d' | '30d'>('7d')
const hoveredHeatCell = ref<{ day: number; hour: number; count: number } | null>(null)
const heatTooltipPos = ref({ x: 0, y: 0 })
const hoveredTrendIdx = ref(-1)
const hoveredGraphNode = ref<string | null>(null)

const tagDistributionData = ref<{ tag: string; count: number; percentage: number; color: string }[]>([])
const domainGraphData = ref<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] })

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

function computeDomainGraph() {
  const records = history.allRecords
  if (records.length === 0) return

  const domainMap = new Map<string, number>()
  for (let i = 0; i < records.length; i++) {
    const r = records[i]
    domainMap.set(r.domain, (domainMap.get(r.domain) || 0) + 1)
  }

  const topDomains = Array.from(domainMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)

  const topDomainSet = new Set(topDomains.map(d => d[0]))
  const edgeMap = new Map<string, number>()

  const sorted = [...records].sort((a, b) => a.lastVisitTime - b.lastVisitTime)
  const windowSize = 10 * 60 * 1000

  for (let i = 0; i < sorted.length; i++) {
    const r1 = sorted[i]
    if (!topDomainSet.has(r1.domain)) continue

    const maxTime = r1.lastVisitTime + windowSize
    for (let j = i + 1; j < sorted.length && sorted[j].lastVisitTime <= maxTime; j++) {
      const r2 = sorted[j]
      if (r1.domain === r2.domain) continue
      if (!topDomainSet.has(r2.domain)) continue

      const key = [r1.domain, r2.domain].sort().join('|')
      edgeMap.set(key, (edgeMap.get(key) || 0) + 1)
    }
  }

  const edges = Array.from(edgeMap.entries())
    .map(([key, weight]) => {
      const [from, to] = key.split('|')
      return { from, to, weight }
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 30)

  const maxCount = topDomains[0]?.[1] || 1
  const cx = 170
  const cy = 130
  const nodes = topDomains.map(([domain, count], i) => {
    const angle = (2 * Math.PI * i) / topDomains.length - Math.PI / 2
    const radius = 90
    const x = cx + radius * Math.cos(angle)
    const y = cy + radius * Math.sin(angle)
    const size = 6 + (count / maxCount) * 14
    return { domain, count, x, y, size }
  })

  const nodeMap = new Map(nodes.map(n => [n.domain, n]))
  const maxEdgeWeight = edges[0]?.weight || 1

  const renderedEdges = edges.map(e => {
    const from = nodeMap.get(e.from)
    const to = nodeMap.get(e.to)
    if (!from || !to) return null
    return {
      from: e.from,
      to: e.to,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      thickness: 0.5 + (e.weight / maxEdgeWeight) * 2.5,
      weight: e.weight,
    }
  }).filter(Boolean) as { from: string; to: string; x1: number; y1: number; x2: number; y2: number; thickness: number; weight: number }[]

  domainGraphData.value = { nodes, edges: renderedEdges }
}

onMounted(() => {
  tagDistFrame = requestAnimationFrame(() => computeTagDistribution())
  graphFrame = requestAnimationFrame(() => computeDomainGraph())
})

onUnmounted(() => {
  if (tagDistFrame) cancelAnimationFrame(tagDistFrame)
  if (graphFrame) cancelAnimationFrame(graphFrame)
})

function isTab(n: number) { return activeTab.value === n }

const tabs = [
  { label: '热力图', icon: 'i-lucide:grid-3x3' },
  { label: '趋势图', icon: 'i-lucide:trending-up' },
  { label: '标签分布', icon: 'i-lucide:pie-chart' },
  { label: '域名关系', icon: 'i-lucide:git-branch' },
]

function onHeatCellClick(cell: { day: number; hour: number; count: number }) {
  if (cell.count === 0) return
  const dayName = dayLabels[cell.day]
  const hourStr = String(cell.hour).padStart(2, '0')
  navigateWithTimeFilter(cell.day, cell.hour, cell.hour + 1, `周${dayName} ${hourStr}:00-${hourStr}:59`)
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
  if (trendRange.value === '7d') return stats.weeklyTrend
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
  navigateWithTagFilter(tag, `标签: ${tag}`)
}

function isNodeHighlighted(domain: string) {
  if (!hoveredGraphNode.value) return true
  if (domain === hoveredGraphNode.value) return true
  return domainGraphData.value.edges.some(
    e => (e.from === hoveredGraphNode.value && e.to === domain) ||
         (e.to === hoveredGraphNode.value && e.from === domain)
  )
}

function isEdgeHighlighted(edge: { from: string; to: string }) {
  if (!hoveredGraphNode.value) return true
  return edge.from === hoveredGraphNode.value || edge.to === hoveredGraphNode.value
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
            周{{ dayLabels[hoveredHeatCell.day] }} {{ String(hoveredHeatCell.hour).padStart(2, '0') }}:00-{{ String(hoveredHeatCell.hour).padStart(2, '0') }}:59
          </div>
          <div class="heat-tooltip-count">{{ hoveredHeatCell.count }} 次访问</div>
        </div>
      </div>

      <div v-if="isTab(1)" class="trend-wrapper">
        <div class="trend-range-toggle">
          <button
            class="range-btn"
            :class="{ active: trendRange === '7d' }"
            @click="trendRange = '7d'"
          >7天</button>
          <button
            class="range-btn"
            :class="{ active: trendRange === '30d' }"
            @click="trendRange = '30d'"
          >30天</button>
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
              总标签
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
            <span class="tag-legend-name">{{ item.tag }}</span>
            <span class="tag-legend-count">{{ item.count }}</span>
            <span class="tag-legend-pct">{{ item.percentage }}%</span>
          </div>
        </div>
      </div>

      <div v-if="isTab(3)" class="graph-wrapper">
        <svg class="graph-svg" viewBox="0 0 340 260" preserveAspectRatio="xMidYMid meet">
          <line
            v-for="(edge, i) in domainGraphData.edges"
            :key="'e-' + i"
            :x1="edge.x1"
            :y1="edge.y1"
            :x2="edge.x2"
            :y2="edge.y2"
            :stroke="isEdgeHighlighted(edge) ? 'var(--primary-color)' : 'var(--border-color)'"
            :stroke-width="edge.thickness"
            :opacity="isEdgeHighlighted(edge) ? 0.6 : 0.15"
            stroke-linecap="round"
            style="transition: all 0.2s"
          />
          <g
            v-for="(node, i) in domainGraphData.nodes"
            :key="'n-' + i"
            class="graph-node"
            @mouseenter="hoveredGraphNode = node.domain"
            @mouseleave="hoveredGraphNode = null"
          >
            <circle
              :cx="node.x"
              :cy="node.y"
              :r="node.size"
              :fill="isNodeHighlighted(node.domain) ? 'var(--primary-color)' : 'var(--border-color)'"
              :opacity="isNodeHighlighted(node.domain) ? 0.8 : 0.25"
              style="cursor: pointer; transition: all 0.2s"
            />
            <text
              :x="node.x"
              :y="node.y + node.size + 10"
              text-anchor="middle"
              :fill="isNodeHighlighted(node.domain) ? 'var(--text-primary)' : 'var(--text-muted)'"
              font-size="7"
              :font-weight="hoveredGraphNode === node.domain ? '600' : '400'"
              style="transition: all 0.2s; pointer-events: none"
            >{{ node.domain.length > 14 ? node.domain.slice(0, 12) + '..' : node.domain }}</text>
            <text
              v-if="hoveredGraphNode === node.domain"
              :x="node.x"
              :y="node.y - node.size - 4"
              text-anchor="middle"
              fill="var(--text-primary)"
              font-size="8"
              font-weight="600"
              style="pointer-events: none"
            >{{ node.count }}次</text>
          </g>
        </svg>
        <div class="graph-hint">
          <span class="i-lucide:info" />
          悬停节点查看关联，10分钟内共访的域名相连
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

.graph-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.graph-svg {
  width: 100%;
  height: auto;
}

.graph-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  color: var(--text-muted);
  padding: 4px 0;
}

.graph-hint .i-lucide\:info {
  font-size: 11px;
}
</style>
