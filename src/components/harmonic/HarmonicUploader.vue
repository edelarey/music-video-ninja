<template>
  <div class="wav-uploader">
    <div
      class="upload-area"
      :class="{ disabled: store.isRendering }"
      @click="!store.isRendering && triggerFileInput()"
      @dragover.prevent
      @drop.prevent="onDrop"
    >
      <input
        ref="fileInput"
        data-testid="wav-input"
        type="file"
        accept=".wav,audio/wav,audio/x-wav,audio/wave"
        @change="onSelect"
        style="display: none"
      />
      <div class="upload-prompt">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18V5l12-2v13"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="16" r="3"></circle>
        </svg>
        <p>Click or drag one WAV here</p>
        <span class="hint">Uncompressed .wav — stereo or mono, at its own sample rate</span>
      </div>
    </div>

    <div v-if="store.file" class="file-row">
      <div class="file-main">
        <div class="filename">{{ store.file.name }}</div>
        <div class="details">
          <span>{{ formatDuration(store.duration) }}</span>
          <span class="dot">·</span>
          <span>{{ formatBytes(store.file.size) }}</span>
          <template v-if="store.sampleRate">
            <span class="dot">·</span>
            <span data-testid="sample-rate">{{ store.sampleRate }} Hz</span>
          </template>
          <template v-if="store.sourceChannels">
            <span class="dot">·</span>
            <span data-testid="file-channels">{{ store.sourceChannels === 1 ? 'mono' : `${store.sourceChannels} ch` }}</span>
          </template>
        </div>
      </div>
      <button class="remove-btn" type="button" :disabled="store.isRendering" @click="store.clearFile()">×</button>
    </div>

    <div v-if="store.isAnalyzing" class="analyze">
      <div class="job-progress">
        <div class="job-progress-fill" :style="{ width: `${store.analyzeProgress}%` }"></div>
      </div>
      <p>{{ store.analyzeStatus || 'Listening for the key…' }}</p>
    </div>

    <p v-if="store.analyzeError" class="error-note" data-testid="harmonic-error">{{ store.analyzeError }}</p>

    <div v-if="store.originalUrl && !store.isAnalyzing" class="audio-preview">
      <h3>Original</h3>
      <audio :src="store.originalUrl" controls preload="metadata" class="preview-player"></audio>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useHarmonicStore } from '@/stores/harmonic'

const store = useHarmonicStore()
const fileInput = ref<HTMLInputElement | null>(null)

const isWavFile = (file: File): boolean => {
  const name = file.name.toLowerCase()
  if (name.endsWith('.wav') || name.endsWith('.wave')) return true
  return ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'].includes(file.type)
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const takeFile = (file: File | undefined) => {
  if (!file) return
  if (!isWavFile(file)) {
    store.analyzeError = `Not a WAV file: ${file.name}`
    return
  }
  void store.loadFile(file)
}

const onSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  takeFile(target.files?.[0])
  target.value = ''
}

const onDrop = (event: DragEvent) => {
  if (store.isRendering) return
  const file = Array.from(event.dataTransfer?.files || []).find(isWavFile)
  takeFile(file)
}

const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<style scoped>
.wav-uploader { width: 100%; }

.upload-area {
  border: 2px dashed #646cff;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: rgba(100, 108, 255, 0.05);
}

.upload-area:hover { border-color: #535bf2; background: rgba(100, 108, 255, 0.1); }
.upload-area.disabled { opacity: 0.6; cursor: not-allowed; }

.upload-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: #646cff;
}

.upload-prompt p { margin: 0; font-size: 1.1rem; font-weight: 500; }
.hint { font-size: 0.9rem; color: #888; }

.file-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
  padding: 0.75rem;
  background: rgba(100, 108, 255, 0.05);
  border: 1px solid rgba(100, 108, 255, 0.2);
  border-radius: 8px;
}

.file-main { flex: 1; min-width: 0; text-align: left; }
.filename {
  font-weight: 600;
  color: #213547;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.details { font-size: 0.85rem; color: #666; }
.dot { margin: 0 0.25rem; }

.remove-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: #ff4444;
  color: white;
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
}
.remove-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.analyze { margin-top: 1rem; }
.analyze p { margin: 0.4rem 0 0; color: #666; font-size: 0.9rem; }

.job-progress {
  width: 100%;
  height: 8px;
  background: #e8e8e8;
  border-radius: 4px;
  overflow: hidden;
}
.job-progress-fill { height: 100%; background: #646cff; }

.audio-preview {
  margin-top: 1rem;
  background: rgba(0, 0, 0, 0.05);
  padding: 1rem;
  border-radius: 8px;
}
.audio-preview h3 { margin: 0 0 0.5rem; font-size: 1rem; color: #213547; }
.preview-player { width: 100%; }

.error-note { margin: 0.75rem 0 0; color: #cc0000; font-size: 0.9rem; }

@media (prefers-color-scheme: dark) {
  .hint, .details, .analyze p { color: #aaa; }
  .filename, .audio-preview h3 { color: #fff; }
  .file-row { background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.15); }
  .audio-preview { background: rgba(255, 255, 255, 0.05); }
  .job-progress { background: #333; }
}
</style>
