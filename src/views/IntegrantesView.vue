<script setup>
import { computed, onMounted, ref } from 'vue'
import { useAuth } from '../stores/auth.js'
import { notify } from '../stores/toast.js'
import { api, IS_DEMO } from '../services/api.js'
import { ROLES, ROL_OPTIONS } from '../data/constants.js'
import { formatDate, initials } from '../data/utils.js'
import PageHeader from '../components/PageHeader.vue'
import StatCard from '../components/StatCard.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import EmptyState from '../components/EmptyState.vue'
import ModalDialog from '../components/ModalDialog.vue'

const auth = useAuth()
const user = computed(() => auth.state.user)

const usuarios = ref([])
const loading = ref(true)
const loadError = ref('')
const search = ref('')
const roleFilter = ref('')

const roleOpen = ref(false)
const roleTarget = ref(null)
const roleValue = ref('estudiante')
const roleError = ref('')
const savingRole = ref(false)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return usuarios.value.filter((integrante) => {
    if (roleFilter.value && integrante.rol !== roleFilter.value) return false
    if (q && !`${integrante.nombre} ${integrante.apellido} ${integrante.curso} ${integrante.email}`.toLowerCase().includes(q)) return false
    return true
  })
})

const total = computed(() => usuarios.value.length)
const estudiantes = computed(() => usuarios.value.filter((u) => u.rol === 'estudiante').length)
const conRol = computed(() => total.value - estudiantes.value)
const cursos = computed(() => new Set(usuarios.value.map((u) => u.curso)).size)

const roleCounts = computed(() =>
  ROL_OPTIONS.map((option) => ({
    ...option,
    count: usuarios.value.filter((u) => u.rol === option.value).length,
  })).filter((option) => option.count > 0),
)

const assignableRoles = ROL_OPTIONS

function openRole(integrante) {
  roleTarget.value = integrante
  roleValue.value = integrante.rol
  roleError.value = ''
  roleOpen.value = true
}

