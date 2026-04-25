import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface TabOptInfo {
  id: number
  title: string
  url: string
  favIconUrl: string
  active: boolean
  discarded: boolean
  lastAccessed: number
  groupId: number
  windowId: number
}

export interface DuplicateGroup {
  urlKey: string
  tabs: TabOptInfo[]
  savedMemory: number
}

export interface OptimizerSettings {
  autoSuspendMinutes: number
  minTabsBeforeSuspend: number
  protectPinned: boolean
  protectAudible: boolean
  showNotifications: boolean
}

const DEFAULT_SETTINGS: OptimizerSettings = {
  autoSuspendMinutes: 30,
  minTabsBeforeSuspend: 5,
  protectPinned: true,
  protectAudible: true,
  showNotifications: false,
}

const ESTIMATED_TAB_MEMORY_MB = 50

function urlKey(url: string): string {
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname}`
  } catch {
    return url
  }
}

export const useTabOptimizerStore = defineStore('tabOptimizer', () => {
  const tabs = ref<TabOptInfo[]>([])
  const settings = ref<OptimizerSettings>({ ...DEFAULT_SETTINGS })
  const isLoading = ref(false)
  const totalSuspended = ref(0)

  const duplicateGroups = computed<DuplicateGroup[]>(() => {
    const map = new Map<string, TabOptInfo[]>()
    for (const t of tabs.value) {
      if (t.active || t.discarded) continue
      const key = urlKey(t.url)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }
    const result: DuplicateGroup[] = []
    for (const [key, group] of map) {
      if (group.length > 1) {
        result.push({ urlKey: key, tabs: group, savedMemory: (group.length - 1) * ESTIMATED_TAB_MEMORY_MB })
      }
    }
    return result.sort((a, b) => b.savedMemory - a.savedMemory)
  })

  const idleTabs = computed<TabOptInfo[]>(() => {
    const now = Date.now()
    const threshold = settings.value.autoSuspendMinutes * 60 * 1000
    return tabs.value.filter(t =>
      !t.active &&
      !t.discarded &&
      (now - t.lastAccessed) > threshold &&
      !(settings.value.protectPinned && isPinned(t.id)) &&
      !(settings.value.protectAudible && isAudible(t.id))
    )
  })

  const estimatedMemoryMB = computed(() => {
    const activeCount = tabs.value.filter(t => !t.discarded).length
    return activeCount * ESTIMATED_TAB_MEMORY_MB
  })

  const potentialSavingsMB = computed(() => {
    const idleSavings = idleTabs.value.length * ESTIMATED_TAB_MEMORY_MB
    const dupSavings = duplicateGroups.value.reduce((s, g) => s + g.savedMemory, 0)
    return idleSavings + dupSavings
  })

  async function loadTabs() {
    isLoading.value = true
    try {
      const allTabs = await chrome.tabs.query({})
      tabs.value = allTabs.map(t => ({
        id: t.id!,
        title: t.title || '',
        url: t.url || '',
        favIconUrl: t.favIconUrl || '',
        active: t.active,
        discarded: t.discarded ?? false,
        lastAccessed: t.lastAccessed ?? Date.now(),
        groupId: t.groupId ?? -1,
        windowId: t.windowId,
      }))
    } catch { /* ignore */ }
    finally { isLoading.value = false }
  }

  function syncFromQuery(rawTabs: chrome.tabs.Tab[]) {
    tabs.value = rawTabs.map(t => ({
      id: t.id!,
      title: t.title || '',
      url: t.url || '',
      favIconUrl: t.favIconUrl || '',
      active: t.active,
      discarded: t.discarded ?? false,
      lastAccessed: t.lastAccessed ?? Date.now(),
      groupId: t.groupId ?? -1,
      windowId: t.windowId,
    }))
  }

  async function loadSettings() {
    try {
      const result = await chrome.storage.local.get('optimizerSettings')
      if (result.optimizerSettings) {
        settings.value = { ...DEFAULT_SETTINGS, ...result.optimizerSettings }
      }
    } catch { /* ignore */ }
  }

  async function saveSettings() {
    try {
      await chrome.storage.local.set({ optimizerSettings: settings.value })
    } catch { /* ignore */ }
  }

  const _pinnedSet = ref(new Set<number>())
  const _audibleSet = ref(new Set<number>())

  function isPinned(tabId: number): boolean { return _pinnedSet.value.has(tabId) }
  function isAudible(tabId: number): boolean { return _audibleSet.value.has(tabId) }

  async function refreshPinnedAudible() {
    try {
      const allTabs = await chrome.tabs.query({})
      const pinned = new Set<number>()
      const audible = new Set<number>()
      for (const t of allTabs) {
        if (t.pinned && t.id != null) pinned.add(t.id)
        if (t.audible && t.id != null) audible.add(t.id)
      }
      _pinnedSet.value = pinned
      _audibleSet.value = audible
    } catch { /* ignore */ }
  }

  async function suspendTab(tabId: number) {
    try {
      await chrome.tabs.discard(tabId)
      totalSuspended.value++
    } catch { /* ignore */ }
  }

  async function suspendIdleTabs() {
    await refreshPinnedAudible()
    const toSuspend = idleTabs.value
    if (toSuspend.length === 0) return 0
    if (tabs.value.filter(t => !t.discarded).length <= settings.value.minTabsBeforeSuspend) return 0

    let count = 0
    for (const t of toSuspend) {
      try {
        await chrome.tabs.discard(t.id)
        count++
        totalSuspended.value++
      } catch { /* ignore */ }
    }
    await loadTabs()
    return count
  }

  async function closeDuplicateTabs(groupUrlKey?: string) {
    let closed = 0
    const groups = groupUrlKey
      ? duplicateGroups.value.filter(g => g.urlKey === groupUrlKey)
      : duplicateGroups.value

    for (const group of groups) {
      const sorted = [...group.tabs].sort((a, b) => b.lastAccessed - a.lastAccessed)
      for (let i = 1; i < sorted.length; i++) {
        try {
          await chrome.tabs.remove(sorted[i].id)
          closed++
        } catch { /* ignore */ }
      }
    }
    if (closed > 0) await loadTabs()
    return closed
  }

  async function suspendAllInactive() {
    await refreshPinnedAudible()
    const inactive = tabs.value.filter(t =>
      !t.active && !t.discarded &&
      !(settings.value.protectPinned && isPinned(t.id)) &&
      !(settings.value.protectAudible && isAudible(t.id))
    )
    let count = 0
    for (const t of inactive) {
      try {
        await chrome.tabs.discard(t.id)
        count++
        totalSuspended.value++
      } catch { /* ignore */ }
    }
    await loadTabs()
    return count
  }

  return {
    tabs, settings, isLoading, totalSuspended,
    duplicateGroups, idleTabs, estimatedMemoryMB, potentialSavingsMB,
    loadTabs, syncFromQuery, loadSettings, saveSettings,
    suspendTab, suspendIdleTabs, closeDuplicateTabs, suspendAllInactive,
    refreshPinnedAudible,
  }
})
