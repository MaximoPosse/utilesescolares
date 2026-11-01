<script setup>
defineProps({
  label: { type: String, default: 'Cargando…' },
  compact: { type: Boolean, default: false },
})
</script>

<template>
  <div class="loading-block" :class="{ 'loading-block--compact': compact }" role="status" aria-live="polite">
    <span class="spinner" aria-hidden="true"></span>
    <span>{{ label }}</span>
  </div>
</template>
