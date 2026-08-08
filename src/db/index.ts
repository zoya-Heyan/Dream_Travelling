import Dexie, { type EntityTable } from 'dexie'
import type { Day, Item, Trip } from '@/types/trip'

class DreamTravellingDB extends Dexie {
  trips!: EntityTable<Trip, 'id'>
  days!: EntityTable<Day, 'id'>
  items!: EntityTable<Item, 'id'>

  constructor() {
    super('dream-travelling')
    this.version(1).stores({
      trips: 'id, updatedAt, startDate',
      days: 'id, tripId, dayIndex, [tripId+dayIndex]',
      items: 'id, tripId, dayId, sortOrder, [dayId+sortOrder]',
    })
  }
}

export const db = new DreamTravellingDB()
