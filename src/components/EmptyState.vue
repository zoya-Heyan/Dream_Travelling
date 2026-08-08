<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="empty">
    <div class="empty-mark" aria-hidden="true" />
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
  width: 52px;
  height: 52px;
  margin: 0 auto 1rem;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 30%, #7fd4c8, transparent 45%),
    linear-gradient(145deg, var(--deep), var(--teal));
  animation: pulse 2.8s var(--ease) infinite;
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

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.85;
  }
}
</style>
