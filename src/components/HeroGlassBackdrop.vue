<script setup lang="ts">
import heroImage from '@/assets/hero.png'
</script>

<template>
  <Teleport to="body">
    <div
      class="hero-glass-backdrop"
      aria-hidden="true"
      :style="{ backgroundImage: `url(${heroImage})` }"
    />
  </Teleport>
</template>

<style scoped>
.hero-glass-backdrop {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  background-color: #0b2f38;
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
}
</style>
