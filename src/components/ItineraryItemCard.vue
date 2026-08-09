<script setup lang="ts">
import { computed } from 'vue'
import type { Day, Item } from '@/types/trip'
import { ITEM_TYPE_LABELS } from '@/types/trip'

const props = defineProps<{
  item: Item
  days: Day[]
}>()

const emit = defineEmits<{
  edit: [item: Item]
  remove: [id: string]
  move: [itemId: string, dayId: string]
}>()

const typeLabel = computed(() => ITEM_TYPE_LABELS[props.item.type])
</script>

<template>
  <article class="item glass-panel" :data-type="item.type">
    <div class="drag-handle" aria-hidden="true" title="拖拽排序">⋮⋮</div>
    <div class="body">
      <div class="top">
        <span class="type">{{ typeLabel }}</span>
        <span v-if="item.time" class="time">{{ item.time }}</span>
      </div>
      <h4>{{ item.title }}</h4>
      <p v-if="item.place" class="place">{{ item.place }}</p>
      <p v-if="item.description" class="desc">{{ item.description }}</p>
      <p v-if="typeof item.cost === 'number'" class="cost">约 ¥{{ item.cost }}</p>
      <div class="actions">
        <button type="button" class="btn btn-ghost" @click="emit('edit', item)">编辑</button>
        <label class="move">
          <span class="sr-only">移动到另一天</span>
          <select
            :value="item.dayId"
            @change="emit('move', item.id, ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="day in days" :key="day.id" :value="day.id">
              Day {{ day.dayIndex + 1 }}
            </option>
          </select>
        </label>
        <button type="button" class="btn btn-danger" @click="emit('remove', item.id)">
          删除
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.75rem;
  padding: 0.95rem 1rem;
  border-radius: var(--radius-sm);
  border-left: 4px solid var(--teal);
}

.item[data-type='food'] {
  border-left-color: #d0894a;
}
.item[data-type='transit'] {
  border-left-color: #3d7ea6;
}
.item[data-type='stay'] {
  border-left-color: #5b7c99;
}
.item[data-type='note'] {
  border-left-color: #7a8a92;
}

.item:hover {
  box-shadow: 0 10px 24px rgba(11, 47, 56, 0.08);
}

.drag-handle {
  cursor: grab;
  color: var(--glass-text-soft);
  font-size: 0.95rem;
  line-height: 1.2;
  padding-top: 0.15rem;
  user-select: none;
}

.top {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.25rem;
}

.type {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--glass-text);
  text-transform: uppercase;
}

.time {
  font-size: 0.85rem;
  color: var(--glass-text-soft);
}

h4 {
  margin: 0;
  font-size: 1.05rem;
  color: var(--glass-text);
}

.place,
.desc,
.cost {
  margin: 0.3rem 0 0;
  color: var(--glass-text-soft);
  font-size: 0.9rem;
}

.cost {
  font-weight: 700;
  color: var(--glass-text);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.65rem;
}

.move select {
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  padding: 0.35rem 0.7rem;
  background: var(--glass-bg);
  color: var(--glass-text);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
}
</style>
