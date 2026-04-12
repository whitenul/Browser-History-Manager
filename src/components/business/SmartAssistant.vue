<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useStatsStore } from '@/stores/stats'
import { useUIStore } from '@/stores/ui'
import { autoTag, TAG_COLORS, TAG_ICONS, formatTime, exportToCSV, SOCIAL_KEYWORDS, LEARNING_KEYWORDS, UNPRODUCTIVE_KEYWORDS, getFaviconUrl } from '@/utils/helpers'
import { useI18n } from '@/i18n'

const history = useHistoryStore()
const stats = useStatsStore()
const ui = useUIStore()
const { t } = useI18n()

const currentHour = ref(new Date().getHours())
const hourTimer = ref<ReturnType<typeof setInterval> | null>(null)

onMounted(() => {
  hourTimer.value = setInterval(() => {
    currentHour.value = new Date().getHours()
  }, 60000)
})

onUnmounted(() => {
  if (hourTimer.value) clearInterval(hourTimer.value)
})

interface TimeSuggestion {
  domain: string
  favicon: string
  visitCount: number
  color: string
}

const timeSuggestions = computed<TimeSuggestion[]>(() => {
  const now = Date.now()
  const weekAgo = now - 7 * 86400000
  const domainMap = new Map<string, { count: number; color: string }>()

  for (const r of history.allRecords) {
    if (r.lastVisitTime < weekAgo) continue
    const recordHour = new Date(r.lastVisitTime).getHours()
    if (recordHour !== currentHour.value) continue
    const existing = domainMap.get(r.domain)
    if (existing) existing.count++
    else domainMap.set(r.domain, { count: 1, color: r.domainColor })
  }

  return Array.from(domainMap.entries())
    .map(([domain, info]) => ({
      domain,
      favicon: getFaviconUrl(`https://${domain}`),
      visitCount: info.count,
      color: info.color,
    }))
    .sort((a, b) => b.visitCount - a.visitCount)
    .slice(0, 5)
})

interface HabitAlert {
  id: string
  message: string
  icon: string
  color: string
  bgColor: string
}

const habitAlerts = computed<HabitAlert[]>(() => {
  const alerts: HabitAlert[] = []
  const now = Date.now()
  const oneHourAgo = now - 3600000

  const recentRecords = history.allRecords.filter(r => r.lastVisitTime >= oneHourAgo)
  const socialDomains = new Set<string>()
  for (const r of recentRecords) {
    if (SOCIAL_KEYWORDS.some(kw => r.domain.toLowerCase().includes(kw))) {
      socialDomains.add(r.domain)
    }
  }
  if (socialDomains.size >= 3) {
    alerts.push({
      id: 'social-overuse',
      message: t('assistant.socialOveruse'),
      icon: 'i-lucide:alert-triangle',
      color: '#f59e0b',
      bgColor: 'rgba(245,158,11,0.1)',
    })
  }

  if (stats.rhythm.peakHour === currentHour.value) {
    alerts.push({
      id: 'peak-hour',
      message: t('assistant.peakHour'),
      icon: 'i-lucide:zap',
      color: '#10b981',
      bgColor: 'rgba(16,185,129,0.1)',
    })
  }

  const weekAgo = now - 7 * 86400000
  const learningDomainMap = new Map<string, number>()
  for (const r of history.allRecords) {
    if (r.lastVisitTime < weekAgo) continue
    if (LEARNING_KEYWORDS.some(kw => r.domain.toLowerCase().includes(kw))) {
      learningDomainMap.set(r.domain, (learningDomainMap.get(r.domain) || 0) + 1)
    }
  }
  const topLearning = Array.from(learningDomainMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([d]) => d)

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayDomains = new Set(
    history.allRecords
      .filter(r => r.lastVisitTime >= todayStart.getTime())
      .map(r => r.domain)
  )
  const unvisitedLearning = topLearning.find(d => !todayDomains.has(d))
  if (unvisitedLearning) {
    alerts.push({
      id: 'learning-reminder',
      message: t('assistant.learningReminder', { domain: unvisitedLearning }),
      icon: 'i-lucide:book-open',
      color: '#8b5cf6',
      bgColor: 'rgba(139,92,246,0.1)',
    })
  }

  const todayUniqueDomains = todayDomains.size
  const daysWithRecords = new Set<string>()
  const dailyDomainCounts: number[] = []
  const domainByDay = new Map<string, Set<string>>()

  for (const r of history.allRecords) {
    if (r.lastVisitTime < weekAgo) continue
    const dayKey = new Date(r.lastVisitTime).toDateString()
    daysWithRecords.add(dayKey)
    if (!domainByDay.has(dayKey)) domainByDay.set(dayKey, new Set())
    domainByDay.get(dayKey)!.add(r.domain)
  }

  domainByDay.forEach((domains) => dailyDomainCounts.push(domains.size))
  const avgDomains = dailyDomainCounts.length > 0
    ? dailyDomainCounts.reduce((a, b) => a + b, 0) / dailyDomainCounts.length
    : 0

  if (avgDomains > 0 && todayUniqueDomains < avgDomains * 0.7) {
    alerts.push({
      id: 'breadth-decline',
      message: t('assistant.breadthDecline'),
      icon: 'i-lucide:trending-down',
      color: '#ef4444',
      bgColor: 'rgba(239,68,68,0.1)',
    })
  }

  return alerts
})

