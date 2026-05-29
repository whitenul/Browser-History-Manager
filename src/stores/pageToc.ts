import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface HeadingItem {
  id: string
  text: string
  level: number // 1-6
  top: number
  isVisible: boolean
  isHidden: boolean
  isEmpty: boolean
  levelError: string | null // 'skipped' etc.
  tagName: string
  inSectioningRoot: boolean
  isAriaHeading: boolean
}

export interface TreeNode {
  heading: HeadingItem
  children: TreeNode[]
  expanded: boolean
}

export const usePageTocStore = defineStore('pageToc', () => {
  const headings = ref<HeadingItem[]>([])
  const loading = ref(false)
  const error = ref('')
  const pageTitle = ref('')
  const pageUrl = ref('')
  const activeHeadingId = ref('')
  const debugInfo = ref('')
  const hasNoH1 = ref(false)
  const searchQuery = ref('')

  // Build tree from flat headings list
  const tree = computed<TreeNode[]>(() => {
    const roots: TreeNode[] = []
    const stack: TreeNode[] = []

    for (const h of headings.value) {
      const node: TreeNode = { heading: h, children: [], expanded: true }

      // Pop stack until we find a parent with lower level
      while (stack.length > 0 && stack[stack.length - 1].heading.level >= h.level) {
        stack.pop()
      }

      if (stack.length === 0) {
        roots.push(node)
      } else {
        stack[stack.length - 1].children.push(node)
      }

      stack.push(node)
    }

    return roots
  })

  // Flatten tree for display (with depth info)
  const flatTree = computed(() => {
    const result: { node: TreeNode; depth: number }[] = []

    function walk(nodes: TreeNode[], depth: number) {
      for (const node of nodes) {
        // Filter by search query
        if (searchQuery.value) {
          const q = searchQuery.value.toLowerCase()
          const matches = node.heading.text.toLowerCase().includes(q)
            || node.heading.tagName.toLowerCase().includes(q)
          if (!matches && !hasMatchingDescendant(node, q)) continue
        }

        result.push({ node, depth })
        if (node.expanded && node.children.length > 0) {
          walk(node.children, depth + 1)
        }
      }
    }

    function hasMatchingDescendant(node: TreeNode, q: string): boolean {
      for (const child of node.children) {
        if (child.heading.text.toLowerCase().includes(q)
          || child.heading.tagName.toLowerCase().includes(q)
          || hasMatchingDescendant(child, q)) {
          return true
        }
      }
      return false
    }

    walk(tree.value, 0)
    return result
  })

  // Stats
  const stats = computed(() => {
    const counts: Record<number, number> = {}
    let errorCount = 0
    let hiddenCount = 0
    let emptyCount = 0

    for (const h of headings.value) {
      counts[h.level] = (counts[h.level] || 0) + 1
      if (h.levelError) errorCount++
      if (h.isHidden) hiddenCount++
      if (h.isEmpty) emptyCount++
    }

    return {
      total: headings.value.length,
      counts,
      errorCount,
      hiddenCount,
      emptyCount,
      hasNoH1: hasNoH1.value,
    }
  })

  function toggleNode(node: TreeNode) {
    node.expanded = !node.expanded
  }

  function expandAll() {
    function walk(nodes: TreeNode[]) {
      for (const n of nodes) {
        n.expanded = true
        walk(n.children)
      }
    }
    walk(tree.value)
  }

  function collapseAll() {
    function walk(nodes: TreeNode[]) {
      for (const n of nodes) {
        n.expanded = false
        walk(n.children)
      }
    }
    walk(tree.value)
  }

  async function extractHeadings() {
    loading.value = true
    error.value = ''
    debugInfo.value = ''
    hasNoH1.value = false

    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })

      if (!tab?.id) {
        error.value = 'noTab'
        headings.value = []
        return
      }

      const url = tab.url || ''
      if (
        url.startsWith('chrome://') ||
        url.startsWith('edge://') ||
        url.startsWith('about:') ||
        url.startsWith('chrome-extension://') ||
        url.startsWith('devtools://')
      ) {
        error.value = 'restrictedPage'
        headings.value = []
        return
      }

      // Primary path: send message to content script
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractHeadings' })

        if (response?.success) {
          headings.value = response.headings || []
          hasNoH1.value = response.hasNoH1 || false
          pageTitle.value = response.title || tab.title || ''
          pageUrl.value = response.url || tab.url || ''
          if (headings.value.length === 0) {
            error.value = 'noHeadings'
          }
          return
        }
        error.value = 'extractFailed'
        headings.value = []
        debugInfo.value = `CS responded but failed: ${response?.error || 'unknown'}`
        return
      } catch (sendErr: any) {
        debugInfo.value = `sendMessage failed: ${sendErr?.message || String(sendErr)}`
      }

      // Fallback: inject content script programmatically
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['heading-extractor.js'],
        })
      } catch (injectErr: any) {
        const errMsg = injectErr?.message || String(injectErr)
        debugInfo.value += ` | executeScript failed: ${errMsg}`

        if (errMsg.includes('Cannot access') || errMsg.includes('not allowed') || errMsg.includes('permission')) {
          error.value = 'noPermission'
        } else if (errMsg.includes('no tab') || errMsg.includes('not found') || errMsg.includes('closed')) {
          error.value = 'tabClosed'
        } else {
          error.value = 'injectFailed'
        }
        headings.value = []
        return
      }

      // Retry after injection
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractHeadings' })

        if (response?.success) {
          headings.value = response.headings || []
          hasNoH1.value = response.hasNoH1 || false
          pageTitle.value = response.title || tab.title || ''
          pageUrl.value = response.url || tab.url || ''
          if (headings.value.length === 0) {
            error.value = 'noHeadings'
          }
        } else {
          error.value = 'extractFailed'
          headings.value = []
          debugInfo.value += ` | retry CS responded but failed: ${response?.error}`
        }
      } catch (retryErr: any) {
        debugInfo.value += ` | retry sendMessage failed: ${retryErr?.message || String(retryErr)}`
        error.value = 'extractFailed'
        headings.value = []
      }
    } catch (err: any) {
      debugInfo.value = `Unexpected error: ${err?.message || String(err)}`
      error.value = 'extractFailed'
      headings.value = []
    } finally {
      loading.value = false
    }
  }

  async function scrollToHeading(headingId: string) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
      if (tab?.id) {
        activeHeadingId.value = headingId
        await chrome.tabs.sendMessage(tab.id, { action: 'scrollToHeading', headingId })
      }
    } catch { /* ignore */ }
  }

  function clearHeadings() {
    headings.value = []
    error.value = ''
    pageTitle.value = ''
    pageUrl.value = ''
    activeHeadingId.value = ''
    debugInfo.value = ''
    hasNoH1.value = false
    searchQuery.value = ''
  }

  return {
    headings, loading, error, pageTitle, pageUrl, activeHeadingId, debugInfo,
    hasNoH1, searchQuery, tree, flatTree, stats,
    extractHeadings, scrollToHeading, clearHeadings,
    toggleNode, expandAll, collapseAll,
  }
})
