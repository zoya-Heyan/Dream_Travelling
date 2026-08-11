<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import TripForm from '@/components/TripForm.vue'
import { useTripsStore } from '@/stores/trips'

const store = useTripsStore()
const router = useRouter()
const submitting = ref(false)

async function onSubmit(payload: Parameters<typeof store.createTrip>[0]): Promise<void> {
  submitting.value = true
  try {
    const trip = await store.createTrip(payload)
    await router.replace(`/trips/${trip.id}`)
  } catch {
    alert('创建失败，请重试')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="page create">
    <RouterLink class="back" to="/">← 返回</RouterLink>
    <header>
      <p class="eyebrow">New Trip</p>
      <h1>添加行程</h1>
      <p>选择日期后会自动生成 Day 1…N，之后可按天自由编排。</p>
    </header>

    <div class="panel">
      <TripForm :submitting="submitting" @submit="onSubmit" @cancel="router.push('/')" />
    </div>
  </main>
</template>

<style scoped>
.create {
  max-width: 640px;
}

.back {
  display: inline-block;
  margin-bottom: 1.25rem;
  color: var(--ink-soft);
  font-weight: 600;
}

.eyebrow {
  margin: 0;
  color: var(--teal-deep);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 0.8rem;
}

header h1 {
  margin: 0.35rem 0 0;
  font-family: var(--font-display);
  font-size: clamp(2rem, 5vw, 2.6rem);
}

header p {
  margin: 0.55rem 0 0;
  color: var(--ink-soft);
}

.panel {
  margin-top: 1.5rem;
  padding: 1.25rem;
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
}
</style>
