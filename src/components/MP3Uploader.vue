<template>
  <div class="mp3-uploader">
    <div class="upload-area" @click="triggerFileInput" @dragover.prevent @drop.prevent="handleDrop">
      <input
        ref="fileInput"
        type="file"
        accept="audio/mp3,audio/mpeg"
        @change="handleFileSelect"
        style="display: none"
      />
      <div v-if="!store.hasMP3" class="upload-prompt">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18V5l12-2v13"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="16" r="3"></circle>
        </svg>
        <p>Click or drag MP3 file here</p>
        <span class="hint">Audio file with optional embedded cover art</span>
      </div>
      <div v-else class="file-info">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18V5l12-2v13"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="16" r="3"></circle>
        </svg>
        <div class="info">
          <p class="filename">{{ store.mp3File?.name }}</p>
          <p class="duration">Duration: {{ formatDuration(store.mp3Duration) }}</p>
        </div>
        <button @click.stop="removeFile" class="remove-btn" title="Remove file">×</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useEditorStore } from '../stores/editor'

const store = useEditorStore()
const fileInput = ref<HTMLInputElement | null>(null)

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    loadMP3File(file)
  }
}

const handleDrop = (event: DragEvent) => {
  const file = event.dataTransfer?.files[0]
  if (file && file.type.startsWith('audio/')) {
    loadMP3File(file)
  }
}

const loadMP3File = (file: File) => {
  const audio = new Audio()
  const url = URL.createObjectURL(file)
  
  audio.addEventListener('loadedmetadata', () => {
    store.setMP3(file, audio.duration)
    URL.revokeObjectURL(url)
  })
  
  audio.addEventListener('error', () => {
    alert('Error loading MP3 file')
    URL.revokeObjectURL(url)
  })
  
  audio.src = url
}

const removeFile = () => {
  store.setMP3(null, 0)
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.mp3-uploader {
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

.upload-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: #646cff;
}

.upload-prompt svg {
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

.file-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem;
  background: rgba(100, 108, 255, 0.1);
  border-radius: 8px;
}

.file-info svg {
  color: #646cff;
  flex-shrink: 0;
}

.info {
  flex: 1;
  text-align: left;
}

.filename {
  margin: 0;
  font-weight: 500;
  color: #213547;
}

.duration {
  margin: 0.25rem 0 0 0;
  font-size: 0.9rem;
  color: #666;
}

.remove-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: #ff4444;
  color: white;
  border-radius: 50%;
  font-size: 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
  flex-shrink: 0;
  line-height: 1;
}

.remove-btn:hover {
  background: #cc0000;
}

@media (prefers-color-scheme: dark) {
  .filename {
    color: #fff;
  }
  
  .duration {
    color: #aaa;
  }
}
</style>