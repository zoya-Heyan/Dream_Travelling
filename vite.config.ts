import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/proxy/rsshub': {
        target: 'https://rsshub.app',
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
