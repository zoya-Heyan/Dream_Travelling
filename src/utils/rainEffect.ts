import { ref } from 'vue'
import type { RainIntensity } from '@/services/weather'

const EFFECT_MS = 3000
const COOLDOWN_MS = 5500

export const rainEffectActive = ref(false)
export const rainEffectIntensity = ref<RainIntensity>('moderate')

let hideTimer = 0
let cooldownUntil = 0

export function triggerRainEffect(intensity: RainIntensity = 'moderate'): void {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const now = Date.now()
  if (rainEffectActive.value || now < cooldownUntil) return

  rainEffectIntensity.value = intensity
  cooldownUntil = now + COOLDOWN_MS
  rainEffectActive.value = true

  window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(() => {
    rainEffectActive.value = false
  }, EFFECT_MS)
}
