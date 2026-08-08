export type ItemType = 'spot' | 'food' | 'transit' | 'stay' | 'note'

export interface Trip {
  id: string
  title: string
  destination: string
  startDate: string
  endDate: string
  coverTone?: string
  createdAt: string
  updatedAt: string
}

export interface Day {
  id: string
  tripId: string
  dayIndex: number
  date: string
  note?: string
}

export interface Item {
  id: string
  tripId: string
  dayId: string
  type: ItemType
  title: string
  time?: string
  place?: string
  description?: string
  cost?: number
  sortOrder: number
  createdAt: string
}

export interface TripBundle {
  trip: Trip
  days: Day[]
  items: Item[]
}

export interface TripExportPayload {
  version: 1
  exportedAt: string
  trip: Trip
  days: Day[]
  items: Item[]
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  spot: '景点',
  food: '餐饮',
  transit: '交通',
  stay: '住宿',
  note: '备注',
}

export const COVER_TONES = ['teal', 'harbor', 'sand', 'forest'] as const
export type CoverTone = (typeof COVER_TONES)[number]
