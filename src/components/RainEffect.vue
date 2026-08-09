<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { RainIntensity } from '@/services/weather'
import { rainEffectActive, rainEffectIntensity } from '@/utils/rainEffect'

interface Drop {
  id: number
  left: string
  delay: string
  duration: string
  height: string
  width: string
  opacity: number
  drift: string
}

function seeded(index: number, salt: number): number {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

const INTENSITY_CONFIG: Record<
  RainIntensity,
  { count: number; minH: number; maxH: number; minW: number; maxW: number; speed: [number, number]; opacity: [number, number] }
> = {
  light: {
    count: 70,
    minH: 14,
    maxH: 26,
    minW: 1.5,
    maxW: 2.2,
    speed: [0.75, 1.15],
    opacity: [0.4, 0.7],
  },
  moderate: {
    count: 120,
    minH: 16,
    maxH: 32,
    minW: 1.8,
    maxW: 2.6,
    speed: [0.55, 0.95],
    opacity: [0.5, 0.85],
  },
  heavy: {
    count: 180,
    minH: 18,
    maxH: 40,
    minW: 2.2,
    maxW: 3.2,
    speed: [0.4, 0.75],
    opacity: [0.6, 0.95],
  },
}

const drops = computed<Drop[]>(() => {
  const cfg = INTENSITY_CONFIG[rainEffectIntensity.value]
  return Array.from({ length: cfg.count }, (_, index) => {
    const a = seeded(index, 1)
    const b = seeded(index, 2)
    const c = seeded(index, 3)
    const height = cfg.minH + a * (cfg.maxH - cfg.minH)
    const width = cfg.minW + b * (cfg.maxW - cfg.minW)
    const duration = cfg.speed[0] + c * (cfg.speed[1] - cfg.speed[0])
    const opacity = cfg.opacity[0] + a * (cfg.opacity[1] - cfg.opacity[0])
    return {
      id: index,
      left: `${a * 100}%`,
      delay: `${b * 1.5}s`,
      duration: `${duration}s`,
      height: `${height}px`,
      width: `${width}px`,
      opacity,
      drift: `${10 + c * 22}px`,
    }
  })
})

const visible = ref(false)
let hideTimer = 0

watch(
  rainEffectActive,
  (active) => {
    window.clearTimeout(hideTimer)
    if (active) {
      visible.value = true
    } else {
      hideTimer = window.setTimeout(() => {
        visible.value = false
      }, 320)
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  window.clearTimeout(hideTimer)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="rain-effect"
      :class="[`intensity-${rainEffectIntensity}`, { active: rainEffectActive }]"
      aria-hidden="true"
    >
      <span
        v-for="drop in drops"
        :key="drop.id"
        class="drop"
        :style="{
          left: drop.left,
          width: drop.width,
          height: drop.height,
          opacity: drop.opacity,
          animationDelay: drop.delay,
          animationDuration: drop.duration,
          '--drift': drop.drift,
        }"
      />
    </div>
  </Teleport>
</template>

<style scoped>
.rain-effect {
  position: fixed;
  inset: 0;
  z-index: 80;
  pointer-events: none;
  overflow: hidden;
  opacity: 0;
  transition: opacity 0.3s var(--ease);
}

.rain-effect.active {
  opacity: 1;
}

.rain-effect.intensity-heavy {
  background: linear-gradient(
    180deg,
    rgba(11, 47, 56, 0.04) 0%,
    transparent 40%,
    rgba(11, 47, 56, 0.06) 100%
  );
}

.drop {
  position: absolute;
  top: -12%;
  border-radius: 999px;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(70, 130, 140, 0.45) 30%,
    rgba(26, 155, 142, 0.9) 100%
  );
  box-shadow: 0 0 1px rgba(255, 255, 255, 0.25);
  transform: translate3d(0, -15vh, 0) rotate(12deg);
  animation-name: rainfall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes rainfall {
  to {
    transform: translate3d(var(--drift, 14px), 115vh, 0) rotate(12deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .rain-effect {
    display: none;
  }
}
</style>
