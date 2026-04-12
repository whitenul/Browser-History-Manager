import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface BookmarkNode {
  id: string
  title: string
  url?: string
  domain?: string
  children?: BookmarkNode[]
  isFolder: boolean
  parentId?: string
}

export const useBookmarksStore = defineStore('bookmarks', () => {
  const allBookmarks = ref<BookmarkNode[]>([])
  const searchKeyword = ref('')
  const isLoading = ref(false)
  const expandedFolders = ref<string[]>([])

  const expandedSet = computed(() => new Set(expandedFolders.value))

  const filteredBookmarks = computed(() => {
    if (!searchKeyword.value) return allBookmarks.value
    const kw = searchKeyword.value.toLowerCase()
    return filterBookmarks(allBookmarks.value, kw)
  })

  function filterBookmarks(nodes: BookmarkNode[], kw: string): BookmarkNode[] {
    const result: BookmarkNode[] = []
    for (const node of nodes) {
      if (node.title.toLowerCase().includes(kw) || node.url?.toLowerCase().includes(kw)) {
        result.push(node)
      } else if (node.children) {
        const filtered = filterBookmarks(node.children, kw)
        if (filtered.length > 0) {
          result.push({ ...node, children: filtered })
        }
      }
    }
    return result
  }

  function mapBookmarkNode(node: chrome.bookmarks.BookmarkTreeNode): BookmarkNode {
    let domain = ''
    if (node.url) {
      try { domain = new URL(node.url).hostname.replace(/^www\./, '') } catch {}
    }
    return {
      id: node.id,
      title: node.title || domain || 'bookmarks.unnamed',
      url: node.url,
      domain,
      isFolder: !node.url,
      children: node.children?.map(mapBookmarkNode),
      parentId: node.parentId,
    }
  }

  async function loadBookmarks() {
    isLoading.value = true
    try {
      const tree = await chrome.bookmarks.getTree()
      allBookmarks.value = tree[0]?.children?.map(mapBookmarkNode) || []
      const topIds = allBookmarks.value.filter(n => n.isFolder).map(n => n.id)
      expandedFolders.value = topIds
    } catch (e) {
      console.error('Failed to load bookmarks:', e)
    } finally {
      isLoading.value = false
    }
  }

  function toggleFolder(id: string) {
    const set = new Set(expandedFolders.value)
    if (set.has(id)) set.delete(id)
    else set.add(id)
    expandedFolders.value = Array.from(set)
  }

  async function deleteBookmark(id: string) {
    try {
      await chrome.bookmarks.remove(id)
      allBookmarks.value = removeNode(allBookmarks.value, id)
    } catch (e) {
      console.error('Failed to delete bookmark:', e)
    }
  }

  function removeNode(nodes: BookmarkNode[], id: string): BookmarkNode[] {
    return nodes.filter(n => {
      if (n.id === id) return false
      if (n.children) n.children = removeNode(n.children, id)
      return true
    })
  }

  function setSearch(kw: string) {
    searchKeyword.value = kw
  }

  return {
    allBookmarks, searchKeyword, isLoading, expandedFolders, expandedSet, filteredBookmarks,
    loadBookmarks, toggleFolder, deleteBookmark, setSearch,
  }
})
