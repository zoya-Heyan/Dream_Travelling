import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { db } from '@/db'
import type {
  CoverTone,
  Day,
  Item,
  ItemType,
  Trip,
  TripBundle,
  TripExportPayload,
} from '@/types/trip'
import { COVER_TONES } from '@/types/trip'
import { eachDateInclusive } from '@/utils/dates'
import { createId } from '@/utils/id'
import { isTripExportPayload } from '@/utils/export'

export interface CreateTripInput {
  title: string
  destination: string
  startDate: string
  endDate: string
  coverTone?: CoverTone
}

export interface ItemInput {
  type: ItemType
  title: string
  time?: string
  place?: string
  description?: string
  cost?: number
}

function nowISO(): string {
  return new Date().toISOString()
}

function pickTone(preferred?: CoverTone): CoverTone {
  if (preferred && COVER_TONES.includes(preferred)) return preferred
  return COVER_TONES[Math.floor(Math.random() * COVER_TONES.length)]
}

export const useTripsStore = defineStore('trips', () => {
  const trips = ref<Trip[]>([])
  const loading = ref(false)
  const activeBundle = ref<TripBundle | null>(null)

  const tripCount = computed(() => trips.value.length)

  async function loadTrips(): Promise<void> {
    loading.value = true
    try {
      trips.value = await db.trips.orderBy('updatedAt').reverse().toArray()
    } finally {
      loading.value = false
    }
  }

  async function createTrip(input: CreateTripInput): Promise<Trip> {
    const stamp = nowISO()
    const trip: Trip = {
      id: createId('trip'),
      title: input.title.trim(),
      destination: input.destination.trim(),
      startDate: input.startDate,
      endDate: input.endDate,
      coverTone: pickTone(input.coverTone),
      createdAt: stamp,
      updatedAt: stamp,
    }

    const dates = eachDateInclusive(input.startDate, input.endDate)
    const days: Day[] = dates.map((date, dayIndex) => ({
      id: createId('day'),
      tripId: trip.id,
      dayIndex,
      date,
    }))

    await db.transaction('rw', db.trips, db.days, async () => {
      await db.trips.add(trip)
      await db.days.bulkAdd(days)
    })

    trips.value = [trip, ...trips.value]
    return trip
  }

  async function deleteTrip(tripId: string): Promise<void> {
    await db.transaction('rw', db.trips, db.days, db.items, async () => {
      await db.items.where('tripId').equals(tripId).delete()
      await db.days.where('tripId').equals(tripId).delete()
      await db.trips.delete(tripId)
    })
    trips.value = trips.value.filter((trip) => trip.id !== tripId)
    if (activeBundle.value?.trip.id === tripId) {
      activeBundle.value = null
    }
  }

  async function loadTripBundle(tripId: string): Promise<TripBundle | null> {
    const trip = await db.trips.get(tripId)
    if (!trip) {
      activeBundle.value = null
      return null
    }
    const days = await db.days.where('tripId').equals(tripId).sortBy('dayIndex')
    const items = await db.items.where('tripId').equals(tripId).sortBy('sortOrder')
    const bundle = { trip, days, items }
    activeBundle.value = bundle
    return bundle
  }

  async function touchTrip(tripId: string): Promise<void> {
    const updatedAt = nowISO()
    await db.trips.update(tripId, { updatedAt })
    const index = trips.value.findIndex((trip) => trip.id === tripId)
    if (index >= 0) {
      trips.value[index] = { ...trips.value[index], updatedAt }
      trips.value = [...trips.value].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      )
    }
    if (activeBundle.value?.trip.id === tripId) {
      activeBundle.value = {
        ...activeBundle.value,
        trip: { ...activeBundle.value.trip, updatedAt },
      }
    }
  }

  async function addItem(tripId: string, dayId: string, input: ItemInput): Promise<Item> {
    const existing = await db.items.where('dayId').equals(dayId).toArray()
    const sortOrder =
      existing.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1

    const item: Item = {
      id: createId('item'),
      tripId,
      dayId,
      type: input.type,
      title: input.title.trim(),
      time: input.time?.trim() || undefined,
      place: input.place?.trim() || undefined,
      description: input.description?.trim() || undefined,
      cost:
        typeof input.cost === 'number' && !Number.isNaN(input.cost)
          ? input.cost
          : undefined,
      sortOrder,
      createdAt: nowISO(),
    }

    await db.items.add(item)
    await touchTrip(tripId)

    if (activeBundle.value?.trip.id === tripId) {
      activeBundle.value = {
        ...activeBundle.value,
        items: [...activeBundle.value.items, item],
      }
    }
    return item
  }

  async function updateItem(itemId: string, patch: ItemInput): Promise<void> {
    const current = await db.items.get(itemId)
    if (!current) return

    const next: Item = {
      ...current,
      type: patch.type,
      title: patch.title.trim(),
      time: patch.time?.trim() || undefined,
      place: patch.place?.trim() || undefined,
      description: patch.description?.trim() || undefined,
      cost:
        typeof patch.cost === 'number' && !Number.isNaN(patch.cost)
          ? patch.cost
          : undefined,
    }

    await db.items.put(next)
    await touchTrip(current.tripId)

    if (activeBundle.value?.trip.id === current.tripId) {
      activeBundle.value = {
        ...activeBundle.value,
        items: activeBundle.value.items.map((item) =>
          item.id === itemId ? next : item,
        ),
      }
    }
  }

  async function deleteItem(itemId: string): Promise<void> {
    const current = await db.items.get(itemId)
    if (!current) return
    await db.items.delete(itemId)
    await touchTrip(current.tripId)
    if (activeBundle.value?.trip.id === current.tripId) {
      activeBundle.value = {
        ...activeBundle.value,
        items: activeBundle.value.items.filter((item) => item.id !== itemId),
      }
    }
  }

  async function reorderDayItems(dayId: string, orderedIds: string[]): Promise<void> {
    const day = await db.days.get(dayId)
    if (!day) return

    await db.transaction('rw', db.items, async () => {
      await Promise.all(
        orderedIds.map((id, sortOrder) => db.items.update(id, { sortOrder, dayId })),
      )
    })
    await touchTrip(day.tripId)

    if (activeBundle.value?.trip.id === day.tripId) {
      const map = new Map(orderedIds.map((id, sortOrder) => [id, sortOrder]))
      activeBundle.value = {
        ...activeBundle.value,
        items: activeBundle.value.items.map((item) => {
          if (!map.has(item.id)) return item
          return {
            ...item,
            dayId,
            sortOrder: map.get(item.id) ?? item.sortOrder,
          }
        }),
      }
    }
  }

  async function moveItemToDay(
    itemId: string,
    targetDayId: string,
    targetIndex?: number,
  ): Promise<void> {
    const item = await db.items.get(itemId)
    if (!item || item.dayId === targetDayId) {
      if (item && item.dayId === targetDayId && typeof targetIndex === 'number') {
        const siblings = (
          await db.items.where('dayId').equals(targetDayId).sortBy('sortOrder')
        ).map((entry) => entry.id)
        const without = siblings.filter((id) => id !== itemId)
        without.splice(targetIndex, 0, itemId)
        await reorderDayItems(targetDayId, without)
      }
      return
    }

    const targetItems = await db.items
      .where('dayId')
      .equals(targetDayId)
      .sortBy('sortOrder')
    const orderedIds = targetItems.map((entry) => entry.id)
    const insertAt =
      typeof targetIndex === 'number'
        ? Math.max(0, Math.min(targetIndex, orderedIds.length))
        : orderedIds.length
    orderedIds.splice(insertAt, 0, itemId)

    await db.transaction('rw', db.items, async () => {
      const sourceItems = await db.items
        .where('dayId')
        .equals(item.dayId)
        .sortBy('sortOrder')
      const remaining = sourceItems
        .filter((entry) => entry.id !== itemId)
        .map((entry) => entry.id)

      await Promise.all(
        remaining.map((id, sortOrder) =>
          db.items.update(id, { sortOrder, dayId: item.dayId }),
        ),
      )
      await Promise.all(
        orderedIds.map((id, sortOrder) =>
          db.items.update(id, { sortOrder, dayId: targetDayId }),
        ),
      )
    })

    await touchTrip(item.tripId)
    await loadTripBundle(item.tripId)
  }

  async function updateDayNote(dayId: string, note: string): Promise<void> {
    const day = await db.days.get(dayId)
    if (!day) return
    const cleaned = note.trim()
    await db.days.update(dayId, { note: cleaned || undefined })
    await touchTrip(day.tripId)
    if (activeBundle.value?.trip.id === day.tripId) {
      activeBundle.value = {
        ...activeBundle.value,
        days: activeBundle.value.days.map((entry) =>
          entry.id === dayId ? { ...entry, note: cleaned || undefined } : entry,
        ),
      }
    }
  }

  async function importTrip(payload: unknown): Promise<Trip> {
    if (!isTripExportPayload(payload)) {
      throw new Error('无效的攻略文件')
    }
    const data = payload as TripExportPayload
    const stamp = nowISO()
    const tripId = createId('trip')
    const dayIdMap = new Map<string, string>()

    const trip: Trip = {
      ...data.trip,
      id: tripId,
      createdAt: stamp,
      updatedAt: stamp,
      coverTone: pickTone(data.trip.coverTone as CoverTone | undefined),
    }

    const days: Day[] = [...data.days]
      .sort((a, b) => a.dayIndex - b.dayIndex)
      .map((day) => {
        const id = createId('day')
        dayIdMap.set(day.id, id)
        return {
          ...day,
          id,
          tripId,
        }
      })

    const items: Item[] = data.items.map((item, index) => ({
      ...item,
      id: createId('item'),
      tripId,
      dayId: dayIdMap.get(item.dayId) ?? days[0]?.id,
      sortOrder: item.sortOrder ?? index,
      createdAt: stamp,
    }))

    await db.transaction('rw', db.trips, db.days, db.items, async () => {
      await db.trips.add(trip)
      if (days.length) await db.days.bulkAdd(days)
      if (items.length) await db.items.bulkAdd(items)
    })

    trips.value = [trip, ...trips.value]
    return trip
  }

  function itemsForDay(dayId: string): Item[] {
    if (!activeBundle.value) return []
    return activeBundle.value.items
      .filter((item) => item.dayId === dayId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  function tripStats(bundle: TripBundle) {
    const totalCost = bundle.items.reduce(
      (sum, item) => sum + (typeof item.cost === 'number' ? item.cost : 0),
      0,
    )
    return {
      dayCount: bundle.days.length,
      itemCount: bundle.items.length,
      totalCost,
    }
  }

  return {
    trips,
    loading,
    activeBundle,
    tripCount,
    loadTrips,
    createTrip,
    deleteTrip,
    loadTripBundle,
    addItem,
    updateItem,
    deleteItem,
    reorderDayItems,
    moveItemToDay,
    updateDayNote,
    importTrip,
    itemsForDay,
    tripStats,
  }
})
