<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuth } from '../stores/auth.js'
import { notify } from '../stores/toast.js'
import { api, IS_DEMO } from '../services/api.js'
import { CONDICIONES_DEVOLUCION } from '../data/constants.js'
import {
  diasAtraso,
  estadoPrestamoEfectivo,
  formatDate,
  formatDateTime,
  todayISO,
} from '../data/utils.js'
import PageHeader from '../components/PageHeader.vue'
import StatCard from '../components/StatCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import EmptyState from '../components/EmptyState.vue'
import ModalDialog from '../components/ModalDialog.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const auth = useAuth()
const user = computed(() => auth.state.user)

const loading = ref(true)
const loadError = ref('')
const tab = ref('solicitudes')
const workingId = ref('')

const solicitudes = ref([])
const prestamos = ref([])
const ofertas = ref([])
const reportes = ref([])

const rejectOpen = ref(false)
const rejectTarget = ref(null)
const rejectNote = ref('')
const rejectError = ref('')
const rejecting = ref(false)

const controlOpen = ref(false)
const controlTarget = ref(null)
const controlForm = reactive({ condicion: 'buen_estado' })
const controlError = ref('')
const controlling = ref(false)

const acceptOpen = ref(false)
const acceptTarget = ref(null)
const accepting = ref(false)

const tabs = computed(() => [
  { key: 'solicitudes', label: 'Solicitudes', count: pendientes.value.length + aprobadas.value.length },
  { key: 'prestamos', label: 'Préstamos activos', count: prestamosActivos.value.length },
  { key: 'devoluciones', label: 'Devoluciones a controlar', count: aControlar.value.length },
  { key: 'ofertas', label: 'Ofertas', count: ofertasPendientes.value.length },
  { key: 'reportes', label: 'Avisos de daño', count: reportesPendientes.value.length },
])

const pendientes = computed(() => solicitudes.value.filter((s) => s.estado === 'pendiente'))
const aprobadas = computed(() => solicitudes.value.filter((s) => s.estado === 'aprobada'))
const atendidas = computed(() => solicitudes.value.filter((s) => s.estado === 'atendida'))
const rechazadas = computed(() => solicitudes.value.filter((s) => s.estado === 'rechazada'))

const prestamosEnriquecidos = computed(() =>
  prestamos.value.map((p) => ({
    ...p,
    estadoEfectivo: estadoPrestamoEfectivo(p),
    atraso: diasAtraso(p),
  })),
)
const prestamosActivos = computed(() =>
  prestamosEnriquecidos.value.filter((p) => p.estado === 'prestado'),
)
const aControlar = computed(() =>
  prestamosEnriquecidos.value.filter((p) => p.estado === 'devuelto' && p.condicion === 'a_controlar'),
)
const ofertasPendientes = computed(() => ofertas.value.filter((o) => o.estado === 'pendiente'))
const reportesPendientes = computed(() => reportes.value.filter((r) => r.estado === 'pendiente'))

const operacion = computed(() => ({
  pendientes: pendientes.value.length,
  aprobadas: aprobadas.value.length,
  activos: prestamosActivos.value.length,
  atrasados: prestamosActivos.value.filter((p) => p.estadoEfectivo === 'atrasado').length,
  controlar: aControlar.value.length,
  ofertas: ofertasPendientes.value.length,
}))

const ofertasHistorial = computed(() =>
  ofertas.value.filter((o) => o.estado !== 'pendiente').slice(0, 12),
)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [sol, pres, ofe, rep] = await Promise.all([
      api.listSolicitudes({ all: true }),
      api.listPrestamos({ all: true }),
      api.listOfertas({ all: true }),
      api.listReportes(),
    ])
    solicitudes.value = sol
    prestamos.value = pres
    ofertas.value = ofe
    reportes.value = rep
  } catch (error) {
    loadError.value = error.message
    notify(error.message, 'error')
  } finally {
    loading.value = false
  }
}

