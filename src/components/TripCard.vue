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
</script>

<template>
  <article class="trip-card glass-panel">
    <RouterLink class="trip-link" :to="`/trips/${trip.id}`">
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
  transition: transform 220ms var(--ease), background 220ms var(--ease);
}

.trip-card:hover {
  transform: translateY(-3px);
  background: var(--glass-bg-hover) !important;
}

.trip-link {
  display: block;
  padding: 1.25rem 1.25rem 2.75rem;
  position: relative;
  z-index: 1;
  color: var(--glass-text);
}

.destination {
  margin: 0;
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--glass-text);
  font-weight: 700;
}

h3 {
  margin: 0.35rem 0 0.5rem;
  font-family: var(--font-display);
  font-size: 1.45rem;
  line-height: 1.2;
  color: var(--glass-text);
}

.meta {
  margin: 0;
  color: var(--glass-text-soft);
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
