import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { HistoryRecord } from '@/utils/helpers'
import { getDomain, stringToColor, formatNumber, PRODUCTIVE_KEYWORDS, UNPRODUCTIVE_KEYWORDS, getFaviconUrl } from '@/utils/helpers'

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
  label: string
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

const CATEGORY_MAP: Map<string, string> = new Map()
const CATEGORY_KEYWORDS: [string, string[]][] = [
  ['社交', ['weibo', 'twitter', 'facebook', 'instagram', 'zhihu', 'douban', 'reddit', 'qq', 'weixin']],
  ['视频', ['youtube', 'bilibili', 'netflix', 'iqiyi', 'youku', 'twitch', 'douyin']],
  ['购物', ['taobao', 'jd', 'amazon', 'pinduoduo', 'ebay', 'tmall']],
  ['新闻', ['news', 'sina', 'bbc', 'cnn', 'toutiao', 'ifeng']],
  ['开发', ['github', 'stackoverflow', 'gitlab', 'npmjs', 'codepen', 'leetcode', 'csdn', 'juejin']],
  ['搜索', ['google', 'baidu', 'bing', 'duckduckgo', 'sogou']],
  ['邮件', ['gmail', 'outlook', 'mail', 'qq.com/mail']],
  ['文档', ['docs', 'notion', 'confluence', 'wiki', 'docs.google']],
]
for (const [cat, keywords] of CATEGORY_KEYWORDS) {
  for (const kw of keywords) CATEGORY_MAP.set(kw, cat)
}

const CATEGORY_COLORS: Record<string, string> = {
  '社交': '#6366f1', '视频': '#ef4444', '购物': '#f59e0b', '新闻': '#10b981',
  '开发': '#3b82f6', '搜索': '#8b5cf6', '邮件': '#ec4899', '文档': '#14b8a6', '其他': '#64748b',
}

function getCategoryForDomain(domain: string): string {
  const lower = domain.toLowerCase()
  for (const [kw, cat] of CATEGORY_MAP) {
    if (lower.includes(kw)) return cat
  }
  return '其他'
}

function isProductive(domain: string): boolean {
  const lower = domain.toLowerCase()
  for (const kw of PRODUCTIVE_KEYWORDS) {
    if (lower.includes(kw)) return true
  }
  return false
}

function isUnproductive(domain: string): boolean {
  const lower = domain.toLowerCase()
  for (const kw of UNPRODUCTIVE_KEYWORDS) {
    if (lower.includes(kw)) return true
  }
  return false
}

function getTimeSlot(hour: number): string {
  if (hour >= 6 && hour < 9) return 'earlyMorning'
  if (hour >= 9 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 14) return 'noon'
  if (hour >= 14 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 21) return 'evening'
  return 'night'
}

const DAYS = ['日', '一', '二', '三', '四', '五', '六']

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

      const cat = getCategoryForDomain(r.domain)
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

      if (isProductive(r.domain)) {
        productiveCount++
        if (productiveDomains.length < 5 && !productiveDomains.includes(r.domain)) {
          productiveDomains.push(r.domain)
        }
      } else if (isUnproductive(r.domain)) {
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
      return { label: `周${DAYS[d.getDay()]}`, count: dayBuckets.get(key) || 0 }
    })

    categoryStats.value = Array.from(catMap.entries())
      .map(([name, count]) => ({ name, count, percentage: Math.round((count / total) * 100), color: CATEGORY_COLORS[name] || '#64748b' }))
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

      if (timeMatch > 0.3) { tags.push('时段匹配'); reason = `${currentSlot === 'morning' ? '上午' : currentSlot === 'afternoon' ? '下午' : currentSlot === 'evening' ? '晚间' : currentSlot === 'night' ? '深夜' : '此时'}常访问` }
      if (dayMatch > 0.3) { tags.push('周期匹配'); if (!reason) reason = `周${DAYS[currentDay]}常访问` }
      if (freq > 0.5) { tags.push('高频'); if (!reason) reason = '高频访问' }
      if (recency > 0.8) { tags.push('最近'); if (!reason) reason = '最近访问' }
      if (habitStrength > 0.5) { tags.push('习惯性'); if (!reason) reason = '每日习惯' }
      if (!reason) reason = '综合推荐'

      return { record: r, score, reason, tags }
    })

    const seen = new Set<string>()
    recommendations.value = scored
      .sort((a, b) => b.score - a.score)
      .filter(r => { if (seen.has(r.record.domain)) return false; seen.add(r.record.domain); return true })
      .slice(0, 8)

    const prodScore = Math.round((productiveCount / total) * 100)
    let prodLevel = '需改善'
    if (prodScore >= 70) prodLevel = '高效'
    else if (prodScore >= 50) prodLevel = '良好'
    else if (prodScore >= 30) prodLevel = '一般'

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

    const sorted = [...filtered].sort((a, b) => a.lastVisitTime - b.lastVisitTime)
    let sessions = 0
    let sessionLen = 0
    if (sorted.length > 0) {
      sessions = 1
      sessionLen = 1
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].lastVisitTime - sorted[i - 1].lastVisitTime > 30 * 60 * 1000) {
          sessions++
        }
        sessionLen++
      }
    }
    const avgSessionLen = sessions > 0 ? Math.round(sessionLen / sessions) : 0

    let pattern = '规律型'
    const nightCount = [22, 23, 0, 1, 2, 3, 4, 5].reduce((s, h) => s + (hourBuckets.get(h) || 0), 0)
    const workCount = [9, 10, 11, 14, 15, 16, 17].reduce((s, h) => s + (hourBuckets.get(h) || 0), 0)
    if (nightCount > total * 0.3) pattern = '夜猫型'
    else if (workCount > total * 0.6) pattern = '工作型'
    else if (sessions > daySet.size * 3) pattern = '碎片型'

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
        if (currentSlot === 'morning') reason = '上午常浏览'
        else if (currentSlot === 'afternoon') reason = '下午常浏览'
        else if (currentSlot === 'evening') reason = '晚间常浏览'
        else if (currentSlot === 'night') reason = '深夜常浏览'
        else if (currentSlot === 'noon') reason = '午间常浏览'
        else reason = '此时段常浏览'
        contextScores.set(domain, { score: combined, reason, favicon: getFaviconUrl(`https://${domain}`) })
      }
    }

    contextualRecs.value = Array.from(contextScores.entries())
      .map(([domain, info]) => ({ domain, ...info }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
  }

  return {
    overview, topSites, weeklyTrend, categoryStats, recommendations, heatmap,
    isLoading, timeRange, productivity, rhythm, interestTrends, contextualRecs,
    computeStats,
  }
})
