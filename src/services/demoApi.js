import {
  addDays,
  diffDays,
  fullName,
  todayISO,
} from '../data/utils.js'
import {
  getDemoState,
  nextId,
  resetDemoState,
  saveDemoState,
  demoNow,
} from './demoDb.js'
import { calcularEstadisticas } from './stats.js'

function state() {
  return getDemoState()
}

function fail(message) {
  throw new Error(message)
}

function publicUser(user) {
  if (!user) return null
  const { password, ...rest } = user
  return { ...rest }
}

function findUser(id) {
  return state().users.find((u) => u.id === id)
}

function findUtil(id) {
  return state().utiles.find((u) => u.id === id)
}

function enrichUtil(util) {
  if (!util) return null
  const owner = util.duenoId ? publicUser(findUser(util.duenoId)) : null
  return {
    ...util,
    dueno: owner,
    duenoNombre: owner ? fullName(owner) : 'Cooperativa',
    disponible: util.activo && util.cantidadDisponible > 0 && !['Dañado', 'En reparación'].includes(util.estado),
  }
}

function enrichSolicitud(solicitud) {
  if (!solicitud) return null
  const util = findUtil(solicitud.utilId)
  const solicitante = findUser(solicitud.solicitanteId)
  return {
    ...solicitud,
    util: enrichUtil(util),
    utilNombre: util?.nombre ?? 'Útil dado de baja',
    utilCodigo: util?.codigo ?? '—',
    utilTipo: util?.tipo ?? '—',
    solicitante: publicUser(solicitante),
    solicitanteNombre: solicitante ? fullName(solicitante) : '—',
    solicitanteCurso: solicitante?.curso ?? '—',
  }
}

function enrichPrestamo(prestamo) {
  if (!prestamo) return null
  const util = findUtil(prestamo.utilId)
  const estudiante = findUser(prestamo.estudianteId)
  const solicitud = state().solicitudes.find((s) => s.id === prestamo.solicitudId)
  return {
    ...prestamo,
    util: enrichUtil(util),
    utilNombre: util?.nombre ?? 'Útil dado de baja',
    utilCodigo: util?.codigo ?? '—',
    utilTipo: util?.tipo ?? '—',
    estudiante: publicUser(estudiante),
    estudianteNombre: estudiante ? fullName(estudiante) : '—',
    estudianteCurso: estudiante?.curso ?? '—',
    solicitudNumero: solicitud?.numero ?? '—',
  }
}

function enrichOferta(oferta) {
  const oferente = findUser(oferta.oferenteId)
  return {
    ...oferta,
    oferente: publicUser(oferente),
    oferenteNombre: oferente ? fullName(oferente) : '—',
    oferenteCurso: oferente?.curso ?? '—',
  }
}

function enrichAviso(aviso) {
  const autor = findUser(aviso.autorId)
  return {
    ...aviso,
    autor: publicUser(autor),
    autorNombre: autor ? fullName(autor) : '—',
  }
}

function enrichAcuerdo(acuerdo) {
  const autor = findUser(acuerdo.autorId)
  return {
    ...acuerdo,
    autor: publicUser(autor),
    autorNombre: autor ? fullName(autor) : '—',
  }
}

function enrichVotacion(votacion) {
  const votos = state().votos.filter((v) => v.votacionId === votacion.id)
  const conteos = Object.fromEntries(votacion.opciones.map((o) => [o, 0]))
  votos.forEach((v) => {
    if (conteos[v.opcion] !== undefined) conteos[v.opcion] += 1
  })
  const autor = findUser(votacion.creadaPor)
  return {
    ...votacion,
    votos,
    conteos,
    totalVotos: votos.length,
    autorNombre: autor ? fullName(autor) : '—',
    cerradaPorFecha: votacion.fechaCierre < todayISO() && votacion.estado === 'abierta',
  }
}

function enrichMovimiento(movimiento) {
  const autor = findUser(movimiento.registradoPor)
  return {
    ...movimiento,
    registradoPorNombre: autor ? fullName(autor) : '—',
  }
}

function enrichTarea(tarea) {
  const asignado = findUser(tarea.asignadoId)
  const actividad = state().actividades.find((a) => a.id === tarea.actividadId)
  return {
    ...tarea,
    asignado: publicUser(asignado),
    asignadoNombre: asignado ? fullName(asignado) : '—',
    asignadoCurso: asignado?.curso ?? '—',
    actividadTitulo: actividad?.titulo ?? 'Sin actividad',
  }
}

function currentUser(userId) {
  const user = findUser(userId)
  if (!user) fail('No se encontró el usuario de la sesión.')
  return user
}

function assertAdmin(user) {
  if (!['comision_administracion'].includes(user.rol)) {
    fail('Esta acción requiere el rol de la comisión de administración.')
  }
}

function assertPresident(user) {
  if (user.rol !== 'presidente') fail('Esta acción requiere el rol de presidencia.')
}

