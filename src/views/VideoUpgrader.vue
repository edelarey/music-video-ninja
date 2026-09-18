<template>
  <main class="main">
    <section class="upload-section">
      <div class="upload-card">
        <h2>1. Select Video</h2>
        <p class="settings-copy">
          Upgrade one finished music video (for example 720p → 1080p). Unlike
          <router-link to="/scaler">Batch Scaler</router-link>, this page is for a single long
          file and copies the original soundtrack instead of replacing or muting it.
        </p>
        <UpgradeUploader />
      </div>
    </section>

    <section class="settings-section">
      <div class="settings-card">
        <h2>2. Target Resolution</h2>
        <p class="settings-copy">
          Video is re-encoded to this 16:9 size with Lanczos scaling. Non-16:9 sources are
          letterboxed. Audio is stream-copied from the source whenever the codec allows
          (otherwise AAC 320k).
        </p>
        <ResolutionSelector
          :model-value="store.selectedResolution"
          :disabled="store.isProcessing"
          @update:model-value="store.setResolution"
        />
      </div>
    </section>

    <section class="render-section">
      <h2>3. Upgrade &amp; Download</h2>
      <UpgradeButton />
    </section>
  </main>
</template>

<script setup lang="ts">
import UpgradeUploader from '../components/upgrader/UpgradeUploader.vue'
import UpgradeButton from '../components/upgrader/UpgradeButton.vue'
import ResolutionSelector from '../components/combiner/ResolutionSelector.vue'
import { useUpgraderStore } from '../stores/upgrader'

const store = useUpgraderStore()
</script>

<style scoped>
.main {
  flex: 1;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.upload-card,
.settings-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.upload-card h2,
.settings-card h2 {
  margin: 0 0 1rem 0;
  color: #213547;
  font-size: 1.3rem;
}

.settings-copy {
  margin: 0 0 1.25rem 0;
  color: #666;
  line-height: 1.6;
}

.settings-copy a {
  color: #646cff;
  font-weight: 600;
  text-decoration: none;
}

.settings-copy a:hover {
  text-decoration: underline;
}

.render-section h2 {
  margin: 0 0 1rem 0;
  color: white;
  font-size: 1.3rem;
  text-align: center;
}

@media (prefers-color-scheme: dark) {
  .upload-card,
  .settings-card {
    background: #1a1a1a;
  }

  .upload-card h2,
  .settings-card h2 {
    color: #fff;
  }

  .settings-copy {
    color: #aaa;
  }
}
</style>
