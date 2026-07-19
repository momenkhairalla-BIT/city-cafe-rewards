/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dev-only: set to "true" to bypass employee session checks locally. Forbidden in production builds. */
  readonly VITE_ALLOW_AUTH_BYPASS?: string;
  /** Dev-only: sample data for unfinished Admin/POS modules. Forbidden in production builds. */
  readonly VITE_UI_PREVIEW_MODE?: string;
  readonly VITE_API_PROXY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
