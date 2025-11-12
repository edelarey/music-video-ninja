<template>
  <div class="app">
    <header class="header">
      <h1><router-link to="/" class="header-link">🪃 Loop Jitsu</router-link></h1>
      <p class="tagline">Client-side video editor with MP3 soundtrack</p>
      <nav>
        <router-link to="/about" class="nav-link">About</router-link>
      </nav>
    </header>

    <router-view />

    <footer class="footer">
      <p>
        100% Client-side • Powered by FFmpeg.wasm & Wavesurfer.js
      </p>
    </footer>
  </div>
</template>

<script setup lang="ts">
// App.vue is now a layout shell, so no specific imports are needed here.
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.header {
  text-align: center;
  padding: 2rem 1rem;
  color: white;
}

.header h1 {
  margin: 0;
  font-size: 2.5rem;
  font-weight: 700;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.header-link {
  color: white;
  text-decoration: none;
}

.tagline {
  margin: 0.5rem 0 0 0;
  font-size: 1.1rem;
  opacity: 0.9;
}

nav {
  margin-top: 1rem;
}

.nav-link {
  color: white;
  text-decoration: none;
  font-weight: 600;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  transition: background 0.3s ease;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.2);
}

.footer {
  text-align: center;
  padding: 2rem 1rem;
  color: white;
  opacity: 0.8;
}

.footer p {
  margin: 0;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .header h1 {
    font-size: 2rem;
  }
}
</style>
