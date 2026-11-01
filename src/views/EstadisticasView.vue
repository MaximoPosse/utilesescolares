<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useAuth } from '../stores/auth.js'
import { notify } from '../stores/toast.js'
import { api, IS_DEMO } from '../services/api.js'
import {
  KPI_META,
  alcanceEstadisticas,
  estadoKpi,
} from '../services/stats.js'
import { CURSOS, TIPOS_UTIL } from '../data/constants.js'
import {
  estadoPrestamoEfectivo,
  money,
  monthLabel,
  relativeDate,
  todayISO,
} from '../data/utils.js'
import PageHeader from '../components/PageHeader.vue'
import StatCard from '../components/StatCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import LoadingBlock from '../components/LoadingBlock.vue'
import EmptyState from '../components/EmptyState.vue'

const auth = useAuth()
const user = computed(() => auth.state.user)

const loading = ref(true)
const loadError = ref('')
const stats = ref(null)
const encuestas = ref([])
const misSolicitudes = ref([])
const misPrestamos = ref([])

const surveySaving = ref(false)
const surveyError = ref('')
const surveyOk = ref('')
const surveyForm = reactive({
  curso: user.value?.curso || CURSOS[0],
  momento: 'antes',
  vecesSinUtil: 0,
})

const alcance = computed(() => alcanceEstadisticas(user.value?.rol))
const puedeVer = (key) => alcance.value.includes(key)
const kpiKeys = computed(() =>
  ['cobertura', 'aTiempo', 'buenEstado', 'tareas'].filter((key) => puedeVer(key)),
)
const general = computed(() => stats.value?.general || {})
const operacion = computed(() => stats.value?.operacion || {})
const months = computed(() => stats.value?.months || [])
const porTipo = computed(() => stats.value?.porTipo || [])
const topEstudiantes = computed(() => stats.value?.topEstudiantes || [])
const encuestaImpacto = computed(() => stats.value?.encuestaImpacto || { cursos: [] })
const typeMeta = Object.fromEntries(TIPOS_UTIL.map((t) => [t.value, t]))
const hoy = todayISO()

const misPrestamosEnriquecidos = computed(() =>
  misPrestamos.value.map((p) => ({ ...p, estadoEfectivo: estadoPrestamoEfectivo(p) })),
)
const misActivos = computed(() => misPrestamosEnriquecidos.value.filter((p) => p.estado === 'prestado'))
const misAtrasados = computed(() => misActivos.value.filter((p) => p.estadoEfectivo === 'atrasado'))
const misDevueltos = computed(() => misPrestamos.value.filter((p) => p.estado === 'devuelto'))
const misSolicitudesAbiertas = computed(() =>
  misSolicitudes.value.filter((s) => ['pendiente', 'aprobada'].includes(s.estado)),
)
const misEncuestas = computed(() =>
  encuestas.value.filter((e) => e.usuarioId === user.value?.id),
)
const proximoVencimiento = computed(() => {
  const ordenados = [...misActivos.value].sort((a, b) =>
    (a.fechaAcordada || '').localeCompare(b.fechaAcordada || ''),
  )
  return ordenados[0] || null
})

const kpis = computed(() =>
  kpiKeys.value.map((key) => {
    const indicador = general.value[key] || { parte: 0, total: 0, valor: null, na: true }
    return {
      key,
      ...KPI_META[key],
      ...indicador,
      estado: estadoKpi(indicador, KPI_META[key].meta),
    }
  }),
)

// En Supabase las encuestas son privadas (RLS): solo se leen las propias. El total
// agregado llega desde estadisticas_cooperativa() para presidencia.
const totalEncuestas = computed(() => {
  if (IS_DEMO) return encuestas.value.length
  const impacto = stats.value?.encuestaImpacto
  if (impacto) return (impacto.respuestasAntes || 0) + (impacto.respuestasDespues || 0)
  return encuestas.value.length
})
const yaRespondio = computed(() => {
  return misEncuestas.value.some(
    (e) => e.curso === surveyForm.curso && e.momento === surveyForm.momento,
  )
})

