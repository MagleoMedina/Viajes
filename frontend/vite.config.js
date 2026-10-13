import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// Backend NestJS en el 8080 durante el desarrollo.
// BACKEND_URL permite apuntar a la IP de la PC, ej. BACKEND_URL=http://192.168.0.39:8080
const backend = process.env.BACKEND_URL ?? 'http://localhost:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    // Escucha en 0.0.0.0: accesible desde otras PCs/celulares por la IP local.
    host: true,
    proxy: {
      '/api': backend,
    },
  },
})
