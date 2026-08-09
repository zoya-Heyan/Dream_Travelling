<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  fetchDestinationWeather,
  isRainyWeatherCode,
  resolveRainIntensity,
  type DestinationWeather,
  type WeatherMode,
} from '@/services/weather'
import { formatDisplayDate } from '@/utils/dates'
import { triggerRainEffect } from '@/utils/rainEffect'

const props = withDefaults(
  defineProps<{
    destination: string
    /** 选中行程日 YYYY-MM-DD；有值时默认显示该日预报 */
    date?: string
    /** 是否显示「行程日 / 此刻」切换；预览按日展示时可关掉 */
    showModeToggle?: boolean
  }>(),
  {
    showModeToggle: true,
  },
)

const loading = ref(false)
const error = ref('')
const weather = ref<DestinationWeather | null>(null)
const mode = ref<WeatherMode>(props.date ? 'day' : 'current')

const canUseDayMode = computed(() => Boolean(props.date?.trim()))
const loadingText = computed(() =>
  mode.value === 'day' ? '正在查询行程日天气…' : '正在查询当前天气…',
)

async function load(): Promise<void> {
  const destination = props.destination.trim()
  if (!destination) {
    weather.value = null
    error.value = ''
    loading.value = false
    return
  }

  const activeMode: WeatherMode =
    mode.value === 'day' && !props.date?.trim() ? 'current' : mode.value

  if (mode.value === 'day' && !props.date?.trim()) {
    mode.value = 'current'
  }

  loading.value = true
  error.value = ''
  try {
    const result = await fetchDestinationWeather(destination, {
      mode: activeMode,
      date: activeMode === 'day' ? props.date : undefined,
    })
    weather.value = result
    if (isRainyWeatherCode(result.weatherCode)) {
      triggerRainEffect(resolveRainIntensity(result))
    }
  } catch (err) {
    weather.value = null
    error.value = err instanceof Error ? err.message : '获取天气失败'
  } finally {
    loading.value = false
  }
}

function setMode(next: WeatherMode): void {
  if (next === 'day' && !canUseDayMode.value) return
  if (mode.value === next) return
  mode.value = next
}

watch(
  () => [props.destination, props.date, mode.value] as const,
  () => {
    void load()
  },
  { immediate: true },
)

watch(
  () => props.date,
  (date, prev) => {
    if (date?.trim() && date !== prev) {
      mode.value = 'day'
    }
  },
)
</script>

<template>
  <div class="weather glass-panel" aria-live="polite">
    <div v-if="showModeToggle && canUseDayMode" class="modes" role="tablist" aria-label="天气模式">
      <button
        type="button"
        class="mode-btn"
        role="tab"
        :aria-selected="mode === 'day'"
        :class="{ active: mode === 'day' }"
        @click="setMode('day')"
      >
        行程日
      </button>
      <button
        type="button"
        class="mode-btn"
        role="tab"
        :aria-selected="mode === 'current'"
        :class="{ active: mode === 'current' }"
        @click="setMode('current')"
      >
        此刻
      </button>
    </div>

    <p v-if="loading" class="status">{{ loadingText }}</p>

    <p v-else-if="error" class="status error">{{ error }}</p>

    <div v-else-if="weather" class="row">
      <div class="main">
        <template v-if="weather.mode === 'day' && weather.tempMin != null && weather.tempMax != null">
          <span class="temp">{{ weather.tempMin }}° / {{ weather.tempMax }}°</span>
        </template>
        <template v-else>
          <span class="temp">{{ weather.temperature }}°</span>
        </template>
        <span class="desc">{{ weather.description }}</span>
      </div>
      <div class="aside">
        <span class="place">
          <template v-if="weather.mode === 'day' && weather.date">
            {{ formatDisplayDate(weather.date) }} · {{ weather.placeName }}
          </template>
          <template v-else>此刻 · {{ weather.placeName }}</template>
        </span>
        <span v-if="weather.mode === 'day'" class="meta">
          降水 {{ weather.precipitation ?? 0 }} mm · 风速最大 {{ weather.windSpeed ?? '—' }} m/s
        </span>
        <span v-else class="meta">
          湿度 {{ weather.humidity }}% · 风速 {{ weather.windSpeed }} m/s
          <template v-if="weather.precipitation != null">
            · 降水 {{ weather.precipitation }} mm
          </template>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.weather {
  margin: 0.55rem 0 0;
  max-width: 32rem;
  padding: 0.65rem 0.85rem;
  border-radius: var(--radius-sm);
}

.modes {
  display: inline-flex;
  gap: 0.2rem;
  margin-bottom: 0.5rem;
  padding: 0.15rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
}

.mode-btn {
  border: none;
  background: transparent;
  color: var(--glass-text-soft);
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.28rem 0.7rem;
  border-radius: 999px;
  cursor: pointer;
  transition: background 160ms var(--ease), color 160ms var(--ease);
}

.mode-btn.active {
  background: rgba(255, 255, 255, 0.22);
  color: var(--glass-text);
  box-shadow: none;
}

.status {
  margin: 0;
  font-size: 0.88rem;
  color: var(--glass-text-soft);
}

.status.error {
  color: #ff8f8f;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.55rem 1rem;
}

.main {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
}

.temp {
  font-family: var(--font-display);
  font-size: 1.45rem;
  font-weight: 600;
  line-height: 1;
  color: var(--glass-text);
}

.desc {
  font-weight: 700;
  color: #7fd4c8;
}

.aside {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}

.place {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--glass-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  font-size: 0.78rem;
  color: var(--glass-text-soft);
}

</style>
