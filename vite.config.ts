import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Identificativo della build: su Vercel è il commit, in locale l'orario.
 * Finisce sia nel bundle sia in /version.json, e il confronto fra i due dice
 * alla scheda già aperta che è uscita una versione nuova.
 */
const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
  process.env.BUILD_ID ??
  `dev-${Date.now().toString(36)}`

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'sagoma-version-manifest',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ build: BUILD_ID, at: new Date().toISOString() }),
        })
      },
    },
  ],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  base: '/',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
})
