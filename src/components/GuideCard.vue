<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGuidesStore } from '@/stores/guides'
import type { GuideItem } from '@/types/guide'
import { GUIDE_KIND_LABELS } from '@/types/guide'

const props = defineProps<{
  item: GuideItem
}>()

const router = useRouter()
const store = useGuidesStore()

const sourceName = computed(() => store.sourceLabel(props.item.sourceId))
const kindLabel = computed(() => GUIDE_KIND_LABELS[props.item.kind])

function onOpen(): void {
  if (props.item.canReadInApp && props.item.meta?.pageTitle) {
    const source = props.item.sourceId
    const id = props.item.meta.pageTitle
    void router.push({
      name: 'guide-detail',
      params: { source, id },
      query: {
        ...(store.query.trim() ? { q: store.query.trim() } : {}),
        ...(store.channel !== 'all' ? { channel: store.channel } : {}),
      },
    })
    return
  }
  if (props.item.url && props.item.url !== '#') {
    window.open(props.item.url, '_blank', 'noopener,noreferrer')
  }
}
</script>

<template>
  <article class="guide-card glass-panel" @click="onOpen">
    <div class="guide-card-body">
      <div class="badges">
        <span class="badge kind">{{ kindLabel }}</span>
        <span class="badge source">{{ sourceName }}</span>
      </div>
      <h3>{{ item.title }}</h3>
      <p v-if="item.summary" class="summary">{{ item.summary }}</p>
      <div class="meta">
        <span v-if="item.destination">{{ item.destination }}</span>
        <span v-if="item.publishedAt">{{ item.publishedAt }}</span>
        <span class="action">{{ item.canReadInApp ? '阅读攻略' : '打开原文' }} →</span>
      </div>
    </div>
    <div
      v-if="item.imageUrl"
      class="thumb"
      :style="{ backgroundImage: `url(${item.imageUrl})` }"
      aria-hidden="true"
    />
  </article>
</template>

<style scoped>
.guide-card {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1rem;
  padding: 1.1rem 1.15rem;
  cursor: pointer;
  transition: transform 180ms var(--ease), background 180ms var(--ease);
}

.guide-card:hover {
  transform: translateY(-2px);
  background: var(--glass-bg-hover);
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.55rem;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.badge.kind {
  background: rgba(26, 155, 142, 0.16);
  color: #0d5c54;
}

.badge.source {
  background: rgba(16, 42, 51, 0.08);
  color: var(--ink-soft);
}

h3 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.2rem;
  line-height: 1.35;
  color: var(--ink-on-photo);
}

.summary {
  margin: 0.5rem 0 0;
  color: var(--ink-soft-on-photo);
  font-size: 0.98rem;
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.meta {
  margin-top: 0.75rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
  font-size: 0.84rem;
  color: var(--ink-soft-on-photo);
  font-weight: 600;
}

.action {
  margin-left: auto;
  color: #0d5c54;
}

.thumb {
  width: 88px;
  height: 88px;
  border-radius: 14px;
  background-size: cover;
  background-position: center;
  background-color: rgba(16, 42, 51, 0.08);
}

@media (max-width: 560px) {
  .guide-card {
    grid-template-columns: 1fr;
  }

  .thumb {
    width: 100%;
    height: 140px;
    order: -1;
  }
}
</style>
