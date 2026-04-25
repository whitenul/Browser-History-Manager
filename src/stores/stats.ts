import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { HistoryRecord } from '@/utils/helpers'
import { getDomain, stringToColor, formatNumber, getTagProductivity, autoTag, getFaviconUrl, TAG_COLORS } from '@/utils/helpers'
import { perfMark, perfMeasure } from '@/utils/perf'

export interface StatOverview {
  totalVisits: number
  weekVisits: number
  dailyAvg: number
  siteCount: number
}

export interface TopSite {
  domain: string
  count: number
  favicon: string
  color: string
}

export interface HeatmapCell {
  hour: number
  day: number
  count: number
  level: number
}

export interface ProductivityScore {
  score: number
  level: string
  productiveCount: number
  unproductiveCount: number
  neutralCount: number
  topProductive: string[]
  topUnproductive: string[]
}

export interface BrowsingRhythm {
  peakHour: number
  peakDay: number
  avgSessionLength: number
  sessionCount: number
  pattern: string
}

function isProductive(tags: string[]): boolean {
  return tags.some(tag => getTagProductivity(tag) === 'productive')
}

function isUnproductive(tags: string[]): boolean {
  return tags.some(tag => getTagProductivity(tag) === 'unproductive')
}

export const useStatsStore = defineStore('stats', () => {
  const overview = ref<StatOverview>({ totalVisits: 0, weekVisits: 0, dailyAvg: 0, siteCount: 0 })
  const topSites = ref<TopSite[]>([])
  const heatmap = ref<HeatmapCell[]>([])
  const isLoading = ref(false)
  const timeRange = ref('all')
  const productivity = ref<ProductivityScore>({
    score: 0, level: '', productiveCount: 0, unproductiveCount: 0, neutralCount: 0,
    topProductive: [], topUnproductive: [],
  })
  const rhythm = ref<BrowsingRhythm>({
    peakHour: 0, peakDay: 0, avgSessionLength: 0, sessionCount: 0, pattern: '',
  })

  let computePending: number | null = null
  let lastRecordsHash: string = ''
  let lastTimeRange: string = ''

  function computeStats(records: HistoryRecord[]) {
    if (!records.length) return

    const hash = `${records.length}-${records[0]?.lastVisitTime || 0}-${records[records.length - 1]?.lastVisitTime || 0}`
    if (hash === lastRecordsHash && timeRange.value === lastTimeRange) return
    lastRecordsHash = hash
    lastTimeRange = timeRange.value

    if (computePending) {
      cancelAnimationFrame(computePending)
    }

    isLoading.value = true

    computePending = requestAnimationFrame(() => {
      try {
        performComputation(records)
      } finally {
        isLoading.value = false
        computePending = null
      }
    })
  }

  function performComputation(records: HistoryRecord[]) {
    const computeStart = perfMark('stats:compute')
    const now = Date.now()
    const weekAgo = now - 7 * 86400000

    let filtered = records
    if (timeRange.value !== 'all') {
      const rangeMs: Record<string, number> = {
        today: 86400000, '3days': 3 * 86400000, week: 7 * 86400000, month: 30 * 86400000,
      }
      const ms = rangeMs[timeRange.value] || 0
      if (ms) filtered = records.filter(r => r.lastVisitTime >= now - ms)
    }

    const total = filtered.length
    if (total === 0) return

    const domainMap = new Map<string, { count: number; favicon: string; color: string }>()
    const daySet = new Set<string>()
    const heatBuckets = new Map<string, number>()
    const hourBuckets = new Map<number, number>()
    const dayOfWeekBuckets = new Map<number, number>()
    const productiveDomains: string[] = []
    const unproductiveDomains: string[] = []
    let productiveCount = 0
    let unproductiveCount = 0
    let neutralCount = 0
    let weekVisits = 0

    const domainTagCache = new Map<string, string[]>()

    for (let i = 0; i < filtered.length; i++) {
      const r = filtered[i]
      const d = new Date(r.lastVisitTime)
      const hour = d.getHours()
      const day = d.getDay()
      const dateKey = d.toDateString()

      daySet.add(dateKey)

      let domainInfo = domainMap.get(r.domain)
      if (domainInfo) {
        domainInfo.count++
      } else {
        domainInfo = { count: 1, favicon: getFaviconUrl(`https://${r.domain}`), color: stringToColor(r.domain) }
        domainMap.set(r.domain, domainInfo)
      }

      let domainTags = domainTagCache.get(r.domain)
      if (!domainTags) {
        domainTags = autoTag(`https://${r.domain}`, '')
        domainTagCache.set(r.domain, domainTags)
      }

      const heatKey = `${day}-${hour}`
      heatBuckets.set(heatKey, (heatBuckets.get(heatKey) || 0) + 1)

      hourBuckets.set(hour, (hourBuckets.get(hour) || 0) + 1)
      dayOfWeekBuckets.set(day, (dayOfWeekBuckets.get(day) || 0) + 1)

      if (r.lastVisitTime >= weekAgo) {
        weekVisits++
      }

      if (isProductive(domainTags)) {
        productiveCount++
        if (productiveDomains.length < 5 && !productiveDomains.includes(r.domain)) {
          productiveDomains.push(r.domain)
        }
      } else if (isUnproductive(domainTags)) {
        unproductiveCount++
        if (unproductiveDomains.length < 5 && !unproductiveDomains.includes(r.domain)) {
          unproductiveDomains.push(r.domain)
        }
      } else {
        neutralCount++
      }
    }

    overview.value = {
      totalVisits: total,
      weekVisits,
      dailyAvg: daySet.size > 0 ? Math.round(total / daySet.size) : 0,
      siteCount: domainMap.size,
    }

    topSites.value = Array.from(domainMap.entries())
      .map(([domain, info]) => ({ domain, ...info }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    let maxHeat = 0
    for (const v of heatBuckets.values()) {
      if (v > maxHeat) maxHeat = v
    }
    heatmap.value = Array.from({ length: 7 * 24 }, (_, i) => {
      const day = Math.floor(i / 24)
      const hour = i % 24
      const count = heatBuckets.get(`${day}-${hour}`) || 0
      const level = maxHeat > 0 ? Math.min(4, Math.ceil((count / maxHeat) * 4)) : 0
      return { hour, day, count, level }
    })

    const prodScore = Math.round((productiveCount / total) * 100)
    let prodLevel = 'poor'
    if (prodScore >= 70) prodLevel = 'excellent'
    else if (prodScore >= 50) prodLevel = 'good'
    else if (prodScore >= 30) prodLevel = 'fair'

    productivity.value = {
      score: prodScore,
      level: prodLevel,
      productiveCount,
      unproductiveCount,
      neutralCount,
      topProductive: productiveDomains.slice(0, 3),
      topUnproductive: unproductiveDomains.slice(0, 3),
    }

    let peakHour = 0, peakHourCount = 0
    for (const [h, c] of hourBuckets) {
      if (c > peakHourCount) { peakHour = h; peakHourCount = c }
    }
    let peakDay = 0, peakDayCount = 0
    for (const [d, c] of dayOfWeekBuckets) {
      if (c > peakDayCount) { peakDay = d; peakDayCount = c }
    }

    let sessions = 0
    let sessionLen = 0
    if (filtered.length > 0) {
      const sortedTimes = new Float64Array(filtered.length)
      for (let i = 0; i < filtered.length; i++) {
        sortedTimes[i] = filtered[i].lastVisitTime
      }
      sortedTimes.sort()
      sessions = 1
      sessionLen = filtered.length
      for (let i = 1; i < sortedTimes.length; i++) {
        if (sortedTimes[i] - sortedTimes[i - 1] > 30 * 60 * 1000) {
          sessions++
        }
      }
    }
    const avgSessionLen = sessions > 0 ? Math.round(sessionLen / sessions) : 0

    let pattern = 'regular'
    const nightCount = [22, 23, 0, 1, 2, 3, 4, 5].reduce((s, h) => s + (hourBuckets.get(h) || 0), 0)
    const workCount = [9, 10, 11, 14, 15, 16, 17].reduce((s, h) => s + (hourBuckets.get(h) || 0), 0)
    if (nightCount > total * 0.3) pattern = 'nightOwl'
    else if (workCount > total * 0.6) pattern = 'workaholic'
    else if (sessions > daySet.size * 3) pattern = 'fragmented'

    rhythm.value = {
      peakHour,
      peakDay,
      avgSessionLength: avgSessionLen,
      sessionCount: sessions,
      pattern,
    }

    perfMeasure('stats:compute', computeStart, { recordCount: filtered.length, domainCount: domainMap.size })
  }

  return {
    overview, topSites, heatmap,
    isLoading, timeRange, productivity, rhythm,
    computeStats,
  }
})
