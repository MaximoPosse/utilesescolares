<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useAuth } from '../stores/auth.js'
import { notify } from '../stores/toast.js'
import { api, IS_DEMO } from '../services/api.js'
import { ESTADOS_UTIL, TIPO_UTIL_OPTIONS, TIPOS_UTIL } from '../data/constants.js'
import { formatDate } from '../data/utils.js'
import PageHeader from '../components/PageHeader.vue'
import StatCard from '../components/StatCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import EmptyState from '../components/EmptyState.vue'
import ModalDialog from '../components/ModalDialog.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const auth = useAuth()
const user = computed(() => auth.state.user)

const utiles = ref([])
const loading = ref(true)
const loadError = ref('')
const search = ref('')
const tipo = ref('')
const estado = ref('')
const showInactive = ref(false)

const modalOpen = ref(false)
const editingId = ref(null)
const saving = ref(false)
const formError = ref('')
const errors = reactive({})
const form = reactive({
  codigo: '',
  nombre: '',
  tipo: '',
  estado: 'Disponible',
  cantidadTotal: 1,
  cantidadDisponible: 1,
  ubicacion: '',
  observaciones: '',
  origen: 'cooperativa',
})

const changeOpen = ref(false)
const changeTarget = ref(null)
const changeAction = ref('baja')
const changing = ref(false)

const typeMeta = Object.fromEntries(TIPOS_UTIL.map((t) => [t.value, t]))

const activos = computed(() => utiles.value.filter((u) => u.activo))
const inactivos = computed(() => utiles.value.filter((u) => !u.activo))
const disponibles = computed(() => activos.value.filter((u) => u.disponible))
const unidadesTotales = computed(() =>
  activos.value.reduce((sum, u) => sum + Number(u.cantidadTotal || 0), 0),
)
const unidadesDisponibles = computed(() =>
  disponibles.value.reduce((sum, u) => sum + Number(u.cantidadDisponible || 0), 0),
)
const requierenRevision = computed(() =>
  activos.value.filter((u) => ['Dañado', 'En reparación'].includes(u.estado)),
)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return utiles.value
    .filter((util) => {
      if (!showInactive.value && !util.activo) return false
      if (showInactive.value && util.activo) return false
      if (tipo.value && util.tipo !== tipo.value) return false
      if (estado.value && util.estado !== estado.value) return false
      if (q && !`${util.nombre} ${util.codigo} ${util.tipo} ${util.ubicacion} ${util.observaciones}`.toLowerCase().includes(q)) return false
      return true
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }))
})

function openCreate() {
  editingId.value = null
  Object.assign(form, {
    codigo: '',
    nombre: '',
    tipo: '',
    estado: 'Disponible',
    cantidadTotal: 1,
    cantidadDisponible: 1,
    ubicacion: '',
    observaciones: '',
    origen: 'cooperativa',
  })
  formError.value = ''
  Object.keys(errors).forEach((key) => delete errors[key])
  modalOpen.value = true
}

function openEdit(util) {
  editingId.value = util.id
  Object.assign(form, {
    codigo: util.codigo,
    nombre: util.nombre,
    tipo: util.tipo,
    estado: util.estado,
    cantidadTotal: util.cantidadTotal,
    cantidadDisponible: util.cantidadDisponible,
    ubicacion: util.ubicacion,
    observaciones: util.observaciones,
    origen: util.origen || 'cooperativa',
  })
  formError.value = ''
  Object.keys(errors).forEach((key) => delete errors[key])
  modalOpen.value = true
}

function validate() {
  Object.keys(errors).forEach((key) => delete errors[key])
  formError.value = ''
  let ok = true
  if (!form.codigo.trim()) {
    errors.codigo = 'El código es obligatorio.'
    ok = false
  }
  if (!form.nombre.trim()) {
    errors.nombre = 'El nombre es obligatorio.'
    ok = false
  }
  if (!form.tipo) {
    errors.tipo = 'Elegí un tipo de útil.'
    ok = false
  }
  if (!form.ubicacion.trim()) {
    errors.ubicacion = 'Indicá dónde se guarda el útil.'
    ok = false
  }
  const total = Number(form.cantidadTotal)
  const disponible = Number(form.cantidadDisponible)
  if (!Number.isInteger(total) || total < 1) {
    errors.cantidadTotal = 'La cantidad total debe ser un entero mayor a 0.'
    ok = false
  }
  if (!Number.isInteger(disponible) || disponible < 0) {
    errors.cantidadDisponible = 'La cantidad disponible debe ser 0 o más.'
    ok = false
  } else if (Number.isInteger(total) && disponible > total) {
    errors.cantidadDisponible = 'La cantidad disponible no puede superar la total.'
    ok = false
  }
  return ok
}

