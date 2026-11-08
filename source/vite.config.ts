import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig(({ command }) => ({
  define: command === 'build' ? { 'process.env.NODE_ENV': JSON.stringify('production') } : {},
  root: at('../'),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': at('./'), react: at('./node_modules/react'), 'react-dom': at('./node_modules/react-dom') } },
  server: { fs: { allow: [at('../')] } },
  build: {
    outDir: at('../assets/glass-folder'),
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: false,
    lib: { entry: at('./src/main.tsx'), name: 'LVCDocuments', formats: ['iife'], fileName: () => 'documents.js', cssFileName: 'documents' }
  }
}))
