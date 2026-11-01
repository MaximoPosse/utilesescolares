import { TIPOS_UTIL } from '../data/constants.js'
import {
  diffDays,
  lastMonths,
  monthKey,
  monthLabel,
  todayISO,
} from '../data/utils.js'

function indicador(parte, total) {
  const t = Number(total) || 0
  const p = Number(parte) || 0
  return {
    parte: p,
    total: t,
    valor: t === 0 ? null : Math.round((p / t) * 1000) / 10,
    na: t === 0,
  }
}

function enMes(fecha, key) {
  return Boolean(fecha) && monthKey(fecha) === key
}

function devueltoATiempo(prestamo) {
  if (prestamo.estado !== 'devuelto' || !prestamo.fechaDevolucionReal) return false
  if (!prestamo.fechaAcordada) return false
  const diff = diffDays(prestamo.fechaEntrega || prestamo.fechaAcordada, prestamo.fechaDevolucionReal)
  return prestamo.fechaDevolucionReal <= prestamo.fechaAcordada && diff !== null && diff <= 7
}

function vencia(prestamo, hoy) {
  return Boolean(prestamo.fechaAcordada) && (
    prestamo.fechaAcordada <= hoy ||
    ['devuelto', 'perdido'].includes(prestamo.estado)
  )
}

function analizar({ solicitudes, prestamos, tareas, mes = null }) {
  const hoy = todayISO()
  const sol = mes
    ? solicitudes.filter((s) => enMes(s.fechaSolicitud, mes))
    : solicitudes
  const validas = sol.filter((s) => s.estado !== 'cancelada')
  const atendidas = validas.filter((s) => s.estado === 'atendida')

  const prestamosPeriodo = prestamos.filter((p) => {
    if (mes) return enMes(p.fechaAcordada, mes)
    return true
  })
  const vencidos = prestamosPeriodo.filter((p) => vencia(p, hoy))
  const aTiempo = vencidos.filter(devueltoATiempo)

  const revisados = prestamosPeriodo.filter((p) =>
    ['buen_estado', 'danado', 'en_reparacion', 'perdido'].includes(p.condicion) &&
    ['devuelto', 'perdido'].includes(p.estado),
  )
  const buenEstado = revisados.filter((p) => p.condicion === 'buen_estado')

  const tareasPeriodo = tareas.filter((t) => t.fechaLimite && (!mes || enMes(t.fechaLimite, mes)))
  const terminadas = tareasPeriodo.filter((t) => t.estado === 'terminada')

  return {
    cobertura: indicador(atendidas.length, validas.length),
    aTiempo: indicador(aTiempo.length, vencidos.length),
    buenEstado: indicador(buenEstado.length, revisados.length),
    tareas: indicador(terminadas.length, tareasPeriodo.length),
    conteos: {
      solicitudes: sol.length,
      validas: validas.length,
      atendidas: atendidas.length,
      vencidos: vencidos.length,
      aTiempo: aTiempo.length,
      revisados: revisados.length,
      buenEstado: buenEstado.length,
      tareas: tareasPeriodo.length,
      terminadas: terminadas.length,
    },
  }
}

function resumenEncuestas(encuestas) {
  const cursos = [...new Set(encuestas.map((e) => e.curso))]
  return cursos.map((curso) => {
    const antes = encuestas.filter((e) => e.curso === curso && e.momento === 'antes')
    const despues = encuestas.filter((e) => e.curso === curso && e.momento === 'despues')
    const promedio = (arr) => (arr.length ? arr.reduce((a, e) => a + e.vecesSinUtil, 0) / arr.length : null)
    const promAntes = promedio(antes)
    const promDespues = promedio(despues)
    return {
      curso,
      antesN: antes.length,
      despuesN: despues.length,
      antes: promAntes,
      despues: promDespues,
      reduccion: promAntes && promDespues !== null
        ? Math.round(((promAntes - promDespues) / promAntes) * 1000) / 10
        : null,
    }
  }).sort((a, b) => a.curso.localeCompare(b.curso, 'es', { numeric: true }))
}

