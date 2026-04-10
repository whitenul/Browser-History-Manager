<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useHistoryStore } from '@/stores/history'
import { useStatsStore } from '@/stores/stats'
import { useThemeStore } from '@/stores/theme'
import { getFaviconUrl } from '@/utils/helpers'

const ui = useUIStore()
const history = useHistoryStore()
const stats = useStatsStore()
const theme = useThemeStore()

const query = ref('')
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

interface Command {
  id: string
  label: string
  icon: string
  category: string
  shortcut?: string
  action: () => void
}

const allCommands = computed<Command[]>(() => {
  const cmds: Command[] = []

  cmds.push(
    { id: 'nav-history', label: '切换到历史记录', icon: 'i-lucide:clock', category: '导航', shortcut: 'Alt+1', action: () => ui.switchTab('history') },
    { id: 'nav-stats', label: '切换到数据统计', icon: 'i-lucide:bar-chart-3', category: '导航', shortcut: 'Alt+2', action: () => ui.switchTab('stats') },
    { id: 'nav-bookmarks', label: '切换到书签管理', icon: 'i-lucide:bookmark', category: '导航', shortcut: 'Alt+3', action: () => ui.switchTab('bookmarks') },
    { id: 'nav-settings', label: '切换到设置', icon: 'i-lucide:settings', category: '导航', shortcut: 'Alt+4', action: () => ui.switchTab('settings') },
  )

  cmds.push(
    { id: 'filter-today', label: '筛选：今日', icon: 'i-lucide:calendar', category: '筛选', action: () => { history.setTimeRange('today'); ui.navigateTo('history', '筛选: 今日') } },
    { id: 'filter-3days', label: '筛选：近3天', icon: 'i-lucide:calendar', category: '筛选', action: () => { history.setTimeRange('3days'); ui.navigateTo('history', '筛选: 近3天') } },
    { id: 'filter-week', label: '筛选：近7天', icon: 'i-lucide:calendar', category: '筛选', action: () => { history.setTimeRange('week'); ui.navigateTo('history', '筛选: 近7天') } },
    { id: 'filter-month', label: '筛选：近30天', icon: 'i-lucide:calendar', category: '筛选', action: () => { history.setTimeRange('month'); ui.navigateTo('history', '筛选: 近30天') } },
    { id: 'filter-all', label: '筛选：全部', icon: 'i-lucide:calendar', category: '筛选', action: () => { history.setTimeRange('all'); ui.navigateTo('history', '筛选: 全部') } },
  )

  cmds.push(
    { id: 'group-none', label: '分组：不分组', icon: 'i-lucide:list', category: '分组', action: () => { history.setGroupMode('none'); ui.navigateTo('history', '分组: 不分组') } },
    { id: 'group-domain', label: '分组：按域名', icon: 'i-lucide:globe', category: '分组', action: () => { history.setGroupMode('domain'); ui.navigateTo('history', '分组: 按域名') } },
    { id: 'group-timeline', label: '分组：按时间', icon: 'i-lucide:clock', category: '分组', action: () => { history.setGroupMode('timeline'); ui.navigateTo('history', '分组: 按时间') } },
    { id: 'group-session', label: '分组：按会话', icon: 'i-lucide:layers', category: '分组', action: () => { history.setGroupMode('session'); ui.navigateTo('history', '分组: 按会话') } },
    { id: 'group-custom', label: '分组：自定义规则', icon: 'i-lucide:filter', category: '分组', action: () => { history.setGroupMode('custom'); ui.navigateTo('history', '分组: 自定义') } },
  )

  cmds.push(
    { id: 'sort-newest', label: '排序：最新优先', icon: 'i-lucide:arrow-down-narrow-wide', category: '排序', action: () => { history.setSortMode('timeDesc'); ui.navigateTo('history', '排序: 最新') } },
    { id: 'sort-oldest', label: '排序：最旧优先', icon: 'i-lucide:arrow-up-narrow-wide', category: '排序', action: () => { history.setSortMode('timeAsc'); ui.navigateTo('history', '排序: 最旧') } },
    { id: 'sort-most', label: '排序：最常访问', icon: 'i-lucide:trending-up', category: '排序', action: () => { history.setSortMode('visitDesc'); ui.navigateTo('history', '排序: 最常') } },
    { id: 'sort-least', label: '排序：最少访问', icon: 'i-lucide:trending-down', category: '排序', action: () => { history.setSortMode('visitAsc'); ui.navigateTo('history', '排序: 最少') } },
  )

  cmds.push(
    { id: 'action-select', label: '进入多选模式', icon: 'i-lucide:check-square', category: '操作', action: () => { history.toggleSelectMode(); ui.navigateTo('history', '多选模式') } },
    { id: 'action-export', label: '导出 CSV', icon: 'i-lucide:download', category: '操作', action: () => history.doExport() },
    { id: 'action-theme', label: '主题设置', icon: 'i-lucide:palette', category: '操作', action: () => theme.toggleThemeModal() },
    { id: 'action-blacklist', label: '管理域名黑名单', icon: 'i-lucide:ban', category: '操作', action: () => ui.navigateTo('settings', '黑名单管理') },
  )

  if (stats.contextualRecs.length > 0) {
    stats.contextualRecs.forEach((rec, i) => {
      cmds.push({
        id: `ctx-${i}`,
        label: `此时段推荐：${rec.domain}`,
        icon: 'i-lucide:compass',
        category: '智能推荐',
        action: () => chrome.tabs.create({ url: 'https://' + rec.domain }),
      })
    })
  }

  if (stats.topSites.length > 0) {
    stats.topSites.slice(0, 5).forEach((site, i) => {
      cmds.push({
        id: `top-${i}`,
        label: `热门网站：${site.domain} (${site.count}次)`,
        icon: 'i-lucide:trophy',
        category: '热门',
        action: () => { history.setDomainFilter(site.domain, `域名: ${site.domain}`); ui.navigateTo('history', '搜索: ' + site.domain) },
      })
    })
  }

  if (stats.productivity.topUnproductive.length > 0) {
    cmds.push({
      id: 'block-unproductive',
      label: `一键屏蔽低效网站 (${stats.productivity.topUnproductive.length}个)`,
      icon: 'i-lucide:shield-ban',
      category: '智能推荐',
      action: () => {
        stats.productivity.topUnproductive.forEach(d => history.addBlacklistDomain(d))
        ui.notify(`已屏蔽 ${stats.productivity.topUnproductive.length} 个低效网站`, 'success')
      },
    })
  }

  return cmds
})

