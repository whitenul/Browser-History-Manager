import { defineStore } from 'pinia'
import { ref, computed, shallowRef } from 'vue'
import type { HistoryRecord } from '@/utils/helpers'
import { perfMark, perfMeasure } from '@/utils/perf'
import {
  getDomain, stringToColor, autoTag, getTimeRange, groupByDomain,
  groupByTimeline, groupByCustomRules, groupBySession,
  createCustomRule, matchRule, getGroupLabel, formatTime,
  formatDateTime, getFaviconUrl, highlightText, exportToCSV,
  debounce, safeOpenUrl, isValidDomain, urlStorageKey, type GroupResult,
} from '@/utils/helpers'
import { appCache } from '@/utils/cache'

export const useHistoryStore = defineStore('history', () => {
  const allRecords = shallowRef<HistoryRecord[]>([])
  const displayedRecords = shallowRef<HistoryRecord[]>([])
  const searchKeyword = ref('')
  const timeRange = ref('all')
  const groupMode = ref('none')
  const sortMode = ref('timeDesc')
  const currentPage = ref(0)
  const isLoading = ref(false)
  const hasMore = ref(true)
  const totalCount = ref(0)
  const favorites = ref<string[]>([])
  const customRules = ref<ReturnType<typeof createCustomRule>[]>([])
  const groupedResult = ref<GroupResult | null>(null)
  const collapsedGroups = ref<string[]>([])
  const activeTagId = ref<string | null>(null)
  const recordTagsMap = ref<Record<string, string[]>>({})
  const customTags = ref<{ id: string; name: string; color: string }[]>([])
  const selectedRecords = ref<Set<string>>(new Set())
  const isSelectMode = ref(false)
  const blacklistedDomains = ref<string[]>([])
  const showCustomRuleDialog = ref(false)
  const showRuleGuide = ref(false)

  const timeFilter = ref<{ dayOfWeek: number | null; hourStart: number | null; hourEnd: number | null; label: string } | null>(null)
  const tagFilter = ref<{ tag: string; label: string } | null>(null)
  const domainFilter = ref<{ domain: string; label: string } | null>(null)

  const PAGE_SIZE = ref(30)
  const SESSION_GAP = ref(30 * 60 * 1000)

  const favoriteSet = computed(() => new Set(favorites.value))
  const collapsedSet = computed(() => new Set(collapsedGroups.value))
  const blacklistSet = computed(() => new Set(blacklistedDomains.value))

  const filteredRecords = computed(() => {
    const source = allRecords.value
    if (!source.length) return []

    const blSet = blacklistSet.value
    const hasBlacklist = blSet.size > 0
    const sk = searchKeyword.value
    const hasSearch = !!sk
    const kw = hasSearch ? sk.toLowerCase() : ''
    const tf = timeFilter.value
    const hasTimeFilter = !!tf
    const tg = tagFilter.value
    const hasTagFilter = !!tg
    const df = domainFilter.value
    const hasDomainFilter = !!df
    const ati = activeTagId.value
    const hasActiveTag = !!ati

    const tagCache = hasTagFilter ? new Map<string, string[]>() : null

    const result: HistoryRecord[] = []
    for (let i = 0; i < source.length; i++) {
      const r = source[i]

      if (hasBlacklist && blSet.has(r.domain)) continue

      if (hasSearch) {
        const urlLower = r.url.toLowerCase()
        if (!urlLower.includes(kw)) {
          const titleLower = (r.title || '').toLowerCase()
          if (!titleLower.includes(kw) && !r.domain.toLowerCase().includes(kw)) continue
        }
      }

      if (hasTimeFilter) {
        const d = new Date(r.lastVisitTime)
        if (tf!.dayOfWeek !== null && d.getDay() !== tf!.dayOfWeek) continue
        if (tf!.hourStart !== null && tf!.hourEnd !== null) {
          const h = d.getHours()
          if (h < tf!.hourStart || h >= tf!.hourEnd) continue
        } else if (tf!.hourStart !== null) {
          if (d.getHours() !== tf!.hourStart) continue
        }
      }

      if (hasTagFilter) {
        const customTags = recordTagsMap.value[r.url] || []
        if (!customTags.includes(tg!.tag)) {
          if (!(r.tags || []).includes(tg!.tag)) continue
        }
      }

      if (hasDomainFilter) {
        if (r.domain !== df!.domain && !r.domain.endsWith('.' + df!.domain)) continue
      }

      if (hasActiveTag) {
        const tags = recordTagsMap.value[r.url] || []
        if (!tags.includes(ati!)) continue
      }

      result.push(r)
    }

    switch (sortMode.value) {
      case 'timeDesc': result.sort((a, b) => b.lastVisitTime - a.lastVisitTime); break
      case 'timeAsc': result.sort((a, b) => a.lastVisitTime - b.lastVisitTime); break
      case 'visitDesc': result.sort((a, b) => b.visitCount - a.visitCount); break
      case 'visitAsc': result.sort((a, b) => a.visitCount - b.visitCount); break
      case 'domainAsc': result.sort((a, b) => a.domain.localeCompare(b.domain)); break
      case 'domainDesc': result.sort((a, b) => b.domain.localeCompare(a.domain)); break
    }

    return result
  })

  const pagedRecords = computed(() => {
    const end = PAGE_SIZE.value * (currentPage.value + 1)
    return filteredRecords.value.slice(0, end)
  })

  const isFavorite = computed(() => (url: string) => favoriteSet.value.has(url))

  async function loadRecords() {
    const loadStart = perfMark('history:load')
    isLoading.value = true
    try {
      const { startTime, endTime } = getTimeRange(timeRange.value)
      const cacheKey = `history:${startTime}:${endTime}`
      let items = await appCache.get<chrome.history.HistoryItem[]>(cacheKey, true)

      if (!items || !Array.isArray(items)) {
        items = await chrome.history.search({ text: '', startTime, endTime, maxResults: 5000 })
        if (!Array.isArray(items)) items = []
        await appCache.set(cacheKey, items, true)

        if (timeRange.value === 'all' && items.length >= 5000) {
          loadMoreInBackground(startTime, endTime)
        }
      }

      allRecords.value = items.map((item: chrome.history.HistoryItem) => {
        const url = item.url || ''
        const title = item.title || url
        return {
          id: item.id || '',
          url,
          title,
          lastVisitTime: item.lastVisitTime || 0,
          visitCount: item.visitCount || 0,
          typedCount: item.typedCount || 0,
          domain: getDomain(url),
          domainColor: stringToColor(getDomain(url)),
          tags: autoTag(url, title),
        }
      })

      totalCount.value = allRecords.value.length
      hasMore.value = allRecords.value.length > PAGE_SIZE.value
      currentPage.value = 0

      await Promise.all([loadFavorites(), loadCustomRules(), loadTags(), loadBlacklist()])
      applyFilters()
      perfMeasure('history:load', loadStart, { recordCount: allRecords.value.length })
    } catch (e) {
      console.error('Failed to load records:', e)
    } finally {
      isLoading.value = false
    }
  }

  async function loadMoreInBackground(startTime: number, endTime: number) {
    try {
      const extra = await chrome.history.search({
        text: '', startTime: 0, endTime: endTime || Date.now(), maxResults: 15000
      })
      if (Array.isArray(extra) && extra.length > 0) {
        const cacheKey = `history:${startTime}:${endTime}`
        await appCache.set(cacheKey, extra, true)
        const mapped = extra.map((item: chrome.history.HistoryItem) => {
          const url = item.url || ''
          const title = item.title || url
          return {
            id: item.id || '',
            url,
            title,
            lastVisitTime: item.lastVisitTime || 0,
            visitCount: item.visitCount || 0,
            typedCount: item.typedCount || 0,
            domain: getDomain(url),
            domainColor: stringToColor(getDomain(url)),
            tags: autoTag(url, title),
          }
        })
        allRecords.value = mapped
        totalCount.value = mapped.length
        hasMore.value = mapped.length > PAGE_SIZE.value
        applyFilters()
      }
    } catch { /* ignore */ }
  }

  function applyFilters() {
    displayedRecords.value = filteredRecords.value
    if (groupMode.value !== 'none') {
      applyGrouping()
    } else {
      groupedResult.value = null
    }
  }

  function applyGrouping() {
    switch (groupMode.value) {
      case 'domain': groupedResult.value = groupByDomain(displayedRecords.value); break
      case 'timeline': groupedResult.value = groupByTimeline(displayedRecords.value); break
      case 'session': groupedResult.value = groupBySession(displayedRecords.value, SESSION_GAP.value); break
      case 'custom': groupedResult.value = groupByCustomRules(displayedRecords.value, customRules.value); break
      default: groupedResult.value = null
    }
  }

  const setSearch = debounce((keyword: string) => {
    searchKeyword.value = keyword
    currentPage.value = 0
    applyFilters()
  }, 300)

  function setSearchImmediate(keyword: string) {
    searchKeyword.value = keyword
    currentPage.value = 0
    applyFilters()
  }

  function setTimeRange(range: string) {
    timeRange.value = range
    loadRecords()
  }

  function setGroupMode(mode: string) {
    groupMode.value = mode
    collapsedGroups.value = []
    if (mode === 'custom') {
      showCustomRuleDialog.value = true
      if (customRules.value.length === 0) {
        showRuleGuide.value = true
      }
    }
    applyFilters()
  }

  function setSortMode(mode: string) {
    sortMode.value = mode
    applyFilters()
  }

  function loadMore() {
    if (currentPage.value < 50 && pagedRecords.value.length < filteredRecords.value.length) {
      currentPage.value++
    }
  }

  async function toggleFavorite(url: string) {
    const set = new Set(favorites.value)
    if (set.has(url)) set.delete(url)
    else set.add(url)
    favorites.value = Array.from(set)
    await saveFavorites()
  }

  async function deleteRecord(record: HistoryRecord) {
    try {
      await chrome.history.deleteUrl({ url: record.url })
      allRecords.value = allRecords.value.filter(r => r.id !== record.id)
      applyFilters()
    } catch (e) {
      console.error('Delete failed:', e)
    }
  }

  async function deleteRecords(records: HistoryRecord[]) {
    try {
      await Promise.all(records.map(r => chrome.history.deleteUrl({ url: r.url })))
      const ids = new Set(records.map(r => r.id))
      allRecords.value = allRecords.value.filter(r => !ids.has(r.id))
      selectedRecords.value.clear()
      isSelectMode.value = false
      applyFilters()
    } catch (e) {
      console.error('Batch delete failed:', e)
    }
  }

  async function openRecord(url: string) {
    safeOpenUrl(url, true)
  }

  async function restoreSession(groupKey: string) {
    if (!groupedResult.value) return
    const records = groupedResult.value.groups[groupKey]
    if (!records?.length) return
    for (const r of records) {
      safeOpenUrl(r.url, false)
    }
  }

  function toggleGroupCollapse(groupKey: string) {
    const set = new Set(collapsedGroups.value)
    if (set.has(groupKey)) set.delete(groupKey)
    else set.add(groupKey)
    collapsedGroups.value = Array.from(set)
  }

  function expandTopGroups(count: number) {
    collapsedGroups.value = []
    if (groupedResult.value) {
      const toCollapse = groupedResult.value.order.slice(count)
      collapsedGroups.value = toCollapse
    }
  }

  function toggleSelectMode() {
    isSelectMode.value = !isSelectMode.value
    if (!isSelectMode.value) selectedRecords.value.clear()
  }

  function toggleSelectRecord(id: string) {
    const s = new Set(selectedRecords.value)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    selectedRecords.value = s
  }

  function selectAll() {
    selectedRecords.value = new Set(filteredRecords.value.map(r => r.id))
  }

  function clearSelection() {
    selectedRecords.value = new Set()
  }

  async function loadFavorites() {
    try {
      const result = await chrome.storage.local.get('favorites')
      const data = result.favorites
      favorites.value = Array.isArray(data) ? data : []
    } catch { /* ignore */ }
  }

  async function saveFavorites() {
    try {
      const safeFavorites = favorites.value.map(urlStorageKey)
      await chrome.storage.local.set({ favorites: safeFavorites })
    } catch { /* ignore */ }
  }

  async function loadCustomRules() {
    try {
      const result = await chrome.storage.local.get('customRules')
      const data = result.customRules
      customRules.value = Array.isArray(data) ? data : []
    } catch { /* ignore */ }
  }

  async function saveCustomRules() {
    try {
      await chrome.storage.local.set({ customRules: customRules.value })
    } catch { /* ignore */ }
  }

  async function addCustomRule(name: string, pattern: string, type: string) {
    const rule = createCustomRule(name, pattern, type)
    customRules.value = [...customRules.value, rule]
    await saveCustomRules()
    if (groupMode.value === 'custom') applyGrouping()
  }

  async function removeCustomRule(id: string) {
    customRules.value = customRules.value.filter(r => r.id !== id)
    await saveCustomRules()
    if (groupMode.value === 'custom') applyGrouping()
  }

  async function loadTags() {
    try {
      const result = await chrome.storage.local.get(['customTags', 'recordTagsMap'])
      const tagsData = result.customTags
      const mapData = result.recordTagsMap
      customTags.value = Array.isArray(tagsData) ? tagsData : []
      recordTagsMap.value = (mapData && typeof mapData === 'object' && !Array.isArray(mapData)) 
        ? mapData as Record<string, string[]> 
        : {}
    } catch { /* ignore */ }
  }

  async function saveTags() {
    try {
      const safeMap: Record<string, string[]> = {}
      for (const [url, tags] of Object.entries(recordTagsMap.value)) {
        safeMap[urlStorageKey(url)] = tags
      }
      await chrome.storage.local.set({ customTags: customTags.value, recordTagsMap: safeMap })
    } catch { /* ignore */ }
  }

  async function addTag(name: string, color: string) {
    if (customTags.value.some(t => t.name === name)) return
    const tag = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, color }
    customTags.value = [...customTags.value, tag]
    await saveTags()
  }

  async function removeTag(id: string) {
    customTags.value = customTags.value.filter(t => t.id !== id)
    const newMap: Record<string, string[]> = {}
    for (const [url, tags] of Object.entries(recordTagsMap.value)) {
      const filtered = tags.filter(t => t !== id)
      if (filtered.length > 0) newMap[url] = filtered
    }
    recordTagsMap.value = newMap
    await saveTags()
  }

  async function toggleRecordTag(url: string, tagId: string) {
    const tags = recordTagsMap.value[url] ? [...recordTagsMap.value[url]] : []
    const idx = tags.indexOf(tagId)
    if (idx >= 0) tags.splice(idx, 1)
    else tags.push(tagId)
    recordTagsMap.value = { ...recordTagsMap.value, [url]: tags }
    await saveTags()
  }

  async function loadBlacklist() {
    try {
      const result = await chrome.storage.local.get('blacklistedDomains')
      const data = result.blacklistedDomains
      blacklistedDomains.value = Array.isArray(data) ? data : []
    } catch { /* ignore */ }
  }

  async function saveBlacklist() {
    try {
      await chrome.storage.local.set({ blacklistedDomains: blacklistedDomains.value })
    } catch { /* ignore */ }
  }

  async function addBlacklistDomain(domain: string) {
    if (blacklistedDomains.value.includes(domain)) return
    blacklistedDomains.value = [...blacklistedDomains.value, domain]
    await saveBlacklist()
    applyFilters()
  }

  async function removeBlacklistDomain(domain: string) {
    blacklistedDomains.value = blacklistedDomains.value.filter(d => d !== domain)
    await saveBlacklist()
    applyFilters()
  }

  function doExport() {
    exportToCSV(displayedRecords.value)
  }

  function applySettings(pageSize: number, sessionGapMinutes: number) {
    if (pageSize && pageSize >= 20 && pageSize <= 500) PAGE_SIZE.value = pageSize
    if (sessionGapMinutes && sessionGapMinutes >= 5 && sessionGapMinutes <= 120) {
      SESSION_GAP.value = sessionGapMinutes * 60 * 1000
    }
    applyFilters()
  }

  function setTimeFilter(dayOfWeek: number | null, hourStart: number | null, hourEnd: number | null, label: string) {
    timeFilter.value = { dayOfWeek, hourStart, hourEnd, label }
    tagFilter.value = null
    domainFilter.value = null
    searchKeyword.value = ''
    currentPage.value = 0
    applyFilters()
  }

  function setTagFilter(tag: string, label: string) {
    tagFilter.value = { tag, label }
    timeFilter.value = null
    domainFilter.value = null
    searchKeyword.value = ''
    currentPage.value = 0
    applyFilters()
  }

  function setDomainFilter(domain: string, label: string) {
    domainFilter.value = { domain, label }
    timeFilter.value = null
    tagFilter.value = null
    searchKeyword.value = ''
    currentPage.value = 0
    applyFilters()
  }

  function clearAllFilters() {
    timeFilter.value = null
    tagFilter.value = null
    domainFilter.value = null
    searchKeyword.value = ''
    currentPage.value = 0
    applyFilters()
  }

  const hasActiveFilter = computed(() =>
    !!timeFilter.value || !!tagFilter.value || !!domainFilter.value || !!searchKeyword.value
  )

  const activeFilterLabel = computed(() => {
    if (timeFilter.value) return timeFilter.value.label
    if (tagFilter.value) return tagFilter.value.label
    if (domainFilter.value) return domainFilter.value.label
    if (searchKeyword.value) return searchKeyword.value
    return ''
  })

  return {
    allRecords, displayedRecords, searchKeyword, timeRange, groupMode, sortMode,
    currentPage, isLoading, hasMore, totalCount, favorites, customRules,
    groupedResult, collapsedGroups, activeTagId, recordTagsMap,
    customTags, filteredRecords, pagedRecords, isFavorite,
    favoriteSet, collapsedSet, selectedRecords, isSelectMode,
    blacklistedDomains, blacklistSet,
    showCustomRuleDialog, showRuleGuide,
    timeFilter, tagFilter, domainFilter, hasActiveFilter, activeFilterLabel,
    loadRecords, setSearch, setSearchImmediate, setTimeRange, setGroupMode, setSortMode, loadMore,
    toggleFavorite, deleteRecord, deleteRecords, openRecord, restoreSession,
    toggleGroupCollapse, expandTopGroups,
    loadFavorites, saveFavorites, loadCustomRules, saveCustomRules, addCustomRule,
    removeCustomRule, loadTags, saveTags, addTag, removeTag, toggleRecordTag,
    loadBlacklist, saveBlacklist, addBlacklistDomain, removeBlacklistDomain,
    doExport, applyFilters, applySettings, toggleSelectMode, toggleSelectRecord, selectAll, clearSelection,
    setTimeFilter, setTagFilter, setDomainFilter, clearAllFilters,
  }
})
