<script setup lang="ts">
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  geocodeItineraryItems,
  shouldLocateItem,
  type GeocodedItem,
  type GeocodeItineraryResult,
} from '@/services/geocode'
import type { Day, Item, ItemType } from '@/types/trip'
import { ITEM_TYPE_LABELS } from '@/types/trip'

const TYPE_COLORS: Record<ItemType, string> = {
  spot: '#1a9b8e',
  food: '#d0894a',
  transit: '#3d7ea6',
  stay: '#5b7c99',
  note: '#7a8a92',
}

const props = withDefaults(
  defineProps<{
    destination: string
    items: Item[]
    days: Day[]
    compact?: boolean
    showList?: boolean
    selectedId?: string
    expandHref?: string
  }>(),
  {
    compact: false,
    showList: false,
    selectedId: '',
    expandHref: '',
  },
)

const emit = defineEmits<{
  select: [itemId: string]
}>()

const internalId = ref('')
const activeId = computed(() => props.selectedId || internalId.value)

const canvasEl = ref<HTMLElement | null>(null)
const rootEl = ref<HTMLElement | null>(null)
const loading = ref(false)
const progressText = ref('正在定位地点…')
const result = ref<GeocodeItineraryResult | null>(null)

const located = computed(() => result.value?.located ?? [])
const unresolved = computed(() => result.value?.unresolved ?? [])
const empty = computed(
  () =>
    !loading.value &&
    !!result.value &&
    located.value.length === 0 &&
    !result.value.destination,
)
const showDayLabel = computed(() => new Set(props.items.map((item) => item.dayId)).size > 1)
const unresolvedText = computed(() =>
  unresolved.value.map((item) => item.title).filter(Boolean).join('、'),
)

const orderedItems = computed(() => {
  const dayOrder = new Map(props.days.map((day) => [day.id, day.dayIndex]))
  return [...props.items].sort((a, b) => {
    const dayA = dayOrder.get(a.dayId) ?? 0
    const dayB = dayOrder.get(b.dayId) ?? 0
    if (dayA !== dayB) return dayA - dayB
    return a.sortOrder - b.sortOrder
  })
})

const itemKey = computed(() =>
  orderedItems.value
    .map(
      (item) =>
        `${item.id}:${item.type}:${item.title}:${item.place ?? ''}:${item.dayId}:${item.sortOrder}:${item.time ?? ''}`,
    )
    .join('|'),
)

let map: L.Map | null = null
let layers: L.LayerGroup | null = null
let abort: AbortController | null = null
let resizeObserver: ResizeObserver | null = null
const markerById = new Map<string, L.Marker>()

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function dayLabel(dayId: string): string {
  const day = props.days.find((entry) => entry.id === dayId)
  return day ? `Day ${day.dayIndex + 1}` : ''
}

function pinIcon(type: ItemType, index: number, selected: boolean): L.DivIcon {
  return L.divIcon({
    className: `trip-pin${selected ? ' is-selected' : ''}`,
    html: `<span class="trip-pin-dot" style="--pin:${TYPE_COLORS[type]}"><span class="trip-pin-num">${index}</span></span>`,
    iconSize: [30, 38],
    iconAnchor: [15, 36],
    popupAnchor: [0, -28],
  })
}

function destIcon(): L.DivIcon {
  return L.divIcon({
    className: 'trip-pin trip-pin-dest',
    html: '<span class="trip-pin-dot trip-pin-dot-dest"></span>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -8],
  })
}

function popupHtml(entry: GeocodedItem): string {
  const { item } = entry
  const time = item.time ? `<p>${escapeHtml(item.time)}</p>` : ''
  const place = item.place ? `<p>${escapeHtml(item.place)}</p>` : ''
  const day = showDayLabel.value ? `<p>${escapeHtml(dayLabel(item.dayId))}</p>` : ''
  return `
    <div class="trip-map-popup">
      <span class="type">${escapeHtml(ITEM_TYPE_LABELS[item.type])}</span>
      <strong>${escapeHtml(item.title)}</strong>
      ${day}${time}${place}
    </div>
  `
}

function initMap(): void {
  if (!canvasEl.value || map) return

  map = L.map(canvasEl.value, {
    zoomControl: true,
    attributionControl: true,
    scrollWheelZoom: !props.compact,
  })

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map)

  layers = L.layerGroup().addTo(map)
  map.setView([35.2, 108.9], 4)
}

