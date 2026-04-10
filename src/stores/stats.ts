import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { HistoryRecord } from '@/utils/helpers'
import { getDomain, stringToColor, formatNumber } from '@/utils/helpers'

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

const PRODUCTIVE_KEYWORDS = [
  'github', 'stackoverflow', 'gitlab', 'npmjs', 'codepen', 'leetcode', 'csdn', 'juejin',
  'docs', 'notion', 'confluence', 'wiki', 'docs.google', 'medium', 'dev.to',
  'coursera', 'udemy', 'w3schools', 'mdn', 'typescript', 'python',
  'mail', 'gmail', 'outlook', 'slack', 'teams', 'zoom', 'figma',
  'jira', 'trello', 'asana', 'linear',
]

const UNPRODUCTIVE_KEYWORDS = [
  'youtube', 'bilibili', 'netflix', 'iqiyi', 'youku', 'twitch', 'douyin',
  'weibo', 'twitter', 'facebook', 'instagram', 'reddit', 'zhihu', 'douban',
  'taobao', 'jd', 'amazon', 'pinduoduo', 'tmall', 'ebay',
  'game', 'play', 'music', 'spotify',
]

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  '社交': ['weibo', 'twitter', 'facebook', 'instagram', 'zhihu', 'douban', 'reddit', 'qq', 'weixin'],
  '视频': ['youtube', 'bilibili', 'netflix', 'iqiyi', 'youku', 'twitch', 'douyin'],
  '购物': ['taobao', 'jd', 'amazon', 'pinduoduo', 'ebay', 'tmall'],
  '新闻': ['news', 'sina', 'bbc', 'cnn', 'toutiao', 'ifeng'],
  '开发': ['github', 'stackoverflow', 'gitlab', 'npmjs', 'codepen', 'leetcode', 'csdn', 'juejin'],
  '搜索': ['google', 'baidu', 'bing', 'duckduckgo', 'sogou'],
  '邮件': ['gmail', 'outlook', 'mail', 'qq.com/mail'],
  '文档': ['docs', 'notion', 'confluence', 'wiki', 'docs.google'],
}

function getCategoryForDomain(domain: string): string {
  const lower = domain.toLowerCase()
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return cat
  }
  return '其他'
}

const CATEGORY_COLORS: Record<string, string> = {
  '社交': '#6366f1', '视频': '#ef4444', '购物': '#f59e0b', '新闻': '#10b981',
  '开发': '#3b82f6', '搜索': '#8b5cf6', '邮件': '#ec4899', '文档': '#14b8a6', '其他': '#64748b',
}

function isProductive(domain: string): boolean {
  return PRODUCTIVE_KEYWORDS.some(kw => domain.toLowerCase().includes(kw))
}

