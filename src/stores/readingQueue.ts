import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { appCache } from '@/utils/cache'

export interface QueueItem {
  url: string
  title: string
  domain: string
  addedAt: number
  priority: number
  tags: string[]
}

const QUEUE_KEY = 'reading-queue'

export const useReadingQueueStore = defineStore('readingQueue', () => {
  const items = ref<QueueItem[]>([])

  const sortedItems = computed(() => {
    return [...items.value].sort((a, b) => {
      const pa = a.priority * 0.6 + (1 - Math.min(1, (Date.now() - a.addedAt) / (7 * 24 * 3600 * 1000))) * 0.4
      const pb = b.priority * 0.6 + (1 - Math.min(1, (Date.now() - b.addedAt) / (7 * 24 * 3600 * 1000))) * 0.4
      return pb - pa
    })
  })

  const count = computed(() => items.value.length)

  async function loadQueue() {
    try {
      const data = await appCache.get<QueueItem[]>(QUEUE_KEY)
      if (data) items.value = data
    } catch {}
  }

  async function saveQueue() {
    try {
      await appCache.set(QUEUE_KEY, items.value)
    } catch {}
  }

  function addToQueue(url: string, title: string, domain: string, tags: string[] = []) {
    if (items.value.some(i => i.url === url)) return
    const priority = computePriority(title, domain, tags)
    items.value.push({ url, title, domain, addedAt: Date.now(), priority, tags })
    saveQueue()
  }

  function removeFromQueue(url: string) {
    items.value = items.value.filter(i => i.url !== url)
    saveQueue()
  }

  function clearQueue() {
    items.value = []
    saveQueue()
  }

  function computePriority(title: string, domain: string, tags: string[]): number {
    let score = 0.5
    const ARTICLE_KEYWORDS = ['blog', 'article', 'post', 'doc', 'docs', 'tutorial', 'guide', 'how-to', '深度', '解析', '教程', '指南']
    const TECH_KEYWORDS = ['github', 'stackoverflow', 'mdn', 'dev.to', 'medium', 'juejin', 'zhihu', 'csdn']
    const titleLower = title.toLowerCase()

    ARTICLE_KEYWORDS.forEach(kw => { if (titleLower.includes(kw)) score += 0.1 })
    TECH_KEYWORDS.forEach(kw => { if (domain.includes(kw)) score += 0.15 })
    if (tags.includes('长文')) score += 0.1
    if (tags.includes('技术')) score += 0.1
    return Math.min(1, score)
  }

  function isInQueue(url: string): boolean {
    return items.value.some(i => i.url === url)
  }

  function toggleQueue(url: string, title: string, domain: string, tags: string[] = []) {
    if (isInQueue(url)) {
      removeFromQueue(url)
    } else {
      addToQueue(url, title, domain, tags)
    }
  }

  return {
    items, sortedItems, count,
    loadQueue, saveQueue,
    addToQueue, removeFromQueue, clearQueue,
    isInQueue, toggleQueue,
  }
})
