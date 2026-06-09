﻿﻿﻿﻿﻿<script setup lang="ts">
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
  background: var(--color-bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.diagnostics-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: 10px 12px;
  background: var(--color-bg-base);
  cursor: pointer;
  transition: background 0.15s;
}

.diagnostics-header:hover {
  background: var(--color-primary-light);
}

.diagnostics-title {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--fs-md);
  font-weight: 600;
  color: var(--color-text-primary);
}

.diagnostics-summary {
  display: flex;
  gap: var(--space-xs);
}

.summary-badge {
  min-width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--color-text-inverse);
}

.summary-badge--error {
  background: var(--color-danger);
}

.summary-badge--warning {
  background: var(--color-warning);
}

.summary-badge--info {
  background: var(--color-info);
}

.diagnostics-content {
  padding: var(--space-lg);
}

.system-status {
  margin-bottom: var(--space-xl);
}

.status-section {
  background: var(--color-bg-base);
  border-radius: var(--radius-sm);
  padding: 10px;
}

.status-title {
  font-size: var(--fs-base);
  font-weight: 600;
  color: var(--color-text-muted);
  margin-bottom: var(--space-md);
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-md);
}

.status-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  background: var(--color-danger-light);
}

.status-item--ok {
  background: var(--color-success-light);
}

.status-item span:first-child {
  font-size: var(--fs-md);
  color: var(--color-text-muted);
}

.status-item span:nth-child(2) {
  flex: 1;
  font-size: var(--fs-base);
  color: var(--color-text-secondary);
}

.status-badge {
  font-size: var(--fs-xs);
  padding: 1px 5px;
  border-radius: var(--radius-xs);
  font-weight: 600;
}

.status-badge--ok {
  background: var(--color-success-light);
  color: var(--color-success);
}

.status-badge--error {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.status-badge--warning {
  background: var(--color-warning-light);
  color: var(--color-warning);
}

.status-badge--info {
  background: var(--color-info-light);
  color: var(--color-info);
}

.issues-section {
  margin-bottom: var(--space-xl);
}

.issues-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.issues-title {
  font-size: var(--fs-md);
  font-weight: 600;
  color: var(--color-text-primary);
}

.issues-actions {
  display: flex;
  gap: var(--space-sm);
}

.category-filter {
  padding: 4px 8px;
  font-size: var(--fs-base);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-base);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 4px 8px;
  font-size: var(--fs-base);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: var(--color-text-inverse);
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover {
  filter: brightness(1.1);
}

.action-btn--secondary {
  background: var(--color-bg-base);
  border-color: var(--color-border);
  color: var(--color-text-secondary);
}

.action-btn--secondary:hover {
  background: var(--color-primary-light);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.issues-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.issue-item {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-md);
  border-radius: var(--radius-sm);
  background: var(--color-bg-base);
}

.issue--error {
  border-left: 3px solid var(--color-danger);
}

.issue--warning {
  border-left: 3px solid var(--color-warning);
}

.issue--info {
  border-left: 3px solid var(--color-info);
}

.issue-icon {
  font-size: var(--fs-xl);
  flex-shrink: 0;
}

.issue--error .issue-icon { color: var(--color-danger); }
.issue--warning .issue-icon { color: var(--color-warning); }
.issue--info .issue-icon { color: var(--color-info); }

.issue-content {
  flex: 1;
  min-width: 0;
}

.issue-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: var(--space-xs);
}

.issue-category {
  font-size: var(--fs-xs);
  padding: 1px 4px;
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-radius: var(--radius-xs);
  font-weight: 600;
}

.issue-time {
  font-size: var(--fs-xs);
  color: var(--color-text-muted);
}

.issue-message {
  font-size: var(--fs-base);
  color: var(--color-text-primary);
  margin-bottom: var(--space-xs);
}

.issue-details {
  font-size: var(--fs-sm);
  color: var(--color-text-muted);
  background: var(--color-primary-light);
  border-radius: var(--radius-xs);
  padding: var(--space-sm);
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
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.issue-resolve:hover {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  padding: 20px;
  background: var(--color-success-light);
  border-radius: var(--radius-sm);
  color: var(--color-success);
  font-size: var(--fs-md);
}

.empty-state span:first-child {
  font-size: var(--fs-2xl);
}

.diagnostics-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 10px;
  border-top: 1px solid var(--color-border);
}

.rotated {
  transform: rotate(-90deg);
}
</style>