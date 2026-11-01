<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  size: { type: String, default: 'md' },
  closeLabel: { type: String, default: 'Cerrar' },
})
const emit = defineEmits(['close'])
const closeRef = ref(null)
let previousOverflow = ''

function close() {
  emit('close')
}

function onKeydown(event) {
  if (event.key === 'Escape' && props.open) close()
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      document.addEventListener('keydown', onKeydown)
      await nextTick()
      closeRef.value?.focus()
    } else {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeydown)
    }
  },
)

onBeforeUnmount(() => {
  document.body.style.overflow = previousOverflow
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="modal-overlay" @click.self="close">
        <div
          class="modal"
          :class="`modal--${size}`"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
        >
          <header class="modal__header">
            <div>
              <h2 class="modal__title">{{ title }}</h2>
              <p v-if="subtitle" class="modal__subtitle">{{ subtitle }}</p>
            </div>
            <button ref="closeRef" class="icon-button" type="button" :aria-label="closeLabel" @click="close">
              ×
            </button>
          </header>
          <div class="modal__body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="modal__footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