function drawLayers(): void {
  if (!map || !layers) return

  const group = layers
  const currentMap = map
  group.clearLayers()
  markerById.clear()

  const data = result.value
  if (!data) return

  const points: L.LatLngExpression[] = []
  const byDay = new Map<string, L.LatLng[]>()

  data.located.forEach((entry) => {
    const latlng = L.latLng(entry.latitude, entry.longitude)
    points.push(latlng)
    const dayPoints = byDay.get(entry.item.dayId) ?? []
    dayPoints.push(latlng)
    byDay.set(entry.item.dayId, dayPoints)
  })

  for (const dayPoints of byDay.values()) {
    if (dayPoints.length < 2) continue
    L.polyline(dayPoints, {
      color: '#1a9b8e',
      weight: 3,
      opacity: 0.72,
      dashArray: '6 8',
    }).addTo(group)
  }

  data.located.forEach((entry, index) => {
    const latlng = L.latLng(entry.latitude, entry.longitude)
    const selected = activeId.value === entry.item.id
    const marker = L.marker(latlng, {
      icon: pinIcon(entry.item.type, index + 1, selected),
      title: entry.item.title,
      zIndexOffset: selected ? 600 : index,
    })
    marker.bindPopup(popupHtml(entry), { className: 'trip-map-leaflet-popup' })
    marker.on('click', () => selectItem(entry.item.id))
    marker.addTo(group)
    markerById.set(entry.item.id, marker)
  })

  if (data.destination && data.located.length === 0) {
    const { latitude, longitude, name } = data.destination.place
    const latlng = L.latLng(latitude, longitude)
    points.push(latlng)
    L.marker(latlng, { icon: destIcon(), title: data.destination.placeName })
      .bindPopup(
        `<div class="trip-map-popup"><span class="type">目的地</span><strong>${escapeHtml(
          data.destination.placeName || name,
        )}</strong></div>`,
        { className: 'trip-map-leaflet-popup' },
      )
      .addTo(group)
  }

  currentMap.invalidateSize()

  if (points.length === 1) {
    currentMap.setView(points[0], data.located.length ? 14 : 12)
  } else if (points.length > 1) {
    currentMap.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 15 })
  }

  const selectedMarker = activeId.value ? markerById.get(activeId.value) : undefined
  if (selectedMarker) {
    window.requestAnimationFrame(() => selectedMarker.openPopup())
  }
}

function selectItem(itemId: string): void {
  internalId.value = itemId
  emit('select', itemId)
}

function syncSelection(): void {
  if (!activeId.value) return
  const marker = markerById.get(activeId.value)
  if (!marker || !map) return
  marker.openPopup()
  map.panTo(marker.getLatLng())
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

async function load(): Promise<void> {
  abort?.abort()
  abort = new AbortController()
  const signal = abort.signal

  loading.value = true
  progressText.value = '正在定位地点…'
  result.value = null

  try {
    const next = await geocodeItineraryItems(props.destination, orderedItems.value, {
      signal,
      onProgress: (done, total) => {
        progressText.value =
          total > 0 ? `正在定位地点（${done}/${total}）…` : '正在定位目的地…'
      },
    })
    if (signal.aborted) return
    result.value = next
    await nextTick()
    drawLayers()
  } catch (error) {
    if (isAbort(error) || signal.aborted) return
    result.value = {
      destination: null,
      located: [],
      unresolved: orderedItems.value.filter(shouldLocateItem),
    }
  } finally {
    if (!signal.aborted) loading.value = false
  }
}

function selectFromList(itemId: string): void {
  selectItem(itemId)
  syncSelection()
}

onMounted(async () => {
  await nextTick()
  initMap()
  if (rootEl.value) {
    resizeObserver = new ResizeObserver(() => {
      map?.invalidateSize()
    })
    resizeObserver.observe(rootEl.value)
  }
  void load()
})

watch(
  () => [props.destination, itemKey.value] as const,
  () => {
    if (!map) return
    void load()
  },
)

watch(
  () => props.selectedId,
  (id) => {
    if (id) internalId.value = id
    syncSelection()
  },
)

onBeforeUnmount(() => {
  abort?.abort()
  resizeObserver?.disconnect()
  map?.remove()
  map = null
  layers = null
  markerById.clear()
})
</script>

<template>
  <section
    ref="rootEl"
    class="trip-map"
    :class="{ compact, 'with-list': showList }"
  >
    <div class="map-stage glass-panel">
      <div ref="canvasEl" class="map-canvas" />
      <p v-if="loading" class="map-status">{{ progressText }}</p>
      <p v-else-if="empty" class="map-status">无法定位目的地，请检查名称或为条目填写地点。</p>
      <RouterLink v-if="expandHref" class="expand" :to="expandHref">查看大图</RouterLink>
    </div>

    <aside v-if="showList" class="place-list glass-panel">
      <h2>地点</h2>
      <p v-if="loading" class="hint">{{ progressText }}</p>
      <p v-else-if="!located.length" class="hint">
        {{ empty ? '暂时没有可显示的地点' : '已显示目的地，条目地点待补充。' }}
      </p>
      <ol v-else class="places">
        <li v-for="(entry, index) in located" :key="entry.item.id">
          <button
            type="button"
            class="place-btn"
            :class="{ active: activeId === entry.item.id }"
            @click="selectFromList(entry.item.id)"
          >
            <span class="idx" :style="{ '--pin': TYPE_COLORS[entry.item.type] }">{{
              index + 1
            }}</span>
            <span class="place-copy">
              <span class="place-meta">
                <span>{{ ITEM_TYPE_LABELS[entry.item.type] }}</span>
                <span v-if="showDayLabel">{{ dayLabel(entry.item.dayId) }}</span>
                <span v-if="entry.item.time">{{ entry.item.time }}</span>
              </span>
              <strong>{{ entry.item.title }}</strong>
              <span v-if="entry.item.place" class="place-name">{{ entry.item.place }}</span>
            </span>
          </button>
        </li>
      </ol>
      <p v-if="unresolvedText" class="hint unresolved">未能定位：{{ unresolvedText }}</p>
    </aside>

    <p v-else-if="unresolvedText" class="hint unresolved">未能定位：{{ unresolvedText }}</p>
  </section>
</template>

<style scoped>
.trip-map {
  isolation: isolate;
  position: relative;
  z-index: 0;
  display: grid;
  gap: 0.75rem;
}

.trip-map.with-list {
  grid-template-columns: minmax(0, 1fr) minmax(220px, 280px);
  align-items: stretch;
}

.map-stage {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius);
  min-height: 0;
}

