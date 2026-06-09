<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserScriptsStore, type UserScript } from '@/stores/userScripts'
import { useI18n } from '@/i18n'

const store = useUserScriptsStore()
const { t } = useI18n()

const confirmDeleteId = ref<string | null>(null)
const currentUrl = ref('')

onMounted(() => {
  store.loadScripts()
  try {
    const iframe = document.querySelector('iframe[name="mini-browser-iframe"]') as HTMLIFrameElement
    if (iframe) currentUrl.value = iframe.src || ''
  } catch { /* ignore */ }
})

function isMatchForUrl(script: UserScript, url: string): boolean {
  if (!url || script.match.length === 0) return false
  return script.match.some(pattern => {
    try {
      const regexStr = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\/$/, '/?')
      return new RegExp('^' + regexStr + '$').test(url)
    } catch { return false }
  })
}

const activeScripts = computed(() => store.scripts.filter(s => s.enabled && isMatchForUrl(s, currentUrl.value)))
const inactiveScripts = computed(() => store.scripts.filter(s => !s.enabled || !isMatchForUrl(s, currentUrl.value)))

function openEditor(scriptId?: string) {
  const url = chrome.runtime.getURL('editor.html')
  const targetUrl = scriptId ? `${url}#id=${scriptId}` : url
  chrome.tabs.create({ url: targetUrl })
}

async function toggleScript(id: string) {
  await store.toggleScript(id)
}

function requestDelete(id: string) {
  confirmDeleteId.value = id
}

async function confirmDelete() {
  if (confirmDeleteId.value) {
    await store.removeScript(confirmDeleteId.value)
    confirmDeleteId.value = null
  }
}

