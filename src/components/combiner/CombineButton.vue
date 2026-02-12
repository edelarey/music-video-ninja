<template>
  <div class="combine-section">
    <div class="combine-info">
      <div class="status">
        <p v-if="!store.hasVideoSources">
          <span class="icon">ℹ️</span> Upload video clips to begin
        </p>
        <p v-else-if="!store.hasTimelineClips">
          <span class="icon">ℹ️</span> Add clips to the timeline to continue
        </p>
        <p v-else-if="store.canCombine">
          <span class="icon">✅</span> Ready to combine
        </p>
      </div>
      
      <div v-if="store.hasTimelineClips" class="summary">
        <div class="summary-item">
          <span class="label">Clips in Timeline:</span>
          <span class="value">{{ store.timelineClips.length }}</span>
        </div>
        <div class="summary-item">
          <span class="label">Total Duration:</span>
          <span class="value">{{ formatDuration(store.totalDuration) }}</span>
        </div>
        <div class="summary-item">
          <span class="label">Output Resolution:</span>
          <span class="value">{{ store.resolutionConfig.width }}×{{ store.resolutionConfig.height }}</span>
        </div>
      </div>
    </div>

    <button
      @click="handleCombine"
      :disabled="!store.canCombine"
      class="combine-btn"
      :class="{ processing: store.isProcessing }"
    >
      <span v-if="!store.isProcessing">🎬 Combine Videos</span>
      <span v-else>
        <span class="spinner"></span>
        {{ combineStatus }}
      </span>
    </button>

    <div v-if="store.isProcessing" class="progress-bar">
      <div class="progress-fill" :style="{ width: `${store.processProgress}%` }"></div>
      <span class="progress-text">{{ store.processProgress }}%</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useCombinerStore } from '../../stores/combiner'
import { ffmpegService } from '@/services/ffmpegService.js'

const store = useCombinerStore()
const combineStatus = ref('Preparing...')

const handleCombine = async () => {
  if (!store.canCombine) return

  try {
    store.setProcessing(true)
    combineStatus.value = 'Loading FFmpeg...'

    // Load FFmpeg if not already loaded
    await ffmpegService.load()

    combineStatus.value = 'Preparing clips...'

    // Process video with the timeline clips
    const blob = await ffmpegService.combineVideos(
      store.timelineClipsWithSource,
      store.resolutionConfig,
      store.totalDuration,
      // UI Progress callback (percentage)
      (progress: number) => {
        store.setProcessProgress(progress)
      },
      // Status Text callback (string)
      (status: string) => {
        combineStatus.value = status
        console.log(`[Combine Status] ${status}`)
      }
    )

    // Download the result
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `video-combiner-${Date.now()}.mp4`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    combineStatus.value = 'Complete!'
    setTimeout(() => {
      store.setProcessing(false)
    }, 1000)
  } catch (error) {
    console.error('Combine error:', error)
    alert('Error combining videos. Check console for details.')
    store.setProcessing(false)
  }
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.combine-section {
  width: 100%;
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.combine-info {
  margin-bottom: 1.5rem;
}

.status p {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  color: #213547;
}

.icon {
  font-size: 1.2rem;
}

.summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.label {
  font-size: 0.85rem;
  color: #666;
  font-weight: 500;
}

.value {
  font-size: 1.1rem;
  color: #213547;
  font-weight: 600;
}

.combine-btn {
  width: 100%;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, #646cff 0%, #535bf2 100%);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.combine-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(100, 108, 255, 0.4);
}

.combine-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
  transform: none;
}

.combine-btn.processing {
  background: #42b883;
  cursor: wait;
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.progress-bar {
  position: relative;
  width: 100%;
  height: 40px;
  background: #f0f0f0;
  border-radius: 8px;
  margin-top: 1rem;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #42b883 0%, #35a372 100%);
  transition: width 0.3s ease;
  border-radius: 8px;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-weight: 600;
  color: #213547;
  font-size: 0.9rem;
}

@media (prefers-color-scheme: dark) {
  .combine-section {
    background: #1a1a1a;
  }

  .status p,
  .value {
    color: #fff;
  }

  .label {
    color: #aaa;
  }

  .summary {
    border-top-color: #333;
  }

  .progress-bar {
    background: #2a2a2a;
  }

  .progress-text {
    color: #fff;
  }
}
</style>
