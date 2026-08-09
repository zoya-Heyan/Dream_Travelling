<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AddItemSheet from '@/components/AddItemSheet.vue'
import DayTabs from '@/components/DayTabs.vue'
import DestinationWeather from '@/components/DestinationWeather.vue'
import HeroGlassBackdrop from '@/components/HeroGlassBackdrop.vue'
import ItineraryTimeline from '@/components/ItineraryTimeline.vue'
import { useTripsStore, type ItemInput } from '@/stores/trips'
import type { Item } from '@/types/trip'
import { dayCount, formatDisplayDate } from '@/utils/dates'

const props = defineProps<{
  id: string
}>()

const store = useTripsStore()
const loading = ref(true)
const notFound = ref(false)
const activeDayId = ref('')
const sheetOpen = ref(false)
const editingItem = ref<Item | null>(null)
const dayNoteDraft = ref('')
const saveHint = ref('')

const bundle = computed(() => store.activeBundle)
const activeDay = computed(
  () => bundle.value?.days.find((day) => day.id === activeDayId.value) ?? null,
)
const dayItems = computed(() =>
  activeDayId.value ? store.itemsForDay(activeDayId.value) : [],
)
const stats = computed(() =>
  bundle.value ? store.tripStats(bundle.value) : { dayCount: 0, itemCount: 0, totalCost: 0 },
)

onMounted(async () => {
  await hydrate()
})

watch(
  () => props.id,
  async () => {
    await hydrate()
  },
)

watch(activeDay, (day) => {
  dayNoteDraft.value = day?.note ?? ''
})

async function hydrate(): Promise<void> {
  loading.value = true
  notFound.value = false
  const data = await store.loadTripBundle(props.id)
  if (!data) {
    notFound.value = true
    loading.value = false
    return
  }
  activeDayId.value = data.days[0]?.id ?? ''
  loading.value = false
}

function openCreate(): void {
  editingItem.value = null
  sheetOpen.value = true
}

function openEdit(item: Item): void {
  editingItem.value = item
  sheetOpen.value = true
}

async function onSaveItem(payload: ItemInput): Promise<void> {
  if (!bundle.value || !activeDayId.value) return
  if (editingItem.value) {
    await store.updateItem(editingItem.value.id, payload)
  } else {
    await store.addItem(bundle.value.trip.id, activeDayId.value, payload)
  }
  sheetOpen.value = false
  editingItem.value = null
  flashSaved()
}

async function onRemove(itemId: string): Promise<void> {
  if (!confirm('删除这个条目？')) return
  await store.deleteItem(itemId)
  flashSaved()
}

async function onReorder(orderedIds: string[]): Promise<void> {
  if (!activeDayId.value) return
  await store.reorderDayItems(activeDayId.value, orderedIds)
  flashSaved()
}

async function onMove(itemId: string, dayId: string): Promise<void> {
  await store.moveItemToDay(itemId, dayId)
  flashSaved()
}

async function saveDayNote(): Promise<void> {
  if (!activeDayId.value) return
  await store.updateDayNote(activeDayId.value, dayNoteDraft.value)
  flashSaved()
}

function flashSaved(): void {
  saveHint.value = '已自动保存'
  window.setTimeout(() => {
    if (saveHint.value === '已自动保存') saveHint.value = ''
  }, 1600)
}
</script>

<template>
  <main class="page editor photo-shell">
    <HeroGlassBackdrop />
    <div class="page-content">
      <div v-if="loading" class="state">加载行程中…</div>

      <div v-else-if="notFound" class="state">
        <p>找不到这条行程。</p>
        <RouterLink class="btn btn-primary" to="/">回到首页</RouterLink>
      </div>

      <template v-else-if="bundle">
        <header class="topbar">
          <div>
            <RouterLink class="back" to="/">← 全部行程</RouterLink>
            <p class="destination">{{ bundle.trip.destination }}</p>
            <h1>{{ bundle.trip.title }}</h1>
            <p class="meta">
              {{ formatDisplayDate(bundle.trip.startDate) }} —
              {{ formatDisplayDate(bundle.trip.endDate) }}
              · {{ dayCount(bundle.trip.startDate, bundle.trip.endDate) }} 天
              · {{ stats.itemCount }} 个安排
              <span v-if="stats.totalCost > 0"> · 预算约 ¥{{ stats.totalCost }}</span>
            </p>
          </div>
          <div class="top-actions">
            <span v-if="saveHint" class="save-hint">{{ saveHint }}</span>
            <RouterLink class="btn btn-secondary" :to="`/trips/${id}/preview`">预览</RouterLink>
            <button type="button" class="btn btn-primary" @click="openCreate">添加条目</button>
          </div>
        </header>

        <DayTabs v-model="activeDayId" :days="bundle.days" />

        <section v-if="activeDay" class="day-panel">
          <DestinationWeather
            :destination="bundle.trip.destination"
            :date="activeDay.date"
          />

          <div class="day-note">
            <label for="day-note">今日备注</label>
            <div class="note-row">
              <input
                id="day-note"
                class="glass-panel"
                v-model="dayNoteDraft"
                placeholder="天气、主题、节奏…（可选）"
                @keydown.enter.prevent="saveDayNote"
              />
              <button type="button" class="btn btn-secondary" @click="saveDayNote">保存</button>
            </div>
          </div>

          <ItineraryTimeline
            :key="activeDay.id"
            :items="dayItems"
            :days="bundle.days"
            @reorder="onReorder"
            @edit="openEdit"
            @remove="onRemove"
            @move="onMove"
            @add="openCreate"
          />
        </section>
      </template>
    </div>

    <AddItemSheet
      :open="sheetOpen"
      :editing="editingItem"
      @close="sheetOpen = false"
      @save="onSaveItem"
    />
  </main>
</template>

<style scoped>
.editor {
  position: relative;
  z-index: 0;
  padding-bottom: 5rem;
}

.page-content {
  position: relative;
  z-index: 1;
}

.page-content :deep(.empty) {
  color: var(--glass-text);
}

.page-content :deep(.empty h3) {
  color: var(--glass-text);
}

.page-content :deep(.empty p) {
  color: var(--glass-text-soft);
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

.save-hint {
  font-size: 0.85rem;
  color: #0d5c54;
  font-weight: 700;
  animation: fade-in 180ms var(--ease);
}

.day-panel {
  margin-top: 0.35rem;
}

.day-panel :deep(.weather) {
  margin-bottom: 1rem;
}

.day-note {
  margin-bottom: 1rem;
}

.day-note label {
  display: block;
  margin-bottom: 0.4rem;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--ink-on-photo);
}

.note-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.55rem;
}

.note-row input {
  border-radius: var(--radius-sm);
  padding: 0.75rem 0.9rem;
}

.note-row input::placeholder {
  color: var(--glass-text-soft);
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (max-width: 640px) {
  .top-actions {
    width: 100%;
  }

  .top-actions .btn {
    flex: 1;
  }
}
</style>
