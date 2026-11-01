<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuth } from '../stores/auth.js'
import { notify } from '../stores/toast.js'
import { api, IS_DEMO } from '../services/api.js'
import {
  CONDICION_LABEL,
  TIPOS_UTIL,
} from '../data/constants.js'
import {
  diasAtraso,
  estadoPrestamoEfectivo,
  formatDate,
  formatDateTime,
  relativeDate,
} from '../data/utils.js'
import PageHeader from '../components/PageHeader.vue'
import StatCard from '../components/StatCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import EmptyState from '../components/EmptyState.vue'
import ModalDialog from '../components/ModalDialog.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const auth = useAuth()
const router = useRouter()
const user = computed(() => auth.state.user)

const loading = ref(true)
const loadError = ref('')
const solicitudes = ref([])
const prestamos = ref([])

const returnOpen = ref(false)
const returnTarget = ref(null)
const returning = ref(false)
const cancelOpen = ref(false)
const cancelTarget = ref(null)
const cancelling = ref(false)
const detailOpen = ref(false)
const detailTarget = ref(null)
const reportOpen = ref(false)
const reportTarget = ref(null)
const reporting = ref(false)
const reportError = ref('')
const reportForm = reactive({ tipo: 'danado', descripcion: '' })

const typeMeta = Object.fromEntries(TIPOS_UTIL.map((t) => [t.value, t]))

const enrichedPrestamos = computed(() =>
  prestamos.value.map((p) => ({
    ...p,
    estadoEfectivo: estadoPrestamoEfectivo(p),
    atraso: diasAtraso(p),
  })),
)

const activeLoans = computed(() =>
  enrichedPrestamos.value.filter((p) => p.estado === 'prestado'),
)
const overdueLoans = computed(() =>
  activeLoans.value.filter((p) => p.estadoEfectivo === 'atrasado'),
)
const returnedLoans = computed(() =>
  enrichedPrestamos.value.filter((p) => ['devuelto', 'perdido'].includes(p.estado)),
)
const activeRequests = computed(() =>
  solicitudes.value.filter((s) => ['pendiente', 'aprobada'].includes(s.estado)),
)
const otherRequests = computed(() =>
  solicitudes.value.filter((s) => ['rechazada', 'cancelada'].includes(s.estado)),
)

const detailTypeMeta = computed(() => {
  const tipo = detailTarget.value?.utilTipo
  return TIPOS_UTIL.find((t) => t.value === tipo)
})

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [sol, pres] = await Promise.all([
      api.listSolicitudes({ userId: user.value.id }),
      api.listPrestamos({ userId: user.value.id }),
    ])
    solicitudes.value = sol
    prestamos.value = pres
  } catch (error) {
    loadError.value = error.message
    notify(error.message, 'error')
  } finally {
    loading.value = false
  }
}

function openReturn(prestamo) {
  returnTarget.value = prestamo
  returnOpen.value = true
}

async function confirmReturn() {
  if (!returnTarget.value) return
  returning.value = true
  try {
    const result = await api.devolverPrestamo(returnTarget.value.id, user.value.id)
    returnOpen.value = false
    notify('Devolución avisada. Administración debe controlarla.', 'success')
    await nextTick()
    router.push(`/devolucion/${result.id}/confirmacion`)
  } catch (error) {
    notify(error.message, 'error')
  } finally {
    returning.value = false
  }
}

function openCancel(solicitud) {
  cancelTarget.value = solicitud
  cancelOpen.value = true
}

async function confirmCancel() {
  if (!cancelTarget.value) return
  cancelling.value = true
  try {
    await api.cancelarSolicitud(cancelTarget.value.id, user.value.id)
    notify('Solicitud cancelada. No se eliminó del historial.', 'success')
    cancelOpen.value = false
    await load()
  } catch (error) {
    notify(error.message, 'error')
  } finally {
    cancelling.value = false
  }
}

function openDetail(prestamo) {
  detailTarget.value = prestamo
  detailOpen.value = true
}

function openReport(prestamo) {
  reportTarget.value = prestamo
  reportForm.tipo = 'danado'
  reportForm.descripcion = ''
  reportError.value = ''
  reportOpen.value = true
}

