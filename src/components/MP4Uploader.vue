<template>
  <div class="mp4-uploader">
    <div class="upload-area" @click="triggerFileInput" @dragover.prevent @drop.prevent="handleDrop">
      <input
        ref="fileInput"
        type="file"
        accept="video/mp4"
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
          <line x1="2" y1="7" x2="7" y2="7"></line>
          <line x1="2" y1="17" x2="7" y2="17"></line>
          <line x1="17" y1="17" x2="22" y2="17"></line>
          <line x1="17" y1="7" x2="22" y2="7"></line>
        </svg>
        <p>Click or drag MP4 clips here</p>
        <span class="hint">Multiple short video clips (audio will be muted)</span>
      </div>
    </div>
    
    <div v-if="store.videoSources.length > 0" class="clips-list">
      <h3>Available Clips ({{ store.videoSources.length }})</h3>
      <p class="drag-hint">Drag a clip onto the timeline to use it.</p>
      <div
        class="clip-item"
        v-for="source in store.videoSources"
        :key="source.sourceId"
        draggable="true"
        @dragstart="handleDragStart($event, source.sourceId)"
      >
        <div class="color-swatch" :style="{ backgroundColor: source.color }"></div>
        <div class="clip-info">
          <div class="details">{{ source.file.name }}</div>
          <div class="details">
            <span>Duration: {{ formatDuration(source.duration) }}</span>
          </div>
        </div>
        <button @click="removeVideoSource(source.sourceId)" class="remove-btn" title="Remove source and all its clips">×</button>
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
  const files = Array.from(target.files || [])
  files.forEach(file => loadMP4File(file))
}

const handleDrop = (event: DragEvent) => {
  const files = Array.from(event.dataTransfer?.files || [])
  files
    .filter(file => file.type === 'video/mp4')
    .forEach(file => loadMP4File(file))
}

const loadMP4File = (file: File) => {
  const video = document.createElement('video')
  const url = URL.createObjectURL(file)
  
  video.addEventListener('loadedmetadata', () => {
    store.addVideoSource(file, video.duration)
    URL.revokeObjectURL(url)
  })
  
  video.addEventListener('error', () => {
    alert(`Error loading MP4 file: ${file.name}`)
    URL.revokeObjectURL(url)
  })
  
  video.src = url
}

const handleDragStart = (event: DragEvent, sourceId: string) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', sourceId)
    event.dataTransfer.effectAllowed = 'copy'
  }
}

const removeVideoSource = (sourceId: string) => {
  if (confirm('Are you sure you want to remove this video source and all its clips from the timeline?')) {
    store.removeVideoSource(sourceId)
  }
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.mp4-uploader {
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

.upload-prompt svg {
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

.drag-hint {
  font-size: 0.9rem;
  color: #666;
  text-align: center;
  margin-bottom: 1rem;
}

.clips-list {
  margin-top: 1.5rem;
}

.clips-list h3 {
  margin: 0 0 1rem 0;
  color: #213547;
  font-size: 1rem;
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
  transition: all 0.2s ease;
  cursor: grab;
}

.clip-item:hover {
  background: rgba(66, 184, 131, 0.1);
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.clip-item:active {
  cursor: grabbing;
  transform: scale(0.98);
}

.color-swatch {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  flex-shrink: 0;
  border: 1px solid rgba(0,0,0,0.1);
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

.separator {
  color: #ccc;
}

.remove-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: #ff4444;
  color: white;
  border-radius: 50%;
  font-size: 1.3rem;
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
  .hint {
    color: #aaa;
  }

  .drag-hint {
    color: #aaa;
  }

  .clips-list h3,
  .filename {
    color: #fff;
  }
  
  .details {
    color: #aaa;
  }

  .clip-item {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .clip-item:hover {
    background: rgba(255, 255, 255, 0.12);
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }

  .color-swatch {
    border-color: rgba(255,255,255,0.2);
  }
}
</style>