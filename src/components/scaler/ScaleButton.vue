<template>
  <div class="scale-section">
    <div class="scale-info">
      <div class="status">
        <p v-if="!store.hasVideos">
          <span class="icon">ℹ️</span> Upload videos to begin
        </p>
        <p v-else-if="store.canScale">
          <span class="icon">✅</span> Ready to scale {{ store.videos.length }} video{{ store.videos.length === 1 ? '' : 's' }} to {{ store.resolutionConfig.label }}
        </p>
        <p v-else-if="store.isProcessing">
          <span class="icon">⏳</span> Scaling batch…
        </p>
      </div>

      <div v-if="store.hasVideos" class="summary">
        <div class="summary-item">
          <span class="label">Videos:</span>
          <span class="value">{{ store.videos.length }}</span>
        </div>
        <div class="summary-item">
          <span class="label">Target:</span>
          <span class="value">{{ store.resolutionConfig.width }}×{{ store.resolutionConfig.height }}</span>
        </div>
        <div class="summary-item">
          <span class="label">Done:</span>
          <span class="value">{{ store.completedCount }}/{{ store.videos.length }}</span>
        </div>
      </div>
    </div>

    <button
      @click="handleScale"
      :disabled="!store.canScale"
      class="scale-btn"
      :class="{ processing: store.isProcessing }"
    >
      <span v-if="!store.isProcessing">🎬 Scale Videos</span>
      <span v-else>
        <span class="spinner"></span>
        {{ batchStatus }}
      </span>
    </button>

    <div v-if="store.isProcessing || store.completedCount > 0 || store.errorCount > 0" class="progress-bar">
      <div class="progress-fill" :style="{ width: `${store.overallProgress}%` }"></div>
      <span class="progress-text">{{ store.overallProgress }}%</span>
    </div>

    <ul v-if="store.hasVideos" class="job-list">
      <li
        v-for="video in store.videos"
        :key="video.id"
        class="job-item"
        :class="video.status"
      >
        <div class="job-main">
          <span class="job-name">{{ video.name }}</span>
          <span class="job-meta">{{ statusLabel(video) }}</span>
        </div>
        <div v-if="video.status === 'processing'" class="job-progress">
          <div class="job-progress-fill" :style="{ width: `${video.progress}%` }"></div>
        </div>
        <button
          v-if="video.outputBlob && (video.status === 'complete' || video.status === 'skipped')"
          class="job-download"
          @click="downloadVideo(video)"
        >
          Download
        </button>
      </li>
    </ul>

    <button
      v-if="store.completedCount > 0 && !store.isProcessing"
      class="download-all-btn"
      @click="downloadAll"
    >
      Download all ({{ store.completedCount }})
    </button>

    <p v-if="store.errorCount > 0 && !store.isProcessing" class="error-note">
      {{ store.errorCount }} video{{ store.errorCount === 1 ? '' : 's' }} failed. Check the list and try again.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useScalerStore, type ScalerVideo } from '../../stores/scaler'
import { ffmpegService } from '@/services/ffmpegService.js'

const store = useScalerStore()
const batchStatus = ref('Preparing...')

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

const downloadAll = async () => {
  for (const video of store.videos) {
    if (video.outputBlob && (video.status === 'complete' || video.status === 'skipped')) {
      downloadVideo(video)
      await new Promise((resolve) => setTimeout(resolve, 350))
    }
  }
}

const statusLabel = (video: ScalerVideo): string => {
  if (video.status === 'pending') return 'Waiting'
  if (video.status === 'processing') {
    return video.statusText ? `${video.statusText} (${video.progress}%)` : `${video.progress}%`
  }
  if (video.status === 'complete') return 'Complete'
  if (video.status === 'skipped') return 'Already at target'
  return video.error || 'Failed'
}

