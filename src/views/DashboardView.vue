<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuth } from '../stores/auth.js'
import { notify } from '../stores/toast.js'
import { api, IS_DEMO } from '../services/api.js'
import { KPI_META, estadoKpi } from '../services/stats.js'
import { ROLES } from '../data/constants.js'
import {
  diasAtraso,
  estadoPrestamoEfectivo,
  formatDate,
  relativeDate,
  todayISO,
  truncate,
} from '../data/utils.js'
import PageHeader from '../components/PageHeader.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import EmptyState from '../components/EmptyState.vue'
import StatusBadge from '../components/StatusBadge.vue'

const auth = useAuth()
const user = computed(() => auth.state.user)

const loading = ref(true)
const loadError = ref('')
const solicitudes = ref([])
const prestamos = ref([])
const tareas = ref([])
const avisos = ref([])
const votaciones = ref([])
const stats = ref(null)

const emptyIndicator = { parte: 0, total: 0, valor: null, na: true }

const general = computed(() => stats.value?.general || {
  cobertura: emptyIndicator,
  aTiempo: emptyIndicator,
  buenEstado: emptyIndicator,
  tareas: emptyIndicator,
})

const operacion = computed(() => stats.value?.operacion || {})

const misPrestamos = computed(() =>
  prestamos.value.map((p) => ({ ...p, estadoEfectivo: estadoPrestamoEfectivo(p) })),
)
const activos = computed(() => misPrestamos.value.filter((p) => p.estado === 'prestado'))
const atrasados = computed(() => misPrestamos.value.filter((p) => p.estadoEfectivo === 'atrasado'))
const devueltos = computed(() => misPrestamos.value.filter((p) => p.estado === 'devuelto'))
const solicitudesPendientes = computed(() =>
  solicitudes.value.filter((s) => ['pendiente', 'aprobada'].includes(s.estado)),
)
const tareasPendientes = computed(() =>
  tareas.value.filter((t) => t.estado !== 'terminada'),
)
const votacionesAbiertas = computed(() =>
  votaciones.value.filter((v) => v.estado === 'abierta' && v.fechaCierre >= todayISO()),
)
const votacionesSinVotar = computed(() =>
  votacionesAbiertas.value.filter(
    (v) => !v.votos?.some((voto) => voto.usuarioId === user.value?.id),
  ),
)
const proximoVencimiento = computed(() => {
  const ordered = [...activos.value].sort((a, b) => (a.fechaAcordada || '').localeCompare(b.fechaAcordada || ''))
  return ordered[0] || null
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buen día'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
})

const dateLabel = computed(() =>
  new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()),
)

