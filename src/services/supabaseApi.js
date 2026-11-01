import { supabase } from '../lib/supabase.js'
import { fullName, todayISO } from '../data/utils.js'

function fail(error, fallback = 'No se pudo completar la operación.') {
  const message = error?.message || ''
  if (error?.code === '23505' || /duplicate key/i.test(message)) {
    throw new Error('Ya existe un registro con esos datos.')
  }
  if (error?.code === '42501' || /row-level security|permission denied/i.test(message)) {
    throw new Error('No tenés permisos para realizar esta acción.')
  }
  if (/Invalid login credentials/i.test(message)) {
    throw new Error('Correo o contraseña incorrectos.')
  }
  if (/Email not confirmed/i.test(message)) {
    throw new Error('Tenés que confirmar tu correo antes de ingresar.')
  }
  if (/User already registered/i.test(message)) {
    throw new Error('Ya existe una cuenta con ese correo.')
  }
  if (error?.code === 'PGRST116') {
    throw new Error('No se encontró el registro o no tenés permiso para verlo.')
  }
  throw new Error(message || fallback)
}

function check(result, fallback) {
  if (result.error) fail(result.error, fallback)
  return result.data
}

function mapProfile(row) {
  if (!row) return null
  return {
    id: row.id,
    nombre: row.nombre,
    apellido: row.apellido,
    curso: row.curso,
    rol: row.rol,
    email: row.email,
    activo: row.activo,
    createdAt: row.created_at,
  }
}

function mapUtil(row, users) {
  if (!row) return null
  const dueno = row.dueno_id ? users.get(row.dueno_id) : null
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    tipo: row.tipo,
    estado: row.estado,
    cantidadTotal: row.cantidad_total,
    cantidadDisponible: row.cantidad_disponible,
    duenoId: row.dueno_id,
    dueno,
    duenoNombre: dueno ? fullName(dueno) : 'Cooperativa',
    origen: row.origen,
    ubicacion: row.ubicacion,
    observaciones: row.observaciones,
    activo: row.activo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    disponible: row.activo && row.cantidad_disponible > 0 && !['Dañado', 'En reparación'].includes(row.estado),
  }
}

function mapSolicitud(row, { users, utiles }) {
  const util = utiles.get(row.util_id)
  const solicitante = users.get(row.solicitante_id)
  return {
    id: row.id,
    numero: row.numero,
    utilId: row.util_id,
    util,
    utilNombre: util?.nombre ?? 'Útil',
    utilCodigo: util?.codigo ?? '—',
    utilTipo: util?.tipo ?? '—',
    solicitanteId: row.solicitante_id,
    solicitante,
    solicitanteNombre: solicitante ? fullName(solicitante) : '—',
    solicitanteCurso: solicitante?.curso ?? '—',
    fechaSolicitud: row.fecha_solicitud,
    fechaAcordada: row.fecha_acordada,
    motivo: row.motivo,
    estado: row.estado,
    compromiso: row.compromiso,
    revisadoPor: row.revisado_por,
    revisadoEn: row.revisado_en,
    notaRevision: row.nota_revision,
    entregadoEn: row.entregado_en,
    createdAt: row.created_at,
    solicitudNumero: row.numero,
  }
}

