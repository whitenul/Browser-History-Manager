<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useStatsStore } from '@/stores/stats'
import { useUIStore } from '@/stores/ui'
import { getFaviconUrl, formatNumber } from '@/utils/helpers'
import BrowsingDNA from '@/components/business/BrowsingDNA.vue'
import FocusMode from '@/components/business/FocusMode.vue'
import ReadingQueue from '@/components/business/ReadingQueue.vue'
import SmartTimeline from '@/components/business/SmartTimeline.vue'
import SmartAssistant from '@/components/business/SmartAssistant.vue'
import EnhancedCharts from '@/components/business/EnhancedCharts.vue'

const history = useHistoryStore()
const stats = useStatsStore()
const ui = useUIStore()

const carouselPage = ref(0)
const HEAT_COLORS = ['var(--app-surface)', 'rgba(99,102,241,0.2)', 'rgba(99,102,241,0.4)', 'rgba(99,102,241,0.65)', 'rgba(99,102,241,0.9)']

const timeOptions = [
  { value: 'today', label: '今日' },
  { value: '3days', label: '3天' },
  { value: 'week', label: '7天' },
  { value: 'month', label: '30天' },
  { value: 'all', label: '全部' },
]

const overviewCards = [
  { key: 'totalVisits' as const, label: '总访问', icon: 'i-lucide:eye', color: '#6366f1' },
  { key: 'weekVisits' as const, label: '本周访问', icon: 'i-lucide:calendar', color: '#10b981' },
  { key: 'dailyAvg' as const, label: '日均访问', icon: 'i-lucide:trending-up', color: '#f59e0b' },
  { key: 'siteCount' as const, label: '网站数', icon: 'i-lucide:globe', color: '#3b82f6' },
]

const topSitesPaged = computed(() => {
  const start = carouselPage.value * 5
  return stats.topSites.slice(start, start + 5)
})
const maxCarouselPage = computed(() => Math.max(0, Math.ceil(stats.topSites.length / 5) - 1))
const maxTrend = computed(() => Math.max(...stats.weeklyTrend.map(t => t.count), 1))
const dayLabels = ['日', '一', '二', '三', '四', '五', '六']

const prodScoreColor = computed(() => {
  const s = stats.productivity.score
  if (s >= 70) return '#10b981'
  if (s >= 50) return '#3b82f6'
  if (s >= 30) return '#f59e0b'
  return '#ef4444'
})

const prodRingDash = computed(() => {
  const circumference = 2 * Math.PI * 36
  return `${stats.productivity.score / 100 * circumference} ${circumference}`
})

const rhythmPatternIcon = computed(() => {
  const p = stats.rhythm.pattern
  if (p === '夜猫型') return 'i-lucide:moon'
  if (p === '工作型') return 'i-lucide:briefcase'
  if (p === '碎片型') return 'i-lucide:shuffle'
  return 'i-lucide:clock'
})

const rhythmPatternColor = computed(() => {
  const p = stats.rhythm.pattern
  if (p === '夜猫型') return '#8b5cf6'
  if (p === '工作型') return '#3b82f6'
  if (p === '碎片型') return '#f59e0b'
  return '#10b981'
})

const TAG_COLORS: Record<string, string> = {
  '时段匹配': '#8b5cf6',
  '周期匹配': '#6366f1',
  '高频': '#ef4444',
  '最近': '#10b981',
  '习惯性': '#f59e0b',
}

function tagColor(tag: string): string {
  return TAG_COLORS[tag] || '#64748b'
}

watch(() => history.allRecords.length, () => {
  if (history.allRecords.length > 0) stats.computeStats(history.allRecords)
}, { immediate: true })

watch(() => stats.timeRange, () => {
  if (history.allRecords.length > 0) stats.computeStats(history.allRecords)
})

watch(() => stats.topSites.length, () => { carouselPage.value = 0 })

function openUrl(url: string) {
  chrome.tabs.create({ url })
}

function blacklistDomain(domain: string) {
  const removed = domain
  history.addBlacklistDomain(domain)
  ui.notifyWithUndo(`已屏蔽 ${domain}`, () => {
    history.removeBlacklistDomain(removed)
  })
}

