<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { usePageTocStore, type HeadingItem } from '@/stores/pageToc'
import { useI18n } from '@/i18n'

const toc = usePageTocStore()
const { t } = useI18n()

// Indentation per heading level (px)
const LEVEL_PAD: Record<number, number> = { 1: 8, 2: 20, 3: 32, 4: 44, 5: 56 }

// Heading count by level
const headingStats = computed(() => {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const h of toc.headings) {
    counts[h.level] = (counts[h.level] || 0) + 1
  }
  return counts
})

const totalHeadings = computed(() => toc.headings.length)

function handleClick(heading: HeadingItem) {
  toc.scrollToHeading(heading.id)
}

function getLevelLabel(level: number): string {
  return `H${level}`
}

onMounted(() => {
  toc.extractHeadings()
})
</script>

<template>
  <div class="toc-view">
    <!-- Header: page info + refresh -->
    <div class="toc-header">
      <div class="toc-page-info" v-if="toc.pageTitle">
        <span class="toc-page-title" :title="toc.pageTitle">{{ toc.pageTitle }}</span>
        <span class="toc-heading-count" v-if="totalHeadings > 0">{{ totalHeadings }}</span>
      </div>
      <button class="toc-refresh-btn" @click="toc.extractHeadings()" :disabled="toc.loading" :title="t('toc.refresh')">
        <span :class="['i-lucide:refresh-cw', { 'spinning': toc.loading }]" />
      </button>
    </div>

    <!-- Loading -->
    <div v-if="toc.loading" class="toc-loading">
      <span class="i-lucide:loader spinning" />
      <span>{{ t('common.loading') }}</span>
    </div>

    <!-- Error states -->
    <div v-else-if="toc.error" class="toc-empty">
      <span :class="['toc-empty-icon', toc.error === 'noPermission' ? 'i-lucide:shield-alert' : toc.error === 'tabClosed' ? 'i-lucide:panel-right-close' : 'i-lucide:file-x']" />
      <p class="toc-empty-text">
        {{ toc.error === 'noTab' ? t('toc.noTab') :
           toc.error === 'restrictedPage' ? t('toc.restrictedPage') :
           toc.error === 'noHeadings' ? t('toc.noHeadings') :
           toc.error === 'extractFailed' ? t('toc.extractFailed') :
           toc.error === 'noPermission' ? t('toc.noPermission') :
           toc.error === 'tabClosed' ? t('toc.tabClosed') :
           t('toc.injectFailed') }}
      </p>
      <button class="toc-retry-btn" @click="toc.extractHeadings()">
        <span class="i-lucide:refresh-cw" />
        {{ t('toc.refresh') }}
      </button>
    </div>

    <!-- Heading list -->
    <div v-else-if="toc.headings.length > 0" class="toc-list">
      <div
        v-for="heading in toc.headings"
        :key="heading.id"
        :class="['toc-item', `toc-item--h${heading.level}`, { 'toc-item--active': toc.activeHeadingId === heading.id }]"
        :style="{ paddingLeft: LEVEL_PAD[heading.level] + 'px' }"
        @click="handleClick(heading)"
        :title="heading.text"
      >
        <span :class="['toc-level-badge', `toc-level-badge--h${heading.level}`]">{{ getLevelLabel(heading.level) }}</span>
        <span class="toc-item-text">{{ heading.text }}</span>
      </div>
    </div>

    <!-- Empty state (shouldn't normally reach here since errors cover it) -->
    <div v-else class="toc-empty">
      <span class="toc-empty-icon i-lucide:list" />
      <p class="toc-empty-text">{{ t('toc.noHeadings') }}</p>
    </div>
  </div>
</template>

<style scoped>
.toc-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.toc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.toc-page-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.toc-page-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toc-heading-count {
  font-size: 11px;
  color: var(--color-primary);
  background: var(--color-primary-light);
  padding: 1px 7px;
  border-radius: 10px;
  flex-shrink: 0;
}

.toc-refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: 14px;
  transition: all var(--transition-hover);
  flex-shrink: 0;
}

.toc-refresh-btn:hover {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.toc-refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toc-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px;
  color: var(--color-text-muted);
  font-size: 13px;
}

.toc-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 0;
}

.toc-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  user-select: none;
}

.toc-item:hover {
  background: var(--color-primary-light);
}

.toc-item--active {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.toc-level-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  flex-shrink: 0;
  letter-spacing: 0.02em;
  line-height: 1.4;
}

.toc-level-badge--h1 {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
}
.toc-level-badge--h2 {
  background: rgba(249, 115, 22, 0.12);
  color: #f97316;
}
.toc-level-badge--h3 {
  background: rgba(234, 179, 8, 0.12);
  color: #eab308;
}
.toc-level-badge--h4 {
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
}
.toc-level-badge--h5 {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
}

.toc-item-text {
  font-size: 13px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  color: var(--color-text-primary);
}

.toc-item--active .toc-item-text {
  color: var(--color-primary);
  font-weight: 500;
}

.toc-item--h1 .toc-item-text {
  font-weight: 600;
  font-size: 14px;
}

.toc-item--h2 .toc-item-text {
  font-weight: 500;
}

.toc-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  gap: 12px;
}

.toc-empty-icon {
  font-size: 36px;
  color: var(--color-text-muted);
  opacity: 0.5;
}

.toc-empty-text {
  font-size: 13px;
  color: var(--color-text-muted);
  text-align: center;
  margin: 0;
  line-height: 1.5;
}

.toc-retry-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  color: var(--color-primary);
  cursor: pointer;
  transition: background var(--transition-hover);
}

.toc-retry-btn:hover {
  background: var(--color-primary-light);
}

/* Spinning animation */
.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
