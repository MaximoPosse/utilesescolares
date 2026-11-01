import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../data/demoAccounts.js'
import { addDays, toISO, todayISO } from '../data/utils.js'

export const DEMO_STORAGE_KEY = 'cooperativa-utiles:demo:v1'
export const SEED_VERSION = 4

const d = (offset) => addDays(todayISO(), offset)
const iso = (date = new Date()) => toISO(date)

const USERS = [
  { id: 'u-001', ...DEMO_ACCOUNTS[0] },
  { id: 'u-002', email: 'bruno@coop.demo', nombre: 'Bruno', apellido: 'Gómez', curso: '4.º A', rol: 'estudiante' },
  { id: 'u-003', email: 'carla@coop.demo', nombre: 'Carla', apellido: 'Díaz', curso: '5.º B', rol: 'estudiante' },
  { id: 'u-004', email: 'diego@coop.demo', nombre: 'Diego', apellido: 'Sosa', curso: '6.º A', rol: 'estudiante' },
  { id: 'u-005', ...DEMO_ACCOUNTS[1] },
  { id: 'u-006', ...DEMO_ACCOUNTS[2] },
  { id: 'u-007', ...DEMO_ACCOUNTS[3] },
  { id: 'u-008', ...DEMO_ACCOUNTS[4] },
  { id: 'u-009', ...DEMO_ACCOUNTS[5] },
  { id: 'u-010', ...DEMO_ACCOUNTS[6] },
  { id: 'u-011', email: 'lucia@coop.demo', nombre: 'Lucía', apellido: 'Herrera', curso: '5.º B', rol: 'estudiante' },
  { id: 'u-012', email: 'mateo@coop.demo', nombre: 'Mateo', apellido: 'Ríos', curso: '6.º A', rol: 'estudiante' },
].map((u) => ({ ...u, password: DEMO_PASSWORD, activo: true, createdAt: d(-120) }))