const resumenOperacion = computed(() => [
  { label: 'Solicitudes pendientes', value: operacion.value.solicitudesPendientes ?? 0, icon: '⏳' },
  { label: 'Préstamos activos', value: operacion.value.prestamosActivos ?? 0, icon: '↺' },
  { label: 'Préstamos atrasados', value: operacion.value.prestamosAtrasados ?? 0, icon: '!' },
  { label: 'Devoluciones a controlar', value: operacion.value.devolucionesAControlar ?? 0, icon: '⌕' },
  { label: 'Reportes pendientes', value: operacion.value.reportesPendientes ?? 0, icon: '⚠' },
  { label: 'Ofertas pendientes', value: operacion.value.ofertasPendientes ?? 0, icon: '＋' },
  { label: 'Tareas pendientes', value: operacion.value.tareasPendientes ?? 0, icon: '☑' },
  { label: 'Unidades disponibles', value: operacion.value.unidadesDisponibles ?? 0, icon: '▦' },
])

function valorIndicador(indicador) {
  return indicador?.na || indicador?.valor === null ? 'N/A' : `${indicador.valor} %`
}

function widthIndicador(indicador) {
  if (!indicador || indicador.na || indicador.valor === null) return 0
  return Math.min(100, Math.max(0, indicador.valor))
}

function resultadoKpi(estado) {
  if (estado === 'na') return 'Sin datos'
  return estado === 'ok' ? 'En meta' : 'Bajo meta'
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const results = await Promise.all([
      api.getEstadisticas(),
      api.listEncuestas(),
      api.listSolicitudes({ userId: user.value.id }),
      api.listPrestamos({ userId: user.value.id }),
    ])
    stats.value = results[0]
    encuestas.value = results[1]
    misSolicitudes.value = results[2]
    misPrestamos.value = results[3]
  } catch (error) {
    loadError.value = error.message
    notify(error.message, 'error')
  } finally {
    loading.value = false
  }
}

