<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import HeroGlassBackdrop from '@/components/HeroGlassBackdrop.vue'
import { useGuidesStore } from '@/stores/guides'
import type { GuideChannel } from '@/types/guide'

const props = defineProps<{
  source: string
  id: string
}>()

const route = useRoute()
const router = useRouter()
const store = useGuidesStore()

const pageTitle = computed(() => decodeURIComponent(props.id))

const backQuery = computed(() => {
  const q = typeof route.query.q === 'string' ? route.query.q : store.query
  const channelRaw = typeof route.query.channel === 'string' ? route.query.channel : store.channel
  const channel = channelRaw as GuideChannel
  return {
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(channel && channel !== 'all' ? { channel } : {}),
  }
})

function goBack(): void {
  const back = window.history.state?.back
  if (back != null) {
    router.back()
    return
  }
  void router.push({ name: 'explore', query: backQuery.value })
}

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
        <button type="button" class="back" @click="goBack">← 返回上一页</button>
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
.detail.photo-shell {
  --glass-bg: rgba(255, 255, 255, 0.68);
  --glass-bg-hover: rgba(255, 255, 255, 0.82);
  --glass-border: rgba(16, 42, 51, 0.14);
  --glass-text: var(--ink);
  --glass-text-soft: var(--ink-soft);
  --ink-on-photo: var(--ink);
  --ink-soft-on-photo: var(--ink-soft);
  --glass-filter: saturate(180%) blur(18px);
}

.detail {
  position: relative;
  z-index: 0;
  padding-bottom: 4rem;
}

.page-content {
  position: relative;
  z-index: 1;
  width: 100%;
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
  color: var(--ink);
  font-weight: 700;
  font-size: 0.95rem;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: inherit;
}

.state {
  padding: 3rem 0;
  text-align: center;
  color: var(--ink-soft);
  display: grid;
  gap: 1rem;
  justify-items: center;
  font-size: 1rem;
}

.article {
  padding: 1.35rem 1.35rem 1.8rem;
}

.eyebrow {
  margin: 0;
  color: #0d5c54;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-size: 0.8rem;
}

h1 {
  margin: 0.35rem 0 0;
  font-family: var(--font-display);
  font-size: clamp(1.75rem, 4vw, 2.4rem);
  line-height: 1.2;
  color: var(--ink);
}

.attr {
  margin: 0.55rem 0 1.2rem;
  color: var(--ink-soft);
  font-size: 0.9rem;
  line-height: 1.45;
}

.wiki-body {
  color: var(--ink);
  font-size: 1.08rem;
  line-height: 1.75;
  overflow-wrap: anywhere;
}

.wiki-body :deep(h2),
.wiki-body :deep(h3),
.wiki-body :deep(h4) {
  font-family: var(--font-display);
  margin: 1.5rem 0 0.6rem;
  line-height: 1.3;
  color: var(--ink);
}

.wiki-body :deep(h2) {
  font-size: 1.35rem;
}

.wiki-body :deep(h3) {
  font-size: 1.18rem;
}

.wiki-body :deep(p),
.wiki-body :deep(li) {
  color: var(--ink);
  font-size: 1.08rem;
  line-height: 1.75;
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
