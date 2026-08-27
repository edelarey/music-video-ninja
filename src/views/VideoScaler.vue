<template>
  <main class="main">
    <section class="upload-section">
      <div class="upload-card">
        <h2>1. Select Videos</h2>
        <ScalerUploader />
      </div>
    </section>

    <section class="settings-section">
      <div class="settings-card">
        <h2>2. Target Resolution</h2>
        <p class="settings-copy">
          Each video is re-encoded independently to this 16:9 size. Smaller sources are upscaled
          (480p/720p → 1080p); larger sources are downscaled. Non-16:9 videos are letterboxed.
        </p>
        <ResolutionSelector
          :model-value="store.selectedResolution"
          :disabled="store.isProcessing"
          @update:model-value="store.setResolution"
        />
      </div>
    </section>

    <section class="render-section">
      <h2>3. Scale &amp; Download</h2>
      <ScaleButton />
    </section>
  </main>
</template>

<script setup lang="ts">
import ScalerUploader from '../components/scaler/ScalerUploader.vue'
import ScaleButton from '../components/scaler/ScaleButton.vue'
import ResolutionSelector from '../components/combiner/ResolutionSelector.vue'
import { useScalerStore } from '../stores/scaler'

const store = useScalerStore()
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
