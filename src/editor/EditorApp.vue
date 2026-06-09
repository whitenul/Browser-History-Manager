<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useUserScriptsStore, type UserScript } from '@/stores/userScripts'
import { useThemeStore } from '@/stores/theme'
import { useI18n } from '@/i18n'
import CodeEditor from '@/components/common/CodeEditor.vue'
import { EDITOR_THEMES, type EditorTheme } from '@/components/common/editorThemes'

const store = useUserScriptsStore()
const themeStore = useThemeStore()
const { t, locale } = useI18n()

type TabState = {
  id: string
  name: string
  code: string
  isDirty: boolean
  scrollTop: number
  isCreating: boolean
  activeView: 'code' | 'settings'
}

const scripts = ref<UserScript[]>([])
const selectedId = ref<string | null>(null)
const editorCode = ref('')
const isDirty = ref(false)
const showDeleteConfirm = ref(false)
const searchQuery = ref('')
const isCreating = ref(false)
const tabSize = ref(2)
const wordWrap = ref(false)
const cursorInfo = ref({ line: 1, col: 1, selected: 0 })
const showSettings = ref(false)
const activeEditorTab = ref<'code' | 'settings'>('code')
const newMatchItem = ref('')
const newIncludeItem = ref('')
const newExcludeItem = ref('')
const newRequireItem = ref('')
const showGrantDropdown = ref(false)
const editorThemeId = ref<EditorTheme>('oneDark')
const autoSaveEnabled = ref(true)
const autoSaveStatus = ref('')
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

const openTabs = ref<TabState[]>([])
const activeTabId = ref<string | null>(null)
const tabBarRef = ref<HTMLElement | null>(null)
const MAX_TABS = 15

const activeTab = computed(() =>
  openTabs.value.find(t => t.id === activeTabId.value) || null
)

const isDarkEditor = computed(() => {
  return EDITOR_THEMES.find(th => th.id === editorThemeId.value)?.isDark ?? true
})

const filteredScripts = computed(() => {
  if (!searchQuery.value) return scripts.value
  const q = searchQuery.value.toLowerCase()
  return scripts.value.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.match.some(m => m.toLowerCase().includes(q)) ||
    s.description.toLowerCase().includes(q)
  )
})

const selectedScript = computed(() =>
  scripts.value.find(s => s.id === selectedId.value) || null
)

const parsedMetadata = computed(() => {
  if (!editorCode.value) return null
  const code = editorCode.value
  const headerMatch = code.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/)
  if (!headerMatch) return null
  const header = headerMatch[1]
  const meta: Record<string, string[]> = {}
  const lineRegex = /\/\/\s*@(\S+)\s+(.+)/g
  let m
  while ((m = lineRegex.exec(header)) !== null) {
    const key = m[1]
    const val = m[2].trim()
    if (!meta[key]) meta[key] = []
    meta[key].push(val)
  }
  return meta
})

const GM_APIS = [
  'GM_info', 'GM_getValue', 'GM_setValue', 'GM_deleteValue', 'GM_listValues',
  'GM_addStyle', 'GM_removeStyle', 'GM_openInTab', 'GM_setClipboard',
  'GM_notification', 'GM_xmlhttpRequest', 'GM_download', 'GM_getResourceText',
  'GM_getResourceURL', 'GM_registerMenuCommand', 'GM_unregisterMenuCommand',
  'GM_log', 'GM_addValueChangeListener', 'GM_removeValueChangeListener',
  'unsafeWindow', 'window.close', 'window.focus', 'window.onurlchange'
]

const RUN_AT_OPTIONS = ['document-start', 'document-body', 'document-end', 'document-idle']

const metaName = computed({
  get: () => parsedMetadata.value?.name?.[0] || '',
  set: (v: string) => updateMetadataField('name', [v])
})
const metaDescription = computed({
  get: () => parsedMetadata.value?.description?.[0] || '',
  set: (v: string) => updateMetadataField('description', [v])
})
const metaVersion = computed({
  get: () => parsedMetadata.value?.version?.[0] || '',
  set: (v: string) => updateMetadataField('version', [v])
})
const metaRunAt = computed({
  get: () => parsedMetadata.value?.['run-at']?.[0] || 'document-idle',
  set: (v: string) => updateMetadataField('run-at', [v])
})
const metaMatch = computed(() => parsedMetadata.value?.match || [])
const metaInclude = computed(() => parsedMetadata.value?.include || [])
const metaExclude = computed(() => parsedMetadata.value?.exclude || [])
const metaRequire = computed(() => parsedMetadata.value?.require || [])
const metaGrant = computed(() => parsedMetadata.value?.grant || [])

watch(activeEditorTab, () => { showGrantDropdown.value = false })

function updateMetadataField(key: string, values: string[]) {
  const code = editorCode.value
  if (!code.match(/\/\/\s*==UserScript==/)) return
  const meta: Record<string, string[]> = {}
  const keyOrder: string[] = []
  const lineRegex = /\/\/\s*@(\S+)\s+(.+)/g
  let m
  while ((m = lineRegex.exec(code)) !== null) {
    const k = m[1]
    const v = m[2].trim()
    if (!meta[k]) { meta[k] = []; keyOrder.push(k) }
    meta[k].push(v)
  }
  if (values.length > 0) {
    meta[key] = values
    if (!keyOrder.includes(key)) keyOrder.push(key)
  } else {
    delete meta[key]
    const idx = keyOrder.indexOf(key)
    if (idx >= 0) keyOrder.splice(idx, 1)
  }
  const headerLines = keyOrder.flatMap(k => meta[k].map(v => `// @${k} ${v}`))
  const newHeader = `// ==UserScript==\n${headerLines.join('\n')}\n// ==/UserScript==`
  editorCode.value = code.replace(/\/\/\s*==UserScript==[\s\S]*?\/\/\s*==\/UserScript==/, newHeader)
  isDirty.value = true
  if (activeTab.value) activeTab.value.isDirty = true
  scheduleAutoSave()
}

function addMetadataItem(key: string, value: string) {
  if (!value.trim()) return
  const current = parsedMetadata.value?.[key] || []
  updateMetadataField(key, [...current, value.trim()])
}

function removeMetadataItem(key: string, index: number) {
  const current = parsedMetadata.value?.[key] || []
  updateMetadataField(key, current.filter((_, i) => i !== index))
}

