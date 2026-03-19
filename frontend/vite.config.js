import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    // Force standard script format instead of ES Modules
    target: "es2015",
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    brotliSize: false,
    modulePreload: false,
    rollupOptions: {
      inlineDynamicImports: true,
      output: {
        // This is the magic key: It forces standard script execution without CORS issues!
        format: 'iife' 
      }
    },
  },
})