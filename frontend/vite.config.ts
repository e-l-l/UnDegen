import { fileURLToPath, URL } from 'node:url'
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  // Build-time app version, surfaced on the You page's App section. npm sets
  // npm_package_version when running via the package scripts (dev/build/preview).
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    // With no precache manifest, the worker would otherwise be byte-identical
    // across app-only deploys and could not surface the explicit update prompt.
    __SW_BUILD_ID__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA ?? new Date().toISOString()),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [react(), tailwindcss(), VitePWA({
    strategies: 'injectManifest',
    srcDir: 'src',
    filename: 'sw.ts',
    registerType: 'prompt',
    injectRegister: false,

    pwaAssets: {
      disabled: false,
      config: true,
    },

    manifest: {
      name: 'UnDegen',
      short_name: 'UnDegen',
      description: 'An app to get your life back on track. Use it for the stuff which are not just todos, but todos which you keep ignoring on purpose',
      theme_color: '#ffffff',
    },

    injectManifest: {
      injectionPoint: undefined,
    },

    devOptions: {
      enabled: false,
      suppressWarnings: true,
      type: 'module',
    },
  })],
})
