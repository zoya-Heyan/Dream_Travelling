import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

/** Same-origin reverse proxy for arbitrary upstream URLs in DEV (avoids CORS / dead public CORS proxies). */
function devUrlProxyPlugin(): Plugin {
  return {
    name: 'dev-url-proxy',
    configureServer(server) {
      server.middlewares.use('/proxy/url', (req, res) => {
        void (async () => {
          try {
            const host = req.headers.host ?? '127.0.0.1'
            const incoming = new URL(req.url ?? '', `http://${host}`)
            const target = incoming.searchParams.get('target')
            if (!target) {
              res.statusCode = 400
              res.end('missing target')
              return
            }

            let parsed: URL
            try {
              parsed = new URL(target)
            } catch {
              res.statusCode = 400
              res.end('invalid target')
              return
            }

            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
              res.statusCode = 400
              res.end('unsupported protocol')
              return
            }

            const upstream = await fetch(target, {
              headers: {
                'user-agent':
                  'Mozilla/5.0 (compatible; DreamTravelling/1.0; +https://github.com/zoya-Heyan/Dream_Travelling)',
                accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
              },
              signal: AbortSignal.timeout(12_000),
            })

            res.statusCode = upstream.status
            const contentType = upstream.headers.get('content-type')
            if (contentType) res.setHeader('content-type', contentType)
            res.setHeader('cache-control', 'no-store')
            const buffer = Buffer.from(await upstream.arrayBuffer())
            res.end(buffer)
          } catch (error) {
            res.statusCode = 502
            res.setHeader('content-type', 'text/plain; charset=utf-8')
            res.end(error instanceof Error ? error.message : String(error))
          }
        })()
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), devUrlProxyPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // Fallback path kept for older callers; primary path is /proxy/url middleware.
      '/proxy/rsshub': {
        target: 'https://rsshub.rssforever.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/rsshub/, ''),
      },
      '/proxy/google-news': {
        target: 'https://news.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/google-news/, ''),
      },
    },
  },
})