const roleData = computed(() => {
  const op = operacion.value
  const rol = user.value?.rol
  const base = {
    student: {
      icon: '🌱',
      title: 'Tu participación',
      copy: 'Recordá devolver los útiles en el plazo acordado y avisar si algo se pierde o se daña.',
      metrics: [
        { label: 'Préstamos activos', value: activos.value.length },
        { label: 'Solicitudes en curso', value: solicitudesPendientes.value.length },
        { label: 'Tareas pendientes', value: tareasPendientes.value.length },
      ],
      cta: { label: 'Explorar el catálogo', to: '/catalogo' },
    },
  }
  if (rol === 'presidente') {
    return {
      icon: '🌿',
      title: 'Presidencia',
      copy: 'Tenés una mirada general de la cooperativa. Podés crear votaciones y asignar roles.',
      metrics: [
        { label: 'Integrantes', value: op.estudiantes ?? '—' },
        { label: 'Votaciones abiertas', value: votacionesAbiertas.value.length },
        { label: 'Cobertura', value: general.value.cobertura.na ? 'N/A' : `${general.value.cobertura.valor} %` },
      ],
      cta: { label: 'Ver integrantes', to: '/integrantes' },
    }
  }
  if (rol === 'comision_administracion') {
    return {
      icon: '🧺',
      title: 'Comisión de administración',
      copy: 'Revisá solicitudes, entregá útiles y controlá las devoluciones para que vuelvan al catálogo.',
      metrics: [
        { label: 'Solicitudes pendientes', value: op.solicitudesPendientes ?? 0 },
        { label: 'Préstamos atrasados', value: op.prestamosAtrasados ?? 0 },
        { label: 'Devoluciones a controlar', value: op.devolucionesAControlar ?? 0 },
      ],
      cta: { label: 'Ir a gestión de préstamos', to: '/gestion-prestamos' },
    }
  }
  if (rol === 'comision_comunicacion') {
    return {
      icon: '📣',
      title: 'Comisión de comunicación',
      copy: 'Mantené informada a la comunidad con avisos claros sobre útiles, reuniones y devoluciones.',
      metrics: [
        { label: 'Avisos activos', value: op.avisosActivos ?? avisos.value.length },
        { label: 'Préstamos atrasados', value: op.prestamosAtrasados ?? 0 },
        { label: 'Cobertura', value: general.value.cobertura.na ? 'N/A' : `${general.value.cobertura.valor} %` },
      ],
      cta: { label: 'Gestionar avisos', to: '/avisos' },
    }
  }
  if (rol === 'secretario') {
    return {
      icon: '📋',
      title: 'Secretaría',
      copy: 'Registrá los acuerdos de la asamblea con fecha, tema y decisión. El resto los consulta.',
      metrics: [
        { label: 'Acuerdos vigentes', value: op.acuerdosActivos ?? 0 },
        { label: 'Solicitudes pendientes', value: op.solicitudesPendientes ?? 0 },
        { label: 'Tareas pendientes', value: op.tareasPendientes ?? 0 },
      ],
      cta: { label: 'Ver acuerdos', to: '/acuerdos' },
    }
  }
  if (rol === 'tesorero') {
    return {
      icon: '💰',
      title: 'Tesorería',
      copy: 'Cada movimiento queda registrado. Anulá con baja lógica si hay un error, para conservar el historial.',
      metrics: [
        { label: 'Saldo', value: op.saldo !== undefined ? `$${Number(op.saldo).toLocaleString('es-AR')}` : '—' },
        { label: 'Ingresos', value: op.ingresos !== undefined ? `$${Number(op.ingresos).toLocaleString('es-AR')}` : '—' },
        { label: 'Egresos', value: op.egresos !== undefined ? `$${Number(op.egresos).toLocaleString('es-AR')}` : '—' },
      ],
      cta: { label: 'Ver recursos', to: '/recursos' },
    }
  }
  if (rol === 'comision_organizacion') {
    return {
      icon: '✅',
      title: 'Comisión de organización',
      copy: 'Creá actividades, asigná tareas y seguí su estado hasta terminarlas.',
      metrics: [
        { label: 'Tareas pendientes', value: op.tareasPendientes ?? 0 },
        { label: 'Tareas terminadas', value: op.tareasTerminadas ?? 0 },
        { label: 'Cumplimiento', value: general.value.tareas.na ? 'N/A' : `${general.value.tareas.valor} %` },
      ],
      cta: { label: 'Organizar tareas', to: '/tareas' },
    }
  }
  return base.student
})

const accessCards = computed(() => [
  {
    to: '/catalogo',
    icon: '▤',
    title: 'Catálogo de útiles',
    text: 'Buscá por tipo y disponibilidad, y pedí un préstamo.',
    meta: `${operacion.value.unidadesDisponibles ?? '—'} unidades disponibles`,
    className: 'access-card--leaf',
  },
  {
    to: '/mis-prestamos',
    icon: '↺',
    title: 'Mis préstamos',
    text: 'Seguí tus solicitudes, devoluciones y vencimientos.',
    meta: `${activos.value.length} activos · ${solicitudesPendientes.value.length} en curso`,
    className: 'access-card--sky',
  },
  {
    to: '/ofrecer',
    icon: '＋',
    title: 'Ofrecer un útil',
    text: 'Sumá un útil por donación o intercambio.',
    meta: 'La administración lo revisa antes de publicarlo',
    className: 'access-card--sand',
  },
  {
    to: '/votaciones',
    icon: '✓',
    title: 'Votaciones',
    text: 'Participá en las decisiones de la cooperativa.',
    meta: `${votacionesAbiertas.value.length} abiertas${votacionesSinVotar.value.length ? ` · ${votacionesSinVotar.value.length} sin votar` : ''}`,
    className: 'access-card--rose',
  },
  {
    to: '/avisos',
    icon: '!',
    title: 'Avisos',
    text: 'Novedades, reuniones y recordatorios de devolución.',
    meta: `${avisos.value.length} avisos publicados`,
    className: 'access-card--lime',
  },
  {
    to: '/tareas',
    icon: '☑',
    title: 'Tareas',
    text: 'Consultá lo que te asignaron y actualizá su estado.',
    meta: `${tareasPendientes.value.length} pendientes`,
    className: 'access-card--violet',
  },
])

