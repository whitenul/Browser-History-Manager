<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useStatsStore } from '@/stores/stats'
import { useHistoryStore } from '@/stores/history'
import { autoTagDetailed, TAG_COLORS, TAG_ICONS } from '@/utils/helpers'
import { useI18n } from '@/i18n'

const stats = useStatsStore()
const history = useHistoryStore()
const { t } = useI18n()

const tagCloudData = ref<{ tag: string; count: number; color: string; icon: string; size: number }[]>([])
const orbitData = ref<{ cx: number; cy: number; r: number; color: string; opacity: number }[]>([])

let tagComputeFrame: number | null = null
let orbitComputeFrame: number | null = null

const TAG_CACHE = new Map<string, string[]>()

function getCachedTags(url: string, title: string): string[] {
  const key = `${url}|${title || ''}`
  let cached = TAG_CACHE.get(key)
  if (!cached) {
    cached = autoTagDetailed(url, title).map(tag => tag.tag)
    if (TAG_CACHE.size < 5000) {
      TAG_CACHE.set(key, cached)
    }
  }
  return cached
}

function computeTagCloud() {
  const records = history.allRecords
  if (records.length === 0) return

  const sampleSize = Math.min(500, records.length)
  const step = Math.max(1, Math.floor(records.length / sampleSize))
  const tagMap = new Map<string, number>()

  for (let i = 0; i < records.length; i += step) {
    const r = records[i]
    const tags = getCachedTags(r.url, r.title)
    for (const tag of tags) {
      tagMap.set(tag, (tagMap.get(tag) || 0) + 1)
    }
  }

  const total = Math.ceil(records.length / step)
  tagCloudData.value = Array.from(tagMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tag, count]) => ({
      tag,
      count,
      color: TAG_COLORS[tag] || '#94a3b8',
      icon: TAG_ICONS[tag] || 'i-lucide:tag',
      size: Math.max(10, Math.min(18, 10 + (count / total) * 40)),
    }))
}

function computeOrbitParticles() {
  const records = history.allRecords
  if (records.length === 0) return

  const domainMap = new Map<string, number>()
  for (let i = 0; i < records.length; i++) {
    const r = records[i]
    domainMap.set(r.domain, (domainMap.get(r.domain) || 0) + 1)
  }

  const topDomains = Array.from(domainMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)

  const maxCount = topDomains[0]?.[1] || 1
  const cx = 100
  const cy = 100

  orbitData.value = topDomains.map(([, count], i) => {
    const angle = (Math.PI * 2 * i) / 16 + 0.3
    const dist = 30 + (count / maxCount) * 55
    return {
      cx: cx + dist * Math.cos(angle),
      cy: cy + dist * Math.sin(angle),
      r: 1.5 + (count / maxCount) * 4,
      color: `hsl(${(i * 22.5) % 360}, 70%, 60%)`,
      opacity: 0.35 + (count / maxCount) * 0.55,
    }
  })
}

onMounted(() => {
  tagComputeFrame = requestAnimationFrame(() => {
    computeTagCloud()
  })
  orbitComputeFrame = requestAnimationFrame(() => {
    computeOrbitParticles()
  })
})

onUnmounted(() => {
  if (tagComputeFrame) cancelAnimationFrame(tagComputeFrame)
  if (orbitComputeFrame) cancelAnimationFrame(orbitComputeFrame)
})

