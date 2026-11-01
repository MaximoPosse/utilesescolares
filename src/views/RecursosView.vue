<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useAuth } from '../stores/auth.js'
import { notify } from '../stores/toast.js'
import { api, IS_DEMO } from '../services/api.js'
import { formatDate, money, todayISO } from '../data/utils.js'
import PageHeader from '../components/PageHeader.vue'
import StatCard from '../components/StatCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import EmptyState from '../components/EmptyState.vue'
import ModalDialog from '../components/ModalDialog.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const auth = useAuth()
const user = computed(() => auth.state.user)
const canManage = computed(() => auth.permisos.value.recursos)

const movimientos = ref([])
const loading = ref(true)
const loadError = ref('')
const search = ref('')
const tipo = ref('')
const showArchived = ref(false)

const modalOpen = ref(false)
const saving = ref(false)
const formError = ref('')
const errors = reactive({})
const form = reactive({
  fecha: todayISO(),
  concepto: '',
  tipo: 'ingreso',
  monto: '',
})

const archiveOpen = ref(false)
const archiveTarget = ref(null)
const archiving = ref(false)

const activeMovements = computed(() => movimientos.value.filter((m) => m.activo))
const archivedCount = computed(() => movimientos.value.filter((m) => !m.activo).length)
const ingresos = computed(() =>
  activeMovements.value.filter((m) => m.tipo === 'ingreso').reduce((sum, m) => sum + Number(m.monto), 0),
)
const egresos = computed(() =>
  activeMovements.value.filter((m) => m.tipo === 'egreso').reduce((sum, m) => sum + Number(m.monto), 0),
)
const saldo = computed(() => ingresos.value - egresos.value)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return movimientos.value.filter((movimiento) => {
    if (!showArchived.value && !movimiento.activo) return false
    if (showArchived.value && movimiento.activo) return false
    if (tipo.value && movimiento.tipo !== tipo.value) return false
    if (q && !`${movimiento.concepto} ${movimiento.registradoPorNombre}`.toLowerCase().includes(q)) return false
    return true
  })
})

function openCreate() {
  form.fecha = todayISO()
  form.concepto = ''
  form.tipo = 'ingreso'
  form.monto = ''
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
  if (!form.concepto.trim()) {
    errors.concepto = 'Escribí el concepto del movimiento.'
    ok = false
  }
  const monto = Number(form.monto)
  if (!Number.isFinite(monto) || monto <= 0) {
    errors.monto = 'El monto debe ser un número mayor a 0.'
    ok = false
  }
  return ok
}

async function save() {
  if (!validate()) return
  saving.value = true
  try {
    await api.crearMovimiento({
      fecha: form.fecha,
      concepto: form.concepto.trim(),
      tipo: form.tipo,
      monto: Number(form.monto),
      actorId: user.value.id,
    }, user.value.id)
    notify('Movimiento registrado en el libro de tesorería.', 'success')
    modalOpen.value = false
    await load()
  } catch (error) {
    formError.value = error.message
    notify(error.message, 'error')
  } finally {
    saving.value = false
  }
}

function openArchive(movimiento) {
  archiveTarget.value = movimiento
  archiveOpen.value = true
}

