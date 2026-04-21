import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
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

export interface TrendItem {
  dayIndex: number
  count: number
}

export interface CategoryStat {
  name: string
  count: number
  percentage: number
  color: string
}

export interface Recommendation {
  record: HistoryRecord
  score: number
  reason: string
  tags: string[]
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

export interface InterestTrend {
  domain: string
  currentCount: number
  previousCount: number
  change: number
  direction: 'rising' | 'falling' | 'stable'
  favicon: string
}

export interface ContextualRec {
  domain: string
  reason: string
  favicon: string
  score: number
}

function getCategoryForDomain(domain: string, tagCache?: Map<string, string[]>): string {
  const url = `https://${domain}`
  if (tagCache) {
    const cached = tagCache.get(url)
    if (cached) return cached[0] || 'other'
  }
  const tags = autoTag(url, '')
  return tags[0] || 'other'
}

function getTagsForDomain(domain: string, tagCache?: Map<string, string[]>): string[] {
  const url = `https://${domain}`
  if (tagCache) {
    const cached = tagCache.get(url)
    if (cached) return cached
  }
  return autoTag(url, '')
}

function isProductive(tags: string[]): boolean {
  return tags.some(tag => getTagProductivity(tag) === 'productive')
}

function isUnproductive(tags: string[]): boolean {
  return tags.some(tag => getTagProductivity(tag) === 'unproductive')
}

function getTimeSlot(hour: number): string {
  if (hour >= 6 && hour < 9) return 'earlyMorning'
  if (hour >= 9 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 14) return 'noon'
  if (hour >= 14 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 21) return 'evening'
  return 'night'
}

export const useStatsStore = defineStore('stats', () => {
  const overview = ref<StatOverview>({ totalVisits: 0, weekVisits: 0, dailyAvg: 0, siteCount: 0 })
  const topSites = ref<TopSite[]>([])
  const weeklyTrend = ref<TrendItem[]>([])
  const categoryStats = ref<CategoryStat[]>([])
  const recommendations = ref<Recommendation[]>([])
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
  const interestTrends = ref<InterestTrend[]>([])
  const contextualRecs = ref<ContextualRec[]>([])

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
    const twoWeeksAgo = now - 14 * 86400000

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
    const catMap = new Map<string, number>()
    const heatBuckets = new Map<string, number>()
    const hourBuckets = new Map<number, number>()
    const dayOfWeekBuckets = new Map<number, number>()
    const domainTimeSlots = new Map<string, Map<string, number>>()
    const domainDayOfWeek = new Map<string, Map<number, number>>()
    const domainVisitCounts = new Map<string, number>()
    const currentWeekMap = new Map<string, number>()
    const previousWeekMap = new Map<string, number>()
    const productiveDomains: string[] = []
    const unproductiveDomains: string[] = []
    const dayBuckets = new Map<string, number>()
    const recentRecords: HistoryRecord[] = []
    let productiveCount = 0
    let unproductiveCount = 0
    let neutralCount = 0
    let weekVisits = 0

    const currentHour = new Date().getHours()
    const currentDay = new Date().getDay()
    const currentSlot = getTimeSlot(currentHour)

    const domainTagCache = new Map<string, string[]>()

    for (let i = 0; i < filtered.length; i++) {
      const r = filtered[i]
      const d = new Date(r.lastVisitTime)
      const hour = d.getHours()
      const day = d.getDay()
      const dateKey = d.toDateString()

      daySet.add(dateKey)

      const dateBucketKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      dayBuckets.set(dateBucketKey, (dayBuckets.get(dateBucketKey) || 0) + 1)

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

      const cat = domainTags[0] || 'other'
      catMap.set(cat, (catMap.get(cat) || 0) + 1)

      const heatKey = `${day}-${hour}`
      heatBuckets.set(heatKey, (heatBuckets.get(heatKey) || 0) + 1)

      hourBuckets.set(hour, (hourBuckets.get(hour) || 0) + 1)
      dayOfWeekBuckets.set(day, (dayOfWeekBuckets.get(day) || 0) + 1)

      const slot = getTimeSlot(hour)
      if (!domainTimeSlots.has(r.domain)) domainTimeSlots.set(r.domain, new Map())
      const slots = domainTimeSlots.get(r.domain)!
      slots.set(slot, (slots.get(slot) || 0) + 1)

      if (!domainDayOfWeek.has(r.domain)) domainDayOfWeek.set(r.domain, new Map())
      const days2 = domainDayOfWeek.get(r.domain)!
      days2.set(day, (days2.get(day) || 0) + 1)

      domainVisitCounts.set(r.domain, (domainVisitCounts.get(r.domain) || 0) + 1)

      if (r.lastVisitTime >= weekAgo) {
        weekVisits++
        currentWeekMap.set(r.domain, (currentWeekMap.get(r.domain) || 0) + 1)
        recentRecords.push(r)
      } else if (r.lastVisitTime >= twoWeeksAgo) {
        previousWeekMap.set(r.domain, (previousWeekMap.get(r.domain) || 0) + 1)
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

    const today = new Date()
    weeklyTrend.value = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() - (6 - i))
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      return { dayIndex: d.getDay(), count: dayBuckets.get(key) || 0 }
    })

    categoryStats.value = Array.from(catMap.entries())
      .map(([name, count]) => ({ name, count, percentage: Math.round((count / total) * 100), color: TAG_COLORS[name] || '#64748b' }))
      .sort((a, b) => b.count - a.count)

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

    const scored = recentRecords.map(r => {
      const freq = Math.min(domainVisitCounts.get(r.domain) || 1 / 10, 1)
      const recency = Math.max(0, 1 - (now - r.lastVisitTime) / (7 * 86400000))

      const slots = domainTimeSlots.get(r.domain)
      const timeMatch = slots ? (slots.get(currentSlot) || 0) / (domainVisitCounts.get(r.domain) || 1) : 0

      const days2 = domainDayOfWeek.get(r.domain)
      const dayMatch = days2 ? (days2.get(currentDay) || 0) / (domainVisitCounts.get(r.domain) || 1) : 0

      const habitStrength = Math.min(1, (domainVisitCounts.get(r.domain) || 0) / 7)

      const score = freq * 0.2 + recency * 0.2 + timeMatch * 0.25 + dayMatch * 0.15 + habitStrength * 0.2

      const tags: string[] = []
      let reason = ''

      if (timeMatch > 0.3) { tags.push('timeMatch'); reason = 'slotBrowsing' }
      if (dayMatch > 0.3) { tags.push('dayMatch'); if (!reason) reason = 'dayBrowsing' }
      if (freq > 0.5) { tags.push('frequent'); if (!reason) reason = 'frequentVisit' }
      if (recency > 0.8) { tags.push('recent'); if (!reason) reason = 'recentVisit' }
      if (habitStrength > 0.5) { tags.push('habitual'); if (!reason) reason = 'dailyHabit' }
      if (!reason) reason = 'general'

      return { record: r, score, reason, tags }
    })

    const seen = new Set<string>()
    recommendations.value = scored
      .sort((a, b) => b.score - a.score)
      .filter(r => { if (seen.has(r.record.domain)) return false; seen.add(r.record.domain); return true })
      .slice(0, 8)

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

    const allTrendDomains = new Set([...currentWeekMap.keys(), ...previousWeekMap.keys()])
    interestTrends.value = Array.from(allTrendDomains)
      .map(domain => {
        const current = currentWeekMap.get(domain) || 0
        const previous = previousWeekMap.get(domain) || 0
        const change = previous > 0 ? Math.round(((current - previous) / previous) * 100) : (current > 0 ? 100 : 0)
        let direction: 'rising' | 'falling' | 'stable' = 'stable'
        if (change > 20) direction = 'rising'
        else if (change < -20) direction = 'falling'
        return { domain, currentCount: current, previousCount: previous, change, direction, favicon: getFaviconUrl(`https://${domain}`) }
      })
      .filter(t => t.currentCount >= 2 || t.previousCount >= 2)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 8)

