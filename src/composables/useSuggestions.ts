import { ref, computed } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useI18n } from '@/i18n'

export interface SuggestionItem {
  type: 'history' | 'bookmark' | 'search'
  title: string
  url: string
  domain?: string
  visitCount?: number
  lastVisitTime?: number
}

export function useSuggestions() {
  const history = useHistoryStore()
  const bookmarks = useBookmarksStore()
  const { t } = useI18n()

  const showSuggestions = ref(false)
  const selectedIndex = ref(-1)

  function getSuggestions(keyword: string): SuggestionItem[] {
    const q = keyword.trim().toLowerCase()
    if (!q || q.startsWith('http://') || q.startsWith('https://')) return []

    const results: SuggestionItem[] = []
    const seen = new Set<string>()

    // History matches
    for (const record of history.allRecords) {
      if (results.length >= 5) break
      const titleMatch = record.title?.toLowerCase().includes(q)
      const urlMatch = record.url.toLowerCase().includes(q)
      const domainMatch = record.domain?.toLowerCase().includes(q)
      if ((titleMatch || urlMatch || domainMatch) && !seen.has(record.url)) {
        seen.add(record.url)
        results.push({
          type: 'history',
          title: record.title || record.domain || record.url,
          url: record.url,
          domain: record.domain,
          visitCount: record.visitCount,
          lastVisitTime: record.lastVisitTime,
        })
      }
    }

    // Bookmark matches
    for (const b of bookmarks.allBookmarks) {
      if (results.length >= 8) break
      const bUrl = b.url || ''
      const titleMatch = b.title?.toLowerCase().includes(q)
      const urlMatch = bUrl.toLowerCase().includes(q)
      const domainMatch = (b.domain || '').toLowerCase().includes(q)
      if ((titleMatch || urlMatch || domainMatch) && !seen.has(bUrl)) {
        seen.add(bUrl)
        results.push({
          type: 'bookmark',
          title: b.title || b.domain || bUrl,
          url: bUrl,
          domain: b.domain,
        })
      }
    }

    // Search fallback
    if (results.length < 3) {
      results.push({
        type: 'search',
        title: `${t('common.search')}: "${keyword}"`,
        url: `https://www.google.com/search?q=${encodeURIComponent(keyword)}`,
      })
    }

    return results
  }

  function handleKeydown(e: KeyboardEvent, items: SuggestionItem[], onEnter: (item: SuggestionItem | null) => void) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      selectedIndex.value = (selectedIndex.value + 1) % items.length
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      selectedIndex.value = selectedIndex.value <= 0 ? items.length - 1 : selectedIndex.value - 1
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex.value >= 0 && items[selectedIndex.value]) {
        onEnter(items[selectedIndex.value])
      } else {
        onEnter(null)
      }
      showSuggestions.value = false
      selectedIndex.value = -1
    } else if (e.key === 'Escape') {
      showSuggestions.value = false
      selectedIndex.value = -1
    }
  }

  function selectItem(item: SuggestionItem) {
    showSuggestions.value = false
    selectedIndex.value = -1
    return item
  }

  function hideSuggestions() {
    setTimeout(() => { showSuggestions.value = false }, 200)
  }

  return {
    showSuggestions,
    selectedIndex,
    getSuggestions,
    handleKeydown,
    selectItem,
    hideSuggestions,
  }
}
