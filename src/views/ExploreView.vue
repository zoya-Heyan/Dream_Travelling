<script setup lang="ts">
defineOptions({ name: 'ExploreView' })

import { computed, nextTick, onActivated, onDeactivated, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '@/components/EmptyState.vue'
import GuideCard from '@/components/GuideCard.vue'
import HeroGlassBackdrop from '@/components/HeroGlassBackdrop.vue'
import { useGuidesStore } from '@/stores/guides'
import type { GuideChannel } from '@/types/guide'
import { GUIDE_CHANNEL_LABELS } from '@/types/guide'

const store = useGuidesStore()
const route = useRoute()
const router = useRouter()
const draftQuery = ref('')

const channels: GuideChannel[] = ['all', 'guide', 'note', 'news', 'deal']

const activeChannel = computed(() => store.channel)
const errorSummary = computed(() => {
  if (!store.errors.length) return ''
  const names = store.errors.slice(0, 3).map((e) => store.sourceLabel(e.sourceId))
  const more = store.errors.length > 3 ? ` 等 ${store.errors.length} 个` : ''
  const prefix = store.items.length
    ? `已加载 ${store.items.length} 条；部分渠道暂不可用：`
    : '部分渠道暂不可用：'
  return `${prefix}${names.join('、')}${more}`
})

function parseRouteState(): { q: string; channel: GuideChannel } {
  const q = typeof route.query.q === 'string' ? route.query.q : ''
  const channel =
    typeof route.query.channel === 'string' && channels.includes(route.query.channel as GuideChannel)
      ? (route.query.channel as GuideChannel)
      : 'all'
  return { q, channel }
}

function browseQuery(q: string, channel: GuideChannel): Record<string, string> {
  return {
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(channel !== 'all' ? { channel } : {}),
  }
}

async function refresh(force = true): Promise<void> {
  const q = draftQuery.value
  const channel = store.channel
  if (!force && store.matchesBrowseState(q, channel) && store.items.length > 0) {
    return
  }
  await store.loadGuides({ query: q, channel })
}

async function ensureLoaded(force = false): Promise<void> {
  const { q, channel } = parseRouteState()
  draftQuery.value = q
  store.channel = channel
  await refresh(force)
}

function restoreScroll(): void {
  const y = store.listScrollY
  void nextTick(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: y, left: 0, behavior: 'auto' })
    })
  })
}

function setChannel(channel: GuideChannel): void {
  store.channel = channel
  void router.replace({ query: browseQuery(draftQuery.value, channel) })
  void refresh(true)
}

function onSearch(): void {
  void router.replace({ query: browseQuery(draftQuery.value, store.channel) })
  void refresh(true)
}

onActivated(() => {
  void ensureLoaded(false).then(() => restoreScroll())
})

onDeactivated(() => {
  store.saveListScroll(window.scrollY || window.pageYOffset || 0)
})

watch(
  () => [route.query.q, route.query.channel] as const,
  ([q, channel]) => {
    const nextQ = typeof q === 'string' ? q : ''
    const nextChannel =
      typeof channel === 'string' && channels.includes(channel as GuideChannel)
        ? (channel as GuideChannel)
        : 'all'
    if (nextQ === draftQuery.value && nextChannel === store.channel) return
    draftQuery.value = nextQ
    store.channel = nextChannel
    void refresh(true)
  },
)
</script>