function cancelDelete() {
  confirmDeleteId.value = null
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
</script>

<template>
  <div class="usp-panel">
    <div class="usp-header">
      <span class="i-lucide:code-2 usp-header-icon" />
      <span class="usp-title">{{ t('userscripts.title') }}</span>
      <span v-if="activeScripts.length" class="usp-badge-active">{{ activeScripts.length }}</span>
      <div class="usp-header-actions">
        <button class="usp-icon-btn" @click="openEditor()" :title="t('userscripts.openEditor')">
          <span class="i-lucide:external-link" />
        </button>
        <button class="usp-icon-btn usp-close" @click="store.togglePanel()" :title="t('common.close')">
          <span class="i-lucide:x" />
        </button>
      </div>
    </div>

    <div class="usp-list">
      <div v-if="store.scripts.length === 0" class="usp-empty">
        <span class="i-lucide:file-code-2 usp-empty-icon" />
        <p>{{ t('userscripts.empty') }}</p>
        <button class="usp-empty-btn" @click="openEditor()">
          <span class="i-lucide:external-link" />{{ t('userscripts.openEditor') }}
        </button>
      </div>

      <template v-else>
        <div v-if="activeScripts.length" class="usp-section">
          <div class="usp-section-label">
            <span class="i-lucide:zap" />{{ t('userscripts.activeOnPage') }} ({{ activeScripts.length }})
          </div>
          <div
            v-for="script in activeScripts"
            :key="script.id"
            class="usp-item usp-item--active"
          >
            <div class="usp-item-status usp-item-status--on" />
            <div class="usp-item-main" @click="openEditor(script.id)">
              <div class="usp-item-name">{{ script.name }}</div>
              <div class="usp-item-meta">
                <span class="usp-item-match">{{ script.match.join(', ') }}</span>
                <span v-if="script.runAt && script.runAt !== 'document-idle'" class="usp-item-runat">@{{ getRunAtLabel(script.runAt) }}</span>
              </div>
            </div>
            <button
              class="usp-toggle-btn usp-toggle-btn--on"
              @click.stop="toggleScript(script.id)"
              :title="t('userscripts.disable')"
            >
              <span class="i-lucide:power" />
            </button>
            <button class="usp-del-btn" @click.stop="requestDelete(script.id)" :title="t('userscripts.delete')">
              <span class="i-lucide:trash-2" />
            </button>
          </div>
        </div>

        <div v-if="inactiveScripts.length" class="usp-section">
          <div class="usp-section-label">
            <span class="i-lucide:archive" />{{ t('userscripts.otherScripts') }} ({{ inactiveScripts.length }})
          </div>
          <div
            v-for="script in inactiveScripts"
            :key="script.id"
            class="usp-item"
            :class="{ 'usp-item--disabled': !script.enabled }"
          >
            <div class="usp-item-status" :class="script.enabled ? 'usp-item-status--idle' : 'usp-item-status--off'" />
            <div class="usp-item-main" @click="openEditor(script.id)">
              <div class="usp-item-name">{{ script.name }}</div>
              <div class="usp-item-meta">
                <span class="usp-item-match">{{ script.match.join(', ') }}</span>
                <span v-if="script.runAt && script.runAt !== 'document-idle'" class="usp-item-runat">@{{ getRunAtLabel(script.runAt) }}</span>
              </div>
            </div>
            <button
              class="usp-toggle-btn"
              :class="script.enabled ? '' : 'usp-toggle-btn--off'"
              @click.stop="toggleScript(script.id)"
              :title="script.enabled ? t('userscripts.disable') : t('userscripts.enable')"
            >
              <span :class="script.enabled ? 'i-lucide:power' : 'i-lucide:power-off'" />
            </button>
            <button class="usp-del-btn" @click.stop="requestDelete(script.id)" :title="t('userscripts.delete')">
              <span class="i-lucide:trash-2" />
            </button>
          </div>
        </div>
      </template>
    </div>

    <Transition name="usp-fade">
      <div v-if="confirmDeleteId" class="usp-confirm-overlay" @click.self="cancelDelete">
        <div class="usp-confirm-box">
          <span class="i-lucide:alert-triangle usp-confirm-icon" />
          <p>{{ t('userscripts.deleteConfirm') }}</p>
          <div class="usp-confirm-actions">
            <button class="usp-confirm-del" @click="confirmDelete">{{ t('userscripts.delete') }}</button>
            <button class="usp-confirm-cancel" @click="cancelDelete">{{ t('userscripts.cancel') }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.usp-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-surface);
  border-left: 1px solid var(--color-border);
  position: relative;
}

.usp-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.usp-header-icon { font-size: var(--fs-lg); color: var(--color-primary); }

.usp-title {
  font-size: var(--fs-md);
  font-weight: 600;
  color: var(--color-text-primary);
  flex: 1;
}

.usp-badge-active {
  font-size: var(--fs-xs);
  font-weight: 700;
  padding: 1px 7px;
  border-radius: var(--radius-full);
  background: var(--color-success);
  color: #fff;
}

.usp-header-actions { display: flex; gap: 2px; }

.usp-icon-btn {
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  border: none; background: transparent;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer; font-size: var(--fs-md);
  transition: all var(--transition-hover);
}
.usp-icon-btn:hover { color: var(--color-primary); background: var(--color-primary-light); }
.usp-close:hover { color: var(--color-danger); background: var(--color-danger-light); }

.usp-list { flex: 1; overflow-y: auto; }

.usp-empty {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 32px 16px; gap: var(--space-md);
  color: var(--color-text-muted);
}
.usp-empty-icon { font-size: var(--fs-3xl); opacity: 0.4; }
.usp-empty p { font-size: var(--fs-md); margin: 0; }
.usp-empty-btn {
  display: flex; align-items: center; gap: var(--space-xs);
  padding: 6px 14px; font-size: var(--fs-md); font-weight: 500;
  color: var(--color-primary); background: var(--color-primary-light);
  border: 1px solid var(--color-primary); border-radius: var(--radius-md);
  cursor: pointer; transition: all var(--transition-hover);
}
.usp-empty-btn:hover { background: var(--color-primary); color: var(--color-text-inverse); }

