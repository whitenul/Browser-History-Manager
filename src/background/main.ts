chrome.runtime.onInstalled.addListener(() => {
  applySidebarMode().catch(() => {})
  verifyDnrRules()
  registerUserScripts().catch(() => {})
  setupMiniBrowserDnrRules()
})

applySidebarMode().catch(() => {})
verifyDnrRules()
registerUserScripts().catch(() => {})
setupMiniBrowserDnrRules()

async function registerUserScripts() {
  try {
    const result = await chrome.storage.local.get('userScripts')
    const scripts = result.userScripts as Array<any> | undefined
    if (!Array.isArray(scripts) || scripts.length === 0) return
    const enabledScripts = scripts.filter((s: any) => s.enabled && s.match && s.match.length > 0)
    console.warn('[BH]', enabledScripts.length, 'user scripts ready (injected via MAIN world bridge)')
  } catch { /* ignore */ }
}

async function applySidebarMode(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get('sidebarMode')
    const enabled = result.sidebarMode === true
    if (enabled) {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      await chrome.action.setPopup({ popup: '' })
    } else {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
      await chrome.action.setPopup({ popup: 'popup.html' })
    }
    return enabled
  } catch (err: any) {
    console.error('[BH] applySidebarMode failed:', err?.message || err)
    return false
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.sidebarMode) applySidebarMode().catch(() => {})
    if (changes.userScripts) registerUserScripts().catch(() => {})
  }
})

async function ensureContextMenu() {
  try {
    await chrome.contextMenus.removeAll()
    await chrome.contextMenus.create({
      id: 'openSidePanel',
      title: chrome.i18n.getMessage('contextMenuOpenSidePanel') || 'Open in Side Panel',
      contexts: ['action'],
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
  if (msg.action === 'registerUserScripts') {
    registerUserScripts()
      .then(() => sendResponse({ success: true }))
      .catch((err: any) => sendResponse({ success: false, error: err?.message || String(err) }))
    return true
  }

  if (msg.action === 'hmmGetScripts') {
    ;(async () => {
      try {
        const result = await chrome.storage.local.get('userScripts')
        const scripts = result.userScripts as any[] | undefined
        sendResponse({ scripts: Array.isArray(scripts) ? scripts : [] })
      } catch (err: any) {
        sendResponse({ scripts: [], error: err?.message })
      }
    })()
    return true
  }

  if (msg.action === 'hmmInjectFallback') {
    ;(async () => {
      try {
        const url = msg.url as string
        const scripts = msg.scripts as Array<{ name: string; code: string }>
        const allTabs = await chrome.tabs.query({})
        let injected = 0
        for (const tab of allTabs) {
          if (!tab.id || tab.url?.startsWith('chrome-extension://')) continue
          try {
            const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id })
            const hasMatch = frames?.some(f => f.url === url)
            if (!hasMatch) continue
            for (const script of scripts) {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id, allFrames: true },
                world: 'MAIN',
                injectImmediately: true,
                func: (userCode: string) => { try { (0, eval)(userCode) } catch (e) { console.error('[HMM UserScript] Error:', e) } },
                args: [script.code],
              })
            }
            injected += scripts.length
            break
          } catch { /* skip */ }
        }
        sendResponse(injected > 0 ? { success: true, count: injected } : { success: false, error: 'Frame not found' })
      } catch (err: any) {
        sendResponse({ success: false, error: err?.message || String(err) })
      }
    })()
    return true
  }

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
            try { await chrome.tabs.discard(t.id); suspended++ } catch { /* ignore */ }
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

async function verifyDnrRules() {
  try {
    const rulesets = await chrome.declarativeNetRequest.getEnabledRulesets()
    const hasIframeBypass = rulesets.includes('iframe_bypass_rules')
    if (!hasIframeBypass) {
      console.warn('[BH] WARNING: iframe_bypass_rules not found! Available:', rulesets)
    }
  } catch (err: any) {
    console.error('[BH] Failed to verify DNR rules:', err?.message || err)
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'tabOptimizer') {
    runAutoSuspend()
  }
})

const MINIBROWSER_DNR_RULE_IDS = [1001, 1002, 1003]

function setupMiniBrowserDnrRules() {
  setTimeout(() => registerDynamicRules(), 2000)
}

async function clearCacheForOrigin(origin: string): Promise<void> {
  try {
    await chrome.browsingData.remove({
      origins: [origin]
    }, {
      serviceWorkers: true,
      cache: true,
    })
  } catch {
    try {
      await chrome.browsingData.removeCache({
        since: Date.now() - 60000
      })
    } catch { /* ignore */ }
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'clearCacheForOrigin' && msg.origin) {
    clearCacheForOrigin(msg.origin).then(() => sendResponse({ ok: true })).catch((e) => sendResponse({ ok: false, error: String(e) }))
    return true
  }
})

async function registerDynamicRules() {
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: MINIBROWSER_DNR_RULE_IDS,
      addRules: [
        {
          id: 1001,
          priority: 3,
          action: {
            type: 'modifyHeaders' as const,
            responseHeaders: [
              { header: 'X-Frame-Options', operation: 'remove' as const },
              { header: 'Frame-Options', operation: 'remove' as const },
            ],
          },
          condition: {
            urlFilter: '*',
            resourceTypes: ['sub_frame' as const],
          },
        },
        {
          id: 1002,
          priority: 3,
          action: {
            type: 'modifyHeaders' as const,
            responseHeaders: [
              { header: 'Content-Security-Policy', operation: 'remove' as const },
              { header: 'Content-Security-Policy-Report-Only', operation: 'remove' as const },
            ],
          },
          condition: {
            urlFilter: '*',
            resourceTypes: ['sub_frame' as const],
          },
        },
        {
          id: 1003,
          priority: 4,
          action: {
            type: 'modifyHeaders' as const,
            requestHeaders: [
              { header: 'Sec-Fetch-Dest', operation: 'set' as const, value: 'document' },
              { header: 'Sec-Fetch-Mode', operation: 'set' as const, value: 'navigate' },
              { header: 'Sec-Fetch-Site', operation: 'set' as const, value: 'none' },
            ],
          },
          condition: {
            urlFilter: '*',
            resourceTypes: ['sub_frame' as const],
          },
        },
      ],
    })
    console.log('[BH] Dynamic DNR rules registered for iframe bypass')
  } catch (err: any) {
    console.error('[BH] Failed to register dynamic DNR rules:', err?.message || err)
  }
}
