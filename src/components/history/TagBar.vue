<template>
  <div class="tag-bar">
    <button class="tag-chip" :class="{ active: !activeTagId }" @click="$emit('selectTag', null)">
      {{ t('common.all') }}
    </button>
    <button v-for="tag in tags" :key="tag.id" class="tag-chip"
      :class="{ active: activeTagId === tag.id }"
      :style="{ '--tag-color': tag.color }"
      @click="$emit('selectTag', activeTagId === tag.id ? null : tag.id)">
      {{ tag.name }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '@/i18n'

const { t } = useI18n()

interface TagItem {
  id: string
  name: string
  color: string
}

defineProps<{
  tags: TagItem[]
  activeTagId: string | null
}>()

defineEmits<{
  selectTag: [tagId: string | null]
}>()
</script>

<style scoped>
.tag-bar {
  display: flex;
  gap: 6px;
  padding: 6px 12px;
  overflow-x: auto;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.tag-chip {
  padding: 2px 10px;
  font-size: var(--fs-base);
  font-weight: 500;
  color: var(--color-text-muted);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-hover);
}
.tag-chip:hover {
  border-color: var(--color-text-muted);
}
.tag-chip.active {
  background: var(--tag-color, var(--color-primary));
  color: var(--color-text-inverse);
  border-color: var(--tag-color, var(--color-primary));
}
</style>