const kpis = computed(() => [
  { key: 'cobertura', icon: '↗' },
  { key: 'aTiempo', icon: '⏱' },
  { key: 'buenEstado', icon: '✓' },
  { key: 'tareas', icon: '☑' },
].map(({ key, icon }) => ({
  key,
  icon,
  ...KPI_META[key],
  ...general.value[key],
  estado: estadoKpi(general.value[key], KPI_META[key].meta),
})))

const latestAvisos = computed(() => avisos.value.slice(0, 3))

async function load() {
  loading.value = true
  loadError.value = ''
  const results = await Promise.allSettled([
    api.listSolicitudes({ userId: user.value.id }),
    api.listPrestamos({ userId: user.value.id }),
    api.listTareas({ userId: user.value.id }),
    api.listAvisos(),
    api.listVotaciones(),
    api.getEstadisticas(),
  ])
  const [sol, pres, tar, avi, vot, est] = results
  if (sol.status === 'fulfilled') solicitudes.value = sol.value
  if (pres.status === 'fulfilled') prestamos.value = pres.value
  if (tar.status === 'fulfilled') tareas.value = tar.value
  if (avi.status === 'fulfilled') avisos.value = avi.value
  if (vot.status === 'fulfilled') votaciones.value = vot.value
  if (est.status === 'fulfilled') stats.value = est.value
  const rejected = results.filter((r) => r.status === 'rejected')
  if (rejected.length) {
    loadError.value = rejected[0].reason?.message || 'Algunos datos no se pudieron cargar.'
    notify(loadError.value, 'error')
  }
  loading.value = false
}

onMounted(load)
</script>

