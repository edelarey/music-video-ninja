<template>
  <div class="combiner-timeline">
    <div class="timeline-header">
      <h3>Timeline</h3>
      <div class="timeline-info">
        <span class="clip-count">{{ store.timelineClips.length }} clip{{ store.timelineClips.length !== 1 ? 's' : '' }}</span>
        <span class="separator">|</span>
        <span class="total-duration">Total: {{ formatDuration(store.totalDuration) }}</span>
      </div>
      <button 
        v-if="store.hasTimelineClips" 
        @click="clearTimeline" 
        class="clear-btn"
        title="Clear timeline"
      >
        Clear All
      </button>
    </div>

    <div 
      class="timeline-track"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
      :class="{ 'drop-active': isDragOver, 'empty': !store.hasTimelineClips }"
    >
      <div v-if="!store.hasTimelineClips" class="empty-message">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        <p>Drop video clips here to build your sequence</p>
      </div>

      <TransitionGroup v-else name="clip" tag="div" class="clips-container">
        <div
          v-for="(clip, index) in store.timelineClipsWithSource"
          :key="clip.id"
          class="timeline-clip"
          :class="{ selected: selectedClipId === clip.id }"
          :style="{ backgroundColor: clip.source?.color + '40', borderColor: clip.source?.color }"
          draggable="true"
          @dragstart="handleClipDragStart($event, index)"
          @dragover.prevent="handleClipDragOver($event, index)"
          @drop.prevent="handleClipDrop($event, index)"
          @click="selectClip(clip.id)"
        >
          <div class="clip-color" :style="{ backgroundColor: clip.source?.color }"></div>
          <div class="clip-content">
            <span class="clip-name">{{ clip.source?.name || 'Unknown' }}</span>
            <span class="clip-duration">{{ formatDuration(clip.source?.duration || 0) }}</span>
          </div>
          <button @click.stop="removeClip(clip.id)" class="remove-clip-btn" title="Remove from timeline">×</button>
        </div>
      </TransitionGroup>
    </div>

    <div v-if="selectedClipId" class="selection-info">
      <p>Press <kbd>Delete</kbd> to remove selected clip</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useCombinerStore } from '../../stores/combiner'

const store = useCombinerStore()
const isDragOver = ref(false)
const selectedClipId = ref<string | null>(null)
const draggedClipIndex = ref<number | null>(null)

const handleDragOver = () => {
  isDragOver.value = true
}

const handleDragLeave = () => {
  isDragOver.value = false
}

const handleDrop = (event: DragEvent) => {
  isDragOver.value = false
  if (!event.dataTransfer) return

  const sourceId = event.dataTransfer.getData('text/plain')
  // Check if it's a source being dropped (not a reorder operation)
  if (sourceId && store.videoSources.find(s => s.sourceId === sourceId)) {
    store.addToTimeline(sourceId)
  }
}

const handleClipDragStart = (event: DragEvent, index: number) => {
  draggedClipIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.setData('clip-reorder', index.toString())
    event.dataTransfer.effectAllowed = 'move'
  }
}

const handleClipDragOver = (event: DragEvent, index: number) => {
  if (draggedClipIndex.value !== null && draggedClipIndex.value !== index) {
    event.preventDefault()
  }
}

const handleClipDrop = (_event: DragEvent, toIndex: number) => {
  if (draggedClipIndex.value !== null && draggedClipIndex.value !== toIndex) {
    store.reorderTimeline(draggedClipIndex.value, toIndex)
  }
  draggedClipIndex.value = null
}

const selectClip = (clipId: string) => {
  selectedClipId.value = selectedClipId.value === clipId ? null : clipId
}

const removeClip = (clipId: string) => {
  store.removeFromTimeline(clipId)
  if (selectedClipId.value === clipId) {
    selectedClipId.value = null
  }
}

const clearTimeline = () => {
  if (confirm('Are you sure you want to clear all clips from the timeline?')) {
    store.clearTimeline()
    selectedClipId.value = null
  }
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Delete' && selectedClipId.value) {
    removeClip(selectedClipId.value)
  }
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.combiner-timeline {
  width: 100%;
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.timeline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.timeline-header h3 {
  margin: 0;
  color: #213547;
  font-size: 1.1rem;
}

.timeline-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #666;
  font-size: 0.9rem;
}

