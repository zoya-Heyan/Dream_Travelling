<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import TripForm from '@/components/TripForm.vue'
import type { CreateTripInput } from '@/stores/trips'

const props = defineProps<{
  open: boolean
  submitting?: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: CreateTripInput]
}>()

const formRef = ref<InstanceType<typeof TripForm> | null>(null)

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    await nextTick()
    formRef.value?.reset()
  },
)
</script>

<template>
  <div v-if="open" class="overlay" @click.self="emit('close')">
    <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="trip-sheet-title">
      <header>
        <div>
          <h2 id="trip-sheet-title">添加行程</h2>
          <p class="hint">选择日期后会自动生成 Day 1…N，之后可按天自由编排。</p>
        </div>
        <button type="button" class="btn btn-ghost" @click="emit('close')">关闭</button>
      </header>

      <TripForm
        ref="formRef"
        submit-label="添加并开始编排"
        :submitting="submitting"
        @submit="emit('submit', $event)"
        @cancel="emit('close')"
      />
    </section>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(8, 28, 34, 0.45);
  display: grid;
  align-items: end;
  padding: 1rem;
  animation: fade-in 180ms var(--ease);
}

.sheet {
  width: min(100%, 560px);
  margin: 0 auto;
  color: var(--glass-text);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 22px 22px 18px 18px;
  padding: 1.1rem 1.15rem 1.25rem;
  box-shadow: var(--shadow);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  animation: rise 220ms var(--ease);
}

.sheet :deep(.btn-secondary),
.sheet :deep(.btn-primary),
.sheet :deep(.btn-ghost) {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  color: var(--glass-text);
  box-shadow: none;
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
}

.sheet :deep(.field label) {
  color: var(--glass-text-soft);
}

.sheet :deep(.field input) {
  color: var(--glass-text);
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--glass-border);
}

.sheet :deep(.field input::placeholder) {
  color: var(--glass-text-soft);
}

header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.35rem;
  color: var(--glass-text);
}

.hint {
  margin: 0.35rem 0 0;
  font-size: 0.9rem;
  color: var(--glass-text-soft);
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes rise {
  from {
    transform: translateY(18px);
    opacity: 0.7;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@media (min-width: 720px) {
  .overlay {
    align-items: center;
  }
}
</style>
