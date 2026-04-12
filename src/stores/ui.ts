import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type TabId = 'tabs' | 'history' | 'stats' | 'bookmarks' | 'settings'

export interface UndoAction {
  label: string
  undo: () => void
  timer: ReturnType<typeof setTimeout>
}

export interface FilterSnapshot {
  type: 'time' | 'tag' | 'domain'
  payload: Record<string, unknown>
}

export interface NavEntry {
  tab: TabId
  label: string
  source?: string
  filterSnapshot?: FilterSnapshot
}

export const useUIStore = defineStore('ui', () => {
  const activeTab = ref<TabId>('history')
  const showContextMenu = ref(false)
  const contextMenuPos = ref({ x: 0, y: 0 })
  const contextMenuTarget = ref<any>(null)
  const showDeleteConfirm = ref(false)
  const deleteTarget = ref<any>(null)
  const showTagModal = ref(false)
  const tagModalTarget = ref<string>('')
  const showGroupRuleModal = ref(false)
  const toastMessage = ref('')
  const toastType = ref<'success' | 'error' | 'info'>('success')
  const showToast = ref(false)
  const showPreview = ref(false)
  const previewRecord = ref<any>(null)
  const showBookmarkPicker = ref(false)
  const bookmarkTarget = ref<any>(null)
  const showCommandPalette = ref(false)
  const undoStack = ref<UndoAction[]>([])
  const showUndoToast = ref(false)
  const undoLabel = ref('')
  const currentUndoTimer = ref<ReturnType<typeof setTimeout> | null>(null)

  const navStack = ref<NavEntry[]>([])
  const canGoBack = computed(() => navStack.value.length > 0)
  const isNavigatingBack = ref(false)
  const scrollMemory = ref<Record<TabId, number>>({ tabs: 0, history: 0, stats: 0, bookmarks: 0, settings: 0 })

  function switchTab(tab: TabId) {
    saveCurrentScroll()
    activeTab.value = tab
  }

  function navigateTo(tab: TabId, label: string = '', meta?: { source?: string; filterSnapshot?: FilterSnapshot }) {
    const tabLabels: Record<TabId, string> = {
      tabs: 'nav.tabs',
      history: 'nav.history',
      stats: 'nav.stats',
      bookmarks: 'nav.bookmarks',
      settings: 'nav.settings',
    }
    saveCurrentScroll()
    navStack.value.push({
      tab: activeTab.value,
      label: label || tabLabels[activeTab.value],
      source: meta?.source,
      filterSnapshot: meta?.filterSnapshot,
    })
    if (navStack.value.length > 20) navStack.value.splice(0, navStack.value.length - 20)
    isNavigatingBack.value = false
    activeTab.value = tab
  }

  function goBack(clearFilter = false) {
    const entry = navStack.value.pop()
    if (entry) {
      saveCurrentScroll()
      isNavigatingBack.value = true
      activeTab.value = entry.tab
    }
  }

  function saveCurrentScroll() {
    const selectors: Record<TabId, string> = {
      tabs: '.tab-manager',
      history: '.record-list',
      stats: '.stats-content',
      bookmarks: '.bookmarks-content',
      settings: '.settings-content',
    }
    const el = document.querySelector(selectors[activeTab.value]) as HTMLElement
    if (el) scrollMemory.value[activeTab.value] = el.scrollTop
  }

  function getScrollPosition(tab: TabId): number {
    return scrollMemory.value[tab] || 0
  }

  function clearNavStack() {
    navStack.value = []
  }

  function openContextMenu(x: number, y: number, target: any) {
    contextMenuPos.value = { x, y }
    contextMenuTarget.value = target
    showContextMenu.value = true
  }

  function closeContextMenu() {
    showContextMenu.value = false
    contextMenuTarget.value = null
  }

  function openDeleteConfirm(record: any) {
    deleteTarget.value = record
    showDeleteConfirm.value = true
  }

  function closeDeleteConfirm() {
    showDeleteConfirm.value = false
    deleteTarget.value = null
  }

  function openTagModal(url: string) {
    tagModalTarget.value = url
    showTagModal.value = true
  }

  function closeTagModal() {
    showTagModal.value = false
    tagModalTarget.value = ''
  }

  function notify(message: string, type: 'success' | 'error' | 'info' = 'success') {
    toastMessage.value = message
    toastType.value = type
    showToast.value = true
    setTimeout(() => { showToast.value = false }, 3000)
  }

  function notifyWithUndo(message: string, undoFn: () => void) {
    if (currentUndoTimer.value) clearTimeout(currentUndoTimer.value)
    undoLabel.value = message
    showUndoToast.value = true
    showToast.value = false
    currentUndoTimer.value = setTimeout(() => {
      showUndoToast.value = false
      currentUndoTimer.value = null
    }, 5000)
    const action: UndoAction = {
      label: message,
      undo: () => {
        undoFn()
        showUndoToast.value = false
        if (currentUndoTimer.value) { clearTimeout(currentUndoTimer.value); currentUndoTimer.value = null }
      },
      timer: currentUndoTimer.value!,
    }
    undoStack.value.push(action)
    if (undoStack.value.length > 10) undoStack.value.splice(0, undoStack.value.length - 10)
  }

  function executeUndo() {
    const last = undoStack.value.pop()
    if (last) {
      if (currentUndoTimer.value) clearTimeout(currentUndoTimer.value)
      last.undo()
    }
    showUndoToast.value = false
    currentUndoTimer.value = null
  }

  function openPreview(record: any) {
    previewRecord.value = record
    showPreview.value = true
  }

  function closePreview() {
    showPreview.value = false
    previewRecord.value = null
  }

  function openBookmarkPicker(record: any) {
    bookmarkTarget.value = record
    showBookmarkPicker.value = true
  }

  function closeBookmarkPicker() {
    showBookmarkPicker.value = false
    bookmarkTarget.value = null
  }

  return {
    activeTab, showContextMenu, contextMenuPos, contextMenuTarget,
    showDeleteConfirm, deleteTarget, showTagModal, tagModalTarget,
    showGroupRuleModal, toastMessage, toastType, showToast,
    showPreview, previewRecord,
    showBookmarkPicker, bookmarkTarget,
    showCommandPalette, undoStack, showUndoToast, undoLabel,
    navStack, canGoBack, isNavigatingBack, scrollMemory,
    switchTab, navigateTo, goBack, clearNavStack, saveCurrentScroll, getScrollPosition,
    openContextMenu, closeContextMenu,
    openDeleteConfirm, closeDeleteConfirm,
    openTagModal, closeTagModal,
    notify, notifyWithUndo, executeUndo,
    openPreview, closePreview,
    openBookmarkPicker, closeBookmarkPicker,
  }
})
