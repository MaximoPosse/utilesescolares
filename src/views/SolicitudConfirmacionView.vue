<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { api } from '../services/api.js'
import { useAuth } from '../stores/auth.js'
import { notify } from '../stores/toast.js'
import { formatDate, formatDateTime } from '../data/utils.js'
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'
import ProgressSteps from '../components/ProgressSteps.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import EmptyState from '../components/EmptyState.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const solicitud = ref(null)
const loading = ref(true)
const loadError = ref('')
const cancelOpen = ref(false)
const cancelling = ref(false)

const steps = ['Recibido', 'En revisión', 'Listo']
const stepIndex = computed(() => {
  if (!solicitud.value) return 0
  if (solicitud.value.estado === 'pendiente') return 1
  if (solicitud.value.estado === 'aprobada') return 2
  if (solicitud.value.estado === 'atendida') return 2
  return 0
})

const isCancelled = computed(() => ['rechazada', 'cancelada'].includes(solicitud.value?.estado))

const headline = computed(() => {
  const estado = solicitud.value?.estado
  if (estado === 'pendiente') return 'Solicitud recibida'
  if (estado === 'aprobada') return 'Solicitud aprobada'
  if (estado === 'atendida') return 'Útil entregado'
  if (estado === 'rechazada') return 'Solicitud rechazada'
  if (estado === 'cancelada') return 'Solicitud cancelada'
  return 'Solicitud'
})

const description = computed(() => {
  const estado = solicitud.value?.estado
  if (estado === 'pendiente') {
    return 'La comisión de administración va a revisar la disponibilidad y confirmar la entrega. Podés seguir el estado desde Mis préstamos.'
  }
  if (estado === 'aprobada') {
    return 'La solicitud está aprobada. Acercate al armario de la cooperativa para retirar el útil; administración registrará la entrega.'
  }
  if (estado === 'atendida') {
    return 'Administración registró la entrega. Ya podés usar el útil y devolverlo en la fecha acordada desde Mis préstamos.'
  }
  if (estado === 'rechazada') {
    return solicitud.value?.notaRevision || 'Administración no pudo atender esta solicitud.'
  }
  if (estado === 'cancelada') {
    return 'La solicitud fue cancelada por el estudiante. Se conserva en el historial.'
  }
  return ''
})

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    solicitud.value = await api.getSolicitud(route.params.id)
  } catch (error) {
    loadError.value = error.message
  } finally {
    loading.value = false
  }
}

