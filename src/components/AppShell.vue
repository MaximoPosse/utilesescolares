<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuth } from '../stores/auth.js'
import { notify } from '../stores/toast.js'
import { IS_DEMO } from '../services/api.js'
import { ROLES, ROL_OPTIONS } from '../data/constants.js'
import { initials } from '../data/utils.js'
import ConfirmDialog from './ConfirmDialog.vue'

const auth = useAuth()
const route = useRoute()
const router = useRouter()

const menuOpen = ref(false)
const changingRole = ref(false)
const roleValue = ref(auth.state.user?.rol || 'estudiante')
const resetOpen = ref(false)
const resetting = ref(false)

const user = computed(() => auth.state.user)
const roleLabel = computed(() => ROLES[user.value?.rol]?.label || 'Estudiante')
const roleShort = computed(() => ROLES[user.value?.rol]?.short || 'Estudiante')

watch(
  () => auth.state.user?.rol,
  (rol) => {
    if (rol) roleValue.value = rol
  },
)

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
  },
)

const mainNav = [
  { to: '/', label: 'Inicio', icon: '⌂' },
  { to: '/catalogo', label: 'Catálogo', icon: '▤' },
  { to: '/mis-prestamos', label: 'Mis préstamos', icon: '↺' },
  { to: '/ofrecer', label: 'Ofrecer útil', icon: '＋' },
  { to: '/votaciones', label: 'Votaciones', icon: '✓' },
  { to: '/avisos', label: 'Avisos', icon: '!' },
  { to: '/acuerdos', label: 'Acuerdos', icon: '§' },
  { to: '/recursos', label: 'Recursos', icon: '$' },
  { to: '/tareas', label: 'Tareas', icon: '☑' },
  { to: '/estadisticas', label: 'Estadísticas', icon: '▥' },
]

const managementNav = computed(() => {
  const items = []
  if (auth.permisos.value.gestionPrestamos) items.push({ to: '/gestion-prestamos', label: 'Gestión de préstamos', icon: '⚙' })
  if (auth.permisos.value.inventario) items.push({ to: '/inventario', label: 'Inventario', icon: '▦' })
  if (auth.permisos.value.asignarRoles) items.push({ to: '/integrantes', label: 'Integrantes', icon: '☺' })
  return items
})

function isActive(path) {
  if (path === '/') return route.path === '/'
  return route.path === path || route.path.startsWith(`${path}/`)
}

async function handleLogout() {
  await auth.logout()
  notify('Cerraste sesión.', 'info')
  router.push('/login')
}

async function handleRoleChange(event) {
  const nextRole = event.target.value
  changingRole.value = true
  try {
    await auth.cambiarRolDemo(nextRole)
    notify(`Ahora estás probando la interfaz como ${ROLES[nextRole]?.label || nextRole}.`, 'info')
    if (route.meta.roles && !route.meta.roles.includes(nextRole)) {
      router.push('/')
    }
  } catch (error) {
    notify(error.message, 'error')
    roleValue.value = user.value?.rol || 'estudiante'
  } finally {
    changingRole.value = false
  }
}

