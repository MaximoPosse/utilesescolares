<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useAuth } from '../stores/auth.js'
import { notify } from '../stores/toast.js'
import { api, IS_DEMO } from '../services/api.js'
import { formatDate } from '../data/utils.js'
import PageHeader from '../components/PageHeader.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import EmptyState from '../components/EmptyState.vue'
import ModalDialog from '../components/ModalDialog.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const auth = useAuth()
const canManage = computed(() => auth.permisos.value.acuerdos)

const acuerdos = ref([])
const loading = ref(true)
const loadError = ref('')
const search = ref('')
const showArchived = ref(false)

const modalOpen = ref(false)
const editingId = ref(null)
const saving = ref(false)
const formError = ref('')
const errors = reactive({})
const form = reactive({
  fecha: new Date().toISOString().slice(0, 10),
  tema: '',
  decision: '',
})

const archiveOpen = ref(false)
const archiveTarget = ref(null)
const archiving = ref(false)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return acuerdos.value.filter((a) => {
    if (!showArchived.value && !a.activo) return false
    if (showArchived.value && a.activo) return false
    if (q && !`${a.tema} ${a.decision} ${a.autorNombre}`.toLowerCase().includes(q)) return false
    return true
  })
})

const activeCount = computed(() => acuerdos.value.filter((a) => a.activo).length)
const archivedCount = computed(() => acuerdos.value.filter((a) => !a.activo).length)

function openCreate() {
  editingId.value = null
  form.fecha = new Date().toISOString().slice(0, 10)
  form.tema = ''
  form.decision = ''
  formError.value = ''
  Object.keys(errors).forEach((key) => delete errors[key])
  modalOpen.value = true
}

function openEdit(acuerdo) {
  editingId.value = acuerdo.id
  form.fecha = acuerdo.fecha
  form.tema = acuerdo.tema
  form.decision = acuerdo.decision
  formError.value = ''
  Object.keys(errors).forEach((key) => delete errors[key])
  modalOpen.value = true
}

function validate() {
  Object.keys(errors).forEach((key) => delete errors[key])
  formError.value = ''
  let ok = true
  if (!form.fecha) {
    errors.fecha = 'La fecha es obligatoria.'
    ok = false
  }
  if (!form.tema.trim()) {
    errors.tema = 'El tema es obligatorio.'
    ok = false
  }
  if (form.decision.trim().length < 10) {
    errors.decision = 'La decisión debe tener al menos 10 caracteres.'
    ok = false
  }
  return ok
}

async function save() {
  if (!validate()) return
  saving.value = true
  try {
    const payload = {
      fecha: form.fecha,
      tema: form.tema.trim(),
      decision: form.decision.trim(),
    }
    if (editingId.value) {
      await api.actualizarAcuerdo(editingId.value, payload, auth.state.user.id)
      notify('Acuerdo actualizado.', 'success')
    } else {
      await api.crearAcuerdo(payload, auth.state.user.id)
      notify('Acuerdo registrado.', 'success')
    }
    modalOpen.value = false
    await load()
  } catch (error) {
    formError.value = error.message
    notify(error.message, 'error')
  } finally {
    saving.value = false
  }
}

function openArchive(acuerdo) {
  archiveTarget.value = acuerdo
  archiveOpen.value = true
}