<template>
  <main class="page explore photo-shell">
    <HeroGlassBackdrop />
    <div class="page-content">
      <header class="topbar">
        <div>
          <RouterLink class="back" to="/">← 回到首页</RouterLink>
          <p class="eyebrow">Explore</p>
          <h1>资讯与攻略</h1>
          <p class="lead">聚合 Wikivoyage、Tabiji、走进日本、国家地理等渠道，按目的地浏览旅行内容。</p>
        </div>
      </header>

      <form class="search-row" @submit.prevent="onSearch">
        <input
          v-model="draftQuery"
          class="glass-panel"
          type="search"
          placeholder="搜索目的地，例如：京都、成都、东京"
          enterkeyhint="search"
        />
        <button type="submit" class="btn btn-primary" :disabled="store.loading">
          {{ store.loading ? '加载中…' : '搜索' }}
        </button>
      </form>

      <div class="channels" role="tablist" aria-label="内容频道">
        <button
          v-for="channel in channels"
          :key="channel"
          type="button"
          class="channel"
          :class="{ active: activeChannel === channel }"
          role="tab"
          :aria-selected="activeChannel === channel"
          @click="setChannel(channel)"
        >
          {{ GUIDE_CHANNEL_LABELS[channel] }}
        </button>
      </div>

      <p v-if="errorSummary" class="warn glass-panel">{{ errorSummary }}</p>

      <div v-if="store.loading && !store.items.length" class="state">正在聚合各渠道内容…</div>

      <EmptyState
        v-else-if="!store.loading && !store.items.length"
        class="glass-panel"
        title="暂时没有内容"
        description="换个目的地试试，或切换频道。部分 RSS 渠道可能因网络/代理暂时失败。"
      >
        <button type="button" class="btn btn-primary" @click="() => refresh(true)">重新加载</button>
      </EmptyState>

      <div v-else class="grid">
        <GuideCard v-for="item in store.items" :key="item.id" :item="item" />
      </div>

      <section class="sources glass-panel">
        <h2>已接入渠道</h2>
        <ul>
          <li v-for="source in store.sources" :key="source.id">
            <strong>{{ source.name }}</strong>
            <span>{{ source.description }}</span>
          </li>
        </ul>
      </section>
    </div>
  </main>
</template>

<style scoped>
.explore.photo-shell {
  --glass-bg: rgba(255, 255, 255, 0.62);
  --glass-bg-hover: rgba(255, 255, 255, 0.78);
  --glass-border: rgba(16, 42, 51, 0.14);
  --glass-text: var(--ink);
  --glass-text-soft: var(--ink-soft);
  --ink-on-photo: var(--ink);
  --ink-soft-on-photo: var(--ink-soft);
  --glass-filter: saturate(180%) blur(18px);
}

.explore {
  position: relative;
  z-index: 0;
  padding-bottom: 4rem;
}

.page-content {
  position: relative;
  z-index: 1;
}

.topbar {
  margin-bottom: 1.1rem;
}

.back {
  color: var(--ink);
  font-weight: 700;
  font-size: 0.92rem;
}

.eyebrow {
  margin: 0.55rem 0 0;
  color: #0d5c54;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 0.78rem;
}

h1 {
  margin: 0.25rem 0 0;
  font-family: var(--font-display);
  font-size: clamp(1.8rem, 4vw, 2.5rem);
  line-height: 1.15;
  color: var(--ink);
}

.lead {
  margin: 0.5rem 0 0;
  max-width: 42rem;
  color: var(--ink-soft);
  font-size: 1rem;
  line-height: 1.55;
}

.search-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.65rem;
  margin: 1.1rem 0 0.9rem;
}

.search-row input {
  border: none;
  padding: 0.9rem 1rem;
  color: var(--ink);
  font-size: 1rem;
}

.search-row input::placeholder {
  color: var(--ink-soft);
}

.channels {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 1rem;
}

.channel {
  border: 1px solid rgba(16, 42, 51, 0.14);
  background: rgba(255, 255, 255, 0.72);
  color: var(--ink-soft);
  border-radius: 999px;
  padding: 0.45rem 0.9rem;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
}

.channel.active {
  background: var(--deep);
  color: #f7fffe;
  border-color: transparent;
}

.warn {
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  color: var(--ink);
  font-size: 0.92rem;
  line-height: 1.45;
}

.state {
  padding: 2.5rem 0;
  text-align: center;
  color: var(--ink-soft);
  font-size: 1rem;
}

.grid {
  display: grid;
  gap: 0.85rem;
}

.sources {
  margin-top: 1.5rem;
  padding: 1.1rem 1.15rem;
}

.sources h2 {
  margin: 0 0 0.75rem;
  font-family: var(--font-display);
  font-size: 1.2rem;
  color: var(--ink);
}

.sources ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.55rem;
}

.sources li {
  display: grid;
  gap: 0.15rem;
}

.sources strong {
  color: var(--ink);
  font-size: 0.95rem;
}

.sources span {
  color: var(--ink-soft);
  font-size: 0.88rem;
  line-height: 1.45;
}

.explore :deep(.empty) {
  background: transparent;
  border-color: rgba(16, 42, 51, 0.18);
}

.explore :deep(.empty h3) {
  color: var(--ink);
}

.explore :deep(.empty p) {
  color: var(--ink-soft);
  max-width: 36ch;
  font-size: 0.95rem;
}

.explore :deep(.empty-mark) {
  color: #0d5c54;
}

@media (max-width: 560px) {
  .search-row {
    grid-template-columns: 1fr;
  }
}
</style>
