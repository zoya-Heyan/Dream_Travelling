import { proxiedUrl } from '@/services/guides/fetch'
import type { Item } from '@/types/trip'

export interface GeoPlace {
  name: string
  latitude: number
  longitude: number
  country?: string
  admin1?: string
}

export interface DestinationGeocode {
  place: GeoPlace
  placeName: string
}

export interface GeocodedItem {
  item: Item
  latitude: number
  longitude: number
  label: string
}

export interface GeocodeItineraryResult {
  destination: DestinationGeocode | null
  located: GeocodedItem[]
  unresolved: Item[]
}

export interface GeocodeItineraryOptions {
  signal?: AbortSignal
  onProgress?: (done: number, total: number) => void
}

const CACHE_TTL_MS = 10 * 60 * 1000
const NOMINATIM_GAP_MS = 1100

const destinationCache = new Map<string, { expiresAt: number; data: DestinationGeocode }>()
const poiCache = new Map<string, { expiresAt: number; place: GeoPlace | null }>()

let nominatimChain: Promise<void> = Promise.resolve()

interface OpenMeteoGeocodingResponse {
  results?: GeoPlace[]
}

interface NominatimHit {
  lat: string
  lon: string
  name?: string
  display_name?: string
}

function formatPlaceName(result: GeoPlace): string {
  return [result.name, result.admin1, result.country].filter(Boolean).join(' · ')
}

function hasCjk(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text)
}

/** Open-Meteo 对部分中文城市名不稳定（如「常州」失败、「常州市」成功），多试几个变体。 */
function geocodeQueryVariants(destination: string): string[] {
  const base = destination.trim()
  const variants = [base]

  if (hasCjk(base)) {
    if (base.endsWith('市') && base.length > 1) {
      variants.push(base.slice(0, -1))
    } else if (!/[市县区]$/.test(base)) {
      variants.push(`${base}市`)
    }
  }

  return [...new Set(variants)]
}

async function geocodeOpenMeteoOnce(name: string): Promise<GeoPlace | null> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', name)
  url.searchParams.set('count', '5')
  url.searchParams.set('language', 'zh')

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('地理编码请求失败，请稍后重试')
  }

  const data = (await response.json()) as OpenMeteoGeocodingResponse
  return data.results?.[0] ?? null
}

export async function geocodeDestination(destination: string): Promise<DestinationGeocode> {
  const key = destination.trim()
  if (!key) {
    throw new Error('目的地为空')
  }

  const cached = destinationCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  for (const query of geocodeQueryVariants(key)) {
    const place = await geocodeOpenMeteoOnce(query)
    if (place) {
      const data = { place, placeName: formatPlaceName(place) }
      destinationCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS })
      return data
    }
  }

  throw new Error('找不到该地点，请检查目的地名称')
}

export function shouldLocateItem(item: Item): boolean {
  if (item.type === 'note') return Boolean(item.place?.trim())
  return Boolean(item.place?.trim() || item.title.trim())
}

function itemQueries(item: Item, destination: string): string[] {
  const dest = destination.trim()
  const place = item.place?.trim()
  const title = item.title.trim()
  const queries: string[] = []

  if (place) {
    if (dest) queries.push(`${place} ${dest}`)
    queries.push(place)
  }
  if (title && title !== place) {
    if (dest) queries.push(`${title} ${dest}`)
    queries.push(title)
  }

  return [...new Set(queries)]
}

function poiCacheKey(
  query: string,
  bias?: { latitude: number; longitude: number },
): string {
  return `${query}|${bias?.latitude ?? ''}|${bias?.longitude ?? ''}`
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      window.clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    if (signal?.aborted) {
      window.clearTimeout(timer)
      onAbort()
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function enqueueNominatim<T>(task: () => Promise<T>): Promise<T> {
  const run = nominatimChain.then(task, task)
  nominatimChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function nominatimSearch(
  query: string,
  bias?: { latitude: number; longitude: number },
  signal?: AbortSignal,
): Promise<GeoPlace | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  url.searchParams.set('accept-language', 'zh')
  if (bias) {
    const delta = 0.35
    url.searchParams.set(
      'viewbox',
      `${bias.longitude - delta},${bias.latitude + delta},${bias.longitude + delta},${bias.latitude - delta}`,
    )
    url.searchParams.set('bounded', '0')
  }

  const request = async (requestUrl: string): Promise<GeoPlace | null> => {
    const response = await fetch(requestUrl, {
      headers: { Accept: 'application/json' },
      signal,
    })
    if (!response.ok) {
      throw new Error('地点搜索失败')
    }
    const data = (await response.json()) as NominatimHit[]
    const hit = data[0]
    if (!hit) return null
    const latitude = Number(hit.lat)
    const longitude = Number(hit.lon)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
    return {
      name: hit.name?.trim() || query,
      latitude,
      longitude,
    }
  }

  const started = Date.now()
  try {
    try {
      return await request(url.toString())
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        throw error
      }
      return await request(proxiedUrl(url.toString()))
    }
  } finally {
    const wait = NOMINATIM_GAP_MS - (Date.now() - started)
    if (wait > 0 && !signal?.aborted) {
      try {
        await sleep(wait, signal)
      } catch {
        /* aborted during pacing */
      }
    }
  }
}

async function geocodePoi(
  query: string,
  bias?: { latitude: number; longitude: number },
  signal?: AbortSignal,
): Promise<GeoPlace | null> {
  const key = poiCacheKey(query, bias)
  const cached = poiCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.place
  }

  return enqueueNominatim(async () => {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    const again = poiCache.get(key)
    if (again && again.expiresAt > Date.now()) {
      return again.place
    }
    try {
      const place = await nominatimSearch(query, bias, signal)
      poiCache.set(key, { place, expiresAt: Date.now() + CACHE_TTL_MS })
      return place
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        throw error
      }
      poiCache.set(key, { place: null, expiresAt: Date.now() + 60_000 })
      return null
    }
  })
}

export async function geocodeItineraryItems(
  destination: string,
  items: Item[],
  options: GeocodeItineraryOptions = {},
): Promise<GeocodeItineraryResult> {
  const { signal, onProgress } = options
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  let dest: DestinationGeocode | null = null
  if (destination.trim()) {
    try {
      dest = await geocodeDestination(destination)
    } catch {
      dest = null
    }
  }

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  const bias = dest
    ? { latitude: dest.place.latitude, longitude: dest.place.longitude }
    : undefined

  const candidates = items.filter(shouldLocateItem)
  const located: GeocodedItem[] = []
  const unresolved: Item[] = []

  let done = 0
  onProgress?.(done, candidates.length)

  for (const item of candidates) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    let found: GeoPlace | null = null
    for (const query of itemQueries(item, destination)) {
      found = await geocodePoi(query, bias, signal)
      if (found) break
    }

    if (found) {
      located.push({
        item,
        latitude: found.latitude,
        longitude: found.longitude,
        label: found.name,
      })
    } else {
      unresolved.push(item)
    }

    done += 1
    onProgress?.(done, candidates.length)
  }

  return { destination: dest, located, unresolved }
}