const handleScale = async () => {
  if (!store.canScale) return

  try {
    store.resetJobStates()
    store.setProcessing(true)
    batchStatus.value = 'Loading FFmpeg...'

    await ffmpegService.load()

    const target = store.resolutionConfig
    const queue = [...store.videos]

    for (let i = 0; i < queue.length; i++) {
      const video = queue[i]
      if (!video) continue

      store.currentVideoId = video.id
      batchStatus.value = `Video ${i + 1}/${queue.length}: ${video.name}`

      const alreadyAtTarget = video.width === target.width && video.height === target.height
      if (alreadyAtTarget) {
        store.updateVideo(video.id, {
          status: 'skipped',
          progress: 100,
          statusText: 'Already at target resolution',
          outputBlob: video.file
        })
        continue
      }

      store.updateVideo(video.id, {
        status: 'processing',
        progress: 0,
        statusText: 'Starting...'
      })

      try {
        const blob = await ffmpegService.scaleVideo(
          video.file,
          video.duration,
          target,
          (progress: number) => {
            store.updateVideo(video.id, { progress })
          },
          (status: string) => {
            store.updateVideo(video.id, { statusText: status })
            batchStatus.value = `Video ${i + 1}/${queue.length}: ${status}`
          }
        )

        store.updateVideo(video.id, {
          status: 'complete',
          progress: 100,
          statusText: 'Complete',
          outputBlob: blob
        })
      } catch (error) {
        console.error(`Scale error for ${video.name}:`, error)
        const message = error instanceof Error ? error.message : 'Scale failed'
        store.updateVideo(video.id, {
          status: 'error',
          statusText: 'Failed',
          error: message
        })
      }
    }

    batchStatus.value = 'Complete!'
    setTimeout(() => {
      store.setProcessing(false)
    }, 600)
  } catch (error) {
    console.error('Batch scale error:', error)
    alert('Error scaling videos. Check console for details.')
    store.setProcessing(false)
  }
}
</script>

<style scoped>
.scale-section {
  width: 100%;
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.scale-info {
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
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
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

.scale-btn {
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

.scale-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(100, 108, 255, 0.4);
}

.scale-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
  transform: none;
}

.scale-btn.processing {
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

.job-list {
  list-style: none;
  margin: 1.25rem 0 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.job-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 8px;
  background: rgba(100, 108, 255, 0.05);
  border: 1px solid rgba(100, 108, 255, 0.15);
}

.job-item.processing {
  border-color: #646cff;
}

.job-item.complete,
.job-item.skipped {
  border-color: #42b883;
  background: rgba(66, 184, 131, 0.08);
}

.job-item.error {
  border-color: #ff4444;
  background: rgba(255, 68, 68, 0.08);
}

.job-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.job-name {
  font-weight: 500;
  color: #213547;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.job-meta {
  font-size: 0.85rem;
  color: #666;
}

.job-progress {
  width: 100%;
  height: 6px;
  background: #e8e8e8;
  border-radius: 3px;
  overflow: hidden;
}

.job-progress-fill {
  height: 100%;
  background: #646cff;
  transition: width 0.2s ease;
}

.job-download {
  background: #646cff;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 0.4rem 0.75rem;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
}

.job-download:hover {
  background: #535bf2;
}

.download-all-btn {
  width: 100%;
  margin-top: 1rem;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: #646cff;
  background: transparent;
  border: 2px solid #646cff;
  border-radius: 8px;
  cursor: pointer;
}

.download-all-btn:hover {
  background: rgba(100, 108, 255, 0.1);
}

.error-note {
  margin: 1rem 0 0 0;
  color: #cc0000;
  font-size: 0.9rem;
}

@media (prefers-color-scheme: dark) {
  .scale-section {
    background: #1a1a1a;
  }

  .status p,
  .value,
  .job-name,
  .progress-text {
    color: #fff;
  }

  .label,
  .job-meta {
    color: #aaa;
  }

  .summary {
    border-top-color: #333;
  }

  .progress-bar {
    background: #2a2a2a;
  }

  .job-item {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .job-progress {
    background: #333;
  }
}
</style>
