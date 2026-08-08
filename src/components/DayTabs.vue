<script setup lang="ts">
import type { Day } from '@/types/trip'
import { formatDisplayDate } from '@/utils/dates'

defineProps<{
  days: Day[]
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [dayId: string]
}>()
</script>

<template>
  <div class="day-tabs" role="tablist" aria-label="行程天数">
    <button
      v-for="day in days"
      :key="day.id"
      type="button"
      role="tab"
      class="day-tab"
      :class="{ active: day.id === modelValue }"
      :aria-selected="day.id === modelValue"
      @click="emit('update:modelValue', day.id)"
    >
      <span class="day-label">Day {{ day.dayIndex + 1 }}</span>
      <span class="day-date">{{ formatDisplayDate(day.date) }}</span>
    </button>
  </div>
</template>

<style scoped>
.day-tabs {
  display: flex;
  gap: 0.6rem;
  overflow-x: auto;
  padding: 0.2rem 0.1rem 0.6rem;
  scrollbar-width: thin;
}

.day-tab {
  flex: 0 0 auto;
  min-width: 7.5rem;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.65);
  padding: 0.7rem 0.9rem;
  text-align: left;
  cursor: pointer;
  transition:
    background 180ms var(--ease),
    color 180ms var(--ease),
    transform 180ms var(--ease),
    border-color 180ms var(--ease);
}

.day-tab:hover {
  transform: translateY(-1px);
}

.day-tab.active {
  background: var(--deep);
  border-color: var(--deep);
  color: #f4fffd;
}

.day-label {
  display: block;
  font-weight: 700;
  font-size: 0.95rem;
}

.day-date {
  display: block;
  margin-top: 0.15rem;
  font-size: 0.78rem;
  opacity: 0.8;
}
</style>
