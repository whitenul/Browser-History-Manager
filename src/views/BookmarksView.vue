<script setup lang="ts">
import { onMounted, defineComponent, h, type VNode, PropType } from 'vue'
import { useBookmarksStore } from '@/stores/bookmarks'
import { getFaviconUrl, safeOpenUrl } from '@/utils/helpers'
import { useI18n } from '@/i18n'

const store = useBookmarksStore()
const { t } = useI18n()
const LEVEL_PAD = [12, 28, 44, 60]

function countDescendants(node: any): number {
  if (!node.children) return 0
  let c = 0
  for (const ch of node.children) {
    if (ch.isFolder) c += countDescendants(ch)
    else c++
  }
  return c
}

function renderNode(node: any, level: number): VNode {
  const pad = LEVEL_PAD[Math.min(level, 3)]
  const isFolder = node.isFolder

  if (!isFolder) {
    return h('a', {
      style: `height:28px;padding:0 12px;padding-left:${pad}px;display:flex;align-items:center;cursor:pointer;user-select:none;transition:background-color .15s ease;text-decoration:none;color:var(--text-primary);`,
      href: node.url,
      target: '_blank',
      onClick: (e: MouseEvent) => { e.preventDefault(); safeOpenUrl(node.url) },
      onMouseenter(e: Event) { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--primary-light)' },
      onMouseleave(e: Event) { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' },
    }, [
      h('span', { style: 'width:16px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;visibility:hidden;' }, '\u25B8'),
      h('img', {
        style: 'width:12px;height:12px;margin-right:6px;border-radius:2px;object-fit:contain;flex-shrink:0;',
        src: getFaviconUrl(node.url),
        loading: 'lazy',
        onError(e: Event) { (e.target as HTMLImageElement).style.display = 'none' },
      }),
      h('span', { style: 'font-size:13px;line-height:28px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;color:var(--text-primary);' }, node.title.startsWith('bookmarks.') ? t(node.title) : node.title),
    ])
  }

  const childCount = countDescendants(node)
  const isExpanded = store.expandedSet.has(node.id)

  return h('div', {}, [
    h('div', {
      style: `height:28px;padding:0 12px;padding-left:${pad}px;display:flex;align-items:center;cursor:pointer;user-select:none;transition:background-color .15s ease;`,
      onClick: () => store.toggleFolder(node.id),
      onMouseenter(e: Event) { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--primary-light)' },
      onMouseleave(e: Event) { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' },
    }, [
      h('span', {
        style: `width:16px;height:28px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px;transition:transform .2s ease;flex-shrink:0;${isExpanded ? 'transform:rotate(90deg)' : ''}`,
      }, '\u25B8'),
      h('span', { class: 'i-lucide i-lucide-folder', style: 'width:14px;height:14px;margin-right:6px;color:#fbbf24;flex-shrink:0;display:inline-flex;align-items:center;' }),
      h('span', { style: 'font-size:13px;line-height:28px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;font-weight:500;color:var(--text-primary);' }, node.title ? (node.title.startsWith('bookmarks.') ? t(node.title) : node.title) : t('bookmarks.unnamed')),
      childCount > 0 ? h('span', { style: 'font-size:11px;color:var(--text-muted);background:var(--primary-light);padding:1px 7px;border-radius:10px;margin-left:8px;flex-shrink:0;' }, String(childCount)) : null,
    ].filter(Boolean)),
    node.children && node.children.length > 0
      ? h('div', { style: `overflow:hidden;transition:max-height .25s ease-out;${!isExpanded ? 'max-height:0!important;' : ''}` }, node.children.map((child: any) => renderNode(child, level + 1)))
      : null,
  ].filter(Boolean))
}

const BmNode = defineComponent({
  name: 'BmNode',
  props: {
    node: { type: Object as PropType<any>, required: true },
    level: { type: Number, default: 0 },
  },
  setup(props) { return () => renderNode(props.node, props.level) },
})

onMounted(() => store.loadBookmarks())
</script>

<template>
  <div class="bm">
    <div class="search-container">
      <div class="search-bar">
        <span class="i-lucide:search search-icon" />
        <input
          class="search-input"
          type="text"
          :value="store.searchKeyword"
          @input="store.setSearch(($event.target as HTMLInputElement).value)"
          :placeholder="t('bookmarks.searchPlaceholder')"
        />
      </div>
    </div>

    <div v-if="store.isLoading" class="bm-loading"><div class="spin" />{{ t('bookmarks.loading') }}</div>
    <div v-else-if="!store.filteredBookmarks.length" class="bm-empty">{{ t('bookmarks.empty') }}</div>
    <div v-else class="tree-container">
      <BmNode
        v-for="node in store.filteredBookmarks"
        :key="node.id"
        :node="node"
        :level="0"
      />
    </div>
  </div>
</template>

<style scoped>
.bm {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--app-bg);
  color: var(--text-primary);
}

.search-container {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--app-bg);
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--app-surface);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 8px 12px;
  transition: all 0.2s ease;
}

.search-bar:focus-within {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--primary-light);
}

.search-icon {
  color: var(--text-muted);
  font-size: 16px;
  flex-shrink: 0;
}

.search-input {
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 13px;
  width: 100%;
}
.search-input::placeholder { color: var(--text-muted); }

.bm-loading, .bm-empty {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 48px 16px; color: var(--text-muted); font-size: 13px;
}
.spin {
  width: 18px; height: 18px; border: 2px solid var(--border-color);
  border-top-color: var(--primary-color); border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.tree-container {
  flex: 1; overflow-y: auto; padding: 8px 0;
}
.tree-container::-webkit-scrollbar { width: 6px; }
.tree-container::-webkit-scrollbar-track { background: transparent; }
.tree-container::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }
.tree-container::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
</style>
