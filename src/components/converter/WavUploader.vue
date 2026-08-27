<template>
  <div class="wav-uploader">
    <div
      class="upload-area"
      :class="{ disabled: store.isProcessing }"
      @click="!store.isProcessing && triggerFileInput()"
      @dragover.prevent
      @drop.prevent="!store.isProcessing && handleDrop($event)"
    >
      <input
        ref="fileInput"
        type="file"
        accept=".wav,audio/wav,audio/x-wav,audio/wave"
        multiple
        @change="handleFileSelect"
        style="display: none"
      />
      <div class="upload-prompt">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18V5l12-2v13"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="16" r="3"></circle>
        </svg>
        <p>Click or drag WAV files here</p>
        <span class="hint">Uncompressed .wav — add as many as you want</span>
      </div>
    </div>

    <div v-if="store.tracks.length > 0" class="clips-list">
      <div class="list-header">
        <h3>WAV files ({{ store.tracks.length }})</h3>
        <button
          class="clear-btn"
          :disabled="store.isProcessing"
          @click="clearAll"
        >
          Clear all
        </button>
      </div>

      <div class="clips-scroll-container">
        <div
          class="clip-item"
          v-for="track in store.tracks"
          :key="track.id"
          :class="{
            selected: selectedId === track.id,
            current: store.currentTrackId === track.id,
            [track.status]: true
          }"
          @click="selectForPreview(track)"
        >
          <div class="color-swatch" :style="{ backgroundColor: track.color }"></div>
          <div class="clip-info">
            <div class="filename">{{ track.name }}</div>
            <div class="details">
              <span>{{ formatDuration(track.duration) }}</span>
              <span class="dot">·</span>
              <span>{{ formatBytes(track.file.size) }}</span>
              <span class="dot">·</span>
              <span>WAV → MP3 320k</span>
            </div>
          </div>
          <div class="clip-actions">
            <button
              v-if="track.outputBlob && track.status === 'complete'"
              @click.stop="downloadTrack(track)"
              class="download-btn"
              title="Download MP3"
            >
              ↓
            </button>
            <button
              @click.stop="removeTrack(track.id)"
              class="remove-btn"
              title="Remove"
              :disabled="store.isProcessing"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="previewUrl" class="audio-preview">
      <div class="preview-header">
        <h3>Preview</h3>
        <button @click="clearPreview" class="close-preview-btn">×</button>
      </div>
      <audio :src="previewUrl" controls autoplay class="preview-player"></audio>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useConverterStore, type ConverterTrack } from '../../stores/converter'

const store = useConverterStore()
const fileInput = ref<HTMLInputElement | null>(null)
const selectedId = ref<string | null>(null)
const previewUrl = ref<string | null>(null)

const isWavFile = (file: File): boolean => {
  const name = file.name.toLowerCase()
  if (name.endsWith('.wav') || name.endsWith('.wave')) return true
  return ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'].includes(file.type)
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  Array.from(target.files || []).forEach((file) => loadWavFile(file))
  if (target) target.value = ''
}

const handleDrop = (event: DragEvent) => {
  Array.from(event.dataTransfer?.files || [])
    .filter(isWavFile)
    .forEach((file) => loadWavFile(file))
}

const loadWavFile = (file: File) => {
  if (!isWavFile(file)) {
    alert(`Not a WAV file: ${file.name}`)
    return
  }

  const audio = new Audio()
  const url = URL.createObjectURL(file)

  audio.addEventListener('loadedmetadata', () => {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0
    store.addTrack(file, duration)
    URL.revokeObjectURL(url)
  })

  audio.addEventListener('error', () => {
    alert(`Error loading WAV file: ${file.name}`)
    URL.revokeObjectURL(url)
  })

  audio.src = url
}

const removeTrack = (id: string) => {
  if (selectedId.value === id) {
    clearPreview()
  }
  store.removeTrack(id)
}

const clearAll = () => {
  if (!confirm('Remove all WAV files from the batch?')) return
  clearPreview()
  store.clearAll()
}