const UTILES = [
  {
    id: 'ut-001', codigo: 'U-001', nombre: 'Lápiz negro HB', tipo: 'Escritura', estado: 'Disponible',
    cantidadTotal: 12, cantidadDisponible: 8, duenoId: null, origen: 'cooperativa',
    ubicacion: 'Armario A · caja 1', observaciones: 'Se prestan de a una unidad. Afilados.',
    activo: true, createdAt: d(-100),
  },
  {
    id: 'ut-002', codigo: 'U-002', nombre: 'Regla de 30 cm', tipo: 'Medición', estado: 'Disponible',
    cantidadTotal: 6, cantidadDisponible: 4, duenoId: null, origen: 'cooperativa',
    ubicacion: 'Armario A · caja 2', observaciones: 'Plástico transparente, con números grandes.',
    activo: true, createdAt: d(-98),
  },
  {
    id: 'ut-003', codigo: 'U-003', nombre: 'Hojas A4 (paquete de 20)', tipo: 'Papel', estado: 'Disponible',
    cantidadTotal: 10, cantidadDisponible: 7, duenoId: 'u-002', origen: 'donacion',
    ubicacion: 'Armario B · estante 1', observaciones: 'Donadas por Bruno para trabajos prácticos.',
    activo: true, createdAt: d(-90),
  },
  {
    id: 'ut-004', codigo: 'U-004', nombre: 'Carpeta azul con folios', tipo: 'Guardado', estado: 'Atrasado',
    cantidadTotal: 1, cantidadDisponible: 0, duenoId: 'u-011', origen: 'donacion',
    ubicacion: 'Armario B · estante 2', observaciones: 'Tiene etiqueta con el nombre de la cooperativa.',
    activo: true, createdAt: d(-85),
  },
  {
    id: 'ut-005', codigo: 'U-005', nombre: 'Tijera escolar punta redonda', tipo: 'Manualidades', estado: 'Disponible',
    cantidadTotal: 5, cantidadDisponible: 5, duenoId: null, origen: 'cooperativa',
    ubicacion: 'Armario A · caja 3', observaciones: 'Apta para zurdos y diestros.',
    activo: true, createdAt: d(-80),
  },
  {
    id: 'ut-006', codigo: 'U-006', nombre: 'Escuadra 45°', tipo: 'Medición', estado: 'Dañado',
    cantidadTotal: 2, cantidadDisponible: 0, duenoId: null, origen: 'cooperativa',
    ubicacion: 'Depósito · revisión', observaciones: 'Una escuadra está quebrada. No se presta.',
    activo: true, createdAt: d(-75),
  },
  {
    id: 'ut-007', codigo: 'U-007', nombre: 'Marcadores de colores (x6)', tipo: 'Escritura', estado: 'Disponible',
    cantidadTotal: 4, cantidadDisponible: 2, duenoId: 'u-003', origen: 'donacion',
    ubicacion: 'Armario A · caja 4', observaciones: 'Controlar que tengan tapa antes de prestar.',
    activo: true, createdAt: d(-70),
  },
  {
    id: 'ut-008', codigo: 'U-008', nombre: 'Cuaderno universitario 80 hojas', tipo: 'Papel', estado: 'Disponible',
    cantidadTotal: 5, cantidadDisponible: 4, duenoId: null, origen: 'cooperativa',
    ubicacion: 'Armario B · estante 1', observaciones: 'Rayado. Uno está en control de devolución.',
    activo: true, createdAt: d(-66),
  },
  {
    id: 'ut-009', codigo: 'U-009', nombre: 'Compás metálico', tipo: 'Medición', estado: 'En reparación',
    cantidadTotal: 2, cantidadDisponible: 0, duenoId: null, origen: 'cooperativa',
    ubicacion: 'Depósito · reparación', observaciones: 'Se está ajustando la bisagra.',
    activo: true, createdAt: d(-60),
  },
  {
    id: 'ut-010', codigo: 'U-010', nombre: 'Cartulina blanca', tipo: 'Papel', estado: 'Disponible',
    cantidadTotal: 15, cantidadDisponible: 12, duenoId: 'u-009', origen: 'donacion',
    ubicacion: 'Armario B · estante 3', observaciones: 'Tamaño 50 x 70 cm.',
    activo: true, createdAt: d(-52),
  },
  {
    id: 'ut-011', codigo: 'U-011', nombre: 'Pegamento en barra', tipo: 'Manualidades', estado: 'Disponible',
    cantidadTotal: 8, cantidadDisponible: 6, duenoId: null, origen: 'cooperativa',
    ubicacion: 'Armario A · caja 5', observaciones: 'Sin solventes. Revisar que cierren bien.',
    activo: true, createdAt: d(-48),
  },
  {
    id: 'ut-012', codigo: 'U-012', nombre: 'Transportador 180°', tipo: 'Medición', estado: 'Disponible',
    cantidadTotal: 4, cantidadDisponible: 3, duenoId: null, origen: 'cooperativa',
    ubicacion: 'Armario A · caja 2', observaciones: 'Transparente, con escala en grados.',
    activo: true, createdAt: d(-42),
  },
  {
    id: 'ut-013', codigo: 'U-013', nombre: 'Cartuchera de tela', tipo: 'Guardado', estado: 'Disponible',
    cantidadTotal: 3, cantidadDisponible: 2, duenoId: 'u-012', origen: 'donacion',
    ubicacion: 'Armario B · estante 2', observaciones: 'Lavada y en buen estado.',
    activo: true, createdAt: d(-35),
  },
  {
    id: 'ut-014', codigo: 'U-014', nombre: 'Regla de 20 cm', tipo: 'Medición', estado: 'Disponible',
    cantidadTotal: 3, cantidadDisponible: 2, duenoId: 'u-001', origen: 'intercambio',
    ubicacion: 'Armario A · caja 2', observaciones: 'Donada por Ana. Se puede pedir en préstamo.',
    activo: true, createdAt: d(-30),
  },
  {
    id: 'ut-015', codigo: 'U-015', nombre: 'Lápices de colores (x12)', tipo: 'Escritura', estado: 'Disponible',
    cantidadTotal: 4, cantidadDisponible: 4, duenoId: null, origen: 'cooperativa',
    ubicacion: 'Armario A · caja 1', observaciones: 'Set completo. Se entrega en estuche.',
    activo: true, createdAt: d(-24),
  },
  {
    id: 'ut-016', codigo: 'U-016', nombre: 'Set de geometría', tipo: 'Medición', estado: 'Disponible',
    cantidadTotal: 2, cantidadDisponible: 1, duenoId: null, origen: 'cooperativa',
    ubicacion: 'Armario A · caja 2', observaciones: 'Incluye regla, escuadra y transportador.',
    activo: true, createdAt: d(-18),
  },
  {
    id: 'ut-017', codigo: 'U-017', nombre: 'Folios A4 (x10)', tipo: 'Guardado', estado: 'Disponible',
    cantidadTotal: 10, cantidadDisponible: 10, duenoId: null, origen: 'donacion',
    ubicacion: 'Armario B · estante 2', observaciones: 'Paquete abierto, se prestan de a diez.',
    activo: true, createdAt: d(-12),
  },
  {
    id: 'ut-018', codigo: 'U-018', nombre: 'Témperas (x6)', tipo: 'Manualidades', estado: 'Dañado',
    cantidadTotal: 1, cantidadDisponible: 0, duenoId: null, origen: 'cooperativa',
    ubicacion: 'Depósito · revisión', observaciones: 'Un pomo está roto; no se puede prestar.',
    activo: true, createdAt: d(-10),
  },
  {
    id: 'ut-019', codigo: 'U-019', nombre: 'Calculadora científica', tipo: 'Medición', estado: 'Disponible',
    cantidadTotal: 1, cantidadDisponible: 0, duenoId: null, origen: 'cooperativa',
    ubicacion: 'Armario A · caja 6', observaciones: 'Baja lógica de prueba: se retiró del catálogo.',
    activo: false, createdAt: d(-8),
  },
  {
    id: 'ut-020', codigo: 'U-020', nombre: 'Calculadora básica', tipo: 'Medición', estado: 'Prestado',
    cantidadTotal: 1, cantidadDisponible: 0, duenoId: null, origen: 'cooperativa',
    ubicacion: 'Armario A · caja 6', observaciones: 'Prestada para el taller de matemática.',
    activo: true, createdAt: d(-7),
  },
]