    const contextScores = new Map<string, { score: number; reason: string; favicon: string }>()
    for (const [domain, slots] of domainTimeSlots) {
      const slotScore = slots.get(currentSlot) || 0
      const daySlots = domainDayOfWeek.get(domain)
      const dayScore = daySlots ? (daySlots.get(currentDay) || 0) : 0
      const total2 = domainVisitCounts.get(domain) || 1
      const combined = (slotScore / total2) * 0.6 + (dayScore / total2) * 0.4
      if (combined > 0.15 && slotScore >= 2) {
        let reason = ''
        if (currentSlot === 'morning') reason = 'morningBrowsing'
        else if (currentSlot === 'afternoon') reason = 'afternoonBrowsing'
        else if (currentSlot === 'evening') reason = 'eveningBrowsing'
        else if (currentSlot === 'night') reason = 'nightBrowsing'
        else if (currentSlot === 'noon') reason = 'noonBrowsing'
        else reason = 'slotBrowsing'
        contextScores.set(domain, { score: combined, reason, favicon: getFaviconUrl(`https://${domain}`) })
      }
    }

    contextualRecs.value = Array.from(contextScores.entries())
      .map(([domain, info]) => ({ domain, ...info }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    perfMeasure('stats:compute', computeStart, { recordCount: filtered.length, domainCount: domainMap.size })
  }

  return {
    overview, topSites, weeklyTrend, categoryStats, recommendations, heatmap,
    isLoading, timeRange, productivity, rhythm, interestTrends, contextualRecs,
    computeStats,
  }
})
