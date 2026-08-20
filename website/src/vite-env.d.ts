/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional: API origin for production builds, e.g. https://cp.example.com — requests use `${VITE_CONTROL_PLANE_API_BASE}/api/...` */
  readonly VITE_CONTROL_PLANE_API_BASE?: string;
  readonly VITE_CONTROL_PLANE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