const HISTORICAL_STUDENTS = ['u-001', 'u-002', 'u-003', 'u-004', 'u-011', 'u-012']
const HISTORICAL_UTILES = ['ut-001', 'ut-002', 'ut-003', 'ut-005', 'ut-007', 'ut-010', 'ut-011', 'ut-014', 'ut-015']
const HISTORICAL_BASE = d(-95)

function buildHistorical() {
  const solicitudes = []
  const prestamos = []
  for (let i = 0; i < 40; i += 1) {
    const n = i + 1
    const offset = 10 + i * 2
    const solicitudDate = d(-offset)
    const entregaDate = d(-offset + 1)
    const acordada = d(-offset + 6)
    const late = i === 12
    const damaged = i === 7
    const real = late ? addDays(acordada, 3) : addDays(acordada, -1)
    const studentId = HISTORICAL_STUDENTS[i % HISTORICAL_STUDENTS.length]
    const utilId = HISTORICAL_UTILES[i % HISTORICAL_UTILES.length]
    const solicitudId = `sol-h${String(n).padStart(2, '0')}`
    const numero = `S-${String(n).padStart(4, '0')}`
    const numeroPrestamo = `P-${String(n).padStart(4, '0')}`
    solicitudes.push({
      id: solicitudId,
      numero,
      utilId,
      solicitanteId: studentId,
      fechaSolicitud: solicitudDate,
      fechaAcordada: acordada,
      motivo: i % 3 === 0 ? 'Para una actividad de clase.' : 'Uso escolar.',
      estado: 'atendida',
      compromiso: true,
      createdAt: `${solicitudDate}T10:00:00`,
    })
    prestamos.push({
      id: `pre-h${String(n).padStart(2, '0')}`,
      numero: numeroPrestamo,
      solicitudId,
      utilId,
      estudianteId: studentId,
      fechaEntrega: entregaDate,
      fechaAcordada: acordada,
      fechaDevolucionReal: real,
      estado: 'devuelto',
      condicion: damaged ? 'danado' : 'buen_estado',
      creadoPor: 'u-008',
      createdAt: `${entregaDate}T11:00:00`,
    })
  }
  return { solicitudes, prestamos }
}

const historical = buildHistorical()

const SPECIAL_SOLICITUDES = [
  {
    id: 'sol-041', numero: 'S-0041', utilId: 'ut-001', solicitanteId: 'u-001',
    fechaSolicitud: d(-12), fechaAcordada: d(-6), motivo: 'Me quedé sin lápiz en Lengua.',
    estado: 'atendida', compromiso: true, createdAt: `${d(-12)}T09:10:00`,
  },
  {
    id: 'sol-042', numero: 'S-0042', utilId: 'ut-007', solicitanteId: 'u-001',
    fechaSolicitud: d(-1), fechaAcordada: d(6), motivo: 'Para la clase de Arte del jueves.',
    estado: 'pendiente', compromiso: true, createdAt: `${d(-1)}T14:25:00`,
  },
  {
    id: 'sol-043', numero: 'S-0043', utilId: 'ut-004', solicitanteId: 'u-002',
    fechaSolicitud: d(-14), fechaAcordada: d(-7), motivo: 'Para ordenar las fichas de Historia.',
    estado: 'atendida', compromiso: true, createdAt: `${d(-14)}T08:40:00`,
  },
  {
    id: 'sol-044', numero: 'S-0044', utilId: 'ut-008', solicitanteId: 'u-003',
    fechaSolicitud: d(-3), fechaAcordada: d(4), motivo: 'Cuaderno para la feria de ciencias.',
    estado: 'aprobada', compromiso: true, createdAt: `${d(-3)}T16:05:00`,
  },
  {
    id: 'sol-045', numero: 'S-0045', utilId: 'ut-011', solicitanteId: 'u-004',
    fechaSolicitud: d(-2), fechaAcordada: d(5), motivo: 'Trabajo de plástica en grupo.',
    estado: 'pendiente', compromiso: true, createdAt: `${d(-2)}T10:30:00`,
  },
  {
    id: 'sol-046', numero: 'S-0046', utilId: 'ut-005', solicitanteId: 'u-011',
    fechaSolicitud: d(-20), fechaAcordada: d(-13), motivo: 'Maqueta de Ciencias Naturales.',
    estado: 'atendida', compromiso: true, createdAt: `${d(-20)}T11:00:00`,
  },
  {
    id: 'sol-047', numero: 'S-0047', utilId: 'ut-003', solicitanteId: 'u-012',
    fechaSolicitud: d(-10), fechaAcordada: d(-3), motivo: 'Impresión de un trabajo práctico.',
    estado: 'atendida', compromiso: true, createdAt: `${d(-10)}T13:20:00`,
  },
  {
    id: 'sol-048', numero: 'S-0048', utilId: 'ut-009', solicitanteId: 'u-001',
    fechaSolicitud: d(-8), fechaAcordada: d(-1), motivo: 'Para dibujo técnico.',
    estado: 'rechazada', compromiso: true, createdAt: `${d(-8)}T09:15:00`,
    revisadoPor: 'u-008', revisadoEn: `${d(-8)}T10:05:00`,
    notaRevision: 'El compás está en reparación. Podés pedir la escuadra o el set de geometría.',
  },
  {
    id: 'sol-049', numero: 'S-0049', utilId: 'ut-002', solicitanteId: 'u-002',
    fechaSolicitud: d(-6), fechaAcordada: d(1), motivo: 'Para Matemática.',
    estado: 'cancelada', compromiso: true, createdAt: `${d(-6)}T15:45:00`,
  },
  {
    id: 'sol-050', numero: 'S-0050', utilId: 'ut-001', solicitanteId: 'u-003',
    fechaSolicitud: d(-9), fechaAcordada: d(-2), motivo: 'Préstamo de lápiz para el acto.',
    estado: 'atendida', compromiso: true, createdAt: `${d(-9)}T12:10:00`,
  },
  {
    id: 'sol-051', numero: 'S-0051', utilId: 'ut-012', solicitanteId: 'u-004',
    fechaSolicitud: d(-8), fechaAcordada: d(-1), motivo: 'Para medir ángulos en el taller.',
    estado: 'atendida', compromiso: true, createdAt: `${d(-8)}T08:30:00`,
  },
  {
    id: 'sol-052', numero: 'S-0052', utilId: 'ut-016', solicitanteId: 'u-002',
    fechaSolicitud: d(-2), fechaAcordada: d(5), motivo: 'Geometría: construcciones.',
    estado: 'atendida', compromiso: true, createdAt: `${d(-2)}T17:00:00`,
  },
  {
    id: 'sol-053', numero: 'S-0053', utilId: 'ut-008', solicitanteId: 'u-004',
    fechaSolicitud: d(-6), fechaAcordada: d(1), motivo: 'Apuntes de la semana.',
    estado: 'atendida', compromiso: true, createdAt: `${d(-6)}T09:50:00`,
  },
  {
    id: 'sol-054', numero: 'S-0054', utilId: 'ut-013', solicitanteId: 'u-001',
    fechaSolicitud: d(-2), fechaAcordada: d(4), motivo: 'Para guardar los marcadores del taller.',
    estado: 'atendida', compromiso: true, createdAt: `${d(-2)}T11:20:00`,
  },
  {
    id: 'sol-055', numero: 'S-0055', utilId: 'ut-020', solicitanteId: 'u-003',
    fechaSolicitud: d(-3), fechaAcordada: d(2), motivo: 'Para la clase de Física.',
    estado: 'atendida', compromiso: true, createdAt: `${d(-3)}T10:40:00`,
  },
]