function onHeatCellClick(cell: { day: number; hour: number; count: number }) {
  if (cell.count === 0) return
  const dayName = dayLabels[cell.day]
  const hourStr = String(cell.hour).padStart(2, '0')
  history.setTimeFilter(cell.day, cell.hour, cell.hour + 1, `周${dayName} ${hourStr}:00-${hourStr}:59`)
  ui.navigateTo('history', `周${dayName} ${hourStr}:00`)
}

function blacklistUnproductive() {
  const domains = [...stats.productivity.topUnproductive]
  domains.forEach(d => history.addBlacklistDomain(d))
  ui.notifyWithUndo(`已屏蔽 ${domains.length} 个低效网站`, () => {
    domains.forEach(d => history.removeBlacklistDomain(d))
  })
}

function filterByDomain(domain: string) {
  history.setDomainFilter(domain, `域名: ${domain}`)
  ui.navigateTo('history', '筛选: ' + domain)
}

function viewTrendDomain(domain: string) {
  history.setDomainFilter(domain, `域名: ${domain}`)
  ui.navigateTo('history', '趋势: ' + domain)
}

onMounted(() => {
  const savedScroll = ui.getScrollPosition('stats')
  if (savedScroll > 0) {
    nextTick(() => {
      const el = document.querySelector('.stats-content') as HTMLElement
      if (el) el.scrollTop = savedScroll
    })
  }
})
</script>

