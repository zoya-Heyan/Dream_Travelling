import type { GuideChannel, GuideItem, GuideSourceMeta } from '@/types/guide'
import { rsshubUrl } from './fetch'
import { fetchRssItems } from './rss'
import { fetchTabijiAlerts, fetchTabijiCountries, fetchTabijiScams, fetchTabijiSearch } from './tabiji'
import { searchDestinationGuides } from './wikivoyage'

export interface GuideFetchContext {
  query?: string
  channel?: GuideChannel
}

type SourceFetcher = (ctx: GuideFetchContext) => Promise<GuideItem[]>

interface RegisteredSource extends GuideSourceMeta {
  fetch: SourceFetcher
}

/** Popular Mafengwo destination codes for 自由行 feeds */
const MAFENGWO_DESTINATIONS: Array<{ code: string; name: string }> = [
  { code: '10035', name: '北京' },
  { code: '10099', name: '上海' },
  { code: '10088', name: '广州' },
  { code: '10189', name: '深圳' },
  { code: '10186', name: '成都' },
  { code: '10195', name: '重庆' },
  { code: '10132', name: '杭州' },
  { code: '10466', name: '西安' },
  { code: '10207', name: '厦门' },
  { code: '10065', name: '南京' },
  { code: '10269', name: '大理' },
  { code: '10442', name: '丽江' },
  { code: '10793', name: '东京' },
  { code: '10794', name: '大阪' },
  { code: '11045', name: '曼谷' },
]

function googleNewsUrl(query: string): string {
  const params = new URLSearchParams({
    q: query,
    hl: 'zh-CN',
    gl: 'CN',
    ceid: 'CN:zh-Hans',
  })
  return `https://news.google.com/rss/search?${params.toString()}`
}

function matchDestinationCode(query: string | undefined): { code: string; name: string } | null {
  if (!query?.trim()) return null
  const q = query.trim()
  return MAFENGWO_DESTINATIONS.find((d) => q.includes(d.name) || d.name.includes(q)) ?? null
}

const SOURCES: RegisteredSource[] = [
  {
    id: 'wikivoyage',
    name: 'Wikivoyage / 维基百科',
    channel: 'guide',
    description: '中英文目的地攻略与百科摘要',
    fetch: async ({ query }) => searchDestinationGuides(query?.trim() || '中国'),
  },
  {
    id: 'google-news-travel',
    name: 'Google 旅游资讯',
    channel: 'news',
    description: '目的地相关旅游与攻略新闻',
    fetch: async ({ query }) => {
      const q = `${query?.trim() || '旅游'} 旅游 攻略`
      return fetchRssItems(googleNewsUrl(q), {
        sourceId: 'google-news-travel',
        kind: 'news',
        destination: query?.trim(),
        limit: 12,
      })
    },
  },
  {
    id: 'google-news-transit',
    name: 'Google 出行动态',
    channel: 'news',
    description: '航班、签证、景区等出行资讯',
    fetch: async ({ query }) => {
      const base = query?.trim() ? `${query.trim()} ` : ''
      const q = `${base}航班 OR 签证 OR 景区闭园 OR 出行提示`
      return fetchRssItems(googleNewsUrl(q), {
        sourceId: 'google-news-transit',
        kind: 'news',
        destination: query?.trim(),
        limit: 10,
      })
    },
  },
  {
    id: 'mafengwo-hot',
    name: '马蜂窝热门游记',
    channel: 'note',
    description: '马蜂窝热门游记（RSSHub）',
    fetch: async () =>
      fetchRssItems(rsshubUrl('/mafengwo/note/hot'), {
        sourceId: 'mafengwo-hot',
        kind: 'note',
        limit: 12,
      }),
  },
  {
    id: 'mafengwo-latest',
    name: '马蜂窝最新游记',
    channel: 'note',
    description: '马蜂窝最新游记（RSSHub）',
    fetch: async () =>
      fetchRssItems(rsshubUrl('/mafengwo/note/latest'), {
        sourceId: 'mafengwo-latest',
        kind: 'note',
        limit: 10,
      }),
  },
  {
    id: 'mafengwo-ziyouxing',
    name: '马蜂窝自由行',
    channel: 'note',
    description: '按热门目的地拉取自由行内容',
    fetch: async ({ query }) => {
      const matched = matchDestinationCode(query) ?? MAFENGWO_DESTINATIONS[0]
      return fetchRssItems(rsshubUrl(`/mafengwo/ziyouxing/${matched.code}`), {
        sourceId: 'mafengwo-ziyouxing',
        kind: 'note',
        destination: matched.name,
        limit: 10,
      })
    },
  },
  {
    id: 'flyert',
    name: '飞客茶馆优惠',
    channel: 'deal',
    description: '航空里程与旅行优惠信息',
    fetch: async () =>
      fetchRssItems(rsshubUrl('/flyert/preferential'), {
        sourceId: 'flyert',
        kind: 'news',
        limit: 10,
      }),
  },
  {
    id: 'nippon',
    name: '走进日本',
    channel: 'news',
    description: '日本文化与旅行相关报道',
    fetch: async () =>
      fetchRssItems(rsshubUrl('/nippon/Culture'), {
        sourceId: 'nippon',
        kind: 'news',
        destination: '日本',
        limit: 8,
      }),
  },
  {
    id: 'natgeo',
    name: '国家地理',
    channel: 'news',
    description: '国家地理中文资讯',
    fetch: async () =>
      fetchRssItems(rsshubUrl('/natgeo/environment/article'), {
        sourceId: 'natgeo',
        kind: 'news',
        limit: 8,
      }),
  },
  {
    id: 'imuseum',
    name: 'iMuseum 展览',
    channel: 'news',
    description: '上海/北京近期展览',
    fetch: async ({ query }) => {
      const city = query?.includes('北京') ? 'beijing' : 'shanghai'
      return fetchRssItems(rsshubUrl(`/imuseum/${city}/latest`), {
        sourceId: 'imuseum',
        kind: 'news',
        destination: city === 'beijing' ? '北京' : '上海',
        limit: 8,
      })
    },
  },
  {
    id: '12306',
    name: '12306 动态',
    channel: 'deal',
    description: '铁路出行最新动态',
    fetch: async () =>
      fetchRssItems(rsshubUrl('/12306/zxdt'), {
        sourceId: '12306',
        kind: 'news',
        limit: 8,
      }),
  },
  {
    id: 'airchina',
    name: '国航公告',
    channel: 'deal',
    description: '中国国际航空服务公告',
    fetch: async () =>
      fetchRssItems(rsshubUrl('/airchina/announcement'), {
        sourceId: 'airchina',
        kind: 'news',
        limit: 8,
      }),
  },
  {
    id: 'huodongxing',
    name: '活动行',
    channel: 'deal',
    description: '最新线下活动与旅行体验',
    fetch: async () =>
      fetchRssItems(rsshubUrl('/huodongxing/explore'), {
        sourceId: 'huodongxing',
        kind: 'news',
        limit: 8,
      }),
  },
  {
    id: 'lonely-planet',
    name: 'Lonely Planet',
    channel: 'news',
    description: 'Lonely Planet 旅行资讯 RSS',
    fetch: async () =>
      fetchRssItems('https://www.lonelyplanet.com/news/feed', {
        sourceId: 'lonely-planet',
        kind: 'news',
        limit: 8,
      }),
  },
  {
    id: 'travel-leisure',
    name: 'Travel + Leisure',
    channel: 'news',
    description: 'Travel + Leisure 公开 RSS',
    fetch: async () =>
      fetchRssItems('https://www.travelandleisure.com/feeds/all', {
        sourceId: 'travel-leisure',
        kind: 'news',
        limit: 8,
      }),
  },
  {
    id: 'tabiji',
    name: 'Tabiji 出行提示',
    channel: 'news',
    description: '安全提示、防骗指南、国家概览与检索结果',
    fetch: async ({ query }) => {
      const q = query?.trim()
      const [alerts, scams, countries, search] = await Promise.all([
        fetchTabijiAlerts(8),
        fetchTabijiScams(6),
        q ? fetchTabijiCountries(q) : Promise.resolve([] as GuideItem[]),
        q ? fetchTabijiSearch(q, 8) : Promise.resolve([] as GuideItem[]),
      ])
      return [...search, ...countries, ...alerts, ...scams]
    },
  },
]

