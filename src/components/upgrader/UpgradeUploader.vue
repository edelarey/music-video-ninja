<template>
  <div class="upgrade-uploader">
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
        <p>{{ store.hasVideo ? 'Replace video' : 'Click or drag a video here' }}</p>
        <span class="hint">One finished video (MP4, WebM, MOV, AVI, MKV) — soundtrack is kept</span>
      </div>
    </div>

    <div v-if="store.video" class="video-card" :class="store.status">
      <div class="clip-info">
        <div class="filename">{{ store.video.name }}</div>
        <div class="details">
          <span>{{ formatDuration(store.video.duration) }}</span>
          <span class="dot">·</span>
          <span>{{ describeResolution(store.video.width, store.video.height) }}</span>
          <span class="dot">·</span>
          <span>{{ store.video.width }}×{{ store.video.height }}</span>
          <span class="dot">·</span>
          <span>{{ formatBytes(store.video.file.size) }}</span>
        </div>
        <div class="direction" :class="store.direction">
          {{ directionLabel }}
        </div>
      </div>
      <button
        class="remove-btn"
        title="Remove"
        :disabled="store.isProcessing"
        @click="removeVideo"
      >
        ×
      </button>
    </div>

    <p v-if="largeFile" class="size-note">
      This file is {{ store.video ? formatBytes(store.video.file.size) : '' }}. Long HD upgrades run entirely in
      the browser and can take several minutes — keep this tab open.
    </p>

    <div v-if="previewUrl" class="video-preview">
      <div class="preview-header">
        <h3>{{ previewingOutput ? 'Upgraded preview' : 'Source preview' }}</h3>
        <button @click="clearPreview" class="close-preview-btn">×</button>
      </div>
      <video :src="previewUrl" controls class="preview-player"></video>
      <p class="preview-note">
        Sound is enabled so you can confirm the soundtrack. Unmute the player if needed.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import { useUpgraderStore } from '../../stores/upgrader'
import { describeResolution } from '../../const/resolutions'

const store = useUpgraderStore()
const fileInput = ref<HTMLInputElement | null>(null)
const previewUrl = ref<string | null>(null)
const previewingOutput = ref(false)

const largeFile = computed(() => {
  return !!store.video && store.video.file.size >= 80 * 1024 * 1024
})

const directionLabel = computed(() => {
  if (!store.video) return ''
  const target = store.resolutionConfig.label
  if (store.alreadyAtTarget) return `Already ${target}`
  if (store.direction === 'upscale') return `↑ Upgrade to ${target} — soundtrack preserved`
  if (store.direction === 'downscale') return `↓ Downscale to ${target} — soundtrack preserved`
  return `Re-encode at ${target} — soundtrack preserved`
})

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) loadVideoFile(file)
  if (target) target.value = ''
}

const handleDrop = (event: DragEvent) => {
  const file = Array.from(event.dataTransfer?.files || []).find((item) =>
    item.type.startsWith('video/')
  )
  if (file) loadVideoFile(file)
}

const loadVideoFile = (file: File) => {
  const video = document.createElement('video')
  const url = URL.createObjectURL(file)

  video.addEventListener('loadedmetadata', () => {
    store.setVideo(file, video.duration, video.videoWidth, video.videoHeight)
    URL.revokeObjectURL(url)
    setPreview(file, false)
  })

  video.addEventListener('error', () => {
    alert(`Error loading video file: ${file.name}`)
    URL.revokeObjectURL(url)
  })

  video.src = url
}

const removeVideo = () => {
  clearPreview()
  store.clearVideo()
}

const setPreview = (source: Blob, isOutput: boolean) => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
  previewUrl.value = URL.createObjectURL(source)
  previewingOutput.value = isOutput
}

const clearPreview = () => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
  }
  previewingOutput.value = false
}

watch(
  () => store.outputBlob,
  (blob) => {
    if (blob) {
      setPreview(blob, true)
    } else if (store.video) {
      setPreview(store.video.file, false)
    }
  }
)

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
.upgrade-uploader {
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

.video-card {
  margin-top: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1rem;
  background: rgba(100, 108, 255, 0.05);
  border: 1px solid rgba(100, 108, 255, 0.2);
  border-radius: 8px;
}

.video-card.processing {
  border-color: #646cff;
  box-shadow: 0 0 0 2px rgba(100, 108, 255, 0.25);
}

.video-card.complete {
  border-color: #42b883;
}

.video-card.error {
  border-color: #ff4444;
  background: rgba(255, 68, 68, 0.08);
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
  margin-top: 0.2rem;
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

.remove-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  font-size: 1.1rem;
  cursor: pointer;
  background: #ff4444;
  color: white;
  flex-shrink: 0;
  line-height: 1;
}

.remove-btn:hover:not(:disabled) {
  background: #cc0000;
}

.remove-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.size-note {
  margin: 0.75rem 0 0 0;
  font-size: 0.85rem;
  color: #e67700;
  line-height: 1.5;
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
  max-height: 360px;
  background: #000;
  border-radius: 4px;
}

.preview-note {
  margin: 0.5rem 0 0 0;
  font-size: 0.8rem;
  color: #888;
}

@media (prefers-color-scheme: dark) {
  .hint,
  .details,
  .direction.same,
  .preview-note {
    color: #aaa;
  }

  .filename,
  .preview-header h3 {
    color: #fff;
  }

  .video-card {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .video-preview {
    background: rgba(255, 255, 255, 0.05);
  }

  .close-preview-btn {
    color: #aaa;
  }
}
</style>
