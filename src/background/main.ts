chrome.runtime.onInstalled.addListener(() => {
  applySidebarMode().catch(() => {})
})

applySidebarMode().catch(() => {})

async function applySidebarMode(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get('sidebarMode')
    const enabled = result.sidebarMode === true
    console.log('[BH] applySidebarMode: sidebarMode=', result.sidebarMode, 'enabled=', enabled)
    if (enabled) {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      await chrome.action.setPopup({ popup: '' })
      console.log('[BH] sidebar mode applied')
    } else {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
      await chrome.action.setPopup({ popup: 'popup.html' })
      console.log('[BH] popup mode applied')
    }
    return enabled
  } catch (err: any) {
    console.error('[BH] applySidebarMode failed:', err?.message || err)
    return false
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.sidebarMode) {
    applySidebarMode().catch(() => {})
  }
})

async function ensureContextMenu() {
  try {
    await chrome.contextMenus.removeAll()
    await chrome.contextMenus.create({
      id: 'openSidePanel',
      title: chrome.i18n.getMessage('contextMenuOpenSidePanel') || 'Open in Side Panel',
      contexts: ['action']
    })
  } catch { /* ignore */ }
}

ensureContextMenu()

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'openSidePanel' && tab?.windowId) {
    chrome.sidePanel.open({ windowId: tab.windowId })
  }
})

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'updateSidebarMode') {
    applySidebarMode()
      .then((enabled) => sendResponse({ success: true, sidebarMode: enabled }))
      .catch((err: any) => sendResponse({ success: false, error: err.message || String(err) }))
    return true
  }

  if (msg.action === 'openSidePanel') {
    ;(async () => {
      try {
        const windowId = sender.tab?.windowId
        if (windowId) {
          await chrome.sidePanel.open({ windowId })
        } else {
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
          if (tab?.windowId) {
            await chrome.sidePanel.open({ windowId: tab.windowId })
          }
        }
        sendResponse({ success: true })
      } catch (err: any) {
        sendResponse({ success: false, error: err.message || String(err) })
      }
    })()
    return true
  }

  if (msg.action === 'autoSuspendCheck') {
    ;(async () => {
      try {
        const result = await chrome.storage.local.get('optimizerSettings')
        const settings = result.optimizerSettings as Record<string, any> | undefined
        if (!settings || !settings.autoSuspendMinutes) {
          sendResponse({ suspended: 0 })
          return
        }

        const threshold = (settings.autoSuspendMinutes as number) * 60 * 1000
        const now = Date.now()
        const allTabs = await chrome.tabs.query({})
        const activeCount = allTabs.filter(t => !t.discarded).length

        if (activeCount <= ((settings.minTabsBeforeSuspend as number) || 5)) {
          sendResponse({ suspended: 0 })
          return
        }

        let suspended = 0
        for (const t of allTabs) {
          if (t.active || t.discarded || t.pinned || t.audible) continue
          if (t.id == null || t.lastAccessed == null) continue
          if (now - t.lastAccessed > threshold) {
            try {
              await chrome.tabs.discard(t.id)
              suspended++
            } catch { /* ignore */ }
          }
        }
        sendResponse({ suspended })
      } catch (err: any) {
        sendResponse({ suspended: 0, error: err.message })
      }
    })()
    return true
  }
})

chrome.alarms.create('tabOptimizer', { periodInMinutes: 5 })

async function runAutoSuspend() {
  try {
    const result = await chrome.storage.local.get('optimizerSettings')
    const settings = result.optimizerSettings as Record<string, any> | undefined
    if (!settings || !settings.autoSuspendMinutes) return

    const threshold = (settings.autoSuspendMinutes as number) * 60 * 1000
    const now = Date.now()
    const allTabs = await chrome.tabs.query({})
    const activeCount = allTabs.filter(t => !t.discarded).length

    if (activeCount <= ((settings.minTabsBeforeSuspend as number) || 5)) return

    for (const t of allTabs) {
      if (t.active || t.discarded || t.pinned || t.audible) continue
      if (t.id == null || t.lastAccessed == null) continue
      if (now - t.lastAccessed > threshold) {
        try { await chrome.tabs.discard(t.id) } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'tabOptimizer') {
    runAutoSuspend()
  }
})