const SPECIAL_PRESTAMOS = [
  {
    id: 'pre-041', numero: 'P-0041', solicitudId: 'sol-041', utilId: 'ut-001', estudianteId: 'u-001',
    fechaEntrega: d(-11), fechaAcordada: d(-6), fechaDevolucionReal: d(-7), estado: 'devuelto',
    condicion: 'buen_estado', creadoPor: 'u-008', createdAt: `${d(-11)}T09:30:00`,
  },
  {
    id: 'pre-042', numero: 'P-0042', solicitudId: 'sol-043', utilId: 'ut-004', estudianteId: 'u-002',
    fechaEntrega: d(-13), fechaAcordada: d(-7), fechaDevolucionReal: null, estado: 'prestado',
    condicion: null, creadoPor: 'u-008', createdAt: `${d(-13)}T10:00:00`,
  },
  {
    id: 'pre-043', numero: 'P-0043', solicitudId: 'sol-046', utilId: 'ut-005', estudianteId: 'u-011',
    fechaEntrega: d(-19), fechaAcordada: d(-13), fechaDevolucionReal: d(-12), estado: 'devuelto',
    condicion: 'buen_estado', creadoPor: 'u-008', createdAt: `${d(-19)}T11:15:00`,
  },
  {
    id: 'pre-044', numero: 'P-0044', solicitudId: 'sol-047', utilId: 'ut-003', estudianteId: 'u-012',
    fechaEntrega: d(-9), fechaAcordada: d(-3), fechaDevolucionReal: d(-2), estado: 'devuelto',
    condicion: 'buen_estado', creadoPor: 'u-008', createdAt: `${d(-9)}T13:30:00`,
  },
  {
    id: 'pre-045', numero: 'P-0045', solicitudId: 'sol-050', utilId: 'ut-001', estudianteId: 'u-003',
    fechaEntrega: d(-8), fechaAcordada: d(-2), fechaDevolucionReal: d(-2), estado: 'devuelto',
    condicion: 'danado', creadoPor: 'u-008', createdAt: `${d(-8)}T12:30:00`,
  },
  {
    id: 'pre-046', numero: 'P-0046', solicitudId: 'sol-051', utilId: 'ut-012', estudianteId: 'u-004',
    fechaEntrega: d(-7), fechaAcordada: d(-1), fechaDevolucionReal: null, estado: 'prestado',
    condicion: null, creadoPor: 'u-008', createdAt: `${d(-7)}T09:00:00`,
  },
  {
    id: 'pre-047', numero: 'P-0047', solicitudId: 'sol-052', utilId: 'ut-016', estudianteId: 'u-002',
    fechaEntrega: d(-1), fechaAcordada: d(5), fechaDevolucionReal: null, estado: 'prestado',
    condicion: null, creadoPor: 'u-008', createdAt: `${d(-1)}T17:20:00`,
  },
  {
    id: 'pre-048', numero: 'P-0048', solicitudId: 'sol-053', utilId: 'ut-008', estudianteId: 'u-004',
    fechaEntrega: d(-5), fechaAcordada: d(1), fechaDevolucionReal: todayISO(), estado: 'devuelto',
    condicion: 'a_controlar', creadoPor: 'u-008', createdAt: `${d(-5)}T10:10:00`,
  },
  {
    id: 'pre-049', numero: 'P-0049', solicitudId: 'sol-054', utilId: 'ut-013', estudianteId: 'u-001',
    fechaEntrega: d(-1), fechaAcordada: d(4), fechaDevolucionReal: null, estado: 'prestado',
    condicion: null, creadoPor: 'u-008', createdAt: `${d(-1)}T11:40:00`,
  },
  {
    id: 'pre-050', numero: 'P-0050', solicitudId: 'sol-055', utilId: 'ut-020', estudianteId: 'u-003',
    fechaEntrega: d(-1), fechaAcordada: d(2), fechaDevolucionReal: null, estado: 'prestado',
    condicion: null, creadoPor: 'u-008', createdAt: `${d(-1)}T11:00:00`,
  },
]

