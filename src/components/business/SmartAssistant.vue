<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useStatsStore } from '@/stores/stats'
import { useUIStore } from '@/stores/ui'
import { autoTag, TAG_COLORS, TAG_ICONS, getTagProductivity, formatTime, exportToCSV, getFaviconUrl, SessionCoVisitAnalyzer, getEntityForDomain } from '@/utils/helpers'
import type { Recommendation, ContextualRec } from '@/stores/stats'
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

const REASON_LABELS: Record<string, { icon: string; color: string }> = {
  slotBrowsing: { icon: 'i-lucide:clock', color: '#3b82f6' },
  dayBrowsing: { icon: 'i-lucide:calendar', color: '#8b5cf6' },
  frequentVisit: { icon: 'i-lucide:repeat', color: '#f59e0b' },
  recentVisit: { icon: 'i-lucide:zap', color: '#10b981' },
  dailyHabit: { icon: 'i-lucide:target', color: '#ec4899' },
  general: { icon: 'i-lucide:sparkles', color: '#64748b' },
}

interface SmartRec {
  domain: string
  favicon: string
  score: number
  reason: string
  reasonLabel: { icon: string; color: string }
  tags: string[]
  color: string
}

const smartRecommendations = computed<SmartRec[]>(() => {
  const recs = stats.recommendations as Recommendation[]
  if (!recs.length) return []

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayDomains = new Set(
    history.allRecords
      .filter(r => r.lastVisitTime >= todayStart.getTime())
      .map(r => r.domain)
  )

  return recs
    .filter(r => !todayDomains.has(r.record.domain))
    .slice(0, 5)
    .map(r => {
      const reason = r.reason || 'general'
      return {
        domain: r.record.domain,
        favicon: getFaviconUrl(`https://${r.record.domain}`),
        score: r.score,
        reason,
        reasonLabel: REASON_LABELS[reason] || REASON_LABELS.general,
        tags: r.tags,
        color: r.record.domainColor,
      }
    })
})

interface HabitAlert {
  id: string
  message: string
  icon: string
  color: string
  bgColor: string
  action?: { label: string; handler: () => void }
}

const habitAlerts = computed<HabitAlert[]>(() => {
  const alerts: HabitAlert[] = []
  const now = Date.now()
  const oneHourAgo = now - 3600000

  const recentRecords = history.allRecords.filter(r => r.lastVisitTime >= oneHourAgo)
  const unproductiveDomains = new Set<string>()
  const productiveDomains = new Set<string>()
  for (const r of recentRecords) {
    const tags = autoTag(`https://${r.domain}`, r.title || '')
    const prodTypes = tags.map(tag => getTagProductivity(tag))
    if (prodTypes.some(p => p === 'unproductive')) unproductiveDomains.add(r.domain)
    if (prodTypes.some(p => p === 'productive')) productiveDomains.add(r.domain)
  }

  if (unproductiveDomains.size >= 3) {
    alerts.push({
      id: 'unproductive-overuse',
      message: t('assistant.unproductiveOveruse'),
      icon: 'i-lucide:alert-triangle',
      color: '#f59e0b',
      bgColor: 'rgba(245,158,11,0.08)',
      action: {
        label: t('assistant.blockUnproductive'),
        handler: blockUnproductive,
      },
    })
  }

  if (stats.rhythm.peakHour === currentHour.value && productiveDomains.size === 0) {
    alerts.push({
      id: 'peak-hour-focus',
      message: t('assistant.peakHourFocus'),
      icon: 'i-lucide:zap',
      color: '#10b981',
      bgColor: 'rgba(16,185,129,0.08)',
    })
  }

  const weekAgo = now - 7 * 86400000
  const tagVisitMap = new Map<string, { domains: Set<string>; count: number }>()
  for (const r of history.allRecords) {
    if (r.lastVisitTime < weekAgo) continue
    const tags = autoTag(`https://${r.domain}`, r.title || '')
    for (const tag of tags) {
      if (getTagProductivity(tag) !== 'productive') continue
      if (!tagVisitMap.has(tag)) tagVisitMap.set(tag, { domains: new Set(), count: 0 })
      const info = tagVisitMap.get(tag)!
      info.domains.add(r.domain)
      info.count++
    }
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayDomains = new Set(
    history.allRecords
      .filter(r => r.lastVisitTime >= todayStart.getTime())
      .map(r => r.domain)
  )

  const topProductiveTags = Array.from(tagVisitMap.entries())
    .filter(([, info]) => info.count >= 5)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)

  for (const [tag, info] of topProductiveTags) {
    const unvisitedFromTag = Array.from(info.domains).find(d => !todayDomains.has(d))
    if (unvisitedFromTag) {
      const tagLabel = t(`tags.${tag}`)
      alerts.push({
        id: `tag-reminder-${tag}`,
        message: t('assistant.tagReminder', { tag: tagLabel, domain: unvisitedFromTag }),
        icon: TAG_ICONS[tag] || 'i-lucide:book-open',
        color: TAG_COLORS[tag] || '#8b5cf6',
        bgColor: (TAG_COLORS[tag] || '#8b5cf6') + '14',
      })
      break
    }
  }

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

  if (avgDomains > 0 && todayDomains.size < avgDomains * 0.7) {
    alerts.push({
      id: 'breadth-decline',
      message: t('assistant.breadthDecline'),
      icon: 'i-lucide:trending-down',
      color: '#ef4444',
      bgColor: 'rgba(239,68,68,0.08)',
    })
  }

  return alerts
})

