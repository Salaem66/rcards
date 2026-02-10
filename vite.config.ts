import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import glsl from 'vite-plugin-glsl'
import path from 'path'

export default defineConfig({
  base: '/rcards/',
  plugins: [react(), glsl()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
