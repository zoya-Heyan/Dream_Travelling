<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '@/components/EmptyState.vue'
import TripCard from '@/components/TripCard.vue'
import { useTripsStore } from '@/stores/trips'

const store = useTripsStore()
const router = useRouter()
const importing = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

onMounted(() => {
  void store.loadTrips()
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
    <section class="hero">
      <div class="hero-bg" aria-hidden="true" />
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
        <p v-if="store.trips.length">共 {{ store.trips.length }} 条，保存在本机浏览器</p>
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
  min-height: min(92vh, 760px);
  display: grid;
  align-items: end;
  overflow: hidden;
  color: #f4fffd;
}

.hero-bg {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(8, 30, 36, 0.15) 0%, rgba(8, 30, 36, 0.72) 55%, rgba(8, 30, 36, 0.92) 100%),
    radial-gradient(ellipse 80% 55% at 20% 20%, rgba(26, 155, 142, 0.45), transparent 60%),
    radial-gradient(ellipse 60% 45% at 85% 30%, rgba(196, 163, 90, 0.28), transparent 55%),
    linear-gradient(145deg, #0b2f38 0%, #15545f 48%, #0f3d47 100%);
  animation: drift 14s ease-in-out infinite alternate;
}

.hero-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.55), transparent 75%);
}

.hero-inner {
  position: relative;
  z-index: 1;
  padding-top: 4rem;
  padding-bottom: 3.5rem;
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
  color: rgba(244, 255, 253, 0.84);
  font-size: 1.05rem;
  animation: fade-up 700ms var(--ease) 140ms both;
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

@keyframes drift {
  from {
    transform: scale(1) translateY(0);
  }
  to {
    transform: scale(1.04) translateY(-1.5%);
  }
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
