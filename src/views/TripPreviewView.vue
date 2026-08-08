<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useTripsStore } from '@/stores/trips'
import { ITEM_TYPE_LABELS } from '@/types/trip'
import { formatDisplayDate } from '@/utils/dates'
import { downloadJson, toExportPayload, toPlainTextItinerary } from '@/utils/export'

const props = defineProps<{
  id: string
}>()

const store = useTripsStore()
const loading = ref(true)
const notFound = ref(false)
const copied = ref(false)

const bundle = computed(() => store.activeBundle)
const stats = computed(() =>
  bundle.value ? store.tripStats(bundle.value) : { dayCount: 0, itemCount: 0, totalCost: 0 },
)

onMounted(async () => {
  const data = await store.loadTripBundle(props.id)
  notFound.value = !data
  loading.value = false
})

function exportJson(): void {
  if (!bundle.value) return
  const payload = toExportPayload(bundle.value.trip, bundle.value.days, bundle.value.items)
  const safeName = bundle.value.trip.title.replace(/[^\w\u4e00-\u9fa5-]+/g, '_') || 'trip'
  downloadJson(`${safeName}.json`, payload)
}

async function copyText(): Promise<void> {
  if (!bundle.value) return
  const text = toPlainTextItinerary(
    bundle.value.trip,
    bundle.value.days,
    bundle.value.items,
  )
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    window.setTimeout(() => {
      copied.value = false
    }, 1600)
  } catch {
    alert('复制失败，请检查浏览器权限')
  }
}

function itemsFor(dayId: string) {
  return store.itemsForDay(dayId)
}
</script>

<template>
  <main class="page preview">
    <div v-if="loading" class="state">加载预览…</div>

    <div v-else-if="notFound" class="state">
      <p>找不到这条行程。</p>
      <RouterLink class="btn btn-primary" to="/">回到首页</RouterLink>
    </div>

    <template v-else-if="bundle">
      <header class="header">
        <RouterLink class="back" :to="`/trips/${id}`">← 返回编辑</RouterLink>
        <p class="destination">{{ bundle.trip.destination }}</p>
        <h1>{{ bundle.trip.title }}</h1>
        <p class="meta">
          {{ formatDisplayDate(bundle.trip.startDate) }} —
          {{ formatDisplayDate(bundle.trip.endDate) }}
          · {{ stats.dayCount }} 天 · {{ stats.itemCount }} 项
          <span v-if="stats.totalCost > 0"> · 合计约 ¥{{ stats.totalCost }}</span>
        </p>
        <div class="actions">
          <button type="button" class="btn btn-secondary" @click="exportJson">导出 JSON</button>
          <button type="button" class="btn btn-primary" @click="copyText">
            {{ copied ? '已复制' : '复制纯文本' }}
          </button>
        </div>
      </header>

      <section
        v-for="day in bundle.days"
        :key="day.id"
        class="day-block"
      >
        <h2>Day {{ day.dayIndex + 1 }} · {{ formatDisplayDate(day.date) }}</h2>
        <p v-if="day.note" class="day-note">{{ day.note }}</p>

        <ol v-if="itemsFor(day.id).length" class="items">
          <li v-for="item in itemsFor(day.id)" :key="item.id">
            <div class="item-top">
              <span class="type">{{ ITEM_TYPE_LABELS[item.type] }}</span>
              <span v-if="item.time" class="time">{{ item.time }}</span>
            </div>
            <strong>{{ item.title }}</strong>
            <p v-if="item.place">{{ item.place }}</p>
            <p v-if="item.description">{{ item.description }}</p>
            <p v-if="typeof item.cost === 'number'" class="cost">约 ¥{{ item.cost }}</p>
          </li>
        </ol>
        <p v-else class="empty-day">这一天暂无安排</p>
      </section>
    </template>
  </main>
</template>

<style scoped>
.preview {
  max-width: 720px;
}

.state {
  padding: 4rem 0;
  text-align: center;
  color: var(--ink-soft);
  display: grid;
  gap: 1rem;
  justify-items: center;
}

.back {
  color: var(--ink-soft);
  font-weight: 600;
}

.destination {
  margin: 0.7rem 0 0;
  color: var(--teal-deep);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-size: 0.8rem;
}

h1 {
  margin: 0.3rem 0 0;
  font-family: var(--font-display);
  font-size: clamp(2rem, 5vw, 2.7rem);
}

.meta {
  margin: 0.5rem 0 0;
  color: var(--ink-soft);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 1.1rem;
}

.day-block {
  margin-top: 1.75rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--line);
  animation: fade-up 320ms var(--ease) both;
}

h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.4rem;
}

.day-note {
  margin: 0.4rem 0 0;
  color: var(--ink-soft);
}

.items {
  list-style: none;
  margin: 1rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.85rem;
}

.items li {
  padding: 0.9rem 1rem;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid var(--line);
}

.item-top {
  display: flex;
  gap: 0.6rem;
  margin-bottom: 0.25rem;
}

.type {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--teal-deep);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.time,
.items p,
.empty-day {
  margin: 0.25rem 0 0;
  color: var(--ink-soft);
}

.cost {
  font-weight: 600;
}

@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
