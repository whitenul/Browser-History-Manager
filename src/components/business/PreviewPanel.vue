<script setup lang="ts">
import { useUIStore } from '@/stores/ui'
import { useHistoryStore } from '@/stores/history'
import { formatTime, getFaviconUrl, safeOpenUrl, sanitizeUrl, onFaviconError } from '@/utils/helpers'
import { useI18n } from '@/i18n'

const ui = useUIStore()
const history = useHistoryStore()
const { t } = useI18n()

function copyUrl() {
  if (ui.previewRecord?.url) {
    navigator.clipboard.writeText(ui.previewRecord.url)
    ui.notify(t('preview.copied'), 'info')
  }
}

function openUrl(url?: string) {
  if (url) safeOpenUrl(url)
}
</script>

<template>
  <div class="preview-overlay" @click="ui.closePreview()">
    <div class="preview-card" @click.stop>
      <div class="preview-header">
        <img :src="getFaviconUrl(ui.previewRecord?.url || '')" class="preview-favicon" @error="onFaviconError($event, ui.previewRecord?.url || '')" />
        <div class="preview-title-wrap">
          <div class="preview-title">{{ ui.previewRecord?.title || t('preview.noTitle') }}</div>
          <div class="preview-domain">{{ ui.previewRecord?.domain }}</div>
        </div>
        <button class="preview-close" @click="ui.closePreview()">
          <span class="i-lucide:x" />
        </button>
      </div>
      <div class="preview-body">
        <div class="preview-row">
          <span class="preview-label">{{ t('preview.url') }}</span>
          <span class="preview-value preview-url">{{ sanitizeUrl(ui.previewRecord?.url || '') }}</span>
        </div>
        <div class="preview-row">
          <span class="preview-label">{{ t('preview.visitTime') }}</span>
          <span class="preview-value">{{ formatTime(ui.previewRecord?.lastVisitTime || 0, t) }}</span>
        </div>
        <div class="preview-row">
          <span class="preview-label">{{ t('preview.visitCount') }}</span>
          <span class="preview-value">{{ t('preview.visitCountTimes', { count: ui.previewRecord?.visitCount || 0 }) }}</span>
        </div>
        <div class="preview-row">
          <span class="preview-label">{{ t('preview.favorited') }}</span>
          <span class="preview-value">{{ history.favoriteSet.has(ui.previewRecord?.url || '') ? t('preview.yes') : t('preview.no') }}</span>
        </div>
      </div>
      <div class="preview-actions">
        <button class="preview-btn primary" @click="openUrl(ui.previewRecord?.url)">
          <span class="i-lucide:external-link" />{{ t('preview.open') }}
        </button>
        <button class="preview-btn" @click="copyUrl">
          <span class="i-lucide:copy" />{{ t('preview.copyUrl') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview-overlay {
  position: fixed; inset: 0; background: var(--color-bg-overlay);
  display: flex; align-items: center; justify-content: center;
  z-index: 150; animation: fadeIn 120ms ease;
}
.preview-card {
  width: 340px; background: var(--color-bg-surface);
  border-radius: var(--radius-xl); box-shadow: var(--shadow-lg);
  padding: 16px; animation: slideUp 150ms ease;
}
.preview-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.preview-favicon { width: 28px; height: 28px; border-radius: var(--radius-sm); object-fit: contain; flex-shrink: 0; }
.preview-title-wrap { flex: 1; min-width: 0; }
.preview-title { font-size: var(--fs-xl); font-weight: 600; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.preview-domain { font-size: var(--fs-base); color: var(--color-text-muted); }
.preview-close {
  width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; color: var(--color-text-muted);
  border-radius: var(--radius-sm); cursor: pointer; font-size: var(--fs-xl);
}
.preview-close:hover { background: var(--color-primary-light); }
.preview-body { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
.preview-row { display: flex; gap: 8px; }
.preview-label { font-size: var(--fs-base); color: var(--color-text-muted); width: 60px; flex-shrink: 0; }
.preview-value { font-size: var(--fs-md); color: var(--color-text-primary); flex: 1; min-width: 0; word-break: break-all; }
.preview-url { font-size: var(--fs-base); color: var(--color-primary); }
.preview-actions { display: flex; gap: 8px; }
.preview-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px;
  padding: 8px; border: 1px solid var(--color-border); border-radius: var(--radius-md);
  background: var(--color-bg-surface); color: var(--color-text-secondary);
  font-size: var(--fs-md); cursor: pointer; transition: all var(--transition-hover);
}
.preview-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
.preview-btn.primary { background: var(--color-primary); color: var(--color-text-inverse); border-color: var(--color-primary); }
.preview-btn.primary:hover { opacity: 0.9; }
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes slideUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
</style>
