<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { api, IS_DEMO } from '../services/api.js'
import { notify } from '../stores/toast.js'
import { TIPOS_UTIL, TIPO_UTIL_OPTIONS } from '../data/constants.js'
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import EmptyState from '../components/EmptyState.vue'

const utiles = ref([])
const loading = ref(true)
const loadError = ref('')
const search = ref('')
const tipo = ref('')
const disponibilidad = ref('')

const typeMeta = Object.fromEntries(TIPOS_UTIL.map((t) => [t.value, t]))

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return utiles.value.filter((util) => {
    if (!util.activo) return false
    if (tipo.value && util.tipo !== tipo.value) return false
    if (disponibilidad.value === 'disponible' && !util.disponible) return false
    if (disponibilidad.value === 'no_disponible' && util.disponible) return false
    if (q && !`${util.nombre} ${util.codigo} ${util.tipo} ${util.duenoNombre} ${util.ubicacion}`.toLowerCase().includes(q)) {
      return false
    }
    return true
  }).sort((a, b) => {
    if (a.disponible !== b.disponible) return a.disponible ? -1 : 1
    return a.codigo.localeCompare(b.codigo, 'es', { numeric: true })
  })
})

const hayFiltros = computed(() => Boolean(search.value || tipo.value || disponibilidad.value))

function clearFilters() {
  search.value = ''
  tipo.value = ''
  disponibilidad.value = ''
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    utiles.value = await api.listUtiles()
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
      eyebrow="Préstamo de útiles"
      title="Catálogo de la cooperativa"
      subtitle="Buscá lo que necesitás para clase. Podés solicitar hasta 7 días corridos y devolverlo desde Mis préstamos."
    >
      <template #actions>
        <span v-if="IS_DEMO" class="demo-badge">Datos de prueba</span>
        <RouterLink to="/mis-prestamos" class="btn btn-secondary">Mis préstamos</RouterLink>
      </template>
    </PageHeader>

    <section class="filter-bar" aria-label="Filtros del catálogo">
      <div class="search-field">
        <span class="search-field__icon" aria-hidden="true">⌕</span>
        <label for="catalog-search" class="sr-only">Buscar útil</label>
        <input
          id="catalog-search"
          v-model="search"
          class="input"
          type="search"
          placeholder="Buscar por nombre, código, donante o ubicación…"
        />
      </div>
      <div class="field field--compact">
        <label for="filter-tipo">Tipo</label>
        <select id="filter-tipo" v-model="tipo" class="select">
          <option value="">Todos los tipos</option>
          <option v-for="option in TIPO_UTIL_OPTIONS" :key="option" :value="option">{{ option }}</option>
        </select>
      </div>
      <div class="field field--compact">
        <label for="filter-disponibilidad">Disponibilidad</label>
        <select id="filter-disponibilidad" v-model="disponibilidad" class="select">
          <option value="">Todos</option>
          <option value="disponible">Disponibles</option>
          <option value="no_disponible">No disponibles</option>
        </select>
      </div>
      <button v-if="hayFiltros" class="btn btn-ghost filter-clear" type="button" @click="clearFilters">
        Limpiar filtros
      </button>
    </section>

    <div v-if="loading" class="panel">
      <LoadingBlock label="Cargando el catálogo…" />
    </div>

    <template v-else>
      <div v-if="loadError" class="alert alert--error">{{ loadError }}</div>

      <div class="catalog-meta">
        <p>
          <strong>{{ filtered.length }}</strong>
          {{ filtered.length === 1 ? 'útil encontrado' : 'útiles encontrados' }}
          <span v-if="hayFiltros">con los filtros aplicados</span>
        </p>
        <p class="catalog-meta__hint">Los útiles dañados o en reparación no se prestan.</p>
      </div>

      <div v-if="filtered.length" class="catalog-grid">
        <article v-for="util in filtered" :key="util.id" class="item-card" :class="{ 'item-card--unavailable': !util.disponible }">
          <div class="item-card__visual" :class="`item-card__visual--${util.tipo.toLowerCase()}`">
            <span class="item-card__icon" aria-hidden="true">{{ typeMeta[util.tipo]?.icon || '📦' }}</span>
            <span class="item-card__code">{{ util.codigo }}</span>
            <StatusBadge kind="util" :estado="util.estado" />
          </div>
          <div class="item-card__body">
            <p class="item-card__type">{{ util.tipo }}</p>
            <h2>{{ util.nombre }}</h2>
            <dl class="item-card__facts">
              <div>
                <dt>Donante / dueño</dt>
                <dd>{{ util.duenoNombre }}</dd>
              </div>
              <div>
                <dt>Unidades</dt>
                <dd>{{ util.cantidadDisponible }} de {{ util.cantidadTotal }}</dd>
              </div>
              <div>
                <dt>Ubicación</dt>
                <dd>{{ util.ubicacion }}</dd>
              </div>
            </dl>
            <p v-if="util.observaciones" class="item-card__note">{{ util.observaciones }}</p>
          </div>
          <div class="item-card__footer">
            <span class="availability" :class="{ 'availability--no': !util.disponible }">
              <span aria-hidden="true"></span>
              {{ util.disponible ? `${util.cantidadDisponible} disponible${util.cantidadDisponible === 1 ? '' : 's'}` : 'Sin unidades disponibles' }}
            </span>
            <RouterLink :to="`/catalogo/${util.id}`" class="btn btn-sm" :class="util.disponible ? 'btn-primary' : 'btn-secondary'">
              {{ util.disponible ? 'Ver detalle y pedir' : 'Ver detalle' }}
            </RouterLink>
          </div>
        </article>
      </div>

      <div v-else class="panel">
        <EmptyState
          icon="🔎"
          title="No encontramos útiles con esos filtros"
          text="Probá con otra palabra, otro tipo o quitá el filtro de disponibilidad."
        >
          <button v-if="hayFiltros" class="btn btn-secondary" type="button" @click="clearFilters">
            Limpiar filtros
          </button>
          <RouterLink v-else to="/ofrecer" class="btn btn-primary">Ofrecer un útil</RouterLink>
        </EmptyState>
      </div>
    </template>
  </div>
</template>
