<template>
  <main class="main">
    <section class="upload-section">
      <div class="upload-card">
        <h2>1. Upload Audio</h2>
        <MP3Uploader />
      </div>

      <div class="upload-card">
        <h2>2. Upload Video Clips</h2>
        <MP4Uploader />
      </div>
    </section>

    <section v-if="store.hasMP3" class="timeline-section">
      <h2>3. Timeline Editor</h2>
      <WaveformTimeline />
      <div class="timeline-instructions">
        <p><strong>Instructions:</strong></p>
        <ul>
          <li><strong>Play/Pause/Rewind/Fast-Forward:</strong> Use the audio controls to preview your music.</li>
          <li><strong>Click to seek:</strong> Click anywhere on the waveform to jump to that position.</li>
          <li><strong>Drag regions:</strong> Reposition video clips along the timeline.</li>
          <li><strong>Resize regions:</strong> Adjust clip duration by dragging edges.</li>
          <li><strong>Select & Delete:</strong> Click a clip to select it, then press the 'Delete' key to remove it.</li>
          <li>Video clips will automatically loop to fill their assigned timeline section.</li>
          <li>Final video length will match the MP3 duration exactly.</li>
        </ul>
      </div>
    </section>

    <section class="render-section">
      <h2>4. Render Final Video</h2>
      <RenderButton />
    </section>
  </main>
</template>

<script setup lang="ts">
import { useEditorStore } from '../stores/editor'
import MP3Uploader from '../components/MP3Uploader.vue'
import MP4Uploader from '../components/MP4Uploader.vue'
import WaveformTimeline from '../components/WaveformTimeline.vue'
import RenderButton from '../components/RenderButton.vue'

const store = useEditorStore()
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
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.upload-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.upload-card h2 {
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

.render-section h2 {
  margin: 0 0 1rem 0;
  color: white;
  font-size: 1.3rem;
  text-align: center;
}

@media (max-width: 768px) {
  .upload-section {
    grid-template-columns: 1fr;
  }
}

@media (prefers-color-scheme: dark) {
  .upload-card h2,
  .timeline-section h2,
  .timeline-instructions p {
    color: #213547;
  }

  .timeline-instructions ul {
    color: #666;
  }
}
</style>