async function save() {
  if (!validate()) return
  saving.value = true
  try {
    const payload = {
      codigo: form.codigo.trim(),
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      estado: form.estado,
      cantidadTotal: Number(form.cantidadTotal),
      cantidadDisponible: Number(form.cantidadDisponible),
      ubicacion: form.ubicacion.trim(),
      observaciones: form.observaciones.trim(),
      origen: form.origen,
    }
    if (editingId.value) {
      await api.actualizarUtil(editingId.value, payload, user.value.id)
      notify('Útil actualizado en el inventario.', 'success')
    } else {
      await api.crearUtil(payload, user.value.id)
      notify('Útil agregado al inventario.', 'success')
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

function openChange(util, action) {
  changeTarget.value = util
  changeAction.value = action
  changeOpen.value = true
}

async function confirmChange() {
  if (!changeTarget.value) return
  changing.value = true
  try {
    if (changeAction.value === 'baja') {
      await api.bajaLogicaUtil(changeTarget.value.id, user.value.id)
      notify('Útil dado de baja. Se conserva en el historial del inventario.', 'success')
    } else {
      await api.reactivarUtil(changeTarget.value.id, user.value.id)
      notify('Útil reactivado y disponible nuevamente en el catálogo.', 'success')
    }
    changeOpen.value = false
    await load()
  } catch (error) {
    notify(error.message, 'error')
  } finally {
    changing.value = false
  }
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    utiles.value = await api.listUtiles({ includeInactive: true })
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
      eyebrow="Comisión de administración"
      title="Inventario"
      subtitle="Alta, edición y baja lógica de útiles. Ningún registro se elimina: los retirados quedan como historial."
    >
      <template #actions>
        <span v-if="IS_DEMO" class="demo-badge">Datos de prueba</span>
        <button class="btn btn-primary" type="button" @click="openCreate">+ Agregar útil</button>
      </template>
    </PageHeader>

    <section class="stats-row stats-row--four" aria-label="Resumen del inventario">
      <StatCard label="Útiles activos" :value="activos.length" hint="Fichas publicadas en el catálogo" icon="▦" tone="info" />
      <StatCard label="Unidades disponibles" :value="unidadesDisponibles" :hint="`${unidadesTotales} unidades en total`" icon="✓" tone="success" />
      <StatCard label="Requieren revisión" :value="requierenRevision.length" hint="Dañados o en reparación" icon="!" :tone="requierenRevision.length ? 'warning' : 'success'" />
      <StatCard label="Dados de baja" :value="inactivos.length" hint="Fuera del catálogo, con historial" icon="⌫" tone="neutral" />
    </section>

    <section class="filter-bar" aria-label="Filtros del inventario">
      <div class="search-field">
        <span class="search-field__icon" aria-hidden="true">⌕</span>
        <label for="inventory-search" class="sr-only">Buscar útil</label>
        <input id="inventory-search" v-model="search" class="input" type="search" placeholder="Buscar por nombre, código o ubicación…" />
      </div>
      <div class="field field--compact">
        <label for="inventory-tipo">Tipo</label>
        <select id="inventory-tipo" v-model="tipo" class="select">
          <option value="">Todos</option>
          <option v-for="option in TIPO_UTIL_OPTIONS" :key="option" :value="option">{{ option }}</option>
        </select>
      </div>
      <div class="field field--compact">
        <label for="inventory-estado">Estado</label>
        <select id="inventory-estado" v-model="estado" class="select">
          <option value="">Todos</option>
          <option v-for="option in ESTADOS_UTIL" :key="option" :value="option">{{ option }}</option>
        </select>
      </div>
      <label class="checkbox-row filter-checkbox">
        <input v-model="showInactive" type="checkbox" />
        <span>Ver dados de baja ({{ inactivos.length }})</span>
      </label>
    </section>

    <div class="summary-bar">
      <p>
        <strong>{{ filtered.length }}</strong>
        {{ filtered.length === 1 ? 'ficha' : 'fichas' }}
        <span v-if="showInactive">dadas de baja</span>
        <span v-else>activas</span>
      </p>
      <p class="hint">Los útiles dañados o en reparación no se prestan aunque tengan unidades cargadas.</p>
    </div>

    <LoadingBlock v-if="loading" label="Cargando el inventario…" />
    <div v-else-if="loadError" class="alert alert--error">{{ loadError }}</div>

    <template v-else>
      <section v-if="filtered.length" class="panel">
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Útil</th>
                <th>Tipo</th>
                <th class="cell-right">Unidades</th>
                <th>Estado</th>
                <th>Ubicación</th>
                <th class="cell-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="util in filtered" :key="util.id" :class="{ 'row--muted': !util.activo }">
                <td data-label="Código"><strong>{{ util.codigo }}</strong></td>
                <td data-label="Útil">
                  <div class="cell-stack">
                    <strong>{{ util.nombre }}</strong>
                    <small>{{ util.duenoNombre }} · {{ util.origen === 'donacion' ? 'Donación' : util.origen === 'intercambio' ? 'Intercambio' : 'Cooperativa' }}</small>
                  </div>
                </td>
                <td data-label="Tipo">
                  <span class="tag">{{ typeMeta[util.tipo]?.icon }} {{ util.tipo }}</span>
                </td>
                <td data-label="Unidades" class="cell-right">
                  <strong>{{ util.cantidadDisponible }} / {{ util.cantidadTotal }}</strong>
                  <small class="block-note">disponibles</small>
                </td>
                <td data-label="Estado">
                  <StatusBadge kind="util" :estado="util.estado" />
                  <small v-if="!util.activo" class="cell-note text-danger">Baja lógica</small>
                </td>
                <td data-label="Ubicación">
                  <div class="cell-stack">
                    <span>{{ util.ubicacion }}</span>
                    <small>Creado el {{ formatDate(util.createdAt, { withYear: true }) }}</small>
                  </div>
                </td>
                <td data-label="Acciones" class="cell-actions">
                  <button class="btn btn-sm btn-secondary" type="button" @click="openEdit(util)">Editar</button>
                  <button
                    v-if="util.activo"
                    class="btn btn-sm btn-ghost"
                    type="button"
                    @click="openChange(util, 'baja')"
                  >
                    Dar de baja
                  </button>
                  <button
                    v-else
                    class="btn btn-sm btn-secondary"
                    type="button"
                    @click="openChange(util, 'alta')"
                  >
                    Reactivar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div v-else class="panel">
        <EmptyState
          icon="▦"
          :title="showInactive ? 'No hay útiles dados de baja' : 'No hay útiles en el inventario'"
          :text="showInactive
            ? 'Los útiles que des de baja van a quedar acá para conservar el historial.'
            : 'Agregá el primer útil para que los estudiantes puedan solicitarlo.'"
        >
          <button v-if="!showInactive" class="btn btn-primary" type="button" @click="openCreate">
            Agregar el primer útil
          </button>
        </EmptyState>
      </div>
    </template>

    <ModalDialog
      :open="modalOpen"
      :title="editingId ? 'Editar útil' : 'Agregar útil al inventario'"
      subtitle="El código es único. La cantidad disponible se descuenta al registrar entregas y se repone al controlar devoluciones en buen estado."
      @close="modalOpen = false"
    >
      <form id="util-form" class="form-stack" novalidate @submit.prevent="save">
        <div class="form-grid">
          <div class="field">
            <label for="util-codigo">Código</label>
            <input
              id="util-codigo"
              v-model="form.codigo"
              class="input"
              type="text"
              maxlength="20"
              placeholder="U-021"
              :aria-invalid="Boolean(errors.codigo)"
            />
            <p v-if="errors.codigo" class="field-error">{{ errors.codigo }}</p>
          </div>
          <div class="field">
            <label for="util-tipo">Tipo</label>
            <select id="util-tipo" v-model="form.tipo" class="select" :aria-invalid="Boolean(errors.tipo)">
              <option value="" disabled>Elegí un tipo</option>
              <option v-for="option in TIPO_UTIL_OPTIONS" :key="option" :value="option">{{ option }}</option>
            </select>
            <p v-if="errors.tipo" class="field-error">{{ errors.tipo }}</p>
          </div>
        </div>

        <div class="field">
          <label for="util-nombre">Nombre</label>
          <input
            id="util-nombre"
            v-model="form.nombre"
            class="input"
            type="text"
            maxlength="120"
            placeholder="Ej.: regla de 30 cm"
            :aria-invalid="Boolean(errors.nombre)"
          />
          <p v-if="errors.nombre" class="field-error">{{ errors.nombre }}</p>
        </div>

        <div class="form-grid form-grid--three">
          <div class="field">
            <label for="util-estado">Estado</label>
            <select id="util-estado" v-model="form.estado" class="select">
              <option v-for="option in ESTADOS_UTIL" :key="option" :value="option">{{ option }}</option>
            </select>
          </div>
          <div class="field">
            <label for="util-total">Cantidad total</label>
            <input
              id="util-total"
              v-model.number="form.cantidadTotal"
              class="input"
              type="number"
              min="1"
              step="1"
              :aria-invalid="Boolean(errors.cantidadTotal)"
            />
            <p v-if="errors.cantidadTotal" class="field-error">{{ errors.cantidadTotal }}</p>
          </div>
          <div class="field">
            <label for="util-disponible">Cantidad disponible</label>
            <input
              id="util-disponible"
              v-model.number="form.cantidadDisponible"
              class="input"
              type="number"
              min="0"
              step="1"
              :aria-invalid="Boolean(errors.cantidadDisponible)"
            />
            <p v-if="errors.cantidadDisponible" class="field-error">{{ errors.cantidadDisponible }}</p>
          </div>
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="util-ubicacion">Ubicación</label>
            <input
              id="util-ubicacion"
              v-model="form.ubicacion"
              class="input"
              type="text"
              maxlength="120"
              placeholder="Armario A · caja 1"
              :aria-invalid="Boolean(errors.ubicacion)"
            />
            <p v-if="errors.ubicacion" class="field-error">{{ errors.ubicacion }}</p>
          </div>
          <div class="field">
            <label for="util-origen">Origen</label>
            <select id="util-origen" v-model="form.origen" class="select">
              <option value="cooperativa">Cooperativa</option>
              <option value="donacion">Donación</option>
              <option value="intercambio">Intercambio</option>
            </select>
          </div>
        </div>

        <div class="field">
          <label for="util-observaciones">Observaciones <span class="label-optional">(opcional)</span></label>
          <textarea
            id="util-observaciones"
            v-model="form.observaciones"
            class="textarea"
            rows="3"
            maxlength="300"
            placeholder="Estado, piezas incluidas, cuidados especiales…"
          ></textarea>
        </div>

        <div v-if="formError" class="alert alert--error">{{ formError }}</div>
      </form>
      <template #footer>
        <button class="btn btn-secondary" type="button" :disabled="saving" @click="modalOpen = false">Cancelar</button>
        <button class="btn btn-primary" type="submit" form="util-form" :disabled="saving">
          <span v-if="saving" class="spinner spinner--sm" aria-hidden="true"></span>
          {{ saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Agregar útil' }}
        </button>
      </template>
    </ModalDialog>

    <ConfirmDialog
      :open="changeOpen"
      :title="changeAction === 'baja' ? 'Dar de baja el útil' : 'Reactivar el útil'"
      :message="changeTarget
        ? changeAction === 'baja'
          ? `“${changeTarget.nombre}” dejará de aparecer en el catálogo. No se elimina: podés reactivarlo y conserva su historial.`
          : `“${changeTarget.nombre}” volverá a mostrarse en el catálogo. Revisá que el estado y las cantidades sean correctos.`
        : ''"
      :confirm-label="changeAction === 'baja' ? 'Sí, dar de baja' : 'Sí, reactivar'"
      :danger="changeAction === 'baja'"
      :loading="changing"
      @close="changeOpen = false"
      @confirm="confirmChange"
    />
  </div>
</template>
