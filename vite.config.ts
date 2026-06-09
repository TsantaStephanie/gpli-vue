import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // permet d'utiliser @/models, @/services, @/constants, etc.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Proxy pour éviter les CORS avec GLPI en dev
    proxy: {
      '/apirest.php': {
        target: 'http://localhost:8082',
        changeOrigin: true,
        secure: false,
      },
      // Proxy pour les photos d'actifs GLPI (picture_front)
      '/front/document.send.php': {
        target: 'http://localhost:8082',
        changeOrigin: true,
        secure: false,
      },
      // Proxy vers le backend Spring Boot (SQLite)
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
