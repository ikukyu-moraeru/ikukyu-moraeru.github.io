import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))

// GitHub Pages 公開時のサブパスに合わせる
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(here, 'index.html'),
        privacy: resolve(here, 'privacy.html'),
        contentPolicy: resolve(here, 'content-policy.html'),
      },
    },
  },
})
