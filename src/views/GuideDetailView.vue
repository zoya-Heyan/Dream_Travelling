<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import HeroGlassBackdrop from '@/components/HeroGlassBackdrop.vue'
import { useGuidesStore } from '@/stores/guides'

const props = defineProps<{
  source: string
  id: string
}>()

const route = useRoute()
const store = useGuidesStore()

const pageTitle = computed(() => decodeURIComponent(props.id))
const backQuery = computed(() => {
  const q = typeof route.query.q === 'string' ? route.query.q : ''
  return q ? { q } : {}
})

async function load(): Promise<void> {
  await store.loadDetail(props.source, props.id)
}

onMounted(() => {
  void load()
})

watch(
  () => [props.source, props.id],
  () => {
    void load()
  },
)
</script>

<template>
  <main class="page detail photo-shell">
    <HeroGlassBackdrop />
    <div class="page-content">
      <header class="topbar">
        <RouterLink class="back" :to="{ name: 'explore', query: backQuery }">← 返回资讯</RouterLink>
        <div class="actions">
          <a
            v-if="store.detail"
            class="btn btn-secondary"
            :href="store.detail.item.url"
            target="_blank"
            rel="noopener noreferrer"
          >
            打开原页
          </a>
        </div>
      </header>

      <div v-if="store.detailLoading" class="state">加载攻略正文…</div>

      <div v-else-if="store.detailError" class="state">
        <p>{{ store.detailError }}</p>
        <button type="button" class="btn btn-primary" @click="load">重试</button>
      </div>

      <article v-else-if="store.detail" class="article glass-panel">
        <p class="eyebrow">{{ store.sourceLabel(store.detail.item.sourceId) }}</p>
        <h1>{{ store.detail.item.title || pageTitle }}</h1>
        <p class="attr">{{ store.detail.attribution }}</p>
        <div class="wiki-body" v-html="store.detail.html" />
      </article>
    </div>
  </main>
</template>

<style scoped>
.detail {
  position: relative;
  z-index: 0;
  padding-bottom: 4rem;
}

.page-content {
  position: relative;
  z-index: 1;
}

.topbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
}

.back {
  color: var(--ink-on-photo);
  font-weight: 700;
  font-size: 0.92rem;
}

.state {
  padding: 3rem 0;
  text-align: center;
  color: var(--ink-soft-on-photo);
  display: grid;
  gap: 1rem;
  justify-items: center;
}

.article {
  padding: 1.25rem 1.2rem 1.6rem;
}

.eyebrow {
  margin: 0;
  color: #0d5c54;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-size: 0.78rem;
}

h1 {
  margin: 0.35rem 0 0;
  font-family: var(--font-display);
  font-size: clamp(1.7rem, 4vw, 2.35rem);
  line-height: 1.15;
  color: var(--ink-on-photo);
}

.attr {
  margin: 0.55rem 0 1.1rem;
  color: var(--ink-soft-on-photo);
  font-size: 0.86rem;
}

.wiki-body {
  color: var(--ink-on-photo);
  font-size: 0.98rem;
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.wiki-body :deep(h2),
.wiki-body :deep(h3),
.wiki-body :deep(h4) {
  font-family: var(--font-display);
  margin: 1.4rem 0 0.55rem;
  line-height: 1.25;
}

.wiki-body :deep(p),
.wiki-body :deep(li) {
  color: var(--ink-soft-on-photo);
}

.wiki-body :deep(a) {
  color: #0d5c54;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.wiki-body :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 12px;
}

.wiki-body :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
}

.wiki-body :deep(.mw-editsection),
.wiki-body :deep(.noprint),
.wiki-body :deep(.navbox) {
  display: none;
}
</style>
