<script setup lang="ts">
import { computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { Day, Item } from '@/types/trip'
import ItineraryItemCard from '@/components/ItineraryItemCard.vue'
import EmptyState from '@/components/EmptyState.vue'

const props = defineProps<{
  items: Item[]
  days: Day[]
}>()

const emit = defineEmits<{
  reorder: [orderedIds: string[]]
  edit: [item: Item]
  remove: [id: string]
  move: [itemId: string, dayId: string]
  add: []
}>()

const localItems = computed({
  get: () => props.items,
  set: (next: Item[]) => {
    emit(
      'reorder',
      next.map((item) => item.id),
    )
  },
})
</script>

<template>
  <div class="timeline">
    <VueDraggable
      v-if="localItems.length"
      v-model="localItems"
      class="list"
      handle=".drag-handle"
      :animation="180"
      ghost-class="ghost"
      chosen-class="chosen"
    >
      <ItineraryItemCard
        v-for="item in localItems"
        :key="item.id"
        :item="item"
        :days="days"
        @edit="emit('edit', $event)"
        @remove="emit('remove', $event)"
        @move="(itemId, dayId) => emit('move', itemId, dayId)"
      />
    </VueDraggable>

    <EmptyState
      v-else
      class="glass-panel"
      title="这一天还是空白"
      description="添加景点、餐饮、交通或住宿，开始编排今天的节奏。"
    >
      <button type="button" class="btn btn-primary" @click="emit('add')">添加条目</button>
    </EmptyState>
  </div>
</template>

<style scoped>
.list {
  display: grid;
  gap: 0.75rem;
}

:deep(.ghost) {
  opacity: 0.45;
}

:deep(.chosen) {
  box-shadow: var(--shadow);
}
</style>
