<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useAuth } from '../stores/auth.js'
import { notify } from '../stores/toast.js'
import { api, IS_DEMO } from '../services/api.js'
import { addDays, formatDate, relativeDate, todayISO } from '../data/utils.js'
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import EmptyState from '../components/EmptyState.vue'
import ModalDialog from '../components/ModalDialog.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const auth = useAuth()
const user = computed(() => auth.state.user)
const puedeCrear = computed(() => auth.permisos.value.cerrarVotaciones)

const votaciones = ref([])
const loading = ref(true)
const loadError = ref('')
const selections = reactive({})
const votingId = ref('')
const createOpen = ref(false)
const creating = ref(false)
const createError = ref('')
const createErrors = reactive({})
const closeOpen = ref(false)
const closeTarget = ref(null)
const closing = ref(false)

const createForm = reactive({
  titulo: '',
  descripcion: '',
  fechaCierre: addDays(todayISO(), 5),
  opciones: ['', ''],
})

const activeCount = computed(() => votaciones.value.filter((v) => isOpen(v)).length)

function isOpen(votacion) {
  return votacion.estado === 'abierta' && votacion.fechaCierre >= todayISO()
}

function hasVoted(votacion) {
  return Boolean(votacion.votos?.some((v) => v.usuarioId === user.value?.id))
}

function myVote(votacion) {
  return votacion.votos?.find((v) => v.usuarioId === user.value?.id)?.opcion || ''
}

function canSeeResults(votacion) {
  return hasVoted(votacion) || votacion.estado === 'cerrada' || !isOpen(votacion) || puedeCrear.value
}

function percentage(votacion, opcion) {
  if (!votacion.totalVotos) return 0
  return Math.round(((votacion.conteos?.[opcion] || 0) / votacion.totalVotos) * 100)
}

function openCreate() {
  Object.keys(createErrors).forEach((key) => delete createErrors[key])
  createError.value = ''
  createForm.titulo = ''
  createForm.descripcion = ''
  createForm.fechaCierre = addDays(todayISO(), 5)
  createForm.opciones = ['', '']
  createOpen.value = true
}

function addOption() {
  if (createForm.opciones.length < 6) createForm.opciones.push('')
}

function removeOption(index) {
  if (createForm.opciones.length > 2) createForm.opciones.splice(index, 1)
}

function validateCreate() {
  Object.keys(createErrors).forEach((key) => delete createErrors[key])
  createError.value = ''
  let ok = true
  if (!createForm.titulo.trim()) {
    createErrors.titulo = 'El título es obligatorio.'
    ok = false
  }
  if (!createForm.fechaCierre) {
    createErrors.fechaCierre = 'Elegí una fecha de cierre.'
    ok = false
  } else if (createForm.fechaCierre < todayISO()) {
    createErrors.fechaCierre = 'La fecha de cierre no puede ser anterior a hoy.'
    ok = false
  }
  const opciones = createForm.opciones.map((o) => o.trim()).filter(Boolean)
  if (opciones.length < 2) {
    createErrors.opciones = 'Agregá al menos dos opciones.'
    ok = false
  } else if (new Set(opciones).size !== opciones.length) {
    createErrors.opciones = 'Las opciones no pueden repetirse.'
    ok = false
  }
  return ok
}

async function submitCreate() {
  if (!validateCreate()) return
  creating.value = true
  try {
    await api.crearVotacion({
      titulo: createForm.titulo.trim(),
      descripcion: createForm.descripcion.trim(),
      fechaCierre: createForm.fechaCierre,
      opciones: createForm.opciones,
      actorId: user.value.id,
    })
    notify('Votación creada y abierta.', 'success')
    createOpen.value = false
    await load()
  } catch (error) {
    createError.value = error.message
    notify(error.message, 'error')
  } finally {
    creating.value = false
  }
}

async function votar(votacion) {
  const opcion = selections[votacion.id]
  if (!opcion) {
    notify('Elegí una opción antes de votar.', 'warning')
    return
  }
  votingId.value = votacion.id
  try {
    await api.votar(votacion.id, opcion, user.value.id)
    delete selections[votacion.id]
    notify('Voto registrado.', 'success')
    await load()
  } catch (error) {
    notify(error.message, 'error')
  } finally {
    votingId.value = ''
  }
}

function openClose(votacion) {
  closeTarget.value = votacion
  closeOpen.value = true
}

