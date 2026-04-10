/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface Chrome {
  history: {
    search(params: { text: string; startTime?: number; endTime?: number; maxResults?: number }): Promise<chrome.history.HistoryItem[]>
    deleteUrl(url: string): Promise<void>
    add(params: { url: string; lastVisitTime?: number }): Promise<void>
    getVisits(params: { url: string }): Promise<chrome.history.VisitItem[]>
  }
  storage: {
    local: {
      get(keys: string | string[]): Promise<Record<string, any>>
      set(items: Record<string, any>): Promise<void>
    }
  }
  bookmarks: {
    getTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]>
    search(query: string): Promise<chrome.bookmarks.BookmarkTreeNode[]>
    remove(id: string): Promise<void>
    create(bookmark: chrome.bookmarks.BookmarkCreateArg): Promise<chrome.bookmarks.BookmarkTreeNode>
  }
  tabs: {
    create(params: { url: string; active?: boolean }): Promise<chrome.tabs.Tab>
  }
  runtime: {
    lastError?: chrome.runtime.LastError
  }
}
