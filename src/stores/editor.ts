import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface VideoSource {
  sourceId: string
  file: File
  duration: number
  color: string
}

export interface VideoClip {
  id: string
  sourceId: string
  start: number
  end: number
}

const CLIP_COLORS = [
  '#ff6b6b', '#f06595', '#cc5de8', '#845ef7', '#5c7cfa', '#339af0', '#22b8cf',
  '#20c997', '#51cf66', '#94d82d', '#fcc419', '#ff922b', '#ff6b6b', '#f783ac',
  '#da77f2', '#a55eea', '#748ffc', '#4dabf7', '#3bc9db', '#38d9a9', '#69db7c',
  '#b2f2bb', '#ffe066', '#ffc078', '#ff8787'
]

export const useEditorStore = defineStore('editor', () => {
  // State
  const mp3File = ref<File | null>(null)
  const mp3Duration = ref<number>(0)
  const videoSources = ref<VideoSource[]>([])
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
  const clipsWithSource = computed(() => {
    return clips.value.map(clip => {
      const source = videoSources.value.find(s => s.sourceId === clip.sourceId)
      return { ...clip, source }
    })
  })

  // Actions
  function setMP3(file: File | null, duration: number) {
    mp3File.value = file
    mp3Duration.value = duration
  }

  function addVideoSource(file: File, duration: number) {
    const newSourceColor = CLIP_COLORS[videoSources.value.length % CLIP_COLORS.length] || '#cccccc'
    const source: VideoSource = {
      sourceId: crypto.randomUUID(),
      file,
      duration,
      color: newSourceColor
    }
    videoSources.value.push(source)
    return source
  }

  function addClip(sourceId: string, start: number, end: number) {
    const clip: VideoClip = {
      id: crypto.randomUUID(),
      sourceId,
      start,
      end
    }
    clips.value.push(clip)
  }

  function removeVideoSource(sourceId: string) {
    videoSources.value = videoSources.value.filter(s => s.sourceId !== sourceId)
    clips.value = clips.value.filter(c => c.sourceId !== sourceId)
  }

  function updateClip(id: string, updates: Partial<Omit<VideoClip, 'id' | 'sourceId'>>) {
    const clip = clips.value.find(c => c.id === id)
    if (clip) {
      if (updates.start !== undefined) clip.start = updates.start
      if (updates.end !== undefined) clip.end = updates.end
    }
  }

  function removeClip(id: string) {
    clips.value = clips.value.filter(c => c.id !== id)
  }

  function updateClipPosition(id: string, start: number, end: number) {
    updateClip(id, { start, end })
  }

  function clearAll() {
    mp3File.value = null
    mp3Duration.value = 0
    videoSources.value = []
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
    videoSources,
    clips,
    isRendering,
    renderProgress,
    // Computed
    hasMP3,
    hasClips,
    canRender,
    totalClipsDuration,
    clipsWithSource,
    // Actions
    setMP3,
    addVideoSource,
    addClip,
    removeVideoSource,
    updateClip,
    removeClip,
    updateClipPosition,
    clearAll,
    setRendering,
    setRenderProgress
  }
})