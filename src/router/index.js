import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../stores/auth.js'
import { notify } from '../stores/toast.js'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { public: true, title: 'Ingresar' },
  },
  {
    path: '/',
    name: 'inicio',
    component: () => import('../views/DashboardView.vue'),
    meta: { title: 'Inicio' },
  },
  {
    path: '/catalogo',
    name: 'catalogo',
    component: () => import('../views/CatalogoView.vue'),
    meta: { title: 'Catálogo' },
  },
  {
    path: '/catalogo/:id',
    name: 'util-detalle',
    component: () => import('../views/UtilDetalleView.vue'),
    meta: { title: 'Detalle del útil' },
  },
  {
    path: '/solicitud/:id/confirmacion',
    name: 'solicitud-confirmacion',
    component: () => import('../views/SolicitudConfirmacionView.vue'),
    meta: { title: 'Solicitud registrada' },
  },
  {
    path: '/mis-prestamos',
    name: 'mis-prestamos',
    component: () => import('../views/MisPrestamosView.vue'),
    meta: { title: 'Mis préstamos' },
  },
  {
    path: '/devolucion/:id/confirmacion',
    name: 'devolucion-confirmacion',
    component: () => import('../views/DevolucionConfirmacionView.vue'),
    meta: { title: 'Devolución registrada' },
  },
  {
    path: '/ofrecer',
    name: 'ofrecer',
    component: () => import('../views/OfrecerUtilView.vue'),
    meta: { title: 'Ofrecer útil' },
  },
  {
    path: '/votaciones',
    name: 'votaciones',
    component: () => import('../views/VotacionesView.vue'),
    meta: { title: 'Votaciones' },
  },
  {
    path: '/avisos',
    name: 'avisos',
    component: () => import('../views/AvisosView.vue'),
    meta: { title: 'Avisos' },
  },
  {
    path: '/acuerdos',
    name: 'acuerdos',
    component: () => import('../views/AcuerdosView.vue'),
    meta: { title: 'Acuerdos' },
  },
  {
    path: '/recursos',
    name: 'recursos',
    component: () => import('../views/RecursosView.vue'),
    meta: { title: 'Recursos' },
  },
  {
    path: '/tareas',
    name: 'tareas',
    component: () => import('../views/TareasView.vue'),
    meta: { title: 'Tareas' },
  },
  {
    path: '/gestion-prestamos',
    name: 'gestion-prestamos',
    component: () => import('../views/GestionPrestamosView.vue'),
    meta: { title: 'Gestión de préstamos', roles: ['comision_administracion'] },
  },
  {
    path: '/inventario',
    name: 'inventario',
    component: () => import('../views/InventarioView.vue'),
    meta: { title: 'Inventario', roles: ['comision_administracion'] },
  },
  {
    path: '/integrantes',
    name: 'integrantes',
    component: () => import('../views/IntegrantesView.vue'),
    meta: { title: 'Integrantes', roles: ['presidente'] },
  },
  {
    path: '/estadisticas',
    name: 'estadisticas',
    component: () => import('../views/EstadisticasView.vue'),
    meta: { title: 'Estadísticas' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'no-encontrada',
    component: () => import('../views/NotFoundView.vue'),
    meta: { title: 'Página no encontrada' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0, behavior: 'smooth' }
  },
})

router.beforeEach(async (to) => {
  const auth = useAuth()
  await auth.init()

  if (to.meta.public) {
    if (auth.state.user && to.name === 'login') return { name: 'inicio' }
    return true
  }

  if (!auth.state.user) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (Array.isArray(to.meta.roles) && !to.meta.roles.includes(auth.state.user.rol)) {
    notify('No tenés permisos para abrir esa sección con tu rol actual.', 'error')
    return { name: 'inicio' }
  }

  return true
})

router.afterEach((to) => {
  const base = 'Cooperativa de Útiles Escolares'
  document.title = to.meta.title ? `${to.meta.title} · ${base}` : base
})

export default router
