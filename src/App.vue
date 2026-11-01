<script setup>
import { RouterView } from 'vue-router'
import AppShell from './components/AppShell.vue'
import ToastHost from './components/ToastHost.vue'
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <AppShell v-if="!route.meta.public">
      <component :is="Component" />
    </AppShell>
    <component :is="Component" v-else />
  </RouterView>
  <ToastHost />
</template>