function toggleGrantApi(api: string) {
  const current = parsedMetadata.value?.grant || []
  if (api === 'none') {
    updateMetadataField('grant', ['none'])
    return
  }
  const filtered = current.filter(g => g !== 'none')
  if (filtered.includes(api)) {
    const updated = filtered.filter(g => g !== api)
    updateMetadataField('grant', updated.length > 0 ? updated : ['none'])
  } else {
    updateMetadataField('grant', [...filtered, api])
  }
}

function removeGrantItem(api: string) {
  const current = parsedMetadata.value?.grant || []
  const updated = current.filter(g => g !== api)
  updateMetadataField('grant', updated.length > 0 ? updated : ['none'])
}

function syncToActiveTab() {
  const tab = openTabs.value.find(t => t.id === activeTabId.value)
  if (!tab) return
  tab.code = editorCode.value
  tab.isDirty = isDirty.value
  tab.isCreating = isCreating.value
  tab.activeView = activeEditorTab.value
}

function switchToTab(tabId: string) {
  if (tabId === activeTabId.value) return
  syncToActiveTab()
  activeTabId.value = tabId
  const tab = activeTab.value
  if (tab) {
    selectedId.value = tab.isCreating ? null : tab.id
    editorCode.value = tab.code
    isDirty.value = tab.isDirty
    isCreating.value = tab.isCreating
    activeEditorTab.value = tab.activeView
  }
  nextTick(scrollToActiveTab)
}

function closeTab(tabId: string) {
  const tab = openTabs.value.find(t => t.id === tabId)
  if (!tab) return
  if (tab.isDirty) {
    if (!confirm(t('userscripts.closeTabConfirm'))) return
  }
  const idx = openTabs.value.findIndex(t => t.id === tabId)
  openTabs.value.splice(idx, 1)
  if (activeTabId.value === tabId) {
    if (openTabs.value.length > 0) {
      const newIdx = Math.min(idx, openTabs.value.length - 1)
      activeTabId.value = openTabs.value[newIdx].id
      const newTab = openTabs.value[newIdx]
      selectedId.value = newTab.isCreating ? null : newTab.id
      editorCode.value = newTab.code
      isDirty.value = newTab.isDirty
      isCreating.value = newTab.isCreating
      activeEditorTab.value = newTab.activeView
    } else {
      activeTabId.value = null
      selectedId.value = null
      editorCode.value = ''
      isDirty.value = false
      isCreating.value = false
    }
  }
}

function closeOtherTabs(tabId: string) {
  const tab = openTabs.value.find(t => t.id === tabId)
  if (!tab) return
  const dirtyOthers = openTabs.value.filter(t => t.id !== tabId && t.isDirty)
  if (dirtyOthers.length > 0) {
    if (!confirm(t('userscripts.closeTabConfirm'))) return
  }
  openTabs.value = [tab]
  activeTabId.value = tabId
  selectedId.value = tab.isCreating ? null : tab.id
  editorCode.value = tab.code
  isDirty.value = tab.isDirty
  isCreating.value = tab.isCreating
  activeEditorTab.value = tab.activeView
}

function scrollToActiveTab() {
  if (!tabBarRef.value) return
  const activeEl = tabBarRef.value.querySelector('.ea-script-tab--active')
  if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
}

onMounted(async () => {
  await themeStore.loadTheme()
  await store.loadScripts()
  scripts.value = [...store.scripts]
  if (scripts.value.length > 0) {
    selectScript(scripts.value[0])
  } else {
    createNew()
  }

  window.addEventListener('keydown', handleKeyboard)
  window.addEventListener('blur', handleWindowBlur)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyboard)
  window.removeEventListener('blur', handleWindowBlur)
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
})

function handleWindowBlur() {
  if (isDirty.value && autoSaveEnabled.value && (selectedId.value || isCreating.value)) {
    saveCurrent()
    flashAutoSave()
  }
}

function scheduleAutoSave() {
  if (!autoSaveEnabled.value) return
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => {
    if (isDirty.value && (selectedId.value || isCreating.value)) {
      saveCurrent()
      flashAutoSave()
    }
  }, 3000)
}

function flashAutoSave() {
  autoSaveStatus.value = t('userscripts.autoSaved')
  setTimeout(() => { autoSaveStatus.value = '' }, 2000)
}

function handleKeyboard(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    saveCurrent()
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault()
    createNew()
  }
  if (e.ctrlKey && !e.shiftKey && e.key === 'Tab') {
    e.preventDefault()
    const idx = openTabs.value.findIndex(t => t.id === activeTabId.value)
    if (openTabs.value.length > 1) {
      const nextIdx = (idx + 1) % openTabs.value.length
      switchToTab(openTabs.value[nextIdx].id)
    }
  }
  if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
    e.preventDefault()
    const idx = openTabs.value.findIndex(t => t.id === activeTabId.value)
    if (openTabs.value.length > 1) {
      const prevIdx = (idx - 1 + openTabs.value.length) % openTabs.value.length
      switchToTab(openTabs.value[prevIdx].id)
    }
  }
  if (e.altKey && e.key === 'ArrowRight') {
    e.preventDefault()
    const idx = openTabs.value.findIndex(t => t.id === activeTabId.value)
    if (openTabs.value.length > 1) {
      const nextIdx = (idx + 1) % openTabs.value.length
      switchToTab(openTabs.value[nextIdx].id)
    }
  }
  if (e.altKey && e.key === 'ArrowLeft') {
    e.preventDefault()
    const idx = openTabs.value.findIndex(t => t.id === activeTabId.value)
    if (openTabs.value.length > 1) {
      const prevIdx = (idx - 1 + openTabs.value.length) % openTabs.value.length
      switchToTab(openTabs.value[prevIdx].id)
    }
  }
}

