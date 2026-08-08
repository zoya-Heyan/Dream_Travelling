<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTripsStore } from '@/stores/trips'
import { addDaysISO, todayISO } from '@/utils/dates'

const store = useTripsStore()
const router = useRouter()
const submitting = ref(false)
const error = ref('')

const form = reactive({
  title: '',
  destination: '',
  startDate: todayISO(),
  endDate: addDaysISO(todayISO(), 2),
})

async function onSubmit(): Promise<void> {
  error.value = ''
  if (!form.title.trim() || !form.destination.trim()) {
    error.value = '请填写标题和目的地'
    return
  }
  if (form.endDate < form.startDate) {
    error.value = '结束日期不能早于出发日期'
    return
  }

  submitting.value = true
  try {
    const trip = await store.createTrip({ ...form })
    await router.replace(`/trips/${trip.id}`)
  } catch {
    error.value = '创建失败，请重试'
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
      <h1>新建行程</h1>
      <p>选择日期后会自动生成 Day 1…N，之后可按天自由编排。</p>
    </header>

    <form class="panel" @submit.prevent="onSubmit">
      <div class="field">
        <label for="title">行程标题</label>
        <input id="title" v-model="form.title" required placeholder="例如：京都慢游四日" />
      </div>

      <div class="field">
        <label for="destination">目的地</label>
        <input id="destination" v-model="form.destination" required placeholder="例如：京都" />
      </div>

      <div class="row">
        <div class="field">
          <label for="start">出发日</label>
          <input id="start" v-model="form.startDate" type="date" required />
        </div>
        <div class="field">
          <label for="end">结束日</label>
          <input id="end" v-model="form.endDate" type="date" required />
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="actions">
        <RouterLink class="btn btn-secondary" to="/">取消</RouterLink>
        <button type="submit" class="btn btn-primary" :disabled="submitting">
          {{ submitting ? '创建中…' : '创建并开始编排' }}
        </button>
      </div>
    </form>
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
  display: grid;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.85rem;
}

.error {
  margin: 0;
  color: #b42318;
  font-size: 0.92rem;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.65rem;
  margin-top: 0.25rem;
}

@media (max-width: 560px) {
  .row {
    grid-template-columns: 1fr;
  }
}
</style>
