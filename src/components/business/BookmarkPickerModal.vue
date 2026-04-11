<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUIStore } from '@/stores/ui'

const ui = useUIStore()

function getHostname(url: string) {
  try { return new URL(url).hostname } catch { return url }
}

interface BmFolder {
  id: string
  title: string
  children?: BmFolder[]
  depth: number
}

const folders = ref<BmFolder[]>([])
const selectedId = ref<string>('')
const saving = ref(false)

onMounted(async () => {
  try {
    const tree = await chrome.bookmarks.getTree()
    function extract(node: chrome.bookmarks.BookmarkTreeNode, depth: number): BmFolder[] | undefined {
      if (!node.children) return undefined
      const result: BmFolder[] = []
      for (const child of node.children) {
        if (child.id === '0') continue
        const folder: BmFolder = { id: child.id, title: child.title || '未命名', depth }
        if (child.children) folder.children = extract(child, depth + 1)
        result.push(folder)
      }
      return result
    }
    folders.value = extract(tree[0], 0) || []
    if (folders.value.length > 0 && !selectedId.value) {
      selectedId.value = folders.value[0].id
    }
  } catch { /* ignore */ }
})

async function saveToBookmark() {
  if (!selectedId.value || !ui.bookmarkTarget) return
  saving.value = true
  try {
    await chrome.bookmarks.create({
      parentId: selectedId.value,
      title: ui.bookmarkTarget.title,
      url: ui.bookmarkTarget.url,
    })
    ui.notify('已添加到书签', 'success')
    ui.closeBookmarkPicker()
  } catch (e) {
    console.error('Bookmark create failed:', e)
    ui.notify('添加失败', 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="ui.closeBookmarkPicker()">
    <div class="modal-content">
      <div class="modal-header">
        <h3>添加到书签</h3>
        <button class="close-btn" @click="ui.closeBookmarkPicker()">
          <span class="i-lucide:x" />
        </button>
      </div>

      <div v-if="ui.bookmarkTarget" class="target-info">
        <img :src="'chrome://favicon/size/16/' + getHostname(ui.bookmarkTarget.url)"
          class="target-favicon" loading="lazy"
          @error="($event.target as HTMLImageElement).style.display='none'" />
        <div class="target-text">
          <div class="target-title">{{ ui.bookmarkTarget.title }}</div>
          <div class="target-url">{{ getHostname(ui.bookmarkTarget.url) }}</div>
        </div>
      </div>

      <div class="folder-label">选择目标文件夹</div>
      <div class="folder-tree">
        <BmFolderItem
          v-for="f in folders"
          :key="f.id"
          :folder="f"
          :selected-id="selectedId"
          @select="selectedId = $event"
        />
      </div>

      <div class="footer-actions">
        <button class="btn-cancel" @click="ui.closeBookmarkPicker()">取消</button>
        <button class="btn-save" :disabled="!selectedId || saving" @click="saveToBookmark()">
          {{ saving ? '保存中...' : '保存到书签' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, h, PropType, type VNode } from 'vue'

const BmFolderItem = defineComponent({
  name: 'BmFolderItem',
  props: {
    folder: { type: Object as PropType<{ id: string; title: string; children?: any[]; depth: number }>, required: true },
    selectedId: { type: String, default: '' },
  },
  emits: ['select'],
  setup(props, { emit }): () => VNode {
    return (): VNode => h('div', {}, [
      h('div', {
        style: `display:flex;align-items:center;gap:6px;padding:${props.folder.depth > 1 ? '4px' : '6px'} ${8 + props.folder.depth * 16}px;cursor:pointer;border-radius:4px;transition:background .15s ease;${props.selectedId === props.folder.id ? 'background:var(--primary-light);color:var(--primary-color)' : ''}`,
        onClick: () => emit('select', props.folder.id),
        onMouseenter(e: Event) { if (props.selectedId !== props.folder.id) (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.06)' },
        onMouseleave(e: Event) { if (props.selectedId !== props.folder.id) (e.currentTarget as HTMLElement).style.background = 'transparent' },
      }, [
        h('span', {
          class: props.folder.children ? 'i-lucide i-lucide-folder' : 'i-lucide i-lucide-folder-open',
          style: `width:14px;height:14px;color:#fbbf24;display:inline-flex;align-items:center;flex-shrink:0;`,
        }),
        h('span', { style: `font-size:13px;font-weight:${props.selectedId === props.folder.id ? '600' : '400'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;` }, props.folder.title),
      ]),
      ...(props.folder.children?.map((child: any): VNode =>
        h(BmFolderItem, { key: child.id, folder: { ...child, depth: props.folder.depth + 1 }, selectedId: props.selectedId, onSelect: ($event: string) => emit('select', $event) })
      ) || []),
    ])
  },
})

export default { components: { BmFolderItem } }
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 100; animation: fadeIn var(--transition-fast);
}
.modal-content {
  width: 340px; max-height: 420px;
  background: var(--app-surface); border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg); padding: 20px;
  animation: slideUp var(--transition-normal);
}

.modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.modal-header h3 { font-size: 16px; font-weight: 600; margin: 0; color: var(--text-primary); }
.close-btn {
  width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; border-radius: var(--radius-sm);
  cursor: pointer; color: var(--text-muted); font-size: 16px;
}
.close-btn:hover { background: var(--primary-light); }

.target-info {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; background: var(--app-bg); border: 1px solid var(--border-color);
  border-radius: var(--radius-md); margin-bottom: 12px;
}
.target-favicon { width: 22px; height: 22px; border-radius: 3px; object-fit: contain; flex-shrink: 0; }
.target-text { flex: 1; min-width: 0; }
.target-title { font-size: 13px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.target-url { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

.folder-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px; }

.folder-tree {
  max-height: 200px; overflow-y: auto;
  border: 1px solid var(--border-color); border-radius: var(--radius-md);
  padding: 4px 0; margin-bottom: 14px;
}
.folder-tree::-webkit-scrollbar { width: 5px; }
.folder-tree::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }

.footer-actions { display: flex; gap: 8px; justify-content: flex-end; }
.btn-cancel {
  padding: 7px 16px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);
  background: transparent; color: var(--text-secondary); font-size: 12px; cursor: pointer;
}
.btn-cancel:hover { background: var(--primary-light); }
.btn-save {
  padding: 7px 18px; border: none; border-radius: var(--radius-sm);
  background: var(--primary-color); color: white; font-size: 12px; font-weight: 500;
  cursor: pointer; transition: all var(--transition-fast);
}
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-save:not(:disabled):hover { opacity: 0.9; }

@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes slideUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
</style>
