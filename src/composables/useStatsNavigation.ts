import { useHistoryStore } from '@/stores/history'
import { useUIStore } from '@/stores/ui'
import type { FilterSnapshot } from '@/stores/ui'

export const HEAT_COLORS = [
  'var(--heat-0)',
  'var(--heat-1)',
  'var(--heat-2)',
  'var(--heat-3)',
  'var(--heat-4)',
] as const

export function useStatsNavigation() {
  const history = useHistoryStore()
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
    navigateWithDomainFilter,
  }
}
