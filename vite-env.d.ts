/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLOUD_FUNCTIONS_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
