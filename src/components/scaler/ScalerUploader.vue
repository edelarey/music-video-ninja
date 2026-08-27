<template>
  <div class="scaler-uploader">
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
        accept="video/*"
        multiple
        @change="handleFileSelect"
        style="display: none"
      />
      <div class="upload-prompt">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
          <line x1="7" y1="2" x2="7" y2="22"></line>
          <line x1="17" y1="2" x2="17" y2="22"></line>
          <line x1="2" y1="12" x2="22" y2="12"></line>
        </svg>
        <p>Click or drag videos here</p>
        <span class="hint">Supports MP4, WebM, MOV, AVI, MKV — add as many as you want</span>
      </div>
    </div>

    <div v-if="store.videos.length > 0" class="clips-list">
      <div class="list-header">
        <h3>Videos ({{ store.videos.length }})</h3>
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
          v-for="video in store.videos"
          :key="video.id"
          :class="{
            selected: selectedId === video.id,
            current: store.currentVideoId === video.id,
            [video.status]: true
          }"
          @click="selectForPreview(video)"
        >
          <div class="color-swatch" :style="{ backgroundColor: video.color }"></div>
          <div class="clip-info">
            <div class="filename">{{ video.name }}</div>
            <div class="details">
              <span>{{ formatDuration(video.duration) }}</span>
              <span class="dot">·</span>
              <span>{{ describeResolution(video.width, video.height) }}</span>
              <span class="dot">·</span>
              <span>{{ video.width }}×{{ video.height }}</span>
            </div>
            <div class="direction" :class="scaleDirection(video.height, store.resolutionConfig.height)">
              {{ directionLabel(video) }}
            </div>
          </div>
          <div class="clip-actions">
            <button
              v-if="video.outputBlob && (video.status === 'complete' || video.status === 'skipped')"
              @click.stop="downloadVideo(video)"
              class="download-btn"
              title="Download"
            >
              ↓
            </button>
            <button
              @click.stop="removeVideo(video.id)"
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

    <div v-if="previewUrl" class="video-preview">
      <div class="preview-header">
        <h3>Preview</h3>
        <button @click="clearPreview" class="close-preview-btn">×</button>
      </div>
      <video :src="previewUrl" controls autoplay muted class="preview-player"></video>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useScalerStore, type ScalerVideo } from '../../stores/scaler'
import { describeResolution, scaleDirection } from '../../const/resolutions'

const store = useScalerStore()
const fileInput = ref<HTMLInputElement | null>(null)
const selectedId = ref<string | null>(null)
const previewUrl = ref<string | null>(null)

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  Array.from(target.files || []).forEach((file) => loadVideoFile(file))
  if (target) target.value = ''
}

const handleDrop = (event: DragEvent) => {
  Array.from(event.dataTransfer?.files || [])
    .filter((file) => file.type.startsWith('video/'))
    .forEach((file) => loadVideoFile(file))
}

const loadVideoFile = (file: File) => {
  const video = document.createElement('video')
  const url = URL.createObjectURL(file)

  video.addEventListener('loadedmetadata', () => {
    store.addVideo(file, video.duration, video.videoWidth, video.videoHeight)
    URL.revokeObjectURL(url)
  })

  video.addEventListener('error', () => {
    alert(`Error loading video file: ${file.name}`)
    URL.revokeObjectURL(url)
  })

  video.src = url
}

const removeVideo = (id: string) => {
  if (selectedId.value === id) {
    clearPreview()
  }
  store.removeVideo(id)
}

const clearAll = () => {
  if (!confirm('Remove all videos from the batch?')) return
  clearPreview()
  store.clearAll()
}

const selectForPreview = (video: ScalerVideo) => {
  if (selectedId.value === video.id) {
    clearPreview()
    return
  }

  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }

  selectedId.value = video.id
  previewUrl.value = URL.createObjectURL(video.file)
}

const clearPreview = () => {
  selectedId.value = null
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
  }
}

const outputFilename = (name: string): string => {
  const lastDot = name.lastIndexOf('.')
  const base = lastDot > 0 ? name.slice(0, lastDot) : name
  return `${base}-${store.resolutionConfig.label}.mp4`
}

const downloadVideo = (video: ScalerVideo) => {
  if (!video.outputBlob) return
  const url = URL.createObjectURL(video.outputBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = outputFilename(video.name)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const directionLabel = (video: ScalerVideo): string => {
  const direction = scaleDirection(video.height, store.resolutionConfig.height)
  const target = store.resolutionConfig.label
  if (direction === 'upscale') return `↑ Upscale to ${target}`
  if (direction === 'downscale') return `↓ Downscale to ${target}`
  return `Already ${target}`
}

onUnmounted(() => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
})

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.scaler-uploader {
  width: 100%;
}

.upload-area {
  border: 2px dashed #42b883;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: rgba(66, 184, 131, 0.05);
}

.upload-area:hover {
  border-color: #35a372;
  background: rgba(66, 184, 131, 0.1);
}

.upload-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: #42b883;
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
  background: rgba(66, 184, 131, 0.05);
  border: 1px solid rgba(66, 184, 131, 0.2);
  border-radius: 8px;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.clip-item:hover {
  background: rgba(66, 184, 131, 0.1);
}

.clip-item.selected {
  background: rgba(66, 184, 131, 0.2);
  border-color: #42b883;
}

.clip-item.processing {
  border-color: #646cff;
}

.clip-item.complete,
.clip-item.skipped {
  border-color: #42b883;
}

.clip-item.error {
  border-color: #ff4444;
  background: rgba(255, 68, 68, 0.08);
}

.clip-item.current {
  box-shadow: 0 0 0 2px #646cff;
}

.upload-area.disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.direction {
  font-size: 0.8rem;
  font-weight: 600;
  margin-top: 0.15rem;
}

.direction.upscale {
  color: #535bf2;
}

.direction.downscale {
  color: #e67700;
}

.direction.same {
  color: #888;
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

.video-preview {
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
  max-height: 300px;
  background: #000;
  border-radius: 4px;
}

@media (prefers-color-scheme: dark) {
  .hint,
  .details,
  .direction.same {
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
    background: rgba(66, 184, 131, 0.25);
    border-color: #42b883;
  }

  .video-preview {
    background: rgba(255, 255, 255, 0.05);
  }

  .close-preview-btn {
    color: #aaa;
  }
}
</style>
