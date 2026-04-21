<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, shallowRef } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useStatsStore } from '@/stores/stats'
import { useUIStore } from '@/stores/ui'
import { getFaviconUrl, safeOpenUrl } from '@/utils/helpers'
import { useStatsNavigation } from '@/composables/useStatsNavigation'
import GalleryCard from '@/components/business/GalleryCard.vue'
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

const activePanel = ref<number | null>(null)
const rotation = ref(0)
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartRotation = ref(0)
const autoRotateSpeed = ref(0.15)
const isAutoRotating = ref(true)
const particleCanvas = ref<HTMLCanvasElement | null>(null)
let autoRotateRaf: number | null = null
let particleRaf: number | null = null
let autoRotateResumeTimer: ReturnType<typeof setTimeout> | null = null

const CARD_COUNT = 8
const ANGLE_STEP = 360 / CARD_COUNT

const currentCardIndex = computed(() => {
  const normalized = (((-rotation.value) % 360) + 360) % 360
  return Math.round(normalized / ANGLE_STEP) % CARD_COUNT
})

const carouselStyle = computed(() => ({
  transform: `rotateY(${rotation.value}deg)`,
}))

const panels = computed(() => [
  {
    id: 0,
    icon: 'i-lucide:bar-chart-3',
    title: t('stats.overview'),
    themeColor: '#3b82f6',
    value: stats.overview.totalVisits.toLocaleString(),
    subtitle: t('stats.galleryOverviewSub'),
  },
  {
    id: 1,
    icon: 'i-lucide:grid-3x3',
    title: t('stats.heatmap'),
    themeColor: '#10b981',
    value: `${stats.rhythm.peakHour}:00`,
    subtitle: t('stats.galleryHeatmapSub'),
  },
  {
    id: 2,
    icon: 'i-lucide:crown',
    title: t('stats.topSitesTitle'),
    themeColor: '#f59e0b',
    value: stats.topSites[0]?.domain || '--',
    subtitle: t('stats.galleryTopSitesSub', { count: stats.topSites.length }),
  },
  {
    id: 3,
    icon: 'i-lucide:zap',
    title: t('stats.productivity'),
    themeColor: '#8b5cf6',
    value: `${stats.productivity.score}%`,
    subtitle: t('stats.prodLevel.' + stats.productivity.level),
  },
  {
    id: 4,
    icon: 'i-lucide:clock',
    title: t('stats.smartTimeline'),
    themeColor: '#6366f1',
    value: t('stats.galleryTimelineValue'),
    subtitle: t('stats.galleryTimelineSub'),
  },
  {
    id: 5,
    icon: 'i-lucide:brain',
    title: t('stats.smartAssistant'),
    themeColor: '#ec4899',
    value: stats.recommendations.length.toString(),
    subtitle: t('stats.galleryAssistantSub'),
  },
  {
    id: 6,
    icon: 'i-lucide:fingerprint',
    title: t('stats.browsingDNA'),
    themeColor: '#14b8a6',
    value: t('stats.galleryDNAValue'),
    subtitle: t('stats.galleryDNASub'),
  },
  {
    id: 7,
    icon: 'i-lucide:pie-chart',
    title: t('stats.chartsAnalysis'),
    themeColor: '#f97316',
    value: stats.categoryStats.length.toString(),
    subtitle: t('stats.galleryChartsSub'),
  },
])

function rotateTo(index: number) {
  if (autoRotateResumeTimer) clearTimeout(autoRotateResumeTimer)
  isAutoRotating.value = false

  const currentLogicalIdx = ((Math.round(-rotation.value / ANGLE_STEP)) % CARD_COUNT + CARD_COUNT) % CARD_COUNT
  let delta = index - currentLogicalIdx
  if (delta > CARD_COUNT / 2) delta -= CARD_COUNT
  if (delta < -CARD_COUNT / 2) delta += CARD_COUNT

  rotation.value += -delta * ANGLE_STEP
  rotation.value = Math.round(rotation.value / ANGLE_STEP) * ANGLE_STEP

  autoRotateResumeTimer = setTimeout(() => { isAutoRotating.value = true }, 5000)
}

