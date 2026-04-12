<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useThemeStore } from '@/stores/theme'
import { useUIStore } from '@/stores/ui'
import { useI18n } from '@/i18n'
import { safeOpenUrl, isValidDomain } from '@/utils/helpers'

const { t } = useI18n()
const history = useHistoryStore()
const theme = useThemeStore()
const ui = useUIStore()

const newBlacklistDomain = ref('')
const clearConfirm = ref(false)

const isSidebar = document.location.pathname.includes('sidebar')

const settings = ref({
  defaultTimeRange: 'all',
  defaultGroupMode: 'none',
  defaultSortMode: 'timeDesc',
  pageSize: 100,
  sessionGapMinutes: 30,
  defaultSidebarTab: 'stats' as string,
})

onMounted(async () => {
  try {
    const result = await chrome.storage.local.get('appSettings')
    if (result.appSettings) Object.assign(settings.value, result.appSettings)
    history.applySettings(settings.value.pageSize, settings.value.sessionGapMinutes)
  } catch { /* ignore */ }
})

async function saveSettings() {
  try {
    await chrome.storage.local.set({ appSettings: settings.value })
    history.applySettings(settings.value.pageSize, settings.value.sessionGapMinutes)
    ui.notify(t('settings.saved'), 'success')
  } catch { /* ignore */ }
}

async function openSidePanel() {
  try {
    if (chrome?.sidePanel?.open) {
      const win = await chrome.windows.getCurrent()
      await chrome.sidePanel.open({ windowId: win.id! })
      ui.notify(t('settings.openingSidebar'), 'success')
    } else {
      chrome.runtime.sendMessage({ action: 'openSidePanel' }, (response) => {
        if (chrome.runtime.lastError) {
          ui.notify(t('settings.openSidebarHint'), 'info')
        } else if (response?.success) {
          ui.notify(t('settings.openingSidebar'), 'success')
        } else {
          ui.notify(response?.error || t('settings.openSidebarFailed'), 'error')
        }
      })
    }
  } catch (err: any) {
    const msg = err?.message || String(err)
    if (msg.includes('user gesture')) {
      ui.notify(t('settings.openSidebarHint'), 'info')
    } else {
      ui.notify(t('settings.sidebarOpenFailed', { msg }), 'error')
    }
  }
}

async function clearAllData() {
  await chrome.storage.local.clear()
  clearConfirm.value = false
  ui.notify(t('settings.allDataCleared'), 'info')
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

function openUrl(url: string) { safeOpenUrl(url) }
</script>

<template>
  <div class="settings-view">
    <div class="settings-content">
      <div class="section">
        <div class="section-title">
          <span class="i-lucide:sliders section-icon" />
          {{ t('settings.defaultBehavior') }}
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
        <button class="btn-save" @click="saveSettings">{{ t('settings.saveSettings') }}</button>
      </div>

      <div class="section">
        <div class="section-title">
          <span class="i-lucide:panel-left section-icon" />
          {{ t('settings.uiMode') }}
        </div>
        <p class="section-desc">{{ t('settings.uiModeDesc') }}</p>
        <div class="mode-cards">
          <label :class="['mode-card', { active: !isSidebar }]">
            <input type="radio" name="uiMode" :checked="!isSidebar" />
            <span class="mode-card-icon"><span class="i-lucide:maximize-2" /></span>
            <span class="mode-card-label">{{ t('settings.popupMode') }}</span>
            <span class="mode-card-desc">{{ t('settings.popupModeDesc') }}</span>
          </label>
          <label :class="['mode-card', { active: isSidebar }]" @click.prevent="openSidePanel">
            <input type="radio" name="uiMode" :checked="isSidebar" />
            <span class="mode-card-icon"><span class="i-lucide:panel-right" /></span>
            <span class="mode-card-label">{{ t('settings.sidePanelMode') }}</span>
            <span class="mode-card-desc">{{ t('settings.sidePanelModeDesc') }}</span>
          </label>
        </div>
        <p class="section-hint">{{ t('settings.currentMode') }}: {{ isSidebar ? t('settings.sidebar') : t('settings.popup') }} · {{ t('settings.switchModeHint') }}</p>
        <div v-if="!isSidebar" class="setting-row">
          <label>{{ t('settings.defaultSidebarTab') }}</label>
          <select v-model="settings.defaultSidebarTab" class="setting-select">
            <option value="history">{{ t('settings.sidebarTabHistory') }}</option>
            <option value="stats">{{ t('settings.sidebarTabStats') }}</option>
            <option value="bookmarks">{{ t('settings.sidebarTabBookmarks') }}</option>
            <option value="settings">{{ t('settings.sidebarTabSettings') }}</option>
          </select>
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

      <div class="section">
        <div class="section-title">
          <span class="i-lucide:info section-icon" />
          {{ t('settings.about') }}
        </div>
        <div class="about-card">
          <div class="about-name">{{ t('settings.appName') }}</div>
          <div class="about-version">v2.0.0</div>
          <div class="about-desc">{{ t('settings.appDesc') }}</div>
          <div class="about-tech">Vue 3 · TypeScript · Pinia · UnoCSS · Vite</div>
        </div>
      </div>

      <div class="section danger-zone">
        <div class="section-title">
          <span class="i-lucide:alert-triangle section-icon danger" />
          {{ t('settings.dangerZone') }}
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
  background: var(--app-bg); color: var(--text-primary);
}