async function runAction(id, action, successMessage) {
  workingId.value = id
  try {
    await action()
    notify(successMessage, 'success')
    await load()
    return true
  } catch (error) {
    notify(error.message, 'error')
    return false
  } finally {
    workingId.value = ''
  }
}

function aprobar(solicitud) {
  return runAction(
    solicitud.id,
    () => api.aprobarSolicitud(solicitud.id, user.value.id),
    `Solicitud ${solicitud.numero} aprobada.`,
  )
}

function entregar(solicitud) {
  return runAction(
    solicitud.id,
    () => api.entregarSolicitud(solicitud.id, user.value.id),
    `Entrega registrada para ${solicitud.numero}. El plazo de devolución empezó a correr.`,
  )
}

function openReject(solicitud) {
  rejectTarget.value = solicitud
  rejectNote.value = ''
  rejectError.value = ''
  rejectOpen.value = true
}

async function confirmReject() {
  if (!rejectTarget.value) return
  if (rejectNote.value.trim().length < 5) {
    rejectError.value = 'Escribí una nota breve para explicar el rechazo (mínimo 5 caracteres).'
    return
  }
  rejecting.value = true
  try {
    await api.rechazarSolicitud(rejectTarget.value.id, user.value.id, rejectNote.value.trim())
    notify(`Solicitud ${rejectTarget.value.numero} rechazada.`, 'success')
    rejectOpen.value = false
    await load()
  } catch (error) {
    rejectError.value = error.message
    notify(error.message, 'error')
  } finally {
    rejecting.value = false
  }
}

function openControl(prestamo) {
  controlTarget.value = prestamo
  controlForm.condicion = 'buen_estado'
  controlError.value = ''
  controlOpen.value = true
}

async function confirmControl() {
  if (!controlTarget.value) return
  controlling.value = true
  try {
    await api.controlarDevolucion({
      prestamoId: controlTarget.value.id,
      condicion: controlForm.condicion,
      actorId: user.value.id,
    })
    notify('Control de devolución registrado. El inventario quedó actualizado.', 'success')
    controlOpen.value = false
    await load()
  } catch (error) {
    controlError.value = error.message
    notify(error.message, 'error')
  } finally {
    controlling.value = false
  }
}

function openAccept(oferta) {
  acceptTarget.value = oferta
  acceptOpen.value = true
}

async function confirmAccept() {
  if (!acceptTarget.value) return
  accepting.value = true
  try {
    await api.aceptarOferta(acceptTarget.value.id, user.value.id)
    notify('Oferta aceptada. El útil ya está publicado en el catálogo.', 'success')
    acceptOpen.value = false
    await load()
  } catch (error) {
    notify(error.message, 'error')
  } finally {
    accepting.value = false
  }
}

function rechazarOferta(oferta) {
  return runAction(
    oferta.id,
    () => api.rechazarOferta(oferta.id, user.value.id),
    `Oferta “${oferta.nombre}” rechazada.`,
  )
}

