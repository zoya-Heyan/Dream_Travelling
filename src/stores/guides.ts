import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchGuidesFromSources,
  fetchRelatedGuides,
  getSourceName,
  listGuideSources,
} from '@/services/guides'
import { fetchWikivoyageDetail } from '@/services/guides/wikivoyage'
import type { GuideChannel, GuideDetail, GuideItem, GuideSourceMeta } from '@/types/guide'

export const useGuidesStore = defineStore('guides', () => {
  const items = ref<GuideItem[]>([])
  const related = ref<GuideItem[]>([])
  const sources = ref<GuideSourceMeta[]>(listGuideSources())
  const loading = ref(false)
  const relatedLoading = ref(false)
  const errors = ref<Array<{ sourceId: string; message: string }>>([])
  const query = ref('')
  const channel = ref<GuideChannel>('all')
  const detail = ref<GuideDetail | null>(null)
  const detailLoading = ref(false)
  const detailError = ref('')
  const listScrollY = ref(0)
  const hasLoadedList = ref(false)

  function saveListScroll(y: number): void {
    listScrollY.value = y
  }

  function matchesBrowseState(nextQuery: string, nextChannel: GuideChannel): boolean {
    return hasLoadedList.value && query.value === nextQuery && channel.value === nextChannel
  }

  async function loadGuides(options?: { query?: string; channel?: GuideChannel }): Promise<void> {
    if (options?.query !== undefined) query.value = options.query
    if (options?.channel !== undefined) channel.value = options.channel

    loading.value = true
    errors.value = []
    try {
      const result = await fetchGuidesFromSources({
        query: query.value,
        channel: channel.value,
      })
      items.value = result.items
      errors.value = result.errors
      hasLoadedList.value = true
    } finally {
      loading.value = false
    }
  }

  async function loadRelated(destination: string): Promise<void> {
    relatedLoading.value = true
    try {
      related.value = await fetchRelatedGuides(destination)
    } catch {
      related.value = []
    } finally {
      relatedLoading.value = false
    }
  }

  function clearRelated(): void {
    related.value = []
  }

  async function loadDetail(sourceId: string, pageKey: string): Promise<GuideDetail | null> {
    detailLoading.value = true
    detailError.value = ''
    detail.value = null
    try {
      const lang = sourceId.includes('en') ? 'en' : 'zh'
      const pageTitle = decodeURIComponent(pageKey)
      const data = await fetchWikivoyageDetail(pageTitle, lang)
      detail.value = data
      return data
    } catch (error) {
      detailError.value = error instanceof Error ? error.message : '加载攻略失败'
      return null
    } finally {
      detailLoading.value = false
    }
  }

  function sourceLabel(sourceId: string): string {
    return getSourceName(sourceId)
  }

  return {
    items,
    related,
    sources,
    loading,
    relatedLoading,
    errors,
    query,
    channel,
    detail,
    detailLoading,
    detailError,
    listScrollY,
    hasLoadedList,
    saveListScroll,
    matchesBrowseState,
    loadGuides,
    loadRelated,
    clearRelated,
    loadDetail,
    sourceLabel,
  }
})