.map-canvas {
  height: min(62vh, 640px);
  min-height: 360px;
  width: 100%;
}

.compact .map-canvas {
  height: 220px;
  min-height: 220px;
}

.map-status {
  position: absolute;
  left: 0.75rem;
  right: 0.75rem;
  top: 0.75rem;
  margin: 0;
  z-index: 2;
  padding: 0.45rem 0.7rem;
  border-radius: 999px;
  background: rgba(11, 47, 56, 0.55);
  color: #fff;
  font-size: 0.82rem;
  font-weight: 600;
  text-align: center;
  pointer-events: none;
}

.expand {
  position: absolute;
  left: 0.7rem;
  bottom: 0.7rem;
  z-index: 2;
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  background: rgba(11, 47, 56, 0.62);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
}

.hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--ink-soft-on-photo);
  font-weight: 500;
}

.unresolved {
  color: var(--ink-soft-on-photo);
}

.place-list {
  border-radius: var(--radius);
  padding: 0.9rem 0.85rem 1rem;
  display: grid;
  align-content: start;
  gap: 0.65rem;
  max-height: min(62vh, 640px);
  overflow: auto;
}

.place-list h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.15rem;
}

.place-list .hint {
  color: var(--glass-text-soft);
}

.places {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.4rem;
}

.place-btn {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.65rem;
  align-items: start;
  text-align: left;
  border: 1px solid transparent;
  border-radius: 12px;
  padding: 0.5rem 0.45rem;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.place-btn:hover,
.place-btn.active {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.28);
}

.idx {
  width: 1.55rem;
  height: 1.55rem;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: var(--pin, var(--teal));
  color: #fff;
  font-size: 0.75rem;
  font-weight: 800;
}

.place-copy {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
}

.place-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.55rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--glass-text-soft);
}

.place-copy strong {
  font-size: 0.95rem;
  color: var(--glass-text);
}

.place-name {
  font-size: 0.8rem;
  color: var(--glass-text-soft);
}

.trip-map :deep(.leaflet-container) {
  height: 100%;
  width: 100%;
  background: #dce8ea;
  font-family: var(--font-body);
}

.trip-map :deep(.leaflet-control-attribution) {
  font-size: 10px;
  background: rgba(255, 255, 255, 0.72);
}

.trip-map :deep(.trip-pin) {
  background: none;
  border: none;
}

.trip-map :deep(.trip-pin-dot) {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  background: var(--pin, #1a9b8e);
  box-shadow: 0 6px 14px rgba(11, 47, 56, 0.28);
}

.trip-map :deep(.trip-pin-num) {
  transform: rotate(45deg);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
}

.trip-map :deep(.is-selected .trip-pin-dot) {
  box-shadow:
    0 0 0 3px #fff,
    0 8px 16px rgba(11, 47, 56, 0.35);
}

.trip-map :deep(.trip-pin-dot-dest) {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  transform: none;
  background: #0d5c54;
  border: 2px solid #fff;
}

.trip-map :deep(.leaflet-popup-content-wrapper) {
  border-radius: 12px;
  box-shadow: var(--shadow);
}

.trip-map :deep(.leaflet-popup-content) {
  margin: 0.7rem 0.85rem;
}

.trip-map :deep(.trip-map-popup) {
  display: grid;
  gap: 0.2rem;
  min-width: 8rem;
  color: var(--ink);
}

.trip-map :deep(.trip-map-popup .type) {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--teal-deep);
}

.trip-map :deep(.trip-map-popup strong) {
  font-size: 0.95rem;
}

.trip-map :deep(.trip-map-popup p) {
  margin: 0;
  font-size: 0.82rem;
  color: var(--ink-soft);
}

@media (max-width: 860px) {
  .trip-map.with-list {
    grid-template-columns: 1fr;
  }

  .place-list {
    max-height: none;
  }

  .map-canvas {
    height: 52vh;
    min-height: 280px;
  }
}
</style>