function rotatePrev() {
  const idx = (currentCardIndex.value - 1 + CARD_COUNT) % CARD_COUNT
  rotateTo(idx)
}

function rotateNext() {
  const idx = (currentCardIndex.value + 1) % CARD_COUNT
  rotateTo(idx)
}

function onDragStart(e: MouseEvent) {
  isDragging.value = true
  dragStartX.value = e.clientX
  dragStartRotation.value = rotation.value
  isAutoRotating.value = false
}

function onDragMove(e: MouseEvent) {
  if (!isDragging.value) return
  const deltaX = e.clientX - dragStartX.value
  rotation.value = dragStartRotation.value + deltaX * 0.3
}

function onDragEnd() {
  if (!isDragging.value) return
  isDragging.value = false
  const deltaX = rotation.value - dragStartRotation.value
  const swipedCards = Math.round(deltaX / ANGLE_STEP)
  if (swipedCards !== 0) {
    const targetIdx = ((currentCardIndex.value - swipedCards) % CARD_COUNT + CARD_COUNT) % CARD_COUNT
    rotateTo(targetIdx)
  } else {
    const snapped = Math.round(rotation.value / ANGLE_STEP)
    const delta = snapped * ANGLE_STEP - rotation.value
    rotation.value += delta
    if (autoRotateResumeTimer) clearTimeout(autoRotateResumeTimer)
    autoRotateResumeTimer = setTimeout(() => { isAutoRotating.value = true }, 5000)
  }
}

function onWheel(e: WheelEvent) {
  e.stopPropagation()
  if (e.deltaY > 0) rotateNext()
  else rotatePrev()
}

function onKeyDown(e: KeyboardEvent) {
  if (activePanel.value !== null) {
    if (e.key === 'Escape') closePanel()
    return
  }
  if (e.key === 'ArrowLeft') { e.preventDefault(); rotatePrev() }
  else if (e.key === 'ArrowRight') { e.preventDefault(); rotateNext() }
  else if (e.key === 'Enter' && currentCardIndex.value !== null) openPanel(currentCardIndex.value)
}

function autoRotateLoop() {
  if (!isVisible.value) { autoRotateRaf = 0; return }
  if (isAutoRotating.value && !isDragging.value && activePanel.value === null) {
    rotation.value += autoRotateSpeed.value
  }
  autoRotateRaf = requestAnimationFrame(autoRotateLoop)
}

function openPanel(index: number) {
  activePanel.value = index
  isAutoRotating.value = false
  loadDetailComponent(index)
}

