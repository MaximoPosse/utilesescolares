<script setup>
import { computed } from 'vue'

const props = defineProps({
  kind: { type: String, default: 'util' },
  estado: { type: String, default: '' },
  label: { type: String, default: '' },
  tone: { type: String, default: '' },
})

const MAPS = {
  util: {
    Disponible: { label: 'Disponible', tone: 'success' },
    Prestado: { label: 'Prestado', tone: 'info' },
    Atrasado: { label: 'Atrasado', tone: 'danger' },
    Dañado: { label: 'Dañado', tone: 'warning' },
    'En reparación': { label: 'En reparación', tone: 'neutral' },
  },
  solicitud: {
    pendiente: { label: 'Pendiente de aprobación', tone: 'warning' },
    aprobada: { label: 'Aprobada', tone: 'info' },
    atendida: { label: 'Entregada', tone: 'success' },
    rechazada: { label: 'Rechazada', tone: 'danger' },
    cancelada: { label: 'Cancelada', tone: 'neutral' },
  },
  prestamo: {
    prestado: { label: 'Prestado', tone: 'info' },
    atrasado: { label: 'Atrasado', tone: 'danger' },
    devuelto: { label: 'Devuelto', tone: 'success' },
    perdido: { label: 'Perdido', tone: 'danger' },
    a_controlar: { label: 'A controlar', tone: 'warning' },
  },
  tarea: {
    pendiente: { label: 'Pendiente', tone: 'warning' },
    en_curso: { label: 'En curso', tone: 'info' },
    terminada: { label: 'Terminada', tone: 'success' },
  },
  oferta: {
    pendiente: { label: 'Pendiente', tone: 'warning' },
    aceptada: { label: 'Aceptada', tone: 'success' },
    rechazada: { label: 'Rechazada', tone: 'danger' },
    cancelada: { label: 'Cancelada', tone: 'neutral' },
  },
  votacion: {
    abierta: { label: 'Abierta', tone: 'success' },
    cerrada: { label: 'Cerrada', tone: 'neutral' },
  },
  reporte: {
    pendiente: { label: 'Pendiente', tone: 'warning' },
    resuelto: { label: 'Resuelto', tone: 'success' },
  },
  movimiento: {
    ingreso: { label: 'Ingreso', tone: 'success' },
    egreso: { label: 'Egreso', tone: 'danger' },
  },
}

const info = computed(() => {
  if (props.label && props.tone) return { label: props.label, tone: props.tone }
  const found = MAPS[props.kind]?.[props.estado]
  return found || { label: props.label || props.estado || 'Sin estado', tone: props.tone || 'neutral' }
})
</script>

<template>
  <span class="badge" :class="`badge--${info.tone}`">
    <span class="badge__dot" aria-hidden="true"></span>
    {{ info.label }}
  </span>
</template>
