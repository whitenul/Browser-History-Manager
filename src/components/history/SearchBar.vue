<template>
  <div class="search-bar">
    <span class="i-lucide:search search-icon" />
    <input v-model="searchText" type="text" class="search-input" :placeholder="t('history.searchPlaceholder')" @input="handleSearch" />
    <button class="cmd-trigger" @click="openCommandPalette" :title="t('commandPalette.placeholder')">
      <span class="i-lucide:terminal" />
    </button>
    <button v-if="searchText" class="clear-btn" @click="handleClear">
      <span class="i-lucide:x" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useUIStore } from '@/stores/ui'
import { useI18n } from '@/i18n'

const emit = defineEmits<{
  search: [value: string]
  clear: []
}>()

const history = useHistoryStore()
const ui = useUIStore()
const { t } = useI18n()

const searchText = ref('')

watch(() => history.searchKeyword, (v) => {
  searchText.value = v
}, { immediate: true })

function handleSearch(e: Event) {
  const val = (e.target as HTMLInputElement).value
  history.setSearch(val)
  emit('search', val)
}

function openCommandPalette() {
  ui.showCommandPalette = true
}

function handleClear() {
  searchText.value = ''
  history.setSearchImmediate('')
  emit('clear')
}
</script>

<style scoped>
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
  transition: border-color var(--transition-hover), box-shadow var(--transition-hover);
}
.search-bar:focus-within {
  border-bottom-color: var(--color-primary);
  box-shadow: 0 1px 0 var(--color-primary);
}

.search-icon { color: var(--color-text-muted); font-size: var(--fs-xl); flex-shrink: 0; }

.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: var(--fs-lg);
  color: var(--color-text-primary);
}
.search-input::placeholder { color: var(--color-text-muted); }

.cmd-trigger {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border: 1px solid var(--color-border);
  background: var(--color-bg-surface); border-radius: var(--radius-sm);
  cursor: pointer; color: var(--color-text-muted); font-size: var(--fs-md);
  transition: all var(--transition-hover); flex-shrink: 0;
}
.cmd-trigger:hover { border-color: var(--color-primary); color: var(--color-primary); background: var(--color-primary-light); }

.clear-btn {
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border: none;
  background: var(--color-border); border-radius: 50%;
  cursor: pointer; color: var(--color-text-muted); font-size: var(--fs-md);
}
.clear-btn:hover { opacity: 0.8; }
</style>