function closePanel() {
  activePanel.value = null
  if (autoRotateResumeTimer) clearTimeout(autoRotateResumeTimer)
  autoRotateResumeTimer = setTimeout(() => { isAutoRotating.value = true }, 5000)
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

function loadDetailComponent(panelIndex: number) {
  switch (panelIndex) {
    case 4:
      if (!loadedComponents.value.timeline) {
        import('@/components/business/SmartTimeline.vue').then(m => {
          SmartTimeline.value = m.default
          loadedComponents.value.timeline = true
        })
      }
      break
    case 5:
      if (!loadedComponents.value.assistant) {
        import('@/components/business/SmartAssistant.vue').then(m => {
          SmartAssistant.value = m.default
          loadedComponents.value.assistant = true
        })
      }
      break
    case 6:
      if (!loadedComponents.value.dna) {
        import('@/components/business/BrowsingDNA.vue').then(m => {
          BrowsingDNA.value = m.default
          loadedComponents.value.dna = true
        })
      }
      break
    case 7:
      if (!loadedComponents.value.charts) {
        import('@/components/business/EnhancedCharts.vue').then(m => {
          EnhancedCharts.value = m.default
          loadedComponents.value.charts = true
        })
      }
      break
  }
}

function onHeatCellClick(cell: { day: number; hour: number; count: number }) {
  if (cell.count === 0) return
  const dayName = dayLabels.value[cell.day]
  const hourStr = String(cell.hour).padStart(2, '0')
  navigateWithTimeFilter(cell.day, cell.hour, cell.hour + 1, `${t('stats.weekPrefix')}${dayName} ${hourStr}:00-${hourStr}:59`)
}

function onTopSiteClick(domain: string) {
  navigateWithDomainFilter(domain, domain)
}

function openUrl(url: string) {
  safeOpenUrl(url)
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  alpha: number
  color: string
}

const particles = ref<Particle[]>([])
let particleResizeObserver: ResizeObserver | null = null
const isVisible = ref(true)

function handleVisibility() {
  isVisible.value = !document.hidden
  if (isVisible.value) {
    if (!particleRaf) particleRaf = requestAnimationFrame(drawParticles)
    if (!autoRotateRaf) autoRotateRaf = requestAnimationFrame(autoRotateLoop)
  }
}

function initParticles() {
  const canvas = particleCanvas.value
  if (!canvas) return
  const parent = canvas.parentElement
  if (!parent) return
  const w = Math.max(1, parent.clientWidth)
  const h = Math.max(1, parent.clientHeight)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = w * dpr
  canvas.height = h * dpr
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.scale(dpr, dpr)
  const colors = panels.value.map(p => p.themeColor)
  const arr: Particle[] = []
  for (let i = 0; i < 30; i++) {
    arr.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.3 + 0.05,
      color: colors[Math.floor(Math.random() * colors.length)],
    })
  }
  particles.value = arr
  if (particleResizeObserver) particleResizeObserver.disconnect()
  particleResizeObserver = new ResizeObserver(() => initParticles())
  particleResizeObserver.observe(parent)
}

function drawParticles() {
  const canvas = particleCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)
  for (const p of particles.value) {
    p.x += p.vx
    p.y += p.vy
    if (p.x < 0) p.x = w
    if (p.x > w) p.x = 0
    if (p.y < 0) p.y = h
    if (p.y > h) p.y = 0
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.globalAlpha = p.alpha
    ctx.fill()
  }
  for (let i = 0; i < particles.value.length; i++) {
    for (let j = i + 1; j < particles.value.length; j++) {
      const a = particles.value[i]
      const b = particles.value[j]
      const dx = a.x - b.x
      const dy = a.y - b.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 80) {
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.strokeStyle = a.color
        ctx.globalAlpha = (1 - dist / 80) * 0.08
        ctx.lineWidth = 0.5
        ctx.stroke()
      }
    }
  }
  ctx.globalAlpha = 1
  if (!isVisible.value) { particleRaf = 0; return }
  particleRaf = requestAnimationFrame(drawParticles)
}

watch(() => history.allRecords.length, (len) => {
  if (len > 0) {
    stats.computeStats(history.allRecords)
  }
}, { immediate: true })

watch(() => stats.timeRange, () => {
  stats.computeStats(history.allRecords)
})

onMounted(() => {
  autoRotateRaf = requestAnimationFrame(autoRotateLoop)
  initParticles()
  particleRaf = requestAnimationFrame(drawParticles)
  window.addEventListener('keydown', onKeyDown)
  document.addEventListener('visibilitychange', handleVisibility)
})

