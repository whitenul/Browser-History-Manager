// src/composables/useKeyboardNavigation.ts
import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useUIStore } from '@/stores/ui'
import type { HistoryRecord } from '@/utils/helpers'

export function useKeyboardNavigation(visibleRecords: Ref<HistoryRecord[]>) {
  const history = useHistoryStore()
  const ui = useUIStore()

  const focusedIndex = ref(-1)

  function handleKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault()
      const input = document.querySelector('.search-input') as HTMLInputElement
      input?.focus()
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusedIndex.value = Math.min(focusedIndex.value + 1, visibleRecords.value.length - 1)
      scrollToFocused()
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusedIndex.value = Math.max(focusedIndex.value - 1, 0)
      scrollToFocused()
      return
    }

    if (e.key === 'Enter' && focusedIndex.value >= 0) {
      const record = visibleRecords.value[focusedIndex.value]
      if (record) history.openRecord(record.url)
      return
    }

    if (e.key === 'Delete' && focusedIndex.value >= 0) {
      const record = visibleRecords.value[focusedIndex.value]
      if (record) ui.openDeleteConfirm(record)
      return
    }
  }

  function scrollToFocused() {
    const el = document.querySelector('.record-item.focused') as HTMLElement
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  function resetFocusedIndex() {
    focusedIndex.value = -1
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
  })

  return {
    focusedIndex,
    resetFocusedIndex,
    scrollToFocused
  }
}