function selectScript(script: UserScript) {
  const existingTab = openTabs.value.find(t => t.id === script.id)
  if (existingTab) {
    switchToTab(script.id)
    return
  }
  if (openTabs.value.length >= MAX_TABS) {
    if (!confirm(t('userscripts.closeTabConfirm'))) return
    const oldest = openTabs.value.find(t => !t.isDirty)
    if (oldest) closeTab(oldest.id)
    else return
  }
  syncToActiveTab()
  const tab: TabState = {
    id: script.id,
    name: script.name,
    code: script.code,
    isDirty: false,
    scrollTop: 0,
    isCreating: false,
    activeView: 'code',
  }
  openTabs.value.push(tab)
  activeTabId.value = tab.id
  selectedId.value = script.id
  editorCode.value = script.code
  isDirty.value = false
  isCreating.value = false
  activeEditorTab.value = 'code'
  nextTick(scrollToActiveTab)
}

function createNew() {
  const existingNewTab = openTabs.value.find(t => t.isCreating && !t.isDirty)
  if (existingNewTab) {
    switchToTab(existingNewTab.id)
    return
  }
  if (openTabs.value.length >= MAX_TABS) {
    const oldest = openTabs.value.find(t => !t.isDirty)
    if (oldest) closeTab(oldest.id)
    else return
  }
  syncToActiveTab()
  const newId = `__new__${Date.now()}`
  const defaultCode = `// ==UserScript==
// @name        New Script
// @namespace   hmm
// @match       *://*/*
// @run-at      document-idle
// @grant       none
// @description My custom script
// ==/UserScript==

(function() {
  'use strict';
  // Your code here...
})();`
  const tab: TabState = {
    id: newId,
    name: 'New Script',
    code: defaultCode,
    isDirty: false,
    scrollTop: 0,
    isCreating: true,
    activeView: 'code',
  }
  openTabs.value.push(tab)
  activeTabId.value = newId
  selectedId.value = null
  editorCode.value = defaultCode
  isDirty.value = false
  isCreating.value = true
  activeEditorTab.value = 'code'
  nextTick(scrollToActiveTab)
}

async function saveCurrent() {
  if (isCreating.value) {
    const script = await store.addScript(editorCode.value)
    await store.loadScripts()
    scripts.value = [...store.scripts]
    const oldId = activeTabId.value
    const tab = openTabs.value.find(t => t.id === oldId)
    if (tab) {
      tab.id = script.id
      tab.name = script.name
      tab.isCreating = false
      tab.isDirty = false
    }
    activeTabId.value = script.id
    selectedId.value = script.id
    isCreating.value = false
  } else if (selectedId.value) {
    await store.updateScript(selectedId.value, editorCode.value)
    await store.loadScripts()
    scripts.value = [...store.scripts]
    const tab = openTabs.value.find(t => t.id === selectedId.value)
    if (tab) {
      tab.name = selectedScript.value?.name || tab.name
      tab.isDirty = false
    }
  }
  isDirty.value = false
}

async function deleteCurrent() {
  if (!selectedId.value) return
  const delId = selectedId.value
  await store.removeScript(delId)
  await store.loadScripts()
  scripts.value = [...store.scripts]
  const idx = openTabs.value.findIndex(t => t.id === delId)
  if (idx >= 0) openTabs.value.splice(idx, 1)
  if (openTabs.value.length > 0) {
    const newIdx = Math.min(idx, openTabs.value.length - 1)
    const newTab = openTabs.value[newIdx]
    activeTabId.value = newTab.id
    selectedId.value = newTab.isCreating ? null : newTab.id
    editorCode.value = newTab.code
    isDirty.value = newTab.isDirty
    isCreating.value = newTab.isCreating
    activeEditorTab.value = newTab.activeView
  } else {
    activeTabId.value = null
    selectedId.value = null
    editorCode.value = ''
    isDirty.value = false
    isCreating.value = false
  }
  showDeleteConfirm.value = false
}

async function toggleCurrent() {
  if (!selectedId.value) return
  await store.toggleScript(selectedId.value)
  await store.loadScripts()
  scripts.value = [...store.scripts]
}

function onCodeChange(code: string) {
  editorCode.value = code
  isDirty.value = true
  if (activeTab.value) {
    activeTab.value.isDirty = true
    activeTab.value.code = code
  }
  scheduleAutoSave()
}

function onCursorChange(info: { line: number; col: number; selected: number }) {
  cursorInfo.value = info
}

function exportScript() {
  const code = editorCode.value
  if (!code) return
  const blob = new Blob([code], { type: 'text/javascript' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const name = selectedScript.value?.name || 'script'
  a.download = `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}.user.js`
  a.click()
  URL.revokeObjectURL(url)
}

function importScript() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.js,.user.js'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const text = await file.text()
    if (openTabs.value.length >= MAX_TABS) {
      const oldest = openTabs.value.find(t => !t.isDirty)
      if (oldest) closeTab(oldest.id)
      else return
    }
    syncToActiveTab()
    const newId = `__new__${Date.now()}`
    const nameMatch = text.match(/\/\/\s*@name\s+(.+)/)
    const tabName = nameMatch ? nameMatch[1].trim() : 'Imported Script'
    const tab: TabState = {
      id: newId,
      name: tabName,
      code: text,
      isDirty: true,
      scrollTop: 0,
      isCreating: true,
      activeView: 'code',
    }
    openTabs.value.push(tab)
    activeTabId.value = newId
    selectedId.value = null
    editorCode.value = text
    isDirty.value = true
    isCreating.value = true
    activeEditorTab.value = 'code'
    nextTick(scrollToActiveTab)
  }
  input.click()
}

function getRunAtLabel(runAt: string): string {
  const labels: Record<string, string> = {
    'document-start': 'start',
    'document-body': 'body',
    'document-end': 'end',
    'document-idle': 'idle',
  }
  return labels[runAt] || 'idle'
}