<template>
  <div class="stats-view">
    <div class="stats-header">
      <span class="header-title">数据统计</span>
      <div class="time-filter">
        <button
          v-for="opt in timeOptions"
          :key="opt.value"
          class="time-btn"
          :class="{ active: stats.timeRange === opt.value }"
          @click="stats.timeRange = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <div class="stats-content">
      <div class="overview-grid">
        <div v-for="card in overviewCards" :key="card.key" class="overview-card">
          <span :class="card.icon" class="card-icon" :style="{ color: card.color }" />
          <div class="card-value">{{ formatNumber((stats.overview as any)[card.key]) }}</div>
          <div class="card-label">{{ card.label }}</div>
        </div>
      </div>

      <div class="innovation-grid">
        <SmartTimeline />
        <SmartAssistant />
        <BrowsingDNA />
        <FocusMode />
        <ReadingQueue />
      </div>

      <div class="section">
        <EnhancedCharts />
      </div>

      <div v-if="stats.contextualRecs.length > 0" class="section">
        <div class="section-title">
          <span class="i-lucide:compass section-icon" />
          此时段常浏览
          <button class="action-chip" @click="ui.showCommandPalette = true">
            <span class="i-lucide:terminal" />⌘K
          </button>
        </div>
        <div class="contextual-recs">
          <div v-for="rec in stats.contextualRecs" :key="rec.domain" class="ctx-item">
            <img :src="rec.favicon" class="ctx-favicon" loading="lazy"
              @error="($event.target as HTMLImageElement).style.display='none'" />
            <div class="ctx-info" @click="openUrl('https://' + rec.domain)">
              <div class="ctx-domain">{{ rec.domain }}</div>
              <div class="ctx-reason">{{ rec.reason }}</div>
            </div>
            <div class="ctx-score-bar">
              <div class="ctx-bar" :style="{ width: Math.round(rec.score * 100) + '%' }" />
            </div>
            <button class="mini-action" title="查看历史" @click.stop="filterByDomain(rec.domain)">
              <span class="i-lucide:search" />
            </button>
          </div>
        </div>
      </div>

      <div v-if="stats.recommendations.length > 0" class="section">
        <div class="section-title">
          <span class="i-lucide:flame section-icon" />
          智能推荐
        </div>
        <div class="recommendations">
          <div v-for="rec in stats.recommendations" :key="rec.record.url" class="rec-item" @click="openUrl(rec.record.url)">
            <img :src="getFaviconUrl(rec.record.url)" class="rec-favicon" loading="lazy" />
            <div class="rec-info">
              <div class="rec-title">{{ rec.record.title || rec.record.domain }}</div>
              <div class="rec-meta">
                <span class="rec-reason">{{ rec.reason }}</span>
                <span class="rec-tags">
                  <span v-for="tag in rec.tags" :key="tag" class="rec-tag" :style="{ backgroundColor: tagColor(tag) + '18', color: tagColor(tag), borderColor: tagColor(tag) + '40' }">
                    {{ tag }}
                  </span>
                </span>
              </div>
            </div>
            <span class="rec-score">{{ Math.round(rec.score * 100) }}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">
          <span class="i-lucide:zap section-icon" />
          生产力评分
        </div>
        <div class="prod-card">
          <div class="prod-gauge">
            <svg viewBox="0 0 80 80" class="gauge-svg">
              <circle cx="40" cy="40" r="36" fill="none" stroke="var(--border-color)" stroke-width="5" />
              <circle cx="40" cy="40" r="36" fill="none" :stroke="prodScoreColor" stroke-width="5"
                :stroke-dasharray="prodRingDash"
                stroke-linecap="round" transform="rotate(-90 40 40)" class="gauge-ring" />
            </svg>
            <div class="gauge-value" :style="{ color: prodScoreColor }">{{ stats.productivity.score }}</div>
          </div>
          <div class="prod-details">
            <span class="prod-level" :style="{ backgroundColor: prodScoreColor + '20', color: prodScoreColor }">
              {{ stats.productivity.level }}
            </span>
            <div class="prod-breakdown">
              <div class="prod-row">
                <span class="prod-dot productive" />
                <span class="prod-label">高效浏览</span>
                <span class="prod-num">{{ stats.productivity.productiveCount }}</span>
              </div>
              <div class="prod-row">
                <span class="prod-dot unproductive" />
                <span class="prod-label">低效浏览</span>
                <span class="prod-num">{{ stats.productivity.unproductiveCount }}</span>
              </div>
              <div class="prod-row">
                <span class="prod-dot neutral" />
                <span class="prod-label">中性浏览</span>
                <span class="prod-num">{{ stats.productivity.neutralCount }}</span>
              </div>
            </div>
            <div v-if="stats.productivity.topProductive.length > 0" class="prod-domains">
              <div class="prod-domain-label">高效网站</div>
              <span v-for="d in stats.productivity.topProductive" :key="d" class="prod-domain-tag productive-tag" @click="filterByDomain(d)" title="点击查看历史">
                {{ d }}
              </span>
            </div>
            <div v-if="stats.productivity.topUnproductive.length > 0" class="prod-domains">
              <div class="prod-domain-label">
                低效网站
                <button class="action-chip danger-chip" @click="blacklistUnproductive">
                  <span class="i-lucide:shield-ban" />一键屏蔽
                </button>
              </div>
              <span v-for="d in stats.productivity.topUnproductive" :key="d" class="prod-domain-tag unproductive-tag" @click="blacklistDomain(d)" title="点击屏蔽">
                {{ d }}
                <span class="i-lucide:x tag-x" />
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">
          <span class="i-lucide:activity section-icon" />
          浏览节奏
        </div>
        <div class="rhythm-card">
          <div class="rhythm-pattern">
            <span :class="rhythmPatternIcon" class="pattern-icon" :style="{ color: rhythmPatternColor }" />
            <span class="pattern-badge" :style="{ backgroundColor: rhythmPatternColor + '20', color: rhythmPatternColor }">
              {{ stats.rhythm.pattern }}
            </span>
          </div>
          <div class="rhythm-stats">
            <div class="rhythm-stat">
              <span class="i-lucide:clock rhythm-stat-icon" />
              <span class="rhythm-stat-label">活跃高峰</span>
              <span class="rhythm-stat-value">{{ stats.rhythm.peakHour }}:00</span>
            </div>
            <div class="rhythm-stat">
              <span class="i-lucide:calendar rhythm-stat-icon" />
              <span class="rhythm-stat-label">最活跃日</span>
              <span class="rhythm-stat-value">周{{ dayLabels[stats.rhythm.peakDay] }}</span>
            </div>
            <div class="rhythm-stat">
              <span class="i-lucide:layers rhythm-stat-icon" />
              <span class="rhythm-stat-label">浏览会话</span>
              <span class="rhythm-stat-value">{{ stats.rhythm.sessionCount }} 次</span>
            </div>
            <div class="rhythm-stat">
              <span class="i-lucide:hash rhythm-stat-icon" />
              <span class="rhythm-stat-label">平均会话</span>
              <span class="rhythm-stat-value">{{ stats.rhythm.avgSessionLength }} 条</span>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">
          <span class="i-lucide:trophy section-icon" />
          热门网站 TOP {{ stats.topSites.length }}
        </div>
        <div class="carousel">
          <div v-for="site in topSitesPaged" :key="site.domain" class="top-site">
            <img :src="site.favicon" class="site-favicon" loading="lazy"
              @error="($event.target as HTMLImageElement).style.display='none'" />
            <div class="site-info" @click="filterByDomain(site.domain)" style="cursor:pointer">
              <div class="site-domain">{{ site.domain }}</div>
              <div class="site-count">{{ site.count }} 次</div>
            </div>
            <div class="site-bar-wrap">
              <div class="site-bar" :style="{ width: Math.min(100, (site.count / (stats.topSites[0]?.count || 1)) * 100) + '%', background: site.color }" />
            </div>
            <button class="mini-action" title="屏蔽域名" @click.stop="blacklistDomain(site.domain)">
              <span class="i-lucide:ban" />
            </button>
          </div>
          <div v-if="maxCarouselPage > 0" class="carousel-nav">
            <button class="nav-btn" :disabled="carouselPage === 0" @click="carouselPage--">
              <span class="i-lucide:chevron-left" />
            </button>
            <span class="nav-info">{{ carouselPage + 1 }} / {{ maxCarouselPage + 1 }}</span>
            <button class="nav-btn" :disabled="carouselPage >= maxCarouselPage" @click="carouselPage++">
              <span class="i-lucide:chevron-right" />
            </button>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">
          <span class="i-lucide:bar-chart-3 section-icon" />
          本周趋势
        </div>
        <div class="trend-chart">
          <div v-for="item in stats.weeklyTrend" :key="item.label" class="trend-col">
            <div class="trend-bar-wrap">
              <div
                class="trend-bar"
                :style="{ height: Math.max(2, (item.count / maxTrend) * 80) + 'px' }"
              />
            </div>
            <span class="trend-label">{{ item.label }}</span>
            <span class="trend-count">{{ item.count }}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">
          <span class="i-lucide:grid-3x3 section-icon" />
          浏览热力图
        </div>
        <div class="heatmap">
          <div class="heatmap-labels">
            <span v-for="d in dayLabels" :key="d" class="heatmap-day-label">{{ d }}</span>
          </div>
          <div class="heatmap-grid">
            <div v-for="(cell, idx) in stats.heatmap" :key="idx"
              class="heatmap-cell"
              :class="{ clickable: cell.count > 0, 'hour-mark': cell.hour % 6 === 0 }"
              :style="{ backgroundColor: HEAT_COLORS[cell.level] }"
              :title="`周${dayLabels[cell.day]} ${String(cell.hour).padStart(2,'0')}:00 - ${cell.count}次`"
              @click="onHeatCellClick(cell)"
            />
          </div>
        </div>
      </div>

      <div v-if="stats.interestTrends.length > 0" class="section">
        <div class="section-title">
          <span class="i-lucide:trending-up section-icon" />
          兴趣趋势
        </div>
        <div class="trends-list">
          <div v-for="trend in stats.interestTrends" :key="trend.domain" class="trend-item">
            <img :src="trend.favicon" class="trend-favicon" loading="lazy"
              @error="($event.target as HTMLImageElement).style.display='none'" />
            <div class="trend-info" @click="viewTrendDomain(trend.domain)" style="cursor:pointer">
              <div class="trend-domain">{{ trend.domain }}</div>
              <div class="trend-detail">
                本周 {{ trend.currentCount }} 次 / 上周 {{ trend.previousCount }} 次
              </div>
            </div>
            <span class="trend-badge" :class="trend.direction">
              <span v-if="trend.direction === 'rising'" class="i-lucide:trending-up" />
              <span v-else-if="trend.direction === 'falling'" class="i-lucide:trending-down" />
              <span v-else class="i-lucide:minus" />
              {{ trend.direction === 'rising' ? '+' : '' }}{{ trend.change }}%
            </span>
            <button class="mini-action" title="查看历史" @click.stop="viewTrendDomain(trend.domain)">
              <span class="i-lucide:search" />
            </button>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">
          <span class="i-lucide:pie-chart section-icon" />
          网站分类
        </div>
        <div class="categories">
          <div v-for="cat in stats.categoryStats" :key="cat.name" class="cat-item">
            <div class="cat-header">
              <span class="cat-dot" :style="{ backgroundColor: cat.color }" />
              <span class="cat-name">{{ cat.name }}</span>
              <span class="cat-count">{{ cat.count }}</span>
              <span class="cat-pct">{{ cat.percentage }}%</span>
            </div>
            <div class="cat-bar-track">
              <div class="cat-bar" :style="{ width: cat.percentage + '%', backgroundColor: cat.color }" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-view {
  display: flex; flex-direction: column; height: 100%;
  background: var(--app-bg); color: var(--text-primary);
}

