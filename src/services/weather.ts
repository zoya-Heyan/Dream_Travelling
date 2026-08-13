import { geocodeDestination } from '@/services/geocode'
import { todayISO } from '@/utils/dates'

export type WeatherMode = 'day' | 'current'

export interface DestinationWeather {
  placeName: string
  mode: WeatherMode
  /** YYYY-MM-DD when mode is day */
  date?: string
  description: string
  weatherCode: number
  /** Current temp, or daily representative (midpoint of min/max). */
  temperature: number
  tempMin?: number
  tempMax?: number
  humidity?: number
  windSpeed?: number
  precipitation?: number
}

interface CurrentForecastResponse {
  current?: {
    temperature_2m: number
    relative_humidity_2m: number
    weather_code: number
    wind_speed_10m: number
    precipitation: number
  }
}

export type RainIntensity = 'light' | 'moderate' | 'heavy'

interface DailyForecastResponse {
  daily?: {
    time: string[]
    weather_code: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_sum: number[]
    wind_speed_10m_max: number[]
  }
}

const CACHE_TTL_MS = 10 * 60 * 1000

const weatherCache = new Map<string, { expiresAt: number; data: DestinationWeather }>()

const WMO_LABELS: Record<number, string> = {
  0: '晴',
  1: '大致晴朗',
  2: '多云',
  3: '阴',
  45: '雾',
  48: '霜雾',
  51: '小毛毛雨',
  53: '毛毛雨',
  55: '大毛毛雨',
  56: '冻毛毛雨',
  57: '强冻毛毛雨',
  61: '小雨',
  63: '中雨',
  65: '大雨',
  66: '冻雨',
  67: '强冻雨',
  71: '小雪',
  73: '中雪',
  75: '大雪',
  77: '雪粒',
  80: '阵雨',
  81: '强阵雨',
  82: '暴雨',
  85: '阵雪',
  86: '强阵雪',
  95: '雷阵雨',
  96: '雷阵雨伴冰雹',
  99: '强雷阵雨伴冰雹',
}

export function weatherCodeLabel(code: number): string {
  return WMO_LABELS[code] ?? '未知天气'
}

/** 毛毛雨 / 雨 / 阵雨 / 雷雨（不含雪） */
export function isRainyWeatherCode(code: number): boolean {
  return (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    code === 95 ||
    code === 96 ||
    code === 99
  )
}

/** 按降水量（行程日为日累计 mm；此刻为当前降水强度 mm）与天气码估算特效强度 */
export function resolveRainIntensity(weather: {
  mode: WeatherMode
  weatherCode: number
  precipitation?: number
}): RainIntensity {
  const mm = weather.precipitation
  if (typeof mm === 'number' && !Number.isNaN(mm)) {
    if (weather.mode === 'day') {
      if (mm >= 15) return 'heavy'
      if (mm >= 5) return 'moderate'
      if (mm > 0) return 'light'
    } else {
      if (mm >= 2.5) return 'heavy'
      if (mm >= 0.5) return 'moderate'
      if (mm > 0) return 'light'
    }
  }

  const code = weather.weatherCode
  if (
    code === 65 ||
    code === 67 ||
    code === 82 ||
    code === 95 ||
    code === 96 ||
    code === 99 ||
    code === 81
  ) {
    return 'heavy'
  }
  if (code === 63 || code === 61 || code === 80 || code === 55 || code === 57 || code === 66) {
    return 'moderate'
  }
  return 'light'
}

async function fetchCurrentWeather(
  latitude: number,
  longitude: number,
): Promise<NonNullable<CurrentForecastResponse['current']>> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(latitude))
  url.searchParams.set('longitude', String(longitude))
  url.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation',
  )
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('wind_speed_unit', 'ms')

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('天气请求失败，请稍后重试')
  }

  const data = (await response.json()) as CurrentForecastResponse
  if (!data.current) {
    throw new Error('暂无天气数据')
  }
  return data.current
}

async function fetchDailyWeather(
  latitude: number,
  longitude: number,
  date: string,
): Promise<{
  weatherCode: number
  tempMax: number
  tempMin: number
  precipitation: number
  windSpeedMax: number
}> {
  const today = todayISO()
  const base =
    date < today
      ? 'https://archive-api.open-meteo.com/v1/archive'
      : 'https://api.open-meteo.com/v1/forecast'

  const url = new URL(base)
  url.searchParams.set('latitude', String(latitude))
  url.searchParams.set('longitude', String(longitude))
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
  )
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('wind_speed_unit', 'ms')
  url.searchParams.set('start_date', date)
  url.searchParams.set('end_date', date)

  const response = await fetch(url)
  if (!response.ok) {
    if (date > today) {
      throw new Error('该日期暂无预报（可能超出可预报范围）')
    }
    throw new Error('天气请求失败，请稍后重试')
  }

  const data = (await response.json()) as DailyForecastResponse
  const daily = data.daily
  if (!daily?.time?.length) {
    throw new Error(date > today ? '该日期暂无预报（可能超出可预报范围）' : '暂无该日天气数据')
  }

  return {
    weatherCode: daily.weather_code[0],
    tempMax: daily.temperature_2m_max[0],
    tempMin: daily.temperature_2m_min[0],
    precipitation: daily.precipitation_sum[0],
    windSpeedMax: daily.wind_speed_10m_max[0],
  }
}

export interface FetchWeatherOptions {
  mode?: WeatherMode
  /** YYYY-MM-DD，mode 为 day 时必填 */
  date?: string
}

export async function fetchDestinationWeather(
  destination: string,
  options: FetchWeatherOptions = {},
): Promise<DestinationWeather> {
  const key = destination.trim()
  if (!key) {
    throw new Error('目的地为空')
  }

  const mode: WeatherMode = options.mode ?? (options.date ? 'day' : 'current')
  if (mode === 'day' && !options.date?.trim()) {
    throw new Error('未选择行程日期')
  }

  const date = options.date?.trim()
  const cacheKey = `${key}|${mode}|${date ?? ''}`
  const cached = weatherCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  try {
    const { place, placeName } = await geocodeDestination(key)

    let data: DestinationWeather
    if (mode === 'current') {
      const current = await fetchCurrentWeather(place.latitude, place.longitude)
      data = {
        placeName,
        mode: 'current',
        temperature: Math.round(current.temperature_2m),
        humidity: current.relative_humidity_2m,
        windSpeed: Number(current.wind_speed_10m.toFixed(1)),
        precipitation: Number(current.precipitation.toFixed(1)),
        description: weatherCodeLabel(current.weather_code),
        weatherCode: current.weather_code,
      }
    } else {
      const daily = await fetchDailyWeather(place.latitude, place.longitude, date!)
      const tempMin = Math.round(daily.tempMin)
      const tempMax = Math.round(daily.tempMax)
      data = {
        placeName,
        mode: 'day',
        date,
        temperature: Math.round((daily.tempMin + daily.tempMax) / 2),
        tempMin,
        tempMax,
        precipitation: Number(daily.precipitation.toFixed(1)),
        windSpeed: Number(daily.windSpeedMax.toFixed(1)),
        description: weatherCodeLabel(daily.weatherCode),
        weatherCode: daily.weatherCode,
      }
    }

    weatherCache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS })
    return data
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error('获取天气失败，请稍后重试')
  }
}
