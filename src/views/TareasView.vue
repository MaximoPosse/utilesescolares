<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useAuth } from '../stores/auth.js'
import { notify } from '../stores/toast.js'
import { api, IS_DEMO } from '../services/api.js'
import { addDays, formatDate, relativeDate, todayISO } from '../data/utils.js'
import PageHeader from '../components/PageHeader.vue'
import StatCard from '../components/StatCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import EmptyState from '../components/EmptyState.vue'
import ModalDialog from '../components/ModalDialog.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const auth = useAuth()
const user = computed(() => auth.state.user)
const canManage = computed(() => auth.permisos.value.tareas)

const tareas = ref([])
const actividades = ref([])
const usuarios = ref([])
const loading = ref(true)
const loadError = ref('')
const search = ref('')
const estado = ref('')
const actividad = ref('')
const updatingId = ref('')

const activityOpen = ref(false)
const activitySaving = ref(false)
const activityError = ref('')
const activityErrors = reactive({})
const activityForm = reactive({
  titulo: '',
  descripcion: '',
  fechaLimite: addDays(todayISO(), 14),
})

const taskOpen = ref(false)
const taskSaving = ref(false)
const taskError = ref('')
const taskErrors = reactive({})
const taskForm = reactive({
  actividadId: '',
  titulo: '',
  descripcion: '',
  asignadoId: '',
  fechaLimite: addDays(todayISO(), 7),
})

const archiveOpen = ref(false)
const archiveTarget = ref(null)
const archiving = ref(false)

const hoy = todayISO()

const counts = computed(() => ({
  pendientes: tareas.value.filter((t) => t.estado === 'pendiente').length,
  enCurso: tareas.value.filter((t) => t.estado === 'en_curso').length,
  terminadas: tareas.value.filter((t) => t.estado === 'terminada').length,
  vencidas: tareas.value.filter((t) => t.estado !== 'terminada' && t.fechaLimite < hoy).length,
}))

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return tareas.value.filter((tarea) => {
    if (estado.value === 'abiertas' && tarea.estado === 'terminada') return false
    if (estado.value && estado.value !== 'abiertas' && tarea.estado !== estado.value) return false
    if (actividad.value && tarea.actividadId !== actividad.value) return false
    if (q && !`${tarea.titulo} ${tarea.descripcion} ${tarea.actividadTitulo} ${tarea.asignadoNombre}`.toLowerCase().includes(q)) return false
    return true
  })
})

const activitiesSummary = computed(() =>
  actividades.value.map((actividadItem) => {
    const total = actividadItem.tareas?.length || 0
    const terminadas = actividadItem.tareas?.filter((t) => t.estado === 'terminada').length || 0
    return {
      ...actividadItem,
      total,
      terminadas,
      progreso: total ? Math.round((terminadas / total) * 100) : 0,
    }
  }),
)

function openActivity() {
  activityForm.titulo = ''
  activityForm.descripcion = ''
  activityForm.fechaLimite = addDays(todayISO(), 14)
  activityError.value = ''
  Object.keys(activityErrors).forEach((key) => delete activityErrors[key])
  activityOpen.value = true
}

function validateActivity() {
  Object.keys(activityErrors).forEach((key) => delete activityErrors[key])
  activityError.value = ''
  let ok = true
  if (!activityForm.titulo.trim()) {
    activityErrors.titulo = 'El título es obligatorio.'
    ok = false
  }
  if (!activityForm.fechaLimite) {
    activityErrors.fechaLimite = 'La fecha límite es obligatoria.'
    ok = false
  }
  return ok
}

async function saveActivity() {
  if (!validateActivity()) return
  activitySaving.value = true
  try {
    await api.crearActividad({
      titulo: activityForm.titulo.trim(),
      descripcion: activityForm.descripcion.trim(),
      fechaLimite: activityForm.fechaLimite,
      actorId: user.value.id,
    }, user.value.id)
    notify('Actividad creada. Ya podés asignarle tareas.', 'success')
    activityOpen.value = false
    await load()
  } catch (error) {
    activityError.value = error.message
    notify(error.message, 'error')
  } finally {
    activitySaving.value = false
  }
}

