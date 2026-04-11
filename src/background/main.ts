
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })

async function ensureContextMenu() {
  try {
    await chrome.contextMenus.removeAll()
    await chrome.contextMenus.create({
      id: 'openSidePanel',
      title: '在侧边栏中打开',
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
})
