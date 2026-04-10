<script setup lang="ts">
import { computed } from 'vue'
import { useStatsStore } from '@/stores/stats'
import { useHistoryStore } from '@/stores/history'
import { autoTagDetailed, TAG_COLORS, TAG_ICONS } from '@/utils/helpers'

const stats = useStatsStore()
const history = useHistoryStore()

const dnaDimensions = computed(() => {
  const total = stats.overview.totalVisits || 1
  const prodRatio = stats.productivity.productiveCount / total
  const unprodRatio = stats.productivity.unproductiveCount / total
  const nightHours = [22, 23, 0, 1, 2, 3, 4, 5]
  const nightCount = stats.heatmap
    .filter(c => nightHours.includes(c.hour) && c.count > 0)
    .reduce((s, c) => s + c.count, 0)
  const nightRatio = Math.min(1, nightCount / total)
  const diversity = Math.min(1, stats.overview.siteCount / 50)
  const intensity = Math.min(1, stats.overview.dailyAvg / 100)
  const focusScore = 1 - (stats.rhythm.sessionCount > 0 ? Math.min(1, stats.rhythm.avgSessionLength / 20) : 0)

  const weekendDays = [0, 6]
  const weekendCount = stats.heatmap
    .filter(c => weekendDays.includes(c.day) && c.count > 0)
    .reduce((s, c) => s + c.count, 0)
  const weekendRatio = total > 0 ? Math.min(1, weekendCount / total) : 0

  const workHours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
  const workCount = stats.heatmap
    .filter(c => workHours.includes(c.hour) && c.count > 0)
    .reduce((s, c) => s + c.count, 0)
  const workRatio = total > 0 ? Math.min(1, workCount / total) : 0

  const topSites = stats.topSites
  const topSiteRatio = topSites.length > 0 ? Math.min(1, (topSites[0]?.count || 0) / total) : 0

  const morningHours = [6, 7, 8, 9, 10, 11]
  const morningCount = stats.heatmap
    .filter(c => morningHours.includes(c.hour) && c.count > 0)
    .reduce((s, c) => s + c.count, 0)
  const morningRatio = total > 0 ? Math.min(1, morningCount / total) : 0

  const uniqueDomains = new Set(history.allRecords.map(r => r.domain)).size
  const explorRatio = Math.min(1, uniqueDomains / 100)

  return [
    { label: '生产力', value: prodRatio, color: '#10b981' },
    { label: '娱乐性', value: unprodRatio, color: '#ef4444' },
    { label: '夜行性', value: nightRatio, color: '#8b5cf6' },
    { label: '广度', value: diversity, color: '#3b82f6' },
    { label: '强度', value: intensity, color: '#f59e0b' },
    { label: '专注度', value: focusScore, color: '#ec4899' },
    { label: '工作性', value: workRatio, color: '#06b6d4' },
    { label: '忠诚度', value: topSiteRatio, color: '#f97316' },
    { label: '晨间性', value: morningRatio, color: '#fbbf24' },
    { label: '探索性', value: explorRatio, color: '#a78bfa' },
  ]
})

