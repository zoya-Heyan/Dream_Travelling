import type { GuideItem } from '@/types/guide'
import { fetchJson } from './fetch'

interface TabijiAlertListItem {
  id?: string
  iso2?: string
  name?: string
  combinedLevel?: string
  url?: string
}

interface TabijiAlertListResponse {
  alerts?: TabijiAlertListItem[]
}

interface TabijiAlertDetail {
  id?: string
  iso2?: string
  name?: string
  lastUpdated?: string
  combinedLevel?: string
  combinedSummary?: string
  us?: { levelText?: string; summary?: string; url?: string }
  uk?: { url?: string }
}

interface TabijiCountry {
  id?: string
  name?: string
  officialName?: string
  iso2?: string
  capital?: string[]
  region?: string
  subregion?: string
  currencies?: Record<string, { name?: string; symbol?: string }> | Array<{ name?: string; symbol?: string; code?: string }>
  languages?: Record<string, string> | string[]
}

interface TabijiCountriesResponse {
  countries?: TabijiCountry[]
}

interface TabijiSearchItem {
  id?: string
  type?: string
  slug?: string
  title?: string
  subtitle?: string
  url?: string
  siteUrl?: string
  tags?: string[]
}

interface TabijiSearchResponse {
  items?: TabijiSearchItem[]
}

interface TabijiScamCatalog {
  items?: Array<{
    id?: string
    slug?: string
    name?: string
    country?: string
    url?: string
    siteUrl?: string
    scamCount?: number
  }>
}

function pickText(...values: Array<string | undefined | null>): string {
  for (const v of values) {
    if (v && String(v).trim()) return String(v).trim()
  }
  return ''
}

function formatCurrencies(currencies: TabijiCountry['currencies']): string {
  if (!currencies) return ''
  if (Array.isArray(currencies)) {
    return currencies.map((c) => [c.name, c.symbol].filter(Boolean).join(' ')).join('、')
  }
  return Object.values(currencies)
    .map((c) => [c.name, c.symbol].filter(Boolean).join(' '))
    .join('、')
}

function formatLanguages(languages: TabijiCountry['languages']): string {
  if (!languages) return ''
  if (Array.isArray(languages)) return languages.join('、')
  return Object.values(languages).join('、')
}

export async function fetchTabijiAlerts(limit = 12): Promise<GuideItem[]> {
  try {
    const list = await fetchJson<TabijiAlertListResponse>('https://tabiji.ai/api/v1/alerts.json', {
      cacheKey: 'tabiji:alerts-list',
    })
    const rows = (list.alerts ?? [])
      .filter((row) => row.combinedLevel && row.combinedLevel !== 'low')
      .slice(0, Math.max(limit, 8))

    const prioritized = rows.length
      ? rows
      : (list.alerts ?? []).slice(0, 8)

    const details = await Promise.all(
      prioritized.slice(0, limit).map(async (row): Promise<GuideItem | null> => {
        const iso = (row.iso2 ?? '').toLowerCase()
        if (!iso) return null
        try {
          const detail = await fetchJson<TabijiAlertDetail>(
            `https://tabiji.ai/api/v1/alerts/${iso}.json`,
            { cacheKey: `tabiji:alert:${iso}` },
          )
          const title = pickText(detail.name, row.name, iso.toUpperCase())
          const summary = pickText(
            detail.combinedSummary,
            detail.us?.summary,
            detail.us?.levelText,
            `出行安全等级：${detail.combinedLevel ?? row.combinedLevel ?? '未知'}`,
          )
          return {
            id: `tabiji:${detail.id ?? row.id ?? iso}`,
            sourceId: 'tabiji',
            title: `${title} · 出行提示`,
            summary: summary.replace(/\s+/g, ' ').slice(0, 220),
            url: pickText(detail.us?.url, detail.uk?.url, row.url, `https://tabiji.ai/`),
            publishedAt: detail.lastUpdated,
            destination: title,
            kind: 'alert',
            canReadInApp: false,
            meta: { level: detail.combinedLevel ?? row.combinedLevel ?? '' },
          }
        } catch {
          return {
            id: `tabiji:${row.id ?? iso}`,
            sourceId: 'tabiji',
            title: `${pickText(row.name, iso.toUpperCase())} · 出行提示`,
            summary: `安全等级：${row.combinedLevel ?? '未知'}`,
            url: pickText(row.url, 'https://tabiji.ai/'),
            destination: row.name,
            kind: 'alert',
            canReadInApp: false,
          }
        }
      }),
    )

    return details.filter((item): item is GuideItem => item !== null)
  } catch {
    return []
  }
}

