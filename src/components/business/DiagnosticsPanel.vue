<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useDiagnostics } from '@/stores/diagnostics'
import { useI18n } from '@/i18n'

const {
  activeIssues,
  systemStatus,
  checkSystemStatus,
  resolveIssue,
  resolveAllIssues,
  getIssueSummary,
  exportLogs,
} = useDiagnostics()

const { t } = useI18n()

const isExpanded = ref(true)
const selectedCategory = ref<string>('all')

const categories = computed(() => {
  const cats = new Set<string>()
  activeIssues.value.forEach(i => cats.add(i.category))
  return ['all', ...Array.from(cats)]
})

const filteredIssues = computed(() => {
  if (selectedCategory.value === 'all') return activeIssues.value
  return activeIssues.value.filter(i => i.category === selectedCategory.value)
})

const summary = computed(() => getIssueSummary())

function getSeverityClass(severity: string): string {
  switch (severity) {
    case 'error': return 'issue--error'
    case 'warning': return 'issue--warning'
    case 'info': return 'issue--info'
    default: return ''
  }
}

function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'error': return 'i-lucide:alert-circle'
    case 'warning': return 'i-lucide:alert-triangle'
    case 'info': return 'i-lucide:info'
    default: return 'i-lucide:help-circle'
  }
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

function copyLogs() {
  const logs = exportLogs()
  navigator.clipboard.writeText(logs).then(() => {
    alert(t('diagnostics.logsCopied'))
  })
}

onMounted(async () => {
  await checkSystemStatus()
})
</script>