const selectForPreview = (track: ConverterTrack) => {
  if (selectedId.value === track.id) {
    clearPreview()
    return
  }

  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }

  selectedId.value = track.id
  previewUrl.value = URL.createObjectURL(track.file)
}

const clearPreview = () => {
  selectedId.value = null
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
  }
}

const outputFilename = (name: string): string => {
  return name.replace(/\.(wav|wave)$/i, '') + '.mp3'
}

const downloadTrack = (track: ConverterTrack) => {
  if (!track.outputBlob) return
  const url = URL.createObjectURL(track.outputBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = outputFilename(track.name)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

onUnmounted(() => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
})

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
.wav-uploader {
  width: 100%;
}

.upload-area {
  border: 2px dashed #646cff;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: rgba(100, 108, 255, 0.05);
}

.upload-area:hover {
  border-color: #535bf2;
  background: rgba(100, 108, 255, 0.1);
}

.upload-area.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.upload-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: #646cff;
}

.upload-prompt p {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 500;
}

.hint {
  font-size: 0.9rem;
  color: #888;
}

.clips-list {
  margin-top: 1.5rem;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.clips-list h3 {
  margin: 0;
  color: #213547;
  font-size: 1rem;
}

.clear-btn {
  background: none;
  border: 1px solid rgba(255, 68, 68, 0.4);
  color: #ff4444;
  border-radius: 6px;
  padding: 0.25rem 0.75rem;
  cursor: pointer;
  font-size: 0.85rem;
}

.clear-btn:hover:not(:disabled) {
  background: rgba(255, 68, 68, 0.1);
}

.clear-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.clips-scroll-container {
  max-height: 420px;
  overflow-y: auto;
  padding-right: 4px;
}

.clip-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: rgba(100, 108, 255, 0.05);
  border: 1px solid rgba(100, 108, 255, 0.2);
  border-radius: 8px;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.clip-item:hover {
  background: rgba(100, 108, 255, 0.1);
}

.clip-item.selected {
  background: rgba(100, 108, 255, 0.2);
  border-color: #646cff;
}

.clip-item.processing,
.clip-item.current {
  border-color: #646cff;
  box-shadow: 0 0 0 2px rgba(100, 108, 255, 0.25);
}

.clip-item.complete {
  border-color: #42b883;
}

.clip-item.error {
  border-color: #ff4444;
  background: rgba(255, 68, 68, 0.08);
}

.color-swatch {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.clip-info {
  flex: 1;
  text-align: left;
  min-width: 0;
}

.filename {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #213547;
}

.details {
  font-size: 0.85rem;
  color: #666;
}

.dot {
  margin: 0 0.25rem;
}

.clip-actions {
  display: flex;
  gap: 0.35rem;
  flex-shrink: 0;
}

.download-btn,
.remove-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.download-btn {
  background: #646cff;
  color: white;
}

.download-btn:hover {
  background: #535bf2;
}

.remove-btn {
  background: #ff4444;
  color: white;
}

.remove-btn:hover:not(:disabled) {
  background: #cc0000;
}

.remove-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.audio-preview {
  margin-top: 1.5rem;
  background: rgba(0, 0, 0, 0.05);
  padding: 1rem;
  border-radius: 8px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.preview-header h3 {
  margin: 0;
  font-size: 1rem;
  color: #213547;
}

.close-preview-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0;
  line-height: 1;
}

.close-preview-btn:hover {
  color: #ff4444;
}

.preview-player {
  width: 100%;
}

@media (prefers-color-scheme: dark) {
  .hint,
  .details {
    color: #aaa;
  }

  .clips-list h3,
  .filename,
  .preview-header h3 {
    color: #fff;
  }

  .clip-item {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .clip-item:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .clip-item.selected {
    background: rgba(100, 108, 255, 0.25);
    border-color: #646cff;
  }

  .audio-preview {
    background: rgba(255, 255, 255, 0.05);
  }

  .close-preview-btn {
    color: #aaa;
  }
}
</style>