const personalityType = computed(() => {
  const dims = dnaDimensions.value
  const sorted = [...dims].sort((a, b) => b.value - a.value)
  const top = sorted[0]
  const second = sorted[1]

  const comboKey = `${top.label}-${second.label}`
  const comboTypes: Record<string, string> = {
    '生产力-工作性': '职场精英',
    '生产力-专注度': '深度工作者',
    '生产力-广度': '全能学者',
    '生产力-晨间性': '晨间效率王',
    '生产力-探索性': '探索型创客',
    '娱乐性-夜行性': '夜生活玩家',
    '娱乐性-忠诚度': '追剧达人',
    '娱乐性-强度': '冲浪狂人',
    '娱乐性-晨间性': '早起娱乐家',
    '夜行性-生产力': '深夜创客',
    '夜行性-娱乐性': '午夜游侠',
    '夜行性-广度': '暗夜探索者',
    '夜行性-强度': '夜猫战士',
    '广度-强度': '信息猎人',
    '广度-生产力': '博学多才',
    '广度-娱乐性': '万花筒',
    '广度-探索性': '全域探险家',
    '强度-忠诚度': '死忠粉丝',
    '强度-专注度': '沉浸玩家',
    '强度-工作性': '工作狂',
    '强度-探索性': '深度探险家',
    '专注度-生产力': '极客匠人',
    '专注度-忠诚度': '专一用户',
    '专注度-探索性': '专注探索者',
    '工作性-生产力': '效率机器',
    '工作性-专注度': '专注专家',
    '工作性-晨间性': '朝九晚五达人',
    '忠诚度-强度': '铁杆用户',
    '忠诚度-娱乐性': '忠实观众',
    '忠诚度-探索性': '忠实探险家',
    '晨间性-生产力': '晨型效率者',
    '晨间性-工作性': '早鸟工作者',
    '晨间性-专注度': '晨间冥想者',
    '探索性-广度': '数字游牧民',
    '探索性-强度': '极限探索者',
    '探索性-生产力': '创新型学者',
  }

  if (comboTypes[comboKey]) return comboTypes[comboKey]

  const singleTypes: Record<string, string> = {
    '生产力': '效率先锋',
    '娱乐性': '娱乐达人',
    '夜行性': '夜猫行者',
    '广度': '探索旅者',
    '强度': '深度潜者',
    '专注度': '聚焦猎手',
    '工作性': '职场战士',
    '忠诚度': '忠实用户',
    '晨间性': '晨光行者',
    '探索性': '数字探险家',
  }
  return singleTypes[top.label] || '数字游民'
})

const personalityDesc = computed(() => {
  const descs: Record<string, string> = {
    '职场精英': '你的浏览高度工作导向，白天效率拉满，是真正的职场高手',
    '深度工作者': '你擅长长时间深度专注，在生产力领域持续输出',
    '全能学者': '你既高效又广泛涉猎，是真正的终身学习者',
    '晨间效率王': '你善于利用清晨时光高效工作，是真正的晨型人',
    '探索型创客': '你在高效产出的同时保持好奇心，不断探索新领域',
    '夜生活玩家': '夜晚是你的娱乐主场，在放松中找到灵感',
    '追剧达人': '你有固定的娱乐偏好，对喜欢的内容忠诚不二',
    '冲浪狂人': '你的浏览强度极高，是真正的互联网重度用户',
    '早起娱乐家': '你享受清晨的娱乐时光，以轻松开启新的一天',
    '深夜创客': '深夜是你最高效的创造时段，灵感在寂静中迸发',
    '午夜游侠': '你享受深夜的互联网世界，在娱乐中找到自我',
    '暗夜探索者': '深夜也无法阻止你的好奇心，你是真正的夜行探索者',
    '夜猫战士': '深夜高强度的浏览者，互联网是你的第二世界',
    '信息猎人': '你高强度地广泛涉猎，是信息时代的超级猎手',
    '博学多才': '你既高效又广博，是真正的跨界人才',
    '万花筒': '你广泛涉猎各种娱乐内容，生活丰富多彩',
    '全域探险家': '你的好奇心无限，足迹遍布互联网每个角落',
    '死忠粉丝': '你对特定网站有着极高的忠诚度，是真正的铁杆用户',
    '沉浸玩家': '你倾向于长时间沉浸式浏览，享受深度体验',
    '工作狂': '你的浏览以工作为核心，强度和专注度都极高',
    '深度探险家': '你深入探索每个领域，不达目的不罢休',
    '极客匠人': '你专注且高效，是追求极致的工匠型用户',
    '专一用户': '你有明确的浏览目标，不轻易被干扰',
    '专注探索者': '你在专注中探索，在探索中保持深度',
    '效率机器': '你的浏览模式高度规律且高效，堪称效率典范',
    '专注专家': '你在工作中保持高度专注，是专业领域的深耕者',
    '朝九晚五达人': '你的浏览节奏规律稳定，是标准的工作日模式',
    '铁杆用户': '你对常用网站极度忠诚，是互联网的忠实居民',
    '忠实观众': '你有固定的内容消费习惯，是优质内容的忠实受众',
    '忠实探险家': '你在忠诚与探索间保持平衡，既有偏好又拥抱新事物',
    '晨型效率者': '清晨是你最高效的时段，你善于把握一天之始',
    '早鸟工作者': '你习惯早起工作，在清晨的宁静中创造价值',
    '晨间冥想者': '你享受清晨的专注时光，在宁静中深度思考',
    '数字游牧民': '你自由穿梭于互联网各处，不受边界限制',
    '极限探索者': '你以极高的强度探索新领域，是互联网的拓荒者',
    '创新型学者': '你在探索中创造，在创造中不断突破',
    '效率先锋': '你的浏览习惯高度目标导向，大部分时间用于工作和学习',
    '娱乐达人': '你善于享受互联网的乐趣，在工作与娱乐间找到平衡',
    '夜猫行者': '深夜是你的主场，灵感在寂静中迸发',
    '探索旅者': '你涉猎广泛，对各种领域都保持好奇心',
    '深度潜者': '你浏览频率极高，是真正的互联网原住民',
    '聚焦猎手': '你倾向于长时间专注浏览，而非碎片化跳跃',
    '职场战士': '你的浏览以工作为中心，白天是最高效的时段',
    '忠实用户': '你有明确的浏览偏好，对常用网站保持忠诚',
    '晨光行者': '清晨的阳光是你最好的伙伴，你在晨光中启程',
    '数字探险家': '你不断发现互联网的新大陆，是真正的数字探险家',
  }
  return descs[personalityType.value] || '你拥有独特的浏览风格'
})

