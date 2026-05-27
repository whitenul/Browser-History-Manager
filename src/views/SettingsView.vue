<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useUIStore } from '@/stores/ui'
import { useFingerprintStore } from '@/stores/fingerprint'
import { useI18n } from '@/i18n'
import { isValidDomain, debounce } from '@/utils/helpers'

const { t } = useI18n()
const history = useHistoryStore()
const ui = useUIStore()
const fpStore = useFingerprintStore()

const newBlacklistDomain = ref('')
const clearConfirm = ref(false)
const fingerprintEnabled = ref(true)

async function loadFingerprintEnabled() {
  try {
    const r = await chrome.storage.local.get('fingerprintEnabled')
    if (typeof r.fingerprintEnabled === 'boolean') fingerprintEnabled.value = r.fingerprintEnabled
  } catch { /* ignore */ }
}

watch(fingerprintEnabled, async (val) => {
  try { await chrome.storage.local.set({ fingerprintEnabled: val }) } catch { /* ignore */ }
})

loadFingerprintEnabled()

const doubleClickMode = ref(false)
const sidebarMode = ref(false)

const settings = ref({
  defaultTimeRange: 'all',
  defaultGroupMode: 'none',
  defaultSortMode: 'timeDesc',
  pageSize: 30,
  sessionGapMinutes: 30,
  defaultSidebarTab: 'stats' as string,
})

onMounted(async () => {
  try {
    const result = await chrome.storage.local.get('appSettings')
    if (result.appSettings) Object.assign(settings.value, result.appSettings)
    history.applySettings(settings.value.pageSize, settings.value.sessionGapMinutes)
  } catch { /* ignore */ }
  await ui.loadDoubleClickMode()
  doubleClickMode.value = ui.doubleClickMode
  await ui.loadSidebarMode()
  sidebarMode.value = ui.sidebarMode
})

async function saveSettings() {
  try {
    await chrome.storage.local.set({ appSettings: settings.value })
    history.applySettings(settings.value.pageSize, settings.value.sessionGapMinutes)
  } catch { /* ignore */ }
}

async function clearAllData() {
  try {
    await chrome.history.deleteAll()
    await chrome.storage.local.clear()
    history.resetState()
    ui.notify(t('settings.allDataCleared'), 'success')
  } catch (err) {
    console.error('Failed to clear all data:', err)
    ui.notify(t('settings.clearDataError'), 'error')
  } finally {
    clearConfirm.value = false
  }
}

async function addBlacklist() {
  const d = newBlacklistDomain.value.trim()
  if (!d || !isValidDomain(d)) {
    ui.notify(t('settings.invalidDomain'), 'error')
    return
  }
  await history.addBlacklistDomain(d)
  newBlacklistDomain.value = ''
}

const debouncedSave = debounce(saveSettings, 500)
watch(settings, () => {
  debouncedSave()
}, { deep: true })

watch(doubleClickMode, (val) => {
  ui.doubleClickMode = val
  ui.saveDoubleClickMode()
})

watch(sidebarMode, (val) => {
  ui.sidebarMode = val
  ui.saveSidebarMode()
})
</script>