async function confirmReset() {
  resetting.value = true
  try {
    await auth.resetDemoData()
    resetOpen.value = false
    notify('Datos de prueba reiniciados.', 'success')
    if (user.value) router.go(0)
    else router.push('/login')
  } catch (error) {
    notify(error.message, 'error')
  } finally {
    resetting.value = false
  }
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="app-header__inner">
        <div class="app-header__top">
          <RouterLink to="/" class="brand" aria-label="Ir al inicio de la Cooperativa de Útiles Escolares">
            <span class="brand__mark" aria-hidden="true">
              <svg viewBox="0 0 48 48" width="34" height="34" fill="none">
                <rect width="48" height="48" rx="14" fill="currentColor" opacity=".12" />
                <path d="M33.5 13.5C24 14 16 18.5 15 27.5c-.4 3.6 2.2 6.4 5.9 6.4 8.8 0 12.1-9.6 12.6-20.4Z" fill="currentColor" />
                <path d="M15.5 35c1.5-6.5 5.5-10.4 11.5-13.4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
              </svg>
            </span>
            <span class="brand__text">
              <strong>Cooperativa</strong>
              <small>de Útiles Escolares</small>
            </span>
          </RouterLink>

          <div class="header-actions">
            <div class="user-chip">
              <span class="avatar" aria-hidden="true">{{ initials(user?.nombre, user?.apellido) }}</span>
              <span class="user-chip__text">
                <strong>{{ user?.nombre }} {{ user?.apellido }}</strong>
                <small>{{ user?.curso }} · {{ roleShort }}</small>
              </span>
            </div>
            <button class="btn btn-ghost header-logout" type="button" @click="handleLogout">Salir</button>
            <button
              class="menu-toggle"
              type="button"
              :aria-expanded="menuOpen"
              aria-controls="mobile-navigation"
              aria-label="Abrir menú de navegación"
              @click="menuOpen = !menuOpen"
            >
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>

        <nav class="main-nav" aria-label="Navegación principal">
          <RouterLink
            v-for="item in mainNav"
            :key="item.to"
            :to="item.to"
            class="nav-link"
            :class="{ 'nav-link--active': isActive(item.to) }"
          >
            <span class="nav-link__icon" aria-hidden="true">{{ item.icon }}</span>
            {{ item.label }}
          </RouterLink>
          <span v-if="managementNav.length" class="nav-separator" aria-hidden="true"></span>
          <RouterLink
            v-for="item in managementNav"
            :key="item.to"
            :to="item.to"
            class="nav-link nav-link--manage"
            :class="{ 'nav-link--active': isActive(item.to) }"
          >
            <span class="nav-link__icon" aria-hidden="true">{{ item.icon }}</span>
            {{ item.label }}
          </RouterLink>
          <button class="nav-link nav-link--exit" type="button" @click="handleLogout">Salir</button>
        </nav>
      </div>

      <div v-if="IS_DEMO" class="demo-strip">
        <div class="demo-strip__inner">
          <p class="demo-strip__label">
            <span class="demo-dot" aria-hidden="true"></span>
            Modo demostración · todos los datos son ficticios
          </p>
          <div class="demo-strip__controls">
            <label class="role-switch">
              <span>Cambiar de rol (demostración)</span>
              <select :value="roleValue" :disabled="changingRole" @change="handleRoleChange">
                <option v-for="option in ROL_OPTIONS" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>
            <button class="link-button" type="button" @click="resetOpen = true">Reiniciar datos de prueba</button>
          </div>
        </div>
      </div>
    </header>

    <Transition name="fade">
      <div v-if="menuOpen" id="mobile-navigation" class="mobile-nav">
        <nav aria-label="Navegación móvil">
          <p class="mobile-nav__group">Cooperativa</p>
          <RouterLink
            v-for="item in mainNav"
            :key="item.to"
            :to="item.to"
            class="mobile-nav__link"
            :class="{ 'mobile-nav__link--active': isActive(item.to) }"
          >
            <span aria-hidden="true">{{ item.icon }}</span> {{ item.label }}
          </RouterLink>
          <template v-if="managementNav.length">
            <p class="mobile-nav__group">Gestión</p>
            <RouterLink
              v-for="item in managementNav"
              :key="item.to"
              :to="item.to"
              class="mobile-nav__link"
              :class="{ 'mobile-nav__link--active': isActive(item.to) }"
            >
              <span aria-hidden="true">{{ item.icon }}</span> {{ item.label }}
            </RouterLink>
          </template>
          <button class="mobile-nav__link mobile-nav__link--exit" type="button" @click="handleLogout">
            <span aria-hidden="true">↪</span> Salir
          </button>
        </nav>
      </div>
    </Transition>

    <main class="app-main">
      <div class="container">
        <slot />
      </div>
    </main>

    <footer class="app-footer">
      <div class="container app-footer__inner">
        <p>
          <strong>Cooperativa de Útiles Escolares</strong> · Proyecto escolar de organización y métodos.
        </p>
        <p>
          {{ IS_DEMO ? 'Datos de prueba guardados en este navegador.' : 'Datos compartidos a través de Supabase.' }}
          <span class="footer-badge">{{ IS_DEMO ? 'DEMO' : 'SUPABASE' }}</span>
        </p>
      </div>
    </footer>

    <ConfirmDialog
      :open="resetOpen"
      title="Reiniciar los datos de prueba"
      message="Se volverán a generar los datos ficticios iniciales y se perderán los cambios que hayas hecho en este navegador. Las cuentas de demostración seguirán funcionando."
      confirm-label="Reiniciar datos"
      danger
      :loading="resetting"
      @close="resetOpen = false"
      @confirm="confirmReset"
    />
  </div>
</template>
