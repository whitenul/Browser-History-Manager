<script setup lang="ts">
import { onMounted, defineComponent, h, type VNode, PropType, ref } from 'vue'
import { useBookmarksStore, type BookmarkNode } from '@/stores/bookmarks'
import { useUIStore } from '@/stores/ui'
import { getFaviconUrl, safeOpenUrl } from '@/utils/helpers'
import { useI18n } from '@/i18n'

const store = useBookmarksStore()
const ui = useUIStore()
const { t } = useI18n()
const LEVEL_PAD = [12, 28, 44, 60]

const showAddForm = ref(false)
const addFormUrl = ref('')
const addFormTitle = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)
const newFolderInputRef = ref<HTMLInputElement | null>(null)

function countDescendants(node: BookmarkNode): number {
  if (!node.children) return 0
  let c = 0
  for (const ch of node.children) {
    if (ch.isFolder) c += countDescendants(ch)
    else c++
  }
  return c
}

function onNodeContextMenu(e: MouseEvent, node: BookmarkNode) {
  e.preventDefault()
  e.stopPropagation()
  ui.openContextMenu(e.clientX, e.clientY, 'bookmark', node)
}

function renderNode(node: BookmarkNode, level: number): VNode {
  const pad = LEVEL_PAD[Math.min(level, 3)]
  const isFolder = node.isFolder

  if (!isFolder) {
    const nodeUrl = node.url || ''
    return h('a', {
      style: `height:28px;padding:0 12px;padding-left:${pad}px;display:flex;align-items:center;cursor:pointer;user-select:none;transition:background-color .15s ease;text-decoration:none;color:var(--color-text-primary);`,
      href: nodeUrl,
      target: '_blank',
      onClick: (e: MouseEvent) => { e.preventDefault(); if (!ui.doubleClickMode) safeOpenUrl(nodeUrl) },
      onDblclick: (e: MouseEvent) => { e.preventDefault(); if (ui.doubleClickMode) safeOpenUrl(nodeUrl) },
      onContextmenu: (e: MouseEvent) => onNodeContextMenu(e, node),
      onMouseenter(e: Event) { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-primary-light)' },
      onMouseleave(e: Event) { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' },
    }, [
      h('span', { style: 'width:16px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;visibility:hidden;' }, '\u25B8'),
      h('img', {
        style: 'width:12px;height:12px;margin-right:6px;border-radius:2px;object-fit:contain;flex-shrink:0;',
        src: getFaviconUrl(nodeUrl),
        loading: 'lazy',
        onError(e: Event) { (e.target as HTMLImageElement).style.display = 'none' },
      }),
      h('span', { style: 'font-size:13px;line-height:28px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;color:var(--color-text-primary);', title: node.title.startsWith('bookmarks.') ? t(node.title) : node.title }, node.title.startsWith('bookmarks.') ? t(node.title) : node.title),
    ])
  }

  const childCount = countDescendants(node)
  const isExpanded = store.expandedSet.has(node.id)

  return h('div', {}, [
    h('div', {
      style: `height:28px;padding:0 12px;padding-left:${pad}px;display:flex;align-items:center;cursor:pointer;user-select:none;transition:background-color .15s ease;`,
      onClick: () => store.toggleFolder(node.id),
      onContextmenu: (e: MouseEvent) => onNodeContextMenu(e, node),
      onMouseenter(e: Event) { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-primary-light)' },
      onMouseleave(e: Event) { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' },
    }, [
      h('span', {
        style: `width:16px;height:28px;display:flex;align-items:center;justify-content:center;color:var(--color-text-muted);font-size:12px;transition:transform .2s ease;flex-shrink:0;${isExpanded ? 'transform:rotate(90deg)' : ''}`,
      }, '\u25B8'),
      h('span', { class: 'i-lucide i-lucide-folder', style: 'width:14px;height:14px;margin-right:6px;color:var(--color-warning);flex-shrink:0;display:inline-flex;align-items:center;' }),
      h('span', { style: 'font-size:13px;line-height:28px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;font-weight:500;color:var(--color-text-primary);', title: node.title ? (node.title.startsWith('bookmarks.') ? t(node.title) : node.title) : t('bookmarks.unnamed') }, node.title ? (node.title.startsWith('bookmarks.') ? t(node.title) : node.title) : t('bookmarks.unnamed')),
      childCount > 0 ? h('span', { style: 'font-size:11px;color:var(--color-text-muted);background:var(--color-primary-light);padding:1px 7px;border-radius:10px;margin-left:8px;flex-shrink:0;' }, String(childCount)) : null,
    ].filter(Boolean)),
    node.children && node.children.length > 0
      ? h('div', { style: `overflow:hidden;transition:max-height .25s ease-out;${!isExpanded ? 'max-height:0!important;' : ''}` }, node.children.map((child: BookmarkNode) => renderNode(child, level + 1)))
      : null,
  ].filter(Boolean))
}

const BmNode = defineComponent({
  name: 'BmNode',
  props: {
    node: { type: Object as PropType<BookmarkNode>, required: true },
    level: { type: Number, default: 0 },
  },
  setup(props) { return () => renderNode(props.node, props.level) },
})

async function onAddBookmark() {
  if (!addFormUrl.value.trim()) return
  await store.addBookmark(addFormUrl.value.trim(), addFormTitle.value.trim() || addFormUrl.value.trim())
  addFormUrl.value = ''
  addFormTitle.value = ''
  showAddForm.value = false
}

async function onRenameConfirm() {
  const val = renameInputRef.value?.value?.trim()
  if (ui.bookmarkEditTarget && val) {
    await store.renameBookmark(ui.bookmarkEditTarget.id, val)
    ui.closeBookmarkEdit()
  }
}

async function onNewFolderConfirm() {
  const val = newFolderInputRef.value?.value?.trim()
  if (val) {
    await store.createFolder(val, ui.newFolderParentId)
    ui.closeNewFolder()
  }
}

onMounted(async () => { await store.loadBookmarks(); await ui.loadDoubleClickMode() })
</script>

<template>
  <div class="bm" @contextmenu.prevent="ui.openNewFolder('0')">
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
        <button class="bm-toolbar-btn" :title="t('contextMenu.newSubfolder')" @click.stop="ui.openNewFolder('0')">
          <span class="i-lucide:folder-plus" />
        </button>
        <button class="bm-toolbar-btn" :title="t('bookmarks.addBookmark')" @click.stop="showAddForm = !showAddForm">
          <span class="i-lucide:plus" />
        </button>
      </div>
      <div v-if="showAddForm" class="add-form">
        <input v-model="addFormUrl" type="text" class="add-input" :placeholder="t('bookmarks.urlPlaceholder')" @keydown.enter="onAddBookmark" />
        <input v-model="addFormTitle" type="text" class="add-input" :placeholder="t('bookmarks.titlePlaceholder')" @keydown.enter="onAddBookmark" />
        <button class="add-btn" @click="onAddBookmark">{{ t('common.add') }}</button>
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

    <!-- Bookmark Edit Modal (Rename) -->
    <Teleport to="body">
      <div v-if="ui.showBookmarkEditModal" class="modal-overlay" @click.self="ui.closeBookmarkEdit()">
        <div class="modal-dialog">
          <div class="modal-title">{{ t('contextMenu.rename') }}</div>
          <input
            ref="renameInputRef"
            class="modal-input"
            type="text"
            :value="ui.bookmarkEditTarget?.title"
            @keydown.enter="onRenameConfirm"
            :placeholder="t('bookmarks.titlePlaceholder')"
          />
          <div class="modal-actions">
            <button class="modal-btn" @click="ui.closeBookmarkEdit()">{{ t('common.cancel') }}</button>
            <button class="modal-btn primary" @click="onRenameConfirm">{{ t('common.confirm') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Bookmark Move Modal -->
    <Teleport to="body">
      <div v-if="ui.showBookmarkMoveModal" class="modal-overlay" @click.self="ui.closeBookmarkMove()">
        <div class="modal-dialog">
          <div class="modal-title">{{ t('contextMenu.moveTo') }}</div>
          <div class="folder-list">
            <button
              v-for="folder in store.bookmarkFolders"
              :key="folder.id"
              class="folder-item"
              :style="{ paddingLeft: (12 + folder.depth * 16) + 'px' }"
              :class="{ active: ui.bookmarkMoveTarget?.parentId === folder.id }"
              @click="async () => {
                if (ui.bookmarkMoveTarget) {
                  await store.moveBookmark(ui.bookmarkMoveTarget.id, folder.id)
                  ui.closeBookmarkMove()
                }
              }"
            >
              <span class="i-lucide:folder folder-icon" />
              {{ folder.title || t('bookmarks.unnamed') }}
            </button>
          </div>
          <div class="modal-actions">
            <button class="modal-btn" @click="ui.closeBookmarkMove()">{{ t('common.cancel') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- New Folder Modal -->
    <Teleport to="body">
      <div v-if="ui.showNewFolderModal" class="modal-overlay" @click.self="ui.closeNewFolder()">
        <div class="modal-dialog">
          <div class="modal-title">{{ t('contextMenu.newSubfolder') }}</div>
          <input
            ref="newFolderInputRef"
            class="modal-input"
            type="text"
            :placeholder="t('bookmarks.folderNamePlaceholder')"
            @keydown.enter="onNewFolderConfirm"
          />
          <div class="modal-actions">
            <button class="modal-btn" @click="ui.closeNewFolder()">{{ t('common.cancel') }}</button>
            <button class="modal-btn primary" @click="onNewFolderConfirm">{{ t('common.confirm') }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.bm {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--color-bg-base);
  color: var(--color-text-primary);
}

.search-container {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--color-bg-base);
  padding: 12px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  transition: all var(--transition-hover);
}

.search-bar:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.search-icon {
  color: var(--color-text-muted);
  font-size: var(--fs-2xl);
  flex-shrink: 0;
}

.search-input {
  background: transparent;
  border: none;
  outline: none;
  color: var(--color-text-primary);
  font-size: var(--fs-lg);
  flex: 1;
  min-width: 0;
}
.search-input::placeholder { color: var(--color-text-muted); }

.bm-toolbar-btn {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border: none;
  background: transparent; border-radius: var(--radius-sm);
  cursor: pointer; color: var(--color-text-muted); font-size: var(--fs-lg);
  transition: all var(--transition-hover); flex-shrink: 0;
}
.bm-toolbar-btn:hover { background: var(--color-primary-light); color: var(--color-primary); }

.add-form {
  display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;
}
.add-input {
  flex: 1; min-width: 100px; padding: 5px 8px;
  border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  font-size: var(--fs-md); outline: none;
  background: var(--color-bg-base); color: var(--color-text-primary);
}
.add-input:focus { border-color: var(--color-primary); }
.add-btn {
  padding: 5px 12px; border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm); background: var(--color-primary);
  color: var(--color-text-inverse); font-size: var(--fs-md);
  cursor: pointer; font-weight: 500; flex-shrink: 0;
}
.add-btn:hover { opacity: 0.9; }

.bm-loading, .bm-empty {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 48px 16px; color: var(--color-text-muted); font-size: var(--fs-lg);
}
.spin {
  width: 18px; height: 18px; border: 2px solid var(--color-border);
  border-top-color: var(--color-primary); border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.tree-container {
  flex: 1; overflow-y: auto; padding: 8px 0;
}
.tree-container::-webkit-scrollbar { width: 6px; }
.tree-container::-webkit-scrollbar-track { background: transparent; }
.tree-container::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: var(--radius-sm); }
.tree-container::-webkit-scrollbar-thumb:hover { background: var(--color-text-muted); }

/* Modal styles */
.modal-overlay {
  position: fixed; inset: 0; background: var(--color-bg-overlay);
  display: flex; align-items: center; justify-content: center;
  z-index: 300; animation: modal-overlay-in 0.15s ease;
}
@keyframes modal-overlay-in { from { opacity: 0; } to { opacity: 1; } }

.modal-dialog {
  width: 320px; max-height: 80vh;
  background: var(--color-bg-surface); border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg); padding: 20px;
  animation: modal-dialog-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: flex; flex-direction: column;
}
@keyframes modal-dialog-in { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }

.modal-title { font-size: var(--fs-xl); font-weight: 600; color: var(--color-text-primary); margin-bottom: 12px; }
.modal-input {
  width: 100%; padding: 8px 12px; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); font-size: var(--fs-md);
  background: var(--color-bg-base); color: var(--color-text-primary);
  outline: none; margin-bottom: 12px;
}
.modal-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-light); }

.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
.modal-btn {
  padding: 6px 16px; border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); background: var(--color-bg-surface);
  color: var(--color-text-secondary); font-size: var(--fs-md);
  cursor: pointer; transition: all var(--transition-hover);
}
.modal-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
.modal-btn.primary {
  background: var(--color-primary); color: var(--color-text-inverse);
  border-color: var(--color-primary);
}
.modal-btn.primary:hover { opacity: 0.9; }

.folder-list {
  flex: 1; overflow-y: auto; max-height: 300px;
  border: 1px solid var(--color-border); border-radius: var(--radius-sm);
  margin-bottom: 12px;
}
.folder-item {
  display: flex; align-items: center; gap: 6px;
  width: 100%; padding: 8px 12px; border: none;
  background: transparent; color: var(--color-text-primary);
  font-size: var(--fs-md); cursor: pointer; text-align: left;
  transition: background var(--transition-hover);
}
.folder-item:hover { background: var(--color-primary-light); }
.folder-item.active { background: var(--color-primary-light); color: var(--color-primary); }
.folder-icon { font-size: var(--fs-lg); color: var(--color-warning); flex-shrink: 0; }
</style>
