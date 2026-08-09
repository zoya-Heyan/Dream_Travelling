<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineProps<{
  title: string
  description?: string
}>()

const CHARSET = '01ABCDEF.#+>x'
const TARGETS = [
  '[ ............ ]',
  '[ ..0x........ ]',
  '[ ..0x41...... ]',
  '[ 01000001.... ]',
  '[ >>.......... ]',
  '[ ......0101.. ]',
] as const

const SCRAMBLE_MS = 420
const HOLD_MS = 520
const SETTLE_MS = 480

const frame = ref<string>(TARGETS[0])
let raf = 0
let reducedMotion = false

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function randChar(): string {
  return CHARSET[(Math.random() * CHARSET.length) | 0] ?? '.'
}

function morph(from: string, to: string, progress: number): string {
  const p = easeInOut(Math.min(1, Math.max(0, progress)))
  let out = ''
  for (let i = 0; i < to.length; i++) {
    const target = to[i] ?? ' '
    const source = from[i] ?? ' '
    if (target === ' ' || target === '[' || target === ']') {
      out += target
      continue
    }
    // Left-to-right settle with a soft lead-in window
    const threshold = (i / Math.max(1, to.length - 1)) * 0.65
    if (p < threshold) {
      out += p < 0.08 ? source : randChar()
    } else if (p < threshold + 0.22) {
      out += Math.random() > (p - threshold) / 0.22 ? randChar() : target
    } else {
      out += target
    }
  }
  return out
}

function loop(startedAt: number): void {
  const cycle = SCRAMBLE_MS + SETTLE_MS + HOLD_MS
  const elapsed = performance.now() - startedAt
  const cycleIndex = Math.floor(elapsed / cycle) % TARGETS.length
  const nextIndex = (cycleIndex + 1) % TARGETS.length
  const local = elapsed % cycle

  const from = TARGETS[cycleIndex]
  const to = TARGETS[nextIndex]

  if (local < SCRAMBLE_MS) {
    // Soft scramble in place on current target
    const p = local / SCRAMBLE_MS
    frame.value = morph(from, from, 0.15 + p * 0.35)
  } else if (local < SCRAMBLE_MS + SETTLE_MS) {
    const p = (local - SCRAMBLE_MS) / SETTLE_MS
    frame.value = morph(from, to, p)
  } else {
    frame.value = to
  }

  raf = requestAnimationFrame(() => loop(startedAt))
}

onMounted(() => {
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reducedMotion) {
    frame.value = TARGETS[0]
    return
  }
  const startedAt = performance.now()
  raf = requestAnimationFrame(() => loop(startedAt))
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
})
</script>

<template>
  <div class="empty">
    <pre class="empty-mark" aria-hidden="true">{{ frame }}</pre>
    <h3>{{ title }}</h3>
    <p v-if="description">{{ description }}</p>
    <div v-if="$slots.default" class="empty-actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.empty {
  text-align: center;
  padding: 2.5rem 1.25rem;
  border: 1px dashed rgba(16, 42, 51, 0.18);
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.45);
}

.empty-mark {
  margin: 0 auto 1rem;
  min-height: 1.6rem;
  font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
  font-size: 0.95rem;
  line-height: 1.6;
  letter-spacing: 0.06em;
  color: var(--teal-deep);
  background: none;
  border: none;
  white-space: pre;
  animation: mark-breathe 2.8s ease-in-out infinite;
}

:global(.photo-shell) .empty-mark {
  color: var(--glass-text-soft);
}

@keyframes mark-breathe {
  0%,
  100% {
    opacity: 0.72;
  }
  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .empty-mark {
    animation: none;
    opacity: 0.9;
  }
}

h3 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.35rem;
}

p {
  margin: 0.5rem auto 0;
  max-width: 28ch;
  color: var(--ink-soft);
}

.empty-actions {
  margin-top: 1.25rem;
}
</style>
