/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dev-only: set to "true" to bypass employee session checks locally. Forbidden in production builds. */
  readonly VITE_ALLOW_AUTH_BYPASS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