onUnmounted(() => {
  if (autoRotateRaf) cancelAnimationFrame(autoRotateRaf)
  if (particleRaf) cancelAnimationFrame(particleRaf)
  if (autoRotateResumeTimer) clearTimeout(autoRotateResumeTimer)
  if (particleResizeObserver) particleResizeObserver.disconnect()
  window.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('visibilitychange', handleVisibility)
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

    <div v-if="activePanel === null" class="gallery-layer">
      <canvas ref="particleCanvas" class="particle-canvas" />
      <div class="ambient-bg">
        <div class="ambient-orb ambient-orb-1" :style="{ background: panels[currentCardIndex]?.themeColor }" />
        <div class="ambient-orb ambient-orb-2" :style="{ background: panels[(currentCardIndex + 4) % 8]?.themeColor }" />
      </div>
      <div
        class="gallery-scene"
        @mousedown="onDragStart"
        @mousemove="onDragMove"
        @mouseup="onDragEnd"
        @mouseleave="onDragEnd"
        @wheel.prevent="onWheel"
      >
        <div class="gallery-carousel" :style="carouselStyle">
          <GalleryCard
            v-for="(panel, idx) in panels"
            :key="panel.id"
            :icon="panel.icon"
            :title="panel.title"
            :theme-color="panel.themeColor"
            :value="panel.value"
            :subtitle="panel.subtitle"
            :index="idx"
            :active="currentCardIndex === idx"
            :dragging="isDragging"
            @click="openPanel(idx)"
          >
            <div v-if="idx === 0" class="peek-overview">
              <span class="peek-stat">{{ stats.overview.weekVisits }}<small>{{ t('stats.weeklyVisits') }}</small></span>
              <span class="peek-stat">{{ stats.overview.siteCount }}<small>{{ t('stats.visitedSites') }}</small></span>
            </div>
            <div v-else-if="idx === 1" class="peek-heatmap">
              <div
                v-for="i in 28"
                :key="i"
                class="peek-cell"
                :style="{ backgroundColor: HEAT_COLORS[stats.heatmap[i * 24]?.level || 0] }"
              />
            </div>
            <div v-else-if="idx === 2" class="peek-topsites">
              <template v-if="stats.topSites.length > 0">
                <div v-for="(site, si) in stats.topSites.slice(0, 3)" :key="site.domain" class="peek-site">
                  <img :src="site.favicon" class="peek-favicon" @error="($event.target as HTMLImageElement).style.display = 'none'" />
                  <span class="peek-domain">{{ site.domain }}</span>
                </div>
              </template>
              <div v-else class="peek-empty">{{ t('stats.noData') }}</div>
            </div>
            <div v-else-if="idx === 3" class="peek-prod">
              <div class="peek-bar">
                <div class="peek-bar-fill" :style="{ width: stats.productivity.score + '%' }" />
              </div>
            </div>
            <div v-else class="peek-generic">
              <span :class="panel.icon" class="peek-icon" :style="{ color: panel.themeColor }" />
            </div>
          </GalleryCard>
        </div>
        <div class="gallery-reflection" :style="carouselStyle" />
      </div>

      <div class="gallery-nav">
        <button class="nav-arrow nav-prev" @click="rotatePrev">
          <span class="i-lucide:chevron-left" />
        </button>
        <div class="nav-dots">
          <button
            v-for="i in CARD_COUNT"
            :key="i"
            class="nav-dot"
            :class="{ active: currentCardIndex === i - 1 }"
            :style="{ '--dot-color': panels[i - 1]?.themeColor }"
            @click="rotateTo(i - 1)"
          />
        </div>
        <button class="nav-arrow nav-next" @click="rotateNext">
          <span class="i-lucide:chevron-right" />
        </button>
      </div>

      <div class="gallery-hint">
        <span class="i-lucide:mouse-pointer-click" />
        {{ t('stats.galleryHint') }}
      </div>
    </div>

    <div v-else class="detail-layer">
      <div class="detail-header">
        <button class="detail-back" @click="closePanel">
          <span class="i-lucide:arrow-left" />
          {{ t('stats.backToGallery') }}
        </button>
        <span class="detail-title" :style="{ color: panels[activePanel]?.themeColor }">
          <span :class="panels[activePanel]?.icon" class="detail-title-icon" />
          {{ panels[activePanel]?.title }}
        </span>
      </div>

      <div class="detail-content">
        <template v-if="activePanel === 0">
          <div class="overview-strip">
            <div class="overview-item">
              <span class="overview-value">{{ stats.overview.totalVisits.toLocaleString() }}</span>
              <span class="overview-label">{{ t('stats.totalVisits') }}</span>
            </div>
            <div class="overview-divider" />
            <div class="overview-item">
              <span class="overview-value">{{ stats.overview.weekVisits.toLocaleString() }}</span>
              <span class="overview-label">{{ t('stats.weeklyVisits') }}</span>
            </div>
            <div class="overview-divider" />
            <div class="overview-item">
              <span class="overview-value">{{ stats.overview.dailyAvg }}</span>
              <span class="overview-label">{{ t('stats.dailyAvgVisits') }}</span>
            </div>
            <div class="overview-divider" />
            <div class="overview-item">
              <span class="overview-value">{{ stats.overview.siteCount }}</span>
              <span class="overview-label">{{ t('stats.visitedSites') }}</span>
            </div>
          </div>
        </template>

        <template v-else-if="activePanel === 1">
          <div class="stats-section">
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
        </template>

        <template v-else-if="activePanel === 2">
          <div class="stats-section">
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
        </template>

        <template v-else-if="activePanel === 3">
          <div class="stats-section productivity-section">
            <div class="section-header">
              <span class="i-lucide:zap section-icon" />
              <span>{{ t('stats.productivity') }}</span>
              <span class="prod-level" :class="stats.productivity.level">{{ t('stats.prodLevel.' + stats.productivity.level) }}</span>
            </div>
            <div class="prod-bar-wrap">
              <div class="prod-bar">
                <div class="prod-bar-fill" :style="{ width: stats.productivity.score + '%' }" />
              </div>
              <span class="prod-bar-value">{{ stats.productivity.score }}%</span>
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
            <div class="rhythm-inline">
              <div class="rhythm-item">
                <span class="i-lucide:sun rhythm-icon" />
                <span>{{ t('stats.peak') }} {{ stats.rhythm.peakHour }}:00</span>
              </div>
              <div class="rhythm-item">
                <span class="i-lucide:calendar-days rhythm-icon" />
                <span>{{ t('stats.weekPrefix') }}{{ dayLabels[stats.rhythm.peakDay] }}</span>
              </div>
              <div class="rhythm-item">
                <span class="i-lucide:layers rhythm-icon" />
                <span>{{ t('stats.session') }} {{ stats.rhythm.avgSessionLength }}{{ t('stats.recordsUnit') }}</span>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="activePanel === 4">
          <component :is="SmartTimeline" v-if="loadedComponents.timeline" />
          <div v-else class="loading-placeholder">
            <div class="loading-spinner" />
            <span>{{ t('stats.loading') }}</span>
          </div>
        </template>

        <template v-else-if="activePanel === 5">
          <component :is="SmartAssistant" v-if="loadedComponents.assistant" />
          <div v-else class="loading-placeholder">
            <div class="loading-spinner" />
            <span>{{ t('stats.loading') }}</span>
          </div>
        </template>

        <template v-else-if="activePanel === 6">
          <component :is="BrowsingDNA" v-if="loadedComponents.dna" />
          <div v-else class="loading-placeholder">
            <div class="loading-spinner" />
            <span>{{ t('stats.loading') }}</span>
          </div>
        </template>

        <template v-else-if="activePanel === 7">
          <component :is="EnhancedCharts" v-if="loadedComponents.charts" />
          <div v-else class="loading-placeholder">
            <div class="loading-spinner" />
            <span>{{ t('stats.loading') }}</span>
          </div>
        </template>
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

.gallery-layer {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  user-select: none;
  position: relative;
  background: radial-gradient(ellipse at 50% 40%, rgba(59,130,246,0.04) 0%, transparent 70%);
}

.particle-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}

.ambient-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.ambient-orb {
  position: absolute;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.12;
  transition: background 1s ease;
}

.ambient-orb-1 {
  top: 10%;
  left: 20%;
  animation: orbFloat1 8s ease-in-out infinite;
}

.ambient-orb-2 {
  bottom: 10%;
  right: 20%;
  animation: orbFloat2 10s ease-in-out infinite;
}

@keyframes orbFloat1 {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(30px, -20px); }
}