<template>
  <div class="dashboard">
    <LoadingBlock v-if="loading" label="Preparando tu panel…" />

    <template v-else>
      <section class="hero-card">
        <div class="hero-card__content">
          <div class="hero-card__badge-row">
            <span class="pill pill--light">{{ ROLES[user.rol]?.label }}</span>
            <span class="pill pill--ghost">{{ dateLabel }}</span>
          </div>
          <h1>{{ greeting }}, {{ user.nombre }}.</h1>
          <p class="hero-card__lead">
            Estás en <strong>{{ user.curso }}</strong>. Este es el panel de la cooperativa:
            tus pendientes, las novedades y los accesos según tu rol.
          </p>
          <div class="hero-card__actions">
            <RouterLink to="/catalogo" class="btn btn-light">Explorar catálogo</RouterLink>
            <RouterLink to="/mis-prestamos" class="btn btn-outline-light">Ver mis préstamos</RouterLink>
          </div>
          <p v-if="IS_DEMO" class="hero-card__demo">Datos de prueba · modo demostración local</p>
        </div>
        <div class="hero-card__aside">
          <div class="hero-summary">
            <p class="hero-summary__label">Tu situación</p>
            <div class="hero-summary__row">
              <span>Solicitudes en curso</span>
              <strong>{{ solicitudesPendientes.length }}</strong>
            </div>
            <div class="hero-summary__row">
              <span>Préstamos activos</span>
              <strong>{{ activos.length }}</strong>
            </div>
            <div class="hero-summary__row">
              <span>Atrasados</span>
              <strong :class="{ 'text-danger': atrasados.length }">{{ atrasados.length }}</strong>
            </div>
            <div class="hero-summary__row">
              <span>Tareas pendientes</span>
              <strong>{{ tareasPendientes.length }}</strong>
            </div>
            <div v-if="proximoVencimiento" class="hero-summary__next">
              <span aria-hidden="true">⏱</span>
              <p>
                Próximo vencimiento: <strong>{{ formatDate(proximoVencimiento.fechaAcordada) }}</strong>
                ({{ relativeDate(proximoVencimiento.fechaAcordada) }})
              </p>
            </div>
          </div>
        </div>
      </section>

      <div v-if="loadError" class="alert alert--error">{{ loadError }}</div>

      <section class="dashboard-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Accesos rápidos</p>
            <h2>¿Qué querés hacer hoy?</h2>
          </div>
        </div>
        <div class="access-grid">
          <RouterLink
            v-for="card in accessCards"
            :key="card.to"
            :to="card.to"
            class="access-card"
            :class="card.className"
          >
            <span class="access-card__icon" aria-hidden="true">{{ card.icon }}</span>
            <div>
              <h3>{{ card.title }}</h3>
              <p>{{ card.text }}</p>
              <span class="access-card__meta">{{ card.meta }}</span>
            </div>
            <span class="access-card__arrow" aria-hidden="true">→</span>
          </RouterLink>
        </div>
      </section>

      <section class="dashboard-section kpi-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Panel general · acumulado</p>
            <h2>Indicadores del trimestre</h2>
          </div>
          <RouterLink to="/estadisticas" class="text-link">Ver estadísticas completas →</RouterLink>
        </div>
        <div class="kpi-strip">
          <article v-for="kpi in kpis" :key="kpi.key" class="kpi-mini" :class="`kpi-mini--${kpi.estado}`">
            <div class="kpi-mini__head">
              <span class="kpi-mini__icon" aria-hidden="true">{{ kpi.icon }}</span>
              <span class="kpi-mini__status">
                {{ kpi.estado === 'na' ? 'Sin datos' : kpi.estado === 'ok' ? 'En meta' : 'Bajo meta' }}
              </span>
            </div>
            <p class="kpi-mini__value">{{ kpi.na ? 'N/A' : `${kpi.valor} %` }}</p>
            <p class="kpi-mini__label">{{ kpi.label }}</p>
            <p class="kpi-mini__detail">
              {{ kpi.na ? 'No hay datos suficientes para calcular el indicador' : `${kpi.parte} de ${kpi.total} · meta ${kpi.meta} %` }}
            </p>
            <div v-if="!kpi.na" class="progress-bar" :aria-label="`${kpi.valor} %`">
              <span :style="{ width: `${Math.min(kpi.valor, 100)}%` }"></span>
            </div>
          </article>
        </div>
      </section>

      <div class="dashboard-columns">
        <section class="panel role-panel">
          <div class="role-panel__header">
            <span class="role-panel__icon" aria-hidden="true">{{ roleData.icon }}</span>
            <div>
              <p class="eyebrow">Tu rol</p>
              <h2>{{ roleData.title }}</h2>
            </div>
          </div>
          <p class="role-panel__copy">{{ roleData.copy }}</p>
          <div class="role-panel__metrics">
            <div v-for="metric in roleData.metrics" :key="metric.label">
              <strong>{{ metric.value }}</strong>
              <span>{{ metric.label }}</span>
            </div>
          </div>
          <RouterLink :to="roleData.cta.to" class="btn btn-secondary">{{ roleData.cta.label }}</RouterLink>
        </section>

        <section class="panel">
          <div class="section-heading section-heading--tight">
            <div>
              <p class="eyebrow">Comunicación</p>
              <h2>Novedades</h2>
            </div>
            <RouterLink to="/avisos" class="text-link">Ver todas →</RouterLink>
          </div>
          <div v-if="latestAvisos.length" class="notice-list">
            <article v-for="aviso in latestAvisos" :key="aviso.id" class="notice-item">
              <div class="notice-item__meta">
                <span class="tag">{{ aviso.categoria }}</span>
                <span>{{ formatDate(aviso.createdAt) }}</span>
              </div>
              <h3>{{ aviso.titulo }}</h3>
              <p>{{ truncate(aviso.contenido, 130) }}</p>
            </article>
          </div>
          <EmptyState
            v-else
            icon="📣"
            title="No hay avisos publicados"
            text="La comisión de comunicación irá sumando novedades."
          />
        </section>
      </div>

      <section v-if="tareas.length" class="panel">
        <div class="section-heading section-heading--tight">
          <div>
            <p class="eyebrow">Organización</p>
            <h2>Mis tareas asignadas</h2>
          </div>
          <RouterLink to="/tareas" class="text-link">Ver todas →</RouterLink>
        </div>
        <div class="task-mini-list">
          <article v-for="tarea in tareas.slice(0, 3)" :key="tarea.id" class="task-mini">
            <div>
              <p class="task-mini__activity">{{ tarea.actividadTitulo }}</p>
              <h3>{{ tarea.titulo }}</h3>
              <p class="task-mini__due">
                Vence {{ formatDate(tarea.fechaLimite) }} · {{ relativeDate(tarea.fechaLimite) }}
              </p>
            </div>
            <StatusBadge kind="tarea" :estado="tarea.estado" />
          </article>
        </div>
      </section>
    </template>
  </div>
</template>