async function confirmArchive() {
  if (!archiveTarget.value) return
  archiving.value = true
  try {
    await api.anularMovimiento(archiveTarget.value.id, user.value.id)
    notify('Movimiento anulado. Se conserva en el historial y no afecta el saldo.', 'success')
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
    movimientos.value = await api.listMovimientos({ includeInactive: canManage.value })
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
      eyebrow="Tesorería"
      title="Recursos de la cooperativa"
      subtitle="Ingresos, egresos y saldo. Los movimientos con error se anulan con baja lógica para no perder el historial."
    >
      <template #actions>
        <span v-if="IS_DEMO" class="demo-badge">Datos de prueba</span>
        <button v-if="canManage" class="btn btn-primary" type="button" @click="openCreate">
          + Registrar movimiento
        </button>
      </template>
    </PageHeader>

    <section class="stats-row stats-row--four" aria-label="Resumen de tesorería">
      <StatCard label="Saldo actual" :value="money(saldo)" hint="Ingresos activos menos egresos activos" icon="$" :tone="saldo >= 0 ? 'success' : 'danger'" />
      <StatCard label="Ingresos" :value="money(ingresos)" hint="Movimientos activos" icon="↗" tone="info" />
      <StatCard label="Egresos" :value="money(egresos)" hint="Movimientos activos" icon="↘" tone="warning" />
      <StatCard label="Registros" :value="activeMovements.length" hint="Movimientos vigentes" icon="▤" tone="neutral" />
    </section>

    <section class="filter-bar" aria-label="Filtros de movimientos">
      <div class="search-field">
        <span class="search-field__icon" aria-hidden="true">⌕</span>
        <label for="mov-search" class="sr-only">Buscar movimiento</label>
        <input id="mov-search" v-model="search" class="input" type="search" placeholder="Buscar por concepto o responsable…" />
      </div>
      <div class="field field--compact">
        <label for="mov-tipo">Tipo</label>
        <select id="mov-tipo" v-model="tipo" class="select">
          <option value="">Todos</option>
          <option value="ingreso">Ingresos</option>
          <option value="egreso">Egresos</option>
        </select>
      </div>
      <label v-if="canManage && archivedCount" class="checkbox-row filter-checkbox">
        <input v-model="showArchived" type="checkbox" />
        <span>Ver anulados ({{ archivedCount }})</span>
      </label>
    </section>

    <div class="summary-bar">
      <p>
        <strong>{{ filtered.length }}</strong>
        {{ filtered.length === 1 ? 'movimiento' : 'movimientos' }}
        <span v-if="showArchived">anulados</span>
        <span v-else>vigentes</span>
      </p>
      <p v-if="!canManage" class="hint">Solo tesorería puede registrar o anular movimientos.</p>
    </div>

    <LoadingBlock v-if="loading" label="Cargando el libro de tesorería…" />
    <div v-else-if="loadError" class="alert alert--error">{{ loadError }}</div>

    <template v-else>
      <section v-if="filtered.length" class="panel">
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Tipo</th>
                <th class="cell-right">Monto</th>
                <th>Registrado por</th>
                <th v-if="canManage" class="cell-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="movimiento in filtered" :key="movimiento.id" :class="{ 'row--muted': !movimiento.activo }">
                <td data-label="Fecha">{{ formatDate(movimiento.fecha, { withYear: true }) }}</td>
                <td data-label="Concepto">
                  <div class="cell-stack">
                    <strong>{{ movimiento.concepto }}</strong>
                    <small v-if="!movimiento.activo" class="text-danger">Anulado · no afecta el saldo</small>
                  </div>
                </td>
                <td data-label="Tipo"><StatusBadge kind="movimiento" :estado="movimiento.tipo" /></td>
                <td data-label="Monto" class="cell-right money" :class="movimiento.tipo === 'ingreso' ? 'money--in' : 'money--out'">
                  {{ movimiento.tipo === 'ingreso' ? '+' : '−' }}{{ money(movimiento.monto) }}
                </td>
                <td data-label="Registrado por">{{ movimiento.registradoPorNombre }}</td>
                <td v-if="canManage" data-label="Acciones" class="cell-actions">
                  <button v-if="movimiento.activo" class="btn btn-sm btn-ghost" type="button" @click="openArchive(movimiento)">
                    Anular
                  </button>
                  <span v-else class="tag tag--muted">Anulado</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div v-else class="panel">
        <EmptyState
          icon="💰"
          :title="showArchived ? 'No hay movimientos anulados' : 'No hay movimientos registrados'"
          text="Tesorería registra ingresos y egresos para llevar el balance de la cooperativa."
        >
          <button v-if="canManage && !showArchived" class="btn btn-primary" type="button" @click="openCreate">
            Registrar el primer movimiento
          </button>
        </EmptyState>
      </div>
    </template>

    <ModalDialog
      :open="modalOpen"
      title="Registrar movimiento"
      subtitle="Ingresos y egresos quedan en el libro de tesorería con fecha y responsable."
      @close="modalOpen = false"
    >
      <form id="movimiento-form" class="form-stack" novalidate @submit.prevent="save">
        <div class="form-grid">
          <div class="field">
            <label for="mov-fecha">Fecha</label>
            <input id="mov-fecha" v-model="form.fecha" class="input" type="date" :aria-invalid="Boolean(errors.fecha)" />
            <p v-if="errors.fecha" class="field-error">{{ errors.fecha }}</p>
          </div>
          <div class="field">
            <label for="mov-form-tipo">Tipo</label>
            <select id="mov-form-tipo" v-model="form.tipo" class="select">
              <option value="ingreso">Ingreso</option>
              <option value="egreso">Egreso</option>
            </select>
          </div>
        </div>

        <div class="field">
          <label for="mov-concepto">Concepto</label>
          <input
            id="mov-concepto"
            v-model="form.concepto"
            class="input"
            type="text"
            maxlength="120"
            placeholder="Ej.: compra de hojas A4"
            :aria-invalid="Boolean(errors.concepto)"
          />
          <p v-if="errors.concepto" class="field-error">{{ errors.concepto }}</p>
        </div>

        <div class="field">
          <label for="mov-monto">Monto en pesos</label>
          <input
            id="mov-monto"
            v-model="form.monto"
            class="input"
            type="number"
            min="0.01"
            step="0.01"
            inputmode="decimal"
            placeholder="0"
            :aria-invalid="Boolean(errors.monto)"
          />
          <p v-if="errors.monto" class="field-error">{{ errors.monto }}</p>
        </div>

        <div v-if="formError" class="alert alert--error">{{ formError }}</div>
      </form>
      <template #footer>
        <button class="btn btn-secondary" type="button" :disabled="saving" @click="modalOpen = false">Cancelar</button>
        <button class="btn btn-primary" type="submit" form="movimiento-form" :disabled="saving">
          <span v-if="saving" class="spinner spinner--sm" aria-hidden="true"></span>
          {{ saving ? 'Guardando…' : 'Guardar movimiento' }}
        </button>
      </template>
    </ModalDialog>

    <ConfirmDialog
      :open="archiveOpen"
      title="Anular movimiento"
      :message="archiveTarget ? `El movimiento “${archiveTarget.concepto}” por ${money(archiveTarget.monto)} dejará de afectar el saldo, pero se conserva en el historial.` : ''"
      confirm-label="Sí, anular"
      danger
      :loading="archiving"
      @close="archiveOpen = false"
      @confirm="confirmArchive"
    />
  </div>
</template>