async function saveRole() {
  if (!roleTarget.value) return
  if (!roleValue.value) {
    roleError.value = 'Elegí un rol.'
    return
  }
  if (roleValue.value === roleTarget.value.rol) {
    roleError.value = 'La persona ya tiene ese rol.'
    return
  }
  savingRole.value = true
  try {
    await auth.asignarRol(roleTarget.value.id, roleValue.value)
    notify(`Rol actualizado: ${roleTarget.value.nombre} ahora es ${ROLES[roleValue.value]?.label}.`, 'success')
    roleOpen.value = false
    await load()
  } catch (error) {
    roleError.value = error.message
    notify(error.message, 'error')
  } finally {
    savingRole.value = false
  }
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    usuarios.value = await api.listUsuarios()
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
      eyebrow="Presidencia"
      title="Integrantes"
      subtitle="Todas las cuentas nuevas ingresan como estudiantes. Solo presidencia puede asignar los roles de la cooperativa."
    >
      <template #actions>
        <span v-if="IS_DEMO" class="demo-badge">Datos de prueba</span>
        <RouterLink to="/estadisticas" class="btn btn-secondary">Ver estadísticas</RouterLink>
      </template>
    </PageHeader>

    <div class="alert alert--info">
      <strong>Cómo funcionan los roles:</strong> el registro siempre crea estudiantes. La asignación de
      presidencia, secretaría, tesorería y comisiones se hace únicamente desde esta pantalla y queda
      registrada con fecha.
    </div>

    <section class="stats-row stats-row--four" aria-label="Resumen de integrantes">
      <StatCard label="Integrantes" :value="total" hint="Cuentas activas" icon="☺" tone="info" />
      <StatCard label="Estudiantes" :value="estudiantes" hint="Rol base" icon="🌱" tone="success" />
      <StatCard label="Con rol asignado" :value="conRol" hint="Presidencia, secretaría y comisiones" icon="★" tone="warning" />
      <StatCard label="Cursos" :value="cursos" hint="Cursos representados" icon="▤" tone="neutral" />
    </section>

    <section class="panel">
      <div class="section-heading section-heading--tight">
        <div>
          <p class="eyebrow">Composición</p>
          <h2>Roles activos</h2>
        </div>
      </div>
      <div class="role-chip-row">
        <span v-for="item in roleCounts" :key="item.value" class="role-chip">
          {{ item.label }}
          <strong>{{ item.count }}</strong>
        </span>
      </div>
    </section>

    <section class="filter-bar" aria-label="Filtros de integrantes">
      <div class="search-field">
        <span class="search-field__icon" aria-hidden="true">⌕</span>
        <label for="member-search" class="sr-only">Buscar integrante</label>
        <input id="member-search" v-model="search" class="input" type="search" placeholder="Buscar por nombre, curso o correo…" />
      </div>
      <div class="field field--compact">
        <label for="member-role">Rol</label>
        <select id="member-role" v-model="roleFilter" class="select">
          <option value="">Todos los roles</option>
          <option v-for="option in ROL_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </div>
    </section>

    <div class="summary-bar">
      <p><strong>{{ filtered.length }}</strong> {{ filtered.length === 1 ? 'integrante' : 'integrantes' }}</p>
      <p class="hint">Cambiar un rol modifica los permisos de acceso en el próximo inicio de sesión.</p>
    </div>

    <LoadingBlock v-if="loading" label="Cargando integrantes…" />
    <div v-else-if="loadError" class="alert alert--error">{{ loadError }}</div>

    <template v-else>
      <section v-if="filtered.length" class="panel">
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Integrante</th>
                <th>Curso</th>
                <th>Correo</th>
                <th>Rol actual</th>
                <th>Alta</th>
                <th class="cell-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="integrante in filtered" :key="integrante.id">
                <td data-label="Integrante">
                  <div class="person-cell">
                    <span class="avatar avatar--sm" aria-hidden="true">{{ initials(integrante.nombre, integrante.apellido) }}</span>
                    <div class="cell-stack">
                      <strong>{{ integrante.nombre }} {{ integrante.apellido }}</strong>
                      <small v-if="integrante.id === user.id">Tu cuenta</small>
                      <small v-else>ID {{ integrante.id }}</small>
                    </div>
                  </div>
                </td>
                <td data-label="Curso">{{ integrante.curso }}</td>
                <td data-label="Correo"><span class="muted">{{ integrante.email }}</span></td>
                <td data-label="Rol actual">
                  <span class="role-badge" :class="`role-badge--${integrante.rol}`">
                    {{ ROLES[integrante.rol]?.label || integrante.rol }}
                  </span>
                </td>
                <td data-label="Alta">{{ formatDate(integrante.createdAt, { withYear: true }) }}</td>
                <td data-label="Acciones" class="cell-actions">
                  <button class="btn btn-sm btn-secondary" type="button" @click="openRole(integrante)">
                    Cambiar rol
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div v-else class="panel">
        <EmptyState
          icon="☺"
          title="No hay integrantes con esos filtros"
          text="Probá con otro nombre, curso o rol."
        />
      </div>
    </template>

    <ModalDialog
      :open="roleOpen"
      title="Cambiar rol"
      subtitle="El rol define qué secciones y acciones puede usar la persona."
      size="sm"
      @close="roleOpen = false"
    >
      <form id="role-form" class="form-stack" novalidate @submit.prevent="saveRole">
        <div v-if="roleTarget" class="person-summary">
          <span class="avatar" aria-hidden="true">{{ initials(roleTarget.nombre, roleTarget.apellido) }}</span>
          <div>
            <strong>{{ roleTarget.nombre }} {{ roleTarget.apellido }}</strong>
            <p>{{ roleTarget.curso }} · {{ roleTarget.email }}</p>
          </div>
        </div>

        <div class="field">
          <label for="role-select">Nuevo rol</label>
          <select id="role-select" v-model="roleValue" class="select">
            <option v-for="option in assignableRoles" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <p class="hint">{{ ROLES[roleValue]?.descripcion }}</p>
          <p v-if="roleError" class="field-error">{{ roleError }}</p>
        </div>

        <div v-if="roleTarget?.id === user.id" class="alert alert--warning">
          Estás por cambiar tu propio rol. Si dejás de ser presidencia, vas a perder acceso a esta
          pantalla. En la demostración podés recuperarlo desde el selector de rol.
        </div>
        <div v-else class="alert alert--info">
          La persona va a ver las secciones correspondientes al nuevo rol en su próximo inicio de sesión.
        </div>
      </form>
      <template #footer>
        <button class="btn btn-secondary" type="button" :disabled="savingRole" @click="roleOpen = false">Cancelar</button>
        <button class="btn btn-primary" type="submit" form="role-form" :disabled="savingRole">
          <span v-if="savingRole" class="spinner spinner--sm" aria-hidden="true"></span>
          {{ savingRole ? 'Guardando…' : 'Guardar rol' }}
        </button>
      </template>
    </ModalDialog>
  </div>
</template>