function normalizeUtilEstado(util) {
  if (util.cantidadDisponible <= 0 && util.estado === 'Disponible') {
    return 'Prestado'
  }
  if (util.cantidadDisponible > 0 && util.estado === 'Prestado') {
    return 'Disponible'
  }
  return util.estado
}

export const demoApi = {
  // ---------- Autenticación de demostración ----------
  async login(email, password) {
    const found = state().users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase())
    if (!found) fail('No existe una cuenta con ese correo.')
    if (!found.activo) fail('La cuenta está deshabilitada.')
    if (found.password !== password) fail('La contraseña no es correcta.')
    return publicUser(found)
  },

  async register(payload) {
    const data = state()
    const email = String(payload.email || '').trim().toLowerCase()
    if (data.users.some((u) => u.email.toLowerCase() === email)) {
      fail('Ya existe una cuenta con ese correo.')
    }
    const user = {
      id: `u-${Date.now()}`,
      email,
      password: payload.password,
      nombre: String(payload.nombre || '').trim(),
      apellido: String(payload.apellido || '').trim(),
      curso: payload.curso,
      rol: 'estudiante',
      activo: true,
      createdAt: demoNow(),
    }
    data.users.push(user)
    saveDemoState()
    return publicUser(user)
  },

  async listDemoAccounts() {
    return state().users
      .filter((u) => ['u-001', 'u-005', 'u-006', 'u-007', 'u-008', 'u-009', 'u-010'].includes(u.id))
      .map((u) => publicUser(u))
  },

  // ---------- Usuarios y roles ----------
  async listUsuarios() {
    return state().users
      .filter((u) => u.activo)
      .map((u) => publicUser(u))
      .sort((a, b) => fullName(a).localeCompare(fullName(b), 'es'))
  },

  async actualizarRol(usuarioId, rol, actorId) {
    const actor = currentUser(actorId)
    assertPresident(actor)
    const target = findUser(usuarioId)
    if (!target) fail('No se encontró el integrante.')
    if (!rol) fail('Elegí un rol válido.')
    target.rol = rol
    saveDemoState()
    return publicUser(target)
  },

  /** Simulación exclusiva del modo demo: permite probar la interfaz con cada rol. */
  async simularRol(usuarioId, rol) {
    const target = findUser(usuarioId)
    if (!target) fail('No se encontró el usuario de la sesión.')
    if (!rol) fail('Elegí un rol válido.')
    target.rol = rol
    saveDemoState()
    return publicUser(target)
  },

  // ---------- Catálogo / inventario ----------
  async listUtiles({ includeInactive = false, search = '', tipo = '', disponibilidad = '' } = {}) {
    let items = state().utiles.filter((u) => includeInactive || u.activo)
    if (search) {
      const q = search.toLowerCase()
      items = items.filter((u) =>
        `${u.nombre} ${u.codigo} ${u.tipo} ${u.ubicacion} ${u.observaciones}`.toLowerCase().includes(q),
      )
    }
    if (tipo) items = items.filter((u) => u.tipo === tipo)
    const enriched = items.map(enrichUtil)
    if (disponibilidad === 'disponible') items = enriched.filter((u) => u.disponible)
    else if (disponibilidad === 'no_disponible') items = enriched.filter((u) => !u.disponible)
    else items = enriched
    return items.sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }))
  },

  async getUtil(id) {
    const util = findUtil(id)
    if (!util) fail('No se encontró el útil.')
    return enrichUtil(util)
  },

  async crearUtil(payload, actorId) {
    const actor = currentUser(actorId)
    assertAdmin(actor)
    const data = state()
    const codigo = String(payload.codigo || '').trim().toUpperCase()
    if (!codigo) fail('El código es obligatorio.')
    if (data.utiles.some((u) => u.codigo.toUpperCase() === codigo)) fail('Ya existe un útil con ese código.')
    const total = Number(payload.cantidadTotal)
    const disponible = Number(payload.cantidadDisponible)
    if (!Number.isInteger(total) || total < 1) fail('La cantidad total debe ser un entero mayor a 0.')
    if (!Number.isInteger(disponible) || disponible < 0) fail('La cantidad disponible no puede ser negativa.')
    if (disponible > total) fail('La cantidad disponible no puede superar la cantidad total.')
    const util = {
      id: `ut-${Date.now()}`,
      codigo,
      nombre: String(payload.nombre || '').trim(),
      tipo: payload.tipo,
      estado: payload.estado,
      cantidadTotal: total,
      cantidadDisponible: disponible,
      duenoId: payload.duenoId || null,
      origen: payload.origen || 'cooperativa',
      ubicacion: String(payload.ubicacion || '').trim(),
      observaciones: String(payload.observaciones || '').trim(),
      activo: true,
      createdAt: demoNow(),
    }
    if (!util.nombre) fail('El nombre es obligatorio.')
    if (!util.tipo) fail('El tipo es obligatorio.')
    if (!util.ubicacion) fail('La ubicación es obligatoria.')
    data.utiles.push(util)
    saveDemoState()
    return enrichUtil(util)
  },

  async actualizarUtil(id, payload, actorId) {
    const actor = currentUser(actorId)
    assertAdmin(actor)
    const util = findUtil(id)
    if (!util) fail('No se encontró el útil.')
    const total = Number(payload.cantidadTotal)
    const disponible = Number(payload.cantidadDisponible)
    if (!Number.isInteger(total) || total < 1) fail('La cantidad total debe ser un entero mayor a 0.')
    if (!Number.isInteger(disponible) || disponible < 0) fail('La cantidad disponible no puede ser negativa.')
    if (disponible > total) fail('La cantidad disponible no puede superar la cantidad total.')
    const codigo = String(payload.codigo || '').trim().toUpperCase()
    if (!codigo) fail('El código es obligatorio.')
    if (state().utiles.some((u) => u.id !== id && u.codigo.toUpperCase() === codigo)) {
      fail('Ya existe otro útil con ese código.')
    }
    Object.assign(util, {
      codigo,
      nombre: String(payload.nombre || '').trim(),
      tipo: payload.tipo,
      estado: payload.estado,
      cantidadTotal: total,
      cantidadDisponible: disponible,
      ubicacion: String(payload.ubicacion || '').trim(),
      observaciones: String(payload.observaciones || '').trim(),
      origen: payload.origen || util.origen,
      updatedAt: demoNow(),
    })
    if (!util.nombre) fail('El nombre es obligatorio.')
    if (!util.ubicacion) fail('La ubicación es obligatoria.')
    saveDemoState()
    return enrichUtil(util)
  },

  async bajaLogicaUtil(id, actorId) {
    const actor = currentUser(actorId)
    assertAdmin(actor)
    const util = findUtil(id)
    if (!util) fail('No se encontró el útil.')
    util.activo = false
    util.updatedAt = demoNow()
    saveDemoState()
    return enrichUtil(util)
  },

  async reactivarUtil(id, actorId) {
    const actor = currentUser(actorId)
    assertAdmin(actor)
    const util = findUtil(id)
    if (!util) fail('No se encontró el útil.')
    util.activo = true
    util.updatedAt = demoNow()
    saveDemoState()
    return enrichUtil(util)
  },

  // ---------- Solicitudes y préstamos ----------
  async listSolicitudes({ userId = null, all = false } = {}) {
    let items = state().solicitudes
    if (!all) items = items.filter((s) => s.solicitanteId === userId)
    return items
      .map(enrichSolicitud)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  },

  async getSolicitud(id) {
    const solicitud = state().solicitudes.find((s) => s.id === id)
    if (!solicitud) fail('No se encontró la solicitud.')
    return enrichSolicitud(solicitud)
  },

  async crearSolicitud(payload, actorId) {
    const data = state()
    const actor = currentUser(actorId || payload.solicitanteId)
    const util = findUtil(payload.utilId)
    if (!util || !util.activo) fail('El útil no está disponible en el catálogo.')
    if (!enrichUtil(util).disponible || util.cantidadDisponible < 1) fail('No hay unidades disponibles de este útil.')
    if (util.duenoId === actor.id) fail('No podés solicitar un útil que vos mismo ofreciste.')
    if (!payload.compromiso) fail('Tenés que aceptar el compromiso de devolución.')
    const hoy = todayISO()
    const max = addDays(hoy, 7)
    if (!payload.fechaAcordada) fail('La fecha de devolución es obligatoria.')
    if (payload.fechaAcordada < hoy) fail('La fecha de devolución no puede ser anterior a hoy.')
    if (payload.fechaAcordada > max) fail('El plazo máximo de préstamo es de 7 días corridos.')
    const duplicate = data.solicitudes.find(
      (s) => s.utilId === util.id && s.solicitanteId === actor.id && ['pendiente', 'aprobada'].includes(s.estado),
    )
    if (duplicate) fail('Ya tenés una solicitud activa para este útil.')
    const solicitud = {
      id: `sol-${Date.now()}`,
      numero: nextId('S'),
      utilId: util.id,
      solicitanteId: actor.id,
      fechaSolicitud: hoy,
      fechaAcordada: payload.fechaAcordada,
      motivo: String(payload.motivo || '').trim(),
      estado: 'pendiente',
      compromiso: true,
      createdAt: demoNow(),
    }
    data.solicitudes.push(solicitud)
    saveDemoState()
    return enrichSolicitud(solicitud)
  },

  async cancelarSolicitud(id, actorId = null) {
    const solicitud = state().solicitudes.find((s) => s.id === id)
    if (!solicitud) fail('No se encontró la solicitud.')
    if (actorId && solicitud.solicitanteId !== actorId) fail('Solo podés cancelar tus propias solicitudes.')
    if (solicitud.estado !== 'pendiente') fail('Solo se pueden cancelar solicitudes pendientes.')
    solicitud.estado = 'cancelada'
    solicitud.updatedAt = demoNow()
    saveDemoState()
    return enrichSolicitud(solicitud)
  },

  async aprobarSolicitud(id, actorId) {
    const actor = currentUser(actorId)
    assertAdmin(actor)
    const solicitud = state().solicitudes.find((s) => s.id === id)
    if (!solicitud) fail('No se encontró la solicitud.')
    if (solicitud.estado !== 'pendiente') fail('La solicitud ya fue revisada.')
    const util = findUtil(solicitud.utilId)
    if (!util?.activo || util.cantidadDisponible < 1) fail('Ya no hay unidades disponibles para aprobar esta solicitud.')
    solicitud.estado = 'aprobada'
    solicitud.revisadoPor = actor.id
    solicitud.revisadoEn = demoNow()
    saveDemoState()
    return enrichSolicitud(solicitud)
  },

  async rechazarSolicitud(id, actorId, nota = '') {
    const actor = currentUser(actorId)
    assertAdmin(actor)
    const solicitud = state().solicitudes.find((s) => s.id === id)
    if (!solicitud) fail('No se encontró la solicitud.')
    if (solicitud.estado !== 'pendiente') fail('La solicitud ya fue revisada.')
    solicitud.estado = 'rechazada'
    solicitud.revisadoPor = actor.id
    solicitud.revisadoEn = demoNow()
    solicitud.notaRevision = String(nota || '').trim() || 'Solicitud rechazada por administración.'
    saveDemoState()
    return enrichSolicitud(solicitud)
  },

  async entregarSolicitud(id, actorId) {
    const actor = currentUser(actorId)
    assertAdmin(actor)
    const data = state()
    const solicitud = data.solicitudes.find((s) => s.id === id)
    if (!solicitud) fail('No se encontró la solicitud.')
    if (!['aprobada', 'pendiente'].includes(solicitud.estado)) fail('La solicitud no está en condiciones de entregarse.')
    if (solicitud.estado === 'pendiente') fail('Primero aprobá la solicitud.')
    const util = findUtil(solicitud.utilId)
    if (!util?.activo) fail('El útil ya no está activo.')
    if (util.cantidadDisponible < 1) fail('No hay unidades disponibles.')
    util.cantidadDisponible -= 1
    util.estado = normalizeUtilEstado(util)
    util.updatedAt = demoNow()
    solicitud.estado = 'atendida'
    solicitud.entregadoEn = demoNow()
    const prestamo = {
      id: `pre-${Date.now()}`,
      numero: nextId('P'),
      solicitudId: solicitud.id,
      utilId: util.id,
      estudianteId: solicitud.solicitanteId,
      fechaEntrega: todayISO(),
      fechaAcordada: solicitud.fechaAcordada,
      fechaDevolucionReal: null,
      estado: 'prestado',
      condicion: null,
      creadoPor: actor.id,
      createdAt: demoNow(),
    }
    data.prestamos.push(prestamo)
    saveDemoState()
    return enrichPrestamo(prestamo)
  },

  async listPrestamos({ userId = null, all = false } = {}) {
    let items = state().prestamos
    if (!all) items = items.filter((p) => p.estudianteId === userId)
    return items
      .map(enrichPrestamo)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  },

  async getPrestamo(id) {
    const prestamo = state().prestamos.find((p) => p.id === id)
    if (!prestamo) fail('No se encontró el préstamo.')
    return enrichPrestamo(prestamo)
  },

  async devolverPrestamo(id, actorId = null) {
    const prestamo = state().prestamos.find((p) => p.id === id)
    if (!prestamo) fail('No se encontró el préstamo.')
    if (actorId && prestamo.estudianteId !== actorId) fail('Solo podés registrar la devolución de tus préstamos.')
    if (prestamo.estado !== 'prestado') fail('El préstamo no está activo.')
    prestamo.estado = 'devuelto'
    prestamo.condicion = 'a_controlar'
    prestamo.fechaDevolucionReal = todayISO()
    prestamo.updatedAt = demoNow()
    saveDemoState()
    return enrichPrestamo(prestamo)
  },

  async reportarProblema({ prestamoId, actorId, tipo, descripcion }) {
    const prestamo = state().prestamos.find((p) => p.id === prestamoId)
    if (!prestamo) fail('No se encontró el préstamo.')
    if (prestamo.estudianteId !== actorId) fail('Solo podés avisar sobre tus propios préstamos.')
    if (prestamo.estado !== 'prestado') fail('El préstamo no está activo.')
    if (!['danado', 'perdido'].includes(tipo)) fail('Elegí si el útil se perdió o se dañó.')
    const texto = String(descripcion || '').trim()
    if (texto.length < 10) fail('Contá brevemente qué pasó (mínimo 10 caracteres).')
    const reporte = {
      id: `re-${Date.now()}`,
      prestamoId,
      tipo,
      descripcion: texto,
      estado: 'pendiente',
      reportadoPor: actorId,
      createdAt: demoNow(),
    }
    state().reportes.push(reporte)
    saveDemoState()
    return reporte
  },

  async listReportes() {
    return state().reportes
      .map((r) => {
        const prestamo = state().prestamos.find((p) => p.id === r.prestamoId)
        const autor = findUser(r.reportadoPor)
        return {
          ...r,
          prestamo: enrichPrestamo(prestamo),
          reportadoPorNombre: autor ? fullName(autor) : '—',
        }
      })
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  },

  async controlarDevolucion({ prestamoId, condicion, actorId }) {
    const actor = currentUser(actorId)
    assertAdmin(actor)
    const data = state()
    const prestamo = data.prestamos.find((p) => p.id === prestamoId)
    if (!prestamo) fail('No se encontró el préstamo.')
    if (prestamo.estado !== 'devuelto' || prestamo.condicion !== 'a_controlar') {
      fail('Este préstamo no está pendiente de control.')
    }
    if (!['buen_estado', 'danado', 'en_reparacion', 'perdido'].includes(condicion)) {
      fail('Elegí una condición de devolución válida.')
    }
    const util = findUtil(prestamo.utilId)
    prestamo.condicion = condicion
    prestamo.estado = condicion === 'perdido' ? 'perdido' : 'devuelto'
    prestamo.controladoPor = actor.id
    prestamo.controladoEn = demoNow()
    prestamo.updatedAt = demoNow()
    if (util) {
      if (condicion === 'buen_estado') {
        util.cantidadDisponible = Math.min(util.cantidadTotal, util.cantidadDisponible + 1)
        if (!['Dañado', 'En reparación'].includes(util.estado)) util.estado = 'Disponible'
      } else if (condicion === 'danado') {
        util.estado = 'Dañado'
      } else if (condicion === 'en_reparacion') {
        util.estado = 'En reparación'
      } else if (condicion === 'perdido') {
        util.cantidadTotal = Math.max(0, util.cantidadTotal - 1)
        util.cantidadDisponible = Math.min(util.cantidadDisponible, util.cantidadTotal)
        if (util.cantidadTotal === 0) util.estado = 'Dañado'
      }
      util.updatedAt = demoNow()
    }
    data.reportes
      .filter((r) => r.prestamoId === prestamo.id && r.estado === 'pendiente')
      .forEach((r) => {
        r.estado = 'resuelto'
        r.resueltoPor = actor.id
        r.resueltoEn = demoNow()
      })
    saveDemoState()
    return enrichPrestamo(prestamo)
  },

  // ---------- Ofertas de útiles ----------
  async listOfertas({ userId = null, all = false } = {}) {
    let items = state().ofertas
    if (!all) items = items.filter((o) => o.oferenteId === userId)
    return items
      .map(enrichOferta)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  },

  async crearOferta({ nombre, tipo, modalidad, descripcion, actorId }) {
    const data = state()
    if (!String(nombre || '').trim()) fail('El nombre del útil es obligatorio.')
    if (!tipo) fail('Elegí el tipo de útil.')
    if (!['donacion', 'intercambio'].includes(modalidad)) fail('Elegí donación o intercambio.')
    if (String(descripcion || '').trim().length < 10) fail('Describí el útil y su estado (mínimo 10 caracteres).')
    const oferta = {
      id: `of-${Date.now()}`,
      nombre: String(nombre).trim(),
      tipo,
      modalidad,
      descripcion: String(descripcion).trim(),
      estado: 'pendiente',
      oferenteId: actorId,
      createdAt: demoNow(),
    }
    data.ofertas.push(oferta)
    saveDemoState()
    return enrichOferta(oferta)
  },

  async cancelarOferta(id, actorId) {
    const oferta = state().ofertas.find((o) => o.id === id)
    if (!oferta) fail('No se encontró la oferta.')
    if (oferta.oferenteId !== actorId) fail('Solo podés cancelar tus ofertas.')
    if (oferta.estado !== 'pendiente') fail('Solo se pueden cancelar ofertas pendientes.')
    oferta.estado = 'cancelada'
    saveDemoState()
    return enrichOferta(oferta)
  },

  async aceptarOferta(id, actorId) {
    const actor = currentUser(actorId)
    assertAdmin(actor)
    const data = state()
    const oferta = data.ofertas.find((o) => o.id === id)
    if (!oferta) fail('No se encontró la oferta.')
    if (oferta.estado !== 'pendiente') fail('La oferta ya fue revisada.')
    const util = {
      id: `ut-${Date.now()}`,
      codigo: nextId('U'),
      nombre: oferta.nombre,
      tipo: oferta.tipo,
      estado: 'Disponible',
      cantidadTotal: 1,
      cantidadDisponible: 1,
      duenoId: oferta.oferenteId,
      origen: oferta.modalidad,
      ubicacion: 'Armario B · donaciones',
      observaciones: oferta.descripcion,
      activo: true,
      createdAt: demoNow(),
    }
    data.utiles.push(util)
    oferta.estado = 'aceptada'
    oferta.revisadaPor = actor.id
    oferta.revisadaEn = demoNow()
    saveDemoState()
    return { oferta: enrichOferta(oferta), util: enrichUtil(util) }
  },

  async rechazarOferta(id, actorId) {
    const actor = currentUser(actorId)
    assertAdmin(actor)
    const oferta = state().ofertas.find((o) => o.id === id)
    if (!oferta) fail('No se encontró la oferta.')
    if (oferta.estado !== 'pendiente') fail('La oferta ya fue revisada.')
    oferta.estado = 'rechazada'
    oferta.revisadaPor = actor.id
    oferta.revisadaEn = demoNow()
    saveDemoState()
    return enrichOferta(oferta)
  },

  // ---------- Avisos ----------
  async listAvisos({ includeInactive = false } = {}) {
    return state().avisos
      .filter((a) => includeInactive || a.activo)
      .map(enrichAviso)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  },

  async crearAviso(payload, actorId) {
    const actor = currentUser(actorId)
    if (actor.rol !== 'comision_comunicacion') {
      fail('Solo la comisión de comunicación puede crear avisos.')
    }
    if (!String(payload.titulo || '').trim()) fail('El título es obligatorio.')
    if (String(payload.contenido || '').trim().length < 20) fail('El contenido debe tener al menos 20 caracteres.')
    if (!payload.categoria) fail('Elegí una categoría.')
    const aviso = {
      id: `av-${Date.now()}`,
      titulo: String(payload.titulo).trim(),
      contenido: String(payload.contenido).trim(),
      categoria: payload.categoria,
      autorId: actorId,
      activo: true,
      createdAt: demoNow(),
    }
    state().avisos.push(aviso)
    saveDemoState()
    return enrichAviso(aviso)
  },

  async actualizarAviso(id, payload, actorId) {
    const actor = currentUser(actorId)
    if (actor.rol !== 'comision_comunicacion') fail('Solo la comisión de comunicación puede editar avisos.')
    const aviso = state().avisos.find((a) => a.id === id)
    if (!aviso) fail('No se encontró el aviso.')
    if (!String(payload.titulo || '').trim()) fail('El título es obligatorio.')
    if (String(payload.contenido || '').trim().length < 20) fail('El contenido debe tener al menos 20 caracteres.')
    Object.assign(aviso, {
      titulo: String(payload.titulo).trim(),
      contenido: String(payload.contenido).trim(),
      categoria: payload.categoria,
      updatedAt: demoNow(),
    })
    saveDemoState()
    return enrichAviso(aviso)
  },

  async archivarAviso(id, actorId) {
    const actor = currentUser(actorId)
    if (actor.rol !== 'comision_comunicacion') fail('Solo la comisión de comunicación puede archivar avisos.')
    const aviso = state().avisos.find((a) => a.id === id)
    if (!aviso) fail('No se encontró el aviso.')
    aviso.activo = false
    aviso.updatedAt = demoNow()
    saveDemoState()
    return enrichAviso(aviso)
  },

  // ---------- Acuerdos ----------
  async listAcuerdos({ includeInactive = false } = {}) {
    return state().acuerdos
      .filter((a) => includeInactive || a.activo)
      .map(enrichAcuerdo)
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
  },

  async crearAcuerdo(payload, actorId) {
    const actor = currentUser(actorId)
    if (actor.rol !== 'secretario') fail('Solo secretaría puede crear acuerdos.')
    if (!payload.fecha) fail('La fecha es obligatoria.')
    if (!String(payload.tema || '').trim()) fail('El tema es obligatorio.')
    if (String(payload.decision || '').trim().length < 10) fail('La decisión debe tener al menos 10 caracteres.')
    const acuerdo = {
      id: `ac-${Date.now()}`,
      fecha: payload.fecha,
      tema: String(payload.tema).trim(),
      decision: String(payload.decision).trim(),
      autorId: actorId,
      activo: true,
      createdAt: demoNow(),
    }
    state().acuerdos.push(acuerdo)
    saveDemoState()
    return enrichAcuerdo(acuerdo)
  },

  async actualizarAcuerdo(id, payload, actorId) {
    const actor = currentUser(actorId)
    if (actor.rol !== 'secretario') fail('Solo secretaría puede modificar acuerdos.')
    const acuerdo = state().acuerdos.find((a) => a.id === id)
    if (!acuerdo) fail('No se encontró el acuerdo.')
    if (!payload.fecha) fail('La fecha es obligatoria.')
    if (!String(payload.tema || '').trim()) fail('El tema es obligatorio.')
    if (String(payload.decision || '').trim().length < 10) fail('La decisión debe tener al menos 10 caracteres.')
    Object.assign(acuerdo, {
      fecha: payload.fecha,
      tema: String(payload.tema).trim(),
      decision: String(payload.decision).trim(),
      updatedAt: demoNow(),
    })
    saveDemoState()
    return enrichAcuerdo(acuerdo)
  },

  async archivarAcuerdo(id, actorId) {
    const actor = currentUser(actorId)
    if (actor.rol !== 'secretario') fail('Solo secretaría puede archivar acuerdos.')
    const acuerdo = state().acuerdos.find((a) => a.id === id)
    if (!acuerdo) fail('No se encontró el acuerdo.')
    acuerdo.activo = false
    acuerdo.updatedAt = demoNow()
    saveDemoState()
    return enrichAcuerdo(acuerdo)
  },

  // ---------- Votaciones ----------
  async listVotaciones() {
    return state().votaciones
      .map(enrichVotacion)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  },

  async crearVotacion(payload, actorId) {
    const actor = currentUser(actorId)
    assertPresident(actor)
    if (!String(payload.titulo || '').trim()) fail('El título es obligatorio.')
    if (!payload.fechaCierre) fail('La fecha de cierre es obligatoria.')
    if (payload.fechaCierre < todayISO()) fail('La fecha de cierre no puede ser anterior a hoy.')
    const opciones = [...new Set((payload.opciones || []).map((o) => String(o).trim()).filter(Boolean))]
    if (opciones.length < 2) fail('Agregá al menos dos opciones distintas.')
    const votacion = {
      id: `vo-${Date.now()}`,
      titulo: String(payload.titulo).trim(),
      descripcion: String(payload.descripcion || '').trim(),
      opciones,
      estado: 'abierta',
      fechaCierre: payload.fechaCierre,
      creadaPor: actorId,
      createdAt: demoNow(),
    }
    state().votaciones.push(votacion)
    saveDemoState()
    return enrichVotacion(votacion)
  },

  async votar(votacionId, opcion, actorId) {
    const votacion = state().votaciones.find((v) => v.id === votacionId)
    if (!votacion) fail('No se encontró la votación.')
    if (votacion.estado !== 'abierta') fail('La votación está cerrada.')
    if (votacion.fechaCierre < todayISO()) fail('La votación venció por fecha.')
    if (!votacion.opciones.includes(opcion)) fail('Elegí una opción válida.')
    if (state().votos.some((v) => v.votacionId === votacionId && v.usuarioId === actorId)) {
      fail('Ya votaste en esta votación.')
    }
    state().votos.push({
      id: `vt-${Date.now()}`,
      votacionId,
      usuarioId: actorId,
      opcion,
      createdAt: demoNow(),
    })
    saveDemoState()
    return enrichVotacion(votacion)
  },

  async cerrarVotacion(id, actorId) {
    const actor = currentUser(actorId)
    assertPresident(actor)
    const votacion = state().votaciones.find((v) => v.id === id)
    if (!votacion) fail('No se encontró la votación.')
    if (votacion.estado !== 'abierta') fail('La votación ya está cerrada.')
    votacion.estado = 'cerrada'
    votacion.cerradaEn = demoNow()
    votacion.cerradaPor = actorId
    saveDemoState()
    return enrichVotacion(votacion)
  },

  // ---------- Recursos ----------
  async listMovimientos({ includeInactive = false } = {}) {
    return state().movimientos
      .filter((m) => includeInactive || m.activo)
      .map(enrichMovimiento)
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
  },

  async crearMovimiento(payload, actorId) {
    const actor = currentUser(actorId)
    if (actor.rol !== 'tesorero') fail('Solo tesorería puede registrar movimientos.')
    if (!payload.fecha) fail('La fecha es obligatoria.')
    if (!String(payload.concepto || '').trim()) fail('El concepto es obligatorio.')
    if (!['ingreso', 'egreso'].includes(payload.tipo)) fail('Elegí ingreso o egreso.')
    const monto = Number(payload.monto)
    if (!Number.isFinite(monto) || monto <= 0) fail('El monto debe ser un número mayor a 0.')
    const movimiento = {
      id: `mv-${Date.now()}`,
      fecha: payload.fecha,
      concepto: String(payload.concepto).trim(),
      tipo: payload.tipo,
      monto,
      registradoPor: actorId,
      activo: true,
      createdAt: demoNow(),
    }
    state().movimientos.push(movimiento)
    saveDemoState()
    return enrichMovimiento(movimiento)
  },

  async anularMovimiento(id, actorId) {
    const actor = currentUser(actorId)
    if (actor.rol !== 'tesorero') fail('Solo tesorería puede anular movimientos.')
    const movimiento = state().movimientos.find((m) => m.id === id)
    if (!movimiento) fail('No se encontró el movimiento.')
    movimiento.activo = false
    movimiento.updatedAt = demoNow()
    saveDemoState()
    return enrichMovimiento(movimiento)
  },

  // ---------- Actividades y tareas ----------
  async listActividades({ includeInactive = false } = {}) {
    return state().actividades
      .filter((a) => includeInactive || a.activo)
      .map((a) => ({
        ...a,
        tareas: state().tareas.filter((t) => t.actividadId === a.id && t.activo).map(enrichTarea),
      }))
      .sort((a, b) => (a.fechaLimite || '').localeCompare(b.fechaLimite || ''))
  },

  async listTareas({ userId = null, all = false } = {}) {
    let items = state().tareas.filter((t) => t.activo)
    if (!all) items = items.filter((t) => t.asignadoId === userId)
    return items
      .map(enrichTarea)
      .sort((a, b) => (a.fechaLimite || '').localeCompare(b.fechaLimite || ''))
  },

  async crearActividad(payload, actorId) {
    const actor = currentUser(actorId)
    if (actor.rol !== 'comision_organizacion') fail('Solo organización puede crear actividades.')
    if (!String(payload.titulo || '').trim()) fail('El título es obligatorio.')
    if (!payload.fechaLimite) fail('La fecha límite es obligatoria.')
    const actividad = {
      id: `act-${Date.now()}`,
      titulo: String(payload.titulo).trim(),
      descripcion: String(payload.descripcion || '').trim(),
      fechaLimite: payload.fechaLimite,
      creadaPor: actorId,
      activo: true,
      createdAt: demoNow(),
    }
    state().actividades.push(actividad)
    saveDemoState()
    return actividad
  },

  async crearTarea(payload, actorId) {
    const actor = currentUser(actorId)
    if (actor.rol !== 'comision_organizacion') fail('Solo organización puede crear tareas.')
    if (!payload.actividadId) fail('Elegí una actividad.')
    if (!String(payload.titulo || '').trim()) fail('El título es obligatorio.')
    if (!payload.asignadoId) fail('Elegí a quién se asigna.')
    if (!payload.fechaLimite) fail('La fecha límite es obligatoria.')
    const tarea = {
      id: `ta-${Date.now()}`,
      actividadId: payload.actividadId,
      titulo: String(payload.titulo).trim(),
      descripcion: String(payload.descripcion || '').trim(),
      asignadoId: payload.asignadoId,
      estado: 'pendiente',
      fechaLimite: payload.fechaLimite,
      creadaPor: actorId,
      activo: true,
      createdAt: demoNow(),
    }
    state().tareas.push(tarea)
    saveDemoState()
    return enrichTarea(tarea)
  },

  async actualizarEstadoTarea(id, estado, actorId) {
    const actor = currentUser(actorId)
    const tarea = state().tareas.find((t) => t.id === id)
    if (!tarea) fail('No se encontró la tarea.')
    if (actor.rol !== 'comision_organizacion' && tarea.asignadoId !== actorId) {
      fail('Solo podés actualizar el estado de tus tareas asignadas.')
    }
    if (!['pendiente', 'en_curso', 'terminada'].includes(estado)) fail('Estado de tarea inválido.')
    tarea.estado = estado
    tarea.updatedAt = demoNow()
    saveDemoState()
    return enrichTarea(tarea)
  },

  async archivarTarea(id, actorId) {
    const actor = currentUser(actorId)
    if (actor.rol !== 'comision_organizacion') fail('Solo organización puede archivar tareas.')
    const tarea = state().tareas.find((t) => t.id === id)
    if (!tarea) fail('No se encontró la tarea.')
    tarea.activo = false
    tarea.updatedAt = demoNow()
    saveDemoState()
    return enrichTarea(tarea)
  },

  // ---------- Encuestas ----------
  async listEncuestas() {
    return state().encuestas.map((e) => ({ ...e }))
  },

  async guardarEncuesta({ curso, momento, vecesSinUtil, actorId }) {
    const numero = Number(vecesSinUtil)
    if (!Number.isInteger(numero) || numero < 0 || numero > 30) {
      fail('Indicá un número entero entre 0 y 30.')
    }
    if (!['antes', 'despues'].includes(momento)) fail('Momento de encuesta inválido.')
    const data = state()
    const previa = data.encuestas.find(
      (e) => e.usuarioId === actorId && e.curso === curso && e.momento === momento,
    )
    if (previa) {
      previa.vecesSinUtil = numero
      previa.fecha = todayISO()
    } else {
      data.encuestas.push({
        id: `en-${Date.now()}`,
        curso,
        momento,
        vecesSinUtil: numero,
        usuarioId: actorId,
        fecha: todayISO(),
        createdAt: demoNow(),
      })
    }
    saveDemoState()
    return data.encuestas.filter((e) => e.usuarioId === actorId)
  },

  async resetDemo() {
    resetDemoState()
    return true
  },

  /** Datos completos solo para el cálculo de estadísticas en modo demo. */
  async getRawStatsData() {
    const data = state()
    return {
      solicitudes: data.solicitudes.map(enrichSolicitud),
      prestamos: data.prestamos.map(enrichPrestamo),
      utiles: data.utiles.map(enrichUtil),
      tareas: data.tareas.filter((t) => t.activo).map(enrichTarea),
      avisos: data.avisos.map(enrichAviso),
      acuerdos: data.acuerdos.map(enrichAcuerdo),
      reportes: data.reportes,
      ofertas: data.ofertas,
      movimientos: data.movimientos.map(enrichMovimiento),
      encuestas: data.encuestas,
      usuarios: data.users.map(publicUser),
      votaciones: data.votaciones.map(enrichVotacion),
    }
  },

  async getEstadisticas() {
    const data = await this.getRawStatsData()
    return calcularEstadisticas(data)
  },
}

export { fullName }