<template>
  <div class="settings-view">
    <div class="settings-content">
      <div class="section">
        <div class="section-title">
          <span class="i-lucide:settings section-icon" />
          {{ t('settings.general') }}
        </div>
        <div class="setting-row">
          <label>{{ t('settings.defaultTimeRange') }}</label>
          <select v-model="settings.defaultTimeRange" class="setting-select">
            <option value="today">{{ t('settings.timeRange.today') }}</option>
            <option value="3days">{{ t('settings.timeRange.last3days') }}</option>
            <option value="week">{{ t('settings.timeRange.last7days') }}</option>
            <option value="month">{{ t('settings.timeRange.last30days') }}</option>
            <option value="all">{{ t('settings.timeRange.all') }}</option>
          </select>
        </div>
        <div class="setting-row">
          <label>{{ t('settings.defaultGroupMode') }}</label>
          <select v-model="settings.defaultGroupMode" class="setting-select">
            <option value="none">{{ t('settings.groupMode.none') }}</option>
            <option value="domain">{{ t('settings.groupMode.domain') }}</option>
            <option value="timeline">{{ t('settings.groupMode.timeline') }}</option>
            <option value="session">{{ t('settings.groupMode.session') }}</option>
          </select>
        </div>
        <div class="setting-row">
          <label>{{ t('settings.defaultSortMode') }}</label>
          <select v-model="settings.defaultSortMode" class="setting-select">
            <option value="timeDesc">{{ t('settings.sortMode.timeDesc') }}</option>
            <option value="timeAsc">{{ t('settings.sortMode.timeAsc') }}</option>
            <option value="visitDesc">{{ t('settings.sortMode.visitDesc') }}</option>
            <option value="visitAsc">{{ t('settings.sortMode.visitAsc') }}</option>
          </select>
        </div>
        <div class="setting-row">
          <label>{{ t('settings.pageSize') }}</label>
          <input type="number" v-model.number="settings.pageSize" min="20" max="500" class="setting-input" />
        </div>
        <div class="setting-row">
          <label>{{ t('settings.sessionGap') }}</label>
          <input type="number" v-model.number="settings.sessionGapMinutes" min="5" max="120" class="setting-input" />
        </div>
      </div>

      <div class="section">
        <div class="section-title">
          <span class="i-lucide:layout section-icon" />
          {{ t('settings.ui') }}
        </div>
        <div class="setting-row">
          <div>
            <div class="setting-label">{{ t('settings.sidebarMode') }}</div>
            <div class="setting-desc">{{ t('settings.sidebarModeDesc') }}</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" v-model="sidebarMode" />
            <span class="toggle-slider" />
          </label>
        </div>
        <div class="setting-row">
          <label>{{ t('settings.defaultSidebarTab') }}</label>
          <select v-model="settings.defaultSidebarTab" class="setting-select">
            <option value="history">{{ t('settings.sidebarTabHistory') }}</option>
            <option value="stats">{{ t('settings.sidebarTabStats') }}</option>
            <option value="bookmarks">{{ t('settings.sidebarTabBookmarks') }}</option>
            <option value="settings">{{ t('settings.sidebarTabSettings') }}</option>
          </select>
        </div>
        <div class="setting-row">
          <div>
            <div class="setting-label">{{ t('settings.doubleClickMode') }}</div>
            <div class="setting-desc">{{ t('settings.doubleClickModeDesc') }}</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" v-model="doubleClickMode" />
            <span class="toggle-slider" />
          </label>
        </div>
      </div>

      <div class="section">
        <div class="section-title">
          <span class="i-lucide:ban section-icon" />
          {{ t('settings.blacklist') }}
        </div>
        <p class="section-desc">{{ t('settings.blacklistDesc') }}</p>
        <div class="blacklist-form">
          <input v-model="newBlacklistDomain" type="text" :placeholder="t('settings.blacklistPlaceholder')" class="setting-input"
            @keydown.enter="addBlacklist" />
          <button class="btn-add" @click="addBlacklist">{{ t('common.add') }}</button>
        </div>
        <div class="blacklist-list">
          <div v-if="!history.blacklistedDomains.length" class="empty-hint">{{ t('settings.emptyBlacklist') }}</div>
          <div v-for="d in history.blacklistedDomains" :key="d" class="blacklist-item">
            <span class="i-lucide:globe item-icon" />
            <span class="item-domain">{{ d }}</span>
            <button class="item-remove" @click="history.removeBlacklistDomain(d)">
              <span class="i-lucide:x" />
            </button>
          </div>
        </div>
      </div>

      <div class="version-hint">v2.0.0</div>

      <div class="section danger-zone">
        <div class="section-title">
          <span class="i-lucide:alert-triangle section-icon danger" />
          {{ t('settings.dangerZone') }}
        </div>
        <div class="setting-row">
          <div>
            <div class="setting-label">{{ t('settings.fingerprintCollect') }}</div>
            <div class="setting-desc">{{ t('settings.fingerprintCollectDesc') }}</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" v-model="fingerprintEnabled" />
            <span class="toggle-slider" />
          </label>
        </div>
        <div v-if="fingerprintEnabled" class="setting-row">
          <div>
            <div class="setting-label">{{ t('settings.fingerprintClear') }}</div>
            <div class="setting-desc">{{ t('settings.fingerprintClearDesc') }}</div>
          </div>
          <button class="btn-danger-sm" @click="fpStore.clearAllData()">{{ t('settings.fingerprintClear') }}</button>
        </div>
        <button v-if="!clearConfirm" class="btn-danger" @click="clearConfirm = true">{{ t('settings.clearAllData') }}</button>
        <div v-else class="confirm-clear">
          <p class="confirm-text">{{ t('settings.clearAllConfirm') }}</p>
          <div class="confirm-actions">
            <button class="btn-cancel" @click="clearConfirm = false">{{ t('common.cancel') }}</button>
            <button class="btn-danger" @click="clearAllData">{{ t('settings.confirmClear') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-view {
  display: flex; flex-direction: column; height: 100%;
  background: var(--color-bg-base); color: var(--color-text-primary);
}

.settings-content { flex: 1; overflow-y: auto; padding: 16px; }

.section { margin-bottom: 24px; }
.section-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 14px; font-weight: 600; margin-bottom: 12px;
  color: var(--color-text-primary);
}
.section-icon { font-size: 16px; color: var(--color-primary); }
.section-icon.danger { color: var(--color-danger); }
.section-desc { font-size: 12px; color: var(--color-text-muted); margin-bottom: 10px; }
.section-hint { font-size: 11px; color: var(--color-text-muted); margin: 8px 0 4px; opacity: 0.8; }

.setting-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 0; border-bottom: 1px solid var(--color-border);
}
.setting-row label { font-size: 13px; color: var(--color-text-secondary); }
.setting-select {
  padding: 5px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  font-size: 12px; background: var(--color-bg-surface); color: var(--color-text-primary); outline: none;
}
.setting-input {
  padding: 5px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  font-size: 12px; background: var(--color-bg-surface); color: var(--color-text-primary); outline: none; width: 80px;
}
.setting-input:focus, .setting-select:focus { border-color: var(--color-primary); }

