import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type ConvertJobStatus = 'pending' | 'processing' | 'complete' | 'error'

export interface ConverterTrack {
  id: string
  file: File
  duration: number
  color: string
  name: string
  status: ConvertJobStatus
  progress: number
  statusText: string
  error?: string
  outputBlob?: Blob
}

const CLIP_COLORS = [
  '#ff6b6b', '#f06595', '#cc5de8', '#845ef7', '#5c7cfa', '#339af0', '#22b8cf',
  '#20c997', '#51cf66', '#94d82d', '#fcc419', '#ff922b', '#ff6b6b', '#f783ac',
  '#da77f2', '#a55eea', '#748ffc', '#4dabf7', '#3bc9db', '#38d9a9', '#69db7c',
  '#b2f2bb', '#ffe066', '#ffc078', '#ff8787'
]

export const useConverterStore = defineStore('converter', () => {
  const tracks = ref<ConverterTrack[]>([])
  const isProcessing = ref(false)
  const currentTrackId = ref<string | null>(null)

  const hasTracks = computed(() => tracks.value.length > 0)
  const canConvert = computed(() => hasTracks.value && !isProcessing.value)
  const completedCount = computed(
    () => tracks.value.filter((track) => track.status === 'complete').length
  )
  const errorCount = computed(
    () => tracks.value.filter((track) => track.status === 'error').length
  )
  const overallProgress = computed(() => {
    if (tracks.value.length === 0) return 0
    const total = tracks.value.reduce((sum, track) => {
      if (track.status === 'complete' || track.status === 'error') return sum + 100
      return sum + track.progress
    }, 0)
    return Math.round(total / tracks.value.length)
  })

  function addTrack(file: File, duration: number): ConverterTrack {
    const track: ConverterTrack = {
      id: crypto.randomUUID(),
      file,
      duration,
      color: CLIP_COLORS[tracks.value.length % CLIP_COLORS.length] || '#cccccc',
      name: file.name,
      status: 'pending',
      progress: 0,
      statusText: ''
    }
    tracks.value.push(track)
    return track
  }

  function removeTrack(id: string) {
    tracks.value = tracks.value.filter((track) => track.id !== id)
  }

  function setProcessing(value: boolean) {
    isProcessing.value = value
    if (!value) {
      currentTrackId.value = null
    }
  }

  function updateTrack(id: string, updates: Partial<Omit<ConverterTrack, 'id' | 'file'>>) {
    const track = tracks.value.find((item) => item.id === id)
    if (!track) return
    Object.assign(track, updates)
  }

  function resetJobStates() {
    tracks.value.forEach((track) => {
      track.status = 'pending'
      track.progress = 0
      track.statusText = ''
      track.error = undefined
      track.outputBlob = undefined
    })
  }

  function clearAll() {
    tracks.value = []
    isProcessing.value = false
    currentTrackId.value = null
  }

  return {
    tracks,
    isProcessing,
    currentTrackId,
    hasTracks,
    canConvert,
    completedCount,
    errorCount,
    overallProgress,
    addTrack,
    removeTrack,
    setProcessing,
    updateTrack,
    resetJobStates,
    clearAll
  }
})
