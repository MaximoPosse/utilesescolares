<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  hint: { type: String, default: '' },
  icon: { type: String, default: '' },
  tone: { type: String, default: 'neutral' },
  compact: { type: Boolean, default: false },
})
</script>

<template>
  <article class="stat-card" :class="[`stat-card--${tone}`, { 'stat-card--compact': compact }]">
    <div class="stat-card__top">
      <p class="stat-card__label">{{ label }}</p>
      <span v-if="icon" class="stat-card__icon" aria-hidden="true">{{ icon }}</span>
    </div>
    <p class="stat-card__value">{{ value }}</p>
    <p v-if="hint" class="stat-card__hint">{{ hint }}</p>
  </article>
</template>
