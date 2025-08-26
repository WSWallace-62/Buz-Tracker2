import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
      },
    }),
  ],
  server: {
    cors: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split firebase into smaller chunks
          'firebase-app': ['firebase/app'],
          'firebase-auth': ['firebase/auth'],
          'firebase-firestore': ['firebase/firestore'],
          'firebase-storage': ['firebase/storage'],
          dexie: ['dexie', 'dexie-react-hooks'],
          react: ['react', 'react-dom', 'react-router-dom'],
          chartjs: ['chart.js', 'react-chartjs-2'],
        },
      },
    },
  },
})

