<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuth } from '../stores/auth.js'
import { notify } from '../stores/toast.js'
import { api } from '../services/api.js'
import { TIPOS_UTIL } from '../data/constants.js'
import { addDays, diffDays, formatDate, todayISO } from '../data/utils.js'
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import EmptyState from '../components/EmptyState.vue'

const auth = useAuth()
const route = useRoute()
const router = useRouter()
const user = computed(() => auth.state.user)

const util = ref(null)
const loading = ref(true)
const loadError = ref('')
const submitting = ref(false)
const submitError = ref('')
const errors = reactive({})

const hoy = todayISO()
const maxDate = addDays(hoy, 7)

const form = reactive({
  fechaSolicitud: hoy,
  fechaAcordada: maxDate,
  motivo: '',
  compromiso: false,
})

const typeMeta = computed(() => TIPOS_UTIL.find((t) => t.value === util.value?.tipo))
const esPropio = computed(() => Boolean(util.value && util.value.duenoId === user.value?.id))
const puedeSolicitar = computed(() => Boolean(util.value?.disponible && !esPropio.value))
const plazo = computed(() => {
  const dias = diffDays(hoy, form.fechaAcordada)
  return dias === null ? null : dias
})

function validate() {
  Object.keys(errors).forEach((key) => delete errors[key])
  submitError.value = ''
  let ok = true
  if (!form.fechaAcordada) {
    errors.fechaAcordada = 'Elegí la fecha de devolución.'
    ok = false
  } else if (form.fechaAcordada < hoy) {
    errors.fechaAcordada = 'La fecha no puede ser anterior a hoy.'
    ok = false
  } else if (form.fechaAcordada > maxDate) {
    errors.fechaAcordada = 'El plazo máximo es de 7 días corridos.'
    ok = false
  }
  if (form.motivo.length > 280) {
    errors.motivo = 'El motivo no puede superar los 280 caracteres.'
    ok = false
  }
  if (!form.compromiso) {
    errors.compromiso = 'Tenés que aceptar el compromiso de devolución.'
    ok = false
  }
  return ok
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    util.value = await api.getUtil(route.params.id)
  } catch (error) {
    loadError.value = error.message
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (!validate()) return
  submitting.value = true
  try {
    const solicitud = await api.crearSolicitud({
      utilId: util.value.id,
      solicitanteId: user.value.id,
      fechaAcordada: form.fechaAcordada,
      motivo: form.motivo.trim(),
      compromiso: form.compromiso,
    }, user.value.id)
    notify('Solicitud enviada. Administración la va a revisar.', 'success')
    router.push(`/solicitud/${solicitud.id}/confirmacion`)
  } catch (error) {
    submitError.value = error.message
    notify(error.message, 'error')
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <nav class="breadcrumb" aria-label="Migas de pan">
      <RouterLink to="/catalogo">Catálogo</RouterLink>
      <span aria-hidden="true">/</span>
      <span>{{ util?.codigo || 'Detalle' }}</span>
    </nav>

    <LoadingBlock v-if="loading" label="Cargando la ficha del útil…" />

    <div v-else-if="loadError" class="panel">
      <EmptyState icon="📦" title="No pudimos abrir este útil" :text="loadError">
        <RouterLink to="/catalogo" class="btn btn-primary">Volver al catálogo</RouterLink>
      </EmptyState>
    </div>

    <template v-else-if="util">
      <PageHeader
        :eyebrow="util.tipo"
        :title="util.nombre"
        subtitle="Revisá la ficha y completá la solicitud. Administración aprueba y entrega el útil."
      >
        <template #actions>
          <StatusBadge kind="util" :estado="util.estado" />
        </template>
      </PageHeader>

      <div class="detail-layout">
        <div class="detail-main">
          <section class="detail-card">
            <div class="detail-visual" :class="`detail-visual--${util.tipo.toLowerCase()}`">
              <span class="detail-visual__icon" aria-hidden="true">{{ typeMeta?.icon || '📦' }}</span>
              <div class="detail-visual__copy">
                <span class="detail-visual__code">{{ util.codigo }}</span>
                <p>{{ typeMeta?.descripcion }}</p>
              </div>
              <StatusBadge kind="util" :estado="util.estado" />
            </div>

            <div class="detail-grid">
              <div class="detail-fact">
                <span class="detail-fact__label">Tipo de útil</span>
                <strong>{{ util.tipo }}</strong>
              </div>
              <div class="detail-fact">
                <span class="detail-fact__label">Disponibilidad</span>
                <strong>{{ util.cantidadDisponible }} de {{ util.cantidadTotal }} unidades</strong>
              </div>
              <div class="detail-fact">
                <span class="detail-fact__label">Donante / dueño</span>
                <strong>{{ util.duenoNombre }}</strong>
              </div>
              <div class="detail-fact">
                <span class="detail-fact__label">Origen</span>
                <strong>
                  {{ util.origen === 'donacion' ? 'Donación' : util.origen === 'intercambio' ? 'Intercambio' : 'Cooperativa' }}
                </strong>
              </div>
              <div class="detail-fact detail-fact--wide">
                <span class="detail-fact__label">Ubicación</span>
                <strong>{{ util.ubicacion }}</strong>
              </div>
              <div class="detail-fact detail-fact--wide">
                <span class="detail-fact__label">Observaciones</span>
                <strong>{{ util.observaciones || 'Sin observaciones.' }}</strong>
              </div>
            </div>
          </section>

          <section class="panel detail-steps">
            <div class="section-heading section-heading--tight">
              <div>
                <p class="eyebrow">Cómo funciona</p>
                <h2>De la solicitud a la devolución</h2>
              </div>
            </div>
            <div class="flow-grid">
              <article>
                <span class="flow-grid__number">1</span>
                <h3>Solicitás</h3>
                <p>Elegís la fecha de devolución, que no puede superar los 7 días corridos.</p>
              </article>
              <article>
                <span class="flow-grid__number">2</span>
                <h3>Administración revisa</h3>
                <p>Aprueba la solicitud y registra la entrega del útil.</p>
              </article>
              <article>
                <span class="flow-grid__number">3</span>
                <h3>Devolvés</h3>
                <p>Registrás la devolución desde Mis préstamos. Administración controla el estado.</p>
              </article>
            </div>
          </section>
        </div>

        <aside class="detail-side">
          <section class="panel request-panel">
            <p class="eyebrow">Solicitar préstamo</p>
            <h2>Completá la solicitud</h2>

            <div v-if="esPropio" class="alert alert--info">
              Este útil lo ofreciste vos. No podés solicitar tu propio útil, pero podés consultar su ficha.
            </div>
            <div v-else-if="!util.disponible" class="alert alert--warning">
              En este momento no hay unidades disponibles. Podés volver más tarde o pedir otro útil similar.
            </div>

            <form v-if="puedeSolicitar" class="form-stack" novalidate @submit.prevent="submit">
              <div class="field">
                <label for="solicitante">Estudiante</label>
                <input
                  id="solicitante"
                  class="input"
                  type="text"
                  :value="`${user.nombre} ${user.apellido} · ${user.curso}`"
                  readonly
                />
                <p class="hint">Se completa automáticamente con tu sesión.</p>
              </div>

              <div class="form-grid">
                <div class="field">
                  <label for="fecha-solicitud">Fecha de solicitud</label>
                  <input id="fecha-solicitud" class="input" type="date" :value="form.fechaSolicitud" readonly />
                </div>
                <div class="field">
                  <label for="fecha-devolucion">Fecha de devolución</label>
                  <input
                    id="fecha-devolucion"
                    v-model="form.fechaAcordada"
                    class="input"
                    type="date"
                    :min="hoy"
                    :max="maxDate"
                    :aria-invalid="Boolean(errors.fechaAcordada)"
                  />
                  <p v-if="errors.fechaAcordada" class="field-error">{{ errors.fechaAcordada }}</p>
                  <p v-else class="hint">
                    {{ plazo === null ? 'Elegí una fecha.' : plazo === 0 ? 'Devolución el mismo día.' : `${plazo} día${plazo === 1 ? '' : 's'} corrido${plazo === 1 ? '' : 's'} (máximo 7).` }}
                  </p>
                </div>
              </div>

              <div class="field">
                <label for="motivo">Motivo <span class="label-optional">(opcional)</span></label>
                <textarea
                  id="motivo"
                  v-model="form.motivo"
                  class="textarea"
                  rows="3"
                  maxlength="280"
                  placeholder="Ej.: lo necesito para la clase de Matemática del jueves."
                  :aria-invalid="Boolean(errors.motivo)"
                ></textarea>
                <div class="field-foot">
                  <p v-if="errors.motivo" class="field-error">{{ errors.motivo }}</p>
                  <span class="counter">{{ form.motivo.length }}/280</span>
                </div>
              </div>

              <label class="checkbox-row checkbox-row--top">
                <input v-model="form.compromiso" type="checkbox" />
                <span>
                  Me comprometo a devolverlo en la fecha acordada, en buen estado, y a avisar si se
                  pierde o se daña.
                </span>
              </label>
              <p v-if="errors.compromiso" class="field-error">{{ errors.compromiso }}</p>

              <div v-if="submitError" class="alert alert--error" role="alert">{{ submitError }}</div>

              <button class="btn btn-primary btn-block" type="submit" :disabled="submitting">
                <span v-if="submitting" class="spinner spinner--sm" aria-hidden="true"></span>
                {{ submitting ? 'Enviando solicitud…' : 'Enviar solicitud' }}
              </button>
              <p class="hint hint--center">No se descuenta stock hasta que administración entrega el útil.</p>
            </form>

            <div v-else class="request-panel__unavailable">
              <RouterLink to="/catalogo" class="btn btn-secondary btn-block">Ver otros útiles</RouterLink>
            </div>
          </section>

          <section class="panel side-note">
            <h3>Antes de pedir</h3>
            <ul class="check-list">
              <li>Plazo máximo: <strong>7 días corridos</strong>.</li>
              <li>Si no devolvés a tiempo, el préstamo figura como atrasado.</li>
              <li>Podés avisar pérdida o daño desde Mis préstamos.</li>
              <li>La devolución queda “a controlar” hasta que administración la revisa.</li>
            </ul>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>
