<script setup lang="ts">
import { RouterView } from 'vue-router'
import RainEffect from '@/components/RainEffect.vue'
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <KeepAlive include="ExploreView">
      <component :is="Component" :key="route.name === 'explore' ? 'explore' : route.fullPath" />
    </KeepAlive>
  </RouterView>
  <RainEffect />
</template>
