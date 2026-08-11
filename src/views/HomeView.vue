<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AddTripSheet from '@/components/AddTripSheet.vue'
import EmptyState from '@/components/EmptyState.vue'
import InkLandscape from '@/components/InkLandscape.vue'
import type { LandscapeTheme } from '@/components/InkLandscape.vue'
import TripCard from '@/components/TripCard.vue'
import { useTripsStore, type CreateTripInput } from '@/stores/trips'

const THEME_KEY = 'dt-hero-theme'

const store = useTripsStore()
const router = useRouter()
const importing = ref(false)
const creating = ref(false)
const tripSheetOpen = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const homeEl = ref<HTMLElement | null>(null)
const theme = ref<LandscapeTheme>('danxia')
const revealP = ref(0)

let reducedMotion = false

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

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

function syncReveal(): void {
  const home = homeEl.value
  if (!home) return

  const y = home.scrollTop
  const maxScroll = home.scrollHeight - home.clientHeight

  if (reducedMotion) {
    revealP.value = maxScroll <= 0 ? 0 : clamp01(y / maxScroll)
    return
  }

  revealP.value = maxScroll <= 0 ? 0 : clamp01(y / maxScroll)
}

/** Fixed canvas sits above content; forward wheel to the home scroller. */
function onLandscapeWheel(event: WheelEvent): void {
  const home = homeEl.value
  if (!home || event.ctrlKey) return
  event.preventDefault()
  home.scrollTop += event.deltaY
}

onMounted(() => {
  theme.value = readStoredTheme()
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const el = homeEl.value
  if (el) {
    el.addEventListener('scroll', syncReveal, { passive: true })
    syncReveal()
  }

  window.addEventListener('resize', syncReveal, { passive: true })

  void store.loadTrips().then(() => nextTick(syncReveal))
})

onBeforeUnmount(() => {
  document.documentElement.style.overflow = ''
  document.body.style.overflow = ''

  const el = homeEl.value
  if (el) el.removeEventListener('scroll', syncReveal)
  window.removeEventListener('resize', syncReveal)
})

watch(theme, (value) => {
  try {
    localStorage.setItem(THEME_KEY, value)
  } catch {
    /* ignore */
  }
})

watch(
  () => [store.loading, store.trips.length] as const,
  () => {
    void nextTick(syncReveal)
  },
)

async function onDelete(id: string): Promise<void> {
  if (!confirm('确定删除这条行程？此操作无法撤销。')) return
  await store.deleteTrip(id)
}

function triggerImport(): void {
  fileInput.value?.click()
}

function openTripSheet(): void {
  tripSheetOpen.value = true
}

async function onCreateTrip(payload: CreateTripInput): Promise<void> {
  creating.value = true
  try {
    const trip = await store.createTrip(payload)
    tripSheetOpen.value = false
    await router.push(`/trips/${trip.id}`)
  } catch {
    alert('创建失败，请重试')
  } finally {
    creating.value = false
  }
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
  <main
    ref="homeEl"
    class="home"
    :class="theme === 'ink' ? 'home--ink' : 'home--danxia'"
    :style="{ '--reveal-p': String(revealP) }"
  >
    <div
      class="home-landscape"
      :class="{ 'home-landscape--faded': revealP >= 0.98 }"
      aria-hidden="true"
      @wheel="onLandscapeWheel"
    >
      <InkLandscape :theme="theme" />
      <div class="home-fade" />
    </div>

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

    <div class="home-content">
      <section class="hero">
        <div class="hero-inner page">
          <p class="brand">Dream Travelling</p>
          <h1>把旅途写成你自己的节奏</h1>
          <p class="lead">为旅行爱好者准备的攻略笔记本：按天编排景点、餐饮、交通与住宿。</p>
          <div class="cta-row">
            <button type="button" class="btn btn-primary" @click="openTripSheet">添加行程</button>
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

      <section class="list-section">
        <div class="list-inner page photo-shell">
          <div class="section-head reveal-item reveal-head">
            <div>
              <h2>我的行程</h2>
              <p v-if="store.trips.length">共 {{ store.trips.length }} 条</p>
            </div>
            <div class="section-actions">
              <RouterLink class="btn btn-secondary explore-link" to="/explore">资讯攻略</RouterLink>
              <button
                v-if="store.trips.length"
                type="button"
                class="btn btn-primary add-trip-btn"
                @click="openTripSheet"
              >
                添加行程
              </button>
            </div>
          </div>

          <div v-if="store.loading" class="loading reveal-item reveal-body">加载中…</div>

          <div v-else-if="store.trips.length" class="grid">
            <TripCard
              v-for="(trip, index) in store.trips"
              :key="trip.id"
              class="reveal-item reveal-card"
              :style="{ '--card-i': String(index) }"
              :trip="trip"
              @delete="onDelete"
            />
          </div>

        <EmptyState
          v-else
          class="reveal-item reveal-body glass-panel"
          title="还没有行程"
            description="新建一条多日攻略，或导入之前导出的 JSON 备份。"
          >
            <button type="button" class="btn btn-primary" @click="openTripSheet">添加行程</button>
          </EmptyState>
        </div>
      </section>
    </div>

    <AddTripSheet
      :open="tripSheetOpen"
      :submitting="creating"
      @close="tripSheetOpen = false"
      @submit="onCreateTrip"
    />
  </main>
</template>

<style scoped>
.home {
  --reveal-p: 0;
  position: relative;
  height: 100vh;
  height: 100dvh;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
}

.home--danxia {
  color: var(--ink);
  background: #ffffff;
}

.home--ink {
  color: #f4fffd;
  background: var(--deep);
}

.home-landscape {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: calc(1 - var(--reveal-p));
  will-change: opacity;
}

/* Ink interaction on canvas; wheel passes through to .home scroll container */
.home-landscape :deep(.ink-landscape) {
  pointer-events: auto;
  touch-action: pan-y;
  cursor: crosshair;
}

.home-landscape--faded :deep(.ink-landscape) {
  pointer-events: none;
  cursor: default;
}

.home-fade {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.home--danxia .home-fade {
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0) 52%,
      rgba(255, 255, 255, 0.45) 78%,
      rgba(255, 255, 255, 0.82) 100%
    );
}

