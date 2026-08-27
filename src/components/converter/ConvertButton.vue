<template>
  <div class="convert-section">
    <div class="convert-info">
      <div class="status">
        <p v-if="!store.hasTracks">
          <span class="icon">ℹ️</span> Upload WAV files to begin
        </p>
        <p v-else-if="store.canConvert">
          <span class="icon">✅</span> Ready to convert {{ store.tracks.length }} file{{ store.tracks.length === 1 ? '' : 's' }} to MP3
        </p>
        <p v-else-if="store.isProcessing">
          <span class="icon">⏳</span> Encoding batch…
        </p>
      </div>

      <div v-if="store.hasTracks" class="summary">
        <div class="summary-item">
          <span class="label">Files:</span>
          <span class="value">{{ store.tracks.length }}</span>
        </div>
        <div class="summary-item">
          <span class="label">Codec:</span>
          <span class="value">libmp3lame</span>
        </div>
        <div class="summary-item">
          <span class="label">Done:</span>
          <span class="value">{{ store.completedCount }}/{{ store.tracks.length }}</span>
        </div>
      </div>
    </div>

    <button
      @click="handleConvert"
      :disabled="!store.canConvert"
      class="convert-btn"
      :class="{ processing: store.isProcessing }"
    >
      <span v-if="!store.isProcessing">🎵 Convert to MP3</span>
      <span v-else>
        <span class="spinner"></span>
        {{ batchStatus }}
      </span>
    </button>

    <div v-if="store.isProcessing || store.completedCount > 0 || store.errorCount > 0" class="progress-bar">
      <div class="progress-fill" :style="{ width: `${store.overallProgress}%` }"></div>
      <span class="progress-text">{{ store.overallProgress }}%</span>
    </div>

    <ul v-if="store.hasTracks" class="job-list">
      <li
        v-for="track in store.tracks"
        :key="track.id"
        class="job-item"
        :class="track.status"
      >
        <div class="job-main">
          <span class="job-name">{{ track.name }}</span>
          <span class="job-meta">{{ statusLabel(track) }}</span>
        </div>
        <div v-if="track.status === 'processing'" class="job-progress">
          <div class="job-progress-fill" :style="{ width: `${track.progress}%` }"></div>
        </div>
        <button
          v-if="track.outputBlob && track.status === 'complete'"
          class="job-download"
          @click="downloadTrack(track)"
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
      {{ store.errorCount }} file{{ store.errorCount === 1 ? '' : 's' }} failed. Check the list and try again.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useConverterStore, type ConverterTrack } from '../../stores/converter'
import { ffmpegService } from '@/services/ffmpegService.js'

const store = useConverterStore()
const batchStatus = ref('Preparing...')

const outputFilename = (name: string): string => {
  return name.replace(/\.(wav|wave)$/i, '') + '.mp3'
}

const downloadTrack = (track: ConverterTrack) => {
  if (!track.outputBlob) return
  const url = URL.createObjectURL(track.outputBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = outputFilename(track.name)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const downloadAll = async () => {
  for (const track of store.tracks) {
    if (track.outputBlob && track.status === 'complete') {
      downloadTrack(track)
      await new Promise((resolve) => setTimeout(resolve, 350))
    }
  }
}

const statusLabel = (track: ConverterTrack): string => {
  if (track.status === 'pending') return 'Waiting'
  if (track.status === 'processing') {
    return track.statusText ? `${track.statusText} (${track.progress}%)` : `${track.progress}%`
  }
  if (track.status === 'complete') return 'Complete'
  return track.error || 'Failed'
}

const handleConvert = async () => {
  if (!store.canConvert) return

  try {
    store.resetJobStates()
    store.setProcessing(true)
    batchStatus.value = 'Loading FFmpeg...'

    await ffmpegService.load()

    const queue = [...store.tracks]

    for (let i = 0; i < queue.length; i++) {
      const track = queue[i]
      if (!track) continue

      store.currentTrackId = track.id
      batchStatus.value = `File ${i + 1}/${queue.length}: ${track.name}`

      store.updateTrack(track.id, {
        status: 'processing',
        progress: 0,
        statusText: 'Starting...'
      })

      try {
        const blob = await ffmpegService.convertWavToMp3(
          track.file,
          track.duration,
          (progress: number) => {
            store.updateTrack(track.id, { progress })
          },
          (status: string) => {
            store.updateTrack(track.id, { statusText: status })
            batchStatus.value = `File ${i + 1}/${queue.length}: ${status}`
          }
        )

        store.updateTrack(track.id, {
          status: 'complete',
          progress: 100,
          statusText: 'Complete',
          outputBlob: blob
        })
      } catch (error) {
        console.error(`Convert error for ${track.name}:`, error)
        const message = error instanceof Error ? error.message : 'Convert failed'
        store.updateTrack(track.id, {
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
    console.error('Batch convert error:', error)
    alert('Error converting files. Check console for details.')
    store.setProcessing(false)
  }
}
</script>

<style scoped>
.convert-section {
  width: 100%;
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.convert-info {
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

.convert-btn {
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

.convert-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(100, 108, 255, 0.4);
}

.convert-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
  transform: none;
}

.convert-btn.processing {
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

.job-item.complete {
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
  .convert-section {
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
