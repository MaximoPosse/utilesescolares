<script setup>
import { RouterLink } from 'vue-router'
import EmptyState from '../components/EmptyState.vue'

const links = [
  { to: '/', label: 'Ir al inicio' },
  { to: '/catalogo', label: 'Ver catálogo' },
  { to: '/mis-prestamos', label: 'Mis préstamos' },
]
</script>

<template>
  <div class="not-found">
    <section class="panel">
      <EmptyState
        icon="🧭"
        title="No encontramos esta página"
        text="Puede que el enlace esté mal escrito o que la sección ya no exista. Probá desde alguno de estos accesos."
      >
        <RouterLink v-for="link in links" :key="link.to" :to="link.to" class="btn btn-secondary">
          {{ link.label }}
        </RouterLink>
      </EmptyState>
    </section>
  </div>
</template>
