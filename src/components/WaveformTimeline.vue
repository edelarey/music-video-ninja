<template>
  <div class="waveform-timeline">
    <div v-if="!store.hasMP3" class="no-mp3">
      <p>Upload an MP3 file to see the waveform</p>
    </div>
    <div v-else class="waveform-container">
      <div class="playback-controls">
        <button @click="togglePlayPause" class="control-btn play-btn" :title="isPlaying ? 'Pause' : 'Play'">
          <svg v-if="!isPlaying" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
          </svg>
        </button>
        <button @click="stop" class="control-btn" title="Stop">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h12v12H6z"/>
          </svg>
        </button>
        <div class="time-display">
          <span class="current-time">{{ formatDuration(currentTime) }}</span>
          <span class="separator">/</span>
          <span class="total-time">{{ formatDuration(store.mp3Duration) }}</span>
        </div>
        <div class="volume-control">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
          </svg>
          <input
            type="range"
            min="0"
            max="100"
            v-model="volume"
            @input="updateVolume"
            class="volume-slider"
          />
        </div>
      </div>
      
      <div ref="waveformRef" class="waveform"></div>
      
      <div class="timeline-info">
        <p>Duration: {{ formatDuration(store.mp3Duration) }}</p>
        <p v-if="store.clips.length > 0">
          Clips: {{ store.clips.length }} |
          Timeline Coverage: {{ formatDuration(store.totalClipsDuration) }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js'
import { useEditorStore } from '../stores/editor'

const store = useEditorStore()
const waveformRef = ref<HTMLDivElement | null>(null)
let wavesurfer: WaveSurfer | null = null
let regionsPlugin: RegionsPlugin | null = null

const isPlaying = ref(false)
const currentTime = ref(0)
const volume = ref(80)

const colors = [
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7',
  '#a29bfe', '#fd79a8', '#fdcb6e', '#00b894', '#e17055'
]

const initWavesurfer = () => {
  if (!waveformRef.value || !store.mp3File) return

  regionsPlugin = RegionsPlugin.create()

  wavesurfer = WaveSurfer.create({
    container: waveformRef.value,
    waveColor: '#646cff',
    progressColor: '#535bf2',
    cursorColor: '#213547',
    height: 128,
    barWidth: 2,
    barGap: 1,
    barRadius: 2,
    plugins: [regionsPlugin]
  })

  const url = URL.createObjectURL(store.mp3File)
  wavesurfer.load(url)

  wavesurfer.on('ready', () => {
    URL.revokeObjectURL(url)
    updateRegions()
    wavesurfer?.setVolume(volume.value / 100)
  })

  // Update playback state
  wavesurfer.on('play', () => {
    isPlaying.value = true
  })

  wavesurfer.on('pause', () => {
    isPlaying.value = false
  })

  wavesurfer.on('finish', () => {
    isPlaying.value = false
  })

  wavesurfer.on('timeupdate', (time) => {
    currentTime.value = time
  })

  // Handle region updates
  if (regionsPlugin) {
    regionsPlugin.on('region-updated', (region) => {
      const clipId = region.id
      const clip = store.clips.find(c => c.id === clipId)
      if (clip) {
        store.updateClipPosition(clipId, region.start, region.end)
      }
    })
  }
}

const togglePlayPause = () => {
  if (!wavesurfer) return
  
  if (isPlaying.value) {
    wavesurfer.pause()
  } else {
    wavesurfer.play()
  }
}

const stop = () => {
  if (!wavesurfer) return
  wavesurfer.stop()
  currentTime.value = 0
  isPlaying.value = false
}

const updateVolume = () => {
  if (!wavesurfer) return
  wavesurfer.setVolume(volume.value / 100)
}

const updateRegions = () => {
  if (!regionsPlugin) return

  // Clear existing regions
  regionsPlugin.clearRegions()

  // Add regions for each clip
  store.clips.forEach((clip, index) => {
    regionsPlugin?.addRegion({
      id: clip.id,
      start: clip.start,
      end: clip.end,
      color: colors[index % colors.length] + '40',
      drag: true,
      resize: true
    })
  })
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Watch for MP3 file changes
watch(() => store.mp3File, (newFile) => {
  if (wavesurfer) {
    wavesurfer.destroy()
    wavesurfer = null
  }
  if (newFile) {
    setTimeout(() => initWavesurfer(), 100)
  }
})

// Watch for clip changes
watch(() => store.clips.length, () => {
  if (wavesurfer) {
    updateRegions()
  }
}, { deep: true })

onMounted(() => {
  if (store.hasMP3) {
    initWavesurfer()
  }
})

onBeforeUnmount(() => {
  if (wavesurfer) {
    wavesurfer.destroy()
  }
})
</script>

<style scoped>
.waveform-timeline {
  width: 100%;
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.no-mp3 {
  text-align: center;
  padding: 3rem 1rem;
  color: #888;
}

.no-mp3 p {
  margin: 0;
  font-size: 1rem;
}

.waveform-container {
  width: 100%;
}

.playback-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: rgba(100, 108, 255, 0.05);
  border-radius: 8px;
  flex-wrap: wrap;
}

.control-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: #646cff;
  color: white;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.control-btn:hover {
  background: #535bf2;
  transform: scale(1.05);
}

.control-btn:active {
  transform: scale(0.95);
}

.play-btn {
  width: 48px;
  height: 48px;
}

.time-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: 'Courier New', monospace;
  font-size: 0.95rem;
  color: #213547;
  font-weight: 500;
  min-width: 120px;
}

.separator {
  color: #888;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
  color: #646cff;
}

.volume-slider {
  width: 100px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #ddd;
  border-radius: 2px;
  outline: none;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: #646cff;
  cursor: pointer;
  border-radius: 50%;
  transition: background 0.2s ease;
}

.volume-slider::-webkit-slider-thumb:hover {
  background: #535bf2;
}

.volume-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #646cff;
  cursor: pointer;
  border-radius: 50%;
  border: none;
  transition: background 0.2s ease;
}

.volume-slider::-moz-range-thumb:hover {
  background: #535bf2;
}

.waveform {
  width: 100%;
  margin-bottom: 1rem;
  cursor: pointer;
}

.timeline-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.5rem;
  border-top: 1px solid #e0e0e0;
  gap: 1rem;
  flex-wrap: wrap;
}

.timeline-info p {
  margin: 0;
  font-size: 0.9rem;
  color: #666;
}

@media (max-width: 768px) {
  .playback-controls {
    justify-content: center;
  }

  .volume-control {
    margin-left: 0;
    width: 100%;
    justify-content: center;
  }
}

@media (prefers-color-scheme: dark) {
  .waveform-timeline {
    background: #1a1a1a;
  }

  .playback-controls {
    background: rgba(100, 108, 255, 0.1);
  }

  .time-display {
    color: #fff;
  }

  .timeline-info {
    border-top-color: #333;
  }

  .timeline-info p {
    color: #aaa;
  }
}
</style>