.home--ink .home-fade {
  background:
    linear-gradient(
      180deg,
      rgba(8, 30, 36, 0) 0%,
      rgba(8, 30, 36, 0.12) 48%,
      rgba(8, 30, 36, 0.55) 72%,
      rgba(8, 30, 36, 0.82) 100%
    );
}

.home-content {
  position: relative;
  z-index: 1;
  pointer-events: none;
}

.theme-switch {
  position: fixed;
  top: 0.95rem;
  right: 0.95rem;
  z-index: 5;
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

.home--danxia .theme-switch {
  color: var(--ink);
}

.home--ink .theme-switch {
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

.hero {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  align-items: end;
  pointer-events: none;
}

.hero-inner {
  padding-top: 4rem;
  padding-bottom: 4.5rem;
  opacity: calc(1 - var(--reveal-p) * 0.85);
  transform: translate3d(0, calc(var(--reveal-p) * -24px), 0);
  will-change: opacity, transform;
}

.hero-inner :is(a, button, input) {
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

.home--danxia .lead {
  color: rgba(16, 42, 51, 0.72);
}

.home--ink .lead {
  color: rgba(244, 255, 253, 0.84);
}

.home--ink .btn-secondary {
  background: rgba(255, 255, 255, 0.14);
  color: #f4fffd;
  border-color: rgba(244, 255, 253, 0.28);
}

.home--ink .btn-secondary:hover {
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
  position: relative;
  z-index: 2;
  min-height: 100vh;
  min-height: 100dvh;
  color: var(--ink);
  pointer-events: none;
}

.home--ink .list-section {
  color: #f4fffd;
}

.list-inner {
  padding-top: 1.5rem;
  padding-bottom: 4rem;
}

/* Editor blur params; home-specific opacity for readable contrast */
.list-inner.photo-shell {
  --glass-filter: saturate(180%) blur(18px);
}

.home--danxia .list-inner.photo-shell {
  --glass-bg: rgba(255, 255, 255, 0.62);
  --glass-bg-hover: rgba(255, 255, 255, 0.78);
  --glass-border: rgba(16, 42, 51, 0.14);
  --glass-text: var(--ink);
  --glass-text-soft: var(--ink-soft);
}

.home--ink .list-inner.photo-shell {
  --glass-bg: rgba(255, 255, 255, 0.1);
  --glass-bg-hover: rgba(255, 255, 255, 0.2);
  --glass-border: rgba(255, 255, 255, 0.28);
  --glass-text: #f4fffd;
  --glass-text-soft: rgba(244, 255, 253, 0.78);
}

.list-section :deep(.glass-panel) {
  box-shadow: 0 8px 28px rgba(11, 47, 56, 0.1);
}

.home--ink .list-section :deep(.glass-panel) {
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.2);
}

.home--danxia .list-section :deep(.destination) {
  color: var(--teal-deep);
}

.section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 1.1rem;
}

.section-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  align-items: center;
}

.section-head h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.7rem;
}

.section-head > div p,
.loading {
  margin: 0;
  color: var(--ink-soft);
}

.add-trip-btn {
  flex-shrink: 0;
}

.home--ink .section-head > div p,
.home--ink .loading {
  color: rgba(244, 255, 253, 0.72);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.reveal-item {
  opacity: calc(var(--reveal-p) * var(--reveal-p));
  transform: translate3d(0, calc((1 - var(--reveal-p)) * 28px), 0);
  will-change: opacity, transform;
}

.reveal-body {
  opacity: calc(var(--reveal-p) * 0.15 + var(--reveal-p) * var(--reveal-p) * 0.85);
}

.reveal-card {
  opacity: calc(
    var(--reveal-p) * var(--reveal-p) - var(--card-i, 0) * 0.04 * (1 - var(--reveal-p))
  );
  transform: translate3d(
    0,
    calc((1 - var(--reveal-p)) * (30px + var(--card-i, 0) * 6px)),
    0
  );
}

.list-section :deep(.trip-card),
.list-section :deep(.empty),
.list-section :deep(a),
.list-section :deep(button) {
  pointer-events: auto;
}

.list-section :deep(.empty) {
  border-radius: var(--radius);
}

.list-section :deep(.empty p) {
  color: var(--glass-text-soft);
}

.list-section :deep(.empty h3) {
  color: var(--glass-text);
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

@media (prefers-reduced-motion: reduce) {
  .home-landscape,
  .hero-inner,
  .reveal-item,
  .reveal-card {
    transform: none !important;
    will-change: auto;
  }

  .home-landscape {
    opacity: calc(1 - var(--reveal-p));
  }

  .hero-inner {
    opacity: calc(1 - var(--reveal-p) * 0.5);
  }

  .reveal-item,
  .reveal-body,
  .reveal-card {
    opacity: var(--reveal-p);
  }

  .brand,
  h1,
  .lead,
  .cta-row {
    animation: none;
  }
}
</style>