const tagCloud = computed(() => {
  const tagMap = new Map<string, number>()
  history.allRecords.forEach(r => {
    const tags = autoTagDetailed(r.url, r.title)
    tags.forEach(t => {
      tagMap.set(t.tag, (tagMap.get(t.tag) || 0) + 1)
    })
  })
  return Array.from(tagMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tag, count]) => ({
      tag,
      count,
      color: TAG_COLORS[tag] || '#94a3b8',
      icon: TAG_ICONS[tag] || 'i-lucide:tag',
      size: Math.max(10, Math.min(18, 10 + (count / (history.allRecords.length || 1)) * 40)),
    }))
})

const cx = 100
const cy = 100
const maxR = 80

function polarPoint(index: number, value: number): string {
  const angle = (Math.PI * 2 * index) / dnaDimensions.value.length - Math.PI / 2
  const r = maxR * Math.max(0.08, value)
  const x = cx + r * Math.cos(angle)
  const y = cy + r * Math.sin(angle)
  return `${x},${y}`
}

const radarPath = computed(() => {
  const points = dnaDimensions.value.map((d, i) => polarPoint(i, d.value))
  return `M${points.join('L')}Z`
})

const radarDots = computed(() => {
  return dnaDimensions.value.map((d, i) => ({
    ...d,
    x: polarPoint(i, d.value).split(',')[0],
    y: polarPoint(i, d.value).split(',')[1],
  }))
})

const gridRings = [0.25, 0.5, 0.75, 1.0]

function ringPath(ratio: number): string {
  const r = maxR * ratio
  return `M${cx},${cy - r} A${r},${r} 0 1,1 ${cx},${cy + r} A${r},${r} 0 1,1 ${cx},${cy - r}`
}

const axisLines = computed(() => {
  return dnaDimensions.value.map((_, i) => {
    const angle = (Math.PI * 2 * i) / dnaDimensions.value.length - Math.PI / 2
    return {
      x2: cx + maxR * Math.cos(angle),
      y2: cy + maxR * Math.sin(angle),
    }
  })
})

const orbitParticles = computed(() => {
  const particles: { cx: number; cy: number; r: number; color: string; opacity: number }[] = []
  const domainMap = new Map<string, number>()
  history.allRecords.forEach(r => domainMap.set(r.domain, (domainMap.get(r.domain) || 0) + 1))
  const topDomains = Array.from(domainMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 16)
  topDomains.forEach(([, count], i) => {
    const angle = (Math.PI * 2 * i) / 16 + 0.3
    const dist = 30 + (count / (topDomains[0]?.[1] || 1)) * 55
    particles.push({
      cx: cx + dist * Math.cos(angle),
      cy: cy + dist * Math.sin(angle),
      r: 1.5 + (count / (topDomains[0]?.[1] || 1)) * 4,
      color: `hsl(${(i * 22.5) % 360}, 70%, 60%)`,
      opacity: 0.35 + (count / (topDomains[0]?.[1] || 1)) * 0.55,
    })
  })
  return particles
})
</script>

