const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export function todayISO() {
  return toISO(new Date())
}

export function toISO(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDate(value) {
  if (!value) return null
  if (DATE_ONLY.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(value)
}

export function addDays(value, days) {
  const d = value instanceof Date ? new Date(value) : parseDate(value)
  if (!d || Number.isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + days)
  return toISO(d)
}

export function addMonths(value, months) {
  const d = value instanceof Date ? new Date(value) : parseDate(value)
  if (!d || Number.isNaN(d.getTime())) return ''
  d.setMonth(d.getMonth() + months)
  return toISO(d)
}

/** Diferencia en días corridos entre dos fechas ISO (b - a). */
export function diffDays(a, b) {
  const from = parseDate(a)
  const to = parseDate(b)
  if (!from || !to) return null
  const ms = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) -
    Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  return Math.round(ms / 86400000)
}

export function formatDate(value, options = {}) {
  const d = parseDate(value)
  if (!d || Number.isNaN(d.getTime())) return '—'
  const { short = false, withYear = false } = options
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: short ? '2-digit' : 'long',
    ...(withYear ? { year: 'numeric' } : {}),
  }).format(d)
}

export function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function relativeDate(value) {
  const days = diffDays(todayISO(), value)
  if (days === null) return '—'
  if (days === 0) return 'hoy'
  if (days === 1) return 'mañana'
  if (days === -1) return 'ayer'
  if (days > 1) return `en ${days} días`
  return `hace ${Math.abs(days)} días`
}

export function monthKey(value) {
  const d = parseDate(value)
  if (!d || Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(key, { long = true } = {}) {
  if (!key) return '—'
  const [year, month] = key.split('-').map(Number)
  const d = new Date(year, month - 1, 1)
  return new Intl.DateTimeFormat('es-AR', {
    month: long ? 'long' : 'short',
    year: 'numeric',
  }).format(d)
}

export function lastMonths(count = 6) {
  const result = []
  const base = new Date()
  base.setDate(1)
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return result
}

export function money(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
}

export function pct(part, total) {
  if (!total) return null
  return Math.round((part / total) * 100)
}

export function initials(nombre = '', apellido = '') {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase() || '??'
}

export function fullName(person) {
  if (!person) return '—'
  return `${person.nombre ?? ''} ${person.apellido ?? ''}`.trim() || '—'
}

export function estadoPrestamoEfectivo(prestamo) {
  if (!prestamo) return '—'
  if (prestamo.estado === 'prestado' && prestamo.fechaAcordada && prestamo.fechaAcordada < todayISO()) {
    return 'atrasado'
  }
  return prestamo.estado
}

export function diasAtraso(prestamo) {
  if (!prestamo) return 0
  if (prestamo.estado === 'devuelto') {
    const diff = diffDays(prestamo.fechaAcordada, prestamo.fechaDevolucionReal || prestamo.fechaAcordada)
    return Math.max(0, diff ?? 0)
  }
  if (prestamo.estado === 'prestado' && prestamo.fechaAcordada < todayISO()) {
    return Math.max(0, diffDays(prestamo.fechaAcordada, todayISO()) ?? 0)
  }
  return 0
}

export function truncate(text, max = 90) {
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export function wait(ms = 250) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
