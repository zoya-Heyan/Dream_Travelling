<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import DayTabs from '@/components/DayTabs.vue'
import HeroGlassBackdrop from '@/components/HeroGlassBackdrop.vue'
import TripMap from '@/components/TripMap.vue'
import { useTripsStore } from '@/stores/trips'
import type { Item } from '@/types/trip'
import { formatDisplayDate } from '@/utils/dates'

const props = defineProps<{
  id: string
}>()

const store = useTripsStore()
const loading = ref(true)
const notFound = ref(false)
const filterDayId = ref('')
const selectedId = ref('')

const bundle = computed(() => store.activeBundle)

const visibleItems = computed<Item[]>(() => {
  const data = bundle.value
  if (!data) return []
  if (filterDayId.value) {
    return data.items
      .filter((item) => item.dayId === filterDayId.value)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }
  const dayOrder = new Map(data.days.map((day) => [day.id, day.dayIndex]))
  return [...data.items].sort((a, b) => {
    const dayA = dayOrder.get(a.dayId) ?? 0
    const dayB = dayOrder.get(b.dayId) ?? 0
    if (dayA !== dayB) return dayA - dayB
    return a.sortOrder - b.sortOrder
  })
})

async function hydrate(): Promise<void> {
  loading.value = true
  notFound.value = false
  filterDayId.value = ''
  selectedId.value = ''
  const data = await store.loadTripBundle(props.id)
  notFound.value = !data
  loading.value = false
}

onMounted(() => {
  void hydrate()
})

watch(
  () => props.id,
  () => {
    void hydrate()
  },
)
</script>

<template>
  <main class="page map-page photo-shell">
    <HeroGlassBackdrop />
    <div class="page-content">
      <div v-if="loading" class="state">加载地图…</div>

      <div v-else-if="notFound" class="state">
        <p>找不到这条行程。</p>
        <RouterLink class="btn btn-primary" to="/">回到首页</RouterLink>
      </div>

      <template v-else-if="bundle">
        <header class="topbar">
          <div>
            <RouterLink class="back" :to="`/trips/${id}`">← 返回编辑</RouterLink>
            <p class="destination">{{ bundle.trip.destination }}</p>
            <h1>{{ bundle.trip.title }}</h1>
            <p class="meta">
              {{ formatDisplayDate(bundle.trip.startDate) }} —
              {{ formatDisplayDate(bundle.trip.endDate) }}
              · 地图查看
            </p>
          </div>
          <div class="top-actions">
            <RouterLink class="btn btn-secondary" :to="`/trips/${id}/preview`">预览</RouterLink>
          </div>
        </header>

        <div class="filters">
          <button
            type="button"
            class="all-tab glass-panel"
            :class="{ active: !filterDayId }"
            @click="filterDayId = ''"
          >
            <span class="day-label">全部</span>
            <span class="day-date">全程</span>
          </button>
          <DayTabs v-model="filterDayId" :days="bundle.days" />
        </div>

        <TripMap
          show-list
          :destination="bundle.trip.destination"
          :items="visibleItems"
          :days="bundle.days"
          :selected-id="selectedId"
          @select="selectedId = $event"
        />
      </template>
    </div>
  </main>
</template>

<style scoped>
.map-page {
  position: relative;
  z-index: 0;
  width: min(100% - 2rem, 1120px);
  padding-bottom: 4rem;
}

.page-content {
  position: relative;
  z-index: 1;
}

.state {
  padding: 4rem 0;
  text-align: center;
  color: var(--ink-soft-on-photo);
  display: grid;
  gap: 1rem;
  justify-items: center;
}

.topbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.1rem;
}

.back {
  color: var(--ink-on-photo);
  font-weight: 700;
  font-size: 0.92rem;
}

.destination {
  margin: 0.55rem 0 0;
  color: #0d5c54;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-size: 0.8rem;
}

h1 {
  margin: 0.25rem 0 0;
  font-family: var(--font-display);
  font-size: clamp(1.8rem, 4vw, 2.4rem);
  line-height: 1.15;
  color: var(--ink-on-photo);
}

.meta {
  margin: 0.45rem 0 0;
  color: var(--ink-soft-on-photo);
  font-weight: 500;
}

.top-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
}

.filters {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  margin-bottom: 0.85rem;
  overflow-x: auto;
}

.all-tab {
  flex: 0 0 auto;
  min-width: 5.5rem;
  border-radius: 14px;
  padding: 0.7rem 0.9rem;
  text-align: left;
  cursor: pointer;
}

.all-tab:hover,
.all-tab.active {
  background: var(--glass-bg-hover) !important;
  border-color: rgba(255, 255, 255, 0.45) !important;
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

.filters :deep(.day-tabs) {
  padding-bottom: 0;
}
</style>
