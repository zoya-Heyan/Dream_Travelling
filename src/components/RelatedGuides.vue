<script setup lang="ts">
import { onMounted, watch } from 'vue'
import GuideCard from '@/components/GuideCard.vue'
import { useGuidesStore } from '@/stores/guides'

const props = defineProps<{
  destination: string
}>()

const store = useGuidesStore()

async function refresh(): Promise<void> {
  if (!props.destination.trim()) {
    store.clearRelated()
    return
  }
  await store.loadRelated(props.destination)
}

onMounted(() => {
  void refresh()
})

watch(
  () => props.destination,
  () => {
    void refresh()
  },
)
</script>

<template>
  <section v-if="destination.trim()" class="related glass-panel">
    <div class="head">
      <div>
        <h2>相关攻略</h2>
        <p>围绕「{{ destination }}」聚合的目的地指南与资讯</p>
      </div>
      <RouterLink class="btn btn-secondary" :to="{ path: '/explore', query: { q: destination } }">
        查看更多
      </RouterLink>
    </div>

    <p v-if="store.relatedLoading" class="hint">正在查找相关内容…</p>
    <p v-else-if="!store.related.length" class="hint">暂时没有匹配的攻略，可到资讯页搜索。</p>
    <div v-else class="list">
      <GuideCard v-for="item in store.related" :key="item.id" :item="item" />
    </div>
  </section>
</template>

<style scoped>
.related {
  margin: 1.25rem 0 0;
  padding: 1.1rem 1.15rem 1.25rem;
}

.head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: flex-start;
  margin-bottom: 0.9rem;
}

h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.25rem;
  color: var(--ink-on-photo);
}

p {
  margin: 0.25rem 0 0;
  color: var(--ink-soft-on-photo);
  font-size: 0.88rem;
}

.hint {
  margin: 0;
  color: var(--ink-soft-on-photo);
  font-size: 0.9rem;
}

.list {
  display: grid;
  gap: 0.75rem;
}
</style>
