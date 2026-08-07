/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STAFF_EMAIL?: string
  readonly VITE_STAFF_PASSWORD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