function formatTimestamp(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function getThemeLabel(th: typeof EDITOR_THEMES[number]): string {
  return locale.value === 'zh-CN' ? th.labelZh : th.label
}
</script>

<template>
  <div class="ea-root">
    <div class="ea-sidebar">
      <div class="ea-sidebar-header">
        <span class="i-lucide:code-2 ea-logo" />
        <span class="ea-sidebar-title">{{ t('userscripts.title') }}</span>
        <span class="ea-count">{{ scripts.length }}</span>
        <div class="ea-sidebar-actions">
          <button class="ea-icon-btn" @click="createNew" :title="t('userscripts.add') + ' (Ctrl+N)'">
            <span class="i-lucide:file-plus" />
          </button>
          <button class="ea-icon-btn" @click="importScript" :title="t('userscripts.import')">
            <span class="i-lucide:upload" />
          </button>
        </div>
      </div>
      <div class="ea-search">
        <span class="i-lucide:search ea-search-icon" />
        <input v-model="searchQuery" class="ea-search-input" :placeholder="t('userscripts.search')" />
      </div>
      <div class="ea-script-list">
        <div
          v-for="script in filteredScripts"
          :key="script.id"
          class="ea-script-item"
          :class="{ 'ea-script-item--active': script.id === activeTabId, 'ea-script-item--disabled': !script.enabled }"
          @click="selectScript(script)"
        >
          <div class="ea-script-dot" :class="script.enabled ? 'ea-script-dot--on' : 'ea-script-dot--off'" />
          <div class="ea-script-info">
            <div class="ea-script-name">{{ script.name }}</div>
            <div class="ea-script-match">{{ script.match.join(', ') }}</div>
          </div>
          <span v-if="script.runAt && script.runAt !== 'document-idle'" class="ea-script-runat">@{{ getRunAtLabel(script.runAt) }}</span>
        </div>
        <div v-if="filteredScripts.length === 0" class="ea-empty-list">
          {{ t('userscripts.empty') }}
        </div>
      </div>
    </div>

    <div class="ea-main">
      <div class="ea-toolbar">
        <div class="ea-toolbar-left">
          <span class="ea-script-title">{{ selectedScript?.name || (isCreating ? t('userscripts.newScript') : '') }}</span>
          <span v-if="isDirty" class="ea-dirty-dot" :title="t('userscripts.unsaved')" />
          <span v-if="selectedScript" class="ea-status-badge" :class="selectedScript.enabled ? 'ea-status-badge--on' : 'ea-status-badge--off'">
            {{ selectedScript.enabled ? t('userscripts.enable') : t('userscripts.disable') }}
          </span>
        </div>
        <div class="ea-toolbar-right">
          <button v-if="selectedScript" class="ea-tool-btn" @click="toggleCurrent" :title="selectedScript.enabled ? t('userscripts.disable') : t('userscripts.enable')">
            <span :class="selectedScript.enabled ? 'i-lucide:power' : 'i-lucide:power-off'" />
          </button>
          <button class="ea-tool-btn" @click="exportScript" :title="t('userscripts.export')">
            <span class="i-lucide:download" />
          </button>
          <button v-if="selectedId" class="ea-tool-btn ea-tool-btn--danger" @click="showDeleteConfirm = true" :title="t('userscripts.delete')">
            <span class="i-lucide:trash-2" />
          </button>
          <div class="ea-toolbar-sep" />
          <button class="ea-tool-btn" :class="{ 'ea-tool-btn--active': wordWrap }" @click="wordWrap = !wordWrap" :title="t('userscripts.wordWrap')">
            <span class="i-lucide:wrap-text" />
          </button>
          <button class="ea-tool-btn" :class="{ 'ea-tool-btn--active': showSettings }" @click="showSettings = !showSettings" :title="t('userscripts.editorSettings')">
            <span class="i-lucide:settings-2" />
          </button>
          <div class="ea-toolbar-sep" />
          <button class="ea-save-btn" @click="saveCurrent" :disabled="!isDirty && !isCreating">
            <span class="i-lucide:save" />{{ t('userscripts.save') }}
            <span class="ea-save-shortcut">Ctrl+S</span>
          </button>
        </div>
      </div>

      <div class="ea-editor-tabs">
        <button class="ea-editor-tab" :class="{ 'ea-editor-tab--active': activeEditorTab === 'code' }" @click="activeEditorTab = 'code'">
          <span class="i-lucide:code-2" /> {{ t('userscripts.code') }}
        </button>
        <button class="ea-editor-tab" :class="{ 'ea-editor-tab--active': activeEditorTab === 'settings' }" @click="activeEditorTab = 'settings'">
          <span class="i-lucide:settings-2" /> {{ t('userscripts.settings') }}
        </button>
      </div>

      <div class="ea-script-tabs" ref="tabBarRef">
        <div
          v-for="tab in openTabs"
          :key="tab.id"
          class="ea-script-tab"
          :class="{ 'ea-script-tab--active': tab.id === activeTabId }"
          @click="switchToTab(tab.id)"
          @mousedown.middle.prevent="closeTab(tab.id)"
          @contextmenu.prevent="closeOtherTabs(tab.id)"
        >
          <span class="ea-script-tab-name">{{ tab.name }}</span>
          <span v-if="tab.isDirty" class="ea-script-tab-dot" />
          <button class="ea-script-tab-close" @click.stop="closeTab(tab.id)" :title="t('userscripts.closeTab')">
            <span class="i-lucide:x" />
          </button>
        </div>
      </div>

      <div class="ea-body">
        <div v-if="openTabs.length === 0" class="ea-empty-editor">
          <span class="i-lucide:file-code ea-empty-editor-icon" />
          <p>{{ t('userscripts.noOpenTabs') }}</p>
          <button class="ea-empty-editor-btn" @click="createNew">
            <span class="i-lucide:plus" /> {{ t('userscripts.add') }}
          </button>
        </div>
        <template v-else>
          <div v-show="activeEditorTab === 'code'" class="ea-editor-area">
            <CodeEditor
              :model-value="editorCode"
              :dark="isDarkEditor"
              :tab-size="tabSize"
              :word-wrap="wordWrap"
              :editor-theme="editorThemeId"
              @update:model-value="onCodeChange"
              @cursor-change="onCursorChange"
            />
          </div>

          <Transition name="ea-slide">
            <div v-if="showSettings && activeEditorTab === 'code'" class="ea-settings-panel">
              <div class="ea-settings-title">
                <span class="i-lucide:settings-2" /> {{ t('userscripts.editorSettings') }}
              </div>
              <div class="ea-settings-group">
                <label class="ea-settings-label">{{ t('userscripts.tabSize') }}</label>
                <div class="ea-tab-sizes">
                  <button v-for="s in [2, 4, 8]" :key="s"
                    class="ea-tab-btn" :class="{ 'ea-tab-btn--active': tabSize === s }"
                    @click="tabSize = s">{{ s }}</button>
                </div>
              </div>
              <div class="ea-settings-group">
                <label class="ea-settings-label">{{ t('userscripts.wordWrap') }}</label>
                <button class="ea-toggle" :class="{ 'ea-toggle--on': wordWrap }" @click="wordWrap = !wordWrap">
                  <span class="ea-toggle-thumb" />
                </button>
              </div>
              <div class="ea-settings-group">
                <label class="ea-settings-label">{{ t('userscripts.autoSave') }}</label>
                <button class="ea-toggle" :class="{ 'ea-toggle--on': autoSaveEnabled }" @click="autoSaveEnabled = !autoSaveEnabled">
                  <span class="ea-toggle-thumb" />
                </button>
              </div>
              <div class="ea-settings-group">
                <label class="ea-settings-label">{{ t('userscripts.editorTheme') }}</label>
                <div class="ea-theme-grid">
                  <button v-for="th in EDITOR_THEMES" :key="th.id"
                    class="ea-theme-btn" :class="{ 'ea-theme-btn--active': editorThemeId === th.id }"
                    @click="editorThemeId = th.id">
                    <span class="ea-theme-preview" :class="th.isDark ? 'ea-theme-preview--dark' : 'ea-theme-preview--light'" />
                    <span class="ea-theme-name">{{ getThemeLabel(th) }}</span>
                  </button>
                </div>
              </div>
              <div v-if="parsedMetadata" class="ea-settings-group ea-metadata-group">
                <label class="ea-settings-label">{{ t('userscripts.scriptMetadata') }}</label>
                <div class="ea-metadata-list">
                  <div v-for="(values, key) in parsedMetadata" :key="key" class="ea-metadata-item">
                    <span class="ea-meta-key">@{{ key }}</span>
                    <span class="ea-meta-val">{{ values.join(', ') }}</span>
                  </div>
                </div>
              </div>
            </div>
          </Transition>

          <div v-if="activeEditorTab === 'settings'" class="ea-meta-panel">
            <div v-if="!parsedMetadata" class="ea-meta-empty">
              <span class="i-lucide:file-x" />
              <p>{{ t('userscripts.noHeader') }}</p>
            </div>
            <template v-else>
              <div class="ea-meta-field">
                <label class="ea-meta-label">@name</label>
                <input v-model="metaName" class="ea-meta-input" />
              </div>
              <div class="ea-meta-field">
                <label class="ea-meta-label">@description</label>
                <input v-model="metaDescription" class="ea-meta-input" />
              </div>
              <div class="ea-meta-field">
                <label class="ea-meta-label">@version</label>
                <input v-model="metaVersion" class="ea-meta-input" />
              </div>
              <div class="ea-meta-field">
                <label class="ea-meta-label">@match</label>
                <div class="ea-meta-list">
                  <div v-for="(item, i) in metaMatch" :key="i" class="ea-meta-list-item">
                    <span>{{ item }}</span>
                    <button class="ea-meta-list-del" @click="removeMetadataItem('match', i)"><span class="i-lucide:x" /></button>
                  </div>
                  <div class="ea-meta-list-add">
                    <input v-model="newMatchItem" class="ea-meta-input ea-meta-input--sm" @keydown.enter="addMetadataItem('match', newMatchItem); newMatchItem = ''" />
                    <button class="ea-meta-add-btn" @click="addMetadataItem('match', newMatchItem); newMatchItem = ''"><span class="i-lucide:plus" /></button>
                  </div>
                </div>
              </div>
              <div class="ea-meta-field">
                <label class="ea-meta-label">@include</label>
                <div class="ea-meta-list">
                  <div v-for="(item, i) in metaInclude" :key="i" class="ea-meta-list-item">
                    <span>{{ item }}</span>
                    <button class="ea-meta-list-del" @click="removeMetadataItem('include', i)"><span class="i-lucide:x" /></button>
                  </div>
                  <div class="ea-meta-list-add">
                    <input v-model="newIncludeItem" class="ea-meta-input ea-meta-input--sm" @keydown.enter="addMetadataItem('include', newIncludeItem); newIncludeItem = ''" />
                    <button class="ea-meta-add-btn" @click="addMetadataItem('include', newIncludeItem); newIncludeItem = ''"><span class="i-lucide:plus" /></button>
                  </div>
                </div>
              </div>
              <div class="ea-meta-field">
                <label class="ea-meta-label">@exclude</label>
                <div class="ea-meta-list">
                  <div v-for="(item, i) in metaExclude" :key="i" class="ea-meta-list-item">
                    <span>{{ item }}</span>
                    <button class="ea-meta-list-del" @click="removeMetadataItem('exclude', i)"><span class="i-lucide:x" /></button>
                  </div>
                  <div class="ea-meta-list-add">
                    <input v-model="newExcludeItem" class="ea-meta-input ea-meta-input--sm" @keydown.enter="addMetadataItem('exclude', newExcludeItem); newExcludeItem = ''" />
                    <button class="ea-meta-add-btn" @click="addMetadataItem('exclude', newExcludeItem); newExcludeItem = ''"><span class="i-lucide:plus" /></button>
                  </div>
                </div>
              </div>
              <div class="ea-meta-field">
                <label class="ea-meta-label">@run-at</label>
                <select v-model="metaRunAt" class="ea-meta-select">
                  <option v-for="opt in RUN_AT_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
                </select>
              </div>
              <div class="ea-meta-field">
                <label class="ea-meta-label">@grant</label>
                <div class="ea-grant-area">
                  <div class="ea-grant-tags">
                    <span v-for="g in metaGrant" :key="g" class="ea-grant-tag">
                      {{ g }}
                      <button class="ea-grant-tag-x" @click="removeGrantItem(g)"><span class="i-lucide:x" /></button>
                    </span>
                  </div>
                  <div class="ea-grant-select-wrap">
                    <button class="ea-grant-select-btn" @click="showGrantDropdown = !showGrantDropdown">
                      <span class="i-lucide:plus" style="font-size:12px" /> {{ t('common.add') }}
                    </button>
                    <div v-if="showGrantDropdown" class="ea-grant-dropdown">
                      <label class="ea-grant-option ea-grant-option--none">
                        <input type="checkbox" :checked="metaGrant.includes('none')" @change="toggleGrantApi('none')" />
                        <span>none</span>
                      </label>
                      <label v-for="api in GM_APIS" :key="api" class="ea-grant-option">
                        <input type="checkbox" :checked="metaGrant.includes(api)" @change="toggleGrantApi(api)" />
                        <span>{{ api }}</span>
                      </label>
                    </div>
                  </div>
                  <div v-if="showGrantDropdown" class="ea-grant-overlay" @click="showGrantDropdown = false" />
                </div>
              </div>
              <div class="ea-meta-field">
                <label class="ea-meta-label">@require</label>
                <div class="ea-meta-list">
                  <div v-for="(item, i) in metaRequire" :key="i" class="ea-meta-list-item">
                    <span>{{ item }}</span>
                    <button class="ea-meta-list-del" @click="removeMetadataItem('require', i)"><span class="i-lucide:x" /></button>
                  </div>
                  <div class="ea-meta-list-add">
                    <input v-model="newRequireItem" class="ea-meta-input ea-meta-input--sm" @keydown.enter="addMetadataItem('require', newRequireItem); newRequireItem = ''" />
                    <button class="ea-meta-add-btn" @click="addMetadataItem('require', newRequireItem); newRequireItem = ''"><span class="i-lucide:plus" /></button>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </template>
      </div>

      <div class="ea-footer">
        <div class="ea-footer-left">
          <span class="ea-footer-item">
            <span class="i-lucide:map-pin" style="font-size:11px" />
            Ln {{ cursorInfo.line }}, Col {{ cursorInfo.col }}
          </span>
          <span v-if="cursorInfo.selected > 0" class="ea-footer-item ea-footer-selected">
            ({{ cursorInfo.selected }} {{ t('userscripts.selected') }})
          </span>
          <Transition name="ea-fade">
            <span v-if="autoSaveStatus" class="ea-footer-item ea-footer-autosave">{{ autoSaveStatus }}</span>
          </Transition>
        </div>
        <div class="ea-footer-right">
          <span class="ea-footer-item">{{ editorCode.split('\n').length }} {{ t('userscripts.lines') }}</span>
          <span class="ea-footer-item">{{ editorCode.length }} {{ t('userscripts.chars') }}</span>
          <span class="ea-footer-item">{{ t('userscripts.spaces') }}: {{ tabSize }}</span>
          <span class="ea-footer-item">UTF-8</span>
          <span v-if="selectedScript" class="ea-footer-item">{{ formatTimestamp(selectedScript.updatedAt) }}</span>
        </div>
      </div>
    </div>

    <Transition name="ea-fade">
      <div v-if="showDeleteConfirm" class="ea-overlay" @click.self="showDeleteConfirm = false">
        <div class="ea-confirm-box">
          <span class="i-lucide:alert-triangle ea-confirm-icon" />
          <p>{{ t('userscripts.deleteConfirm') }}</p>
          <div class="ea-confirm-actions">
            <button class="ea-confirm-del" @click="deleteCurrent">{{ t('userscripts.delete') }}</button>
            <button class="ea-confirm-cancel" @click="showDeleteConfirm = false">{{ t('userscripts.cancel') }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.ea-root {
  display: flex;
  height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--color-bg-base);
  color: var(--color-text-primary);
}

.ea-sidebar {
  width: 260px;
  min-width: 260px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  min-height: 0;
}

.ea-sidebar-header {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 14px; border-bottom: 1px solid var(--color-border);
}

.ea-logo { font-size: 20px; color: var(--color-primary); }
.ea-sidebar-title { font-size: 15px; font-weight: 700; flex: 1; }
.ea-count {
  font-size: 11px; font-weight: 700; padding: 1px 7px;
  border-radius: var(--radius-full); background: var(--color-primary); color: var(--color-text-inverse);
}
.ea-sidebar-actions { display: flex; gap: 2px; }
.ea-icon-btn {
  width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; color: var(--color-text-muted); border-radius: var(--radius-sm);
  cursor: pointer; font-size: 16px; transition: all var(--transition-hover);
}
.ea-icon-btn:hover { color: var(--color-primary); background: var(--color-primary-light); }

.ea-search {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-bottom: 1px solid var(--color-border);
}
.ea-search-icon { font-size: 14px; color: var(--color-text-muted); }
.ea-search-input {
  flex: 1; border: none; outline: none; background: transparent;
  font-size: 13px; color: inherit;
}

.ea-script-list { flex: 1; overflow-y: auto; padding: 6px; min-height: 0; }
.ea-script-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: var(--radius-base); cursor: pointer;
  transition: all var(--transition-hover); margin-bottom: 2px;
}
.ea-script-item:hover { background: var(--color-primary-light); }
.ea-script-item--active { background: var(--tag-active-bg); }
.ea-script-item--disabled { opacity: 0.5; }

