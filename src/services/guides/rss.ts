import type { GuideItem, GuideKind } from '@/types/guide'
import { fetchText } from './fetch'

function textContent(node: Element | null): string {
  if (!node) return ''
  return (node.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function firstChild(parent: Element, names: string[]): Element | null {
  for (const name of names) {
    const found = parent.getElementsByTagName(name)[0]
    if (found) return found
  }
  return null
}

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function pickImage(item: Element): string | undefined {
  const media = item.getElementsByTagName('media:content')[0]
    ?? item.getElementsByTagName('content')[0]
  const mediaUrl = media?.getAttribute('url')
  if (mediaUrl) return mediaUrl

  const enclosure = item.getElementsByTagName('enclosure')[0]
  const type = enclosure?.getAttribute('type') ?? ''
  const href = enclosure?.getAttribute('url')
  if (href && type.startsWith('image/')) return href

  const description = textContent(firstChild(item, ['description', 'summary', 'content:encoded']))
  const match = description.match(/<img[^>]+src=["']([^"']+)["']/i)
  return match?.[1]
}

export interface ParseRssOptions {
  sourceId: string
  kind: GuideKind
  canReadInApp?: boolean
  destination?: string
  limit?: number
}

export function parseRssXml(xml: string, options: ParseRssOptions): GuideItem[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) {
    throw new Error('RSS 解析失败')
  }

  const nodes = [
    ...Array.from(doc.getElementsByTagName('item')),
    ...Array.from(doc.getElementsByTagName('entry')),
  ]
  const limit = options.limit ?? 20
  const items: GuideItem[] = []

  for (const node of nodes.slice(0, limit)) {
    const title = textContent(firstChild(node, ['title']))
    if (!title) continue

    const linkEl = firstChild(node, ['link'])
    const link =
      linkEl?.getAttribute('href')
      || textContent(linkEl)
      || textContent(firstChild(node, ['guid', 'id']))

    const rawSummary = textContent(
      firstChild(node, ['description', 'summary', 'content:encoded', 'content']),
    )
    const summary = stripHtml(rawSummary).slice(0, 220)
    const publishedAt =
      textContent(firstChild(node, ['pubDate', 'published', 'updated', 'dc:date'])) || undefined
    const idSeed = link || `${options.sourceId}:${title}:${publishedAt ?? ''}`

    items.push({
      id: `${options.sourceId}:${hashId(idSeed)}`,
      sourceId: options.sourceId,
      title,
      summary,
      url: link || '#',
      publishedAt,
      imageUrl: pickImage(node),
      destination: options.destination,
      kind: options.kind,
      canReadInApp: options.canReadInApp ?? false,
    })
  }

  return items
}

function hashId(input: string): string {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36)
}

export async function fetchRssItems(url: string, options: ParseRssOptions): Promise<GuideItem[]> {
  const xml = await fetchText(url, { useProxy: true, cacheKey: `rss:${url}` })
  return parseRssXml(xml, options)
}
