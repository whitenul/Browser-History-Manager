import { useUIStore } from '@/stores/ui'

export function handleActionError(error: unknown, context: string, silent = false) {
  if (!silent) {
    console.error(`[${context}]`, error)
  }
  try {
    const ui = useUIStore()
    const msg = error instanceof Error ? error.message : String(error)
    ui.notify(`${context}: ${msg}`, 'error')
  } catch {}
}

export function handleStorageError(error: unknown, key: string) {
  console.warn(`[Storage:${key}]`, error)
}
