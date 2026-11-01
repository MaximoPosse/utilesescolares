<script setup>
import { computed } from 'vue'

const props = defineProps({
  steps: { type: Array, required: true },
  current: { type: Number, default: 0 },
})

const safeCurrent = computed(() => Math.min(Math.max(props.current, 0), props.steps.length - 1))
</script>

<template>
  <ol class="progress-steps" aria-label="Progreso del trámite">
    <li
      v-for="(step, index) in steps"
      :key="step"
      class="progress-step"
      :class="{
        'progress-step--done': index < safeCurrent,
        'progress-step--current': index === safeCurrent,
      }"
    >
      <span class="progress-step__dot" aria-hidden="true">{{ index < safeCurrent ? '✓' : index + 1 }}</span>
      <span class="progress-step__label">{{ step }}</span>
    </li>
  </ol>
</template>