onMounted(load)
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Comisión de administración"
      title="Gestión de préstamos"
      subtitle="Revisá solicitudes, registrá entregas y controlá las devoluciones. Los útiles dañados o perdidos salen del catálogo hasta resolverse."
    >
      <template #actions>
        <span v-if="IS_DEMO" class="demo-badge">Datos de prueba</span>
        <RouterLink to="/inventario" class="btn btn-secondary">Ir al inventario</RouterLink>
      </template>
    </PageHeader>

    <LoadingBlock v-if="loading" label="Cargando la gestión de préstamos…" />
    <div v-else-if="loadError" class="alert alert--error">{{ loadError }}</div>

    <template v-else>
      <section class="stats-row stats-row--four" aria-label="Resumen de gestión">
        <StatCard label="Solicitudes pendientes" :value="operacion.pendientes" hint="Esperando revisión" icon="⏳" tone="warning" />
        <StatCard label="Préstamos activos" :value="operacion.activos" :hint="`${operacion.atrasados} atrasados`" icon="↺" :tone="operacion.atrasados ? 'danger' : 'info'" />
        <StatCard label="A controlar" :value="operacion.controlar" hint="Devoluciones avisadas" icon="⌕" tone="info" />
        <StatCard label="Ofertas pendientes" :value="operacion.ofertas" hint="Donaciones o intercambios" icon="＋" tone="neutral" />
      </section>

      <nav class="tab-bar" aria-label="Secciones de gestión">
        <button
          v-for="item in tabs"
          :key="item.key"
          type="button"
          class="tab-pill"
          :class="{ 'tab-pill--active': tab === item.key }"
          @click="tab = item.key"
        >
          {{ item.label }}
          <span class="tab-pill__count">{{ item.count }}</span>
        </button>
      </nav>

      <section v-if="tab === 'solicitudes'" class="panel">
        <div class="section-heading section-heading--tight">
          <div>
            <p class="eyebrow">Bandeja de entrada</p>
            <h2>Solicitudes por revisar</h2>
          </div>
          <span class="tag">{{ pendientes.length }} pendientes · {{ aprobadas.length }} aprobadas</span>
        </div>

        <div v-if="pendientes.length || aprobadas.length" class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Estudiante</th>
                <th>Útil</th>
                <th>Fechas</th>
                <th>Estado</th>
                <th class="cell-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="solicitud in [...pendientes, ...aprobadas]" :key="solicitud.id">
                <td data-label="Número"><strong>{{ solicitud.numero }}</strong><small class="block-note">{{ formatDate(solicitud.fechaSolicitud) }}</small></td>
                <td data-label="Estudiante">
                  <div class="cell-stack">
                    <strong>{{ solicitud.solicitanteNombre }}</strong>
                    <small>{{ solicitud.solicitanteCurso }}</small>
                  </div>
                </td>
                <td data-label="Útil">
                  <div class="cell-stack">
                    <strong>{{ solicitud.utilNombre }}</strong>
                    <small>{{ solicitud.utilCodigo }} · {{ solicitud.utilTipo }}</small>
                  </div>
                </td>
                <td data-label="Fechas">
                  <div class="cell-stack">
                    <span>Devolver: {{ formatDate(solicitud.fechaAcordada) }}</span>
                    <small v-if="solicitud.motivo">{{ solicitud.motivo }}</small>
                  </div>
                </td>
                <td data-label="Estado"><StatusBadge kind="solicitud" :estado="solicitud.estado" /></td>
                <td data-label="Acciones" class="cell-actions">
                  <template v-if="solicitud.estado === 'pendiente'">
                    <button class="btn btn-sm btn-primary" type="button" :disabled="workingId === solicitud.id" @click="aprobar(solicitud)">
                      Aprobar
                    </button>
                    <button class="btn btn-sm btn-ghost" type="button" :disabled="workingId === solicitud.id" @click="openReject(solicitud)">
                      Rechazar
                    </button>
                  </template>
                  <button
                    v-else
                    class="btn btn-sm btn-primary"
                    type="button"
                    :disabled="workingId === solicitud.id"
                    @click="entregar(solicitud)"
                  >
                    Registrar entrega
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <EmptyState
          v-else
          icon="✅"
          title="No hay solicitudes por revisar"
          text="Cuando un estudiante pida un útil, la solicitud va a aparecer acá."
        />

        <details v-if="atendidas.length || rechazadas.length" class="history-details">
          <summary>Ver historial de solicitudes cerradas ({{ atendidas.length + rechazadas.length }})</summary>
          <div class="simple-list">
            <article v-for="solicitud in [...atendidas, ...rechazadas].slice(0, 20)" :key="solicitud.id" class="simple-list__item">
              <div>
                <p class="simple-list__title">{{ solicitud.numero }} · {{ solicitud.utilNombre }}</p>
                <p class="simple-list__meta">
                  {{ solicitud.solicitanteNombre }} · {{ formatDate(solicitud.fechaSolicitud) }}
                  <template v-if="solicitud.notaRevision"> · {{ solicitud.notaRevision }}</template>
                </p>
              </div>
              <StatusBadge kind="solicitud" :estado="solicitud.estado" />
            </article>
          </div>
        </details>
      </section>

      <section v-if="tab === 'prestamos'" class="panel">
        <div class="section-heading section-heading--tight">
          <div>
            <p class="eyebrow">En la calle</p>
            <h2>Préstamos activos</h2>
          </div>
          <span class="tag">{{ prestamosActivos.length }} activos · {{ operacion.atrasados }} atrasados</span>
        </div>

        <div v-if="prestamosActivos.length" class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Préstamo</th>
                <th>Estudiante</th>
                <th>Útil</th>
                <th>Entrega / vence</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="prestamo in prestamosActivos" :key="prestamo.id">
                <td data-label="Préstamo"><strong>{{ prestamo.numero }}</strong><small class="block-note">{{ prestamo.solicitudNumero }}</small></td>
                <td data-label="Estudiante">
                  <div class="cell-stack">
                    <strong>{{ prestamo.estudianteNombre }}</strong>
                    <small>{{ prestamo.estudianteCurso }}</small>
                  </div>
                </td>
                <td data-label="Útil">
                  <div class="cell-stack">
                    <strong>{{ prestamo.utilNombre }}</strong>
                    <small>{{ prestamo.utilCodigo }}</small>
                  </div>
                </td>
                <td data-label="Entrega / vence">
                  <div class="cell-stack">
                    <span>Entregado: {{ formatDate(prestamo.fechaEntrega) }}</span>
                    <small :class="{ 'text-danger': prestamo.estadoEfectivo === 'atrasado' }">
                      Vence: {{ formatDate(prestamo.fechaAcordada) }}
                      <template v-if="prestamo.estadoEfectivo === 'atrasado'"> · {{ prestamo.atraso }} día{{ prestamo.atraso === 1 ? '' : 's' }} de atraso</template>
                    </small>
                  </div>
                </td>
                <td data-label="Estado"><StatusBadge kind="prestamo" :estado="prestamo.estadoEfectivo" /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <EmptyState
          v-else
          icon="🎒"
          title="No hay préstamos activos"
          text="Los préstamos aparecen cuando administración registra la entrega de una solicitud aprobada."
        />
      </section>

      <section v-if="tab === 'devoluciones'" class="panel">
        <div class="section-heading section-heading--tight">
          <div>
            <p class="eyebrow">Control de estado</p>
            <h2>Devoluciones avisadas</h2>
          </div>
          <span class="tag">{{ aControlar.length }} a controlar</span>
        </div>

        <div v-if="aControlar.length" class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Préstamo</th>
                <th>Estudiante</th>
                <th>Útil</th>
                <th>Devolución</th>
                <th class="cell-right">Control</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="prestamo in aControlar" :key="prestamo.id">
                <td data-label="Préstamo"><strong>{{ prestamo.numero }}</strong></td>
                <td data-label="Estudiante">
                  <div class="cell-stack">
                    <strong>{{ prestamo.estudianteNombre }}</strong>
                    <small>{{ prestamo.estudianteCurso }}</small>
                  </div>
                </td>
                <td data-label="Útil">
                  <div class="cell-stack">
                    <strong>{{ prestamo.utilNombre }}</strong>
                    <small>{{ prestamo.utilCodigo }}</small>
                  </div>
                </td>
                <td data-label="Devolución">
                  <div class="cell-stack">
                    <span>{{ formatDate(prestamo.fechaDevolucionReal) }}</span>
                    <small :class="{ 'text-danger': prestamo.atraso }">
                      {{ prestamo.atraso ? `${prestamo.atraso} día${prestamo.atraso === 1 ? '' : 's'} de atraso` : 'En plazo' }}
                    </small>
                  </div>
                </td>
                <td data-label="Control" class="cell-actions">
                  <button class="btn btn-sm btn-primary" type="button" @click="openControl(prestamo)">
                    Registrar control
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <EmptyState
          v-else
          icon="🔎"
          title="No hay devoluciones pendientes de control"
          text="Cuando un estudiante avise una devolución, aparecerá acá para revisar el estado del útil."
        />
      </section>

      <section v-if="tab === 'ofertas'" class="panel">
        <div class="section-heading section-heading--tight">
          <div>
            <p class="eyebrow">Donaciones e intercambios</p>
            <h2>Ofertas por revisar</h2>
          </div>
          <span class="tag">{{ ofertasPendientes.length }} pendientes</span>
        </div>

        <div v-if="ofertasPendientes.length" class="offer-list">
          <article v-for="oferta in ofertasPendientes" :key="oferta.id" class="offer-item">
            <span class="offer-item__icon" aria-hidden="true">🎁</span>
            <div class="offer-item__body">
              <div class="offer-item__title">
                <h3>{{ oferta.nombre }}</h3>
                <StatusBadge kind="oferta" :estado="oferta.estado" />
              </div>
              <p>{{ oferta.descripcion }}</p>
              <div class="offer-item__meta">
                <span class="tag">{{ oferta.tipo }}</span>
                <span class="tag">{{ oferta.modalidad === 'donacion' ? 'Donación' : 'Intercambio' }}</span>
                <span>Ofrecido por {{ oferta.oferenteNombre }} · {{ oferta.oferenteCurso }}</span>
              </div>
            </div>
            <div class="row-actions">
              <button class="btn btn-sm btn-primary" type="button" @click="openAccept(oferta)">Aceptar</button>
              <button class="btn btn-sm btn-ghost" type="button" :disabled="workingId === oferta.id" @click="rechazarOferta(oferta)">
                Rechazar
              </button>
            </div>
          </article>
        </div>
        <EmptyState
          v-else
          icon="📦"
          title="No hay ofertas pendientes"
          text="Las donaciones e intercambios enviados por estudiantes se revisan en esta sección."
        />

        <details v-if="ofertasHistorial.length" class="history-details">
          <summary>Ver ofertas revisadas ({{ ofertasHistorial.length }})</summary>
          <div class="simple-list">
            <article v-for="oferta in ofertasHistorial" :key="oferta.id" class="simple-list__item">
              <div>
                <p class="simple-list__title">{{ oferta.nombre }}</p>
                <p class="simple-list__meta">{{ oferta.oferenteNombre }} · {{ formatDate(oferta.createdAt) }}</p>
              </div>
              <StatusBadge kind="oferta" :estado="oferta.estado" />
            </article>
          </div>
        </details>
      </section>

      <section v-if="tab === 'reportes'" class="panel">
        <div class="section-heading section-heading--tight">
          <div>
            <p class="eyebrow">Pérdidas y daños</p>
            <h2>Avisos de estudiantes</h2>
          </div>
          <span class="tag">{{ reportesPendientes.length }} pendientes</span>
        </div>

        <div v-if="reportes.length" class="report-list">
          <article v-for="reporte in reportes" :key="reporte.id" class="report-item" :class="{ 'report-item--resolved': reporte.estado === 'resuelto' }">
            <div class="report-item__head">
              <div>
                <p class="report-item__title">
                  {{ reporte.tipo === 'perdido' ? 'Pérdida informada' : 'Daño informado' }}
                  <span class="muted">· {{ reporte.prestamo?.numero || 'Préstamo' }}</span>
                </p>
                <p class="report-item__meta">
                  {{ reporte.reportadoPorNombre }} · {{ formatDateTime(reporte.createdAt) }}
                </p>
              </div>
              <StatusBadge kind="reporte" :estado="reporte.estado" />
            </div>
            <p class="report-item__description">{{ reporte.descripcion }}</p>
            <div class="report-item__footer">
              <span class="hint">
                Útil: {{ reporte.prestamo?.utilNombre || '—' }} ·
                {{ reporte.prestamo?.estudianteNombre || '—' }}
              </span>
              <RouterLink
                v-if="reporte.estado === 'pendiente' && reporte.prestamo"
                :to="`/devolucion/${reporte.prestamo.id}/confirmacion`"
                class="text-link"
              >
                Ver devolución vinculada →
              </RouterLink>
            </div>
          </article>
        </div>
        <EmptyState
          v-else
          icon="⚠️"
          title="No hay avisos de pérdida o daño"
          text="Los avisos enviados por estudiantes aparecen acá para que administración los revise."
        />
      </section>
    </template>

    <ModalDialog
      :open="rejectOpen"
      title="Rechazar solicitud"
      subtitle="La solicitud queda en el historial con la nota que escribas."
      size="sm"
      @close="rejectOpen = false"
    >
      <form id="reject-form" class="form-stack" novalidate @submit.prevent="confirmReject">
        <p v-if="rejectTarget" class="confirm-message">
          Solicitud <strong>{{ rejectTarget.numero }}</strong> de {{ rejectTarget.solicitanteNombre }}
          por “{{ rejectTarget.utilNombre }}”.
        </p>
        <div class="field">
          <label for="reject-note">Nota para el estudiante</label>
          <textarea
            id="reject-note"
            v-model="rejectNote"
            class="textarea"
            rows="3"
            maxlength="300"
            placeholder="Ej.: no hay unidades disponibles en este momento."
          ></textarea>
          <p v-if="rejectError" class="field-error">{{ rejectError }}</p>
        </div>
      </form>
      <template #footer>
        <button class="btn btn-secondary" type="button" :disabled="rejecting" @click="rejectOpen = false">Volver</button>
        <button class="btn btn-danger" type="submit" form="reject-form" :disabled="rejecting">
          <span v-if="rejecting" class="spinner spinner--sm" aria-hidden="true"></span>
          {{ rejecting ? 'Rechazando…' : 'Rechazar solicitud' }}
        </button>
      </template>
    </ModalDialog>

    <ModalDialog
      :open="controlOpen"
      title="Controlar devolución"
      subtitle="La condición define si el útil vuelve al catálogo y cómo se actualiza el inventario."
      @close="controlOpen = false"
    >
      <form id="control-form" class="form-stack" novalidate @submit.prevent="confirmControl">
        <div v-if="controlTarget" class="detail-modal-hero">
          <span class="detail-modal-icon" aria-hidden="true">📦</span>
          <div>
            <h3>{{ controlTarget.utilNombre }}</h3>
            <p>{{ controlTarget.numero }} · {{ controlTarget.estudianteNombre }}</p>
          </div>
        </div>

        <fieldset class="field">
          <legend>Condición al recibir</legend>
          <div class="choice-grid choice-grid--stack">
            <label
              v-for="condicion in CONDICIONES_DEVOLUCION"
              :key="condicion.value"
              class="choice-card"
              :class="{ 'choice-card--selected': controlForm.condicion === condicion.value }"
            >
              <input v-model="controlForm.condicion" type="radio" name="condicion" :value="condicion.value" />
              <strong>{{ condicion.label }}</strong>
              <span>{{ condicion.descripcion }}</span>
            </label>
          </div>
        </fieldset>

        <div class="alert alert--info">
          Fecha de control: {{ formatDate(todayISO()) }}. El estudiante no puede modificar esta decisión.
        </div>
        <div v-if="controlError" class="alert alert--error">{{ controlError }}</div>
      </form>
      <template #footer>
        <button class="btn btn-secondary" type="button" :disabled="controlling" @click="controlOpen = false">Cancelar</button>
        <button class="btn btn-primary" type="submit" form="control-form" :disabled="controlling">
          <span v-if="controlling" class="spinner spinner--sm" aria-hidden="true"></span>
          {{ controlling ? 'Guardando…' : 'Guardar control' }}
        </button>
      </template>
    </ModalDialog>

    <ConfirmDialog
      :open="acceptOpen"
      title="Aceptar oferta"
      :message="acceptTarget
        ? `“${acceptTarget.nombre}” se publicará en el catálogo como una unidad disponible. La persona que la ofreció queda registrada como donante.`
        : ''"
      confirm-label="Sí, publicar en el catálogo"
      :loading="accepting"
      @close="acceptOpen = false"
      @confirm="confirmAccept"
    />
  </div>
</template>
