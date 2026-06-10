import { computed } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useStatsStore } from '@/stores/stats'

// 缓存今日起始时间，避免每次 computed 重算 new Date()
let cachedDate = ''
let cachedStartOfDay = 0

function getStartOfDay() {
  const today = new Date()
  const dateKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`
  if (dateKey !== cachedDate) {
    cachedDate = dateKey
    cachedStartOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  }
  return cachedStartOfDay
}

export function useDailySummary() {
  const history = useHistoryStore()
  const stats = useStatsStore()

  const dailySummary = computed(() => {
    const startOfDay = getStartOfDay()
    const todayRecords = history.allRecords.filter(r => r.lastVisitTime >= startOfDay)
    const domainMap = new Map<string, number>()
    todayRecords.forEach(r => domainMap.set(r.domain, (domainMap.get(r.domain) || 0) + 1))
    const topDomain = Array.from(domainMap.entries()).sort((a, b) => b[1] - a[1])[0]
    return {
      count: todayRecords.length,
      topDomain: topDomain ? topDomain[0] : '',
      topDomainCount: topDomain ? topDomain[1] : 0,
      productivity: stats.productivity.score,
    }
  })

  return { dailySummary }
}