async function confirmArchive() {
  if (!archiveTarget.value) return
  archiving.value = true
  try {
    await api.archivarAcuerdo(archiveTarget.value.id, auth.state.user.id)
    notify('Acuerdo archivado. Se conserva en el historial.', 'success')
    archiveOpen.value = false
    await load()
  } catch (error) {
    notify(error.message, 'error')
  } finally {
    archiving.value = false
  }
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    acuerdos.value = await api.listAcuerdos({ includeInactive: canManage.value })
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
      eyebrow="Memoria de la cooperativa"
      title="Acuerdos"
      subtitle="Cada decisión de la asamblea queda registrada con fecha, tema y decisión. Secretaría es quien los crea y modifica."
    >
      <template #actions>
        <span v-if="IS_DEMO" class="demo-badge">Datos de prueba</span>
        <button v-if="canManage" class="btn btn-primary" type="button" @click="openCreate">
          + Nuevo acuerdo
        </button>
      </template>
    </PageHeader>

    <section class="filter-bar" aria-label="Filtros de acuerdos">
      <div class="search-field">
        <span class="search-field__icon" aria-hidden="true">⌕</span>
        <label for="acuerdo-search" class="sr-only">Buscar acuerdo</label>
        <input
          id="acuerdo-search"
          v-model="search"
          class="input"
          type="search"
          placeholder="Buscar por tema o decisión…"
        />
      </div>
      <label v-if="canManage && archivedCount" class="checkbox-row filter-checkbox">
        <input v-model="showArchived" type="checkbox" />
        <span>Ver archivados ({{ archivedCount }})</span>
      </label>
    </section>

    <div class="summary-bar">
      <p><strong>{{ activeCount }}</strong> acuerdos vigentes</p>
      <p v-if="!canManage" class="hint">Solo secretaría puede crear o modificar acuerdos.</p>
    </div>

    <LoadingBlock v-if="loading" label="Cargando acuerdos…" />
    <div v-else-if="loadError" class="alert alert--error">{{ loadError }}</div>

    <template v-else>
      <div v-if="filtered.length" class="agreement-list">
        <article v-for="acuerdo in filtered" :key="acuerdo.id" class="panel agreement-card" :class="{ 'agreement-card--archived': !acuerdo.activo }">
          <div class="agreement-card__date">
            <span>{{ formatDate(acuerdo.fecha) }}</span>
            <span v-if="!acuerdo.activo" class="tag tag--muted">Archivado</span>
          </div>
          <div class="agreement-card__body">
            <h2>{{ acuerdo.tema }}</h2>
            <p>{{ acuerdo.decision }}</p>
            <div class="agreement-card__meta">
              <span>Registrado por {{ acuerdo.autorNombre }}</span>
              <span v-if="acuerdo.updatedAt">Actualizado el {{ formatDate(acuerdo.updatedAt) }}</span>
            </div>
          </div>
          <div v-if="canManage" class="agreement-card__actions">
            <button class="btn btn-sm btn-secondary" type="button" @click="openEdit(acuerdo)">Editar</button>
            <button v-if="acuerdo.activo" class="btn btn-sm btn-ghost" type="button" @click="openArchive(acuerdo)">
              Archivar
            </button>
          </div>
        </article>
      </div>
      <div v-else class="panel">
        <EmptyState
          icon="📋"
          :title="showArchived ? 'No hay acuerdos archivados' : 'No hay acuerdos que coincidan'"
          text="La secretaría registra las decisiones de la asamblea para que queden disponibles."
        >
          <button v-if="canManage && !showArchived" class="btn btn-primary" type="button" @click="openCreate">
            Registrar un acuerdo
          </button>
        </EmptyState>
      </div>
    </template>

    <ModalDialog
      :open="modalOpen"
      :title="editingId ? 'Editar acuerdo' : 'Nuevo acuerdo'"
      subtitle="La fecha, el tema y la decisión quedan en el historial de la cooperativa."
      @close="modalOpen = false"
    >
      <form id="acuerdo-form" class="form-stack" novalidate @submit.prevent="save">
        <div class="field">
          <label for="acuerdo-fecha">Fecha</label>
          <input
            id="acuerdo-fecha"
            v-model="form.fecha"
            class="input"
            type="date"
            :aria-invalid="Boolean(errors.fecha)"
          />
          <p v-if="errors.fecha" class="field-error">{{ errors.fecha }}</p>
        </div>
        <div class="field">
          <label for="acuerdo-tema">Tema</label>
          <input
            id="acuerdo-tema"
            v-model="form.tema"
            class="input"
            type="text"
            maxlength="120"
            placeholder="Ej.: plazo máximo de préstamo"
            :aria-invalid="Boolean(errors.tema)"
          />
          <p v-if="errors.tema" class="field-error">{{ errors.tema }}</p>
        </div>
        <div class="field">
          <label for="acuerdo-decision">Decisión</label>
          <textarea
            id="acuerdo-decision"
            v-model="form.decision"
            class="textarea"
            rows="6"
            maxlength="1000"
            placeholder="Escribí la decisión completa acordada por la asamblea…"
            :aria-invalid="Boolean(errors.decision)"
          ></textarea>
          <div class="field-foot">
            <p v-if="errors.decision" class="field-error">{{ errors.decision }}</p>
            <span class="counter">{{ form.decision.length }}/1000</span>
          </div>
        </div>
        <div v-if="formError" class="alert alert--error">{{ formError }}</div>
      </form>
      <template #footer>
        <button class="btn btn-secondary" type="button" :disabled="saving" @click="modalOpen = false">Cancelar</button>
        <button class="btn btn-primary" type="submit" form="acuerdo-form" :disabled="saving">
          <span v-if="saving" class="spinner spinner--sm" aria-hidden="true"></span>
          {{ saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Registrar acuerdo' }}
        </button>
      </template>
    </ModalDialog>

    <ConfirmDialog
      :open="archiveOpen"
      title="Archivar acuerdo"
      :message="archiveTarget ? `El acuerdo “${archiveTarget.tema}” dejará de mostrarse como vigente. No se elimina del historial.` : ''"
      confirm-label="Sí, archivar"
      danger
      :loading="archiving"
      @close="archiveOpen = false"
      @confirm="confirmArchive"
    />
  </div>
</template>