.ea-script-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.ea-script-dot--on { background: var(--color-success); box-shadow: 0 0 4px var(--color-success); }
.ea-script-dot--off { background: var(--color-text-muted); }

.ea-script-info { flex: 1; min-width: 0; }
.ea-script-name {
  font-size: 13px; font-weight: 600;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ea-script-match {
  font-size: 11px; color: var(--color-text-muted); font-family: monospace;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ea-script-runat {
  font-size: 10px; color: var(--color-primary); background: var(--color-primary-light);
  padding: 0 5px; border-radius: var(--radius-xs); flex-shrink: 0;
}
.ea-empty-list {
  text-align: center; padding: 24px; color: var(--color-text-muted); font-size: 13px;
}

.ea-main { flex: 1; display: grid; grid-template-rows: auto auto auto 1fr auto; min-width: 0; min-height: 0; }

.ea-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 16px; border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-surface); flex-shrink: 0;
}

.ea-toolbar-left { display: flex; align-items: center; gap: 8px; }
.ea-script-title { font-size: 15px; font-weight: 700; }
.ea-dirty-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-warning); }
.ea-status-badge {
  font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: var(--radius-full);
}
.ea-status-badge--on { background: var(--color-success-light); color: var(--color-success); }
.ea-status-badge--off { background: var(--color-danger-light); color: var(--color-danger); }

