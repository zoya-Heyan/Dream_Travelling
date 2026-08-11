/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CORS_PROXY?: string
  readonly VITE_RSSHUB_BASE?: string
  /** Comma-separated RSSHub mirror bases, tried after VITE_RSSHUB_BASE. */
  readonly VITE_RSSHUB_BASES?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