<template>
  <div class="diagnostics-panel">
    <div class="diagnostics-header" @click="isExpanded = !isExpanded">
      <div class="diagnostics-title">
        <span class="i-lucide:activity" />
        <span>{{ t('diagnostics.title') }}</span>
      </div>
      <div class="diagnostics-summary">
        <span class="summary-badge summary-badge--error" v-if="summary.errors > 0">{{ summary.errors }}</span>
        <span class="summary-badge summary-badge--warning" v-if="summary.warnings > 0">{{ summary.warnings }}</span>
        <span class="summary-badge summary-badge--info" v-if="summary.info > 0">{{ summary.info }}</span>
      </div>
      <span class="i-lucide:chevron-down" :class="{ 'rotated': !isExpanded }" />
    </div>
    
    <div v-if="isExpanded" class="diagnostics-content">
      <div v-if="systemStatus" class="system-status">
        <div class="status-section">
          <div class="status-title">{{ t('diagnostics.systemStatus') }}</div>
          <div class="status-grid">
            <div class="status-item" :class="{ 'status-item--ok': systemStatus.storageAvailable }">
              <span class="i-lucide:hard-drive" />
              <span>{{ t('diagnostics.storage') }}</span>
              <span class="status-badge" :class="systemStatus.storageAvailable ? 'status-badge--ok' : 'status-badge--error'">
                {{ systemStatus.storageAvailable ? t('common.ok') : t('common.error') }}
              </span>
            </div>
            <div class="status-item" :class="{ 'status-item--ok': systemStatus.permissionsGranted }">
              <span class="i-lucide:shield" />
              <span>{{ t('diagnostics.permissions') }}</span>
              <span class="status-badge" :class="systemStatus.permissionsGranted ? 'status-badge--ok' : 'status-badge--warning'">
                {{ systemStatus.permissionsGranted ? t('common.granted') : t('common.partial') }}
              </span>
            </div>
            <div class="status-item status-item--ok">
              <span class="i-lucide:chrome" />
              <span>{{ t('diagnostics.chromeVersion') }}</span>
              <span class="status-badge status-badge--info">{{ systemStatus.chromeVersion }}</span>
            </div>
            <div class="status-item status-item--ok">
              <span class="i-lucide:extension" />
              <span>{{ t('diagnostics.manifest') }}</span>
              <span class="status-badge status-badge--info">v{{ systemStatus.manifestVersion }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div v-if="activeIssues.length > 0" class="issues-section">
        <div class="issues-header">
          <span class="issues-title">{{ t('diagnostics.issues') }} ({{ summary.active }})</span>
          <div class="issues-actions">
            <select v-model="selectedCategory" class="category-filter">
              <option v-for="cat in categories" :key="cat" :value="cat">
                {{ cat === 'all' ? t('diagnostics.all') : cat }}
              </option>
            </select>
            <button class="action-btn" @click="resolveAllIssues">
              <span class="i-lucide:check-circle" />
              {{ t('diagnostics.resolveAll') }}
            </button>
          </div>
        </div>
        
        <div class="issues-list">
          <div
            v-for="issue in filteredIssues"
            :key="issue.id"
            class="issue-item"
            :class="getSeverityClass(issue.severity)"
          >
            <span class="issue-icon" :class="getSeverityIcon(issue.severity)" />
            <div class="issue-content">
              <div class="issue-header">
                <span class="issue-category">{{ issue.category }}</span>
                <span class="issue-time">{{ formatTime(issue.timestamp) }}</span>
              </div>
              <div class="issue-message">{{ issue.message }}</div>
              <div v-if="issue.details" class="issue-details">
                <pre>{{ issue.details }}</pre>
              </div>
            </div>
            <button class="issue-resolve" @click="resolveIssue(issue.id)" :title="t('diagnostics.resolve')">
              <span class="i-lucide:x" />
            </button>
          </div>
        </div>
      </div>
      
      <div v-else class="empty-state">
        <span class="i-lucide:check-circle" />
        <span>{{ t('diagnostics.noIssues') }}</span>
      </div>
      
      <div class="diagnostics-footer">
        <button class="action-btn action-btn--secondary" @click="copyLogs">
          <span class="i-lucide:download" />
          {{ t('diagnostics.exportLogs') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.diagnostics-panel {
  background: var(--app-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.diagnostics-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--app-bg);
  cursor: pointer;
  transition: background 0.15s;
}

.diagnostics-header:hover {
  background: var(--primary-light);
}

.diagnostics-title {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.diagnostics-summary {
  display: flex;
  gap: 4px;
}

.summary-badge {
  min-width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
}

.summary-badge--error {
  background: #ef4444;
}

.summary-badge--warning {
  background: #f59e0b;
}

.summary-badge--info {
  background: #3b82f6;
}

.diagnostics-content {
  padding: 12px;
}

.system-status {
  margin-bottom: 16px;
}

.status-section {
  background: var(--app-bg);
  border-radius: var(--radius-sm);
  padding: 10px;
}

.status-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  background: rgba(239, 68, 68, 0.05);
}

.status-item--ok {
  background: rgba(16, 185, 129, 0.05);
}

.status-item span:first-child {
  font-size: 12px;
  color: var(--text-muted);
}

.status-item span:nth-child(2) {
  flex: 1;
  font-size: 11px;
  color: var(--text-secondary);
}

.status-badge {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 600;
}

.status-badge--ok {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.status-badge--error {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.status-badge--warning {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.status-badge--info {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.issues-section {
  margin-bottom: 16px;
}

.issues-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.issues-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.issues-actions {
  display: flex;
  gap: 6px;
}

.category-filter {
  padding: 4px 8px;
  font-size: 11px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--app-bg);
  color: var(--text-secondary);
  cursor: pointer;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 11px;
  border: 1px solid var(--primary-color);
  border-radius: var(--radius-sm);
  background: var(--primary-color);
  color: #fff;
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover {
  filter: brightness(1.1);
}

.action-btn--secondary {
  background: var(--app-bg);
  border-color: var(--border-color);
  color: var(--text-secondary);
}

.action-btn--secondary:hover {
  background: var(--primary-light);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.issues-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.issue-item {
  display: flex;
  gap: 8px;
  padding: 8px;
  border-radius: var(--radius-sm);
  background: var(--app-bg);
}

.issue--error {
  border-left: 3px solid #ef4444;
}

.issue--warning {
  border-left: 3px solid #f59e0b;
}

.issue--info {
  border-left: 3px solid #3b82f6;
}

.issue-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.issue--error .issue-icon { color: #ef4444; }
.issue--warning .issue-icon { color: #f59e0b; }
.issue--info .issue-icon { color: #3b82f6; }

.issue-content {
  flex: 1;
  min-width: 0;
}

.issue-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.issue-category {
  font-size: 9px;
  padding: 1px 4px;
  background: var(--primary-light);
  color: var(--primary-color);
  border-radius: 2px;
  font-weight: 600;
}

.issue-time {
  font-size: 9px;
  color: var(--text-muted);
}

.issue-message {
  font-size: 11px;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.issue-details {
  font-size: 10px;
  color: var(--text-muted);
  background: rgba(0, 0, 0, 0.03);
  border-radius: var(--radius-xs);
  padding: 6px;
  max-height: 80px;
  overflow-y: auto;
}

.issue-details pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.issue-resolve {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.issue-resolve:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  background: rgba(16, 185, 129, 0.05);
  border-radius: var(--radius-sm);
  color: #10b981;
  font-size: 12px;
}

.empty-state span:first-child {
  font-size: 16px;
}

.diagnostics-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 10px;
  border-top: 1px solid var(--border-color);
}

.rotated {
  transform: rotate(-90deg);
}
</style>