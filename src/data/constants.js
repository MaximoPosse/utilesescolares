export const CURSOS = [
  '1.º A', '1.º B',
  '2.º A', '2.º B',
  '3.º A', '3.º B',
  '4.º A', '4.º B',
  '5.º A', '5.º B',
  '6.º A', '6.º B',
]

export const ROLES = {
  estudiante: {
    label: 'Estudiante integrante',
    short: 'Estudiante',
    descripcion: 'Puede pedir préstamos, ofrecer útiles, votar y consultar la información de la cooperativa.',
  },
  presidente: {
    label: 'Presidente/a',
    short: 'Presidencia',
    descripcion: 'Crea y cierra votaciones, ve el panel general y asigna roles a los integrantes.',
  },
  secretario: {
    label: 'Secretario/a',
    short: 'Secretaría',
    descripcion: 'Crea y modifica acuerdos. Los demás integrantes solo los consultan.',
  },
  tesorero: {
    label: 'Tesorero/a',
    short: 'Tesorería',
    descripcion: 'Registra movimientos de recursos o dinero y consulta el historial.',
  },
  comision_administracion: {
    label: 'Comisión de administración',
    short: 'Administración',
    descripcion: 'Gestiona el inventario, aprueba solicitudes, registra entregas, devoluciones, pérdidas y daños.',
  },
  comision_comunicacion: {
    label: 'Comisión de comunicación',
    short: 'Comunicación',
    descripcion: 'Crea, edita y archiva avisos para la comunidad (no se borran: quedan en el historial).',
  },
  comision_organizacion: {
    label: 'Comisión de organización',
    short: 'Organización',
    descripcion: 'Crea actividades y tareas, las asigna y sigue su estado.',
  },
}

export const ROL_OPTIONS = Object.entries(ROLES).map(([value, meta]) => ({
  value,
  label: meta.label,
}))

export const TIPOS_UTIL = [
  { value: 'Escritura', icon: '✏️', descripcion: 'Lápices, lapiceras, marcadores y resaltadores.' },
  { value: 'Medición', icon: '📐', descripcion: 'Reglas, escuadras, transportadores y compases.' },
  { value: 'Papel', icon: '📄', descripcion: 'Hojas, cuadernos, cartulinas y block de dibujo.' },
  { value: 'Guardado', icon: '🎒', descripcion: 'Carpetas, folios, cartucheras y estuches.' },
  { value: 'Manualidades', icon: '🎨', descripcion: 'Tijeras, pegamentos, colores y materiales para crear.' },
]

export const TIPO_UTIL_OPTIONS = TIPOS_UTIL.map((t) => t.value)

export const ESTADOS_UTIL = [
  'Disponible',
  'Prestado',
  'Atrasado',
  'Dañado',
  'En reparación',
]

export const ESTADOS_SOLICITUD = {
  pendiente: { label: 'Pendiente de aprobación', tone: 'warning' },
  aprobada: { label: 'Aprobada, lista para entregar', tone: 'info' },
  atendida: { label: 'Entregada', tone: 'success' },
  rechazada: { label: 'Rechazada', tone: 'danger' },
  cancelada: { label: 'Cancelada', tone: 'neutral' },
}

export const ESTADOS_PRESTAMO = {
  prestado: { label: 'Prestado', tone: 'info' },
  atrasado: { label: 'Atrasado', tone: 'danger' },
  devuelto: { label: 'Devuelto', tone: 'success' },
  perdido: { label: 'Perdido', tone: 'danger' },
}

export const CONDICIONES_DEVOLUCION = [
  { value: 'buen_estado', label: 'Buen estado', descripcion: 'Vuelve al catálogo disponible.' },
  { value: 'danado', label: 'Dañado', descripcion: 'Se registra el daño y se revisa.' },
  { value: 'en_reparacion', label: 'En reparación', descripcion: 'Queda fuera del catálogo hasta repararlo.' },
  { value: 'perdido', label: 'Perdido', descripcion: 'Se descuenta del inventario disponible.' },
]

