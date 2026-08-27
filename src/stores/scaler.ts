import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { RESOLUTION_MAP, type Resolution } from '../const/resolutions'

export type ScaleJobStatus = 'pending' | 'processing' | 'complete' | 'error' | 'skipped'

export interface ScalerVideo {
  id: string
  file: File
  duration: number
  width: number
  height: number
  color: string
  name: string
  status: ScaleJobStatus
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

export const useScalerStore = defineStore('scaler', () => {
  const videos = ref<ScalerVideo[]>([])
  const selectedResolution = ref<Resolution>(1080)
  const isProcessing = ref(false)
  const currentVideoId = ref<string | null>(null)

  const hasVideos = computed(() => videos.value.length > 0)
  const canScale = computed(() => hasVideos.value && !isProcessing.value)
  const resolutionConfig = computed(() => RESOLUTION_MAP[selectedResolution.value])
  const completedCount = computed(
    () => videos.value.filter((v) => v.status === 'complete' || v.status === 'skipped').length
  )
  const errorCount = computed(() => videos.value.filter((v) => v.status === 'error').length)
  const overallProgress = computed(() => {
    if (videos.value.length === 0) return 0
    const total = videos.value.reduce((sum, video) => {
      if (video.status === 'complete' || video.status === 'skipped') return sum + 100
      if (video.status === 'error') return sum + 100
      return sum + video.progress
    }, 0)
    return Math.round(total / videos.value.length)
  })

  function addVideo(file: File, duration: number, width: number, height: number): ScalerVideo {
    const video: ScalerVideo = {
      id: crypto.randomUUID(),
      file,
      duration,
      width,
      height,
      color: CLIP_COLORS[videos.value.length % CLIP_COLORS.length] || '#cccccc',
      name: file.name,
      status: 'pending',
      progress: 0,
      statusText: ''
    }
    videos.value.push(video)
    return video
  }

  function removeVideo(id: string) {
    videos.value = videos.value.filter((v) => v.id !== id)
  }

  function setResolution(resolution: Resolution) {
    selectedResolution.value = resolution
  }

  function setProcessing(value: boolean) {
    isProcessing.value = value
    if (!value) {
      currentVideoId.value = null
    }
  }

  function updateVideo(id: string, updates: Partial<Omit<ScalerVideo, 'id' | 'file'>>) {
    const video = videos.value.find((v) => v.id === id)
    if (!video) return
    Object.assign(video, updates)
  }

  function resetJobStates() {
    videos.value.forEach((video) => {
      video.status = 'pending'
      video.progress = 0
      video.statusText = ''
      video.error = undefined
      video.outputBlob = undefined
    })
  }

  function clearAll() {
    videos.value = []
    selectedResolution.value = 1080
    isProcessing.value = false
    currentVideoId.value = null
  }

  return {
    videos,
    selectedResolution,
    isProcessing,
    currentVideoId,
    hasVideos,
    canScale,
    resolutionConfig,
    completedCount,
    errorCount,
    overallProgress,
    addVideo,
    removeVideo,
    setResolution,
    setProcessing,
    updateVideo,
    resetJobStates,
    clearAll
  }
})