const AVISOS = [
  {
    id: 'av-001', titulo: 'Nuevos lápices y reglas disponibles',
    contenido: 'Ya están en el catálogo los lápices HB y las reglas de 30 cm. Podés solicitar el préstamo desde la sección Catálogo y retirarlo en el armario de la cooperativa.',
    categoria: 'Útiles disponibles', autorId: 'u-009', activo: true,
    createdAt: `${d(-1)}T08:30:00`,
  },
  {
    id: 'av-002', titulo: 'Reunión de la cooperativa',
    contenido: 'Nos encontramos el viernes a las 13:30 en el aula 2 para revisar los préstamos atrasados y organizar la feria de intercambio. ¡Traé tus ideas!',
    categoria: 'Reuniones', autorId: 'u-005', activo: true,
    createdAt: `${d(-3)}T17:10:00`,
  },
  {
    id: 'av-003', titulo: 'Recordatorio: préstamos de 7 días',
    contenido: 'Los préstamos tienen un plazo máximo de 7 días corridos. Si ya terminaste de usar un útil, registrá la devolución desde Mis préstamos para que otra persona pueda usarlo.',
    categoria: 'Recordatorios de devolución', autorId: 'u-009', activo: true,
    createdAt: `${d(-5)}T09:00:00`,
  },
  {
    id: 'av-004', titulo: 'Campaña de donación de hojas',
    contenido: 'Durante este mes recibimos paquetes de hojas A4 y folios. Podés acercarlos a la comisión de administración o cargar una oferta desde Ofrecer útil.',
    categoria: 'Novedades', autorId: 'u-009', activo: true,
    createdAt: `${d(-8)}T12:00:00`,
  },
  {
    id: 'av-005', titulo: 'Aviso anterior archivado',
    contenido: 'Este aviso se conserva como historial de prueba y no se muestra en el tablero principal.',
    categoria: 'Novedades', autorId: 'u-009', activo: false,
    createdAt: `${d(-20)}T12:00:00`,
  },
]

const ACUERDOS = [
  {
    id: 'ac-001', fecha: d(-30), tema: 'Plazo máximo de préstamo',
    decision: 'Se establece un plazo máximo de 7 días corridos para todos los préstamos. La devolución se registra desde Mis préstamos y queda a control de administración.',
    autorId: 'u-006', activo: true, createdAt: `${d(-30)}T18:00:00`,
  },
  {
    id: 'ac-002', fecha: d(-22), tema: 'Campaña de donaciones',
    decision: 'Destinar los útiles donados en buen estado al catálogo de la cooperativa. Los útiles dañados se registran para reparación o baja lógica.',
    autorId: 'u-006', activo: true, createdAt: `${d(-22)}T18:20:00`,
  },
  {
    id: 'ac-003', fecha: d(-10), tema: 'Feria de intercambio',
    decision: 'Realizar una feria de intercambio durante la última semana del trimestre. La comisión de organización coordina las tareas y la comisión de comunicación difunde el aviso.',
    autorId: 'u-006', activo: true, createdAt: `${d(-10)}T17:45:00`,
  },
  {
    id: 'ac-004', fecha: d(-40), tema: 'Registro de acuerdos',
    decision: 'Todos los acuerdos se conservan en el sistema. Las modificaciones mantienen el historial y solo la secretaría puede editarlos.',
    autorId: 'u-006', activo: true, createdAt: `${d(-40)}T18:10:00`,
  },
]