export function calcularEstadisticas(data) {
  const solicitudes = data.solicitudes || []
  const prestamos = data.prestamos || []
  const utiles = data.utiles || []
  const tareas = (data.tareas || []).filter((t) => t.activo !== false)
  const avisos = data.avisos || []
  const acuerdos = data.acuerdos || []
  const reportes = data.reportes || []
  const ofertas = data.ofertas || []
  const movimientos = (data.movimientos || []).filter((m) => m.activo !== false)
  const encuestas = data.encuestas || []
  const usuarios = data.usuarios || []
  const hoy = todayISO()

  const general = analizar({ solicitudes, prestamos, tareas })
  const months = lastMonths(6).map((key) => ({
    key,
    label: monthLabel(key),
    ...analizar({ solicitudes, prestamos, tareas, mes: key }),
  }))

  const porTipo = TIPOS_UTIL.map((tipo) => {
    const utilTipo = utiles.filter((u) => u.tipo === tipo.value && u.activo !== false)
    const prestamosTipo = prestamos.filter((p) => p.utilTipo === tipo.value)
    return {
      tipo: tipo.value,
      icon: tipo.icon,
      unidades: utilTipo.reduce((sum, u) => sum + Number(u.cantidadTotal || 0), 0),
      disponibles: utilTipo.reduce((sum, u) => sum + Number(u.cantidadDisponible || 0), 0),
      prestamos: prestamosTipo.length,
    }
  })

  const porEstudiante = new Map()
  prestamos.forEach((p) => {
    if (!p.estudianteId) return
    const actual = porEstudiante.get(p.estudianteId) || {
      id: p.estudianteId,
      nombre: p.estudianteNombre || 'Estudiante',
      curso: p.estudianteCurso || '—',
      cantidad: 0,
      activos: 0,
    }
    actual.cantidad += 1
    if (['prestado', 'atrasado'].includes(p.estado)) actual.activos += 1
    porEstudiante.set(p.estudianteId, actual)
  })
  const topEstudiantes = [...porEstudiante.values()]
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 6)

  const activos = prestamos.filter((p) => p.estado === 'prestado')
  const atrasados = activos.filter((p) => p.fechaAcordada && p.fechaAcordada < hoy)
  const ingresos = movimientos.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0)
  const egresos = movimientos.filter((m) => m.tipo === 'egreso').reduce((s, m) => s + Number(m.monto), 0)

  const operacion = {
    solicitudesPendientes: solicitudes.filter((s) => s.estado === 'pendiente').length,
    solicitudesAprobadas: solicitudes.filter((s) => s.estado === 'aprobada').length,
    prestamosActivos: activos.length,
    prestamosAtrasados: atrasados.length,
    devolucionesAControlar: prestamos.filter((p) => p.estado === 'devuelto' && p.condicion === 'a_controlar').length,
    reportesPendientes: reportes.filter((r) => r.estado === 'pendiente').length,
    ofertasPendientes: ofertas.filter((o) => o.estado === 'pendiente').length,
    avisosActivos: avisos.filter((a) => a.activo).length,
    acuerdosActivos: acuerdos.filter((a) => a.activo).length,
    tareasPendientes: tareas.filter((t) => t.estado !== 'terminada').length,
    tareasTerminadas: tareas.filter((t) => t.estado === 'terminada').length,
    estudiantes: usuarios.filter((u) => u.activo !== false).length,
    ingresos,
    egresos,
    saldo: ingresos - egresos,
    unidadesDisponibles: utiles
      .filter((u) => u.activo !== false && !['Dañado', 'En reparación'].includes(u.estado))
      .reduce((s, u) => s + Number(u.cantidadDisponible || 0), 0),
  }

  const encuestasResumen = resumenEncuestas(encuestas)
  const conAntesYDespues = encuestasResumen.filter((e) => e.antes !== null && e.despues !== null)
  const antesTotal = conAntesYDespues.reduce((s, e) => s + e.antes, 0)
  const despuesTotal = conAntesYDespues.reduce((s, e) => s + e.despues, 0)
  const encuestaImpacto = {
    cursos: encuestasResumen,
    reduccionGlobal: antesTotal > 0
      ? Math.round(((antesTotal - despuesTotal) / antesTotal) * 1000) / 10
      : null,
    respuestasAntes: encuestas.filter((e) => e.momento === 'antes').length,
    respuestasDespues: encuestas.filter((e) => e.momento === 'despues').length,
  }

  return {
    general,
    months,
    porTipo,
    topEstudiantes,
    operacion,
    encuestaImpacto,
    generadoEn: new Date().toISOString(),
  }
}

/** Alcance de indicadores visible según el rol. */
export function alcanceEstadisticas(rol) {
  if (rol === 'presidente') return ['cobertura', 'aTiempo', 'buenEstado', 'tareas', 'operacion', 'encuesta']
  if (rol === 'comision_administracion') return ['cobertura', 'aTiempo', 'buenEstado', 'operacion']
  if (rol === 'comision_organizacion') return ['tareas', 'operacion']
  if (rol === 'comision_comunicacion') return ['operacion']
  if (rol === 'secretario') return ['operacion']
  if (rol === 'tesorero') return ['operacion']
  return ['resumen']
}

export const KPI_META = {
  cobertura: { label: 'Cobertura de solicitudes', meta: 90, detalle: 'Solicitudes atendidas ÷ solicitudes válidas' },
  aTiempo: { label: 'Devoluciones a tiempo', meta: 85, detalle: 'Devueltas en ≤ 7 días ÷ préstamos que vencían' },
  buenEstado: { label: 'Devueltos en buen estado', meta: 95, detalle: 'En buen estado ÷ devueltos y revisados' },
  tareas: { label: 'Cumplimiento de tareas', meta: 90, detalle: 'Tareas terminadas ÷ tareas con vencimiento' },
}

export function estadoKpi(indicador, meta) {
  if (!indicador || indicador.na) return 'na'
  return Number(indicador.valor) >= meta ? 'ok' : 'alerta'
}