interface GroupSuggestion {
  domains: string[]
  label: string
  count: number
}

const groupSuggestions = computed<GroupSuggestion[]>(() => {
  const now = Date.now()
  const weekAgo = now - 7 * 86400000
  const sorted = [...history.allRecords]
    .filter(r => r.lastVisitTime >= weekAgo)
    .sort((a, b) => a.lastVisitTime - b.lastVisitTime)

  const pairMap = new Map<string, { count: number; domains: [string, string] }>()

  for (let i = 0; i < sorted.length; i++) {
    const windowEnd = sorted[i].lastVisitTime + 10 * 60 * 1000
    for (let j = i + 1; j < sorted.length && sorted[j].lastVisitTime <= windowEnd; j++) {
      if (sorted[i].domain === sorted[j].domain) continue
      const pair: [string, string] = sorted[i].domain < sorted[j].domain
        ? [sorted[i].domain, sorted[j].domain]
        : [sorted[j].domain, sorted[i].domain]
      const key = `${pair[0]}|${pair[1]}`
      const existing = pairMap.get(key)
      if (existing) existing.count++
      else pairMap.set(key, { count: 1, domains: pair })
    }
  }

  const existingRulePatterns = new Set(history.customRules.map(r => r.pattern))

  return Array.from(pairMap.values())
    .filter(p => p.count >= 3)
    .filter(p => !existingRulePatterns.has(p.domains[0]) && !existingRulePatterns.has(p.domains[1]))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(p => ({
      domains: p.domains,
      label: suggestGroupLabel(p.domains),
      count: p.count,
    }))
})

function suggestGroupLabel(domains: string[]): string {
  const allTags: string[] = []
  for (const d of domains) {
    const tags = autoTag(`https://${d}`, '')
    allTags.push(...tags)
  }
  const tagCount = new Map<string, number>()
  for (const t of allTags) {
    tagCount.set(t, (tagCount.get(t) || 0) + 1)
  }
  const topTag = Array.from(tagCount.entries()).sort((a, b) => b[1] - a[1])[0]
  return topTag ? topTag[0] : t('assistant.customLabel')
}

function openSuggestion(domain: string) {
  history.openRecord(`https://${domain}`)
}

function createGroup(suggestion: GroupSuggestion) {
  const pattern = suggestion.domains[0]
  history.addCustomRule(suggestion.label, pattern, 'domain')
  ui.notify(t('assistant.groupCreated', { label: suggestion.label }), 'success')
}

function openTopSite() {
  if (stats.topSites.length > 0) {
    history.openRecord(`https://${stats.topSites[0].domain}`)
  }
}

function blockUnproductive() {
  const domainsToBlock = stats.productivity.topUnproductive.slice(0, 3)
  if (domainsToBlock.length === 0) {
    ui.notify(t('assistant.noUnproductiveData'), 'info')
    return
  }
  for (const d of domainsToBlock) {
    history.addBlacklistDomain(d)
  }
  ui.notifyWithUndo(t('assistant.blockedSites', { count: domainsToBlock.length }), () => {
    for (const d of domainsToBlock) {
      history.removeBlacklistDomain(d)
    }
  })
}