const VOTACIONES = [
  {
    id: 'vo-001', titulo: '¿Qué compramos con el fondo solidario?',
    descripcion: 'La cooperativa recibió una donación. Elegí el útil que más necesitamos reponer este mes.',
    opciones: ['Lápices negros', 'Hojas A4', 'Reglas de 30 cm', 'Tijeras escolares'],
    estado: 'abierta', fechaCierre: d(3), creadaPor: 'u-005', createdAt: `${d(-2)}T10:00:00`,
  },
  {
    id: 'vo-002', titulo: '¿Cambiamos el horario de atención?',
    descripcion: 'Propuesta: atender también durante el recreo largo de los martes.',
    opciones: ['Sí, durante el recreo largo', 'No, mantener el horario actual'],
    estado: 'cerrada', fechaCierre: d(-4), creadaPor: 'u-005', createdAt: `${d(-12)}T11:00:00`,
  },
  {
    id: 'vo-003', titulo: 'Nombre para la feria de intercambio',
    descripcion: 'Votación abierta para elegir el nombre de la actividad del trimestre.',
    opciones: ['Trueque de útiles', 'Feria del saber compartido', 'Reutilizá y estudiá'],
    estado: 'abierta', fechaCierre: d(7), creadaPor: 'u-005', createdAt: `${d(-1)}T09:00:00`,
  },
]

const VOTOS = [
  { id: 'vt-001', votacionId: 'vo-001', usuarioId: 'u-001', opcion: 'Hojas A4', createdAt: `${d(-1)}T10:00:00` },
  { id: 'vt-002', votacionId: 'vo-001', usuarioId: 'u-002', opcion: 'Lápices negros', createdAt: `${d(-1)}T10:05:00` },
  { id: 'vt-003', votacionId: 'vo-001', usuarioId: 'u-003', opcion: 'Hojas A4', createdAt: `${d(-1)}T10:10:00` },
  { id: 'vt-004', votacionId: 'vo-001', usuarioId: 'u-004', opcion: 'Reglas de 30 cm', createdAt: `${d(-1)}T10:20:00` },
  { id: 'vt-005', votacionId: 'vo-001', usuarioId: 'u-011', opcion: 'Hojas A4', createdAt: `${d(-1)}T11:00:00` },
  { id: 'vt-006', votacionId: 'vo-001', usuarioId: 'u-012', opcion: 'Tijeras escolares', createdAt: `${d(-1)}T11:30:00` },
  { id: 'vt-007', votacionId: 'vo-002', usuarioId: 'u-001', opcion: 'Sí, durante el recreo largo', createdAt: `${d(-8)}T10:30:00` },
  { id: 'vt-008', votacionId: 'vo-002', usuarioId: 'u-002', opcion: 'No, mantener el horario actual', createdAt: `${d(-8)}T10:35:00` },
  { id: 'vt-009', votacionId: 'vo-002', usuarioId: 'u-003', opcion: 'Sí, durante el recreo largo', createdAt: `${d(-8)}T10:40:00` },
  { id: 'vt-010', votacionId: 'vo-002', usuarioId: 'u-004', opcion: 'Sí, durante el recreo largo', createdAt: `${d(-7)}T09:00:00` },
  { id: 'vt-011', votacionId: 'vo-003', usuarioId: 'u-009', opcion: 'Reutilizá y estudiá', createdAt: `${d(-1)}T12:00:00` },
  { id: 'vt-012', votacionId: 'vo-003', usuarioId: 'u-010', opcion: 'Trueque de útiles', createdAt: `${d(-1)}T12:10:00` },
]

const MOVIMIENTOS = [
  {
    id: 'mv-001', fecha: d(-24), concepto: 'Cuota solidaria de integrantes', tipo: 'ingreso',
    monto: 12000, registradoPor: 'u-007', activo: true, createdAt: `${d(-24)}T09:00:00`,
  },
  {
    id: 'mv-002', fecha: d(-18), concepto: 'Compra de 20 lápices negros', tipo: 'egreso',
    monto: 8500, registradoPor: 'u-007', activo: true, createdAt: `${d(-18)}T10:00:00`,
  },
  {
    id: 'mv-003', fecha: d(-12), concepto: 'Donación de familias para hojas', tipo: 'ingreso',
    monto: 5000, registradoPor: 'u-007', activo: true, createdAt: `${d(-12)}T11:00:00`,
  },
  {
    id: 'mv-004', fecha: d(-7), concepto: 'Compra de hojas A4 y folios', tipo: 'egreso',
    monto: 3200, registradoPor: 'u-007', activo: true, createdAt: `${d(-7)}T12:00:00`,
  },
  {
    id: 'mv-005', fecha: d(-4), concepto: 'Reparación de compás metálico', tipo: 'egreso',
    monto: 1800, registradoPor: 'u-007', activo: true, createdAt: `${d(-4)}T13:00:00`,
  },
  {
    id: 'mv-006', fecha: d(-2), concepto: 'Aporte para la feria de intercambio', tipo: 'ingreso',
    monto: 2500, registradoPor: 'u-007', activo: true, createdAt: `${d(-2)}T14:00:00`,
  },
  {
    id: 'mv-007', fecha: d(-30), concepto: 'Movimiento anulado de prueba', tipo: 'egreso',
    monto: 900, registradoPor: 'u-007', activo: false, createdAt: `${d(-30)}T15:00:00`,
  },
]

