export type GuideKind = 'guide' | 'news' | 'note' | 'alert'

export type GuideChannel = 'all' | 'guide' | 'note' | 'news' | 'deal'

export interface GuideItem {
  id: string
  sourceId: string
  title: string
  summary: string
  url: string
  publishedAt?: string
  imageUrl?: string
  destination?: string
  kind: GuideKind
  canReadInApp: boolean
  /** Extra payload for in-app readers (e.g. Wikivoyage page title) */
  meta?: Record<string, string>
}

export interface GuideDetail {
  item: GuideItem
  html: string
  attribution: string
}

export interface GuideSourceMeta {
  id: string
  name: string
  channel: GuideChannel
  description: string
}

export const GUIDE_KIND_LABELS: Record<GuideKind, string> = {
  guide: '目的地攻略',
  news: '资讯',
  note: '游记',
  alert: '出行提示',
}

export const GUIDE_CHANNEL_LABELS: Record<GuideChannel, string> = {
  all: '全部',
  guide: '目的地攻略',
  note: '游记',
  news: '资讯',
  deal: '优惠出行',
}
