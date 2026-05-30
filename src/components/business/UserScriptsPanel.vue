<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserScriptsStore, type UserScript } from '@/stores/userScripts'
import { useI18n } from '@/i18n'

const store = useUserScriptsStore()
const { t } = useI18n()

const editingScript = ref<UserScript | null>(null)
const isNewScript = ref(false)
const editorCode = ref('')
const editorName = ref('')
const editorMatch = ref('')
const editorDesc = ref('')
const showEditor = ref(false)

onMounted(() => {
  store.loadScripts()
})

function createNew() {
  isNewScript.value = true
  editingScript.value = null
  editorName.value = ''
  editorMatch.value = '*://*/*'
  editorDesc.value = ''
  editorCode.value = `// ==UserScript==
// @name        New Script
// @match       *://*/*
// @description My custom script
// ==/UserScript==

(function() {
  'use strict';
  // Your code here...
})();`
  showEditor.value = true
}

function editScript(script: UserScript) {
  isNewScript.value = false
  editingScript.value = script
  editorName.value = script.name
  editorMatch.value = script.match.join('\n')
  editorDesc.value = script.description
  editorCode.value = script.code
  showEditor.value = true
}

function saveScript() {
  if (isNewScript.value) {
    store.addScript(editorCode.value)
  } else if (editingScript.value) {
    store.updateScript(editingScript.value.id, editorCode.value)
  }
  showEditor.value = false
  editingScript.value = null
}

function cancelEdit() {
  showEditor.value = false
  editingScript.value = null
}

function deleteScript(id: string) {
  store.removeScript(id)
  if (editingScript.value?.id === id) {
    showEditor.value = false
    editingScript.value = null
  }
}
</script>

<template>
  <div class="usp-panel">
    <div class="usp-header">
      <span class="i-lucide:code usp-header-icon" />
      <span class="usp-title">{{ t('userscripts.title') }}</span>
      <span class="usp-count">{{ store.scripts.length }}</span>
      <div class="usp-header-actions">
        <button class="usp-add-btn" @click="createNew" :title="t('userscripts.add')">
          <span class="i-lucide:plus" />
        </button>
        <button class="usp-close-btn" @click="store.togglePanel()" :title="t('common.close')">
          <span class="i-lucide:x" />
        </button>
      </div>
    </div>

    <!-- Script list -->
    <div v-if="!showEditor" class="usp-list">
      <div v-if="store.scripts.length === 0" class="usp-empty">
        <span class="i-lucide:file-code usp-empty-icon" />
        <p>{{ t('userscripts.empty') }}</p>
        <button class="usp-empty-btn" @click="createNew">
          <span class="i-lucide:plus" />{{ t('userscripts.addFirst') }}
        </button>
      </div>
      <div
        v-for="script in store.scripts"
        :key="script.id"
        class="usp-item"
        :class="{ disabled: !script.enabled }"
      >
        <div class="usp-item-main" @click="editScript(script)">
          <div class="usp-item-info">
            <div class="usp-item-name">{{ script.name }}</div>
            <div class="usp-item-match">{{ script.match.join(', ') }}</div>
            <div v-if="script.description" class="usp-item-desc">{{ script.description }}</div>
          </div>
        </div>
        <div class="usp-item-actions">
          <button
            class="usp-toggle"
            :class="{ active: script.enabled }"
            @click.stop="store.toggleScript(script.id)"
            :title="script.enabled ? t('userscripts.disable') : t('userscripts.enable')"
          >
            <span :class="script.enabled ? 'i-lucide:power' : 'i-lucide:power-off'" />
          </button>
          <button class="usp-delete" @click.stop="deleteScript(script.id)" :title="t('userscripts.delete')">
            <span class="i-lucide:trash-2" />
          </button>
        </div>
      </div>
    </div>

    <!-- Editor -->
    <div v-else class="usp-editor">
      <div class="usp-editor-header">
        <button class="usp-back-btn" @click="cancelEdit">
          <span class="i-lucide:arrow-left" />
        </button>
        <span class="usp-editor-title">{{ isNewScript ? t('userscripts.newScript') : t('userscripts.editScript') }}</span>
      </div>
      <div class="usp-editor-hint">
        {{ t('userscripts.hint') }}
      </div>
      <textarea
        class="usp-code-area"
        v-model="editorCode"
        spellcheck="false"
        :placeholder="t('userscripts.codePlaceholder')"
      />
      <div class="usp-editor-footer">
        <button class="usp-save-btn" @click="saveScript">
          <span class="i-lucide:check" />{{ t('userscripts.save') }}
        </button>
        <button class="usp-cancel-btn" @click="cancelEdit">
          <span class="i-lucide:x" />{{ t('userscripts.cancel') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.usp-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-surface);
  border-left: 1px solid var(--color-border);
}