const ACTIVIDADES = [
  {
    id: 'act-001', titulo: 'Campaña de reutilización',
    descripcion: 'Revisar los útiles donados, separar los que están en buen estado y preparar el catálogo para el trimestre.',
    fechaLimite: d(10), creadaPor: 'u-010', activo: true, createdAt: `${d(-12)}T09:00:00`,
  },
  {
    id: 'act-002', titulo: 'Feria de intercambio',
    descripcion: 'Organizar la feria de la última semana del trimestre: difusión, mesas, carteles y registro de intercambios.',
    fechaLimite: d(18), creadaPor: 'u-010', activo: true, createdAt: `${d(-9)}T10:00:00`,
  },
  {
    id: 'act-003', titulo: 'Cierre de trimestre',
    descripcion: 'Revisar indicadores, deudas de devolución y balance de la cooperativa antes del cierre.',
    fechaLimite: d(25), creadaPor: 'u-010', activo: true, createdAt: `${d(-5)}T11:00:00`,
  },
]

const TAREAS = [
  {
    id: 'ta-001', actividadId: 'act-001', titulo: 'Clasificar útiles donados',
    descripcion: 'Separar por tipo y estado. Marcar los dañados para revisión.',
    asignadoId: 'u-002', estado: 'terminada', fechaLimite: d(-5),
    creadaPor: 'u-010', activo: true, createdAt: `${d(-11)}T09:00:00`,
  },
  {
    id: 'ta-002', actividadId: 'act-001', titulo: 'Contar unidades disponibles',
    descripcion: 'Actualizar el inventario con las unidades que están en el armario.',
    asignadoId: 'u-012', estado: 'terminada', fechaLimite: d(-4),
    creadaPor: 'u-010', activo: true, createdAt: `${d(-11)}T09:10:00`,
  },
  {
    id: 'ta-003', actividadId: 'act-001', titulo: 'Armar cartel de la campaña',
    descripcion: 'Diseñar un afiche para el patio con el lema de reutilización.',
    asignadoId: 'u-001', estado: 'en_curso', fechaLimite: d(2),
    creadaPor: 'u-010', activo: true, createdAt: `${d(-8)}T10:00:00`,
  },
  {
    id: 'ta-004', actividadId: 'act-001', titulo: 'Publicar aviso de donaciones',
    descripcion: 'Coordinar con comunicación el texto del aviso.',
    asignadoId: 'u-009', estado: 'terminada', fechaLimite: d(-2),
    creadaPor: 'u-010', activo: true, createdAt: `${d(-8)}T10:10:00`,
  },
  {
    id: 'ta-005', actividadId: 'act-002', titulo: 'Reservar mesas del patio',
    descripcion: 'Pedir autorización a preceptoría para usar cuatro mesas.',
    asignadoId: 'u-005', estado: 'terminada', fechaLimite: d(-1),
    creadaPor: 'u-010', activo: true, createdAt: `${d(-7)}T11:00:00`,
  },
  {
    id: 'ta-006', actividadId: 'act-002', titulo: 'Preparar etiquetas de intercambio',
    descripcion: 'Imprimir etiquetas para identificar cada útil y su dueño.',
    asignadoId: 'u-011', estado: 'terminada', fechaLimite: d(1),
    creadaPor: 'u-010', activo: true, createdAt: `${d(-6)}T11:10:00`,
  },
  {
    id: 'ta-007', actividadId: 'act-002', titulo: 'Difundir la feria en los cursos',
    descripcion: 'Pasar por 1.º a 6.º para contar cómo funciona la feria.',
    asignadoId: 'u-003', estado: 'pendiente', fechaLimite: d(6),
    creadaPor: 'u-010', activo: true, createdAt: `${d(-4)}T12:00:00`,
  },
  {
    id: 'ta-008', actividadId: 'act-002', titulo: 'Diseñar el mapa de mesas',
    descripcion: 'Ubicar las mesas por tipo de útil y dejar un espacio central.',
    asignadoId: 'u-004', estado: 'en_curso', fechaLimite: d(8),
    creadaPor: 'u-010', activo: true, createdAt: `${d(-4)}T12:10:00`,
  },
  {
    id: 'ta-009', actividadId: 'act-003', titulo: 'Revisar préstamos atrasados',
    descripcion: 'Listar los préstamos vencidos y avisar a administración.',
    asignadoId: 'u-008', estado: 'terminada', fechaLimite: d(-3),
    creadaPor: 'u-010', activo: true, createdAt: `${d(-5)}T13:00:00`,
  },
  {
    id: 'ta-010', actividadId: 'act-003', titulo: 'Preparar resumen de indicadores',
    descripcion: 'Exportar cobertura, devoluciones a tiempo, estado y tareas.',
    asignadoId: 'u-005', estado: 'pendiente', fechaLimite: d(12),
    creadaPor: 'u-010', activo: true, createdAt: `${d(-3)}T13:10:00`,
  },
]

const OFERTAS = [
  {
    id: 'of-001', nombre: 'Juego de reglas y escuadras', tipo: 'Medición', modalidad: 'donacion',
    descripcion: 'Dos reglas y una escuadra en buen estado que ya no uso.',
    estado: 'pendiente', oferenteId: 'u-012', createdAt: `${d(-2)}T16:00:00`,
  },
  {
    id: 'of-002', nombre: 'Cartuchera de tela', tipo: 'Guardado', modalidad: 'intercambio',
    descripcion: 'Cartuchera lavada, busco a cambio un pegamento en barra.',
    estado: 'pendiente', oferenteId: 'u-011', createdAt: `${d(-1)}T10:30:00`,
  },
  {
    id: 'of-003', nombre: 'Regla de 20 cm', tipo: 'Medición', modalidad: 'intercambio',
    descripcion: 'Regla transparente, ya aceptada y publicada en el catálogo.',
    estado: 'aceptada', oferenteId: 'u-001', createdAt: `${d(-30)}T09:00:00`,
    revisadaPor: 'u-008', revisadaEn: `${d(-29)}T10:00:00`,
  },
]