function clearToday() {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayRecords = history.allRecords.filter(r => r.lastVisitTime >= todayStart.getTime())
  if (todayRecords.length === 0) {
    ui.notify(t('assistant.noRecordsToday'), 'info')
    return
  }
  const backup = [...history.allRecords]
  history.allRecords = history.allRecords.filter(r => r.lastVisitTime < todayStart.getTime())
  history.applyFilters()
  ui.notifyWithUndo(t('assistant.clearedRecords', { count: todayRecords.length }), () => {
    history.allRecords = backup
    history.applyFilters()
  })
}

function exportTodayReport() {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayRecords = history.allRecords.filter(r => r.lastVisitTime >= todayStart.getTime())
  if (todayRecords.length === 0) {
    ui.notify(t('assistant.noRecordsToday'), 'info')
    return
  }
  exportToCSV(todayRecords, t)
  ui.notify(t('assistant.reportExported'), 'success')
}
</script>

<template>
  <div class="smart-assistant">
    <div class="sa-header">
      <span class="i-lucide:brain sa-header-icon" />
      <span class="sa-title">{{ t('assistant.title') }}</span>
    </div>

    <div v-if="timeSuggestions.length > 0" class="sa-section">
      <div class="sa-section-title">
        <span class="i-lucide:lightbulb" />
        <span>{{ t('assistant.nowRecommend') }}</span>
      </div>
      <div class="suggestion-list">
        <div
          v-for="item in timeSuggestions"
          :key="item.domain"
          class="suggestion-item"
        >
          <img :src="item.favicon" class="suggestion-favicon" @error="($event.target as HTMLImageElement).style.display = 'none'" />
          <div class="suggestion-info">
            <span class="suggestion-domain">{{ item.domain }}</span>
            <span class="suggestion-count">{{ item.visitCount }}{{ t('assistant.visitTimes') }}</span>
          </div>
          <button class="suggestion-open" @click="openSuggestion(item.domain)">{{ t('assistant.open') }}</button>
        </div>
      </div>
    </div>

    <div v-if="habitAlerts.length > 0" class="sa-section">
      <div class="sa-section-title">
        <span class="i-lucide:bell" />
        <span>{{ t('assistant.habitReminder') }}</span>
      </div>
      <div class="alert-list">
        <div
          v-for="alert in habitAlerts"
          :key="alert.id"
          class="alert-card"
          :style="{ color: alert.color, backgroundColor: alert.bgColor }"
        >
          <span :class="alert.icon" class="alert-icon" />
          <span class="alert-message">{{ alert.message }}</span>
        </div>
      </div>
    </div>

    <div v-if="groupSuggestions.length > 0" class="sa-section">
      <div class="sa-section-title">
        <span class="i-lucide:layers" />
        <span>{{ t('assistant.smartGroupSuggestion') }}</span>
      </div>
      <div class="group-list">
        <div
          v-for="(suggestion, idx) in groupSuggestions"
          :key="idx"
          class="group-card"
        >
          <div class="group-info">
            <div class="group-domains">
              <span
                v-for="d in suggestion.domains"
                :key="d"
                class="group-domain-tag"
                :style="{ backgroundColor: (TAG_COLORS[suggestion.label] || '#64748b') + '18', color: TAG_COLORS[suggestion.label] || '#64748b' }"
              >
                {{ d }}
              </span>
            </div>
            <div class="group-desc">
              {{ t('assistant.detectedCoVisit') }}
              <strong>{{ suggestion.domains[0] }}</strong> {{ t('assistant.and') }}
              <strong>{{ suggestion.domains[1] }}</strong>{{ t('assistant.suggestCreateGroup', { label: t('tags.' + suggestion.label) }) }}
            </div>
          </div>
          <button class="group-create-btn" @click="createGroup(suggestion)">
            <span class="i-lucide:plus" />
            {{ t('assistant.createGroup') }}
          </button>
        </div>
      </div>
    </div>

    <div class="sa-section">
      <div class="sa-section-title">
        <span class="i-lucide:zap" />
        <span>{{ t('assistant.quickActions') }}</span>
      </div>
      <div class="action-row">
        <button class="action-btn" @click="openTopSite">
          <span class="i-lucide:globe" />
          <span>{{ t('assistant.openMostUsed') }}</span>
        </button>
        <button class="action-btn action-btn--warn" @click="blockUnproductive">
          <span class="i-lucide:shield-ban" />
          <span>{{ t('assistant.blockUnproductive') }}</span>
        </button>
        <button class="action-btn action-btn--danger" @click="clearToday">
          <span class="i-lucide:trash-2" />
          <span>{{ t('assistant.clearToday') }}</span>
        </button>
        <button class="action-btn action-btn--primary" @click="exportTodayReport">
          <span class="i-lucide:download" />
          <span>{{ t('assistant.exportReport') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.smart-assistant {
  display: flex; flex-direction: column; gap: 10px;
  padding: 12px; background: var(--app-surface);
  border: 1px solid var(--border-color); border-radius: var(--radius-lg);
}

.sa-header {
  display: flex; align-items: center; gap: 6px; margin-bottom: 2px;
}
.sa-header-icon { font-size: 16px; color: var(--primary-color); }
.sa-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }

.sa-section {
  display: flex; flex-direction: column; gap: 6px;
}
.sa-section-title {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 600; color: var(--text-secondary);
}
.sa-section-title > span:first-child { font-size: 13px; }

.suggestion-list {
  display: flex; flex-direction: column; gap: 4px;
}
.suggestion-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; background: var(--app-bg);
  border: 1px solid var(--border-color); border-radius: var(--radius-sm);
  transition: border-color var(--transition-fast);
}
.suggestion-item:hover { border-color: var(--primary-color); }
.suggestion-favicon {
  width: 16px; height: 16px; border-radius: 2px; flex-shrink: 0;
}
.suggestion-info {
  flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px;
}
.suggestion-domain {
  font-size: 11px; font-weight: 500; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.suggestion-count {
  font-size: 9px; color: var(--text-muted);
}
.suggestion-open {
  flex-shrink: 0; padding: 2px 10px; font-size: 10px; font-weight: 500;
  color: var(--primary-color); background: var(--primary-light);
  border: none; border-radius: var(--radius-sm); cursor: pointer;
  transition: all var(--transition-fast);
}
.suggestion-open:hover { opacity: 0.8; }

.alert-list {
  display: flex; flex-direction: column; gap: 4px;
}
.alert-card {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 10px; border-radius: var(--radius-sm);
  font-size: 11px; line-height: 1.4;
}
.alert-icon { font-size: 14px; flex-shrink: 0; }
.alert-message { flex: 1; }

.group-list {
  display: flex; flex-direction: column; gap: 6px;
}
.group-card {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 8px; background: var(--app-bg);
  border: 1px solid var(--border-color); border-radius: var(--radius-sm);
}
.group-info { flex: 1; min-width: 0; }
.group-domains {
  display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 4px;
}
.group-domain-tag {
  display: inline-block; padding: 1px 6px; font-size: 10px; font-weight: 500;
  border-radius: 3px; white-space: nowrap;
}
.group-desc {
  font-size: 10px; color: var(--text-muted); line-height: 1.5;
}
.group-desc strong { color: var(--text-secondary); font-weight: 600; }
.group-create-btn {
  flex-shrink: 0; display: inline-flex; align-items: center; gap: 3px;
  padding: 3px 10px; font-size: 10px; font-weight: 500;
  color: var(--primary-color); background: var(--primary-light);
  border: 1px solid transparent; border-radius: var(--radius-sm);
  cursor: pointer; transition: all var(--transition-fast);
  white-space: nowrap;
}
.group-create-btn:hover { border-color: var(--primary-color); }

.action-row {
  display: flex; gap: 4px; flex-wrap: wrap;
}
.action-btn {
  flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center;
  gap: 4px; padding: 6px 4px; font-size: 10px; font-weight: 500;
  color: var(--text-secondary); background: var(--app-bg);
  border: 1px solid var(--border-color); border-radius: var(--radius-sm);
  cursor: pointer; transition: all var(--transition-fast);
  white-space: nowrap;
}
.action-btn:hover { border-color: var(--primary-color); color: var(--primary-color); }
.action-btn--warn:hover { border-color: #f59e0b; color: #f59e0b; }
.action-btn--danger:hover { border-color: #ef4444; color: #ef4444; }
.action-btn--primary:hover { border-color: #3b82f6; color: #3b82f6; }
</style>