.usp-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  flex-shrink: 0;
}

.usp-header-icon {
  font-size: var(--fs-lg);
  color: var(--color-primary);
}

.usp-title {
  font-size: var(--fs-md);
  font-weight: 600;
  color: var(--color-text-primary);
  flex: 1;
}

.usp-count {
  font-size: var(--fs-xs);
  font-weight: 600;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.usp-header-actions {
  display: flex;
  gap: 2px;
}

.usp-add-btn,
.usp-close-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--fs-md);
  transition: all var(--transition-hover);
}

.usp-add-btn:hover {
  color: var(--color-primary);
  background: var(--color-primary-light);
}

.usp-close-btn:hover {
  color: var(--color-danger);
  background: var(--color-danger-light);
}

.usp-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-sm);
}

.usp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  gap: var(--space-md);
  color: var(--color-text-muted);
}

.usp-empty-icon {
  font-size: var(--fs-3xl);
  opacity: 0.4;
}

.usp-empty p {
  font-size: var(--fs-md);
  margin: 0;
}

.usp-empty-btn {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 6px 14px;
  font-size: var(--fs-md);
  font-weight: 500;
  color: var(--color-primary);
  background: var(--color-primary-light);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-hover);
}

.usp-empty-btn:hover {
  background: var(--color-primary);
  color: var(--color-text-inverse);
}

.usp-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 8px 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  margin-bottom: var(--space-xs);
  transition: all var(--transition-hover);
  background: var(--color-bg-surface);
}

.usp-item:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.usp-item.disabled {
  opacity: 0.5;
}

.usp-item-main {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.usp-item-info {
  min-width: 0;
}

.usp-item-name {
  font-size: var(--fs-md);
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.usp-item-match {
  font-size: var(--fs-xs);
  color: var(--color-text-muted);
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}

.usp-item-desc {
  font-size: var(--fs-xs);
  color: var(--color-text-secondary);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.usp-item-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.usp-toggle,
.usp-delete {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--fs-base);
  transition: all var(--transition-hover);
}

.usp-toggle {
  color: var(--color-text-muted);
}

.usp-toggle.active {
  color: var(--color-success);
}

.usp-toggle:hover {
  background: var(--color-primary-light);
}

.usp-delete {
  color: var(--color-text-muted);
}

.usp-delete:hover {
  color: var(--color-danger);
  background: var(--color-danger-light);
}

.usp-editor {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.usp-editor-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.usp-back-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--fs-md);
  transition: all var(--transition-hover);
}

.usp-back-btn:hover {
  color: var(--color-text-primary);
  background: var(--color-primary-light);
}

.usp-editor-title {
  font-size: var(--fs-md);
  font-weight: 600;
  color: var(--color-text-primary);
}

.usp-editor-hint {
  font-size: var(--fs-xs);
  color: var(--color-text-muted);
  padding: 6px 12px;
  background: var(--color-bg-base);
  border-bottom: 1px solid var(--color-border);
  line-height: 1.4;
  flex-shrink: 0;
}

.usp-code-area {
  flex: 1;
  padding: var(--space-md);
  font-size: var(--fs-sm);
  font-family: var(--font-mono, ui-monospace, 'Cascadia Code', Consolas, monospace);
  background: var(--color-bg-base);
  color: var(--color-text-primary);
  border: none;
  resize: none;
  outline: none;
  tab-size: 2;
  line-height: 1.5;
}

.usp-code-area:focus {
  box-shadow: inset 0 0 0 2px var(--color-primary-light);
}

.usp-editor-footer {
  display: flex;
  gap: var(--space-sm);
  padding: 8px 12px;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.usp-save-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  padding: 6px 0;
  font-size: var(--fs-md);
  font-weight: 600;
  color: var(--color-text-inverse);
  background: var(--color-primary);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-hover);
}

.usp-save-btn:hover {
  filter: brightness(1.1);
}

.usp-cancel-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  padding: 6px 14px;
  font-size: var(--fs-md);
  font-weight: 500;
  color: var(--color-text-muted);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-hover);
}

.usp-cancel-btn:hover {
  color: var(--color-text-primary);
  border-color: var(--color-primary);
}
</style>
