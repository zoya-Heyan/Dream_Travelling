<script setup lang="ts">
import { computed } from 'vue'
import type { Trip } from '@/types/trip'
import { dayCount, formatDisplayDate } from '@/utils/dates'

const props = defineProps<{
  trip: Trip
}>()

const emit = defineEmits<{
  delete: [id: string]
}>()

const days = computed(() => dayCount(props.trip.startDate, props.trip.endDate))
const toneClass = computed(() => `tone-${props.trip.coverTone ?? 'teal'}`)
</script>

<template>
  <article class="trip-card" :class="toneClass">
    <RouterLink class="trip-link" :to="`/trips/${trip.id}`">
      <div class="trip-glow" aria-hidden="true" />
      <p class="destination">{{ trip.destination }}</p>
      <h3>{{ trip.title }}</h3>
      <p class="meta">
        {{ formatDisplayDate(trip.startDate) }} — {{ formatDisplayDate(trip.endDate) }}
        · {{ days }} 天
      </p>
    </RouterLink>
    <button
      type="button"
      class="btn btn-ghost delete"
      aria-label="删除行程"
      @click.stop="emit('delete', trip.id)"
    >
      删除
    </button>
  </article>
</template>

<style scoped>
.trip-card {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--line);
  transition: transform 220ms var(--ease), box-shadow 220ms var(--ease);
}

.trip-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow);
}

.trip-link {
  display: block;
  padding: 1.25rem 1.25rem 2.75rem;
  position: relative;
  z-index: 1;
}

.trip-glow {
  position: absolute;
  inset: auto -20% -40% auto;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  opacity: 0.35;
  pointer-events: none;
}

.tone-teal .trip-glow {
  background: radial-gradient(circle, #1a9b8e, transparent 70%);
}
.tone-harbor .trip-glow {
  background: radial-gradient(circle, #2f6f8f, transparent 70%);
}
.tone-sand .trip-glow {
  background: radial-gradient(circle, #c4a35a, transparent 70%);
}
.tone-forest .trip-glow {
  background: radial-gradient(circle, #3f7d5a, transparent 70%);
}

.destination {
  margin: 0;
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--teal-deep);
  font-weight: 700;
}

h3 {
  margin: 0.35rem 0 0.5rem;
  font-family: var(--font-display);
  font-size: 1.45rem;
  line-height: 1.2;
}

.meta {
  margin: 0;
  color: var(--ink-soft);
  font-size: 0.92rem;
}

.delete {
  position: absolute;
  right: 0.5rem;
  bottom: 0.45rem;
  z-index: 2;
  font-size: 0.85rem;
}
</style>