.usp-section { padding: var(--space-sm) var(--space-sm) 0; }
.usp-section-label {
  display: flex; align-items: center; gap: var(--space-xs);
  font-size: var(--fs-xs); font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase; letter-spacing: 0.5px;
  padding: 4px 6px; margin-bottom: var(--space-xs);
}

.usp-item {
  display: flex; align-items: center; gap: var(--space-xs);
  padding: 7px 8px; border-radius: var(--radius-md);
  border: 1px solid transparent;
  margin-bottom: var(--space-2xs);
  transition: all var(--transition-hover);
  background: transparent;
}
.usp-item:hover { background: var(--color-primary-light); border-color: var(--color-border); }
.usp-item--active { background: rgba(var(--color-success-rgb, 16,185,129), 0.06); }
.usp-item--active:hover { background: rgba(var(--color-success-rgb, 16,185,129), 0.12); }
.usp-item--disabled { opacity: 0.5; }

.usp-item-status {
  width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
}
.usp-item-status--on { background: var(--color-success); box-shadow: 0 0 4px var(--color-success); }
.usp-item-status--idle { background: var(--color-warning); }
.usp-item-status--off { background: var(--color-text-muted); }

.usp-item-main {
  flex: 1; min-width: 0; cursor: pointer;
}
.usp-item-name {
  font-size: var(--fs-sm); font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.usp-item-meta {
  display: flex; align-items: center; gap: var(--space-xs);
  margin-top: 1px;
}
.usp-item-match {
  font-size: var(--fs-2xs); color: var(--color-text-muted);
  font-family: monospace;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.usp-item-runat {
  font-size: var(--fs-2xs); color: var(--color-primary);
  background: var(--color-primary-light);
  padding: 0 4px; border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.usp-toggle-btn, .usp-del-btn {
  width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  border: none; background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer; font-size: var(--fs-sm);
  transition: all var(--transition-hover);
  flex-shrink: 0;
}
.usp-toggle-btn { color: var(--color-text-muted); }
.usp-toggle-btn--on { color: var(--color-success); }
.usp-toggle-btn--off { color: var(--color-danger); }
.usp-toggle-btn:hover { background: var(--color-primary-light); }
.usp-del-btn { color: var(--color-text-muted); }
.usp-del-btn:hover { color: var(--color-danger); background: var(--color-danger-light); }

.usp-confirm-overlay {
  position: absolute; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.4); backdrop-filter: blur(2px);
  display: flex; align-items: center; justify-content: center;
}
.usp-confirm-box {
  background: var(--color-bg-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius-lg); padding: 20px; text-align: center;
  max-width: 200px; box-shadow: 0 8px 24px rgba(0,0,0,0.2);
}
.usp-confirm-icon { font-size: var(--fs-2xl); color: var(--color-warning); }
.usp-confirm-box p { font-size: var(--fs-md); color: var(--color-text-primary); margin: 8px 0 12px; }
.usp-confirm-actions { display: flex; gap: var(--space-sm); }
.usp-confirm-del {
  flex: 1; padding: 6px 0; font-size: var(--fs-sm); font-weight: 600;
  color: #fff; background: var(--color-danger);
  border: none; border-radius: var(--radius-md);
  cursor: pointer; transition: all var(--transition-hover);
}
.usp-confirm-del:hover { filter: brightness(1.1); }
.usp-confirm-cancel {
  flex: 1; padding: 6px 0; font-size: var(--fs-sm); font-weight: 500;
  color: var(--color-text-muted); background: transparent;
  border: 1px solid var(--color-border); border-radius: var(--radius-md);
  cursor: pointer; transition: all var(--transition-hover);
}
.usp-confirm-cancel:hover { border-color: var(--color-primary); color: var(--color-text-primary); }

.usp-fade-enter-active, .usp-fade-leave-active { transition: opacity 0.15s ease; }
.usp-fade-enter-from, .usp-fade-leave-to { opacity: 0; }
</style>
