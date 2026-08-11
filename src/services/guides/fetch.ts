const CACHE_TTL_MS = 10 * 60 * 1000

const textCache = new Map<string, { expiresAt: number; text: string }>()
const jsonCache = new Map<string, { expiresAt: number; data: unknown }>()

function env(name: keyof ImportMetaEnv): string | undefined {
  const value = import.meta.env[name]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** Build a URL that can be fetched from the browser despite CORS. */
export function proxiedUrl(targetUrl: string): string {
  try {
    const parsed = new URL(targetUrl)
    const host = parsed.hostname
    const pathWithQuery = `${parsed.pathname}${parsed.search}`

    if (import.meta.env.DEV) {
      if (host === 'rsshub.app' || host.endsWith('.rsshub.app')) {
        return `/proxy/rsshub${pathWithQuery}`
      }
      if (host === 'news.google.com') {
        return `/proxy/google-news${pathWithQuery}`
      }
    }

    const corsProxy = env('VITE_CORS_PROXY')
    if (corsProxy) {
      const base = corsProxy.endsWith('=') || corsProxy.endsWith('?') || corsProxy.endsWith('&')
        ? corsProxy
        : corsProxy.includes('?')
          ? `${corsProxy}${corsProxy.endsWith('&') ? '' : '&'}url=`
          : `${corsProxy}?url=`
      return `${base}${encodeURIComponent(targetUrl)}`
    }

    // Default public CORS helpers for RSS / RSSHub in production builds.
    // Prefer corsproxy.io; fall back callers still handle per-source failures.
    return `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
  } catch {
    return targetUrl
  }
}

export function rsshubUrl(routePath: string): string {
  const base = (env('VITE_RSSHUB_BASE') ?? 'https://rsshub.app').replace(/\/$/, '')
  const path = routePath.startsWith('/') ? routePath : `/${routePath}`
  return `${base}${path}`
}

export async function fetchText(
  url: string,
  options: { useProxy?: boolean; cacheKey?: string } = {},
): Promise<string> {
  const key = options.cacheKey ?? `${options.useProxy ? 'proxy:' : 'direct:'}${url}`
  const cached = textCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.text

  const requestUrl = options.useProxy ? proxiedUrl(url) : url
  const response = await fetch(requestUrl)
  if (!response.ok) {
    throw new Error(`请求失败 (${response.status}): ${url}`)
  }
  const text = await response.text()
  textCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, text })
  return text
}

export async function fetchJson<T>(
  url: string,
  options: { useProxy?: boolean; cacheKey?: string } = {},
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
