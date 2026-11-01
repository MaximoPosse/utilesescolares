<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuth } from '../stores/auth.js'
import { notify } from '../stores/toast.js'
import { api, IS_DEMO } from '../services/api.js'
import { MODALIDADES_OFERTA, TIPO_UTIL_OPTIONS, TIPOS_UTIL } from '../data/constants.js'
import { formatDate } from '../data/utils.js'
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import EmptyState from '../components/EmptyState.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const auth = useAuth()
const user = computed(() => auth.state.user)

const ofertas = ref([])
const loading = ref(true)
const loadError = ref('')
const submitting = ref(false)
const submitError = ref('')
const errors = reactive({})
const cancelOpen = ref(false)
const cancelTarget = ref(null)
const cancelling = ref(false)

const form = reactive({
  nombre: '',
  tipo: '',
  modalidad: 'donacion',
  descripcion: '',
})

const typeMeta = Object.fromEntries(TIPOS_UTIL.map((t) => [t.value, t]))

const modalidadLabel = computed(() => {
  const found = MODALIDADES_OFERTA.find((m) => m.value === form.modalidad)
  return found?.label || ''
})

function validate() {
  Object.keys(errors).forEach((key) => delete errors[key])
  submitError.value = ''
  let ok = true
  if (!form.nombre.trim()) {
    errors.nombre = 'Ingresá el nombre del útil.'
    ok = false
  } else if (form.nombre.trim().length < 3) {
    errors.nombre = 'El nombre debe tener al menos 3 caracteres.'
    ok = false
  }
  if (!form.tipo) {
    errors.tipo = 'Elegí el tipo de útil.'
    ok = false
  }
  if (!['donacion', 'intercambio'].includes(form.modalidad)) {
    errors.modalidad = 'Elegí donación o intercambio.'
    ok = false
  }
  if (form.descripcion.trim().length < 10) {
    errors.descripcion = 'Describí el estado del útil (mínimo 10 caracteres).'
    ok = false
  } else if (form.descripcion.length > 300) {
    errors.descripcion = 'La descripción no puede superar los 300 caracteres.'
    ok = false
  }
  return ok
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    ofertas.value = await api.listOfertas({ userId: user.value.id })
  } catch (error) {
    loadError.value = error.message
    notify(error.message, 'error')
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (!validate()) return
  submitting.value = true
  try {
    await api.crearOferta({
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      modalidad: form.modalidad,
      descripcion: form.descripcion.trim(),
      actorId: user.value.id,
    })
    notify('Oferta enviada. Administración la revisa antes de publicarla.', 'success')
    form.nombre = ''
    form.tipo = ''
    form.modalidad = 'donacion'
    form.descripcion = ''
    await load()
  } catch (error) {
    submitError.value = error.message
    notify(error.message, 'error')
  } finally {
    submitting.value = false
  }
}

function openCancel(oferta) {
  cancelTarget.value = oferta
  cancelOpen.value = true
}