.separator {
  color: #ccc;
}

.clear-btn {
  padding: 0.5rem 1rem;
  background: #ff4444;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.2s ease;
}

.clear-btn:hover {
  background: #cc0000;
}

.timeline-track {
  min-height: 120px;
  max-height: 400px;
  overflow-y: auto;
  background: rgba(100, 108, 255, 0.05);
  border: 2px dashed rgba(100, 108, 255, 0.3);
  border-radius: 8px;
  padding: 1rem;
  transition: all 0.2s ease;
}

.timeline-track.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  max-height: 120px;
  overflow: hidden;
}

/* Custom scrollbar for timeline */
.timeline-track::-webkit-scrollbar {
  width: 6px;
}

.timeline-track::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 3px;
}

.timeline-track::-webkit-scrollbar-thumb {
  background: rgba(100, 108, 255, 0.5);
  border-radius: 3px;
}

.timeline-track::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 108, 255, 0.8);
}

.timeline-track.drop-active {
  border-color: #646cff;
  background: rgba(100, 108, 255, 0.1);
  box-shadow: 0 0 0 4px rgba(100, 108, 255, 0.2);
}

.empty-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  color: #888;
}

.empty-message svg {
  color: #646cff;
  opacity: 0.5;
}

.empty-message p {
  margin: 0;
  font-size: 0.95rem;
}

.clips-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.timeline-clip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 8px;
  border: 2px solid;
  cursor: grab;
  transition: all 0.2s ease;
  min-width: 140px;
  max-width: 200px;
}

.timeline-clip:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.timeline-clip:active {
  cursor: grabbing;
  transform: scale(0.98);
}

.timeline-clip.selected {
  outline: 3px solid #646cff;
  outline-offset: 2px;
}

.clip-color {
  width: 12px;
  height: 100%;
  min-height: 32px;
  border-radius: 4px;
  flex-shrink: 0;
}

.clip-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.clip-name {
  font-size: 0.85rem;
  font-weight: 500;
  color: #213547;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.clip-duration {
  font-size: 0.75rem;
  color: #666;
}

.remove-clip-btn {
  width: 22px;
  height: 22px;
  border: none;
  background: rgba(255, 68, 68, 0.8);
  color: white;
  border-radius: 50%;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
  flex-shrink: 0;
  line-height: 1;
  opacity: 0;
}

.timeline-clip:hover .remove-clip-btn {
  opacity: 1;
}

.remove-clip-btn:hover {
  background: #ff4444;
}

.selection-info {
  margin-top: 1rem;
  padding: 0.75rem;
  background: rgba(100, 108, 255, 0.05);
  border-radius: 4px;
  text-align: center;
}

.selection-info p {
  margin: 0;
  font-size: 0.85rem;
  color: #666;
}

.selection-info kbd {
  background: #e0e0e0;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.8rem;
  border: 1px solid #ccc;
}

/* Transition animations */
.clip-move,
.clip-enter-active,
.clip-leave-active {
  transition: all 0.3s ease;
}

.clip-enter-from,
.clip-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

.clip-leave-active {
  position: absolute;
}

@media (prefers-color-scheme: dark) {
  .combiner-timeline {
    background: #1a1a1a;
  }

  .timeline-header h3 {
    color: #fff;
  }

  .timeline-info {
    color: #aaa;
  }

  .timeline-track {
    background: rgba(100, 108, 255, 0.08);
    border-color: rgba(100, 108, 255, 0.25);
  }

  .timeline-track.drop-active {
    background: rgba(100, 108, 255, 0.15);
  }

  .empty-message {
    color: #aaa;
  }

  .clip-name {
    color: #fff;
  }

  .clip-duration {
    color: #aaa;
  }

  .selection-info {
    background: rgba(100, 108, 255, 0.1);
  }

  .selection-info p {
    color: #aaa;
  }

  .selection-info kbd {
    background: #333;
    border-color: #555;
    color: #fff;
  }
}
</style>
