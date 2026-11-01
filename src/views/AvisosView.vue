<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useAuth } from '../stores/auth.js'
import { notify } from '../stores/toast.js'
import { api, IS_DEMO } from '../services/api.js'
import { CATEGORIAS_AVISO } from '../data/constants.js'
import { formatDate, truncate } from '../data/utils.js'
import PageHeader from '../components/PageHeader.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import EmptyState from '../components/EmptyState.vue'
import ModalDialog from '../components/ModalDialog.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const auth = useAuth()
const canManage = computed(() => auth.permisos.value.avisos)

const avisos = ref([])
const loading = ref(true)
const loadError = ref('')
const search = ref('')
const categoria = ref('')
const showArchived = ref(false)

const modalOpen = ref(false)
const editingId = ref(null)
const saving = ref(false)
const formError = ref('')
const errors = reactive({})
const form = reactive({
  titulo: '',
  categoria: '',
  contenido: '',
})

const archiveOpen = ref(false)
const archiveTarget = ref(null)
const archiving = ref(false)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return avisos.value.filter((aviso) => {
    if (!showArchived.value && !aviso.activo) return false
    if (showArchived.value && aviso.activo) return false
    if (categoria.value && aviso.categoria !== categoria.value) return false
    if (q && !`${aviso.titulo} ${aviso.contenido} ${aviso.autorNombre}`.toLowerCase().includes(q)) return false
    return true
  })
})

const activeCount = computed(() => avisos.value.filter((a) => a.activo).length)
const archivedCount = computed(() => avisos.value.filter((a) => !a.activo).length)

function openCreate() {
  editingId.value = null
  form.titulo = ''
  form.categoria = ''
  form.contenido = ''
  formError.value = ''
  Object.keys(errors).forEach((key) => delete errors[key])
  modalOpen.value = true
}

function openEdit(aviso) {
  editingId.value = aviso.id
  form.titulo = aviso.titulo
  form.categoria = aviso.categoria
  form.contenido = aviso.contenido
  formError.value = ''
  Object.keys(errors).forEach((key) => delete errors[key])
  modalOpen.value = true
}

function validate() {
  Object.keys(errors).forEach((key) => delete errors[key])
  formError.value = ''
  let ok = true
  if (!form.titulo.trim()) {
    errors.titulo = 'El título es obligatorio.'
    ok = false
  }
  if (!form.categoria) {
    errors.categoria = 'Elegí una categoría.'
    ok = false
  }
  if (form.contenido.trim().length < 20) {
    errors.contenido = 'El contenido debe tener al menos 20 caracteres.'
    ok = false
  }
  return ok
}

