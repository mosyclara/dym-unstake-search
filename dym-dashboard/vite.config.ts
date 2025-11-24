import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'crypto': 'crypto-browserify',
      'stream': 'stream-browserify',
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  optimizeDeps: {
    include: ['@cosmjs/stargate', '@cosmjs/proto-signing'],
    esbuildOptions: {
      target: 'es2020',
      define: {
        global: 'globalThis',
      },
    },
  },
  define: {
    global: 'globalThis',
  },
})