.ea-toolbar-right { display: flex; align-items: center; gap: 4px; }
.ea-tool-btn {
  width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; color: var(--color-text-muted); border-radius: var(--radius-sm);
  cursor: pointer; font-size: 16px; transition: all var(--transition-hover);
}
.ea-tool-btn:hover { color: var(--color-primary); background: var(--color-primary-light); }
.ea-tool-btn--danger:hover { color: var(--color-danger); background: var(--color-danger-light); }
.ea-tool-btn--active { color: var(--color-primary); background: var(--tag-active-bg); }

.ea-toolbar-sep { width: 1px; height: 20px; background: var(--color-border); margin: 0 4px; }

.ea-save-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px; font-size: 13px; font-weight: 600;
  color: var(--color-text-inverse); background: var(--color-primary); border: none; border-radius: var(--radius-sm);
  cursor: pointer; transition: all var(--transition-hover);
}
.ea-save-btn:hover { filter: brightness(1.1); }
.ea-save-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ea-save-shortcut { font-size: 11px; opacity: 0.7; }

.ea-script-tabs {
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0 8px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  flex-shrink: 0;
  height: 32px;
  align-items: stretch;
  gap: 0;
  scrollbar-width: none;
}
.ea-script-tabs::-webkit-scrollbar { display: none; }