@keyframes orbFloat2 {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(-20px, 30px); }
}

.gallery-scene {
  perspective: 1400px;
  perspective-origin: 50% 50%;
  width: 100%;
  height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  position: relative;
  z-index: 1;
  overflow: visible;
}

.gallery-scene:active {
  cursor: grabbing;
}

.gallery-carousel {
  position: relative;
  width: 240px;
  height: 180px;
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1);
}

.gallery-reflection {
  position: absolute;
  width: 240px;
  height: 180px;
  left: 50%;
  top: 50%;
  margin-left: -120px;
  margin-top: -90px;
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1);
  pointer-events: none;
  opacity: 0.08;
  filter: blur(4px);
  -webkit-box-reflect: below 8px linear-gradient(transparent, rgba(255,255,255,0.1));
}

.gallery-nav {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
}

.nav-arrow {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--border-color);
  background: var(--app-surface);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 16px;
}

.nav-arrow:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
  background: var(--primary-light);
}

.nav-dots {
  display: flex;
  gap: 8px;
}

.nav-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  background: var(--border-color);
  cursor: pointer;
  transition: all 0.3s;
  padding: 0;
}

.nav-dot.active {
  background: var(--dot-color, var(--primary-color));
  transform: scale(1.4);
  box-shadow: 0 0 6px var(--dot-color, var(--primary-color));
}