export async function fetchTabijiSearch(query: string, limit = 8): Promise<GuideItem[]> {
  const q = query.trim()
  if (!q) return []
  try {
    const url = `https://tabiji.ai/api/v1/search.json?q=${encodeURIComponent(q)}`
    const data = await fetchJson<TabijiSearchResponse>(url, { cacheKey: `tabiji:search:${q}` })
    return (data.items ?? []).slice(0, limit).map((item, index) => {
      const title = pickText(item.title, item.subtitle, item.slug, `Tabiji ${index + 1}`)
      const kind = item.type === 'alert' || item.type === 'scam' || item.type === 'safety'
        ? ('alert' as const)
        : ('guide' as const)
      return {
        id: `tabiji-search:${item.id ?? item.slug ?? title}`,
        sourceId: 'tabiji',
        title,
        summary: pickText(item.subtitle, item.tags?.join(' · '), 'Tabiji 旅行资料'),
        url: pickText(item.siteUrl, item.url, 'https://tabiji.ai/'),
        destination: q,
        kind,
        canReadInApp: false,
        meta: { type: item.type ?? '' },
      }
    })
  } catch {
    return []
  }
}

export async function fetchTabijiScams(limit = 8): Promise<GuideItem[]> {
  try {
    const data = await fetchJson<TabijiScamCatalog>('https://tabiji.ai/api/v1/catalog/scams.json', {
      cacheKey: 'tabiji:scams',
    })
    return (data.items ?? [])
      .filter((row) => (row.scamCount ?? 0) > 0 || Boolean(row.country))
      .slice(0, limit)
      .map((row) => ({
        id: `tabiji-scam:${row.id ?? row.slug}`,
        sourceId: 'tabiji',
        title: pickText(row.name, row.slug, '防骗指南'),
        summary: row.country
          ? `${row.country} · 常见旅行骗局提示`
          : 'Tabiji 旅行防骗指南',
        url: pickText(row.siteUrl, row.url, 'https://tabiji.ai/'),
        destination: row.country || undefined,
        kind: 'alert' as const,
        canReadInApp: false,
      }))
  } catch {
    return []
  }
}

export async function fetchTabijiCountries(query: string): Promise<GuideItem[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []

  try {
    const data = await fetchJson<TabijiCountriesResponse>('https://tabiji.ai/api/v1/countries.json', {
      cacheKey: 'tabiji:countries',
    })
    return (data.countries ?? [])
      .filter((row) => {
        const name = pickText(row.name, row.officialName, row.iso2).toLowerCase()
        return name.includes(q) || q.includes(name)
      })
      .slice(0, 3)
      .map((row) => {
        const name = pickText(row.name, row.officialName, row.iso2 ?? 'Country')
        const capital = row.capital?.[0]
        const currency = formatCurrencies(row.currencies)
        const languages = formatLanguages(row.languages)
        const summary = [
          row.region,
          row.subregion,
          capital ? `首都 ${capital}` : '',
          currency ? `货币 ${currency}` : '',
          languages ? `语言 ${languages}` : '',
        ]
          .filter(Boolean)
          .join(' · ')

        return {
          id: `tabiji-country:${row.iso2 ?? name}`,
          sourceId: 'tabiji',
          title: `${name} · 旅行概览`,
          summary: summary || 'Tabiji 国家旅行资料',
          url: `https://tabiji.ai/countries/${(row.iso2 ?? '').toLowerCase()}/`,
          destination: name,
          kind: 'guide' as const,
          canReadInApp: false,
        }
      })
  } catch {
    return []
  }
}
