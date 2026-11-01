<script setup>
defineProps({
  icon: { type: String, default: '🌱' },
  title: { type: String, required: true },
  text: { type: String, default: '' },
})
</script>

<template>
  <div class="empty-state">
    <span class="empty-state__icon" aria-hidden="true">{{ icon }}</span>
    <h3>{{ title }}</h3>
    <p v-if="text">{{ text }}</p>
    <div v-if="$slots.default" class="empty-state__actions">
      <slot />
    </div>
  </div>
</template>
