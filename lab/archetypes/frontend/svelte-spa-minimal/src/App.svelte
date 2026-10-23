<script lang="ts">
  let currentPage = $state('home');
</script>

<div style="min-height: 100vh; font-family: system-ui, sans-serif">
  <nav style="padding: 1rem; border-bottom: 1px solid #e5e7eb; display: flex; gap: 1rem">
    <button onclick={() => currentPage = 'home'}>Home</button>
    <button onclick={() => currentPage = 'about'}>About</button>
  </nav>
  <main style="padding: 2rem">
    {#if currentPage === 'home'}
      <h1>Home</h1>
      <p>Svelte SPA Minimal Archetype — home page.</p>
    {:else}
      <h1>About</h1>
      <p>A minimal Svelte archetype for testing Metamorph migrations.</p>
    {/if}
  </main>
</div>
