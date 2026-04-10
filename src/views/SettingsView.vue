<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useThemeStore } from '@/stores/theme'
import { useUIStore } from '@/stores/ui'

const history = useHistoryStore()
const theme = useThemeStore()
const ui = useUIStore()

const newBlacklistDomain = ref('')
const clearConfirm = ref(false)

const settings = ref({
  defaultTimeRange: 'all',
  defaultGroupMode: 'none',
  defaultSortMode: 'timeDesc',
  pageSize: 100,
  sessionGapMinutes: 30,
})

onMounted(async () => {
  try {
    const result = await chrome.storage.local.get('appSettings')
    if (result.appSettings) Object.assign(settings.value, result.appSettings)
  } catch { /* ignore */ }
})

async function saveSettings() {
  try {
    await chrome.storage.local.set({ appSettings: settings.value })
    history.applySettings(settings.value.pageSize, settings.value.sessionGapMinutes)
    ui.notify('设置已保存', 'success')
  } catch { /* ignore */ }
}

async function clearAllData() {
  await chrome.storage.local.clear()
  clearConfirm.value = false
  ui.notify('所有数据已清除', 'info')
}

async function addBlacklist() {
  const d = newBlacklistDomain.value.trim()
  if (!d) return
  await history.addBlacklistDomain(d)
  newBlacklistDomain.value = ''
}

function openUrl(url: string) {
  chrome.tabs.create({ url })
}
</script>

<template>
  <div class="settings-view">
    <div class="settings-content">
      <div class="section">
        <div class="section-title">
          <span class="i-lucide:sliders section-icon" />
          默认行为
        </div>
        <div class="setting-row">
          <label>默认时间范围</label>
          <select v-model="settings.defaultTimeRange" class="setting-select">
            <option value="today">今日</option>
            <option value="3days">近3天</option>
            <option value="week">近7天</option>
            <option value="month">近30天</option>
            <option value="all">全部</option>
          </select>
        </div>
        <div class="setting-row">
          <label>默认分组方式</label>
          <select v-model="settings.defaultGroupMode" class="setting-select">
            <option value="none">不分组</option>
            <option value="domain">按域名</option>
            <option value="timeline">按时间</option>
            <option value="session">按会话</option>
          </select>
        </div>
        <div class="setting-row">
          <label>默认排序</label>
          <select v-model="settings.defaultSortMode" class="setting-select">
            <option value="timeDesc">最新优先</option>
            <option value="timeAsc">最旧优先</option>
            <option value="visitDesc">最常访问</option>
            <option value="visitAsc">最少访问</option>
          </select>
        </div>
        <div class="setting-row">
          <label>每页显示数量</label>
          <input type="number" v-model.number="settings.pageSize" min="20" max="500" class="setting-input" />
        </div>
        <div class="setting-row">
          <label>会话间隔（分钟）</label>
          <input type="number" v-model.number="settings.sessionGapMinutes" min="5" max="120" class="setting-input" />
        </div>
        <button class="btn-save" @click="saveSettings">保存设置</button>
      </div>

      <div class="section">
        <div class="section-title">
          <span class="i-lucide:ban section-icon" />
          域名黑名单
        </div>
        <p class="section-desc">黑名单中的域名将不会出现在历史记录和统计中</p>
        <div class="blacklist-form">
          <input v-model="newBlacklistDomain" type="text" placeholder="输入域名（如 example.com）" class="setting-input"
            @keydown.enter="addBlacklist" />
          <button class="btn-add" @click="addBlacklist">添加</button>
        </div>
        <div class="blacklist-list">
          <div v-if="!history.blacklistedDomains.length" class="empty-hint">暂无黑名单域名</div>
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
          关于
        </div>
        <div class="about-card">
          <div class="about-name">浏览器历史记录管理器</div>
          <div class="about-version">v2.0.0</div>
          <div class="about-desc">现代化浏览器历史记录管理工具，支持搜索、筛选、统计、书签管理</div>
          <div class="about-tech">Vue 3 · TypeScript · Pinia · UnoCSS · Vite</div>
        </div>
      </div>

      <div class="section danger-zone">
        <div class="section-title">
          <span class="i-lucide:alert-triangle section-icon danger" />
          危险操作
        </div>
        <button v-if="!clearConfirm" class="btn-danger" @click="clearConfirm = true">清除所有本地数据</button>
        <div v-else class="confirm-clear">
          <p class="confirm-text">此操作不可撤销，确定要清除所有数据吗？</p>
          <div class="confirm-actions">
            <button class="btn-cancel" @click="clearConfirm = false">取消</button>
            <button class="btn-danger" @click="clearAllData">确认清除</button>
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
