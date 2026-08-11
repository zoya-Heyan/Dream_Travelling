import type { GuideDetail, GuideItem } from '@/types/guide'
import { fetchJson } from './fetch'

type WikiLang = 'zh' | 'en'

const API: Record<WikiLang, string> = {
  zh: 'https://zh.wikivoyage.org/w/api.php',
  en: 'https://en.wikivoyage.org/w/api.php',
}

const SITE: Record<WikiLang, string> = {
  zh: 'https://zh.wikivoyage.org/wiki/',
  en: 'https://en.wikivoyage.org/wiki/',
}

const SOURCE_ID: Record<WikiLang, string> = {
  zh: 'wikivoyage-zh',
  en: 'wikivoyage-en',
}

interface SearchResponse {
  query?: {
    search?: Array<{
      pageid: number
      title: string
      snippet: string
    }>
  }
}

interface ParseResponse {
  parse?: {
    title: string
    text?: { '*': string }
  }
}

interface WikipediaSummaryResponse {
  title?: string
  extract?: string
  content_urls?: { desktop?: { page?: string } }
  thumbnail?: { source?: string }
}

function stripTags(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** Remove scripts/styles and inline event handlers from MediaWiki HTML. */
export function sanitizeWikiHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach((el) => el.remove())
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      if (attr.name.startsWith('on') || attr.name === 'srcdoc') {
        el.removeAttribute(attr.name)
      }
      if ((attr.name === 'href' || attr.name === 'src') && /^\s*javascript:/i.test(attr.value)) {
        el.removeAttribute(attr.name)
      }
    }
  })
  // Rewrite relative wiki links to absolute
  doc.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href')
    if (!href) return
    if (href.startsWith('/wiki/') || href.startsWith('/w/')) {
      a.setAttribute('target', '_blank')
      a.setAttribute('rel', 'noopener noreferrer')
    }
  })
  return doc.body.innerHTML
}

function absoluteWikiLinks(html: string, lang: WikiLang): string {
  const base = lang === 'zh' ? 'https://zh.wikivoyage.org' : 'https://en.wikivoyage.org'
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href')
    if (!href) return
    if (href.startsWith('/')) {
      a.setAttribute('href', `${base}${href}`)
    }
  })
  doc.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src')
    if (src?.startsWith('//')) img.setAttribute('src', `https:${src}`)
    else if (src?.startsWith('/')) img.setAttribute('src', `${base}${src}`)
  })
  return doc.body.innerHTML
}

export async function searchWikivoyage(
  query: string,
  lang: WikiLang = 'zh',
  limit = 8,
): Promise<GuideItem[]> {
  const q = query.trim()
  if (!q) return []

  const url = new URL(API[lang])
  url.searchParams.set('action', 'query')
  url.searchParams.set('list', 'search')
  url.searchParams.set('srsearch', q)
  url.searchParams.set('srlimit', String(limit))
  url.searchParams.set('format', 'json')
  url.searchParams.set('origin', '*')

  const data = await fetchJson<SearchResponse>(url.toString())
  const results = data.query?.search ?? []

  return results.map((row) => ({
    id: `${SOURCE_ID[lang]}:${row.pageid}`,
    sourceId: SOURCE_ID[lang],
    title: row.title,
    summary: stripTags(row.snippet).slice(0, 220),
    url: `${SITE[lang]}${encodeURIComponent(row.title.replace(/ /g, '_'))}`,
    destination: q,
    kind: 'guide' as const,
    canReadInApp: true,
    meta: { lang, pageTitle: row.title },
  }))
}

export async function fetchWikivoyageDetail(
  pageTitle: string,
  lang: WikiLang = 'zh',
): Promise<GuideDetail> {
  const url = new URL(API[lang])
  url.searchParams.set('action', 'parse')
  url.searchParams.set('page', pageTitle)
  url.searchParams.set('prop', 'text|displaytitle')
  url.searchParams.set('disableeditsection', '1')
  url.searchParams.set('format', 'json')
  url.searchParams.set('origin', '*')

  const data = await fetchJson<ParseResponse>(url.toString())
  const title = data.parse?.title ?? pageTitle
  const raw = data.parse?.text?.['*'] ?? '<p>未找到攻略内容。</p>'
  const html = absoluteWikiLinks(sanitizeWikiHtml(raw), lang)
  const pageUrl = `${SITE[lang]}${encodeURIComponent(title.replace(/ /g, '_'))}`

  return {
    item: {
      id: `${SOURCE_ID[lang]}:${encodeURIComponent(title)}`,
      sourceId: SOURCE_ID[lang],
      title,
      summary: stripTags(html).slice(0, 220),
      url: pageUrl,
      kind: 'guide',
      canReadInApp: true,
      meta: { lang, pageTitle: title },
    },
    html,
    attribution:
      lang === 'zh'
        ? '内容来自中文 Wikivoyage，采用 CC BY-SA 4.0 许可。'
        : 'Content from English Wikivoyage, licensed under CC BY-SA 4.0.',
  }
}

export async function fetchWikipediaSummary(query: string): Promise<GuideItem | null> {
  const q = query.trim()
  if (!q) return null

  const url = `https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`
  try {
    const data = await fetchJson<WikipediaSummaryResponse>(url, {
      cacheKey: `wiki-summary:${q}`,
    })
    if (!data.title || !data.extract) return null
    return {
      id: `wikipedia-zh:${encodeURIComponent(data.title)}`,
      sourceId: 'wikipedia-zh',
      title: data.title,
      summary: data.extract.slice(0, 220),
      url: data.content_urls?.desktop?.page ?? `https://zh.wikipedia.org/wiki/${encodeURIComponent(data.title)}`,
      imageUrl: data.thumbnail?.source,
      destination: q,
      kind: 'guide',
      canReadInApp: false,
    }
  } catch {
    return null
  }
}

export async function searchDestinationGuides(query: string): Promise<GuideItem[]> {
  const q = query.trim() || '旅行'
  const [zh, en, wiki] = await Promise.all([
    searchWikivoyage(q, 'zh', 6).catch(() => [] as GuideItem[]),
    searchWikivoyage(q, 'en', 4).catch(() => [] as GuideItem[]),
    fetchWikipediaSummary(q).catch(() => null),
  ])
  const items = [...zh, ...en]
  if (wiki) items.push(wiki)
  return items
}