.stats-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; border-bottom: 1px solid var(--border-color);
  background: var(--app-surface); flex-shrink: 0;
}
.header-title { font-size: 14px; font-weight: 600; }

.time-filter { display: flex; gap: 3px; }
.time-btn {
  padding: 3px 8px; font-size: 11px; font-weight: 500;
  color: var(--text-muted); background: transparent;
  border: 1px solid transparent; border-radius: var(--radius-sm);
  cursor: pointer; transition: all var(--transition-fast);
}
.time-btn:hover { background: var(--primary-light); }
.time-btn.active {
  background: var(--primary-light); color: var(--primary-color);
  border-color: var(--primary-color);
}

.stats-content { flex: 1; overflow-y: auto; padding: 12px; }

.overview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
.innovation-grid { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.overview-card {
  padding: 12px; background: var(--app-surface);
  border: 1px solid var(--border-color); border-radius: var(--radius-lg);
  text-align: center;
}
.card-icon { font-size: 18px; }
.card-value { font-size: 22px; font-weight: 700; margin: 4px 0 2px; color: var(--text-primary); }
.card-label { font-size: 11px; color: var(--text-muted); }

.section { margin-bottom: 16px; }
.section-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 600; margin-bottom: 10px;
  color: var(--text-primary);
}
.section-icon { font-size: 14px; color: var(--primary-color); }

