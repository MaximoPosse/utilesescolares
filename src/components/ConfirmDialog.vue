<script setup>
import ModalDialog from './ModalDialog.vue'

defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '¿Confirmás la acción?' },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: 'Confirmar' },
  cancelLabel: { type: String, default: 'Volver' },
  danger: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
})
defineEmits(['confirm', 'close'])
</script>

<template>
  <ModalDialog :open="open" :title="title" size="sm" @close="$emit('close')">
    <p class="confirm-message">{{ message }}</p>
    <template #footer>
      <button class="btn btn-secondary" type="button" :disabled="loading" @click="$emit('close')">
        {{ cancelLabel }}
      </button>
      <button
        class="btn"
        :class="danger ? 'btn-danger' : 'btn-primary'"
        type="button"
        :disabled="loading"
        @click="$emit('confirm')"
      >
        <span v-if="loading" class="spinner spinner--sm" aria-hidden="true"></span>
        {{ loading ? 'Procesando…' : confirmLabel }}
      </button>
    </template>
  </ModalDialog>
</template>
