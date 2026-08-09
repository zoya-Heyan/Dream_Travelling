<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '@/components/EmptyState.vue'
import InkLandscape from '@/components/InkLandscape.vue'
import type { LandscapeTheme } from '@/components/InkLandscape.vue'
import TripCard from '@/components/TripCard.vue'
import { useTripsStore } from '@/stores/trips'

const THEME_KEY = 'dt-hero-theme'

const store = useTripsStore()
const router = useRouter()
const importing = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const theme = ref<LandscapeTheme>('danxia')

function readStoredTheme(): LandscapeTheme {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'ink' || stored === 'danxia') return stored
  } catch {
    /* ignore */
  }
  return 'danxia'
}

function toggleTheme(): void {
  theme.value = theme.value === 'danxia' ? 'ink' : 'danxia'
}

onMounted(() => {
  theme.value = readStoredTheme()
  void store.loadTrips()
})

watch(theme, (value) => {
  try {
    localStorage.setItem(THEME_KEY, value)
  } catch {
    /* ignore */
  }
})

async function onDelete(id: string): Promise<void> {
  if (!confirm('确定删除这条行程？此操作无法撤销。')) return
  await store.deleteTrip(id)
}

function triggerImport(): void {
  fileInput.value?.click()
}

async function onImportFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  importing.value = true
  try {
    const text = await file.text()
    const payload = JSON.parse(text) as unknown
    const trip = await store.importTrip(payload)
    await router.push(`/trips/${trip.id}`)
  } catch (error) {
    alert(error instanceof Error ? error.message : '导入失败，请检查文件格式')
  } finally {
    importing.value = false
    input.value = ''
  }
}
</script>

<template>
  <main class="home">
    <section class="hero" :class="theme === 'ink' ? 'hero--ink' : 'hero--danxia'">
      <InkLandscape :theme="theme" />
      <div class="hero-fade" aria-hidden="true" />
      <button
        type="button"
        class="theme-switch"
        :title="theme === 'danxia' ? '切换为深青山水背景' : '切换为白底丹霞背景'"
        :aria-label="theme === 'danxia' ? '切换为深青山水背景' : '切换为白底丹霞背景'"
        @click="toggleTheme"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none">
          <path
            d="M16.5 3.5 19 6l-2.5 2.5M7.5 20.5 5 18l2.5-2.5"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M18.7 6A8 8 0 0 0 6.2 7.8M5.3 18A8 8 0 0 0 17.8 16.2"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
      </button>
      <div class="hero-inner page">
        <p class="brand">Dream Travelling</p>
        <h1>把旅途写成你自己的节奏</h1>
        <p class="lead">为旅行爱好者准备的攻略笔记本：按天编排景点、餐饮、交通与住宿。</p>
        <div class="cta-row">
          <RouterLink class="btn btn-primary" to="/trips/new">开始做攻略</RouterLink>
          <button type="button" class="btn btn-secondary" :disabled="importing" @click="triggerImport">
            {{ importing ? '导入中…' : '导入 JSON' }}
          </button>
          <input
            ref="fileInput"
            class="sr-only"
            type="file"
            accept="application/json,.json"
            @change="onImportFile"
          />
        </div>
      </div>
    </section>

    <section class="page list-section">
      <div class="section-head">
        <h2>我的行程</h2>
        <p v-if="store.trips.length">共 {{ store.trips.length }} 条</p>
      </div>

      <div v-if="store.loading" class="loading">加载中…</div>

      <div v-else-if="store.trips.length" class="grid">
        <TripCard
          v-for="trip in store.trips"
          :key="trip.id"
          :trip="trip"
          @delete="onDelete"
        />
      </div>

      <EmptyState
        v-else
        title="还没有行程"
        description="新建一条多日攻略，或导入之前导出的 JSON 备份。"
      >
        <RouterLink class="btn btn-primary" to="/trips/new">新建行程</RouterLink>
      </EmptyState>
    </section>
  </main>
</template>

<style scoped>
.hero {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  align-items: end;
  overflow: hidden;
  transition: color 280ms var(--ease), background-color 280ms var(--ease);
}

.hero--danxia {
  color: var(--ink);
  background: #ffffff;
}

.hero--ink {
  color: #f4fffd;
  background: var(--deep);
}

.hero-fade {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  transition: opacity 280ms var(--ease);
}

.hero--danxia .hero-fade {
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0) 52%,
      rgba(255, 255, 255, 0.55) 78%,
      rgba(255, 255, 255, 0.92) 100%
    );
}

.hero--ink .hero-fade {
  background:
    linear-gradient(
      180deg,
      rgba(8, 30, 36, 0) 0%,
      rgba(8, 30, 36, 0.12) 48%,
      rgba(8, 30, 36, 0.62) 72%,
      rgba(8, 30, 36, 0.9) 100%
    );
}

.theme-switch {
  position: absolute;
  top: 0.95rem;
  right: 0.95rem;
  z-index: 3;
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  opacity: 0.32;
  transition: opacity 180ms var(--ease), transform 180ms var(--ease), background 180ms var(--ease);
}

.hero--danxia .theme-switch {
  color: var(--ink);
}

.hero--ink .theme-switch {
  color: #f4fffd;
}

.theme-switch:hover {
  opacity: 0.7;
  background: rgba(127, 127, 127, 0.1);
}

.theme-switch:active {
  transform: scale(0.96);
  opacity: 0.85;
}

.theme-switch svg {
  display: block;
}

.hero-inner {
  position: relative;
  z-index: 2;
  padding-top: 4rem;
  padding-bottom: 4.5rem;
  pointer-events: none;
}

.hero-inner :is(a, button) {
  pointer-events: auto;
}

.brand {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(2.6rem, 8vw, 4.6rem);
  line-height: 1;
  letter-spacing: -0.02em;
  animation: fade-up 700ms var(--ease) both;
}

h1 {
  margin: 1.1rem 0 0;
  max-width: 14ch;
  font-family: var(--font-display);
  font-size: clamp(1.55rem, 4vw, 2.2rem);
  font-weight: 500;
  line-height: 1.25;
  animation: fade-up 700ms var(--ease) 80ms both;
}

.lead {
  margin: 0.9rem 0 0;
  max-width: 34ch;
  font-size: 1.05rem;
  animation: fade-up 700ms var(--ease) 140ms both;
}

.hero--danxia .lead {
  color: rgba(16, 42, 51, 0.72);
}

.hero--ink .lead {
  color: rgba(244, 255, 253, 0.84);
}

.hero--ink .btn-secondary {
  background: rgba(255, 255, 255, 0.14);
  color: #f4fffd;
  border-color: rgba(244, 255, 253, 0.28);
}

.hero--ink .btn-secondary:hover {
  background: rgba(255, 255, 255, 0.22);
}

.cta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
  margin-top: 1.6rem;
  animation: fade-up 700ms var(--ease) 200ms both;
}

.list-section {
  padding-top: 2.25rem;
}

.section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 1.1rem;
}

.section-head h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.7rem;
}

.section-head p,
.loading {
  margin: 0;
  color: var(--ink-soft);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