.gallery-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  font-size: 10px;
  color: var(--text-muted);
  opacity: 0.7;
}

.peek-overview {
  display: flex;
  gap: 12px;
  width: 100%;
}

.peek-stat {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.peek-stat small {
  font-size: 8px;
  font-weight: 400;
  color: var(--text-muted);
}

.peek-heatmap {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: repeat(4, 1fr);
  gap: 1px;
  width: 100%;
}

.peek-cell {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 1px;
}

.peek-topsites {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
}

.peek-site {
  display: flex;
  align-items: center;
  gap: 4px;
}

.peek-favicon {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.peek-domain {
  font-size: 8px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.peek-prod {
  width: 100%;
}

.peek-bar {
  height: 4px;
  background: var(--border-color);
  border-radius: 2px;
  overflow: hidden;
}

.peek-bar-fill {
  height: 100%;
  background: #8b5cf6;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.peek-generic {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.peek-icon {
  font-size: 20px;
  opacity: 0.3;
}

.detail-layer {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: detailIn 0.4s cubic-bezier(0.23, 1, 0.32, 1);
}

@keyframes detailIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--app-surface);
  flex-shrink: 0;
}

.detail-back {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s;
}

.detail-back:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.detail-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
}

.detail-title-icon {
  font-size: 16px;
}

.detail-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.loading-placeholder {
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

.overview-strip {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 10px 12px;
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

.overview-divider {
  width: 1px;
  height: 24px;
  background: var(--border-color);
}

.overview-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
}

.overview-label {
  font-size: 9px;
  color: var(--text-muted);
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

.productivity-section {
  flex: 1;
  min-width: 0;
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

.prod-bar-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.prod-bar {
  flex: 1;
  height: 6px;
  background: var(--border-color);
  border-radius: 3px;
  overflow: hidden;
}

.prod-bar-fill {
  height: 100%;
  background: #10b981;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.prod-bar-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
}

.prod-breakdown {
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

.rhythm-inline {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
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
</style>
