<template>
  <main class="main">
    <section class="upload-section">
      <div class="upload-card">
        <h2>1. Upload Video Clips</h2>
        <VideoUploader />
      </div>
    </section>

    <section class="timeline-section">
      <h2>2. Arrange Timeline</h2>
      <CombinerTimeline />
      <div class="timeline-instructions">
        <p><strong>Instructions:</strong></p>
        <ul>
          <li><strong>Add clips:</strong> Drag from the upload list above, or click the + button on each clip.</li>
          <li><strong>Reorder:</strong> Drag clips within the timeline to rearrange their order.</li>
          <li><strong>Remove:</strong> Click the × button on a clip, or select and press Delete.</li>
          <li><strong>Repeat:</strong> Add the same video multiple times to repeat it in the sequence.</li>
          <li>Videos will be re-encoded to match the selected resolution.</li>
        </ul>
      </div>
    </section>

    <section class="settings-section">
      <div class="settings-card">
        <h2>3. Output Settings</h2>
        <ResolutionSelector
          :model-value="store.selectedResolution"
          @update:model-value="store.setResolution"
        />
      </div>
    </section>

    <section class="render-section">
      <h2>4. Combine & Download</h2>
      <CombineButton />
    </section>
  </main>
</template>

<script setup lang="ts">
import VideoUploader from '../components/combiner/VideoUploader.vue'
import CombinerTimeline from '../components/combiner/CombinerTimeline.vue'
import ResolutionSelector from '../components/combiner/ResolutionSelector.vue'
import CombineButton from '../components/combiner/CombineButton.vue'
import { useCombinerStore } from '../stores/combiner'

const store = useCombinerStore()
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

.upload-section {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
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

.timeline-section {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.timeline-section h2 {
  margin: 0 0 1rem 0;
  color: #213547;
  font-size: 1.3rem;
}

.timeline-instructions {
  margin-top: 1.5rem;
  padding: 1rem;
  background: rgba(100, 108, 255, 0.05);
  border-left: 4px solid #646cff;
  border-radius: 4px;
}

.timeline-instructions p {
  margin: 0 0 0.5rem 0;
  color: #213547;
  font-weight: 600;
}

.timeline-instructions ul {
  margin: 0.5rem 0 0 0;
  padding-left: 1.5rem;
  color: #666;
}

.timeline-instructions li {
  margin: 0.25rem 0;
  line-height: 1.6;
}

.settings-section {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

.render-section h2 {
  margin: 0 0 1rem 0;
  color: white;
  font-size: 1.3rem;
  text-align: center;
}

@media (max-width: 768px) {
  .upload-section,
  .settings-section {
    grid-template-columns: 1fr;
  }
}

@media (prefers-color-scheme: dark) {
  .upload-card,
  .settings-card,
  .timeline-section {
    background: #1a1a1a;
  }

  .upload-card h2,
  .settings-card h2,
  .timeline-section h2,
  .timeline-instructions p {
    color: #fff;
  }

  .timeline-instructions ul {
    color: #aaa;
  }
}
</style>