async function guardarEncuesta() {
  surveyError.value = ''
  surveyOk.value = ''
  const numero = Number(surveyForm.vecesSinUtil)
  if (!Number.isInteger(numero) || numero < 0 || numero > 30) {
    surveyError.value = 'Indicá un número entero entre 0 y 30.'
    return
  }
  surveySaving.value = true
  try {
    await api.guardarEncuesta({
      curso: surveyForm.curso,
      momento: surveyForm.momento,
      vecesSinUtil: numero,
      actorId: user.value.id,
    })
    surveyOk.value = yaRespondio.value
      ? 'Actualizamos tu respuesta para ese curso y momento.'
      : '¡Gracias! Tu respuesta quedó registrada.'
    notify('Encuesta guardada.', 'success')
    await load()
  } catch (error) {
    surveyError.value = error.message
    notify(error.message, 'error')
  } finally {
    surveySaving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Seguimiento del trimestre"
      title="Estadísticas de la cooperativa"
      subtitle="Indicadores, tendencia mensual e impacto de la encuesta. Cuando no hay datos para un indicador se muestra N/A, nunca un cero engañoso."
    >
      <template #actions>
        <span v-if="IS_DEMO" class="demo-badge">Datos de prueba</span>
        <span class="tag">Actualizado {{ stats ? relativeDate(stats.generadoEn?.slice(0, 10)) : '—' }}</span>
      </template>
    </PageHeader>

    <LoadingBlock v-if="loading" label="Calculando los indicadores…" />
    <div v-else-if="loadError" class="alert alert--error">{{ loadError }}</div>

    <template v-else-if="stats">
      <section v-if="puedeVer('resumen')" class="panel">
        <div class="section-heading section-heading--tight">
          <div>
            <p class="eyebrow">Tu participación</p>
            <h2>Resumen personal</h2>
          </div>
          <span class="tag">{{ user.curso }}</span>
        </div>
        <div class="stats-row stats-row--four">
          <StatCard
            label="Solicitudes en curso"
            :value="misSolicitudesAbiertas.length"
            hint="Pendientes o aprobadas"
            icon="🧾"
            tone="warning"
            compact
          />
          <StatCard
            label="Préstamos activos"
            :value="misActivos.length"
            :hint="misAtrasados.length ? `${misAtrasados.length} atrasados` : 'Todos en plazo'"
            icon="↺"
            :tone="misAtrasados.length ? 'danger' : 'info'"
            compact
          />
          <StatCard
            label="Devoluciones"
            :value="misDevueltos.length"
            hint="Registradas en tu historial"
            icon="✓"
            tone="success"
            compact
          />
          <StatCard
            label="Solicitudes totales"
            :value="misSolicitudes.length"
            hint="Incluye canceladas y rechazadas"
            icon="▤"
            tone="neutral"
            compact
          />
        </div>
        <p v-if="proximoVencimiento" class="inline-note">
          Próximo vencimiento: <strong>{{ proximoVencimiento.utilNombre }}</strong>
          el {{ proximoVencimiento.fechaAcordada }} ({{ relativeDate(proximoVencimiento.fechaAcordada) }}).
        </p>
        <p v-else class="inline-note">No tenés préstamos activos en este momento.</p>
      </section>

      <section v-if="kpiKeys.length" class="stats-kpi-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Metas acordadas</p>
            <h2>Indicadores del trimestre</h2>
          </div>
          <p class="hint">Los indicadores se calculan sobre el acumulado del período.</p>
        </div>

        <div class="stats-kpi-grid">
          <article
            v-for="kpi in kpis"
            :key="kpi.key"
            class="kpi-card"
            :class="`kpi-card--${kpi.estado}`"
          >
            <div class="kpi-card__head">
              <div>
                <p class="kpi-card__label">{{ kpi.label }}</p>
                <p class="kpi-card__detail">{{ kpi.detalle }}</p>
              </div>
              <span class="kpi-card__pill">{{ resultadoKpi(kpi.estado) }}</span>
            </div>
            <div class="kpi-card__body">
              <p class="kpi-card__value">{{ kpi.na ? 'N/A' : `${kpi.valor} %` }}</p>
              <div class="kpi-card__meta">
                <span>Meta: {{ kpi.meta }} %</span>
                <span v-if="kpi.na">Sin denominador</span>
                <span v-else>{{ kpi.parte }} de {{ kpi.total }}</span>
              </div>
            </div>
            <div class="progress-bar" :class="`progress-bar--${kpi.estado}`">
              <span :style="{ width: `${widthIndicador(kpi)}%` }"></span>
            </div>
            <p v-if="kpi.na" class="kpi-card__na">
              No hay datos suficientes para calcular este indicador. Se mostrará N/A hasta que exista
              al menos un caso en el denominador.
            </p>
          </article>
        </div>
      </section>

      <section v-if="!kpiKeys.length" class="panel">
        <EmptyState
          icon="▥"
          title="Los indicadores completos están reservados a la conducción"
          text="Tu rol puede consultar su resumen personal. Presidencia y las comisiones ven los indicadores de su área."
        />
      </section>

      <div v-if="kpiKeys.length || puedeVer('operacion')" class="dashboard-columns stats-columns">
        <section v-if="kpiKeys.length" class="panel">
          <div class="section-heading section-heading--tight">
            <div>
              <p class="eyebrow">Evolución</p>
              <h2>Tendencia de los últimos 6 meses</h2>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table trend-table">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th v-for="kpi in kpis" :key="kpi.key" class="cell-right">{{ kpi.label }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="month in months" :key="month.key">
                  <td data-label="Mes"><strong>{{ month.label || monthLabel(month.key) }}</strong></td>
                  <td
                    v-for="kpi in kpis"
                    :key="kpi.key"
                    data-label="Indicador"
                    class="cell-right"
                  >
                    <span
                      class="trend-value"
                      :class="`trend-value--${estadoKpi(month[kpi.key], kpi.meta)}`"
                    >
                      {{ valorIndicador(month[kpi.key]) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="hint">
            Cada mes se calcula con las solicitudes, préstamos y tareas cuya fecha cae dentro de ese mes.
          </p>
        </section>

        <section v-if="puedeVer('operacion')" class="panel">
          <div class="section-heading section-heading--tight">
            <div>
              <p class="eyebrow">Hoy</p>
              <h2>Estado de la operación</h2>
            </div>
          </div>
          <div class="operation-grid">
            <div v-for="item in resumenOperacion" :key="item.label" class="operation-item">
              <span class="operation-item__icon" aria-hidden="true">{{ item.icon }}</span>
              <div>
                <strong>{{ item.value }}</strong>
                <span>{{ item.label }}</span>
              </div>
            </div>
          </div>
          <div class="operation-balance">
            <div>
              <span>Ingresos</span>
              <strong class="money money--in">{{ money(operacion.ingresos) }}</strong>
            </div>
            <div>
              <span>Egresos</span>
              <strong class="money money--out">{{ money(operacion.egresos) }}</strong>
            </div>
            <div>
              <span>Saldo</span>
              <strong class="money" :class="operacion.saldo >= 0 ? 'money--in' : 'money--out'">
                {{ money(operacion.saldo) }}
              </strong>
            </div>
          </div>
        </section>
      </div>

      <div v-if="puedeVer('cobertura')" class="dashboard-columns">
        <section class="panel">
          <div class="section-heading section-heading--tight">
            <div>
              <p class="eyebrow">Inventario</p>
              <h2>Distribución por tipo de útil</h2>
            </div>
          </div>
          <div class="type-breakdown">
            <article v-for="tipo in porTipo" :key="tipo.tipo" class="type-row">
              <span class="type-row__icon" aria-hidden="true">{{ typeMeta[tipo.tipo]?.icon || tipo.icon }}</span>
              <div class="type-row__body">
                <div class="type-row__top">
                  <strong>{{ tipo.tipo }}</strong>
                  <span>{{ tipo.disponibles }} / {{ tipo.unidades }} disponibles</span>
                </div>
                <div class="progress-bar">
                  <span
                    :style="{ width: `${tipo.unidades ? Math.round((tipo.disponibles / tipo.unidades) * 100) : 0}%` }"
                  ></span>
                </div>
                <p class="type-row__meta">{{ tipo.prestamos }} préstamos registrados en este tipo</p>
              </div>
            </article>
          </div>
        </section>

        <section class="panel">
          <div class="section-heading section-heading--tight">
            <div>
              <p class="eyebrow">Participación</p>
              <h2>Estudiantes con más préstamos</h2>
            </div>
          </div>
          <div v-if="topEstudiantes.length" class="ranking-list">
            <article v-for="(estudiante, index) in topEstudiantes" :key="estudiante.id" class="ranking-item">
              <span class="ranking-item__position">{{ index + 1 }}</span>
              <div class="ranking-item__body">
                <strong>{{ estudiante.nombre }}</strong>
                <span>{{ estudiante.curso }} · {{ estudiante.cantidad }} préstamos</span>
              </div>
              <span class="tag" :class="{ 'tag--muted': !estudiante.activos }">
                {{ estudiante.activos }} activo{{ estudiante.activos === 1 ? '' : 's' }}
              </span>
            </article>
          </div>
          <EmptyState
            v-else
            icon="👥"
            title="Todavía no hay préstamos registrados"
            text="El ranking aparece cuando existan préstamos asociados a estudiantes."
          />
        </section>
      </div>

      <div v-if="puedeVer('encuesta')" class="dashboard-columns">
        <section class="panel">
          <div class="section-heading section-heading--tight">
            <div>
              <p class="eyebrow">Encuesta de impacto</p>
              <h2>¿Cuántas veces faltó un útil?</h2>
            </div>
            <span class="tag">{{ totalEncuestas }} respuestas</span>
          </div>
          <p class="panel-lead">
            Comparamos las respuestas “antes” y “después” de poner en marcha la cooperativa para medir
            si disminuyeron las veces que alguien no tuvo el útil necesario.
          </p>

          <div v-if="encuestaImpacto.cursos.length" class="survey-results">
            <div class="survey-global">
              <div>
                <span>Reducción global</span>
                <strong>
                  {{ encuestaImpacto.reduccionGlobal === null ? 'N/A' : `${encuestaImpacto.reduccionGlobal} %` }}
                </strong>
              </div>
              <p>
                {{ encuestaImpacto.respuestasAntes }} respuestas “antes” ·
                {{ encuestaImpacto.respuestasDespues }} respuestas “después”.
                Solo se calcula cuando un curso tiene ambos momentos.
              </p>
            </div>
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Curso</th>
                    <th class="cell-right">Antes</th>
                    <th class="cell-right">Después</th>
                    <th class="cell-right">Reducción</th>
                    <th>Respuestas</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="curso in encuestaImpacto.cursos" :key="curso.curso">
                    <td data-label="Curso"><strong>{{ curso.curso }}</strong></td>
                    <td data-label="Antes" class="cell-right">
                      {{ curso.antes === null ? 'N/A' : curso.antes.toFixed(1) }}
                    </td>
                    <td data-label="Después" class="cell-right">
                      {{ curso.despues === null ? 'N/A' : curso.despues.toFixed(1) }}
                    </td>
                    <td data-label="Reducción" class="cell-right">
                      <span
                        v-if="curso.reduccion !== null"
                        class="tag"
                        :class="curso.reduccion >= 0 ? 'tag--soft' : 'tag--muted'"
                      >
                        {{ curso.reduccion }} %
                      </span>
                      <span v-else class="muted">N/A</span>
                    </td>
                    <td data-label="Respuestas">
                      <small>{{ curso.antesN }} antes · {{ curso.despuesN }} después</small>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <EmptyState
            v-else
            icon="📊"
            title="Todavía no hay respuestas de la encuesta"
            text="Cada integrante puede responder desde esta misma pantalla para construir la comparación."
          />
        </section>

        <section class="panel survey-card">
          <div class="section-heading section-heading--tight">
            <div>
              <p class="eyebrow">Tu respuesta</p>
              <h2>Completar la encuesta</h2>
            </div>
          </div>
          <p class="panel-lead">
            Pensá en las últimas dos semanas. La encuesta es anónima para el resto de los integrantes:
            solo se publican promedios por curso.
          </p>
          <form class="form-stack" novalidate @submit.prevent="guardarEncuesta">
            <div class="form-grid">
              <div class="field">
                <label for="survey-curso">Curso</label>
                <select id="survey-curso" v-model="surveyForm.curso" class="select">
                  <option v-for="curso in CURSOS" :key="curso" :value="curso">{{ curso }}</option>
                </select>
              </div>
              <div class="field">
                <label for="survey-momento">Momento</label>
                <select id="survey-momento" v-model="surveyForm.momento" class="select">
                  <option value="antes">Antes de la cooperativa</option>
                  <option value="despues">Después de la cooperativa</option>
                </select>
              </div>
            </div>
            <div class="field">
              <label for="survey-veces">¿Cuántas veces te faltó un útil?</label>
              <input
                id="survey-veces"
                v-model.number="surveyForm.vecesSinUtil"
                class="input"
                type="number"
                min="0"
                max="30"
                step="1"
                inputmode="numeric"
              />
              <p class="hint">Número entero entre 0 y 30. Si ya respondiste, se actualiza tu respuesta.</p>
            </div>
            <p v-if="yaRespondio" class="inline-note inline-note--warning">
              Ya registraste una respuesta para {{ surveyForm.curso }} en el momento
              “{{ surveyForm.momento === 'antes' ? 'antes' : 'después' }}”. Si guardás, se reemplaza.
            </p>
            <div v-if="surveyError" class="alert alert--error" role="alert">{{ surveyError }}</div>
            <div v-if="surveyOk" class="alert alert--success" role="status">{{ surveyOk }}</div>
            <button class="btn btn-primary" type="submit" :disabled="surveySaving">
              <span v-if="surveySaving" class="spinner spinner--sm" aria-hidden="true"></span>
              {{ surveySaving ? 'Guardando…' : 'Guardar respuesta' }}
            </button>
          </form>
          <p v-if="misEncuestas.length" class="hint">
            Tus respuestas registradas: {{ misEncuestas.length }}.
            Última actualización: {{ misEncuestas[misEncuestas.length - 1]?.fecha || '—' }}.
          </p>
        </section>
      </div>

      <section v-if="puedeVer('resumen')" class="panel">
        <div class="section-heading section-heading--tight">
          <div>
            <p class="eyebrow">Cómo leer los indicadores</p>
            <h2>Metas y cálculos</h2>
          </div>
        </div>
        <dl class="formula-list">
          <div v-for="(meta, key) in KPI_META" :key="key">
            <dt>{{ meta.label }} · meta {{ meta.meta }} %</dt>
            <dd>{{ meta.detalle }}. Si el denominador es 0, se muestra N/A.</dd>
          </div>
        </dl>
        <p class="hint">
          Los indicadores no se “redondean hacia arriba”: un resultado por debajo de la meta queda
          marcado como “Bajo meta” para que la cooperativa pueda tomar decisiones.
        </p>
      </section>

      <section v-if="puedeVer('resumen') && misPrestamosEnriquecidos.length" class="panel">
        <div class="section-heading section-heading--tight">
          <div>
            <p class="eyebrow">Historial personal</p>
            <h2>Tus últimos movimientos</h2>
          </div>
        </div>
        <div class="simple-list">
          <article
            v-for="prestamo in misPrestamosEnriquecidos.slice(0, 8)"
            :key="prestamo.id"
            class="simple-list__item"
          >
            <div>
              <p class="simple-list__title">{{ prestamo.utilNombre }}</p>
              <p class="simple-list__meta">
                {{ prestamo.numero }} · entrega {{ prestamo.fechaEntrega }} ·
                devolución acordada {{ prestamo.fechaAcordada }}
              </p>
            </div>
            <StatusBadge kind="prestamo" :estado="prestamo.estadoEfectivo" />
          </article>
        </div>
        <p v-if="misPrestamosEnriquecidos.some((p) => p.estadoEfectivo === 'atrasado')" class="hint text-danger">
          Tenés préstamos atrasados. Devolvelos cuanto antes para no afectar el indicador de devoluciones.
        </p>
        <p v-else class="hint">Hoy es {{ hoy }}. No tenés préstamos atrasados.</p>
      </section>
    </template>
  </div>
</template>