const dnaDimensions = computed(() => {
  const total = stats.overview.totalVisits || 1
  const prodRatio = stats.productivity.productiveCount / total
  const unprodRatio = stats.productivity.unproductiveCount / total

  let nightCount = 0
  let weekendCount = 0
  let workCount = 0
  let morningCount = 0
  const nightHours = new Set([22, 23, 0, 1, 2, 3, 4, 5])
  const weekendDays = new Set([0, 6])
  const workHours = new Set([9, 10, 11, 12, 13, 14, 15, 16, 17, 18])
  const morningHours = new Set([6, 7, 8, 9, 10, 11])

  for (const c of stats.heatmap) {
    if (c.count > 0) {
      if (nightHours.has(c.hour)) nightCount += c.count
      if (weekendDays.has(c.day)) weekendCount += c.count
      if (workHours.has(c.hour)) workCount += c.count
      if (morningHours.has(c.hour)) morningCount += c.count
    }
  }

  const nightRatio = Math.min(1, nightCount / total)
  const diversity = Math.min(1, stats.overview.siteCount / 50)
  const intensity = Math.min(1, stats.overview.dailyAvg / 100)
  const focusScore = 1 - (stats.rhythm.sessionCount > 0 ? Math.min(1, stats.rhythm.avgSessionLength / 20) : 0)
  const workRatio = Math.min(1, workCount / total)
  const topSiteRatio = stats.topSites.length > 0 ? Math.min(1, (stats.topSites[0]?.count || 0) / total) : 0
  const morningRatio = Math.min(1, morningCount / total)
  const explorRatio = Math.min(1, stats.overview.siteCount / 100)

  return [
    { label: t('dna.dimensions.productivity'), key: 'productivity', value: prodRatio, color: '#10b981' },
    { label: t('dna.dimensions.entertainment'), key: 'entertainment', value: unprodRatio, color: '#ef4444' },
    { label: t('dna.dimensions.nightOwl'), key: 'nightOwl', value: nightRatio, color: '#8b5cf6' },
    { label: t('dna.dimensions.breadth'), key: 'breadth', value: diversity, color: '#3b82f6' },
    { label: t('dna.dimensions.intensity'), key: 'intensity', value: intensity, color: '#f59e0b' },
    { label: t('dna.dimensions.focus'), key: 'focus', value: focusScore, color: '#ec4899' },
    { label: t('dna.dimensions.work'), key: 'work', value: workRatio, color: '#06b6d4' },
    { label: t('dna.dimensions.loyalty'), key: 'loyalty', value: topSiteRatio, color: '#f97316' },
    { label: t('dna.dimensions.morning'), key: 'morning', value: morningRatio, color: '#fbbf24' },
    { label: t('dna.dimensions.exploration'), key: 'exploration', value: explorRatio, color: '#a78bfa' },
  ]
})

const personalityType = computed(() => {
  const dims = dnaDimensions.value
  const sorted = [...dims].sort((a, b) => b.value - a.value)
  const top = sorted[0]
  const second = sorted[1]

  const comboKey = `${top.key}-${second.key}`

  const comboResult = t(`dna.types.${comboKey}`)
  if (comboResult !== `dna.types.${comboKey}`) return comboResult

  const singleResult = t(`dna.types.${top.key}`)
  if (singleResult !== `dna.types.${top.key}`) return singleResult

  return t('dna.types.default')
})

const personalityDescKey = computed(() => {
  const dims = dnaDimensions.value
  const sorted = [...dims].sort((a, b) => b.value - a.value)
  const top = sorted[0]
  const second = sorted[1]

  const comboKey = `${top.key}-${second.key}`
  const comboResult = t(`dna.descs.${comboKey}`)
  if (comboResult !== `dna.descs.${comboKey}`) return `dna.descs.${comboKey}`

  const singleResult = t(`dna.descs.${top.key}`)
  if (singleResult !== `dna.descs.${top.key}`) return `dna.descs.${top.key}`

  return 'dna.defaultDesc'
})

const personalityDesc = computed(() => t(personalityDescKey.value))

const cx = 100
const cy = 100
const maxR = 80

function polarPoint(index: number, value: number): string {
  const angle = (Math.PI * 2 * index) / dnaDimensions.value.length - Math.PI / 2
  const r = maxR * Math.max(0.08, value)
  const x = cx + r * Math.cos(angle)
  const y = cy + r * Math.sin(angle)
  return `${x},${y}`
}

const radarPath = computed(() => {
  const points = dnaDimensions.value.map((d, i) => polarPoint(i, d.value))
  return `M${points.join('L')}Z`
})

const radarDots = computed(() => {
  return dnaDimensions.value.map((d, i) => ({
    ...d,
    x: polarPoint(i, d.value).split(',')[0],
    y: polarPoint(i, d.value).split(',')[1],
  }))
})

const gridRings = [0.25, 0.5, 0.75, 1.0]

function ringPath(ratio: number): string {
  const r = maxR * ratio
  return `M${cx},${cy - r} A${r},${r} 0 1,1 ${cx},${cy + r} A${r},${r} 0 1,1 ${cx},${cy - r}`
}

const axisLines = computed(() => {
  return dnaDimensions.value.map((_, i) => {
    const angle = (Math.PI * 2 * i) / dnaDimensions.value.length - Math.PI / 2
    return {
      x2: cx + maxR * Math.cos(angle),
      y2: cy + maxR * Math.sin(angle),
    }
  })
})
</script>

