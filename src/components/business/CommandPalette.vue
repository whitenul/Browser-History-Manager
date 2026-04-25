<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useHistoryStore } from '@/stores/history'
import { useStatsStore } from '@/stores/stats'
import { useThemeStore } from '@/stores/theme'
import { getFaviconUrl, safeOpenUrl, isValidDomain } from '@/utils/helpers'
import { useI18n } from '@/i18n'

const ui = useUIStore()
const history = useHistoryStore()
const stats = useStatsStore()
const theme = useThemeStore()
const { t } = useI18n()

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
    { id: 'nav-history', label: t('commandPalette.commands.switchToHistory'), icon: 'i-lucide:clock', category: t('commandPalette.categories.navigation'), shortcut: 'Alt+1', action: () => ui.switchTab('history') },
    { id: 'nav-stats', label: t('commandPalette.commands.switchToStats'), icon: 'i-lucide:bar-chart-3', category: t('commandPalette.categories.navigation'), shortcut: 'Alt+2', action: () => ui.switchTab('stats') },
    { id: 'nav-bookmarks', label: t('commandPalette.commands.switchToBookmarks'), icon: 'i-lucide:bookmark', category: t('commandPalette.categories.navigation'), shortcut: 'Alt+3', action: () => ui.switchTab('bookmarks') },
    { id: 'nav-settings', label: t('commandPalette.commands.switchToSettings'), icon: 'i-lucide:settings', category: t('commandPalette.categories.navigation'), shortcut: 'Alt+4', action: () => ui.switchTab('settings') },
  )

  cmds.push(
    { id: 'filter-today', label: t('commandPalette.commands.filterToday'), icon: 'i-lucide:calendar', category: t('commandPalette.categories.filter'), action: () => { history.setTimeRange('today'); ui.navigateTo('history', t('commandPalette.commands.filterToday')) } },
    { id: 'filter-3days', label: t('commandPalette.commands.filter3Days'), icon: 'i-lucide:calendar', category: t('commandPalette.categories.filter'), action: () => { history.setTimeRange('3days'); ui.navigateTo('history', t('commandPalette.commands.filter3Days')) } },
    { id: 'filter-week', label: t('commandPalette.commands.filter7Days'), icon: 'i-lucide:calendar', category: t('commandPalette.categories.filter'), action: () => { history.setTimeRange('week'); ui.navigateTo('history', t('commandPalette.commands.filter7Days')) } },
    { id: 'filter-month', label: t('commandPalette.commands.filter30Days'), icon: 'i-lucide:calendar', category: t('commandPalette.categories.filter'), action: () => { history.setTimeRange('month'); ui.navigateTo('history', t('commandPalette.commands.filter30Days')) } },
    { id: 'filter-all', label: t('commandPalette.commands.filterAll'), icon: 'i-lucide:calendar', category: t('commandPalette.categories.filter'), action: () => { history.setTimeRange('all'); ui.navigateTo('history', t('commandPalette.commands.filterAll')) } },
  )

  cmds.push(
    { id: 'group-none', label: t('commandPalette.commands.groupNone'), icon: 'i-lucide:list', category: t('commandPalette.categories.group'), action: () => { history.setGroupMode('none'); ui.navigateTo('history', t('commandPalette.commands.groupNone')) } },
    { id: 'group-domain', label: t('commandPalette.commands.groupDomain'), icon: 'i-lucide:globe', category: t('commandPalette.categories.group'), action: () => { history.setGroupMode('domain'); ui.navigateTo('history', t('commandPalette.commands.groupDomain')) } },
    { id: 'group-timeline', label: t('commandPalette.commands.groupTimeline'), icon: 'i-lucide:clock', category: t('commandPalette.categories.group'), action: () => { history.setGroupMode('timeline'); ui.navigateTo('history', t('commandPalette.commands.groupTimeline')) } },
    { id: 'group-session', label: t('commandPalette.commands.groupSession'), icon: 'i-lucide:layers', category: t('commandPalette.categories.group'), action: () => { history.setGroupMode('session'); ui.navigateTo('history', t('commandPalette.commands.groupSession')) } },
    { id: 'group-custom', label: t('commandPalette.commands.groupCustom'), icon: 'i-lucide:filter', category: t('commandPalette.categories.group'), action: () => { history.setGroupMode('custom'); ui.navigateTo('history', t('commandPalette.commands.groupCustom')) } },
  )

  cmds.push(
    { id: 'sort-newest', label: t('commandPalette.commands.sortNewest'), icon: 'i-lucide:arrow-down-narrow-wide', category: t('commandPalette.categories.sort'), action: () => { history.setSortMode('timeDesc'); ui.navigateTo('history', t('commandPalette.commands.sortNewest')) } },
    { id: 'sort-oldest', label: t('commandPalette.commands.sortOldest'), icon: 'i-lucide:arrow-up-narrow-wide', category: t('commandPalette.categories.sort'), action: () => { history.setSortMode('timeAsc'); ui.navigateTo('history', t('commandPalette.commands.sortOldest')) } },
    { id: 'sort-most', label: t('commandPalette.commands.sortMost'), icon: 'i-lucide:trending-up', category: t('commandPalette.categories.sort'), action: () => { history.setSortMode('visitDesc'); ui.navigateTo('history', t('commandPalette.commands.sortMost')) } },
    { id: 'sort-least', label: t('commandPalette.commands.sortLeast'), icon: 'i-lucide:trending-down', category: t('commandPalette.categories.sort'), action: () => { history.setSortMode('visitAsc'); ui.navigateTo('history', t('commandPalette.commands.sortLeast')) } },
  )

  cmds.push(
    { id: 'action-select', label: t('commandPalette.commands.selectMode'), icon: 'i-lucide:check-square', category: t('commandPalette.categories.actions'), action: () => { history.toggleSelectMode(); ui.navigateTo('history', t('commandPalette.commands.selectMode')) } },
    { id: 'action-export', label: t('commandPalette.commands.exportCsv'), icon: 'i-lucide:download', category: t('commandPalette.categories.actions'), action: () => history.doExport() },
    { id: 'action-theme', label: t('commandPalette.commands.themeSettings'), icon: 'i-lucide:palette', category: t('commandPalette.categories.actions'), action: () => theme.toggleThemeModal() },
    { id: 'action-blacklist', label: t('commandPalette.commands.manageBlacklist'), icon: 'i-lucide:ban', category: t('commandPalette.categories.actions'), action: () => ui.navigateTo('settings', t('commandPalette.commands.manageBlacklist')) },
  )

  if (stats.topSites.length > 0) {
    stats.topSites.slice(0, 5).forEach((site, i) => {
      cmds.push({
        id: `top-${i}`,
        label: t('commandPalette.commands.hotSite', { domain: site.domain, count: site.count }),
        icon: 'i-lucide:trophy',
        category: t('commandPalette.categories.hot'),
        action: () => { history.setDomainFilter(site.domain, site.domain); ui.navigateTo('history', site.domain) },
      })
    })
  }

  if (stats.productivity.topUnproductive.length > 0) {
    cmds.push({
      id: 'block-unproductive',
      label: t('commandPalette.commands.blockUnproductive', { count: stats.productivity.topUnproductive.length }),
      icon: 'i-lucide:shield-ban',
      category: t('commandPalette.categories.smartRecommend'),
      action: () => {
        stats.productivity.topUnproductive.forEach(d => history.addBlacklistDomain(d))
        ui.notify(t('commandPalette.blockedSites', { count: stats.productivity.topUnproductive.length }), 'success')
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
  const order = [
    t('commandPalette.categories.navigation'),
    t('commandPalette.categories.filter'),
    t('commandPalette.categories.group'),
    t('commandPalette.categories.sort'),
    t('commandPalette.categories.actions'),
    t('commandPalette.categories.smartRecommend'),
    t('commandPalette.categories.hot'),
  ]
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
              :placeholder="t('commandPalette.placeholder')"
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
              {{ t('commandPalette.noMatch') }}
            </div>
          </div>
          <div class="cmd-footer">
            <span><kbd>↑↓</kbd> {{ t('commandPalette.navigate') }}</span>
            <span><kbd>Enter</kbd> {{ t('commandPalette.execute') }}</span>
            <span><kbd>Esc</kbd> {{ t('commandPalette.close') }}</span>
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