async function cancelar() {
  cancelling.value = true
  try {
    await api.cancelarSolicitud(solicitud.value.id, auth.state.user?.id)
    notify('Solicitud cancelada. Queda registrada en tu historial.', 'success')
    cancelOpen.value = false
    router.push('/mis-prestamos')
  } catch (error) {
    notify(error.message, 'error')
  } finally {
    cancelling.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <LoadingBlock v-if="loading" label="Cargando la solicitud…" />

    <div v-else-if="loadError" class="panel">
      <EmptyState icon="🧾" title="No pudimos abrir la solicitud" :text="loadError">
        <RouterLink to="/mis-prestamos" class="btn btn-primary">Ir a Mis préstamos</RouterLink>
      </EmptyState>
    </div>

    <template v-else-if="solicitud">
      <PageHeader
        eyebrow="Confirmación de solicitud"
        :title="headline"
        subtitle="Guardá el número de solicitud para consultar el estado."
      />

      <div class="confirmation-layout">
        <section class="confirmation-card" :class="{ 'confirmation-card--muted': isCancelled }">
          <div class="confirmation-hero">
            <span class="confirmation-check" :class="{ 'confirmation-check--muted': isCancelled }" aria-hidden="true">
              {{ isCancelled ? '×' : '✓' }}
            </span>
            <div>
              <p class="eyebrow">Número de solicitud</p>
              <p class="confirmation-number">{{ solicitud.numero }}</p>
              <div class="confirmation-status">
                <StatusBadge kind="solicitud" :estado="solicitud.estado" />
                <span>Registrada el {{ formatDateTime(solicitud.createdAt) }}</span>
              </div>
            </div>
          </div>

          <ProgressSteps v-if="!isCancelled" :steps="steps" :current="stepIndex" class="confirmation-steps" />

          <p class="confirmation-description">{{ description }}</p>

          <dl class="confirmation-details">
            <div>
              <dt>Útil solicitado</dt>
              <dd>{{ solicitud.utilNombre }} <span class="muted">({{ solicitud.utilCodigo }})</span></dd>
            </div>
            <div>
              <dt>Solicitante</dt>
              <dd>{{ solicitud.solicitanteNombre }} · {{ solicitud.solicitanteCurso }}</dd>
            </div>
            <div>
              <dt>Fecha de solicitud</dt>
              <dd>{{ formatDate(solicitud.fechaSolicitud) }}</dd>
            </div>
            <div>
              <dt>Devolución acordada</dt>
              <dd>{{ formatDate(solicitud.fechaAcordada) }}</dd>
            </div>
            <div v-if="solicitud.motivo" class="confirmation-details__wide">
              <dt>Motivo</dt>
              <dd>{{ solicitud.motivo }}</dd>
            </div>
            <div class="confirmation-details__wide">
              <dt>Compromiso de devolución</dt>
              <dd>{{ solicitud.compromiso ? 'Aceptado por el estudiante' : 'No registrado' }}</dd>
            </div>
          </dl>

          <div class="confirmation-actions">
            <RouterLink to="/mis-prestamos" class="btn btn-primary">Ver mis préstamos</RouterLink>
            <RouterLink to="/catalogo" class="btn btn-secondary">Seguir explorando</RouterLink>
            <button
              v-if="solicitud.estado === 'pendiente'"
              type="button"
              class="btn btn-ghost"
              @click="cancelOpen = true"
            >
              Cancelar solicitud
            </button>
          </div>
        </section>

        <aside class="confirmation-side">
          <section class="panel">
            <h2>¿Qué sigue?</h2>
            <ol class="timeline">
              <li class="timeline__item timeline__item--done">
                <span class="timeline__dot" aria-hidden="true"></span>
                <div>
                  <h3>Solicitud recibida</h3>
                  <p>El sistema registró el pedido con el número {{ solicitud.numero }}.</p>
                </div>
              </li>
              <li class="timeline__item" :class="{ 'timeline__item--done': solicitud.estado !== 'pendiente' }">
                <span class="timeline__dot" aria-hidden="true"></span>
                <div>
                  <h3>Revisión de administración</h3>
                  <p>Se verifica la disponibilidad y se aprueba o rechaza la solicitud.</p>
                </div>
              </li>
              <li class="timeline__item" :class="{ 'timeline__item--done': ['aprobada', 'atendida'].includes(solicitud.estado) }">
                <span class="timeline__dot" aria-hidden="true"></span>
                <div>
                  <h3>Listo para retirar</h3>
                  <p>Coordinás la entrega y comienza el plazo de 7 días corridos.</p>
                </div>
              </li>
            </ol>
          </section>

          <section class="panel side-note">
            <h3>Recordá</h3>
            <p>
              La solicitud no descuenta stock hasta que administración registra la entrega.
              Si ya no necesitás el útil, cancelá la solicitud para liberar el pedido.
            </p>
          </section>
        </aside>
      </div>
    </template>

    <ConfirmDialog
      :open="cancelOpen"
      title="Cancelar la solicitud"
      message="La solicitud no se elimina: queda en estado cancelada dentro de tu historial. ¿Querés continuar?"
      confirm-label="Sí, cancelar"
      danger
      :loading="cancelling"
      @close="cancelOpen = false"
      @confirm="cancelar"
    />
  </div>
</template>
