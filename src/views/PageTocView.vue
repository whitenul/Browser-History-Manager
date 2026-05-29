<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { usePageTocStore, type TreeNode } from '@/stores/pageToc'
import { useI18n } from '@/i18n'

const toc = usePageTocStore()
const { t } = useI18n()

const DEPTH_PAD = 16 // px per depth level

function handleClick(headingId: string) {
  toc.scrollToHeading(headingId)
}

function toggleExpand(node: TreeNode, e: MouseEvent) {
  e.stopPropagation()
  toc.toggleNode(node)
}

function getLevelClass(level: number): string {
  return `toc-h${Math.min(level, 6)}`
}

// Warning messages
const warnings = computed(() => {
  const w: string[] = []
  if (toc.stats.hasNoH1) w.push(t('toc.warningNoH1'))
  if (toc.stats.errorCount > 0) w.push(t('toc.warningSkippedLevel', { count: toc.stats.errorCount }))
  if (toc.stats.emptyCount > 0) w.push(t('toc.warningEmpty', { count: toc.stats.emptyCount }))
  return w
})

onMounted(() => {
  toc.extractHeadings()
})
</script>

<template>
  <div class="toc-view">
    <!-- Header: page info + toolbar -->
    <div class="toc-header">
      <div class="toc-page-info" v-if="toc.pageTitle">
        <span class="toc-page-title" :title="toc.pageTitle">{{ toc.pageTitle }}</span>
        <span class="toc-heading-count" v-if="toc.stats.total > 0">{{ toc.stats.total }}</span>
      </div>
      <div class="toc-toolbar">
        <button class="toc-tool-btn" @click="toc.expandAll()" :title="t('toc.expandAll')">
          <span class="i-lucide:unfold-vertical" />
        </button>
        <button class="toc-tool-btn" @click="toc.collapseAll()" :title="t('toc.collapseAll')">
          <span class="i-lucide:fold-vertical" />
        </button>
        <button class="toc-tool-btn" @click="toc.extractHeadings()" :disabled="toc.loading" :title="t('toc.refresh')">
          <span :class="['i-lucide:refresh-cw', { 'spinning': toc.loading }]" />
        </button>
      </div>
    </div>

    <!-- Search bar -->
    <div class="toc-search" v-if="toc.headings.length > 0">
      <span class="i-lucide:search toc-search-icon" />
      <input
        v-model="toc.searchQuery"
        class="toc-search-input"
        :placeholder="t('toc.searchPlaceholder')"
        type="text"
      />
      <button v-if="toc.searchQuery" class="toc-search-clear" @click="toc.searchQuery = ''">
        <span class="i-lucide:x" />
      </button>
    </div>

    <!-- Warnings -->
    <div v-if="warnings.length > 0 && !toc.loading && !toc.error" class="toc-warnings">
      <div v-for="(w, i) in warnings" :key="i" class="toc-warning-item">
        <span class="i-lucide:alert-triangle" />
        <span>{{ w }}</span>
      </div>
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

    <!-- Tree view -->
    <div v-else-if="toc.flatTree.length > 0" class="toc-tree">
      <div
        v-for="{ node, depth } in toc.flatTree"
        :key="node.heading.id"
        :class="[
          'toc-item',
          getLevelClass(node.heading.level),
          {
            'toc-item--active': toc.activeHeadingId === node.heading.id,
            'toc-item--error': node.heading.levelError,
            'toc-item--empty': node.heading.isEmpty,
            'toc-item--hidden': node.heading.isHidden,
            'toc-item--root': node.heading.inSectioningRoot,
            'toc-item--aria': node.heading.isAriaHeading,
          }
        ]"
        :style="{ paddingLeft: (depth * DEPTH_PAD + 8) + 'px' }"
        @click="handleClick(node.heading.id)"
        :title="node.heading.text"
      >
        <!-- Expand/collapse toggle -->
        <span
          v-if="node.children.length > 0"
          :class="['toc-toggle', { 'toc-toggle--collapsed': !node.expanded }]"
          @click="toggleExpand(node, $event)"
        >
          <span class="i-lucide:chevron-down" />
        </span>
        <span v-else class="toc-toggle-placeholder" />

        <!-- Level badge -->
        <span :class="['toc-level-badge', `toc-level-badge--h${node.heading.level}`]">
          {{ (node.heading.tagName || `h${node.heading.level}`).toUpperCase() }}
        </span>

        <!-- ARIA indicator -->
        <span v-if="node.heading.isAriaHeading" class="toc-aria-badge" :title="t('toc.ariaHeading')">ARIA</span>

        <!-- Text -->
        <span class="toc-item-text">
          <template v-if="node.heading.isEmpty">
            <span class="toc-empty-label">{{ t('toc.emptyHeading') }}</span>
          </template>
          <template v-else>{{ node.heading.text }}</template>
        </span>

        <!-- Error indicator -->
        <span v-if="node.heading.levelError" class="toc-error-icon i-lucide:alert-triangle" />

        <!-- Hidden indicator -->
        <span v-if="node.heading.isHidden" class="toc-hidden-icon i-lucide:eye-off" />

        <!-- Sectioning root indicator -->
        <span v-if="node.heading.inSectioningRoot" class="toc-root-icon i-lucide:brackets" :title="t('toc.inSectioningRoot')" />
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="toc.headings.length === 0 && !toc.loading" class="toc-empty">
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
  gap: var(--space-md);
  min-width: 0;
  flex: 1;
}

