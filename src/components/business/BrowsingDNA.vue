<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useFingerprintStore } from '@/stores/fingerprint'
import { useHistoryStore } from '@/stores/history'
import { autoTagDetailed, TAG_COLORS, TAG_ICONS } from '@/utils/helpers'
import { useI18n } from '@/i18n'
import type { BehavioralDimension } from '@/types/fingerprint'

const fpStore = useFingerprintStore()
const history = useHistoryStore()
const { t } = useI18n()

const tagCloudData = ref<{ tag: string; count: number; color: string; icon: string; size: number }[]>([])
const knowledgeData = ref<{ tag: string; count: number; color: string; percentage: number }[]>([])

let tagComputeFrame: number | null = null

const TAG_CACHE = new Map<string, string[]>()

function getCachedTags(url: string, title: string): string[] {
  const key = `${url}|${title || ''}`
  let cached = TAG_CACHE.get(key)
  if (!cached) {
    cached = autoTagDetailed(url, title).map(tag => tag.tag)
    if (TAG_CACHE.size < 5000) TAG_CACHE.set(key, cached)
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
    for (const tag of tags) tagMap.set(tag, (tagMap.get(tag) || 0) + 1)
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

  const knowledgeTags = ['tech', 'dev', 'docs', 'education', 'reading', 'design', 'ai', 'finance', 'health', 'law']
  const totalKn = knowledgeTags.reduce((s, tag) => s + (tagMap.get(tag) || 0), 0)
  knowledgeData.value = knowledgeTags
    .filter(tag => (tagMap.get(tag) || 0) > 0)
    .map(tag => ({
      tag,
      count: tagMap.get(tag) || 0,
      color: TAG_COLORS[tag] || '#94a3b8',
      percentage: totalKn > 0 ? Math.round((tagMap.get(tag) || 0) / totalKn * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

const contentDims = computed<BehavioralDimension[]>(() =>
  fpStore.contentDimensions.map(d => ({
    ...d,
    label: t(`dna.dimensions.${d.key}`),
  }))
)

const interestDims = computed<BehavioralDimension[]>(() =>
  fpStore.interestDimensions.map(d => ({
    ...d,
    label: t(`dna.dimensions.${d.key}`),
  }))
)

const interactionDims = computed<BehavioralDimension[]>(() =>
  fpStore.interactionDimensions.map(d => ({
    ...d,
    label: t(`dna.dimensions.${d.key}`),
  }))
)

const archetypeLabel = computed(() => {
  const id = fpStore.archetype
  if (!id) return ''
  return t(`dna.archetypes.${id}`)
})

const archetypeDesc = computed(() => {
  const id = fpStore.archetype
  if (!id) return t('dna.defaultDesc')
  return t(`dna.archetypes.${id}Desc`)
})

const cx = 100
const cy = 100

const innerRingBars = computed(() => {
  return contentDims.value.map((d, i) => {
    const angle = (Math.PI * 2 * i) / 8 - Math.PI / 2
    return {
      ...d,
      angle,
      transform: `rotate(${(i * 45) - 90})`,
      length: Math.max(2, d.value * 22),
    }
  })
})

const middleRingBars = computed(() => {
  return interestDims.value.map((d, i) => {
    const angle = (Math.PI * 2 * i) / 4 - Math.PI / 2
    return {
      ...d,
      angle,
      transform: `rotate(${(i * 90) - 90})`,
      length: Math.max(2, d.value * 28),
    }
  })
})

const outerRingBars = computed(() => {
  return interactionDims.value.map((d, i) => {
    const angle = (Math.PI * 2 * i) / 8 - Math.PI / 2
    return {
      ...d,
      angle,
      transform: `rotate(${(i * 45) - 90})`,
      length: Math.max(2, d.value * 32),
    }
  })
})

const orbitParticles = computed(() => {
  const records = history.allRecords
  if (records.length === 0) return []

  const domainMap = new Map<string, number>()
  for (const r of records) domainMap.set(r.domain, (domainMap.get(r.domain) || 0) + 1)

  const topDomains = Array.from(domainMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)

  const maxCount = topDomains[0]?.[1] || 1

  return topDomains.map(([, count], i) => {
    const angle = (Math.PI * 2 * i) / 12 + 0.3
    const dist = 80 + (count / maxCount) * 15
    return {
      cx: cx + dist * Math.cos(angle),
      cy: cy + dist * Math.sin(angle),
      r: 1.2 + (count / maxCount) * 2.5,
      color: `hsl(${(i * 30) % 360}, 70%, 60%)`,
      opacity: 0.3 + (count / maxCount) * 0.5,
    }
  })
})

const fingerprintRidges = computed(() => {
  const hash = fpStore.dnaId || '00000000'
  const paths: { path: string; width: number }[] = []

  for (let i = 0; i < 6; i++) {
    const seed = parseInt(hash.substring(i, i + 1), 16) || 0
    const startAngle = (seed / 16) * Math.PI * 2
    const curvature = 0.3 + (seed / 16) * 0.5
    const radius = 6 + i * 2

    const x1 = cx + radius * Math.cos(startAngle)
    const y1 = cy + radius * Math.sin(startAngle)
    const x2 = cx + radius * Math.cos(startAngle + Math.PI * 0.8)
    const y2 = cy + radius * Math.sin(startAngle + Math.PI * 0.8)

    const cpx = cx + radius * curvature * Math.cos(startAngle + Math.PI * 0.4)
    const cpy = cy + radius * curvature * Math.sin(startAngle + Math.PI * 0.4)

    paths.push({
      path: `M${x1},${y1} Q${cpx},${cpy} ${x2},${y2}`,
      width: 1 + (seed % 3) * 0.3,
    })
  }

  return paths
})

onMounted(() => {
  tagComputeFrame = requestAnimationFrame(() => computeTagCloud())
  fpStore.collectFingerprint()
})

onUnmounted(() => {
  if (tagComputeFrame) cancelAnimationFrame(tagComputeFrame)
})
</script>

<template>
  <div class="dna-card">
    <div class="dna-header">
      <span class="i-lucide:fingerprint dna-header-icon" />
      <span class="dna-title">{{ t('dna.title') }}</span>
      <span v-if="archetypeLabel" class="dna-badge">{{ archetypeLabel }}</span>
    </div>
    <div class="dna-desc">{{ archetypeDesc }}</div>

    <div v-if="fpStore.isCollecting" class="dna-loading">
      <span class="i-lucide:loader-2 dna-loading-icon" />
      {{ t('dna.collecting') }}
    </div>

    <div class="dna-nebula-wrap">
      <svg viewBox="0 0 200 200" class="dna-nebula-svg">
        <defs>
          <radialGradient id="nebula-glow">
            <stop offset="0%" stop-color="var(--primary-400, #818cf8)" stop-opacity="0.12" />
            <stop offset="100%" stop-color="transparent" />
          </radialGradient>
        </defs>

        <circle :cx="cx" :cy="cy" r="95" fill="url(#nebula-glow)" />

        <g :transform="`translate(${cx},${cy})`">
          <circle cx="0" cy="0" r="72" fill="none" stroke="var(--border-color)" stroke-width="0.3" opacity="0.3" />
          <circle cx="0" cy="0" r="48" fill="none" stroke="var(--border-color)" stroke-width="0.3" opacity="0.3" />
          <circle cx="0" cy="0" r="26" fill="none" stroke="var(--border-color)" stroke-width="0.3" opacity="0.3" />
        </g>

        <g :transform="`translate(${cx},${cy})`">
          <rect v-for="(bar, i) in outerRingBars" :key="'o'+i"
            :transform="bar.transform"
            x="48" y="-1.2"
            :width="bar.length" height="2.4"
            :fill="bar.color" rx="1.2" opacity="0.7" />
        </g>

        <g :transform="`translate(${cx},${cy})`">
          <rect v-for="(bar, i) in middleRingBars" :key="'m'+i"
            :transform="bar.transform"
            x="28" y="-1.5"
            :width="bar.length" height="3"
            :fill="bar.color" rx="1.5" opacity="0.75" />
        </g>

        <g :transform="`translate(${cx},${cy})`">
          <rect v-for="(bar, i) in innerRingBars" :key="'i'+i"
            :transform="bar.transform"
            x="14" y="-1.8"
            :width="bar.length" height="3.5"
            :fill="bar.color" rx="1.5" opacity="0.8" />
        </g>

        <g :transform="`translate(${cx},${cy})`">
          <path v-for="(ridge, i) in fingerprintRidges" :key="'r'+i"
            :d="ridge.path"
            fill="none" stroke="var(--primary-500, #6366f1)"
            :stroke-width="ridge.width" opacity="0.4" stroke-linecap="round" />
        </g>

        <circle v-for="p in orbitParticles" :key="`${p.cx}-${p.cy}`"
          :cx="p.cx" :cy="p.cy" :r="p.r"
          :fill="p.color" :opacity="p.opacity" />
      </svg>
    </div>

    <div class="dna-ring-legend">
      <span class="legend-item"><span class="legend-dot" style="background:#6366f1" />{{ t('dna.contentTitle') }}</span>
      <span class="legend-item"><span class="legend-dot" style="background:#14b8a6" />{{ t('dna.interestTitle') }}</span>
      <span class="legend-item"><span class="legend-dot" style="background:#7c3aed" />{{ t('dna.interactionTitle') }}</span>
    </div>

    <div class="dna-sections">
      <div class="dna-section">
        <div class="dna-section-title">
          <span class="i-lucide:book-open dna-section-icon" style="color:#6366f1" />
          {{ t('dna.contentTitle') }}
        </div>
        <div class="dna-bars">
          <div v-for="dim in contentDims" :key="dim.key" class="dna-bar-row">
            <span class="dna-bar-label" :style="{ color: dim.color }">{{ dim.label }}</span>
            <div class="dna-bar-track">
              <div class="dna-bar-fill" :style="{ width: Math.round(dim.value * 100) + '%', backgroundColor: dim.color }" />
            </div>
            <span class="dna-bar-value">{{ Math.round(dim.value * 100) }}</span>
          </div>
        </div>
      </div>

      <div class="dna-section">
        <div class="dna-section-title">
          <span class="i-lucide:compass dna-section-icon" style="color:#14b8a6" />
          {{ t('dna.interestTitle') }}
        </div>
        <div class="dna-bars">
          <div v-for="dim in interestDims" :key="dim.key" class="dna-bar-row">
            <span class="dna-bar-label" :style="{ color: dim.color }">{{ dim.label }}</span>
            <div class="dna-bar-track">
              <div class="dna-bar-fill" :style="{ width: Math.round(dim.value * 100) + '%', backgroundColor: dim.color }" />
            </div>
            <span class="dna-bar-value">{{ Math.round(dim.value * 100) }}</span>
          </div>
        </div>
      </div>

      <div class="dna-section">
        <div class="dna-section-title">
          <span class="i-lucide:activity dna-section-icon" style="color:#7c3aed" />
          {{ t('dna.interactionTitle') }}
        </div>
        <div class="dna-bars">
          <div v-for="dim in interactionDims" :key="dim.key" class="dna-bar-row">
            <span class="dna-bar-label" :style="{ color: dim.color }">{{ dim.label }}</span>
            <div class="dna-bar-track">
              <div class="dna-bar-fill" :style="{ width: Math.round(dim.value * 100) + '%', backgroundColor: dim.color }" />
            </div>
            <span class="dna-bar-value">{{ Math.round(dim.value * 100) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="knowledgeData.length > 0" class="dna-knowledge">
      <div class="dna-section-title">
        <span class="i-lucide:graduation-cap dna-section-icon" />
        {{ t('dna.knowledgeTitle') }}
      </div>
      <div class="knowledge-bars">
        <div v-for="item in knowledgeData" :key="item.tag" class="knowledge-bar-row">
          <span class="knowledge-label" :style="{ color: item.color }">{{ t('tags.' + item.tag) }}</span>
          <div class="knowledge-track">
            <div class="knowledge-fill" :style="{ width: item.percentage + '%', backgroundColor: item.color }" />
          </div>
          <span class="knowledge-value">{{ item.percentage }}%</span>
        </div>
      </div>
    </div>

    <div v-if="fpStore.dnaId" class="dna-meta">
      <div class="dna-meta-item">
        <span class="dna-meta-label">{{ t('dna.fingerprintId') }}</span>
        <span class="dna-meta-value mono">{{ fpStore.dnaId }}</span>
      </div>
      <div class="dna-meta-item">
        <span class="dna-meta-label">{{ t('dna.confidence') }}</span>
        <span class="dna-meta-value">{{ Math.round(fpStore.confidence * 100) }}%</span>
      </div>
      <div class="dna-meta-item">
        <span class="dna-meta-label">{{ t('dna.stability') }}</span>
        <span class="dna-meta-value">{{ Math.round(fpStore.stability * 100) }}%</span>
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
  display: flex; align-items: center; gap: 6px; margin-bottom: 4px;
}
.dna-header-icon { font-size: 16px; color: #8b5cf6; }
.dna-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.dna-badge {
  margin-left: auto; font-size: 11px; font-weight: 600;
  padding: 2px 8px; border-radius: 4px;
  background: rgba(139,92,246,0.12); color: #8b5cf6;
}
.dna-desc {
  font-size: 11px; color: var(--text-muted); margin-bottom: 8px; line-height: 1.4;
}
.dna-loading {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 20px; font-size: 12px; color: var(--text-muted);
}
.dna-loading-icon { font-size: 14px; animation: spin 1s linear infinite; }
.dna-nebula-wrap {
  display: flex; justify-content: center; margin-bottom: 4px;
}
.dna-nebula-svg {
  width: 180px; height: 180px;
}
.dna-ring-legend {
  display: flex; justify-content: center; gap: 12px; margin-bottom: 8px;
}
.legend-item {
  display: flex; align-items: center; gap: 3px;
  font-size: 9px; color: var(--text-muted); font-weight: 500;
}
.legend-dot {
  width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
}
.dna-sections {
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;
  margin-bottom: 8px;
}
.dna-section {}
.dna-section-title {
  display: flex; align-items: center; gap: 4px;
  font-size: 10px; font-weight: 600; color: var(--text-muted);
  margin-bottom: 5px;
}
.dna-section-icon { font-size: 11px; }
.dna-bars { display: flex; flex-direction: column; gap: 2px; }
.dna-bar-row { display: flex; align-items: center; gap: 3px; }
.dna-bar-label { font-size: 7px; font-weight: 600; width: 28px; flex-shrink: 0; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dna-bar-track {
  flex: 1; height: 2.5px; background: var(--border-color);
  border-radius: 1.5px; overflow: hidden;
}
.dna-bar-fill { height: 100%; border-radius: 1.5px; transition: width 0.4s ease; }
.dna-bar-value { font-size: 7px; font-weight: 600; color: var(--text-secondary); width: 18px; text-align: right; flex-shrink: 0; }
.dna-knowledge {
  padding: 8px 0; border-top: 1px solid var(--border-color);
  margin-bottom: 8px;
}
.knowledge-bars { display: flex; flex-direction: column; gap: 3px; }
.knowledge-bar-row { display: flex; align-items: center; gap: 4px; }
.knowledge-label { font-size: 8px; font-weight: 600; width: 30px; flex-shrink: 0; }
.knowledge-track {
  flex: 1; height: 4px; background: var(--border-color);
  border-radius: 2px; overflow: hidden;
}
.knowledge-fill { height: 100%; border-radius: 2px; transition: width 0.4s ease; }
.knowledge-value { font-size: 8px; font-weight: 600; color: var(--text-secondary); width: 28px; text-align: right; flex-shrink: 0; }
.dna-meta {
  display: flex; gap: 10px; padding: 6px 0;
  border-top: 1px solid var(--border-color);
  margin-bottom: 8px;
}
.dna-meta-item { display: flex; flex-direction: column; gap: 1px; }
.dna-meta-label { font-size: 8px; color: var(--text-muted); }
.dna-meta-value { font-size: 10px; font-weight: 600; color: var(--text-primary); }
.dna-meta-value.mono { font-family: 'Consolas', 'Monaco', monospace; letter-spacing: 0.5px; }
.dna-tags {
  padding-top: 8px; border-top: 1px solid var(--border-color);
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