function openTask() {
  taskForm.actividadId = actividades.value[0]?.id || ''
  taskForm.titulo = ''
  taskForm.descripcion = ''
  taskForm.asignadoId = ''
  taskForm.fechaLimite = addDays(todayISO(), 7)
  taskError.value = ''
  Object.keys(taskErrors).forEach((key) => delete taskErrors[key])
  taskOpen.value = true
}

function validateTask() {
  Object.keys(taskErrors).forEach((key) => delete taskErrors[key])
  taskError.value = ''
  let ok = true
  if (!taskForm.actividadId) {
    taskErrors.actividadId = 'Elegí una actividad.'
    ok = false
  }
  if (!taskForm.titulo.trim()) {
    taskErrors.titulo = 'El título es obligatorio.'
    ok = false
  }
  if (!taskForm.asignadoId) {
    taskErrors.asignadoId = 'Elegí a quién asignar la tarea.'
    ok = false
  }
  if (!taskForm.fechaLimite) {
    taskErrors.fechaLimite = 'La fecha límite es obligatoria.'
    ok = false
  }
  return ok
}

async function saveTask() {
  if (!validateTask()) return
  taskSaving.value = true
  try {
    await api.crearTarea({
      actividadId: taskForm.actividadId,
      titulo: taskForm.titulo.trim(),
      descripcion: taskForm.descripcion.trim(),
      asignadoId: taskForm.asignadoId,
      fechaLimite: taskForm.fechaLimite,
      actorId: user.value.id,
    }, user.value.id)
    notify('Tarea asignada. La persona verá el pendiente en su panel.', 'success')
    taskOpen.value = false
    await load()
  } catch (error) {
    taskError.value = error.message
    notify(error.message, 'error')
  } finally {
    taskSaving.value = false
  }
}

async function changeStatus(tarea, next) {
  updatingId.value = tarea.id
  try {
    await api.actualizarEstadoTarea(tarea.id, next, user.value.id)
    notify(`Tarea “${tarea.titulo}” actualizada.`, 'success')
    await load()
  } catch (error) {
    notify(error.message, 'error')
  } finally {
    updatingId.value = ''
  }
}

function openArchive(tarea) {
  archiveTarget.value = tarea
  archiveOpen.value = true
}

async function confirmArchive() {
  if (!archiveTarget.value) return
  archiving.value = true
  try {
    await api.archivarTarea(archiveTarget.value.id, user.value.id)
    notify('Tarea archivada. Se conserva en el historial.', 'success')
    archiveOpen.value = false
    await load()
  } catch (error) {
    notify(error.message, 'error')
  } finally {
    archiving.value = false
  }
}

