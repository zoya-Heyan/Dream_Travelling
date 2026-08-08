import type { Day, Item, Trip, TripExportPayload } from '@/types/trip'
import { ITEM_TYPE_LABELS } from '@/types/trip'
import { formatDisplayDate } from '@/utils/dates'

export function toExportPayload(
  trip: Trip,
  days: Day[],
  items: Item[],
): TripExportPayload {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    trip,
    days: [...days].sort((a, b) => a.dayIndex - b.dayIndex),
    items: [...items].sort((a, b) => a.sortOrder - b.sortOrder),
  }
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function toPlainTextItinerary(
  trip: Trip,
  days: Day[],
  items: Item[],
): string {
  const lines: string[] = [
    trip.title,
    `目的地：${trip.destination}`,
    `日期：${trip.startDate} → ${trip.endDate}`,
    '',
  ]

  const sortedDays = [...days].sort((a, b) => a.dayIndex - b.dayIndex)
  for (const day of sortedDays) {
    lines.push(`Day ${day.dayIndex + 1} · ${formatDisplayDate(day.date)}`)
    if (day.note) lines.push(`  ${day.note}`)

    const dayItems = items
      .filter((item) => item.dayId === day.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)

    if (dayItems.length === 0) {
      lines.push('  （暂无安排）')
    } else {
      for (const item of dayItems) {
        const time = item.time ? `${item.time} ` : ''
        const place = item.place ? ` @ ${item.place}` : ''
        const cost =
          typeof item.cost === 'number' ? ` · ¥${item.cost}` : ''
        lines.push(
          `  - [${ITEM_TYPE_LABELS[item.type]}] ${time}${item.title}${place}${cost}`,
        )
        if (item.description) lines.push(`    ${item.description}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n').trim() + '\n'
}

export function isTripExportPayload(value: unknown): value is TripExportPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as TripExportPayload
  return (
    payload.version === 1 &&
    !!payload.trip &&
    Array.isArray(payload.days) &&
    Array.isArray(payload.items)
  )
}