.ea-script-tab {
  display: flex; align-items: center; gap: 4px;
  padding: 0 10px;
  font-size: 12px; font-weight: 500;
  color: var(--color-text-muted); background: transparent;
  border: none; border-bottom: 2px solid transparent;
  cursor: pointer; transition: all var(--transition-hover);
  white-space: nowrap; flex-shrink: 0;
  position: relative;
  min-width: 0;
}
.ea-script-tab:hover { color: var(--color-text-primary); background: var(--color-primary-light); }
.ea-script-tab--active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  background: var(--tag-active-bg);
}

.ea-script-tab-name {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  max-width: 120px;
}

.ea-script-tab-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--color-warning); flex-shrink: 0;
}

.ea-script-tab-close {
  width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; color: var(--color-text-muted);
  border-radius: var(--radius-xs); cursor: pointer; font-size: 10px;
  transition: all var(--transition-hover); flex-shrink: 0;
  opacity: 0;
}
.ea-script-tab:hover .ea-script-tab-close { opacity: 1; }
.ea-script-tab-close:hover { color: var(--color-danger); background: var(--color-danger-light); }

.ea-body { display: flex; min-height: 0; overflow: hidden; }

.ea-empty-editor {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; color: var(--color-text-muted); background: var(--color-bg-base);
}
.ea-empty-editor-icon { font-size: 40px; opacity: 0.3; }
.ea-empty-editor p { font-size: 14px; margin: 0; }
.ea-empty-editor-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; font-size: 13px; font-weight: 600;
  color: var(--color-text-inverse); background: var(--color-primary);
  border: none; border-radius: var(--radius-sm); cursor: pointer;
  transition: all var(--transition-hover);
}
.ea-empty-editor-btn:hover { filter: brightness(1.1); }

.ea-editor-area { flex: 1; min-height: 0; overflow: hidden; }

.ea-settings-panel {
  width: 240px;
  border-left: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  overflow-y: auto;
  flex-shrink: 0;
  padding: 16px;
}

.ea-settings-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 14px; font-weight: 700; margin-bottom: 16px;
  color: var(--color-primary);
}

.ea-settings-group {
  margin-bottom: 16px;
}
.ea-settings-label {
  display: block; font-size: 12px; font-weight: 600;
  color: var(--color-text-muted); margin-bottom: 8px;
  letter-spacing: 0.5px;
}

.ea-tab-sizes { display: flex; gap: 4px; }
.ea-tab-btn {
  flex: 1; padding: 6px 0; font-size: 13px; font-weight: 600;
  border: 1px solid var(--color-border); background: transparent; color: var(--color-text-muted);
  border-radius: var(--radius-sm); cursor: pointer; transition: all var(--transition-hover);
}
.ea-tab-btn--active { border-color: var(--color-primary); color: var(--color-primary); background: var(--color-primary-light); }
.ea-tab-btn:hover:not(.ea-tab-btn--active) { border-color: var(--color-text-secondary); }

.ea-toggle {
  width: 40px; height: 22px; border-radius: var(--radius-full);
  background: var(--color-border); border: none; cursor: pointer;
  position: relative; transition: background 0.2s;
}
.ea-toggle--on { background: var(--color-primary); }
.ea-toggle-thumb {
  position: absolute; top: 2px; left: 2px;
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--color-bg-surface); transition: transform 0.2s;
  box-shadow: var(--shadow-sm);
}
.ea-toggle--on .ea-toggle-thumb { transform: translateX(18px); }