async function submitReport() {
  reportError.value = ''
  if (reportForm.descripcion.trim().length < 10) {
    reportError.value = 'Contá brevemente qué pasó (mínimo 10 caracteres).'
    return
  }
  reporting.value = true
  try {
    await api.reportarProblema({
      prestamoId: reportTarget.value.id,
      actorId: user.value.id,
      tipo: reportForm.tipo,
      descripcion: reportForm.descripcion.trim(),
    })
    reportOpen.value = false
    notify('Aviso enviado a administración. El préstamo sigue activo hasta que lo revisen.', 'success')
  } catch (error) {
    reportError.value = error.message
    notify(error.message, 'error')
  } finally {
    reporting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Seguimiento"
      title="Mis préstamos"
      subtitle="Consultá solicitudes, vencimientos y devoluciones. Todo queda registrado para conservar el historial."
    >
      <template #actions>
        <span v-if="IS_DEMO" class="demo-badge">Datos de prueba</span>
        <RouterLink to="/catalogo" class="btn btn-primary">Pedir otro útil</RouterLink>
      </template>
    </PageHeader>

    <LoadingBlock v-if="loading" label="Cargando tus préstamos…" />

    <template v-else>
      <div v-if="loadError" class="alert alert--error">{{ loadError }}</div>

      <section class="stats-row stats-row--four" aria-label="Contadores de préstamos">
        <StatCard
          label="Pendientes"
          :value="solicitudes.filter((s) => s.estado === 'pendiente').length"
          hint="Solicitudes esperando aprobación"
          icon="⏳"
          tone="warning"
          compact
        />
        <StatCard
          label="Prestados"
          :value="activeLoans.length"
          hint="Préstamos activos en este momento"
          icon="↺"
          tone="info"
          compact
        />
        <StatCard
          label="Atrasados"
          :value="overdueLoans.length"
          hint="Pasaron la fecha acordada"
          icon="!"
          :tone="overdueLoans.length ? 'danger' : 'success'"
          compact
        />
        <StatCard
          label="Devueltos"
          :value="returnedLoans.filter((p) => p.estado === 'devuelto').length"
          hint="Incluye devoluciones a controlar"
          icon="✓"
          tone="success"
          compact
        />
      </section>

      <section class="panel">
        <div class="section-heading section-heading--tight">
          <div>
            <p class="eyebrow">Solicitudes</p>
            <h2>Pedidos en curso e historial</h2>
          </div>
          <RouterLink to="/catalogo" class="text-link">+ Nueva solicitud</RouterLink>
        </div>

        <div v-if="activeRequests.length" class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Útil</th>
                <th>Fechas</th>
                <th>Estado</th>
                <th class="cell-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="solicitud in activeRequests" :key="solicitud.id">
                <td data-label="Número"><strong>{{ solicitud.numero }}</strong></td>
                <td data-label="Útil">
                  <div class="cell-stack">
                    <strong>{{ solicitud.utilNombre }}</strong>
                    <small>{{ solicitud.utilCodigo }} · {{ solicitud.utilTipo }}</small>
                  </div>
                </td>
                <td data-label="Fechas">
                  <div class="cell-stack">
                    <span>Pedido: {{ formatDate(solicitud.fechaSolicitud) }}</span>
                    <small>Devolver: {{ formatDate(solicitud.fechaAcordada) }} ({{ relativeDate(solicitud.fechaAcordada) }})</small>
                  </div>
                </td>
                <td data-label="Estado">
                  <StatusBadge kind="solicitud" :estado="solicitud.estado" />
                  <small v-if="solicitud.estado === 'aprobada'" class="cell-note">Retirá el útil en administración.</small>
                </td>
                <td data-label="Acciones" class="cell-actions">
                  <RouterLink :to="`/solicitud/${solicitud.id}/confirmacion`" class="btn btn-sm btn-secondary">
                    Ver solicitud
                  </RouterLink>
                  <button
                    v-if="solicitud.estado === 'pendiente'"
                    class="btn btn-sm btn-ghost"
                    type="button"
                    @click="openCancel(solicitud)"
                  >
                    Cancelar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <EmptyState
          v-else
          icon="🧾"
          title="No tenés solicitudes en curso"
          text="Cuando pidas un útil, la solicitud aparece acá hasta que administración la revisa."
        >
          <RouterLink to="/catalogo" class="btn btn-primary">Explorar catálogo</RouterLink>
        </EmptyState>

        <details v-if="otherRequests.length" class="history-details">
          <summary>Ver solicitudes rechazadas o canceladas ({{ otherRequests.length }})</summary>
          <div class="simple-list">
            <article v-for="solicitud in otherRequests" :key="solicitud.id" class="simple-list__item">
              <div>
                <p class="simple-list__title">{{ solicitud.numero }} · {{ solicitud.utilNombre }}</p>
                <p class="simple-list__meta">
                  {{ formatDate(solicitud.fechaSolicitud) }} · {{ solicitud.notaRevision || 'Cancelada por el estudiante.' }}
                </p>
              </div>
              <div class="row-actions">
                <StatusBadge kind="solicitud" :estado="solicitud.estado" />
                <RouterLink :to="`/solicitud/${solicitud.id}/confirmacion`" class="text-link">Ver</RouterLink>
              </div>
            </article>
          </div>
        </details>
      </section>

      <section class="panel">
        <div class="section-heading section-heading--tight">
          <div>
            <p class="eyebrow">Préstamos</p>
            <h2>Útiles en tu poder</h2>
          </div>
          <span class="tag">{{ activeLoans.length }} activos</span>
        </div>

        <div v-if="activeLoans.length" class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Préstamo</th>
                <th>Útil</th>
                <th>Entrega / vence</th>
                <th>Estado</th>
                <th class="cell-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="prestamo in activeLoans" :key="prestamo.id">
                <td data-label="Préstamo"><strong>{{ prestamo.numero }}</strong><small class="block-note">Solicitud {{ prestamo.solicitudNumero }}</small></td>
                <td data-label="Útil">
                  <div class="cell-stack">
                    <strong>{{ prestamo.utilNombre }}</strong>
                    <small>{{ prestamo.utilCodigo }} · {{ prestamo.utilTipo }}</small>
                  </div>
                </td>
                <td data-label="Entrega / vence">
                  <div class="cell-stack">
                    <span>Entregado: {{ formatDate(prestamo.fechaEntrega) }}</span>
                    <small :class="{ 'text-danger': prestamo.estadoEfectivo === 'atrasado' }">
                      Vence: {{ formatDate(prestamo.fechaAcordada) }}
                      <template v-if="prestamo.estadoEfectivo === 'atrasado'"> · {{ prestamo.atraso }} día{{ prestamo.atraso === 1 ? '' : 's' }} de atraso</template>
                      <template v-else> · {{ relativeDate(prestamo.fechaAcordada) }}</template>
                    </small>
                  </div>
                </td>
                <td data-label="Estado">
                  <StatusBadge kind="prestamo" :estado="prestamo.estadoEfectivo" />
                </td>
                <td data-label="Acciones" class="cell-actions">
                  <button class="btn btn-sm btn-primary" type="button" @click="openReturn(prestamo)">
                    Devolver
                  </button>
                  <button class="btn btn-sm btn-secondary" type="button" @click="openReport(prestamo)">
                    Avisar pérdida o daño
                  </button>
                  <button class="btn btn-sm btn-ghost" type="button" @click="openDetail(prestamo)">
                    Ver detalle
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <EmptyState
          v-else
          icon="🎒"
          title="No tenés préstamos activos"
          text="Los útiles que retires aparecerán acá con su fecha de devolución."
        />

        <details v-if="returnedLoans.length" class="history-details" open>
          <summary>Historial de devoluciones ({{ returnedLoans.length }})</summary>
          <div class="simple-list">
            <article v-for="prestamo in returnedLoans" :key="prestamo.id" class="simple-list__item">
              <div>
                <p class="simple-list__title">{{ prestamo.numero }} · {{ prestamo.utilNombre }}</p>
                <p class="simple-list__meta">
                  Devuelto el {{ formatDate(prestamo.fechaDevolucionReal) }}
                  <template v-if="prestamo.condicion"> · {{ CONDICION_LABEL[prestamo.condicion] }}</template>
                  <template v-if="prestamo.atraso"> · {{ prestamo.atraso }} día{{ prestamo.atraso === 1 ? '' : 's' }} de atraso</template>
                </p>
              </div>
              <div class="row-actions">
                <StatusBadge
                  v-if="prestamo.condicion === 'a_controlar'"
                  kind="prestamo"
                  estado="a_controlar"
                />
                <StatusBadge v-else kind="prestamo" :estado="prestamo.estado" />
                <button class="text-link" type="button" @click="openDetail(prestamo)">Ver detalle</button>
              </div>
            </article>
          </div>
        </details>
      </section>
    </template>

    <ConfirmDialog
      :open="returnOpen"
      title="Registrar devolución"
      :message="returnTarget
        ? `Vas a avisar la devolución de “${returnTarget.utilNombre}” (${returnTarget.numero}). Quedará en estado “Devuelto, a controlar” hasta que administración lo revise.`
        : ''"
      confirm-label="Sí, avisar devolución"
      :loading="returning"
      @close="returnOpen = false"
      @confirm="confirmReturn"
    />

    <ConfirmDialog
      :open="cancelOpen"
      title="Cancelar solicitud"
      :message="cancelTarget
        ? `La solicitud ${cancelTarget.numero} por “${cancelTarget.utilNombre}” quedará cancelada. No se elimina del historial.`
        : ''"
      confirm-label="Sí, cancelar solicitud"
      danger
      :loading="cancelling"
      @close="cancelOpen = false"
      @confirm="confirmCancel"
    />

    <ModalDialog
      :open="detailOpen"
      :title="detailTarget ? `Préstamo ${detailTarget.numero}` : 'Detalle del préstamo'"
      subtitle="Información registrada de tu préstamo"
      @close="detailOpen = false"
    >
      <template v-if="detailTarget">
        <div class="detail-modal-hero">
          <span class="detail-modal-icon" aria-hidden="true">{{ typeMeta[detailTarget.utilTipo]?.icon || '📦' }}</span>
          <div>
            <h3>{{ detailTarget.utilNombre }}</h3>
            <p>{{ detailTarget.utilCodigo }} · {{ detailTarget.utilTipo }}</p>
          </div>
          <StatusBadge kind="prestamo" :estado="detailTarget.estadoEfectivo" />
        </div>
        <dl class="detail-modal-list">
          <div><dt>Solicitud</dt><dd>{{ detailTarget.solicitudNumero }}</dd></div>
          <div><dt>Fecha de entrega</dt><dd>{{ formatDate(detailTarget.fechaEntrega) }}</dd></div>
          <div><dt>Devolución acordada</dt><dd>{{ formatDate(detailTarget.fechaAcordada) }}</dd></div>
          <div><dt>Devolución real</dt><dd>{{ detailTarget.fechaDevolucionReal ? formatDate(detailTarget.fechaDevolucionReal) : 'Pendiente' }}</dd></div>
          <div><dt>Condición al devolver</dt><dd>{{ detailTarget.condicion ? CONDICION_LABEL[detailTarget.condicion] : '—' }}</dd></div>
          <div><dt>Días de atraso</dt><dd>{{ detailTarget.atraso }}</dd></div>
          <div class="detail-modal-list__wide"><dt>Registrado</dt><dd>{{ formatDateTime(detailTarget.createdAt) }}</dd></div>
        </dl>
        <div v-if="detailTarget.condicion === 'a_controlar'" class="alert alert--warning">
          La devolución fue avisada. Administración todavía debe controlar el estado del útil.
        </div>
      </template>
      <template #footer>
        <button class="btn btn-secondary" type="button" @click="detailOpen = false">Cerrar</button>
      </template>
    </ModalDialog>

    <ModalDialog
      :open="reportOpen"
      title="Avisar pérdida o daño"
      subtitle="Administración recibirá el aviso y coordinará qué hacer."
      size="sm"
      @close="reportOpen = false"
    >
      <form id="report-form" class="form-stack" novalidate @submit.prevent="submitReport">
        <div class="field">
          <label for="report-tipo">¿Qué pasó?</label>
          <select id="report-tipo" v-model="reportForm.tipo" class="select">
            <option value="danado">El útil se dañó</option>
            <option value="perdido">Perdí el útil</option>
          </select>
        </div>
        <div class="field">
          <label for="report-descripcion">Contanos qué pasó</label>
          <textarea
            id="report-descripcion"
            v-model="reportForm.descripcion"
            class="textarea"
            rows="4"
            maxlength="300"
            placeholder="Ej.: la regla se quebró cuando se cayó la cartuchera."
          ></textarea>
          <div class="field-foot">
            <p v-if="reportError" class="field-error">{{ reportError }}</p>
            <span class="counter">{{ reportForm.descripcion.length }}/300</span>
          </div>
        </div>
        <div class="alert alert--info">
          También podés registrar la devolución y explicar el problema; administración hará el control final.
        </div>
      </form>
      <template #footer>
        <button class="btn btn-secondary" type="button" :disabled="reporting" @click="reportOpen = false">Volver</button>
        <button class="btn btn-primary" type="submit" form="report-form" :disabled="reporting">
          <span v-if="reporting" class="spinner spinner--sm" aria-hidden="true"></span>
          {{ reporting ? 'Enviando…' : 'Enviar aviso' }}
        </button>
      </template>
    </ModalDialog>
  </div>
</template>