.blacklist-form { display: flex; gap: 6px; margin-bottom: 10px; }
.blacklist-form .setting-input { flex: 1; width: auto; }
.btn-add {
  padding: 5px 14px; border: 1px solid var(--color-primary); border-radius: var(--radius-sm);
  background: var(--color-primary-light); color: var(--color-primary); font-size: 12px;
  cursor: pointer; font-weight: 500;
}
.btn-add:hover { background: var(--color-primary); color: var(--color-text-inverse); }

.blacklist-list {}
.empty-hint { font-size: 12px; color: var(--color-text-muted); text-align: center; padding: 12px; }
.blacklist-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 0; border-bottom: 1px solid var(--color-border);
}
.item-icon { font-size: 14px; color: var(--color-text-muted); }
.item-domain { flex: 1; font-size: 13px; color: var(--color-text-primary); }
.item-remove {
  width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; border-radius: var(--radius-sm);
  cursor: pointer; color: var(--color-text-muted); font-size: 13px;
}
.item-remove:hover { color: var(--color-danger); background: var(--color-danger-light); }

.version-hint {
  text-align: center; font-size: 11px; color: var(--color-text-muted);
  margin: 8px 0 16px; opacity: 0.6;
}

.danger-zone {}
.btn-danger {
  width: 100%; padding: 9px; border: 1px solid var(--color-danger); border-radius: var(--radius-md);
  background: var(--color-danger-light); color: var(--color-danger); font-size: 13px; font-weight: 500;
  cursor: pointer; transition: all var(--transition-hover);
}
.btn-danger:hover { background: var(--color-danger); color: var(--color-text-inverse); }
.btn-danger-sm {
  padding: 5px 12px; border: 1px solid var(--color-danger); border-radius: var(--radius-sm);
  background: var(--color-danger-light); color: var(--color-danger); font-size: 11px; font-weight: 500;
  cursor: pointer; transition: all var(--transition-hover); white-space: nowrap;
}
.btn-danger-sm:hover { background: var(--color-danger); color: var(--color-text-inverse); }

.toggle-switch {
  position: relative; display: inline-block; width: 36px; height: 20px; flex-shrink: 0;
}
.toggle-switch input { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute; cursor: pointer; inset: 0;
  background: var(--color-border); border-radius: var(--radius-lg); transition: 0.2s;
}
.toggle-slider::before {
  content: ''; position: absolute; height: 16px; width: 16px;
  left: 2px; bottom: 2px; background: var(--color-bg-surface); border-radius: 50%; transition: 0.2s;
}
.toggle-switch input:checked + .toggle-slider { background: var(--color-primary); }
.toggle-switch input:checked + .toggle-slider::before { transform: translateX(16px); }

.confirm-clear { padding: 12px; background: var(--color-danger-light); border: 1px solid var(--color-danger); border-radius: var(--radius-md); }
.confirm-text { font-size: 13px; color: var(--color-text-secondary); margin: 0 0 10px; }
.confirm-actions { display: flex; gap: 8px; }
.btn-cancel { padding: 6px 14px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-bg-surface); color: var(--color-text-secondary); font-size: 12px; cursor: pointer; }
</style>