export function listGuideSources(): GuideSourceMeta[] {
  return SOURCES.map(({ id, name, channel, description }) => ({
    id,
    name,
    channel,
    description,
  }))
}

export function getSourceName(sourceId: string): string {
  return SOURCES.find((s) => s.id === sourceId)?.name
    ?? ({
      'wikivoyage-zh': '中文 Wikivoyage',
      'wikivoyage-en': 'English Wikivoyage',
      'wikipedia-zh': '维基百科',
    } as Record<string, string>)[sourceId]
    ?? sourceId
}

function sourceMatchesChannel(source: RegisteredSource, channel: GuideChannel): boolean {
  if (channel === 'all') return true
  return source.channel === channel
}

export async function fetchGuidesFromSources(
  ctx: GuideFetchContext = {},
): Promise<{ items: GuideItem[]; errors: Array<{ sourceId: string; message: string }> }> {
  const channel = ctx.channel ?? 'all'
  const selected = SOURCES.filter((s) => sourceMatchesChannel(s, channel))

  const settled = await Promise.allSettled(
    selected.map(async (source) => ({
      sourceId: source.id,
      items: await source.fetch(ctx),
    })),
  )

  const items: GuideItem[] = []
  const errors: Array<{ sourceId: string; message: string }> = []
  const seen = new Set<string>()

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i]
    const source = selected[i]
    if (result.status === 'fulfilled') {
      for (const item of result.value.items) {
        if (seen.has(item.id)) continue
        seen.add(item.id)
        items.push(item)
      }
    } else {
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason)
      errors.push({ sourceId: source.id, message })
    }
  }

  items.sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0
    if (ta !== tb) return tb - ta
    return a.title.localeCompare(b.title, 'zh')
  })

  return { items, errors }
}

export async function fetchRelatedGuides(destination: string, limit = 8): Promise<GuideItem[]> {
  const q = destination.trim()
  if (!q) return []

  const relatedSources = SOURCES.filter((s) =>
    ['wikivoyage', 'google-news-travel', 'mafengwo-ziyouxing', 'tabiji'].includes(s.id),
  )

  const settled = await Promise.allSettled(relatedSources.map((s) => s.fetch({ query: q })))
  const items: GuideItem[] = []
  const seen = new Set<string>()

  for (const result of settled) {
    if (result.status !== 'fulfilled') continue
    for (const item of result.value) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      items.push(item)
    }
  }

  return items.slice(0, limit)
}