async function confirmClose() {
  if (!closeTarget.value) return
  closing.value = true
  try {
    await api.cerrarVotacion(closeTarget.value.id, user.value.id)
    notify('Votación cerrada. Los resultados quedan disponibles.', 'success')
    closeOpen.value = false
    await load()
  } catch (error) {
    notify(error.message, 'error')
  } finally {
    closing.value = false
  }
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    votaciones.value = await api.listVotaciones()
  } catch (error) {
    loadError.value = error.message
    notify(error.message, 'error')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Decisiones compartidas"
      title="Votaciones"
      subtitle="Todas las personas integrantes pueden votar. Presidencia crea, abre y cierra las votaciones."
    >
      <template #actions>
        <span v-if="IS_DEMO" class="demo-badge">Datos de prueba</span>
        <button v-if="puedeCrear" class="btn btn-primary" type="button" @click="openCreate">
          + Nueva votación
        </button>
      </template>
    </PageHeader>

    <div class="summary-bar">
      <p><strong>{{ activeCount }}</strong> votaciones abiertas · <strong>{{ votaciones.length }}</strong> en total</p>
      <p v-if="!puedeCrear" class="hint">Solo presidencia puede crear o cerrar votaciones.</p>
    </div>

    <LoadingBlock v-if="loading" label="Cargando votaciones…" />
    <div v-else-if="loadError" class="alert alert--error">{{ loadError }}</div>

    <template v-else>
      <div v-if="votaciones.length" class="vote-list">
        <article
          v-for="votacion in votaciones"
          :key="votacion.id"
          class="panel vote-card"
          :class="{ 'vote-card--closed': !isOpen(votacion) }"
        >
          <header class="vote-card__header">
            <div>
              <div class="vote-card__meta">
                <StatusBadge kind="votacion" :estado="votacion.estado" />
                <span v-if="isOpen(votacion)" class="tag tag--soft">Cierra {{ formatDate(votacion.fechaCierre) }} · {{ relativeDate(votacion.fechaCierre) }}</span>
                <span v-else class="tag tag--soft">Cerrada {{ formatDate(votacion.fechaCierre) }}</span>
              </div>
              <h2>{{ votacion.titulo }}</h2>
              <p v-if="votacion.descripcion" class="vote-card__description">{{ votacion.descripcion }}</p>
            </div>
            <div class="vote-card__count">
              <strong>{{ votacion.totalVotos }}</strong>
              <span>voto{{ votacion.totalVotos === 1 ? '' : 's' }}</span>
            </div>
          </header>

          <div v-if="isOpen(votacion) && !hasVoted(votacion)" class="vote-options">
            <label
              v-for="opcion in votacion.opciones"
              :key="opcion"
              class="vote-option"
              :class="{ 'vote-option--selected': selections[votacion.id] === opcion }"
            >
              <input v-model="selections[votacion.id]" type="radio" :name="`voto-${votacion.id}`" :value="opcion" />
              <span>{{ opcion }}</span>
            </label>
            <button
              class="btn btn-primary vote-submit"
              type="button"
              :disabled="votingId === votacion.id || !selections[votacion.id]"
              @click="votar(votacion)"
            >
              <span v-if="votingId === votacion.id" class="spinner spinner--sm" aria-hidden="true"></span>
              {{ votingId === votacion.id ? 'Registrando…' : 'Votar' }}
            </button>
          </div>

          <div v-else-if="hasVoted(votacion) && isOpen(votacion)" class="your-vote">
            <span class="your-vote__check" aria-hidden="true">✓</span>
            <p>Ya votaste por <strong>{{ myVote(votacion) }}</strong>. Tu voto no se puede modificar.</p>
          </div>
          <div v-else-if="!isOpen(votacion)" class="your-vote your-vote--closed">
            <span class="your-vote__check" aria-hidden="true">§</span>
            <p v-if="hasVoted(votacion)">La votación cerró. Tu voto: <strong>{{ myVote(votacion) }}</strong>.</p>
            <p v-else>La votación cerró y no registraste un voto.</p>
          </div>

          <div v-if="canSeeResults(votacion)" class="results">
            <p class="results__title">Resultados parciales</p>
            <div v-for="opcion in votacion.opciones" :key="opcion" class="result-row">
              <div class="result-row__top">
                <span :class="{ 'result-row__winner': myVote(votacion) === opcion }">{{ opcion }}</span>
                <span>{{ votacion.conteos?.[opcion] || 0 }} voto{{ (votacion.conteos?.[opcion] || 0) === 1 ? '' : 's' }} · {{ percentage(votacion, opcion) }} %</span>
              </div>
              <div class="progress-bar progress-bar--muted">
                <span :style="{ width: `${percentage(votacion, opcion)}%` }"></span>
              </div>
            </div>
          </div>
          <p v-else class="results-hidden">Los resultados se muestran después de votar.</p>

          <footer class="vote-card__footer">
            <span>Creada por {{ votacion.autorNombre }}</span>
            <button
              v-if="puedeCrear && votacion.estado === 'abierta'"
              class="btn btn-sm btn-secondary"
              type="button"
              @click="openClose(votacion)"
            >
              Cerrar votación
            </button>
          </footer>
        </article>
      </div>
      <div v-else class="panel">
        <EmptyState
          icon="🗳️"
          title="No hay votaciones todavía"
          text="Cuando presidencia cree una votación, va a aparecer en esta sección."
        >
          <button v-if="puedeCrear" class="btn btn-primary" type="button" @click="openCreate">
            Crear la primera votación
          </button>
        </EmptyState>
      </div>
    </template>

    <ModalDialog
      :open="createOpen"
      title="Nueva votación"
      subtitle="Definí una pregunta clara y al menos dos opciones."
      size="md"
      @close="createOpen = false"
    >
      <form id="create-vote-form" class="form-stack" novalidate @submit.prevent="submitCreate">
        <div class="field">
          <label for="vote-titulo">Título o pregunta</label>
          <input
            id="vote-titulo"
            v-model="createForm.titulo"
            class="input"
            type="text"
            maxlength="120"
            placeholder="Ej.: ¿Qué compramos con el fondo solidario?"
            :aria-invalid="Boolean(createErrors.titulo)"
          />
          <p v-if="createErrors.titulo" class="field-error">{{ createErrors.titulo }}</p>
        </div>

        <div class="field">
          <label for="vote-descripcion">Descripción <span class="label-optional">(opcional)</span></label>
          <textarea
            id="vote-descripcion"
            v-model="createForm.descripcion"
            class="textarea"
            rows="3"
            maxlength="300"
            placeholder="Contá el contexto de la decisión."
          ></textarea>
        </div>

        <div class="field">
          <label for="vote-cierre">Fecha de cierre</label>
          <input
            id="vote-cierre"
            v-model="createForm.fechaCierre"
            class="input"
            type="date"
            :min="todayISO()"
            :aria-invalid="Boolean(createErrors.fechaCierre)"
          />
          <p v-if="createErrors.fechaCierre" class="field-error">{{ createErrors.fechaCierre }}</p>
        </div>

        <fieldset class="field">
          <legend>Opciones</legend>
          <div class="option-editor">
            <div v-for="(_, index) in createForm.opciones" :key="index" class="option-editor__row">
              <input
                v-model="createForm.opciones[index]"
                class="input"
                type="text"
                maxlength="80"
                :aria-label="`Opción ${index + 1}`"
                :placeholder="`Opción ${index + 1}`"
              />
              <button
                v-if="createForm.opciones.length > 2"
                class="icon-button"
                type="button"
                aria-label="Quitar opción"
                @click="removeOption(index)"
              >
                ×
              </button>
            </div>
          </div>
          <div class="option-editor__actions">
            <button
              class="btn btn-sm btn-secondary"
              type="button"
              :disabled="createForm.opciones.length >= 6"
              @click="addOption"
            >
              + Agregar opción
            </button>
            <span class="hint">Mínimo 2, máximo 6.</span>
          </div>
          <p v-if="createErrors.opciones" class="field-error">{{ createErrors.opciones }}</p>
        </fieldset>

        <div v-if="createError" class="alert alert--error">{{ createError }}</div>
      </form>
      <template #footer>
        <button class="btn btn-secondary" type="button" :disabled="creating" @click="createOpen = false">Cancelar</button>
        <button class="btn btn-primary" type="submit" form="create-vote-form" :disabled="creating">
          <span v-if="creating" class="spinner spinner--sm" aria-hidden="true"></span>
          {{ creating ? 'Creando…' : 'Crear votación' }}
        </button>
      </template>
    </ModalDialog>

    <ConfirmDialog
      :open="closeOpen"
      title="Cerrar la votación"
      :message="closeTarget ? `Se cerrará “${closeTarget.titulo}” y no se podrán registrar más votos. Los resultados quedarán visibles.` : ''"
      confirm-label="Sí, cerrar votación"
      :loading="closing"
      @close="closeOpen = false"
      @confirm="confirmClose"
    />
  </div>
</template>
