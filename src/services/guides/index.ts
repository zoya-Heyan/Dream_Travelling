import type { GuideChannel, GuideItem, GuideSourceMeta } from '@/types/guide'
import { fetchRssHubItems, fetchRssItems } from './rss'
import { fetchTabijiAlerts, fetchTabijiCountries, fetchTabijiScams, fetchTabijiSearch } from './tabiji'
import { searchDestinationGuides } from './wikivoyage'

export interface GuideFetchContext {
  query?: string
  channel?: GuideChannel
}

type SourceFetcher = (ctx: GuideFetchContext) => Promise<GuideItem[]>

interface RegisteredSource extends GuideSourceMeta {
  fetch: SourceFetcher
  /** Failures are omitted from the Explore warning banner when other content loads. */
  optional?: boolean
}

function googleNewsUrl(query: string): string {
  const params = new URLSearchParams({
    q: query,
    hl: 'zh-CN',
    gl: 'CN',
    ceid: 'CN:zh-Hans',
  })
  return `https://news.google.com/rss/search?${params.toString()}`
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
  {
    id: 'nippon',
    name: '走进日本',
    channel: 'news',
    description: '日本文化与旅行相关报道',
    fetch: async () =>
      fetchRssHubItems('/nippon/Culture', {
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
    description: '国家地理环境与旅行相关资讯',
    fetch: async () =>
      fetchRssHubItems('/natgeo/environment/article', {
        sourceId: 'natgeo',
        kind: 'news',
        limit: 8,
      }),
  },
  {
    id: '12306',
    name: '12306 动态',
    channel: 'deal',
    description: '铁路出行最新动态',
    fetch: async () =>
      fetchRssHubItems('/12306/zxdt', {
        sourceId: '12306',
        kind: 'news',
        limit: 8,
      }),
  },
  {
    id: 'thepaper-travel',
    name: '澎湃文旅',
    channel: 'news',
    description: '澎湃新闻文旅频道（RSSHub）',
    optional: true,
    fetch: async () =>
      fetchRssHubItems('/thepaper/channel/26916', {
        sourceId: 'thepaper-travel',
        kind: 'news',
        limit: 10,
      }),
  },
  {
    id: 'bbc-travel',
    name: 'BBC Travel',
    channel: 'news',
    description: 'BBC 旅行专题（RSSHub）',
    optional: true,
    fetch: async () =>
      fetchRssHubItems('/bbc/travel', {
        sourceId: 'bbc-travel',
        kind: 'news',
        limit: 8,
      }),
  },
  {
    id: 'google-news-travel',
    name: 'Google 旅游资讯',
    channel: 'news',
    description: '目的地相关旅游与攻略新闻（部分网络环境可能不可达）',
    optional: true,
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
    description: '航班、签证、景区等出行资讯（部分网络环境可能不可达）',
    optional: true,
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
    description: '马蜂窝热门游记（需可用 RSSHub 实例）',
    optional: true,
    fetch: async () =>
      fetchRssHubItems('/mafengwo/note/hot', {
        sourceId: 'mafengwo-hot',
        kind: 'note',
        limit: 12,
      }),
  },
  {
    id: 'mafengwo-latest',
    name: '马蜂窝最新游记',
    channel: 'note',
    description: '马蜂窝最新游记（需可用 RSSHub 实例）',
    optional: true,
    fetch: async () =>
      fetchRssHubItems('/mafengwo/note/latest', {
        sourceId: 'mafengwo-latest',
        kind: 'note',
        limit: 10,
      }),
  },
  {
    id: 'flyert',
    name: '飞客茶馆优惠',
    channel: 'deal',
    description: '航空里程与旅行优惠（需可用 RSSHub 实例）',
    optional: true,
    fetch: async () =>
      fetchRssHubItems('/flyert/preferential', {
        sourceId: 'flyert',
        kind: 'news',
        limit: 10,
      }),
  },
  {
    id: 'imuseum',
    name: 'iMuseum 展览',
    channel: 'news',
    description: '上海/北京近期展览（需可用 RSSHub 实例）',
    optional: true,
    fetch: async ({ query }) => {
      const city = query?.includes('北京') ? 'beijing' : 'shanghai'
      return fetchRssHubItems(`/imuseum/${city}/latest`, {
        sourceId: 'imuseum',
        kind: 'news',
        destination: city === 'beijing' ? '北京' : '上海',
        limit: 8,
      })
    },
  },
  {
    id: 'lonely-planet',
    name: 'Lonely Planet',
    channel: 'news',
    description: 'Lonely Planet 旅行资讯 RSS',
    optional: true,
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
    optional: true,
    fetch: async () =>
      fetchRssItems('https://www.travelandleisure.com/feeds/all', {
        sourceId: 'travel-leisure',
        kind: 'news',
        limit: 8,
      }),
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
      // Soft-fail optional sources when we already have content from others.
      if (source.optional) continue
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason)
      errors.push({ sourceId: source.id, message })
    }
  }

  // If everything core failed but optionals also failed, surface a few optional errors
  // so the empty state is not mysterious.
  if (!items.length && !errors.length) {
    for (let i = 0; i < settled.length; i++) {
      const result = settled[i]
      const source = selected[i]
      if (result.status === 'rejected' && source.optional) {
        const message = result.reason instanceof Error ? result.reason.message : String(result.reason)
        errors.push({ sourceId: source.id, message })
        if (errors.length >= 3) break
      }
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
    ['wikivoyage', 'tabiji', 'nippon', 'thepaper-travel'].includes(s.id),
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
