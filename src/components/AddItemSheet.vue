<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { Item, ItemType } from '@/types/trip'
import { ITEM_TYPE_LABELS } from '@/types/trip'
import type { ItemInput } from '@/stores/trips'

const props = defineProps<{
  open: boolean
  editing?: Item | null
}>()

const emit = defineEmits<{
  close: []
  save: [payload: ItemInput]
}>()

const form = reactive<ItemInput>({
  type: 'spot',
  title: '',
  time: '',
  place: '',
  description: '',
  cost: undefined,
})

const types = Object.entries(ITEM_TYPE_LABELS) as [ItemType, string][]

watch(
  () => [props.open, props.editing] as const,
  ([open, editing]) => {
    if (!open) return
    if (editing) {
      form.type = editing.type
      form.title = editing.title
      form.time = editing.time ?? ''
      form.place = editing.place ?? ''
      form.description = editing.description ?? ''
      form.cost = editing.cost
    } else {
      form.type = 'spot'
      form.title = ''
      form.time = ''
      form.place = ''
      form.description = ''
      form.cost = undefined
    }
  },
)

function onSubmit(): void {
  if (!form.title.trim()) return
  const costValue = form.cost
  emit('save', {
    type: form.type,
    title: form.title,
    time: form.time,
    place: form.place,
    description: form.description,
    cost:
      typeof costValue === 'number' && !Number.isNaN(costValue)
        ? costValue
        : undefined,
  })
}
</script>

<template>
  <div v-if="open" class="overlay" @click.self="emit('close')">
    <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="item-sheet-title">
      <header>
        <h2 id="item-sheet-title">{{ editing ? '编辑条目' : '添加条目' }}</h2>
        <button type="button" class="btn btn-ghost" @click="emit('close')">关闭</button>
      </header>

      <form class="form" @submit.prevent="onSubmit">
        <div class="field">
          <label for="item-type">类型</label>
          <select id="item-type" v-model="form.type">
            <option v-for="[value, label] in types" :key="value" :value="value">
              {{ label }}
            </option>
          </select>
        </div>

        <div class="field">
          <label for="item-title">名称</label>
          <input id="item-title" v-model="form.title" required placeholder="例如：清水寺" />
        </div>

        <div class="row">
          <div class="field">
            <label for="item-time">时间（可选）</label>
            <input id="item-time" v-model="form.time" type="time" />
          </div>
          <div class="field">
            <label for="item-cost">预估费用（可选）</label>
            <input
              id="item-cost"
              v-model.number="form.cost"
              type="number"
              min="0"
              step="1"
              placeholder="0"
            />
          </div>
        </div>

        <div class="field">
          <label for="item-place">地点（可选）</label>
          <input id="item-place" v-model="form.place" placeholder="地址或区域" />
        </div>

        <div class="field">
          <label for="item-desc">备注（可选）</label>
          <textarea
            id="item-desc"
            v-model="form.description"
            placeholder="预约信息、交通提示、想拍的角度…"
          />
        </div>

        <div class="footer">
          <button type="button" class="btn btn-secondary" @click="emit('close')">取消</button>
          <button type="submit" class="btn btn-primary">保存</button>
        </div>
      </form>
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
  width: min(100%, 520px);
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

.sheet :deep(.field input),
.sheet :deep(.field textarea),
.sheet :deep(.field select) {
  color: var(--glass-text);
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--glass-border);
}

.sheet :deep(.field input::placeholder),
.sheet :deep(.field textarea::placeholder) {
  color: var(--glass-text-soft);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.85rem;
}

h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.35rem;
  color: var(--glass-text);
}

.form {
  display: grid;
  gap: 0.85rem;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 0.35rem;
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

@media (max-width: 560px) {
  .row {
    grid-template-columns: 1fr;
  }
}
</style>