.toc-page-title {
  font-size: var(--fs-lg);
  font-weight: 500;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toc-heading-count {
  font-size: var(--fs-base);
  color: var(--color-primary);
  background: var(--color-primary-light);
  padding: 1px 7px;
  border-radius: var(--radius-lg);
  flex-shrink: 0;
}

.toc-toolbar {
  display: flex;
  gap: var(--space-2xs);
  flex-shrink: 0;
}

.toc-tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: var(--fs-lg);
  transition: all var(--transition-hover);
}

.toc-tool-btn:hover {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.toc-tool-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Search */
.toc-search {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 6px 12px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.toc-search-icon {
  font-size: var(--fs-lg);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.toc-search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  font-size: var(--fs-md);
  outline: none;
  min-width: 0;
}

.toc-search-input::placeholder {
  color: var(--color-text-muted);
}

.toc-search-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: var(--fs-base);
  flex-shrink: 0;
}

.toc-search-clear:hover {
  color: var(--color-danger);
}

/* Warnings */
.toc-warnings {
  padding: 6px 12px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.toc-warning-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--fs-base);
  color: var(--color-warning);
  line-height: 1.5;
}

.toc-warning-item .i-lucide {
  font-size: var(--fs-md);
  flex-shrink: 0;
}

/* Loading */
.toc-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  padding: var(--space-3xl);
  color: var(--color-text-muted);
  font-size: var(--fs-lg);
}

/* Tree */
.toc-tree {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 0;
}

.toc-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 5px 12px 5px 8px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  user-select: none;
  position: relative;
}

.toc-item:hover {
  background: var(--color-primary-light);
}

.toc-item--active {
  background: var(--color-primary-light);
}

.toc-item--active .toc-item-text {
  color: var(--color-primary);
  font-weight: 500;
}

.toc-item--error {
  background: var(--color-danger-light);
}

.toc-item--error:hover {
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
}

.toc-item--empty .toc-item-text {
  font-style: italic;
  opacity: 0.6;
}

.toc-item--hidden {
  opacity: 0.5;
}

.toc-item--root {
  border-left: 2px solid color-mix(in srgb, var(--color-accent) 30%, transparent);
}

.toc-item--aria .toc-level-badge {
  border: 1px dashed currentColor;
}

/* Toggle button */
.toc-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: var(--fs-base);
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: var(--radius-xs);
  flex-shrink: 0;
  transition: transform 0.15s ease;
}

.toc-toggle:hover {
  color: var(--color-primary);
  background: var(--color-primary-light);
}

.toc-toggle--collapsed {
  transform: rotate(-90deg);
}

.toc-toggle-placeholder {
  width: 16px;
  flex-shrink: 0;
}

/* Level badges */
.toc-level-badge {
  font-size: var(--fs-xs);
  font-weight: 700;
  padding: 1px 4px;
  border-radius: var(--radius-xs);
  flex-shrink: 0;
  letter-spacing: 0.03em;
  line-height: 1.4;
  font-family: var(--font-mono, ui-monospace, monospace);
}

.toc-level-badge--h1 { background: color-mix(in srgb, var(--toc-h1) 12%, transparent); color: var(--toc-h1); }
.toc-level-badge--h2 { background: color-mix(in srgb, var(--toc-h2) 12%, transparent); color: var(--toc-h2); }
.toc-level-badge--h3 { background: color-mix(in srgb, var(--toc-h3) 12%, transparent); color: var(--toc-h3); }
.toc-level-badge--h4 { background: color-mix(in srgb, var(--toc-h4) 12%, transparent); color: var(--toc-h4); }
.toc-level-badge--h5 { background: color-mix(in srgb, var(--toc-h5) 12%, transparent); color: var(--toc-h5); }
.toc-level-badge--h6 { background: color-mix(in srgb, var(--toc-h6) 12%, transparent); color: var(--toc-h6); }

/* Text */
.toc-item-text {
  font-size: var(--fs-md);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  color: var(--color-text-primary);
}

.toc-h1 .toc-item-text { font-weight: 600; font-size: var(--fs-lg); }
.toc-h2 .toc-item-text { font-weight: 500; }

.toc-empty-label {
  font-style: italic;
  opacity: 0.5;
}

/* Error/hidden icons */
.toc-error-icon {
  font-size: var(--fs-base);
  color: var(--color-danger);
  flex-shrink: 0;
}

.toc-hidden-icon {
  font-size: var(--fs-sm);
  color: var(--color-text-muted);
  flex-shrink: 0;
  opacity: 0.6;
}

.toc-root-icon {
  font-size: var(--fs-sm);
  color: color-mix(in srgb, var(--color-accent) 60%, transparent);
  flex-shrink: 0;
}

.toc-aria-badge {
  font-size: var(--fs-xs);
  font-weight: 700;
  padding: 0px 3px;
  border-radius: var(--radius-xs);
  background: color-mix(in srgb, var(--color-accent) 12%, transparent);
  color: var(--toc-h6);
  flex-shrink: 0;
  letter-spacing: 0.05em;
  line-height: 1.5;
  font-family: var(--font-mono, ui-monospace, monospace);
}

/* Empty / error states */
.toc-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  gap: var(--space-lg);
}

.toc-empty-icon {
  font-size: var(--fs-4xl);
  color: var(--color-text-muted);
  opacity: 0.5;
}

.toc-empty-text {
  font-size: var(--fs-lg);
  color: var(--color-text-muted);
  text-align: center;
  margin: 0;
  line-height: 1.5;
}

.toc-retry-btn {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 6px 14px;
  font-size: var(--fs-md);
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