function isUnproductive(domain: string): boolean {
  return UNPRODUCTIVE_KEYWORDS.some(kw => domain.toLowerCase().includes(kw))
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

  function computeStats(records: HistoryRecord[]) {
    if (!records.length) return
    isLoading.value = true

    try {
      const now = Date.now()
      let filtered = records

      if (timeRange.value !== 'all') {
        const rangeMs: Record<string, number> = {
          today: 86400000, '3days': 3 * 86400000, week: 7 * 86400000, month: 30 * 86400000,
        }
        const ms = rangeMs[timeRange.value] || 0
        if (ms) filtered = records.filter(r => r.lastVisitTime >= now - ms)
      }

      const weekAgo = now - 7 * 86400000
      const twoWeeksAgo = now - 14 * 86400000
      const weekRecords = filtered.filter(r => r.lastVisitTime >= weekAgo)
      const daySet = new Set<string>()
      filtered.forEach(r => daySet.add(new Date(r.lastVisitTime).toDateString()))

      const domainMap = new Map<string, { count: number; favicon: string; color: string }>()
      filtered.forEach(r => {
        const existing = domainMap.get(r.domain)
        if (existing) existing.count++
        else domainMap.set(r.domain, { count: 1, favicon: `https://icons.duckduckgo.com/ip3/${r.domain}.ico`, color: stringToColor(r.domain) })
      })

      overview.value = {
        totalVisits: filtered.length,
        weekVisits: weekRecords.length,
        dailyAvg: daySet.size > 0 ? Math.round(filtered.length / daySet.size) : 0,
        siteCount: domainMap.size,
      }

      topSites.value = Array.from(domainMap.entries())
        .map(([domain, info]) => ({ domain, ...info }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      const days = ['日', '一', '二', '三', '四', '五', '六']
      const today = new Date()
      const dayBuckets = new Map<string, number>()
      filtered.forEach(r => {
        const d = new Date(r.lastVisitTime)
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
        dayBuckets.set(key, (dayBuckets.get(key) || 0) + 1)
      })
      weeklyTrend.value = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today)
        d.setDate(d.getDate() - (6 - i))
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
        return { label: `周${days[d.getDay()]}`, count: dayBuckets.get(key) || 0 }
      })

      const catMap = new Map<string, number>()
      filtered.forEach(r => {
        const cat = getCategoryForDomain(r.domain)
        catMap.set(cat, (catMap.get(cat) || 0) + 1)
      })
      categoryStats.value = Array.from(catMap.entries())
        .map(([name, count]) => ({ name, count, percentage: Math.round((count / filtered.length) * 100), color: CATEGORY_COLORS[name] || '#64748b' }))
        .sort((a, b) => b.count - a.count)

      // === 智能推荐引擎 (5 维度评分) ===
      const currentHour = new Date().getHours()
      const currentDay = new Date().getDay()
      const currentSlot = getTimeSlot(currentHour)

      const domainTimeSlots = new Map<string, Map<string, number>>()
      filtered.forEach(r => {
        const d = new Date(r.lastVisitTime)
        const slot = getTimeSlot(d.getHours())
        if (!domainTimeSlots.has(r.domain)) domainTimeSlots.set(r.domain, new Map())
        const slots = domainTimeSlots.get(r.domain)!
        slots.set(slot, (slots.get(slot) || 0) + 1)
      })

      const domainDayOfWeek = new Map<string, Map<number, number>>()
      filtered.forEach(r => {
        const d = new Date(r.lastVisitTime)
        if (!domainDayOfWeek.has(r.domain)) domainDayOfWeek.set(r.domain, new Map())
        const days2 = domainDayOfWeek.get(r.domain)!
        days2.set(d.getDay(), (days2.get(d.getDay()) || 0) + 1)
      })

      const domainVisitCounts = new Map<string, number>()
      filtered.forEach(r => domainVisitCounts.set(r.domain, (domainVisitCounts.get(r.domain) || 0) + 1))

      const recentRecords = filtered.filter(r => r.lastVisitTime >= weekAgo)
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
        if (dayMatch > 0.3) { tags.push('周期匹配'); if (!reason) reason = `周${days[currentDay]}常访问` }
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

      // === 热力图 ===
      const heatBuckets = new Map<string, number>()
      filtered.forEach(r => {
        const d = new Date(r.lastVisitTime)
        const key = `${d.getDay()}-${d.getHours()}`
        heatBuckets.set(key, (heatBuckets.get(key) || 0) + 1)
      })
      let maxHeat = 0
      heatBuckets.forEach(v => { if (v > maxHeat) maxHeat = v })
      heatmap.value = Array.from({ length: 7 * 24 }, (_, i) => {
        const day = Math.floor(i / 24)
        const hour = i % 24
        const count = heatBuckets.get(`${day}-${hour}`) || 0
        const level = maxHeat > 0 ? Math.min(4, Math.ceil((count / maxHeat) * 4)) : 0
        return { hour, day, count, level }
      })

      // === 生产力评分 ===
      const productiveDomains: string[] = []
      const unproductiveDomains: string[] = []
      let productiveCount = 0
      let unproductiveCount = 0
      let neutralCount = 0

      filtered.forEach(r => {
        if (isProductive(r.domain)) { productiveCount++; if (!productiveDomains.includes(r.domain)) productiveDomains.push(r.domain) }
        else if (isUnproductive(r.domain)) { unproductiveCount++; if (!unproductiveDomains.includes(r.domain)) unproductiveDomains.push(r.domain) }
        else neutralCount++
      })

      const total = filtered.length || 1
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

      // === 浏览节奏分析 ===
      const hourBuckets = new Map<number, number>()
      const dayBuckets2 = new Map<number, number>()
      filtered.forEach(r => {
        const d = new Date(r.lastVisitTime)
        hourBuckets.set(d.getHours(), (hourBuckets.get(d.getHours()) || 0) + 1)
        dayBuckets2.set(d.getDay(), (dayBuckets2.get(d.getDay()) || 0) + 1)
      })

      let peakHour = 0, peakHourCount = 0
      hourBuckets.forEach((c, h) => { if (c > peakHourCount) { peakHour = h; peakHourCount = c } })
      let peakDay = 0, peakDayCount = 0
      dayBuckets2.forEach((c, d) => { if (c > peakDayCount) { peakDay = d; peakDayCount = c } })

      const sorted = [...filtered].sort((a, b) => a.lastVisitTime - b.lastVisitTime)
      let sessions = 0
      let sessionLen = 0
      let sessionStart = 0
      if (sorted.length > 0) {
        sessionStart = sorted[0].lastVisitTime
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

      // === 兴趣趋势 ===
      const currentWeekMap = new Map<string, number>()
      const previousWeekMap = new Map<string, number>()
      filtered.forEach(r => {
        if (r.lastVisitTime >= weekAgo) {
          currentWeekMap.set(r.domain, (currentWeekMap.get(r.domain) || 0) + 1)
        } else if (r.lastVisitTime >= twoWeeksAgo) {
          previousWeekMap.set(r.domain, (previousWeekMap.get(r.domain) || 0) + 1)
        }
      })

      const allTrendDomains = new Set([...currentWeekMap.keys(), ...previousWeekMap.keys()])
      interestTrends.value = Array.from(allTrendDomains)
        .map(domain => {
          const current = currentWeekMap.get(domain) || 0
          const previous = previousWeekMap.get(domain) || 0
          const change = previous > 0 ? Math.round(((current - previous) / previous) * 100) : (current > 0 ? 100 : 0)
          let direction: 'rising' | 'falling' | 'stable' = 'stable'
          if (change > 20) direction = 'rising'
          else if (change < -20) direction = 'falling'
          return { domain, currentCount: current, previousCount: previous, change, direction, favicon: `https://icons.duckduckgo.com/ip3/${domain}.ico` }
        })
        .filter(t => t.currentCount >= 2 || t.previousCount >= 2)
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
        .slice(0, 8)

      // === 上下文推荐 (基于当前时间) ===
      const contextScores = new Map<string, { score: number; reason: string; favicon: string }>()
      domainTimeSlots.forEach((slots, domain) => {
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
          contextScores.set(domain, { score: combined, reason, favicon: `https://icons.duckduckgo.com/ip3/${domain}.ico` })
        }
      })

      contextualRecs.value = Array.from(contextScores.entries())
        .map(([domain, info]) => ({ domain, ...info }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)

    } finally {
      isLoading.value = false
    }
  }

  return {
    overview, topSites, weeklyTrend, categoryStats, recommendations, heatmap,
    isLoading, timeRange, productivity, rhythm, interestTrends, contextualRecs,
    computeStats,
  }
})
