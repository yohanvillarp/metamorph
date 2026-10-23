<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <div style="min-height: 100vh; font-family: system-ui, sans-serif">
    <nav style="padding: 1rem; border-bottom: 1px solid #e5e7eb; display: flex; gap: 1rem">
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/about">About</RouterLink>
    </nav>
    <main style="padding: 2rem">
      <RouterView />
    </main>
  </div>
</template>