export const CONDICION_LABEL = {
  buen_estado: 'Buen estado',
  danado: 'Dañado',
  en_reparacion: 'En reparación',
  perdido: 'Perdido',
  a_controlar: 'A controlar',
}

export const ESTADOS_TAREA = {
  pendiente: { label: 'Pendiente', tone: 'warning' },
  en_curso: { label: 'En curso', tone: 'info' },
  terminada: { label: 'Terminada', tone: 'success' },
}

export const CATEGORIAS_AVISO = [
  'Útiles disponibles',
  'Novedades',
  'Reuniones',
  'Recordatorios de devolución',
]

export const MODALIDADES_OFERTA = [
  { value: 'donacion', label: 'Donación', descripcion: 'Se suma al catálogo sin esperar algo a cambio.' },
  { value: 'intercambio', label: 'Intercambio', descripcion: 'La cooperativa lo publica y coordina el intercambio.' },
]

export const ROL_NAV = {
  estudiante: [],
  presidente: ['/estadisticas', '/integrantes'],
  secretario: ['/acuerdos'],
  tesorero: ['/recursos'],
  comision_administracion: ['/gestion-prestamos', '/inventario'],
  comision_comunicacion: ['/avisos'],
  comision_organizacion: ['/tareas'],
}

export const PERMISOS = {
  estudiante: {
    asignarRoles: false,
    votaciones: false,
    cerrarVotaciones: false,
    acuerdos: false,
    recursos: false,
    avisos: false,
    gestionPrestamos: false,
    inventario: false,
    ofertas: false,
    tareas: false,
    estadisticas: 'resumen',
  },
  presidente: {
    asignarRoles: true,
    votaciones: true,
    cerrarVotaciones: true,
    acuerdos: false,
    recursos: false,
    avisos: false,
    gestionPrestamos: false,
    inventario: false,
    ofertas: false,
    tareas: false,
    estadisticas: 'general',
  },
  secretario: {
    asignarRoles: false,
    votaciones: false,
    cerrarVotaciones: false,
    acuerdos: true,
    recursos: false,
    avisos: false,
    gestionPrestamos: false,
    inventario: false,
    ofertas: false,
    tareas: false,
    estadisticas: 'secretaria',
  },
  tesorero: {
    asignarRoles: false,
    votaciones: false,
    cerrarVotaciones: false,
    acuerdos: false,
    recursos: true,
    avisos: false,
    gestionPrestamos: false,
    inventario: false,
    ofertas: false,
    tareas: false,
    estadisticas: 'tesoreria',
  },
  comision_administracion: {
    asignarRoles: false,
    votaciones: false,
    cerrarVotaciones: false,
    acuerdos: false,
    recursos: false,
    avisos: false,
    gestionPrestamos: true,
    inventario: true,
    ofertas: true,
    tareas: false,
    estadisticas: 'administracion',
  },
  comision_comunicacion: {
    asignarRoles: false,
    votaciones: false,
    cerrarVotaciones: false,
    acuerdos: false,
    recursos: false,
    avisos: true,
    gestionPrestamos: false,
    inventario: false,
    ofertas: false,
    tareas: false,
    estadisticas: 'comunicacion',
  },
  comision_organizacion: {
    asignarRoles: false,
    votaciones: false,
    cerrarVotaciones: false,
    acuerdos: false,
    recursos: false,
    avisos: false,
    gestionPrestamos: false,
    inventario: false,
    ofertas: false,
    tareas: true,
    estadisticas: 'organizacion',
  },
}

export function permisosDe(rol) {
  return PERMISOS[rol] ?? PERMISOS.estudiante
}

export const META_KPI = {
  cobertura: 90,
  aTiempo: 85,
  buenEstado: 95,
  tareas: 90,
}
