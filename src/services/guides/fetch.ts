const CACHE_TTL_MS = 10 * 60 * 1000
const FETCH_TIMEOUT_MS = 10_000

const textCache = new Map<string, { expiresAt: number; text: string }>()
const jsonCache = new Map<string, { expiresAt: number; data: unknown }>()

/** Public mirrors tried when the official instance is unreachable. */
const DEFAULT_RSSHUB_MIRRORS = [
  'https://rsshub.rssforever.com',
  'https://hub.slarker.me',
  'https://rsshub.ktachibana.party',
  'https://rss.owo.nz',
  'https://rsshub.app',
]

const DEFAULT_CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.org/?',
]

function env(name: keyof ImportMetaEnv): string | undefined {
  const value = import.meta.env[name]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function normalizeBase(url: string): string {
  return url.replace(/\/$/, '')
}

export function rsshubBases(): string[] {
  const custom = env('VITE_RSSHUB_BASE')
  const fromList =
    env('VITE_RSSHUB_BASES')
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? []
  const bases = [
    ...(custom ? [custom] : []),
    ...fromList,
    ...DEFAULT_RSSHUB_MIRRORS,
  ].map(normalizeBase)
  return [...new Set(bases)]
}

/** First configured base — use `fetchRssHubText` for failover across mirrors. */
export function rsshubUrl(routePath: string): string {
  const base = rsshubBases()[0] ?? 'https://rsshub.rssforever.com'
  const path = routePath.startsWith('/') ? routePath : `/${routePath}`
  return `${base}${path}`
}

function looksLikeRssOrXml(text: string): boolean {
  const sample = text.slice(0, 800).toLowerCase()
  return (
    sample.includes('<?xml')
    || sample.includes('<rss')
    || sample.includes('<feed')
    || sample.includes('<channel')
  )
}

function looksLikeProxyError(text: string): boolean {
  const sample = text.slice(0, 400).toLowerCase()
  return (
    sample.includes('"error"')
    && (sample.includes('corsproxy') || sample.includes('not allowed') || sample.includes('upgrade'))
  )
}

function buildCorsProxyUrl(proxyPrefix: string, targetUrl: string): string {
  if (proxyPrefix.endsWith('=') || proxyPrefix.endsWith('?') || proxyPrefix.endsWith('&')) {
    return `${proxyPrefix}${encodeURIComponent(targetUrl)}`
  }
  if (proxyPrefix.includes('?')) {
    return `${proxyPrefix}${proxyPrefix.endsWith('&') ? '' : '&'}url=${encodeURIComponent(targetUrl)}`
  }
  return `${proxyPrefix}?url=${encodeURIComponent(targetUrl)}`
}

/** Build a browser-reachable URL (DEV same-origin proxy or CORS helpers). */
export function proxiedUrl(targetUrl: string): string {
  try {
    if (import.meta.env.DEV) {
      return `/proxy/url?target=${encodeURIComponent(targetUrl)}`
    }

    const corsProxy = env('VITE_CORS_PROXY')
    if (corsProxy) {
      return buildCorsProxyUrl(corsProxy, targetUrl)
    }

    return buildCorsProxyUrl(DEFAULT_CORS_PROXIES[0], targetUrl)
  } catch {
    return targetUrl
  }
}

function corsCandidateUrls(targetUrl: string): string[] {
  if (import.meta.env.DEV) {
    return [proxiedUrl(targetUrl)]
  }

  const custom = env('VITE_CORS_PROXY')
  const list = [
    ...(custom ? [buildCorsProxyUrl(custom, targetUrl)] : []),
    ...DEFAULT_CORS_PROXIES.map((p) => buildCorsProxyUrl(p, targetUrl)),
  ]
  return [...new Set(list)]
}

async function fetchRaw(requestUrl: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(requestUrl, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchText(
  url: string,
  options: { useProxy?: boolean; cacheKey?: string; timeoutMs?: number } = {},
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS
  const key = options.cacheKey ?? `${options.useProxy ? 'proxy:' : 'direct:'}${url}`
  const cached = textCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.text

  const candidates = options.useProxy ? corsCandidateUrls(url) : [url]
  const errors: string[] = []

  for (const requestUrl of candidates) {
    try {
      const response = await fetchRaw(requestUrl, timeoutMs)
      if (!response.ok) {
        errors.push(`${requestUrl} → ${response.status}`)
        continue
      }
      const text = await response.text()
      if (looksLikeProxyError(text)) {
        errors.push(`${requestUrl} → proxy error body`)
        continue
      }
      textCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, text })
      return text
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${requestUrl} → ${message}`)
    }
  }

  throw new Error(`请求失败: ${url} (${errors.slice(0, 2).join('; ')})`)
}

/** Fetch an RSSHub route, trying multiple mirrors until XML is returned. */
export async function fetchRssHubText(routePath: string): Promise<string> {
  const path = routePath.startsWith('/') ? routePath : `/${routePath}`
  const cacheKey = `rsshub:${path}`
  const cached = textCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.text

  const bases = rsshubBases()
  const errors: string[] = []

  for (const base of bases) {
    const target = `${base}${path}`
    try {
      const text = await fetchText(target, {
        useProxy: true,
        cacheKey: `rsshub-try:${base}${path}`,
        timeoutMs: FETCH_TIMEOUT_MS,
      })
      if (!looksLikeRssOrXml(text)) {
        errors.push(`${base}: not RSS`)
        continue
      }
      textCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, text })
      return text
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${base}: ${message}`)
    }
  }

  throw new Error(`RSSHub 不可用 (${path}): ${errors[0] ?? 'no mirrors'}`)
}

export async function fetchJson<T>(
  url: string,
  options: { useProxy?: boolean; cacheKey?: string; timeoutMs?: number } = {},
): Promise<T> {
  const key = options.cacheKey ?? `json:${options.useProxy ? 'proxy:' : 'direct:'}${url}`
  const cached = jsonCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.data as T

  const text = await fetchText(url, options)
  const data = JSON.parse(text) as T
  jsonCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, data })
  return data
}

export function clearGuideCaches(): void {
  textCache.clear()
  jsonCache.clear()
}