.action-chip {
  display: inline-flex; align-items: center; gap: 3px;
  margin-left: auto; padding: 2px 8px; font-size: 10px; font-weight: 500;
  color: var(--primary-color); background: var(--primary-light);
  border: 1px solid rgba(99,102,241,0.3); border-radius: 4px;
  cursor: pointer; transition: all var(--transition-fast);
}
.action-chip:hover { background: var(--primary-color); color: white; }
.action-chip.danger-chip { color: #ef4444; background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.3); }
.action-chip.danger-chip:hover { background: #ef4444; color: white; }

.mini-action {
  display: flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border: none; background: transparent;
  border-radius: var(--radius-sm); cursor: pointer; color: var(--text-muted);
  font-size: 12px; transition: all var(--transition-fast); flex-shrink: 0;
}
.mini-action:hover { background: var(--primary-light); color: var(--primary-color); }

.tag-x { font-size: 9px; margin-left: 2px; opacity: 0.6; }

.contextual-recs { display: flex; flex-direction: column; gap: 4px; }
.ctx-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; background: var(--app-surface);
  border: 1px solid var(--border-color); border-radius: var(--radius-md);
  cursor: pointer; transition: background var(--transition-fast);
}
.ctx-item:hover { background: var(--primary-light); }
.ctx-favicon { width: 18px; height: 18px; border-radius: 2px; object-fit: contain; flex-shrink: 0; }
.ctx-info { flex: 1; min-width: 0; }
.ctx-domain { font-size: 12px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ctx-reason { font-size: 10px; color: var(--text-muted); }
.ctx-score-bar {
  width: 48px; height: 4px; background: var(--border-color);
  border-radius: 2px; overflow: hidden; flex-shrink: 0;
}
.ctx-bar {
  height: 100%; border-radius: 2px;
  background: linear-gradient(90deg, #8b5cf6, #6366f1);
  transition: width 0.3s ease;
}

.recommendations { display: flex; flex-direction: column; gap: 4px; }
.rec-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; background: var(--app-surface);
  border: 1px solid var(--border-color); border-radius: var(--radius-md);
  cursor: pointer; transition: background var(--transition-fast);
}
.rec-item:hover { background: var(--primary-light); }
.rec-favicon { width: 18px; height: 18px; border-radius: 2px; object-fit: contain; flex-shrink: 0; }
.rec-info { flex: 1; min-width: 0; }
.rec-title { font-size: 12px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rec-meta { display: flex; align-items: center; gap: 6px; margin-top: 2px; flex-wrap: wrap; }
.rec-reason { font-size: 10px; color: var(--text-muted); }
.rec-tags { display: flex; gap: 3px; flex-wrap: wrap; }
.rec-tag {
  font-size: 9px; padding: 1px 5px; border-radius: 3px;
  border: 1px solid; font-weight: 500; white-space: nowrap;
}
.rec-score { font-size: 11px; font-weight: 600; color: var(--primary-color); flex-shrink: 0; }

.prod-card {
  display: flex; gap: 16px; align-items: center;
  padding: 14px; background: var(--app-surface);
  border: 1px solid var(--border-color); border-radius: var(--radius-lg);
}
.prod-gauge { position: relative; width: 80px; height: 80px; flex-shrink: 0; }
.gauge-svg { width: 100%; height: 100%; }
.gauge-ring { transition: stroke-dasharray 0.6s ease; }
.gauge-value {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  font-size: 20px; font-weight: 700;
}
.prod-details { flex: 1; min-width: 0; }
.prod-level {
  display: inline-block; font-size: 11px; font-weight: 600;
  padding: 2px 8px; border-radius: 4px; margin-bottom: 8px;
}
.prod-breakdown { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
.prod-row { display: flex; align-items: center; gap: 6px; }
.prod-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.prod-dot.productive { background: #10b981; }
.prod-dot.unproductive { background: #ef4444; }
.prod-dot.neutral { background: #64748b; }
.prod-label { font-size: 11px; color: var(--text-secondary); flex: 1; }
.prod-num { font-size: 11px; font-weight: 600; color: var(--text-primary); }
.prod-domains { margin-top: 4px; }
.prod-domain-label { font-size: 10px; color: var(--text-muted); margin-bottom: 3px; }
.prod-domain-tag {
  display: inline-block; font-size: 9px; padding: 1px 5px;
  border-radius: 3px; margin-right: 4px; margin-bottom: 2px;
  max-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.productive-tag { background: rgba(16,185,129,0.12); color: #10b981; }
.unproductive-tag { background: rgba(239,68,68,0.12); color: #ef4444; }

.rhythm-card {
  padding: 14px; background: var(--app-surface);
  border: 1px solid var(--border-color); border-radius: var(--radius-lg);
}
.rhythm-pattern {
  display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
}
.pattern-icon { font-size: 20px; }
.pattern-badge {
  font-size: 12px; font-weight: 600; padding: 3px 10px;
  border-radius: 6px;
}
.rhythm-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.rhythm-stat {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 8px; background: var(--app-bg);
  border-radius: var(--radius-md);
}
.rhythm-stat-icon { font-size: 12px; color: var(--primary-color); flex-shrink: 0; }
.rhythm-stat-label { font-size: 10px; color: var(--text-muted); flex: 1; }
.rhythm-stat-value { font-size: 11px; font-weight: 600; color: var(--text-primary); }

.carousel { display: flex; flex-direction: column; gap: 6px; }
.top-site {
  display: grid; grid-template-columns: auto 1fr auto;
  align-items: center; gap: 8px;
  padding: 8px 10px; background: var(--app-surface);
  border: 1px solid var(--border-color); border-radius: var(--radius-md);
}
.site-favicon { width: 20px; height: 20px; border-radius: 2px; object-fit: contain; }
.site-info { min-width: 0; overflow: hidden; }
.site-domain { font-size: 12px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.site-count { font-size: 10px; color: var(--text-muted); flex-shrink: 0; text-align: right; }
.site-bar-wrap {
  position: relative; width: 60px; height: 4px;
  background: var(--border-color); border-radius: 2px; overflow: hidden; flex-shrink: 0;
}
.site-bar { height: 100%; border-radius: 2px; transition: width 0.3s ease; }

.carousel-nav { display: flex; align-items: center; justify-content: center; gap: 8px; padding-top: 4px; }
.nav-btn {
  width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--border-color); border-radius: var(--radius-sm);
  background: var(--app-surface); cursor: pointer; color: var(--text-muted); font-size: 12px;
}
.nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.nav-info { font-size: 11px; color: var(--text-muted); }

.trend-chart { display: flex; align-items: flex-end; gap: 4px; height: 110px; padding: 8px 0; }
.trend-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.trend-bar-wrap { flex: 1; display: flex; align-items: flex-end; width: 100%; }
.trend-bar {
  width: 100%; border-radius: 3px 3px 0 0;
  background: var(--primary-color); min-height: 2px;
  transition: height 0.3s ease;
}
.trend-label { font-size: 10px; color: var(--text-muted); }
.trend-count { font-size: 10px; color: var(--text-secondary); font-weight: 500; }

.heatmap { padding: 4px 0; display: flex; gap: 4px; align-items: stretch; }
.heatmap-labels {
  display: flex; flex-direction: column; justify-content: space-between;
  padding: 0; flex-shrink: 0;
}
.heatmap-day-label { font-size: 8px; color: var(--text-muted); line-height: 10px; height: 10px; text-align: right; }
.heatmap-grid {
  display: grid; grid-template-rows: repeat(7, 10px);
  grid-auto-flow: column; grid-auto-columns: 10px; gap: 2px;
  flex: 1;
}
.heatmap-cell { border-radius: 2px; transition: background-color 0.2s ease; }
.heatmap-cell.clickable { cursor: pointer; }
.heatmap-cell.clickable:hover { outline: 2px solid var(--primary-color); outline-offset: -1px; z-index: 1; position: relative; }
.heatmap-cell.hour-mark { border-bottom: 2px solid var(--border-color); }
.heatmap-cell:hover { outline: 1px solid var(--primary-color); }

.trends-list { display: flex; flex-direction: column; gap: 4px; }
.trend-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; background: var(--app-surface);
  border: 1px solid var(--border-color); border-radius: var(--radius-md);
}
.trend-favicon { width: 18px; height: 18px; border-radius: 2px; object-fit: contain; flex-shrink: 0; }
.trend-info { flex: 1; min-width: 0; }
.trend-domain { font-size: 12px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.trend-detail { font-size: 10px; color: var(--text-muted); }
.trend-badge {
  display: flex; align-items: center; gap: 3px;
  font-size: 11px; font-weight: 600; padding: 2px 8px;
  border-radius: 4px; white-space: nowrap; flex-shrink: 0;
}
.trend-badge.rising { background: rgba(16,185,129,0.12); color: #10b981; }
.trend-badge.falling { background: rgba(239,68,68,0.12); color: #ef4444; }
.trend-badge.stable { background: rgba(100,116,139,0.12); color: #64748b; }

.categories { display: flex; flex-direction: column; gap: 8px; }
.cat-item {}
.cat-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.cat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.cat-name { font-size: 12px; font-weight: 500; color: var(--text-primary); flex: 1; }
.cat-count { font-size: 11px; color: var(--text-muted); }
.cat-pct { font-size: 11px; color: var(--text-secondary); font-weight: 500; width: 36px; text-align: right; }
.cat-bar-track { height: 4px; background: var(--border-color); border-radius: 2px; overflow: hidden; }
.cat-bar { height: 100%; border-radius: 2px; transition: width 0.3s ease; }
</style>