function canUpdate(tarea) {
  return canManage.value || tarea.asignadoId === user.value.id
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const results = await Promise.all([
      api.listTareas({ userId: user.value.id, all: canManage.value }),
      api.listActividades({ includeInactive: canManage.value }),
      canManage.value ? api.listUsuarios() : Promise.resolve([]),
    ])
    tareas.value = results[0]
    actividades.value = results[1]
    usuarios.value = results[2]
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
      eyebrow="Comisión de organización"
      title="Actividades y tareas"
      subtitle="Cada actividad agrupa tareas con responsable y fecha límite. Las personas asignadas actualizan su estado."
    >
      <template #actions>
        <span v-if="IS_DEMO" class="demo-badge">Datos de prueba</span>
        <template v-if="canManage">
          <button class="btn btn-secondary" type="button" @click="openActivity">+ Nueva actividad</button>
          <button class="btn btn-primary" type="button" @click="openTask">+ Nueva tarea</button>
        </template>
      </template>
    </PageHeader>

    <section class="stats-row stats-row--four" aria-label="Resumen de tareas">
      <StatCard label="Pendientes" :value="counts.pendientes" hint="Todavía sin empezar" icon="○" tone="warning" />
      <StatCard label="En curso" :value="counts.enCurso" hint="Trabajo empezado" icon="◐" tone="info" />
      <StatCard label="Terminadas" :value="counts.terminadas" hint="Cumplidas" icon="✓" tone="success" />
      <StatCard
        label="Vencidas"
        :value="counts.vencidas"
        hint="Pasó la fecha límite sin terminar"
        icon="!"
        :tone="counts.vencidas ? 'danger' : 'success'"
      />
    </section>

    <section v-if="canManage && activitiesSummary.length" class="panel">
      <div class="section-heading section-heading--tight">
        <div>
          <p class="eyebrow">Panorama</p>
          <h2>Avance por actividad</h2>
        </div>
        <span class="tag">{{ activitiesSummary.length }} actividades</span>
      </div>
      <div class="activity-grid">
        <article v-for="item in activitiesSummary" :key="item.id" class="activity-card">
          <div class="activity-card__top">
            <div>
              <h3>{{ item.titulo }}</h3>
              <p>Vence {{ formatDate(item.fechaLimite) }} · {{ relativeDate(item.fechaLimite) }}</p>
            </div>
            <span class="activity-card__count">{{ item.terminadas }}/{{ item.total }}</span>
          </div>
          <div class="progress-bar" :aria-label="`${item.progreso} % de tareas terminadas`">
            <span :style="{ width: `${item.progreso}%` }"></span>
          </div>
          <p class="activity-card__progress">{{ item.progreso }} % de las tareas terminadas</p>
        </article>
      </div>
    </section>

    <section class="filter-bar" aria-label="Filtros de tareas">
      <div class="search-field">
        <span class="search-field__icon" aria-hidden="true">⌕</span>
        <label for="task-search" class="sr-only">Buscar tarea</label>
        <input id="task-search" v-model="search" class="input" type="search" placeholder="Buscar por tarea, actividad o responsable…" />
      </div>
      <div class="field field--compact">
        <label for="task-estado">Estado</label>
        <select id="task-estado" v-model="estado" class="select">
          <option value="">Todas</option>
          <option value="abiertas">Abiertas</option>
          <option value="pendiente">Pendientes</option>
          <option value="en_curso">En curso</option>
          <option value="terminada">Terminadas</option>
        </select>
      </div>
      <div class="field field--compact">
        <label for="task-actividad">Actividad</label>
        <select id="task-actividad" v-model="actividad" class="select">
          <option value="">Todas las actividades</option>
          <option v-for="item in actividades" :key="item.id" :value="item.id">{{ item.titulo }}</option>
        </select>
      </div>
    </section>

    <div class="summary-bar">
      <p>
        <strong>{{ filtered.length }}</strong>
        {{ filtered.length === 1 ? 'tarea' : 'tareas' }}
        <span v-if="!canManage">asignadas a vos</span>
        <span v-else>en la cooperativa</span>
      </p>
      <p v-if="!canManage" class="hint">Podés actualizar el estado de las tareas que tenés asignadas.</p>
    </div>

    <LoadingBlock v-if="loading" label="Cargando tareas…" />
    <div v-else-if="loadError" class="alert alert--error">{{ loadError }}</div>

    <template v-else>
      <div v-if="filtered.length" class="task-grid">
        <article v-for="tarea in filtered" :key="tarea.id" class="panel task-card" :class="{ 'task-card--done': tarea.estado === 'terminada' }">
          <header class="task-card__header">
            <span class="tag">{{ tarea.actividadTitulo }}</span>
            <StatusBadge kind="tarea" :estado="tarea.estado" />
          </header>
          <h2>{{ tarea.titulo }}</h2>
          <p v-if="tarea.descripcion" class="task-card__description">{{ tarea.descripcion }}</p>
          <dl class="task-card__meta">
            <div>
              <dt>Responsable</dt>
              <dd>{{ tarea.asignadoNombre }} <span class="muted">· {{ tarea.asignadoCurso }}</span></dd>
            </div>
            <div>
              <dt>Fecha límite</dt>
              <dd :class="{ 'text-danger': tarea.estado !== 'terminada' && tarea.fechaLimite < hoy }">
                {{ formatDate(tarea.fechaLimite) }} · {{ relativeDate(tarea.fechaLimite) }}
              </dd>
            </div>
          </dl>
          <footer class="task-card__footer">
            <div v-if="canUpdate(tarea)" class="row-actions">
              <button
                v-if="tarea.estado === 'pendiente'"
                class="btn btn-sm btn-primary"
                type="button"
                :disabled="updatingId === tarea.id"
                @click="changeStatus(tarea, 'en_curso')"
              >
                Empezar
              </button>
              <button
                v-if="tarea.estado === 'en_curso'"
                class="btn btn-sm btn-primary"
                type="button"
                :disabled="updatingId === tarea.id"
                @click="changeStatus(tarea, 'terminada')"
              >
                Marcar terminada
              </button>
              <button
                v-if="tarea.estado === 'terminada'"
                class="btn btn-sm btn-secondary"
                type="button"
                :disabled="updatingId === tarea.id"
                @click="changeStatus(tarea, 'pendiente')"
              >
                Reabrir
              </button>
            </div>
            <span v-else class="hint">Solo lectura</span>
            <button v-if="canManage" class="btn btn-sm btn-ghost" type="button" @click="openArchive(tarea)">
              Archivar
            </button>
          </footer>
        </article>
      </div>

      <div v-else class="panel">
        <EmptyState
          icon="☑"
          :title="canManage ? 'No hay tareas con esos filtros' : 'No tenés tareas asignadas'"
          :text="canManage
            ? 'Probá con otro estado o creá una actividad para organizar el trabajo.'
            : 'Cuando la comisión de organización te asigne una tarea, va a aparecer acá.'"
        >
          <button v-if="canManage" class="btn btn-primary" type="button" @click="openTask">
            Crear una tarea
          </button>
        </EmptyState>
      </div>
    </template>

    <ModalDialog
      :open="activityOpen"
      title="Nueva actividad"
      subtitle="Una actividad agrupa varias tareas con un objetivo común."
      @close="activityOpen = false"
    >
      <form id="activity-form" class="form-stack" novalidate @submit.prevent="saveActivity">
        <div class="field">
          <label for="activity-titulo">Título</label>
          <input
            id="activity-titulo"
            v-model="activityForm.titulo"
            class="input"
            type="text"
            maxlength="120"
            placeholder="Ej.: Feria de intercambio"
            :aria-invalid="Boolean(activityErrors.titulo)"
          />
          <p v-if="activityErrors.titulo" class="field-error">{{ activityErrors.titulo }}</p>
        </div>
        <div class="field">
          <label for="activity-descripcion">Descripción <span class="label-optional">(opcional)</span></label>
          <textarea id="activity-descripcion" v-model="activityForm.descripcion" class="textarea" rows="3" maxlength="400"></textarea>
        </div>
        <div class="field">
          <label for="activity-fecha">Fecha límite</label>
          <input id="activity-fecha" v-model="activityForm.fechaLimite" class="input" type="date" :min="hoy" :aria-invalid="Boolean(activityErrors.fechaLimite)" />
          <p v-if="activityErrors.fechaLimite" class="field-error">{{ activityErrors.fechaLimite }}</p>
        </div>
        <div v-if="activityError" class="alert alert--error">{{ activityError }}</div>
      </form>
      <template #footer>
        <button class="btn btn-secondary" type="button" :disabled="activitySaving" @click="activityOpen = false">Cancelar</button>
        <button class="btn btn-primary" type="submit" form="activity-form" :disabled="activitySaving">
          <span v-if="activitySaving" class="spinner spinner--sm" aria-hidden="true"></span>
          {{ activitySaving ? 'Creando…' : 'Crear actividad' }}
        </button>
      </template>
    </ModalDialog>

    <ModalDialog
      :open="taskOpen"
      title="Nueva tarea"
      subtitle="Asigná una tarea concreta a una persona de la cooperativa."
      @close="taskOpen = false"
    >
      <form id="task-form" class="form-stack" novalidate @submit.prevent="saveTask">
        <div class="field">
          <label for="task-actividad-form">Actividad</label>
          <select id="task-actividad-form" v-model="taskForm.actividadId" class="select" :aria-invalid="Boolean(taskErrors.actividadId)">
            <option value="" disabled>Elegí una actividad</option>
            <option v-for="item in actividades" :key="item.id" :value="item.id">{{ item.titulo }}</option>
          </select>
          <p v-if="taskErrors.actividadId" class="field-error">{{ taskErrors.actividadId }}</p>
        </div>
        <div class="field">
          <label for="task-titulo">Título de la tarea</label>
          <input
            id="task-titulo"
            v-model="taskForm.titulo"
            class="input"
            type="text"
            maxlength="120"
            placeholder="Ej.: preparar etiquetas"
            :aria-invalid="Boolean(taskErrors.titulo)"
          />
          <p v-if="taskErrors.titulo" class="field-error">{{ taskErrors.titulo }}</p>
        </div>
        <div class="field">
          <label for="task-descripcion">Indicaciones <span class="label-optional">(opcional)</span></label>
          <textarea id="task-descripcion" v-model="taskForm.descripcion" class="textarea" rows="3" maxlength="400"></textarea>
        </div>
        <div class="form-grid">
          <div class="field">
            <label for="task-asignado">Asignar a</label>
            <select id="task-asignado" v-model="taskForm.asignadoId" class="select" :aria-invalid="Boolean(taskErrors.asignadoId)">
              <option value="" disabled>Elegí una persona</option>
              <option v-for="integrante in usuarios" :key="integrante.id" :value="integrante.id">
                {{ integrante.nombre }} {{ integrante.apellido }} · {{ integrante.curso }}
              </option>
            </select>
            <p v-if="taskErrors.asignadoId" class="field-error">{{ taskErrors.asignadoId }}</p>
          </div>
          <div class="field">
            <label for="task-fecha">Fecha límite</label>
            <input id="task-fecha" v-model="taskForm.fechaLimite" class="input" type="date" :min="hoy" :aria-invalid="Boolean(taskErrors.fechaLimite)" />
            <p v-if="taskErrors.fechaLimite" class="field-error">{{ taskErrors.fechaLimite }}</p>
          </div>
        </div>
        <div v-if="taskError" class="alert alert--error">{{ taskError }}</div>
      </form>
      <template #footer>
        <button class="btn btn-secondary" type="button" :disabled="taskSaving" @click="taskOpen = false">Cancelar</button>
        <button class="btn btn-primary" type="submit" form="task-form" :disabled="taskSaving">
          <span v-if="taskSaving" class="spinner spinner--sm" aria-hidden="true"></span>
          {{ taskSaving ? 'Asignando…' : 'Crear tarea' }}
        </button>
      </template>
    </ModalDialog>

    <ConfirmDialog
      :open="archiveOpen"
      title="Archivar tarea"
      :message="archiveTarget ? `La tarea “${archiveTarget.titulo}” dejará de mostrarse, pero se conserva en el historial.` : ''"
      confirm-label="Sí, archivar"
      danger
      :loading="archiving"
      @close="archiveOpen = false"
      @confirm="confirmArchive"
    />
  </div>
</template>
