import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface VideoClip {
  id: string
  file: File
  start: number
  end: number
  duration: number
}

export const useEditorStore = defineStore('editor', () => {
  // State
  const mp3File = ref<File | null>(null)
  const mp3Duration = ref<number>(0)
  const clips = ref<VideoClip[]>([])
  const isRendering = ref<boolean>(false)
  const renderProgress = ref<number>(0)

  // Computed
  const hasMP3 = computed(() => mp3File.value !== null)
  const hasClips = computed(() => clips.value.length > 0)
  const canRender = computed(() => hasMP3.value && hasClips.value && !isRendering.value)
  const totalClipsDuration = computed(() => 
    clips.value.reduce((sum, clip) => sum + (clip.end - clip.start), 0)
  )

  // Actions
  function setMP3(file: File | null, duration: number) {
    mp3File.value = file
    mp3Duration.value = duration
  }

  function addClip(file: File, start: number, end: number) {
    const clip: VideoClip = {
      id: crypto.randomUUID(),
      file,
      start,
      end,
      duration: 0 // Will be set after video metadata loads
    }
    clips.value.push(clip)
  }

  function updateClip(id: string, updates: Partial<Omit<VideoClip, 'id' | 'file'>>) {
    const clip = clips.value.find(c => c.id === id)
    if (clip) {
      if (updates.start !== undefined) clip.start = updates.start
      if (updates.end !== undefined) clip.end = updates.end
      if (updates.duration !== undefined) clip.duration = updates.duration
    }
  }

  function removeClip(id: string) {
    clips.value = clips.value.filter(c => c.id !== id)
  }

  function updateClipPosition(id: string, start: number, end: number) {
    updateClip(id, { start, end })
  }

  function setClipDuration(id: string, duration: number) {
    updateClip(id, { duration })
  }

  function clearAll() {
    mp3File.value = null
    mp3Duration.value = 0
    clips.value = []
    isRendering.value = false
    renderProgress.value = 0
  }

  function setRendering(value: boolean) {
    isRendering.value = value
    if (!value) {
      renderProgress.value = 0
    }
  }

  function setRenderProgress(value: number) {
    renderProgress.value = value
  }

  return {
    // State
    mp3File,
    mp3Duration,
    clips,
    isRendering,
    renderProgress,
    // Computed
    hasMP3,
    hasClips,
    canRender,
    totalClipsDuration,
    // Actions
    setMP3,
    addClip,
    updateClip,
    removeClip,
    updateClipPosition,
    setClipDuration,
    clearAll,
    setRendering,
    setRenderProgress
  }
})