const filteredCommands = computed(() => {
  if (!query.value.trim()) return allCommands.value
  const q = query.value.toLowerCase().trim()
  return allCommands.value.filter(cmd => {
    if (cmd.label.toLowerCase().includes(q)) return true
    if (cmd.category.toLowerCase().includes(q)) return true
    return false
  })
})

const groupedCommands = computed(() => {
  const groups: Record<string, Command[]> = {}
  const order = ['导航', '筛选', '分组', '排序', '操作', '智能推荐', '热门']
  for (const cmd of filteredCommands.value) {
    if (!groups[cmd.category]) groups[cmd.category] = []
    groups[cmd.category].push(cmd)
  }
  const result: { category: string; commands: Command[] }[] = []
  for (const cat of order) {
    if (groups[cat]) result.push({ category: cat, commands: groups[cat] })
  }
  for (const [cat, cmds] of Object.entries(groups)) {
    if (!order.includes(cat)) result.push({ category: cat, commands: cmds })
  }
  return result
})

watch(() => ui.showCommandPalette, (show) => {
  if (show) {
    query.value = ''
    selectedIndex.value = 0
    nextTick(() => inputRef.value?.focus())
  }
})

watch(filteredCommands, () => { selectedIndex.value = 0 })

function executeCommand(cmd: Command) {
  cmd.action()
  ui.showCommandPalette = false
}

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    ui.showCommandPalette = !ui.showCommandPalette
    return
  }
  if (!ui.showCommandPalette) return

  if (e.key === 'Escape') {
    e.preventDefault()
    ui.showCommandPalette = false
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, filteredCommands.value.length - 1)
    scrollToSelected()
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
    scrollToSelected()
    return
  }
  if (e.key === 'Enter' && filteredCommands.value[selectedIndex.value]) {
    e.preventDefault()
    executeCommand(filteredCommands.value[selectedIndex.value])
    return
  }
}

function scrollToSelected() {
  nextTick(() => {
    const el = document.querySelector('.cmd-item.selected') as HTMLElement
    el?.scrollIntoView({ block: 'nearest' })
  })
}

