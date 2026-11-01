<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { api } from '../services/api.js'
import { CONDICION_LABEL } from '../data/constants.js'
import { formatDate, formatDateTime } from '../data/utils.js'
import PageHeader from '../components/PageHeader.vue'
import ProgressSteps from '../components/ProgressSteps.vue'
import StatusBadge from '../components/StatusBadge.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import EmptyState from '../components/EmptyState.vue'

const route = useRoute()
const prestamo = ref(null)
const loading = ref(true)
const loadError = ref('')

const steps = ['Devolución avisada', 'Control', 'Disponible']
const aControlar = computed(() => prestamo.value?.condicion === 'a_controlar')
const stepIndex = computed(() => (aControlar.value ? 1 : 2))
const resultado = computed(() => {
  if (!prestamo.value) return ''
  if (aControlar.value) return 'Administración va a revisar el estado del útil antes de devolverlo al catálogo.'
  if (prestamo.value.condicion === 'buen_estado') return 'El útil fue revisado y vuelve al catálogo disponible.'
  if (prestamo.value.condicion === 'danado') return 'Se registró el daño. El útil quedó fuera del catálogo para revisión.'
  if (prestamo.value.condicion === 'en_reparacion') return 'El útil quedó en reparación y no se prestará hasta estar en condiciones.'
  if (prestamo.value.condicion === 'perdido') return 'Se registró la pérdida y se descontó del inventario disponible.'
  return ''
})

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    prestamo.value = await api.getPrestamo(route.params.id)
  } catch (error) {
    loadError.value = error.message
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <LoadingBlock v-if="loading" label="Cargando la devolución…" />

    <div v-else-if="loadError" class="panel">
      <EmptyState icon="↺" title="No pudimos abrir la devolución" :text="loadError">
        <RouterLink to="/mis-prestamos" class="btn btn-primary">Ir a Mis préstamos</RouterLink>
      </EmptyState>
    </div>

    <template v-else-if="prestamo">
      <PageHeader
        eyebrow="Confirmación de devolución"
        title="Devolución registrada"
        subtitle="Administración controla el útil y lo devuelve al catálogo si está en condiciones."
      />

      <div class="confirmation-layout">
        <section class="confirmation-card">
          <div class="confirmation-hero">
            <span class="confirmation-check" aria-hidden="true">↺</span>
            <div>
              <p class="eyebrow">Préstamo {{ prestamo.numero }}</p>
              <p class="confirmation-number">Devuelto, a controlar</p>
              <div class="confirmation-status">
                <StatusBadge v-if="aControlar" kind="prestamo" estado="a_controlar" />
                <StatusBadge v-else kind="prestamo" :estado="prestamo.estado" />
                <span>Avisado el {{ formatDateTime(prestamo.updatedAt || prestamo.fechaDevolucionReal) }}</span>
              </div>
            </div>
          </div>

          <ProgressSteps :steps="steps" :current="stepIndex" class="confirmation-steps" />

          <p class="confirmation-description">{{ resultado }}</p>

          <dl class="confirmation-details">
            <div>
              <dt>Útil</dt>
              <dd>{{ prestamo.utilNombre }} <span class="muted">({{ prestamo.utilCodigo }})</span></dd>
            </div>
            <div>
              <dt>Solicitud</dt>
              <dd>{{ prestamo.solicitudNumero }}</dd>
            </div>
            <div>
              <dt>Fecha de entrega</dt>
              <dd>{{ formatDate(prestamo.fechaEntrega) }}</dd>
            </div>
            <div>
              <dt>Fecha acordada</dt>
              <dd>{{ formatDate(prestamo.fechaAcordada) }}</dd>
            </div>
            <div>
              <dt>Devolución real</dt>
              <dd>{{ formatDate(prestamo.fechaDevolucionReal) }}</dd>
            </div>
            <div>
              <dt>Condición</dt>
              <dd>{{ prestamo.condicion ? CONDICION_LABEL[prestamo.condicion] : 'Pendiente de control' }}</dd>
            </div>
          </dl>

          <div class="confirmation-actions">
            <RouterLink to="/mis-prestamos" class="btn btn-primary">Volver a Mis préstamos</RouterLink>
            <RouterLink to="/catalogo" class="btn btn-secondary">Explorar catálogo</RouterLink>
          </div>
        </section>

        <aside class="confirmation-side">
          <section class="panel">
            <h2>Control de administración</h2>
            <p class="panel-lead">
              El útil no vuelve al catálogo automáticamente. La comisión de administración revisa su
              estado y registra una de estas posibilidades:
            </p>
            <ul class="status-options">
              <li>
                <StatusBadge label="Buen estado" tone="success" />
                <span>Se suma una unidad disponible.</span>
              </li>
              <li>
                <StatusBadge label="Dañado" tone="warning" />
                <span>Se registra el daño y se revisa.</span>
              </li>
              <li>
                <StatusBadge label="En reparación" tone="neutral" />
                <span>Queda fuera del catálogo hasta repararlo.</span>
              </li>
              <li>
                <StatusBadge label="Perdido" tone="danger" />
                <span>Se descuenta del inventario.</span>
              </li>
            </ul>
          </section>

          <section v-if="aControlar" class="panel side-note">
            <h3>Mientras esperás</h3>
            <p>
              No hace falta que hagas nada más. Si administración detecta un problema, se comunicará
              con vos. El plazo y el estado quedan registrados en el historial.
            </p>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>
