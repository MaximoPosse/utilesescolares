import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    open: true,
    watch: {
      // Evita que Vite bloquee el servidor al editar SQL o documentación.
      ignored: ['**/supabase/**', '**/docs/**', '**/dist/**'],
    },
  },
})