async function confirmCancel() {
  if (!cancelTarget.value) return
  cancelling.value = true
  try {
    await api.cancelarOferta(cancelTarget.value.id, user.value.id)
    notify('Oferta cancelada. Queda en tu historial.', 'info')
    cancelOpen.value = false
    await load()
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
    <PageHeader
      eyebrow="Donación e intercambio"
      title="Ofrecer un útil"
      subtitle="Sumá a la cooperativa un útil que ya no uses. Administración revisa el estado y lo publica en el catálogo."
    >
      <template #actions>
        <span v-if="IS_DEMO" class="demo-badge">Datos de prueba</span>
        <RouterLink to="/catalogo" class="btn btn-secondary">Ver catálogo</RouterLink>
      </template>
    </PageHeader>

    <div class="offer-layout">
      <section class="panel">
        <div class="section-heading section-heading--tight">
          <div>
            <p class="eyebrow">Nueva oferta</p>
            <h2>Contanos qué querés ofrecer</h2>
          </div>
        </div>

        <form class="form-stack" novalidate @submit.prevent="submit">
          <div class="field">
            <label for="oferta-nombre">Nombre del útil</label>
            <input
              id="oferta-nombre"
              v-model="form.nombre"
              class="input"
              type="text"
              maxlength="80"
              placeholder="Ej.: juego de reglas y escuadras"
              :aria-invalid="Boolean(errors.nombre)"
            />
            <p v-if="errors.nombre" class="field-error">{{ errors.nombre }}</p>
          </div>

          <div class="field">
            <label for="oferta-tipo">Tipo de útil</label>
            <select
              id="oferta-tipo"
              v-model="form.tipo"
              class="select"
              :aria-invalid="Boolean(errors.tipo)"
            >
              <option value="" disabled>Elegí un tipo</option>
              <option v-for="tipo in TIPO_UTIL_OPTIONS" :key="tipo" :value="tipo">{{ tipo }}</option>
            </select>
            <p v-if="errors.tipo" class="field-error">{{ errors.tipo }}</p>
          </div>

          <fieldset class="field">
            <legend>Modalidad</legend>
            <div class="choice-grid">
              <label
                v-for="modalidad in MODALIDADES_OFERTA"
                :key="modalidad.value"
                class="choice-card"
                :class="{ 'choice-card--selected': form.modalidad === modalidad.value }"
              >
                <input v-model="form.modalidad" type="radio" :value="modalidad.value" name="modalidad" />
                <strong>{{ modalidad.label }}</strong>
                <span>{{ modalidad.descripcion }}</span>
              </label>
            </div>
            <p v-if="errors.modalidad" class="field-error">{{ errors.modalidad }}</p>
          </fieldset>

          <div class="field">
            <label for="oferta-descripcion">Descripción y estado</label>
            <textarea
              id="oferta-descripcion"
              v-model="form.descripcion"
              class="textarea"
              rows="4"
              maxlength="300"
              placeholder="Contá cómo está el útil, si tiene marcas, cuántas piezas incluye…"
              :aria-invalid="Boolean(errors.descripcion)"
            ></textarea>
            <div class="field-foot">
              <p v-if="errors.descripcion" class="field-error">{{ errors.descripcion }}</p>
              <span class="counter">{{ form.descripcion.length }}/300</span>
            </div>
          </div>

          <div v-if="submitError" class="alert alert--error" role="alert">{{ submitError }}</div>

          <div class="form-actions">
            <button class="btn btn-primary" type="submit" :disabled="submitting">
              <span v-if="submitting" class="spinner spinner--sm" aria-hidden="true"></span>
              {{ submitting ? 'Enviando oferta…' : `Ofrecer por ${modalidadLabel.toLowerCase()}` }}
            </button>
            <p class="hint">La oferta no se publica automáticamente.</p>
          </div>
        </form>
      </section>

      <aside class="offer-side">
        <section class="panel offer-info">
          <h2>Cómo funciona</h2>
          <ol class="timeline">
            <li class="timeline__item timeline__item--done">
              <span class="timeline__dot" aria-hidden="true"></span>
              <div>
                <h3>Cargás la oferta</h3>
                <p>Describís el útil y elegís donación o intercambio.</p>
              </div>
            </li>
            <li class="timeline__item">
              <span class="timeline__dot" aria-hidden="true"></span>
              <div>
                <h3>Administración revisa</h3>
                <p>Comprueba el estado y decide si se publica.</p>
              </div>
            </li>
            <li class="timeline__item">
              <span class="timeline__dot" aria-hidden="true"></span>
              <div>
                <h3>Se suma al catálogo</h3>
                <p>Queda disponible para préstamo con un código nuevo.</p>
              </div>
            </li>
          </ol>
        </section>

        <section class="panel side-note">
          <h3>Qué útiles sirven</h3>
          <p>
            Preferentemente útiles completos y en buen estado: lápices, reglas, hojas, carpetas,
            cartucheras, tijeras o materiales de geometría. Si algo está dañado, contalo en la
            descripción para que administración lo evalúe.
          </p>
        </section>
      </aside>
    </div>

    <section class="panel">
      <div class="section-heading section-heading--tight">
        <div>
          <p class="eyebrow">Seguimiento</p>
          <h2>Mis ofertas</h2>
        </div>
        <span class="tag">{{ ofertas.length }} registradas</span>
      </div>

      <LoadingBlock v-if="loading" label="Cargando tus ofertas…" compact />
      <div v-else-if="loadError" class="alert alert--error">{{ loadError }}</div>
      <div v-else-if="ofertas.length" class="offer-list">
        <article v-for="oferta in ofertas" :key="oferta.id" class="offer-item">
          <span class="offer-item__icon" aria-hidden="true">{{ typeMeta[oferta.tipo]?.icon || '📦' }}</span>
          <div class="offer-item__body">
            <div class="offer-item__title">
              <h3>{{ oferta.nombre }}</h3>
              <StatusBadge kind="oferta" :estado="oferta.estado" />
            </div>
            <p>{{ oferta.descripcion }}</p>
            <div class="offer-item__meta">
              <span class="tag">{{ oferta.tipo }}</span>
              <span class="tag">{{ oferta.modalidad === 'donacion' ? 'Donación' : 'Intercambio' }}</span>
              <span>Enviada el {{ formatDate(oferta.createdAt) }}</span>
            </div>
            <p v-if="oferta.estado === 'aceptada'" class="cell-note">
              Ya fue publicada en el catálogo por administración.
            </p>
            <p v-else-if="oferta.estado === 'rechazada'" class="cell-note">
              Administración no pudo aceptarla. Consultá en la cooperativa.
            </p>
          </div>
          <button
            v-if="oferta.estado === 'pendiente'"
            class="btn btn-sm btn-ghost"
            type="button"
            @click="openCancel(oferta)"
          >
            Cancelar
          </button>
        </article>
      </div>
      <EmptyState
        v-else
        icon="🎁"
        title="Todavía no ofreciste ningún útil"
        text="Cuando envíes una oferta vas a poder seguir acá si fue aceptada o rechazada."
      />
    </section>

    <ConfirmDialog
      :open="cancelOpen"
      title="Cancelar la oferta"
      :message="cancelTarget ? `La oferta “${cancelTarget.nombre}” quedará cancelada y administración ya no la revisará.` : ''"
      confirm-label="Sí, cancelar oferta"
      danger
      :loading="cancelling"
      @close="cancelOpen = false"
      @confirm="confirmCancel"
    />
  </div>
</template>
