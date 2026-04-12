import { useHistoryStore } from '@/stores/history'
import { useStatsStore } from '@/stores/stats'
import { useUIStore } from '@/stores/ui'
import type { FilterSnapshot } from '@/stores/ui'

export const HEAT_COLORS = [
  'var(--app-surface)',
  'rgba(99,102,241,0.2)',
  'rgba(99,102,241,0.4)',
  'rgba(99,102,241,0.65)',
  'rgba(99,102,241,0.9)',
] as const

export function useStatsNavigation() {
  const history = useHistoryStore()
  const stats = useStatsStore()
  const ui = useUIStore()

  function isCurrentHeatCell(cell: { day: number; hour: number }) {
    return cell.day === new Date().getDay() && cell.hour === new Date().getHours()
  }

  function navigateWithTimeFilter(day: number, hourStart: number, hourEnd: number, label: string) {
    history.setTimeFilter(day, hourStart, hourEnd, label)
    ui.navigateTo('history', label, {
      source: 'heatmap',
      filterSnapshot: { type: 'time', payload: { day, hourStart, hourEnd, label } },
    })
  }

  function navigateWithTagFilter(tag: string, label: string) {
    history.setTagFilter(tag, label)
    ui.navigateTo('history', label, {
      source: 'tagChart',
      filterSnapshot: { type: 'tag', payload: { tag, label } },
    })
  }

  function navigateWithDomainFilter(domain: string, label: string) {
    history.setDomainFilter(domain, label)
    ui.navigateTo('history', label, {
      source: 'topSite',
      filterSnapshot: { type: 'domain', payload: { domain, label } },
    })
  }

  return {
    HEAT_COLORS,
    isCurrentHeatCell,
    navigateWithTimeFilter,
    navigateWithTagFilter,
    navigateWithDomainFilter,
  }
}