async function save() {
  if (!validate()) return
  saving.value = true
  try {
    const payload = {
      titulo: form.titulo.trim(),
      categoria: form.categoria,
      contenido: form.contenido.trim(),
    }
    if (editingId.value) {
      await api.actualizarAviso(editingId.value, payload, auth.state.user.id)
      notify('Aviso actualizado.', 'success')
    } else {
      await api.crearAviso(payload, auth.state.user.id)
      notify('Aviso publicado.', 'success')
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

function openArchive(aviso) {
  archiveTarget.value = aviso
  archiveOpen.value = true
}

async function confirmArchive() {
  if (!archiveTarget.value) return
  archiving.value = true
  try {
    await api.archivarAviso(archiveTarget.value.id, auth.state.user.id)
    notify('Aviso archivado. Se conserva en el historial.', 'success')
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
    avisos.value = await api.listAvisos({ includeInactive: canManage.value })
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
      eyebrow="Comunicación"
      title="Avisos de la cooperativa"
      subtitle="Novedades, útiles disponibles, reuniones y recordatorios de devolución."
    >
      <template #actions>
        <span v-if="IS_DEMO" class="demo-badge">Datos de prueba</span>
        <button v-if="canManage" class="btn btn-primary" type="button" @click="openCreate">
          + Nuevo aviso
        </button>
      </template>
    </PageHeader>

    <section class="filter-bar" aria-label="Filtros de avisos">
      <div class="search-field">
        <span class="search-field__icon" aria-hidden="true">⌕</span>
        <label for="aviso-search" class="sr-only">Buscar aviso</label>
        <input
          id="aviso-search"
          v-model="search"
          class="input"
          type="search"
          placeholder="Buscar en los avisos…"
        />
      </div>
      <div class="field field--compact">
        <label for="aviso-categoria">Categoría</label>
        <select id="aviso-categoria" v-model="categoria" class="select">
          <option value="">Todas las categorías</option>
          <option v-for="cat in CATEGORIAS_AVISO" :key="cat" :value="cat">{{ cat }}</option>
        </select>
      </div>
      <label v-if="canManage && archivedCount" class="checkbox-row filter-checkbox">
        <input v-model="showArchived" type="checkbox" />
        <span>Ver archivados ({{ archivedCount }})</span>
      </label>
    </section>

    <div class="summary-bar">
      <p>
        <strong>{{ activeCount }}</strong> avisos activos
        <span v-if="canManage"> · podés editar y archivar sin borrar el historial</span>
      </p>
      <p v-if="!canManage" class="hint">Solo la comisión de comunicación puede gestionar avisos.</p>
    </div>

    <LoadingBlock v-if="loading" label="Cargando avisos…" />
    <div v-else-if="loadError" class="alert alert--error">{{ loadError }}</div>

    <template v-else>
      <div v-if="filtered.length" class="notice-grid">
        <article v-for="aviso in filtered" :key="aviso.id" class="panel notice-card" :class="{ 'notice-card--archived': !aviso.activo }">
          <header class="notice-card__header">
            <span class="tag">{{ aviso.categoria }}</span>
            <span v-if="!aviso.activo" class="tag tag--muted">Archivado</span>
            <span class="notice-card__date">{{ formatDate(aviso.createdAt) }}</span>
          </header>
          <h2>{{ aviso.titulo }}</h2>
          <p>{{ aviso.contenido }}</p>
          <footer class="notice-card__footer">
            <span>Publicado por {{ aviso.autorNombre }}</span>
            <div v-if="canManage" class="row-actions">
              <button class="btn btn-sm btn-secondary" type="button" @click="openEdit(aviso)">Editar</button>
              <button v-if="aviso.activo" class="btn btn-sm btn-ghost" type="button" @click="openArchive(aviso)">
                Archivar
              </button>
            </div>
          </footer>
        </article>
      </div>
      <div v-else class="panel">
        <EmptyState
          icon="📣"
          :title="showArchived ? 'No hay avisos archivados' : 'No hay avisos que coincidan'"
          text="Probá con otro término o cambiá la categoría."
        >
          <button v-if="canManage && !showArchived" class="btn btn-primary" type="button" @click="openCreate">
            Publicar un aviso
          </button>
        </EmptyState>
      </div>
    </template>

    <ModalDialog
      :open="modalOpen"
      :title="editingId ? 'Editar aviso' : 'Nuevo aviso'"
      subtitle="El aviso se publica inmediatamente en el panel de todos los integrantes."
      @close="modalOpen = false"
    >
      <form id="aviso-form" class="form-stack" novalidate @submit.prevent="save">
        <div class="field">
          <label for="aviso-titulo">Título</label>
          <input
            id="aviso-titulo"
            v-model="form.titulo"
            class="input"
            type="text"
            maxlength="120"
            placeholder="Ej.: Nuevos útiles disponibles"
            :aria-invalid="Boolean(errors.titulo)"
          />
          <p v-if="errors.titulo" class="field-error">{{ errors.titulo }}</p>
        </div>
        <div class="field">
          <label for="aviso-form-categoria">Categoría</label>
          <select
            id="aviso-form-categoria"
            v-model="form.categoria"
            class="select"
            :aria-invalid="Boolean(errors.categoria)"
          >
            <option value="" disabled>Elegí una categoría</option>
            <option v-for="cat in CATEGORIAS_AVISO" :key="cat" :value="cat">{{ cat }}</option>
          </select>
          <p v-if="errors.categoria" class="field-error">{{ errors.categoria }}</p>
        </div>
        <div class="field">
          <label for="aviso-contenido">Contenido</label>
          <textarea
            id="aviso-contenido"
            v-model="form.contenido"
            class="textarea"
            rows="6"
            maxlength="1200"
            placeholder="Escribí el aviso completo…"
            :aria-invalid="Boolean(errors.contenido)"
          ></textarea>
          <div class="field-foot">
            <p v-if="errors.contenido" class="field-error">{{ errors.contenido }}</p>
            <span class="counter">{{ form.contenido.length }}/1200</span>
          </div>
        </div>
        <div v-if="formError" class="alert alert--error">{{ formError }}</div>
      </form>
      <template #footer>
        <button class="btn btn-secondary" type="button" :disabled="saving" @click="modalOpen = false">Cancelar</button>
        <button class="btn btn-primary" type="submit" form="aviso-form" :disabled="saving">
          <span v-if="saving" class="spinner spinner--sm" aria-hidden="true"></span>
          {{ saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Publicar aviso' }}
        </button>
      </template>
    </ModalDialog>

    <ConfirmDialog
      :open="archiveOpen"
      title="Archivar aviso"
      :message="archiveTarget ? `“${archiveTarget.titulo}” dejará de mostrarse. No se elimina: queda en el historial.` : ''"
      confirm-label="Sí, archivar"
      danger
      :loading="archiving"
      @close="archiveOpen = false"
      @confirm="confirmArchive"
    />
  </div>
</template>
