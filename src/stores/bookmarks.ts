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

export interface BookmarkFolder {
  id: string
  title: string
  depth: number
}

function normalizeUrlForCompare(raw: string): string {
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
    return `${u.protocol}//${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}${u.search}${u.hash}`
  } catch { return raw }
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

  const bookmarkFolders = computed<BookmarkFolder[]>(() => {
    const folders: BookmarkFolder[] = []
    function collect(nodes: BookmarkNode[], depth: number) {
      for (const node of nodes) {
        if (node.isFolder) {
          folders.push({ id: node.id, title: node.title, depth })
          if (node.children) collect(node.children, depth + 1)
        }
      }
    }
    collect(allBookmarks.value, 0)
    return folders
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

  function isBookmarked(url: string): boolean {
    return findBookmarkByUrl(allBookmarks.value, url) !== null
  }

  function findBookmarkByUrl(nodes: BookmarkNode[], url: string): BookmarkNode | null {
    const normalized = normalizeUrlForCompare(url)
    for (const node of nodes) {
      if (node.url && normalizeUrlForCompare(node.url) === normalized) return node
      if (node.children) {
        const found = findBookmarkByUrl(node.children, url)
        if (found) return found
      }
    }
    return null
  }

  async function addBookmark(url: string, title: string, parentId?: string): Promise<BookmarkNode | null> {
    try {
      const createOpts: { url: string; title: string; parentId?: string } = { url, title }
      if (parentId) createOpts.parentId = parentId
      const result = await chrome.bookmarks.create(createOpts)
      await loadBookmarks()
      return mapBookmarkNode(result)
    } catch (e) {
      console.error('Failed to add bookmark:', e)
      return null
    }
  }

  async function removeBookmarkByUrl(url: string): Promise<boolean> {
    const existing = findBookmarkByUrl(allBookmarks.value, url)
    if (existing) {
      await deleteBookmark(existing.id)
      return true
    }
    return false
  }

  async function renameBookmark(id: string, newTitle: string): Promise<boolean> {
    try {
      await chrome.bookmarks.update(id, { title: newTitle })
      updateNodeTitle(allBookmarks.value, id, newTitle)
      return true
    } catch (e) {
      console.error('Failed to rename bookmark:', e)
      return false
    }
  }

  function updateNodeTitle(nodes: BookmarkNode[], id: string, newTitle: string): boolean {
    for (const node of nodes) {
      if (node.id === id) {
        node.title = newTitle
        return true
      }
      if (node.children && updateNodeTitle(node.children, id, newTitle)) return true
    }
    return false
  }

  async function moveBookmark(id: string, newParentId: string): Promise<boolean> {
    try {
      await chrome.bookmarks.move(id, { parentId: newParentId })
      await loadBookmarks()
      return true
    } catch (e) {
      console.error('Failed to move bookmark:', e)
      return false
    }
  }

  async function createFolder(title: string, parentId: string): Promise<BookmarkNode | null> {
    try {
      const result = await chrome.bookmarks.create({ title, parentId })
      await loadBookmarks()
      return mapBookmarkNode(result)
    } catch (e) {
      console.error('Failed to create folder:', e)
      return null
    }
  }

  function setSearch(kw: string) {
    searchKeyword.value = kw
  }

  return {
    allBookmarks, searchKeyword, isLoading, expandedFolders, expandedSet, filteredBookmarks,
    bookmarkFolders,
    loadBookmarks, toggleFolder, deleteBookmark, setSearch,
    isBookmarked, addBookmark, removeBookmarkByUrl, findBookmarkByUrl,
    renameBookmark, moveBookmark, createFolder,
  }
})
