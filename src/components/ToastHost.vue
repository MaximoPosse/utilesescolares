<script setup>
import { toastState, dismiss } from '../stores/toast.js'

const icon = {
  success: '✓',
  error: '!',
  warning: '!',
  info: 'i',
}
</script>

<template>
  <div class="toast-host" aria-live="polite" aria-atomic="false">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toastState.items"
        :key="toast.id"
        class="toast"
        :class="`toast--${toast.type}`"
        role="status"
      >
        <span class="toast__icon" aria-hidden="true">{{ icon[toast.type] || 'i' }}</span>
        <p class="toast__text">{{ toast.message }}</p>
        <button class="toast__close" type="button" aria-label="Cerrar aviso" @click="dismiss(toast.id)">
          ×
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
