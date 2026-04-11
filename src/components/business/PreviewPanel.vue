<script setup lang="ts">
import { useUIStore } from '@/stores/ui'
import { useHistoryStore } from '@/stores/history'
import { formatTime, getFaviconUrl, safeOpenUrl, sanitizeUrl, onFaviconError } from '@/utils/helpers'

const ui = useUIStore()
const history = useHistoryStore()

function copyUrl() {
  if (ui.previewRecord?.url) {
    navigator.clipboard.writeText(ui.previewRecord.url)
    ui.notify('已复制', 'info')
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
        <img :src="getFaviconUrl(ui.previewRecord?.url)" class="preview-favicon" @error="onFaviconError($event, ui.previewRecord?.url || '')" />
        <div class="preview-title-wrap">
          <div class="preview-title">{{ ui.previewRecord?.title || '无标题' }}</div>
          <div class="preview-domain">{{ ui.previewRecord?.domain }}</div>
        </div>
        <button class="preview-close" @click="ui.closePreview()">
          <span class="i-lucide:x" />
        </button>
      </div>
      <div class="preview-body">
        <div class="preview-row">
          <span class="preview-label">网址</span>
          <span class="preview-value preview-url">{{ sanitizeUrl(ui.previewRecord?.url) }}</span>
        </div>
        <div class="preview-row">
          <span class="preview-label">访问时间</span>
          <span class="preview-value">{{ formatTime(ui.previewRecord?.lastVisitTime) }}</span>
        </div>
        <div class="preview-row">
          <span class="preview-label">访问次数</span>
          <span class="preview-value">{{ ui.previewRecord?.visitCount || 0 }} 次</span>
        </div>
        <div class="preview-row">
          <span class="preview-label">已收藏</span>
          <span class="preview-value">{{ history.favoriteSet.has(ui.previewRecord?.url) ? '是' : '否' }}</span>
        </div>
      </div>
      <div class="preview-actions">
        <button class="preview-btn primary" @click="openUrl(ui.previewRecord?.url)">
          <span class="i-lucide:external-link" />打开
        </button>
        <button class="preview-btn" @click="copyUrl">
          <span class="i-lucide:copy" />复制链接
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.3);
  display: flex; align-items: center; justify-content: center;
  z-index: 150; animation: fadeIn 120ms ease;
}
.preview-card {
  width: 340px; background: var(--app-surface);
  border-radius: var(--radius-xl); box-shadow: var(--shadow-lg);
  padding: 16px; animation: slideUp 150ms ease;
}
.preview-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.preview-favicon { width: 28px; height: 28px; border-radius: 4px; object-fit: contain; flex-shrink: 0; }
.preview-title-wrap { flex: 1; min-width: 0; }
.preview-title { font-size: 14px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.preview-domain { font-size: 11px; color: var(--text-muted); }
.preview-close {
  width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; color: var(--text-muted);
  border-radius: var(--radius-sm); cursor: pointer; font-size: 14px;
}
.preview-close:hover { background: var(--primary-light); }
.preview-body { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
.preview-row { display: flex; gap: 8px; }
.preview-label { font-size: 11px; color: var(--text-muted); width: 60px; flex-shrink: 0; }
.preview-value { font-size: 12px; color: var(--text-primary); flex: 1; min-width: 0; word-break: break-all; }
.preview-url { font-size: 11px; color: var(--primary-color); }
.preview-actions { display: flex; gap: 8px; }
.preview-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px;
  padding: 8px; border: 1px solid var(--border-color); border-radius: var(--radius-md);
  background: var(--app-surface); color: var(--text-secondary);
  font-size: 12px; cursor: pointer; transition: all var(--transition-fast);
}
.preview-btn:hover { border-color: var(--primary-color); color: var(--primary-color); }
.preview-btn.primary { background: var(--primary-color); color: white; border-color: var(--primary-color); }
.preview-btn.primary:hover { opacity: 0.9; }
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes slideUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
</style>
