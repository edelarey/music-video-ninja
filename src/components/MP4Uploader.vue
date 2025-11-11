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
    
    <div v-if="store.clips.length > 0" class="clips-list">
      <h3>Uploaded Clips ({{ store.clips.length }})</h3>
      <div class="clip-item" v-for="clip in store.clips" :key="clip.id">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
          <line x1="7" y1="2" x2="7" y2="22"></line>
          <line x1="17" y1="2" x2="17" y2="22"></line>
          <line x1="2" y1="12" x2="22" y2="12"></line>
        </svg>
        <div class="clip-info">
          <p class="filename">{{ clip.file.name }}</p>
          <p class="details">
            <span>Clip: {{ formatDuration(clip.duration) }}</span>
            <span class="separator">•</span>
            <span>Timeline: {{ formatDuration(clip.start) }} - {{ formatDuration(clip.end) }}</span>
            <span class="separator">•</span>
            <span>Section: {{ formatDuration(clip.end - clip.start) }}</span>
          </p>
        </div>
        <button @click="removeClip(clip.id)" class="remove-btn" title="Remove clip">×</button>
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
    const clipDuration = video.duration
    const currentEnd = store.totalClipsDuration
    
    store.addClip(file, currentEnd, currentEnd + clipDuration)
    
    const lastClip = store.clips[store.clips.length - 1]
    if (lastClip) {
      store.setClipDuration(lastClip.id, clipDuration)
    }
    
    URL.revokeObjectURL(url)
  })
  
  video.addEventListener('error', () => {
    alert(`Error loading MP4 file: ${file.name}`)
    URL.revokeObjectURL(url)
  })
  
  video.src = url
}

const removeClip = (id: string) => {
  store.removeClip(id)
  
  // Recalculate positions for remaining clips
  let currentPosition = 0
  store.clips.forEach(clip => {
    const duration = clip.end - clip.start
    store.updateClipPosition(clip.id, currentPosition, currentPosition + duration)
    currentPosition += duration
  })
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
  transition: background 0.2s ease;
}

.clip-item:hover {
  background: rgba(66, 184, 131, 0.1);
}

.clip-item svg {
  color: #42b883;
  flex-shrink: 0;
}

.clip-info {
  flex: 1;
  text-align: left;
  min-width: 0;
}

.filename {
  margin: 0;
  font-weight: 500;
  color: #213547;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.details {
  margin: 0.25rem 0 0 0;
  font-size: 0.85rem;
  color: #666;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
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
  .clips-list h3,
  .filename {
    color: #fff;
  }
  
  .details {
    color: #aaa;
  }
}
</style>