interface InterestDiscovery {
  domain: string
  favicon: string
  tag: string
  tagColor: string
  tagIcon: string
  score: number
  entityName: string
}

const interestDiscoveries = computed<InterestDiscovery[]>(() => {
  const catStats = stats.categoryStats
  if (!catStats.length) return []

  const weekAgo = Date.now() - 7 * 86400000
  const visitedDomains = new Set(
    history.allRecords
      .filter(r => r.lastVisitTime >= weekAgo)
      .map(r => r.domain)
  )

  const topTags = catStats
    .filter(c => c.percentage >= 10)
    .slice(0, 3)
    .map(c => c.name)

  const discoveries: InterestDiscovery[] = []
  const seenDomains = new Set<string>()

  const contextRecs = stats.contextualRecs as ContextualRec[]
  for (const rec of contextRecs) {
    if (seenDomains.has(rec.domain) || visitedDomains.has(rec.domain)) continue
    const tags = autoTag(`https://${rec.domain}`, '')
    const matchingTag = tags.find(tag => topTags.includes(tag))
    if (matchingTag) {
      const entity = getEntityForDomain(rec.domain)
      discoveries.push({
        domain: rec.domain,
        favicon: rec.favicon,
        tag: matchingTag,
        tagColor: TAG_COLORS[matchingTag] || '#64748b',
        tagIcon: TAG_ICONS[matchingTag] || 'i-lucide:tag',
        score: rec.score,
        entityName: entity?.names.zh || '',
      })
      seenDomains.add(rec.domain)
    }
  }

  if (discoveries.length < 3) {
    const analyzer = new SessionCoVisitAnalyzer(5 * 60 * 1000)
    analyzer.analyzeSessions(history.allRecords, 50)
    const recentDomain = stats.topSites[0]?.domain
    if (recentDomain) {
      const related = analyzer.getRelatedDomains(recentDomain, 5)
      for (const r of related) {
        if (seenDomains.has(r.domainB)) continue
        const tags = autoTag(`https://${r.domainB}`, '')
        const matchingTag = tags.find(tag => topTags.includes(tag))
        if (matchingTag) {
          const entity = getEntityForDomain(r.domainB)
          discoveries.push({
            domain: r.domainB,
            favicon: getFaviconUrl(`https://${r.domainB}`),
            tag: matchingTag,
            tagColor: TAG_COLORS[matchingTag] || '#64748b',
            tagIcon: TAG_ICONS[matchingTag] || 'i-lucide:tag',
            score: r.coVisitCount / 10,
            entityName: entity?.names.zh || '',
          })
          seenDomains.add(r.domainB)
        }
      }
    }
  }

  return discoveries.slice(0, 5)
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
    .slice(0, 2)
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

const hasContent = computed(() =>
  smartRecommendations.value.length > 0 ||
  habitAlerts.value.length > 0 ||
  interestDiscoveries.value.length > 0 ||
  groupSuggestions.value.length > 0
)
</script>

<template>
  <div class="smart-assistant">
    <div class="sa-header">
      <span class="i-lucide:brain sa-header-icon" />
      <span class="sa-title">{{ t('assistant.title') }}</span>
    </div>

    <div v-if="smartRecommendations.length > 0" class="sa-card sa-card--primary">
      <div class="sa-card-header">
        <span class="i-lucide:lightbulb sa-card-icon" />
        <span class="sa-card-title">{{ t('assistant.nowRecommend') }}</span>
      </div>
      <div class="rec-list">
        <div
          v-for="item in smartRecommendations"
          :key="item.domain"
          class="rec-item"
          @click="openSuggestion(item.domain)"
        >
          <img :src="item.favicon" class="rec-favicon" @error="($event.target as HTMLImageElement).style.display = 'none'" />
          <div class="rec-info">
            <span class="rec-domain">{{ item.domain }}</span>
            <span class="rec-reason">
              <span :class="item.reasonLabel.icon" class="rec-reason-icon" :style="{ color: item.reasonLabel.color }" />
              {{ t(`assistant.reason_${item.reason}`) }}
            </span>
          </div>
          <div class="rec-score-bar">
            <div class="rec-score-fill" :style="{ width: Math.round(item.score * 100) + '%', background: item.reasonLabel.color }" />
          </div>
        </div>
      </div>
    </div>

    <div v-if="habitAlerts.length > 0" class="sa-card">
      <div class="sa-card-header">
        <span class="i-lucide:bell sa-card-icon" />
        <span class="sa-card-title">{{ t('assistant.habitReminder') }}</span>
      </div>
      <div class="alert-list">
        <div
          v-for="alert in habitAlerts"
          :key="alert.id"
          class="alert-item"
          :style="{ borderLeftColor: alert.color }"
        >
          <div class="alert-content">
            <span :class="alert.icon" class="alert-icon" :style="{ color: alert.color }" />
            <span class="alert-message">{{ alert.message }}</span>
          </div>
          <button v-if="alert.action" class="alert-action" :style="{ color: alert.color }" @click="alert.action.handler">
            {{ alert.action.label }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="interestDiscoveries.length > 0" class="sa-card sa-card--accent">
      <div class="sa-card-header">
        <span class="i-lucide:compass sa-card-icon" />
        <span class="sa-card-title">{{ t('assistant.interestDiscovery') }}</span>
      </div>
      <div class="disc-list">
        <div
          v-for="item in interestDiscoveries"
          :key="item.domain"
          class="disc-item"
          @click="openSuggestion(item.domain)"
        >
          <img :src="item.favicon" class="disc-favicon" @error="($event.target as HTMLImageElement).style.display = 'none'" />
          <div class="disc-info">
            <span class="disc-domain">
              {{ item.domain }}
              <span v-if="item.entityName" class="disc-entity">{{ item.entityName }}</span>
            </span>
            <span class="disc-tag" :style="{ color: item.tagColor, background: item.tagColor + '14' }">
              <span :class="item.tagIcon" class="disc-tag-icon" />
              {{ t(`tags.${item.tag}`) }}
            </span>
          </div>
          <span class="i-lucide:chevron-right disc-arrow" />
        </div>
      </div>
    </div>

    <div v-if="groupSuggestions.length > 0" class="sa-card">
      <div class="sa-card-header">
        <span class="i-lucide:layers sa-card-icon" />
        <span class="sa-card-title">{{ t('assistant.smartGroupSuggestion') }}</span>
      </div>
      <div class="group-list">
        <div
          v-for="(suggestion, idx) in groupSuggestions"
          :key="idx"
          class="group-item"
        >
          <div class="group-domains">
            <span
              v-for="d in suggestion.domains"
              :key="d"
              class="group-tag"
              :style="{ backgroundColor: (TAG_COLORS[suggestion.label] || '#64748b') + '14', color: TAG_COLORS[suggestion.label] || '#64748b' }"
            >
              {{ d }}
            </span>
          </div>
          <div class="group-meta">
            <span class="group-label" :style="{ color: TAG_COLORS[suggestion.label] || '#64748b' }">
              {{ t(`tags.${suggestion.label}`) }}
            </span>
            <span class="group-count">{{ suggestion.count }}{{ t('assistant.coVisitTimes') }}</span>
          </div>
          <button class="group-btn" @click="createGroup(suggestion)">
            <span class="i-lucide:plus" />
            {{ t('assistant.createGroup') }}
          </button>
        </div>
      </div>
    </div>

    <div class="sa-card sa-card--actions">
      <div class="sa-card-header">
        <span class="i-lucide:zap sa-card-icon" />
        <span class="sa-card-title">{{ t('assistant.quickActions') }}</span>
      </div>
      <div class="action-grid">
        <button class="action-cell" @click="openTopSite">
          <span class="i-lucide:globe action-cell-icon" />
          <span class="action-cell-text">{{ t('assistant.openMostUsed') }}</span>
        </button>
        <button class="action-cell action-cell--warn" @click="blockUnproductive">
          <span class="i-lucide:shield-ban action-cell-icon" />
          <span class="action-cell-text">{{ t('assistant.blockUnproductive') }}</span>
        </button>
        <button class="action-cell action-cell--danger" @click="clearToday">
          <span class="i-lucide:trash-2 action-cell-icon" />
          <span class="action-cell-text">{{ t('assistant.clearToday') }}</span>
        </button>
        <button class="action-cell action-cell--primary" @click="exportTodayReport">
          <span class="i-lucide:download action-cell-icon" />
          <span class="action-cell-text">{{ t('assistant.exportReport') }}</span>
        </button>
      </div>
    </div>

    <div v-if="!hasContent" class="sa-empty">
      <span class="i-lucide:brain sa-empty-icon" />
      <span class="sa-empty-text">{{ t('assistant.noData') }}</span>
    </div>
  </div>
</template>

<style scoped>
.smart-assistant {
  display: flex; flex-direction: column; gap: 8px;
  padding: 10px; background: var(--app-surface);
  border: 1px solid var(--border-color); border-radius: var(--radius-lg);
}

.sa-header {
  display: flex; align-items: center; gap: 6px;
  padding-bottom: 4px; border-bottom: 1px solid var(--border-color);
}
.sa-header-icon { font-size: 15px; color: var(--primary-color); }
.sa-title { font-size: 12px; font-weight: 600; color: var(--text-primary); }

.sa-card {
  display: flex; flex-direction: column; gap: 6px;
  padding: 8px; border-radius: var(--radius-md);
  background: var(--app-bg); border: 1px solid var(--border-color);
}
.sa-card--primary { border-color: var(--primary-light); }
.sa-card--accent { border-color: rgba(139,92,246,0.2); }
.sa-card--actions { background: transparent; border-color: transparent; padding: 4px 0; }

.sa-card-header {
  display: flex; align-items: center; gap: 5px;
}
.sa-card-icon { font-size: 12px; color: var(--text-muted); }
.sa-card-title { font-size: 11px; font-weight: 600; color: var(--text-secondary); }

.rec-list { display: flex; flex-direction: column; gap: 4px; }
.rec-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; border-radius: var(--radius-sm);
  cursor: pointer; transition: background var(--transition-fast);
}
.rec-item:hover { background: var(--primary-light); }
.rec-favicon { width: 16px; height: 16px; border-radius: 2px; flex-shrink: 0; }
.rec-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.rec-domain {
  font-size: 11px; font-weight: 500; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.rec-reason {
  display: flex; align-items: center; gap: 3px;
  font-size: 9px; color: var(--text-muted);
}
.rec-reason-icon { font-size: 10px; }
.rec-score-bar {
  width: 40px; height: 4px; border-radius: 2px;
  background: var(--border-color); flex-shrink: 0; overflow: hidden;
}
.rec-score-fill { height: 100%; border-radius: 2px; transition: width 0.3s ease; }

.alert-list { display: flex; flex-direction: column; gap: 4px; }
.alert-item {
  display: flex; align-items: center; justify-content: space-between; gap: 6px;
  padding: 6px 8px; border-radius: var(--radius-sm);
  border-left: 3px solid; background: var(--app-surface);
}
.alert-content { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }
.alert-icon { font-size: 13px; flex-shrink: 0; }
.alert-message { font-size: 10px; color: var(--text-secondary); line-height: 1.4; }
.alert-action {
  flex-shrink: 0; padding: 2px 8px; font-size: 9px; font-weight: 500;
  background: transparent; border: 1px solid currentColor; border-radius: var(--radius-sm);
  cursor: pointer; transition: opacity var(--transition-fast); white-space: nowrap;
}
.alert-action:hover { opacity: 0.7; }

.disc-list { display: flex; flex-direction: column; gap: 4px; }
.disc-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; border-radius: var(--radius-sm);
  cursor: pointer; transition: background var(--transition-fast);
}
.disc-item:hover { background: rgba(139,92,246,0.06); }
.disc-favicon { width: 16px; height: 16px; border-radius: 2px; flex-shrink: 0; }
.disc-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.disc-domain {
  font-size: 11px; font-weight: 500; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  display: flex; align-items: center; gap: 4px;
}
.disc-entity {
  font-size: 8px; font-weight: 500;
  color: var(--primary-color); background: var(--primary-light);
  padding: 0 4px; border-radius: 6px; white-space: nowrap;
}
.disc-tag {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 9px; font-weight: 500; padding: 1px 5px;
  border-radius: 3px; width: fit-content;
}
.disc-tag-icon { font-size: 9px; }
.disc-arrow { font-size: 12px; color: var(--text-muted); flex-shrink: 0; }

.group-list { display: flex; flex-direction: column; gap: 4px; }
.group-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; background: var(--app-surface);
  border-radius: var(--radius-sm);
}
.group-domains { display: flex; gap: 4px; flex-shrink: 0; }
.group-tag {
  display: inline-block; padding: 1px 6px; font-size: 9px; font-weight: 500;
  border-radius: 3px; white-space: nowrap;
}
.group-meta { flex: 1; display: flex; align-items: center; gap: 6px; min-width: 0; }
.group-label { font-size: 10px; font-weight: 500; }
.group-count { font-size: 9px; color: var(--text-muted); }
.group-btn {
  flex-shrink: 0; display: inline-flex; align-items: center; gap: 3px;
  padding: 2px 8px; font-size: 9px; font-weight: 500;
  color: var(--primary-color); background: var(--primary-light);
  border: none; border-radius: var(--radius-sm);
  cursor: pointer; transition: opacity var(--transition-fast); white-space: nowrap;
}
.group-btn:hover { opacity: 0.8; }

.action-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
}
.action-cell {
  display: flex; align-items: center; justify-content: center;
  gap: 4px; padding: 8px 4px; font-size: 10px; font-weight: 500;
  color: var(--text-secondary); background: var(--app-bg);
  border: 1px solid var(--border-color); border-radius: var(--radius-sm);
  cursor: pointer; transition: all var(--transition-fast);
}
.action-cell:hover { border-color: var(--primary-color); color: var(--primary-color); }
.action-cell-icon { font-size: 12px; }
.action-cell-text { white-space: nowrap; }
.action-cell--warn:hover { border-color: #f59e0b; color: #f59e0b; }
.action-cell--danger:hover { border-color: #ef4444; color: #ef4444; }
.action-cell--primary:hover { border-color: #3b82f6; color: #3b82f6; }

.sa-empty {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 16px 0;
}
.sa-empty-icon { font-size: 20px; color: var(--text-muted); opacity: 0.5; }
.sa-empty-text { font-size: 10px; color: var(--text-muted); }
</style>
