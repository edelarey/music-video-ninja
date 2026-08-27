<template>
  <main class="main">
    <section class="upload-section">
      <div class="upload-card">
        <h2>1. Select WAV Files</h2>
        <WavUploader />
      </div>
    </section>

    <section class="settings-section">
      <div class="settings-card">
        <h2>2. Encode Settings</h2>
        <p class="settings-copy">
          Each file is converted independently to a high-quality MP3 using the same settings as:
        </p>
        <pre class="command">ffmpeg -i input.wav -c:a libmp3lame -b:a 320k -ar 44100 -ac 2 output.mp3</pre>
        <ul class="settings-list">
          <li><strong>Codec:</strong> libmp3lame</li>
          <li><strong>Bitrate:</strong> 320 kbps CBR</li>
          <li><strong>Sample rate:</strong> 44.1 kHz</li>
          <li><strong>Channels:</strong> stereo</li>
        </ul>
      </div>
    </section>

    <section class="render-section">
      <h2>3. Convert &amp; Download</h2>
      <ConvertButton />
    </section>
  </main>
</template>

<script setup lang="ts">
import WavUploader from '../components/converter/WavUploader.vue'
import ConvertButton from '../components/converter/ConvertButton.vue'
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
  margin: 0 0 0.75rem 0;
  color: #666;
  line-height: 1.6;
}

.command {
  margin: 0 0 1rem 0;
  padding: 0.75rem 1rem;
  background: rgba(100, 108, 255, 0.08);
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.85rem;
  color: #213547;
  line-height: 1.5;
}

.settings-list {
  margin: 0;
  padding-left: 1.25rem;
  color: #666;
  line-height: 1.7;
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
  .settings-card h2,
  .command {
    color: #fff;
  }

  .settings-copy,
  .settings-list {
    color: #aaa;
  }

  .command {
    background: rgba(100, 108, 255, 0.15);
  }
}
</style>