<template>
  <div class="dna-card">
    <div class="dna-header">
      <span class="i-lucide:fingerprint dna-header-icon" />
      <span class="dna-title">浏览DNA</span>
      <span class="dna-badge">{{ personalityType }}</span>
    </div>
    <div class="dna-desc">{{ personalityDesc }}</div>
    <div class="dna-body">
      <div class="dna-chart">
        <svg viewBox="0 0 200 200" class="dna-svg">
          <path v-for="ring in gridRings" :key="ring" :d="ringPath(ring)"
            fill="none" stroke="var(--border-color)" stroke-width="0.5" opacity="0.4" />
          <line v-for="(axis, i) in axisLines" :key="i"
            :x1="cx" :y1="cy" :x2="axis.x2" :y2="axis.y2"
            stroke="var(--border-color)" stroke-width="0.5" opacity="0.3" />
          <circle v-for="p in orbitParticles" :key="`${p.cx}-${p.cy}`"
            :cx="p.cx" :cy="p.cy" :r="p.r"
            :fill="p.color" :opacity="p.opacity" />
          <path :d="radarPath" fill="rgba(99,102,241,0.12)" stroke="#6366f1" stroke-width="1.5" />
          <circle v-for="dot in radarDots" :key="dot.label"
            :cx="dot.x" :cy="dot.y" r="2.5" :fill="dot.color" />
          <text v-for="(dim, i) in dnaDimensions" :key="dim.label"
            :x="polarPoint(i, dim.value + 0.2).split(',')[0]"
            :y="Number(polarPoint(i, dim.value + 0.2).split(',')[1]) + 3"
            text-anchor="middle" fill="var(--text-muted)" font-size="5.5">
            {{ dim.label }}
          </text>
        </svg>
      </div>
      <div class="dna-info">
        <div class="dna-bars">
          <div v-for="dim in dnaDimensions" :key="dim.label" class="dna-bar-row">
            <span class="dna-bar-label" :style="{ color: dim.color }">{{ dim.label }}</span>
            <div class="dna-bar-track">
              <div class="dna-bar-fill" :style="{ width: Math.round(dim.value * 100) + '%', backgroundColor: dim.color }" />
            </div>
            <span class="dna-bar-value">{{ Math.round(dim.value * 100) }}</span>
          </div>
        </div>
      </div>
    </div>
    <div v-if="tagCloud.length > 0" class="dna-tags">
      <div class="dna-tags-title">
        <span class="i-lucide:tags dna-tags-icon" />
        标签云
      </div>
      <div class="tag-cloud">
        <span v-for="item in tagCloud" :key="item.tag" class="tag-cloud-item" :style="{ fontSize: item.size + 'px', color: item.color }">
          <span :class="item.icon" class="tag-cloud-icon" />{{ item.tag }}
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
  display: flex; align-items: center; gap: 6px; margin-bottom: 6px;
}
.dna-header-icon { font-size: 16px; color: #8b5cf6; }
.dna-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.dna-badge {
  margin-left: auto; font-size: 11px; font-weight: 600;
  padding: 2px 8px; border-radius: 4px;
  background: rgba(139,92,246,0.12); color: #8b5cf6;
}
.dna-desc {
  font-size: 11px; color: var(--text-muted); margin-bottom: 10px; line-height: 1.4;
}
.dna-body { display: flex; gap: 14px; align-items: center; }
.dna-chart { width: 140px; height: 140px; flex-shrink: 0; }
.dna-svg { width: 100%; height: 100%; }
.dna-info { flex: 1; min-width: 0; }
.dna-bars { display: flex; flex-direction: column; gap: 3px; }
.dna-bar-row { display: flex; align-items: center; gap: 6px; }
.dna-bar-label { font-size: 9px; font-weight: 600; width: 36px; flex-shrink: 0; }
.dna-bar-track {
  flex: 1; height: 4px; background: var(--border-color);
  border-radius: 2px; overflow: hidden;
}
.dna-bar-fill { height: 100%; border-radius: 2px; transition: width 0.4s ease; }
.dna-bar-value { font-size: 9px; font-weight: 600; color: var(--text-secondary); width: 22px; text-align: right; flex-shrink: 0; }
.dna-tags {
  margin-top: 10px; padding-top: 10px;
  border-top: 1px solid var(--border-color);
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
