<template>
  <div class="render-section">
    <div class="render-info">
      <div class="status">
        <p v-if="!store.canRender && !store.hasMP3">
          <span class="icon">ℹ️</span> Upload an MP3 file to begin
        </p>
        <p v-else-if="!store.canRender && !store.hasClips">
          <span class="icon">ℹ️</span> Add video clips to continue
        </p>
        <p v-else-if="store.canRender">
          <span class="icon">✅</span> Ready to render
        </p>
      </div>
      
      <div v-if="store.hasMP3 && store.hasClips" class="summary">
        <div class="summary-item">
          <span class="label">Audio Duration:</span>
          <span class="value">{{ formatDuration(store.mp3Duration) }}</span>
        </div>
        <div class="summary-item">
          <span class="label">Video Clips:</span>
          <span class="value">{{ store.clips.length }}</span>
        </div>
        <div class="summary-item">
          <span class="label">Timeline Coverage:</span>
          <span class="value">{{ formatDuration(store.totalClipsDuration) }}</span>
        </div>
      </div>
    </div>

    <button
      @click="handleRender"
      :disabled="!store.canRender"
      class="render-btn"
      :class="{ rendering: store.isRendering }"
    >
      <span v-if="!store.isRendering">🎬 Render Video</span>
      <span v-else>
        <span class="spinner"></span>
        {{ renderStatus }}
      </span>
    </button>

    <div v-if="store.isRendering" class="progress-bar">
      <div class="progress-fill" :style="{ width: `${store.renderProgress}%` }"></div>
      <span class="progress-text">{{ store.renderProgress }}%</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useEditorStore } from '../stores/editor'
import { ffmpegService } from '@/services/ffmpegService.js'

const store = useEditorStore()
const renderStatus = ref('Preparing...')

const handleRender = async () => {
  if (!store.canRender || !store.mp3File) return

  try {
    store.setRendering(true)
    renderStatus.value = 'Loading FFmpeg...'

    // Load FFmpeg if not already loaded
    renderStatus.value = 'Loading FFmpeg...'
    await ffmpegService.load()

    // --- Robust Clip Adjustment Logic ---
    // 1. Sort clips to ensure correct order
    const sortedClips = [...store.clips].sort((a, b) => a.start - b.start)

    // 2. Calculate total duration of user-defined clip segments
    const totalUserDuration = sortedClips.reduce((sum, clip) => sum + (clip.end - clip.start), 0)

    // 3. Determine the scaling factor to fit the audio duration
    const scalingFactor = store.mp3Duration / totalUserDuration

    // 4. Create a new, perfectly contiguous timeline
    let currentTime = 0
    const adjustedClips = sortedClips.map(clip => {
      const originalSegmentDuration = clip.end - clip.start
      const newSegmentDuration = originalSegmentDuration * scalingFactor
      
      const newClip = {
        ...clip,
        start: currentTime,
        end: currentTime + newSegmentDuration,
      }
      
      currentTime += newSegmentDuration
      return newClip
    })
    // --- End of Adjustment Logic ---

    // Process video with the perfectly adjusted clips
    const blob = await ffmpegService.processVideo(
      store.mp3File,
      adjustedClips,
      store.mp3Duration,
      // UI Progress callback (percentage)
      (progress: number) => {
        store.setRenderProgress(progress)
      },
      // Status Text callback (string)
      (status: string) => {
        renderStatus.value = status
        console.log(`[Render Status] ${status}`)
      }
    )

    // Download the result
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `loop-jitsu-${Date.now()}.mp4`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    renderStatus.value = 'Complete!'
    setTimeout(() => {
      store.setRendering(false)
    }, 1000)
  } catch (error) {
    console.error('Render error:', error)
    alert('Error rendering video. Check console for details.')
    store.setRendering(false)
  }
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.render-section {
  width: 100%;
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.render-info {
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
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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

.render-btn {
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

.render-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(100, 108, 255, 0.4);
}

.render-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
  transform: none;
}

.render-btn.rendering {
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
  .render-section {
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