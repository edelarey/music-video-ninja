<template>
  <div class="upgrade-section">
    <div class="upgrade-info">
      <div class="status">
        <p v-if="!store.hasVideo">
          <span class="icon">ℹ️</span> Upload a finished video to begin
        </p>
        <p v-else-if="store.isProcessing">
          <span class="icon">⏳</span> {{ store.statusText || 'Upgrading…' }}
        </p>
        <p v-else-if="store.status === 'complete'">
          <span class="icon">✅</span>
          {{ store.audioPreserved ? 'Upgrade complete — soundtrack preserved' : 'Upgrade complete (no soundtrack found)' }}
        </p>
        <p v-else-if="store.status === 'error'">
          <span class="icon">⚠️</span> {{ store.error || 'Upgrade failed' }}
        </p>
        <p v-else-if="store.alreadyAtTarget">
          <span class="icon">ℹ️</span> Already {{ store.resolutionConfig.label }} — pick a higher resolution
        </p>
        <p v-else-if="store.canUpgrade">
          <span class="icon">✅</span> Ready to upgrade to {{ store.resolutionConfig.label }} and keep the soundtrack
        </p>
      </div>

      <div v-if="store.hasVideo" class="summary">
        <div class="summary-item">
          <span class="label">Source:</span>
          <span class="value">{{ store.video?.width }}×{{ store.video?.height }}</span>
        </div>
        <div class="summary-item">
          <span class="label">Target:</span>
          <span class="value">{{ store.resolutionConfig.width }}×{{ store.resolutionConfig.height }}</span>
        </div>
        <div class="summary-item">
          <span class="label">Duration:</span>
          <span class="value">{{ formatDuration(store.video?.duration ?? 0) }}</span>
        </div>
        <div class="summary-item">
          <span class="label">Audio:</span>
          <span class="value">{{ audioLabel }}</span>
        </div>
      </div>
    </div>

    <button
      @click="handleUpgrade"
      :disabled="!store.canUpgrade"
      class="upgrade-btn"
      :class="{ processing: store.isProcessing }"
    >
      <span v-if="!store.isProcessing">🎬 Upgrade to {{ store.resolutionConfig.label }}</span>
      <span v-else>
        <span class="spinner"></span>
        {{ store.statusText || 'Upgrading…' }}
      </span>
    </button>

    <div
      v-if="store.isProcessing || store.status === 'complete' || store.status === 'error'"
      class="progress-bar"
    >
      <div class="progress-fill" :style="{ width: `${store.progress}%` }"></div>
      <span class="progress-text">{{ store.progress }}%</span>
    </div>

    <button
      v-if="store.outputBlob && store.status === 'complete'"
      class="download-btn"
      @click="downloadOutput"
    >
      Download {{ outputFilename }}
    </button>

    <p v-if="store.status === 'error'" class="error-note">
      {{ store.error }} Keep this tab open and try again. Very long files may need more RAM.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUpgraderStore } from '../../stores/upgrader'
import { ffmpegService } from '@/services/ffmpegService.js'

const store = useUpgraderStore()

const audioLabel = computed(() => {
  if (store.audioPreserved === true) return 'Preserved'
  if (store.audioPreserved === false) return 'None found'
  return 'Will be copied'
})

const outputFilename = computed(() => {
  const name = store.video?.name || 'video.mp4'
  const lastDot = name.lastIndexOf('.')
  const base = lastDot > 0 ? name.slice(0, lastDot) : name
  return `${base}-${store.resolutionConfig.label}.mp4`
})

const downloadOutput = () => {
  if (!store.outputBlob) return
  const url = URL.createObjectURL(store.outputBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = outputFilename.value
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const handleUpgrade = async () => {
  if (!store.canUpgrade || !store.video) return

  try {
    store.setProcessing(true)
    store.setProgress(0)
    store.setStatusText('Loading FFmpeg...')

    await ffmpegService.load()

    const result = await ffmpegService.upgradeVideo(
      store.video.file,
      store.video.duration,
      store.resolutionConfig,
      (progress: number) => {
        store.setProgress(progress)
      },
      (status: string) => {
        store.setStatusText(status)
      }
    )

    store.setComplete(result.blob, result.audioPreserved)
    downloadOutput()
  } catch (error) {
    console.error('Upgrade error:', error)
    const message = error instanceof Error ? error.message : 'Upgrade failed'
    store.setError(message)
  }
}
</script>

<style scoped>
.upgrade-section {
  width: 100%;
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.upgrade-info {
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

.upgrade-btn {
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

.upgrade-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(100, 108, 255, 0.4);
}

.upgrade-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
  transform: none;
}

.upgrade-btn.processing {
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

.download-btn {
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

.download-btn:hover {
  background: rgba(100, 108, 255, 0.1);
}

.error-note {
  margin: 1rem 0 0 0;
  color: #cc0000;
  font-size: 0.9rem;
}

@media (prefers-color-scheme: dark) {
  .upgrade-section {
    background: #1a1a1a;
  }

  .status p,
  .value,
  .progress-text {
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
}
</style>