const REPORTES = [
  {
    id: 're-001', prestamoId: 'pre-042', tipo: 'danado',
    descripcion: 'La carpeta tiene una hoja rota y el folio está despegado.',
    estado: 'pendiente', reportadoPor: 'u-002', createdAt: `${d(-3)}T09:00:00`,
  },
  {
    id: 're-002', prestamoId: 'pre-045', tipo: 'danado',
    descripcion: 'El lápiz se partió al caerse la cartuchera. Ya se revisó.',
    estado: 'resuelto', reportadoPor: 'u-003', createdAt: `${d(-3)}T11:00:00`,
    resueltoPor: 'u-008', resueltoEn: `${d(-2)}T09:00:00`,
  },
]

const ENCUESTAS = []
const SURVEY_BASE = {
  '3.º B': { antes: [4, 3, 5, 2, 4, 3, 5, 2], despues: [2, 1, 3, 2, 1, 2] },
  '4.º A': { antes: [3, 5, 4, 2, 4, 3], despues: [2, 2, 1, 3, 2] },
  '5.º B': { antes: [5, 4, 3, 5, 4], despues: [3, 2, 2, 1] },
  '6.º A': { antes: [2, 4, 3, 4], despues: [2, 1, 2] },
}
Object.entries(SURVEY_BASE).forEach(([curso, valores], ci) => {
  valores.antes.forEach((veces, i) => {
    ENCUESTAS.push({
      id: `en-a-${ci}-${i}`, curso, momento: 'antes', vecesSinUtil: veces,
      usuarioId: null, fecha: d(-45 + i), createdAt: `${d(-45 + i)}T10:00:00`,
    })
  })
  valores.despues.forEach((veces, i) => {
    ENCUESTAS.push({
      id: `en-d-${ci}-${i}`, curso, momento: 'despues', vecesSinUtil: veces,
      usuarioId: null, fecha: d(-3 + i), createdAt: `${d(-3 + i)}T10:00:00`,
    })
  })
})
// Ana ya respondió la encuesta inicial; podrá responder la de seguimiento.
ENCUESTAS.push({
  id: 'en-a-ana', curso: '3.º B', momento: 'antes', vecesSinUtil: 3,
  usuarioId: 'u-001', fecha: d(-40), createdAt: `${d(-40)}T10:00:00`,
})

export function buildDemoSeed() {
  return {
    version: SEED_VERSION,
    generatedAt: new Date().toISOString(),
    users: USERS.map((u) => ({ ...u })),
    utiles: UTILES.map((u) => ({ ...u })),
    solicitudes: [...historical.solicitudes, ...SPECIAL_SOLICITUDES].map((s) => ({ ...s })),
    prestamos: [...historical.prestamos, ...SPECIAL_PRESTAMOS].map((p) => ({ ...p })),
    avisos: AVISOS.map((a) => ({ ...a })),
    acuerdos: ACUERDOS.map((a) => ({ ...a })),
    votaciones: VOTACIONES.map((v) => ({ ...v })),
    votos: VOTOS.map((v) => ({ ...v })),
    movimientos: MOVIMIENTOS.map((m) => ({ ...m })),
    actividades: ACTIVIDADES.map((a) => ({ ...a })),
    tareas: TAREAS.map((t) => ({ ...t })),
    ofertas: OFERTAS.map((o) => ({ ...o })),
    reportes: REPORTES.map((r) => ({ ...r })),
    encuestas: ENCUESTAS.map((e) => ({ ...e })),
    counters: { solicitud: 56, prestamo: 51, util: 21, oferta: 4 },
  }
}

let state = null

export function loadDemoState() {
  if (state) return state
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.version === SEED_VERSION) {
        state = parsed
        return state
      }
    }
  } catch {
    // Si el almacenamiento está corrupto, se regenera el conjunto de prueba.
  }
  state = buildDemoSeed()
  saveDemoState()
  return state
}

export function saveDemoState() {
  if (!state) return
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn('No se pudo guardar la demostración local.', error)
  }
}

export function resetDemoState() {
  state = buildDemoSeed()
  saveDemoState()
  return state
}

export function getDemoState() {
  return loadDemoState()
}

export function nextId(prefix) {
  const s = loadDemoState()
  if (prefix === 'S') {
    s.counters.solicitud += 1
    return `S-${String(s.counters.solicitud).padStart(4, '0')}`
  }
  if (prefix === 'P') {
    s.counters.prestamo += 1
    return `P-${String(s.counters.prestamo).padStart(4, '0')}`
  }
  if (prefix === 'U') {
    s.counters.util += 1
    return `U-${String(s.counters.util).padStart(3, '0')}`
  }
  if (prefix === 'O') {
    s.counters.oferta += 1
    return `O-${String(s.counters.oferta).padStart(3, '0')}`
  }
  return `${prefix}-${Date.now()}`
}

export function demoNow() {
  return new Date().toISOString()
}

export { iso }
