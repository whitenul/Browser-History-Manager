import { defineStore } from 'pinia'
import { ref } from 'vue'

type GroupState = 'none' | 'grouping' | 'collapsed' | 'error'

const GROUP_PREFIX = '[BH] '
const GROUP_TITLE = GROUP_PREFIX + '\u{1f4e1} \u5de5\u4f5c\u533a'

export const useTabGroupStore = defineStore('tabGroup', () => {
  const enabled = ref(false)
  const groupId = ref<number | null>(null)
  const groupState = ref<GroupState>('none')
  let _operating = false
  let _groupListener: ((groupInfo: chrome.tabGroups.TabGroup) => void) | null = null

  async function loadSettings() {
    try {
      const result = await chrome.storage.sync.get('tabGroupEnabled')
      enabled.value = result.tabGroupEnabled !== false
    } catch { /* ignore */ }
  }

  async function saveSettings(val: boolean) {
    try {
      await chrome.storage.sync.set({ tabGroupEnabled: val })
    } catch { /* ignore */ }
  }

  async function enableMode() {
    if (_operating || enabled.value) return
    _operating = true
    try {
      const win = await chrome.windows.getCurrent()
      const tabs = await chrome.tabs.query({ windowId: win.id, pinned: false })
      if (tabs.length === 0) {
        enabled.value = true
        await saveSettings(true)
        groupState.value = 'none'
        return
      }

      groupState.value = 'grouping'
      const ids = tabs.map(t => t.id!) as [number, ...number[]]
      const gid = await chrome.tabs.group({ tabIds: ids })
      groupId.value = gid as number

      await chrome.tabGroups.update(gid as number, {
        title: GROUP_TITLE,
        color: 'blue',
        collapsed: true,
      })

      startGroupGuard()
      enabled.value = true
      groupState.value = 'collapsed'
      await saveSettings(true)
    } catch (e) {
      groupState.value = 'error'
      console.error('[TabGroup] enableMode failed:', e)
    } finally { _operating = false }
  }

  async function disableMode() {
    if (_operating || !enabled.value) return
    _operating = true
    stopGroupGuard()
    try {
      if (groupId.value != null) {
        const tabs = await chrome.tabs.query({ groupId: groupId.value })
        if (tabs.length > 0) {
          await chrome.tabs.ungroup(tabs.map(t => t.id!) as [number, ...number[]])
        }
        groupId.value = null
      }
      enabled.value = false
      groupState.value = 'none'
      await saveSettings(false)
    } catch (e) {
      console.error('[TabGroup] disableMode failed:', e)
    } finally { _operating = false }
  }

  async function ensureGrouped(tabIds: number[]) {
    if (!enabled.value || groupId.value == null || tabIds.length === 0) return
    try {
      await chrome.tabs.group({ tabIds: tabIds as [number, ...number[]], groupId: groupId.value })
    } catch { /* ignore */ }
  }

  function startGroupGuard() {
    stopGroupGuard()
    _groupListener = (groupInfo) => {
      if (
        !enabled.value ||
        groupId.value == null ||
        groupInfo.id !== groupId.value ||
        groupInfo.windowId === undefined
      ) return

      if (groupInfo.collapsed === false) {
        chrome.tabGroups.update(groupInfo.id, { collapsed: true }).catch(() => {})
      }
    }
    chrome.tabGroups.onUpdated.addListener(_groupListener)
  }

  function stopGroupGuard() {
    if (_groupListener) {
      chrome.tabGroups.onUpdated.removeListener(_groupListener)
      _groupListener = null
    }
  }

  async function findOurGroup(windowId: number): Promise<chrome.tabGroups.TabGroup | undefined> {
    const groups = await chrome.tabGroups.query({ windowId })
    return groups.find(g => g.title?.startsWith(GROUP_PREFIX))
  }

  async function init() {
    await loadSettings()
    if (!enabled.value) return
    try {
      const win = await chrome.windows.getCurrent()
      if (!win.id) return
      const ourGroup = await findOurGroup(win.id)

      if (ourGroup) {
        groupId.value = ourGroup.id
        if (!ourGroup.collapsed) {
          await chrome.tabGroups.update(ourGroup.id, { collapsed: true })
        }
        startGroupGuard()
        groupState.value = 'collapsed'
      } else {
        await enableMode()
      }
    } catch (e) {
      groupState.value = 'error'
      console.error('[TabGroup] init failed:', e)
    }
  }

  return {
    enabled,
    groupId,
    groupState,
    isGrouped: () => groupState.value === 'collapsed',
    loadSettings,
    saveSettings,
    enableMode,
    disableMode,
    ensureGrouped,
    init,
  }
})
