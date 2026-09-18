import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { RESOLUTION_MAP, scaleDirection, type Resolution } from '../const/resolutions'

export type UpgradeJobStatus = 'idle' | 'processing' | 'complete' | 'error'

export interface UpgradeVideo {
  file: File
  duration: number
  width: number
  height: number
  name: string
}

export const useUpgraderStore = defineStore('upgrader', () => {
  const video = ref<UpgradeVideo | null>(null)
  const selectedResolution = ref<Resolution>(1080)
  const isProcessing = ref(false)
  const progress = ref(0)
  const statusText = ref('')
  const status = ref<UpgradeJobStatus>('idle')
  const error = ref<string | null>(null)
  const outputBlob = ref<Blob | null>(null)
  const audioPreserved = ref<boolean | null>(null)

  const hasVideo = computed(() => video.value !== null)
  const resolutionConfig = computed(() => RESOLUTION_MAP[selectedResolution.value])
  const direction = computed(() => {
    if (!video.value) return 'same' as const
    return scaleDirection(video.value.height, resolutionConfig.value.height)
  })
  const alreadyAtTarget = computed(() => {
    if (!video.value) return false
    return video.value.width === resolutionConfig.value.width
      && video.value.height === resolutionConfig.value.height
  })
  const canUpgrade = computed(
    () => hasVideo.value && !isProcessing.value && !alreadyAtTarget.value
  )

  function setVideo(file: File, duration: number, width: number, height: number) {
    video.value = {
      file,
      duration,
      width,
      height,
      name: file.name
    }
    status.value = 'idle'
    progress.value = 0
    statusText.value = ''
    error.value = null
    outputBlob.value = null
    audioPreserved.value = null
  }

  function clearVideo() {
    video.value = null
    isProcessing.value = false
    progress.value = 0
    statusText.value = ''
    status.value = 'idle'
    error.value = null
    outputBlob.value = null
    audioPreserved.value = null
  }

  function setResolution(resolution: Resolution) {
    selectedResolution.value = resolution
    if (status.value === 'complete') {
      status.value = 'idle'
      outputBlob.value = null
      audioPreserved.value = null
      progress.value = 0
      statusText.value = ''
    }
  }

  function setProcessing(value: boolean) {
    isProcessing.value = value
    if (value) {
      status.value = 'processing'
      error.value = null
    }
  }

  function setProgress(value: number) {
    progress.value = value
  }

  function setStatusText(value: string) {
    statusText.value = value
  }

  function setComplete(blob: Blob, preserved: boolean) {
    outputBlob.value = blob
    audioPreserved.value = preserved
    progress.value = 100
    status.value = 'complete'
    isProcessing.value = false
    error.value = null
  }

  function setError(message: string) {
    error.value = message
    status.value = 'error'
    isProcessing.value = false
  }

  return {
    video,
    selectedResolution,
    isProcessing,
    progress,
    statusText,
    status,
    error,
    outputBlob,
    audioPreserved,
    hasVideo,
    resolutionConfig,
    direction,
    alreadyAtTarget,
    canUpgrade,
    setVideo,
    clearVideo,
    setResolution,
    setProcessing,
    setProgress,
    setStatusText,
    setComplete,
    setError
  }
})
