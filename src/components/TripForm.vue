<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { CreateTripInput } from '@/stores/trips'
import { addDaysISO, todayISO } from '@/utils/dates'

const props = withDefaults(
  defineProps<{
    submitLabel?: string
    submitting?: boolean
  }>(),
  {
    submitLabel: '创建并开始编排',
    submitting: false,
  },
)

const emit = defineEmits<{
  submit: [payload: CreateTripInput]
  cancel: []
}>()

const error = ref('')

const form = reactive({
  title: '',
  destination: '',
  startDate: todayISO(),
  endDate: addDaysISO(todayISO(), 2),
})

function reset(): void {
  form.title = ''
  form.destination = ''
  form.startDate = todayISO()
  form.endDate = addDaysISO(todayISO(), 2)
  error.value = ''
}

function onSubmit(): void {
  error.value = ''
  if (!form.title.trim() || !form.destination.trim()) {
    error.value = '请填写标题和目的地'
    return
  }
  if (form.endDate < form.startDate) {
    error.value = '结束日期不能早于出发日期'
    return
  }

  emit('submit', {
    title: form.title,
    destination: form.destination,
    startDate: form.startDate,
    endDate: form.endDate,
  })
}

defineExpose({ reset })
</script>

<template>
  <form class="trip-form" @submit.prevent="onSubmit">
    <div class="field">
      <label for="trip-title">行程标题</label>
      <input id="trip-title" v-model="form.title" required placeholder="例如：京都慢游四日" />
    </div>

    <div class="field">
      <label for="trip-destination">目的地</label>
      <input id="trip-destination" v-model="form.destination" required placeholder="例如：京都" />
    </div>

    <div class="row">
      <div class="field">
        <label for="trip-start">出发日</label>
        <input id="trip-start" v-model="form.startDate" type="date" required />
      </div>
      <div class="field">
        <label for="trip-end">结束日</label>
        <input id="trip-end" v-model="form.endDate" type="date" required />
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="actions">
      <button type="button" class="btn btn-secondary" @click="emit('cancel')">取消</button>
      <button type="submit" class="btn btn-primary" :disabled="submitting">
        {{ submitting ? '创建中…' : props.submitLabel }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.trip-form {
  display: grid;
  gap: 1rem;
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