.settings-content { flex: 1; overflow-y: auto; padding: 16px; }

.section { margin-bottom: 24px; }
.section-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 14px; font-weight: 600; margin-bottom: 12px;
  color: var(--text-primary);
}
.section-icon { font-size: 16px; color: var(--primary-color); }
.section-icon.danger { color: #ef4444; }
.section-desc { font-size: 12px; color: var(--text-muted); margin-bottom: 10px; }
.section-hint { font-size: 11px; color: var(--text-muted); margin: 8px 0 4px; opacity: 0.8; }

.mode-cards {
  display: flex; gap: 10px; margin-bottom: 4px;
}
.mode-card {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 14px 10px; border: 2px solid var(--border-color); border-radius: var(--radius-md);
  background: var(--app-surface); cursor: default; transition: all var(--transition-fast);
}
.mode-card input { display: none; }
.mode-card.active {
  border-color: var(--primary-color);
  background: rgba(99,102,241,0.06);
}
.mode-card[onclick] { cursor: pointer; }
.mode-card[onclick]:hover {
  border-color: var(--primary-color);
  background: rgba(99,102,241,0.04);
}
.mode-card-icon { font-size: 24px; color: var(--primary-color); }
.mode-card-label { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.mode-card-desc { font-size: 11px; color: var(--text-muted); text-align: center; }

.setting-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 0; border-bottom: 1px solid var(--border-color);
}
.setting-row label { font-size: 13px; color: var(--text-secondary); }
.setting-select {
  padding: 5px 8px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);
  font-size: 12px; background: var(--app-surface); color: var(--text-primary); outline: none;
}
.setting-input {
  padding: 5px 8px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);
  font-size: 12px; background: var(--app-surface); color: var(--text-primary); outline: none; width: 80px;
}
.setting-input:focus, .setting-select:focus { border-color: var(--primary-color); }

.btn-save {
  margin-top: 12px; width: 100%; padding: 9px; border: none; border-radius: var(--radius-md);
  background: var(--primary-color); color: white; font-size: 13px; font-weight: 600;
  cursor: pointer; transition: all var(--transition-fast);
}
.btn-save:hover { opacity: 0.9; }

.blacklist-form { display: flex; gap: 6px; margin-bottom: 10px; }
.blacklist-form .setting-input { flex: 1; width: auto; }
.btn-add {
  padding: 5px 14px; border: 1px solid var(--primary-color); border-radius: var(--radius-sm);
  background: var(--primary-light); color: var(--primary-color); font-size: 12px;
  cursor: pointer; font-weight: 500;
}
.btn-add:hover { background: var(--primary-color); color: white; }

.blacklist-list {}
.empty-hint { font-size: 12px; color: var(--text-muted); text-align: center; padding: 12px; }
.blacklist-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 0; border-bottom: 1px solid var(--border-color);
}
.item-icon { font-size: 14px; color: var(--text-muted); }
.item-domain { flex: 1; font-size: 13px; color: var(--text-primary); }
.item-remove {
  width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; border-radius: var(--radius-sm);
  cursor: pointer; color: var(--text-muted); font-size: 13px;
}
.item-remove:hover { color: #ef4444; background: rgba(239,68,68,0.1); }

.about-card {
  padding: 16px; background: var(--app-surface); border: 1px solid var(--border-color);
  border-radius: var(--radius-lg); text-align: center;
}
.about-name { font-size: 16px; font-weight: 700; color: var(--text-primary); }
.about-version { font-size: 12px; color: var(--primary-color); margin: 4px 0 8px; }
.about-desc { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; }
.about-tech { font-size: 11px; color: var(--text-muted); opacity: 0.7; }

.danger-zone {}
.btn-danger {
  width: 100%; padding: 9px; border: 1px solid #ef4444; border-radius: var(--radius-md);
  background: transparent; color: #ef4444; font-size: 13px; font-weight: 500;
  cursor: pointer; transition: all var(--transition-fast);
}
.btn-danger:hover { background: #ef4444; color: white; }

.confirm-clear { padding: 12px; background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.2); border-radius: var(--radius-md); }
.confirm-text { font-size: 13px; color: var(--text-secondary); margin: 0 0 10px; }
.confirm-actions { display: flex; gap: 8px; }
.btn-cancel { padding: 6px 14px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: var(--app-surface); color: var(--text-secondary); font-size: 12px; cursor: pointer; }
</style>