.ea-theme-grid { display: flex; flex-direction: column; gap: 4px; }
.ea-theme-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; border: 1px solid var(--color-border); background: transparent;
  color: var(--color-text-secondary); border-radius: var(--radius-sm); cursor: pointer; transition: all var(--transition-hover);
  font-size: 12px; text-align: left;
}
.ea-theme-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
.ea-theme-btn--active { border-color: var(--color-primary); color: var(--color-primary); background: var(--color-primary-light); }
.ea-theme-preview {
  width: 20px; height: 14px; border-radius: 3px; flex-shrink: 0;
  border: 1px solid var(--color-border);
}
.ea-theme-preview--light { background: #fff; }
.ea-theme-preview--dark { background: #282a36; }
.ea-theme-name { font-weight: 500; }

.ea-metadata-group { border-top: 1px solid var(--color-border); padding-top: 16px; }
.ea-metadata-list { display: flex; flex-direction: column; gap: 6px; }
.ea-metadata-item {
  display: flex; gap: 6px; font-size: 12px;
  font-family: 'Cascadia Code', Consolas, monospace;
}
.ea-meta-key { color: var(--color-primary); white-space: nowrap; font-weight: 600; }
.ea-meta-val { color: var(--color-text-muted); word-break: break-all; }

.ea-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px 16px; border-top: 1px solid var(--color-border);
  font-size: 11px; color: var(--color-text-muted); background: var(--color-bg-surface); flex-shrink: 0;
}

.ea-footer-left, .ea-footer-right { display: flex; align-items: center; gap: 12px; }
.ea-footer-item { display: flex; align-items: center; gap: 3px; }
.ea-footer-selected { color: var(--color-primary); font-weight: 600; }
.ea-footer-autosave { color: var(--color-success); font-weight: 500; }

.ea-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: var(--color-bg-overlay); backdrop-filter: blur(2px);
  display: flex; align-items: center; justify-content: center;
}
.ea-confirm-box {
  background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: var(--radius-lg);
  padding: 24px; text-align: center; max-width: 320px;
  box-shadow: var(--shadow-modal);
  animation: ea-confirm-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes ea-confirm-in { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
.ea-confirm-icon { font-size: 28px; color: var(--color-warning); }
.ea-confirm-box p { font-size: 14px; margin: 12px 0 16px; }
.ea-confirm-actions { display: flex; gap: 8px; }
.ea-confirm-del {
  flex: 1; padding: 8px 0; font-size: 13px; font-weight: 600;
  color: var(--color-text-inverse); background: var(--color-danger); border: none; border-radius: var(--radius-sm);
  cursor: pointer;
}
.ea-confirm-del:hover { filter: brightness(1.1); }
.ea-confirm-cancel {
  flex: 1; padding: 8px 0; font-size: 13px; font-weight: 500;
  color: var(--color-text-muted); background: transparent; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); cursor: pointer;
}
.ea-confirm-cancel:hover { border-color: var(--color-primary); color: var(--color-primary); }

.ea-editor-tabs {
  display: flex; gap: 0;
  padding: 0 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  flex-shrink: 0;
}
.ea-editor-tab {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; font-size: 13px; font-weight: 500;
  color: var(--color-text-muted); background: transparent;
  border: none; border-bottom: 2px solid transparent;
  cursor: pointer; transition: all var(--transition-hover);
}
.ea-editor-tab:hover { color: var(--color-text-primary); }
.ea-editor-tab--active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.ea-meta-panel {
  flex: 1; overflow-y: auto; padding: 20px 24px;
  background: var(--color-bg-base);
  min-height: 0;
}
.ea-meta-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; padding: 48px; color: var(--color-text-muted); font-size: 14px;
}
.ea-meta-empty .i-lucide\:file-x { font-size: 32px; opacity: 0.4; }
.ea-meta-field { margin-bottom: 16px; }
.ea-meta-label {
  display: block; font-size: 12px; font-weight: 600;
  color: var(--color-primary); margin-bottom: 6px;
  font-family: 'Cascadia Code', Consolas, monospace;
}
.ea-meta-input {
  width: 100%; padding: 7px 10px; font-size: 13px;
  background: var(--color-bg-surface); color: var(--color-text-primary);
  border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  outline: none; transition: border-color var(--transition-hover);
}
.ea-meta-input:focus { border-color: var(--color-primary); }
.ea-meta-input--sm { flex: 1; width: auto; }
.ea-meta-select {
  width: 100%; padding: 7px 10px; font-size: 13px;
  background: var(--color-bg-surface); color: var(--color-text-primary);
  border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  outline: none; cursor: pointer; transition: border-color var(--transition-hover);
}
.ea-meta-select:focus { border-color: var(--color-primary); }

.ea-meta-list { display: flex; flex-direction: column; gap: 4px; }
.ea-meta-list-item {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 8px; background: var(--color-bg-surface);
  border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  font-size: 13px; font-family: 'Cascadia Code', Consolas, monospace;
  color: var(--color-text-secondary);
}
.ea-meta-list-item span { flex: 1; word-break: break-all; }
.ea-meta-list-del {
  width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; color: var(--color-text-muted);
  border-radius: var(--radius-xs); cursor: pointer; font-size: 12px;
  transition: all var(--transition-hover); flex-shrink: 0;
}
.ea-meta-list-del:hover { color: var(--color-danger); background: var(--color-danger-light); }
.ea-meta-list-add {
  display: flex; gap: 4px;
}
.ea-meta-add-btn {
  width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--color-border); background: transparent;
  color: var(--color-text-muted); border-radius: var(--radius-sm);
  cursor: pointer; font-size: 14px; transition: all var(--transition-hover); flex-shrink: 0;
}
.ea-meta-add-btn:hover { color: var(--color-primary); border-color: var(--color-primary); background: var(--color-primary-light); }

.ea-grant-area { position: relative; }
.ea-grant-tags {
  display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px;
}
.ea-grant-tag {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px; font-size: 12px; font-weight: 500;
  background: var(--color-primary-light); color: var(--color-primary);
  border-radius: var(--radius-full); font-family: 'Cascadia Code', Consolas, monospace;
}
.ea-grant-tag-x {
  width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; color: var(--color-primary);
  border-radius: 50%; cursor: pointer; font-size: 10px;
  transition: all var(--transition-hover); opacity: 0.6;
}
.ea-grant-tag-x:hover { opacity: 1; background: var(--color-primary); color: var(--color-text-inverse); }
.ea-grant-select-wrap { position: relative; display: inline-block; }
.ea-grant-select-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 5px 10px; font-size: 12px; font-weight: 500;
  background: transparent; color: var(--color-text-muted);
  border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  cursor: pointer; transition: all var(--transition-hover);
}
.ea-grant-select-btn:hover { color: var(--color-primary); border-color: var(--color-primary); }
.ea-grant-dropdown {
  position: absolute; top: 100%; left: 0; z-index: 100;
  min-width: 220px; max-height: 240px; overflow-y: auto;
  background: var(--color-bg-elevated); border: 1px solid var(--color-border);
  border-radius: var(--radius-base); padding: 4px;
  box-shadow: var(--shadow-modal);
}
.ea-grant-option {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 8px; font-size: 12px; cursor: pointer;
  border-radius: var(--radius-xs); transition: background var(--transition-hover);
  font-family: 'Cascadia Code', Consolas, monospace;
  color: var(--color-text-secondary);
}
.ea-grant-option:hover { background: var(--color-primary-light); }
.ea-grant-option input[type="checkbox"] { accent-color: var(--color-primary); cursor: pointer; }
.ea-grant-option--none { border-bottom: 1px solid var(--color-border); margin-bottom: 2px; padding-bottom: 7px; }
.ea-grant-overlay {
  position: fixed; inset: 0; z-index: 99;
}

.ea-fade-enter-active, .ea-fade-leave-active { transition: opacity 0.15s ease; }
.ea-fade-enter-from, .ea-fade-leave-to { opacity: 0; }

.ea-slide-enter-active, .ea-slide-leave-active { transition: all 0.2s ease; }
.ea-slide-enter-from, .ea-slide-leave-to { width: 0; padding: 0; opacity: 0; overflow: hidden; }
</style>