<template>
  <div class="dna-card">
    <div class="dna-header">
      <span class="i-lucide:fingerprint dna-header-icon" />
      <span class="dna-title">{{ t('dna.title') }}</span>
      <span class="dna-badge">{{ personalityType }}</span>
    </div>
    <div class="dna-desc">{{ personalityDesc }}</div>
    <div class="dna-body">
      <div class="dna-chart">
        <svg viewBox="0 0 200 200" class="dna-svg">
          <path v-for="ring in gridRings" :key="ring" :d="ringPath(ring)"
            fill="none" stroke="var(--border-color)" stroke-width="0.5" opacity="0.4" />
          <line v-for="(axis, i) in axisLines" :key="i"
            :x1="cx" :y1="cy" :x2="axis.x2" :y2="axis.y2"
            stroke="var(--border-color)" stroke-width="0.5" opacity="0.3" />
          <circle v-for="p in orbitData" :key="`${p.cx}-${p.cy}`"
            :cx="p.cx" :cy="p.cy" :r="p.r"
            :fill="p.color" :opacity="p.opacity" />
          <path :d="radarPath" fill="rgba(99,102,241,0.12)" stroke="#6366f1" stroke-width="1.5" />
          <circle v-for="dot in radarDots" :key="dot.key"
            :cx="dot.x" :cy="dot.y" r="2.5" :fill="dot.color" />
          <text v-for="(dim, i) in dnaDimensions" :key="dim.key"
            :x="polarPoint(i, dim.value + 0.2).split(',')[0]"
            :y="Number(polarPoint(i, dim.value + 0.2).split(',')[1]) + 3"
            text-anchor="middle" fill="var(--text-muted)" font-size="5.5">
            {{ dim.label }}
          </text>
        </svg>
      </div>
      <div class="dna-info">
        <div class="dna-bars">
          <div v-for="dim in dnaDimensions" :key="dim.key" class="dna-bar-row">
            <span class="dna-bar-label" :style="{ color: dim.color }">{{ dim.label }}</span>
            <div class="dna-bar-track">
              <div class="dna-bar-fill" :style="{ width: Math.round(dim.value * 100) + '%', backgroundColor: dim.color }" />
            </div>
            <span class="dna-bar-value">{{ Math.round(dim.value * 100) }}</span>
          </div>
        </div>
      </div>
    </div>
    <div v-if="tagCloudData.length > 0" class="dna-tags">
      <div class="dna-tags-title">
        <span class="i-lucide:tags dna-tags-icon" />
        {{ t('dna.tagCloud') }}
      </div>
      <div class="tag-cloud">
        <span v-for="item in tagCloudData" :key="item.tag" class="tag-cloud-item" :style="{ fontSize: item.size + 'px', color: item.color }">
          <span :class="item.icon" class="tag-cloud-icon" />{{ t('tags.' + item.tag) }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dna-card {
  padding: 14px; background: var(--app-surface);
  border: 1px solid var(--border-color); border-radius: var(--radius-lg);
}
.dna-header {
  display: flex; align-items: center; gap: 6px; margin-bottom: 6px;
}
.dna-header-icon { font-size: 16px; color: #8b5cf6; }
.dna-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.dna-badge {
  margin-left: auto; font-size: 11px; font-weight: 600;
  padding: 2px 8px; border-radius: 4px;
  background: rgba(139,92,246,0.12); color: #8b5cf6;
}
.dna-desc {
  font-size: 11px; color: var(--text-muted); margin-bottom: 10px; line-height: 1.4;
}
.dna-body { display: flex; gap: 14px; align-items: center; }
.dna-chart { width: 140px; height: 140px; flex-shrink: 0; }
.dna-svg { width: 100%; height: 100%; }
.dna-info { flex: 1; min-width: 0; }
.dna-bars { display: flex; flex-direction: column; gap: 3px; }
.dna-bar-row { display: flex; align-items: center; gap: 6px; }
.dna-bar-label { font-size: 9px; font-weight: 600; width: 36px; flex-shrink: 0; }
.dna-bar-track {
  flex: 1; height: 4px; background: var(--border-color);
  border-radius: 2px; overflow: hidden;
}
.dna-bar-fill { height: 100%; border-radius: 2px; transition: width 0.4s ease; }
.dna-bar-value { font-size: 9px; font-weight: 600; color: var(--text-secondary); width: 22px; text-align: right; flex-shrink: 0; }
.dna-tags {
  margin-top: 10px; padding-top: 10px;
  border-top: 1px solid var(--border-color);
}
.dna-tags-title {
  display: flex; align-items: center; gap: 4px;
  font-size: 10px; font-weight: 600; color: var(--text-muted);
  margin-bottom: 6px;
}
.dna-tags-icon { font-size: 11px; }
.tag-cloud {
  display: flex; flex-wrap: wrap; gap: 4px 6px; align-items: baseline;
}
.tag-cloud-item {
  display: inline-flex; align-items: center; gap: 2px;
  font-weight: 600; line-height: 1.2; transition: opacity 0.2s;
  cursor: default;
}
.tag-cloud-item:hover { opacity: 0.7; }
.tag-cloud-icon { font-size: 0.8em; }
</style>