function mapPrestamo(row, { users, utiles, solicitudes }) {
  const util = utiles.get(row.util_id)
  const estudiante = users.get(row.estudiante_id)
  const solicitud = [...solicitudes.values()].find((s) => s.id === row.solicitud_id)
  return {
    id: row.id,
    numero: row.numero,
    solicitudId: row.solicitud_id,
    solicitudNumero: solicitud?.numero ?? '—',
    utilId: row.util_id,
    util,
    utilNombre: util?.nombre ?? 'Útil',
    utilCodigo: util?.codigo ?? '—',
    utilTipo: util?.tipo ?? '—',
    estudianteId: row.estudiante_id,
    estudiante,
    estudianteNombre: estudiante ? fullName(estudiante) : '—',
    estudianteCurso: estudiante?.curso ?? '—',
    fechaEntrega: row.fecha_entrega,
    fechaAcordada: row.fecha_acordada,
    fechaDevolucionReal: row.fecha_devolucion_real,
    estado: row.estado,
    condicion: row.condicion,
    creadoPor: row.creado_por,
    controladoPor: row.controlado_por,
    controladoEn: row.controlado_en,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapAviso(row, users) {
  const autor = users.get(row.autor_id)
  return {
    id: row.id,
    titulo: row.titulo,
    contenido: row.contenido,
    categoria: row.categoria,
    autorId: row.autor_id,
    autor,
    autorNombre: autor ? fullName(autor) : '—',
    activo: row.activo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapAcuerdo(row, users) {
  const autor = users.get(row.autor_id)
  return {
    id: row.id,
    fecha: row.fecha,
    tema: row.tema,
    decision: row.decision,
    autorId: row.autor_id,
    autor,
    autorNombre: autor ? fullName(autor) : '—',
    activo: row.activo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapVotacion(row, users, votos) {
  const propios = votos.filter((v) => v.votacion_id === row.id)
  const conteos = Object.fromEntries((row.opciones || []).map((o) => [o, 0]))
  propios.forEach((v) => {
    if (conteos[v.opcion] !== undefined) conteos[v.opcion] += 1
  })
  const autor = users.get(row.creada_por)
  return {
    id: row.id,
    titulo: row.titulo,
    descripcion: row.descripcion,
    opciones: row.opciones || [],
    estado: row.estado,
    fechaCierre: row.fecha_cierre,
    creadaPor: row.creada_por,
    autorNombre: autor ? fullName(autor) : '—',
    votos: propios.map((v) => ({
      id: v.id,
      votacionId: v.votacion_id,
      usuarioId: v.usuario_id,
      opcion: v.opcion,
      createdAt: v.created_at,
    })),
    conteos,
    totalVotos: propios.length,
    cerradaPorFecha: row.fecha_cierre < todayISO() && row.estado === 'abierta',
    cerradaEn: row.cerrada_en,
    createdAt: row.created_at,
  }
}

function mapMovimiento(row, users) {
  const autor = users.get(row.registrado_por)
  return {
    id: row.id,
    fecha: row.fecha,
    concepto: row.concepto,
    tipo: row.tipo,
    monto: Number(row.monto),
    registradoPor: row.registrado_por,
    registradoPorNombre: autor ? fullName(autor) : '—',
    activo: row.activo,
    createdAt: row.created_at,
  }
}

function mapTarea(row, users, actividades) {
  const asignado = users.get(row.asignado_id)
  const actividad = actividades.get(row.actividad_id)
  return {
    id: row.id,
    actividadId: row.actividad_id,
    actividadTitulo: actividad?.titulo ?? 'Sin actividad',
    titulo: row.titulo,
    descripcion: row.descripcion,
    asignadoId: row.asignado_id,
    asignado,
    asignadoNombre: asignado ? fullName(asignado) : '—',
    asignadoCurso: asignado?.curso ?? '—',
    estado: row.estado,
    fechaLimite: row.fecha_limite,
    creadaPor: row.creada_por,
    activo: row.activo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapOferta(row, users) {
  const oferente = users.get(row.oferente_id)
  return {
    id: row.id,
    nombre: row.nombre,
    tipo: row.tipo,
    modalidad: row.modalidad,
    descripcion: row.descripcion,
    estado: row.estado,
    oferenteId: row.oferente_id,
    oferente,
    oferenteNombre: oferente ? fullName(oferente) : '—',
    oferenteCurso: oferente?.curso ?? '—',
    revisadoPor: row.revisado_por,
    revisadoEn: row.revisado_en,
    createdAt: row.created_at,
  }
}

function mapReporte(row, { users, prestamos, utiles, solicitudes }) {
  const prestamoRow = prestamos.get(row.prestamo_id)
  const reportadoPor = users.get(row.reportado_por)
  const prestamo = prestamoRow
    ? mapPrestamo(prestamoRow, { users, utiles, solicitudes })
    : null
  return {
    id: row.id,
    prestamoId: row.prestamo_id,
    prestamo,
    tipo: row.tipo,
    descripcion: row.descripcion,
    estado: row.estado,
    reportadoPor: row.reportado_por,
    reportadoPorNombre: reportadoPor ? fullName(reportadoPor) : '—',
    resueltoPor: row.resuelto_por,
    resueltoEn: row.resuelto_en,
    createdAt: row.created_at,
  }
}

async function loadAll() {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const tables = [
    'perfiles', 'utiles', 'solicitudes', 'prestamos', 'reportes', 'ofertas',
    'avisos', 'acuerdos', 'votaciones', 'votos', 'movimientos',
    'actividades', 'tareas', 'encuestas',
  ]
  const results = await Promise.all(tables.map((table) => supabase.from(table).select('*')))
  const raw = {}
  results.forEach((result, index) => {
    raw[tables[index]] = check(result, `No se pudo leer la tabla ${tables[index]}.`)
  })

  const users = new Map(raw.perfiles.map((p) => [p.id, mapProfile(p)]))
  const utiles = new Map(raw.utiles.map((u) => [u.id, mapUtil(u, users)]))
  const solicitudes = new Map(
    raw.solicitudes.map((s) => [s.id, mapSolicitud(s, { users, utiles })]),
  )
  const prestamos = new Map(
    raw.prestamos.map((p) => [p.id, mapPrestamo(p, { users, utiles, solicitudes })]),
  )
  const actividades = new Map(
    raw.actividades.map((a) => [a.id, {
      id: a.id,
      titulo: a.titulo,
      descripcion: a.descripcion,
      fechaLimite: a.fecha_limite,
      creadaPor: a.creada_por,
      activo: a.activo,
      createdAt: a.created_at,
    }]),
  )

  return {
    users: [...users.values()],
    utiles: [...utiles.values()].sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true })),
    solicitudes: [...solicitudes.values()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    prestamos: [...prestamos.values()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    reportes: raw.reportes
      .map((r) => mapReporte(r, { users, prestamos, utiles, solicitudes }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    ofertas: raw.ofertas.map((o) => mapOferta(o, users)),
    avisos: raw.avisos.map((a) => mapAviso(a, users)).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    acuerdos: raw.acuerdos.map((a) => mapAcuerdo(a, users)).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')),
    votaciones: raw.votaciones.map((v) => mapVotacion(v, users, raw.votos)),
    movimientos: raw.movimientos.map((m) => mapMovimiento(m, users)).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')),
    actividades: [...actividades.values()].map((a) => ({
      ...a,
      tareas: raw.tareas
        .filter((t) => t.actividad_id === a.id && t.activo)
        .map((t) => mapTarea(t, users, actividades)),
    })),
    tareas: raw.tareas
      .filter((t) => t.activo)
      .map((t) => mapTarea(t, users, actividades))
      .sort((a, b) => (a.fechaLimite || '').localeCompare(b.fechaLimite || '')),
    encuestas: raw.encuestas.map((e) => ({
      id: e.id,
      curso: e.curso,
      momento: e.momento,
      vecesSinUtil: e.veces_sin_util,
      usuarioId: e.usuario_id,
      fecha: e.fecha,
      createdAt: e.created_at,
    })),
  }
}

async function reloadSolicitud(id) {
  const data = await loadAll()
  const item = data.solicitudes.find((s) => s.id === id)
  if (!item) throw new Error('No se encontró la solicitud.')
  return item
}

async function reloadPrestamo(id) {
  const data = await loadAll()
  const item = data.prestamos.find((p) => p.id === id)
  if (!item) throw new Error('No se encontró el préstamo.')
  return item
}

function nowIso() {
  return new Date().toISOString()
}

export const supabaseApi = {
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) fail(error)
    return data.user
  },

  async register(payload) {
    const { data, error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          nombre: payload.nombre,
          apellido: payload.apellido,
          curso: payload.curso,
        },
      },
    })
    if (error) fail(error)
    return data
  },

  async listUsuarios() {
    const data = await loadAll()
    return data.users.sort((a, b) => fullName(a).localeCompare(fullName(b), 'es'))
  },

  async actualizarRol(usuarioId, rol) {
    const { error } = await supabase.rpc('asignar_rol', { p_usuario_id: usuarioId, p_rol: rol })
    if (error) fail(error)
    const data = await loadAll()
    return data.users.find((u) => u.id === usuarioId)
  },

  async listUtiles({ includeInactive = false, search = '', tipo = '', disponibilidad = '' } = {}) {
    const data = await loadAll()
    let items = data.utiles.filter((u) => includeInactive || u.activo)
    if (search) {
      const q = search.toLowerCase()
      items = items.filter((u) =>
        `${u.nombre} ${u.codigo} ${u.tipo} ${u.ubicacion} ${u.observaciones}`.toLowerCase().includes(q),
      )
    }
    if (tipo) items = items.filter((u) => u.tipo === tipo)
    if (disponibilidad === 'disponible') items = items.filter((u) => u.disponible)
    if (disponibilidad === 'no_disponible') items = items.filter((u) => !u.disponible)
    return items
  },

  async getUtil(id) {
    const data = await loadAll()
    const item = data.utiles.find((u) => u.id === id)
    if (!item) throw new Error('No se encontró el útil.')
    return item
  },

  async crearUtil(payload) {
    const row = {
      codigo: String(payload.codigo).trim().toUpperCase(),
      nombre: String(payload.nombre).trim(),
      tipo: payload.tipo,
      estado: payload.estado,
      cantidad_total: Number(payload.cantidadTotal),
      cantidad_disponible: Number(payload.cantidadDisponible),
      dueno_id: payload.duenoId || null,
      origen: payload.origen || 'cooperativa',
      ubicacion: String(payload.ubicacion).trim(),
      observaciones: String(payload.observaciones || '').trim(),
      activo: true,
    }
    const result = await supabase.from('utiles').insert(row).select().single()
    const created = check(result, 'No se pudo crear el útil.')
    return reloadUtil(created.id)
  },

  async actualizarUtil(id, payload) {
    const row = {
      codigo: String(payload.codigo).trim().toUpperCase(),
      nombre: String(payload.nombre).trim(),
      tipo: payload.tipo,
      estado: payload.estado,
      cantidad_total: Number(payload.cantidadTotal),
      cantidad_disponible: Number(payload.cantidadDisponible),
      origen: payload.origen || 'cooperativa',
      ubicacion: String(payload.ubicacion).trim(),
      observaciones: String(payload.observaciones || '').trim(),
      updated_at: nowIso(),
    }
    const result = await supabase.from('utiles').update(row).eq('id', id).select().single()
    check(result, 'No se pudo actualizar el útil.')
    return reloadUtil(id)
  },

  async bajaLogicaUtil(id) {
    const result = await supabase.from('utiles').update({ activo: false, updated_at: nowIso() }).eq('id', id).select().single()
    check(result, 'No se pudo dar de baja el útil.')
    return reloadUtil(id)
  },

  async reactivarUtil(id) {
    const result = await supabase.from('utiles').update({ activo: true, updated_at: nowIso() }).eq('id', id).select().single()
    check(result, 'No se pudo reactivar el útil.')
    return reloadUtil(id)
  },

  async listSolicitudes({ userId = null, all = false } = {}) {
    const data = await loadAll()
    return all ? data.solicitudes : data.solicitudes.filter((s) => s.solicitanteId === userId)
  },

  async getSolicitud(id) {
    return reloadSolicitud(id)
  },

  async crearSolicitud(payload) {
    const { data, error } = await supabase.rpc('solicitar_prestamo', {
      p_util_id: payload.utilId,
      p_fecha_acordada: payload.fechaAcordada,
      p_motivo: payload.motivo || '',
      p_compromiso: Boolean(payload.compromiso),
    })
    if (error) fail(error)
    const id = data?.id ?? data
    if (!id) throw new Error('La solicitud se creó, pero no se pudo recuperar su número.')
    return reloadSolicitud(id)
  },

  async cancelarSolicitud(id) {
    const result = await supabase
      .from('solicitudes')
      .update({ estado: 'cancelada', updated_at: nowIso() })
      .eq('id', id)
      .eq('estado', 'pendiente')
      .select()
    const rows = check(result, 'No se pudo cancelar la solicitud.')
    if (!rows.length) throw new Error('Solo podés cancelar solicitudes pendientes propias.')
    return reloadSolicitud(id)
  },

  async aprobarSolicitud(id) {
    const { error } = await supabase.rpc('aprobar_solicitud', { p_solicitud_id: id })
    if (error) fail(error)
    return reloadSolicitud(id)
  },

  async rechazarSolicitud(id, actorId, nota = '') {
    const { error } = await supabase.rpc('rechazar_solicitud', {
      p_solicitud_id: id,
      p_nota: nota,
    })
    if (error) fail(error)
    return reloadSolicitud(id)
  },

  async entregarSolicitud(id) {
    const { error } = await supabase.rpc('entregar_solicitud', { p_solicitud_id: id })
    if (error) fail(error)
    const data = await loadAll()
    const solicitud = data.solicitudes.find((s) => s.id === id)
    const prestamo = data.prestamos.find((p) => p.solicitudId === id)
    return prestamo || solicitud
  },

  async listPrestamos({ userId = null, all = false } = {}) {
    const data = await loadAll()
    return all ? data.prestamos : data.prestamos.filter((p) => p.estudianteId === userId)
  },

  async getPrestamo(id) {
    return reloadPrestamo(id)
  },

  async devolverPrestamo(id) {
    const { error } = await supabase.rpc('registrar_devolucion', { p_prestamo_id: id })
    if (error) fail(error)
    return reloadPrestamo(id)
  },

  async reportarProblema({ prestamoId, tipo, descripcion }) {
    const result = await supabase.from('reportes').insert({
      prestamo_id: prestamoId,
      tipo,
      descripcion: String(descripcion).trim(),
      estado: 'pendiente',
    }).select().single()
    return check(result, 'No se pudo registrar el aviso.')
  },

  async listReportes() {
    const data = await loadAll()
    return data.reportes
  },

  async controlarDevolucion({ prestamoId, condicion }) {
    const { error } = await supabase.rpc('controlar_devolucion', {
      p_prestamo_id: prestamoId,
      p_condicion: condicion,
    })
    if (error) fail(error)
    return reloadPrestamo(prestamoId)
  },

  async listOfertas({ userId = null, all = false } = {}) {
    const data = await loadAll()
    return all ? data.ofertas : data.ofertas.filter((o) => o.oferenteId === userId)
  },

  async crearOferta({ nombre, tipo, modalidad, descripcion }) {
    const result = await supabase.from('ofertas').insert({
      nombre: String(nombre).trim(),
      tipo,
      modalidad,
      descripcion: String(descripcion).trim(),
      estado: 'pendiente',
    }).select().single()
    const row = check(result, 'No se pudo registrar la oferta.')
    const data = await loadAll()
    return data.ofertas.find((o) => o.id === row.id)
  },

  async cancelarOferta(id) {
    const result = await supabase.from('ofertas')
      .update({ estado: 'cancelada' })
      .eq('id', id)
      .eq('estado', 'pendiente')
      .select()
    const rows = check(result, 'No se pudo cancelar la oferta.')
    if (!rows.length) throw new Error('Solo podés cancelar ofertas pendientes propias.')
    const data = await loadAll()
    return data.ofertas.find((o) => o.id === id)
  },

  async aceptarOferta(id) {
    const { data: utilId, error } = await supabase.rpc('aceptar_oferta', { p_oferta_id: id })
    if (error) fail(error)
    const data = await loadAll()
    return {
      oferta: data.ofertas.find((o) => o.id === id),
      util: data.utiles.find((u) => u.id === utilId),
    }
  },

  async rechazarOferta(id) {
    const { data: authData } = await supabase.auth.getUser()
    const result = await supabase.from('ofertas')
      .update({
        estado: 'rechazada',
        revisado_por: authData?.user?.id ?? null,
        revisado_en: nowIso(),
      })
      .eq('id', id)
      .eq('estado', 'pendiente')
      .select()
    const rows = check(result, 'No se pudo rechazar la oferta.')
    if (!rows.length) throw new Error('La oferta ya fue revisada o no tenés permisos.')
    const data = await loadAll()
    return data.ofertas.find((o) => o.id === id)
  },

  async listAvisos({ includeInactive = false } = {}) {
    const data = await loadAll()
    return includeInactive ? data.avisos : data.avisos.filter((a) => a.activo)
  },

  async crearAviso(payload) {
    const result = await supabase.from('avisos').insert({
      titulo: String(payload.titulo).trim(),
      contenido: String(payload.contenido).trim(),
      categoria: payload.categoria,
      activo: true,
    }).select().single()
    const row = check(result, 'No se pudo publicar el aviso.')
    const data = await loadAll()
    return data.avisos.find((a) => a.id === row.id)
  },

  async actualizarAviso(id, payload) {
    const result = await supabase.from('avisos').update({
      titulo: String(payload.titulo).trim(),
      contenido: String(payload.contenido).trim(),
      categoria: payload.categoria,
      updated_at: nowIso(),
    }).eq('id', id).select().single()
    check(result, 'No se pudo actualizar el aviso.')
    const data = await loadAll()
    return data.avisos.find((a) => a.id === id)
  },

  async archivarAviso(id) {
    const result = await supabase.from('avisos').update({ activo: false, updated_at: nowIso() }).eq('id', id).select().single()
    check(result, 'No se pudo archivar el aviso.')
    const data = await loadAll()
    return data.avisos.find((a) => a.id === id)
  },

  async listAcuerdos({ includeInactive = false } = {}) {
    const data = await loadAll()
    return includeInactive ? data.acuerdos : data.acuerdos.filter((a) => a.activo)
  },

  async crearAcuerdo(payload) {
    const result = await supabase.from('acuerdos').insert({
      fecha: payload.fecha,
      tema: String(payload.tema).trim(),
      decision: String(payload.decision).trim(),
      activo: true,
    }).select().single()
    const row = check(result, 'No se pudo registrar el acuerdo.')
    const data = await loadAll()
    return data.acuerdos.find((a) => a.id === row.id)
  },

  async actualizarAcuerdo(id, payload) {
    const result = await supabase.from('acuerdos').update({
      fecha: payload.fecha,
      tema: String(payload.tema).trim(),
      decision: String(payload.decision).trim(),
      updated_at: nowIso(),
    }).eq('id', id).select().single()
    check(result, 'No se pudo actualizar el acuerdo.')
    const data = await loadAll()
    return data.acuerdos.find((a) => a.id === id)
  },

  async archivarAcuerdo(id) {
    const result = await supabase.from('acuerdos').update({ activo: false, updated_at: nowIso() }).eq('id', id).select().single()
    check(result, 'No se pudo archivar el acuerdo.')
    const data = await loadAll()
    return data.acuerdos.find((a) => a.id === id)
  },

  async listVotaciones() {
    const data = await loadAll()
    return data.votaciones.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  },

  async crearVotacion(payload) {
    const opciones = [...new Set((payload.opciones || []).map((o) => String(o).trim()).filter(Boolean))]
    const result = await supabase.from('votaciones').insert({
      titulo: String(payload.titulo).trim(),
      descripcion: String(payload.descripcion || '').trim(),
      opciones,
      estado: 'abierta',
      fecha_cierre: payload.fechaCierre,
    }).select().single()
    const row = check(result, 'No se pudo crear la votación.')
    const data = await loadAll()
    return data.votaciones.find((v) => v.id === row.id)
  },

  async votar(votacionId, opcion) {
    const result = await supabase.from('votos').insert({
      votacion_id: votacionId,
      opcion,
    }).select().single()
    check(result, 'No se pudo registrar el voto.')
    const data = await loadAll()
    return data.votaciones.find((v) => v.id === votacionId)
  },

  async cerrarVotacion(id) {
    const { data: authData } = await supabase.auth.getUser()
    const result = await supabase.from('votaciones').update({
      estado: 'cerrada',
      cerrada_en: nowIso(),
      cerrada_por: authData?.user?.id ?? null,
    }).eq('id', id).eq('estado', 'abierta').select()
    const rows = check(result, 'No se pudo cerrar la votación.')
    if (!rows.length) throw new Error('La votación ya está cerrada o no tenés permisos.')
    const data = await loadAll()
    return data.votaciones.find((v) => v.id === id)
  },

  async listMovimientos({ includeInactive = false } = {}) {
    const data = await loadAll()
    return includeInactive ? data.movimientos : data.movimientos.filter((m) => m.activo)
  },

  async crearMovimiento(payload) {
    const result = await supabase.from('movimientos').insert({
      fecha: payload.fecha,
      concepto: String(payload.concepto).trim(),
      tipo: payload.tipo,
      monto: Number(payload.monto),
      activo: true,
    }).select().single()
    const row = check(result, 'No se pudo registrar el movimiento.')
    const data = await loadAll()
    return data.movimientos.find((m) => m.id === row.id)
  },

  async anularMovimiento(id) {
    const result = await supabase.from('movimientos').update({ activo: false, updated_at: nowIso() }).eq('id', id).select().single()
    check(result, 'No se pudo anular el movimiento.')
    const data = await loadAll()
    return data.movimientos.find((m) => m.id === id)
  },

  async listActividades({ includeInactive = false } = {}) {
    const data = await loadAll()
    return includeInactive ? data.actividades : data.actividades.filter((a) => a.activo)
  },

  async listTareas({ userId = null, all = false } = {}) {
    const data = await loadAll()
    return all ? data.tareas : data.tareas.filter((t) => t.asignadoId === userId)
  },

  async crearActividad(payload) {
    const result = await supabase.from('actividades').insert({
      titulo: String(payload.titulo).trim(),
      descripcion: String(payload.descripcion || '').trim(),
      fecha_limite: payload.fechaLimite,
      activo: true,
    }).select().single()
    return check(result, 'No se pudo crear la actividad.')
  },

  async crearTarea(payload) {
    const result = await supabase.from('tareas').insert({
      actividad_id: payload.actividadId,
      titulo: String(payload.titulo).trim(),
      descripcion: String(payload.descripcion || '').trim(),
      asignado_id: payload.asignadoId,
      estado: 'pendiente',
      fecha_limite: payload.fechaLimite,
      activo: true,
    }).select().single()
    const row = check(result, 'No se pudo crear la tarea.')
    const data = await loadAll()
    return data.tareas.find((t) => t.id === row.id)
  },

  async actualizarEstadoTarea(id, estado) {
    const result = await supabase.from('tareas').update({
      estado,
      updated_at: nowIso(),
    }).eq('id', id).select().single()
    check(result, 'No se pudo actualizar la tarea.')
    const data = await loadAll()
    return data.tareas.find((t) => t.id === id)
  },

  async archivarTarea(id) {
    const result = await supabase.from('tareas').update({ activo: false, updated_at: nowIso() }).eq('id', id).select().single()
    check(result, 'No se pudo archivar la tarea.')
    const data = await loadAll()
    return data.tareas.find((t) => t.id === id)
  },

  async listEncuestas() {
    const data = await loadAll()
    return data.encuestas
  },

  async guardarEncuesta({ curso, momento, vecesSinUtil }) {
    const { error } = await supabase.rpc('guardar_encuesta', {
      p_curso: curso,
      p_momento: momento,
      p_veces_sin_util: Number(vecesSinUtil),
    })
    if (error) fail(error, 'No se pudo guardar la encuesta.')
    return reloadEncuestas()
  },

  async getEstadisticas() {
    const { data, error } = await supabase.rpc('estadisticas_cooperativa')
    if (error) fail(error, 'No se pudieron cargar las estadísticas.')
    return data
  },

  async resetDemo() {
    throw new Error('El reinicio de datos solo está disponible en modo demostración.')
  },
}

async function reloadUtil(id) {
  const data = await loadAll()
  const item = data.utiles.find((u) => u.id === id)
  if (!item) throw new Error('No se encontró el útil.')
  return item
}

async function reloadEncuestas() {
  const data = await loadAll()
  return data.encuestas
}
