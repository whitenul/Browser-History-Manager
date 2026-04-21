const MEMORY_MAX = 500
const MEMORY_TTL = 30 * 60 * 1000
const PERSIST_TTL = 60 * 60 * 1000

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>()

  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return undefined
    }
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry.data
  }

  set(key: string, data: T, ttl: number = MEMORY_TTL): void {
    if (this.cache.size >= MEMORY_MAX) {
      const first = this.cache.keys().next().value
      if (first) this.cache.delete(first)
    }
    this.cache.set(key, { data, timestamp: Date.now(), ttl })
  }

  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }
}

const memoryCache = new LRUCache<any>()

async function getPersisted<T>(key: string): Promise<T | undefined> {
  try {
    const result = await chrome.storage.local.get(`cache:${key}`)
    const entry = result[`cache:${key}`] as CacheEntry<T> | undefined
    if (!entry) return undefined
    if (Date.now() - entry.timestamp > PERSIST_TTL) {
      await chrome.storage.local.remove(`cache:${key}`)
      return undefined
    }
    return entry.data
  } catch {
    return undefined
  }
}

async function setPersisted<T>(key: string, data: T): Promise<void> {
  try {
    await chrome.storage.local.set({
      [`cache:${key}`]: { data, timestamp: Date.now() }
    })
  } catch { /* ignore */ }
}

export const appCache = {
  async get<T = any>(key: string, persistent = false): Promise<T | undefined> {
    const mem = memoryCache.get(key)
    if (mem !== undefined) return mem as T
    if (persistent) {
      const persisted = await getPersisted<T>(key)
      if (persisted !== undefined) {
        memoryCache.set(key, persisted)
        return persisted
      }
    }
    return undefined
  },

  async set<T = any>(key: string, data: T, persistent = false): Promise<void> {
    memoryCache.set(key, data)
    if (persistent) await setPersisted(key, data)
  },

  has(key: string): boolean {
    return memoryCache.has(key)
  },

  delete(key: string): void {
    memoryCache.delete(key)
  },

  clear(): void {
    memoryCache.clear()
  },
}