function flatIndex(cmd: Command): number {
  return filteredCommands.value.findIndex(c => c.id === cmd.id)
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="cmd-fade">
      <div v-if="ui.showCommandPalette" class="cmd-overlay" @click="ui.showCommandPalette = false">
        <div class="cmd-palette" @click.stop>
          <div class="cmd-input-wrap">
            <span class="i-lucide:search cmd-input-icon" />
            <input
              ref="inputRef"
              v-model="query"
              class="cmd-input"
              placeholder="输入命令、搜索网站、筛选条件..."
            />
            <kbd class="cmd-esc">ESC</kbd>
          </div>
          <div class="cmd-list">
            <template v-for="group in groupedCommands" :key="group.category">
              <div class="cmd-group-label">{{ group.category }}</div>
              <button
                v-for="cmd in group.commands"
                :key="cmd.id"
                class="cmd-item"
                :class="{ selected: flatIndex(cmd) === selectedIndex }"
                @click="executeCommand(cmd)"
                @mouseenter="selectedIndex = flatIndex(cmd)"
              >
                <span :class="cmd.icon" class="cmd-item-icon" />
                <span class="cmd-item-label">{{ cmd.label }}</span>
                <kbd v-if="cmd.shortcut" class="cmd-shortcut">{{ cmd.shortcut }}</kbd>
              </button>
            </template>
            <div v-if="!filteredCommands.length" class="cmd-empty">
              未找到匹配命令
            </div>
          </div>
          <div class="cmd-footer">
            <span><kbd>↑↓</kbd> 导航</span>
            <span><kbd>Enter</kbd> 执行</span>
            <span><kbd>Esc</kbd> 关闭</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cmd-overlay {
  position: fixed; inset: 0; z-index: 500;
  background: rgba(0,0,0,0.45); backdrop-filter: blur(4px);
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 60px;
}
.cmd-palette {
  width: 380px; max-height: 420px;
  background: var(--app-surface); border: 1px solid var(--border-color);
  border-radius: var(--radius-xl); box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  display: flex; flex-direction: column; overflow: hidden;
}
.cmd-input-wrap {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 14px; border-bottom: 1px solid var(--border-color);
}
.cmd-input-icon { font-size: 16px; color: var(--text-muted); flex-shrink: 0; }
.cmd-input {
  flex: 1; border: none; outline: none; background: transparent;
  font-size: 14px; color: var(--text-primary);
}
.cmd-input::placeholder { color: var(--text-muted); }
.cmd-esc {
  font-size: 10px; padding: 2px 6px; border-radius: 4px;
  background: var(--app-bg); color: var(--text-muted);
  border: 1px solid var(--border-color); font-family: inherit;
}
.cmd-list {
  flex: 1; overflow-y: auto; padding: 6px 4px;
  max-height: 300px;
}
.cmd-group-label {
  font-size: 10px; font-weight: 600; color: var(--text-muted);
  padding: 6px 12px 2px; text-transform: uppercase; letter-spacing: 0.05em;
}
.cmd-item {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 8px 12px; border: none;
  background: transparent; color: var(--text-primary);
  font-size: 13px; cursor: pointer; border-radius: var(--radius-md);
  transition: background var(--transition-fast); text-align: left;
}
.cmd-item:hover { background: var(--primary-light); }
.cmd-item.selected { background: var(--primary-light); }
.cmd-item-icon { font-size: 14px; color: var(--primary-color); flex-shrink: 0; width: 16px; text-align: center; }
.cmd-item-label { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cmd-shortcut {
  font-size: 10px; padding: 2px 6px; border-radius: 4px;
  background: var(--app-bg); color: var(--text-muted);
  border: 1px solid var(--border-color); font-family: inherit; flex-shrink: 0;
}
.cmd-empty {
  padding: 24px; text-align: center; font-size: 13px; color: var(--text-muted);
}
.cmd-footer {
  display: flex; gap: 16px; justify-content: center;
  padding: 8px 14px; border-top: 1px solid var(--border-color);
  font-size: 11px; color: var(--text-muted);
}
.cmd-footer kbd {
  font-size: 10px; padding: 1px 5px; border-radius: 3px;
  background: var(--app-bg); border: 1px solid var(--border-color);
  font-family: inherit; margin-right: 2px;
}
.cmd-fade-enter-active { transition: all 150ms ease; }
.cmd-fade-leave-active { transition: all 100ms ease; }
.cmd-fade-enter-from { opacity: 0; }
.cmd-fade-leave-to { opacity: 0; }
.cmd-fade-enter-from .cmd-palette { transform: translateY(-8px) scale(0.98); }
</style>
