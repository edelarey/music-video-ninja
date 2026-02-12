import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface VideoSource {
  sourceId: string
  file: File
  duration: number
  color: string
  name: string
}

export interface TimelineClip {
  id: string
  sourceId: string
  order: number
}

export type Resolution = 144 | 240 | 360 | 480 | 720 | 1080

export interface ResolutionConfig {
  label: string
  width: number
  height: number
}

export const RESOLUTION_MAP: Record<Resolution, ResolutionConfig> = {
  144: { label: '144p', width: 256, height: 144 },
  240: { label: '240p', width: 426, height: 240 },
  360: { label: '360p', width: 640, height: 360 },
  480: { label: '480p', width: 854, height: 480 },
  720: { label: '720p', width: 1280, height: 720 },
  1080: { label: '1080p', width: 1920, height: 1080 }
}

const CLIP_COLORS = [
  '#ff6b6b', '#f06595', '#cc5de8', '#845ef7', '#5c7cfa', '#339af0', '#22b8cf',
  '#20c997', '#51cf66', '#94d82d', '#fcc419', '#ff922b', '#ff6b6b', '#f783ac',
  '#da77f2', '#a55eea', '#748ffc', '#4dabf7', '#3bc9db', '#38d9a9', '#69db7c',
  '#b2f2bb', '#ffe066', '#ffc078', '#ff8787'
]

export const useCombinerStore = defineStore('combiner', () => {
  // State
  const videoSources = ref<VideoSource[]>([])
  const timelineClips = ref<TimelineClip[]>([])
  const selectedResolution = ref<Resolution>(720)
  const isProcessing = ref<boolean>(false)
  const processProgress = ref<number>(0)

  // Computed
  const hasVideoSources = computed(() => videoSources.value.length > 0)
  const hasTimelineClips = computed(() => timelineClips.value.length > 0)
  const canCombine = computed(() => hasTimelineClips.value && !isProcessing.value)
  
  const sortedTimelineClips = computed(() => 
    [...timelineClips.value].sort((a, b) => a.order - b.order)
  )

  const timelineClipsWithSource = computed(() => {
    return sortedTimelineClips.value.map(clip => {
      const source = videoSources.value.find(s => s.sourceId === clip.sourceId)
      return { ...clip, source }
    })
  })

  const totalDuration = computed(() => {
    return timelineClipsWithSource.value.reduce((sum, clip) => {
      return sum + (clip.source?.duration || 0)
    }, 0)
  })

  const resolutionConfig = computed(() => RESOLUTION_MAP[selectedResolution.value])

  // Actions
  function addVideoSource(file: File, duration: number): VideoSource {
    const newSourceColor = CLIP_COLORS[videoSources.value.length % CLIP_COLORS.length] || '#cccccc'
    const source: VideoSource = {
      sourceId: crypto.randomUUID(),
      file,
      duration,
      color: newSourceColor,
      name: file.name
    }
    videoSources.value.push(source)
    return source
  }

  function removeVideoSource(sourceId: string) {
    videoSources.value = videoSources.value.filter(s => s.sourceId !== sourceId)
    // Also remove all timeline clips referencing this source
    timelineClips.value = timelineClips.value.filter(c => c.sourceId !== sourceId)
    // Reorder remaining clips
    reindexTimeline()
  }

  function addToTimeline(sourceId: string): TimelineClip {
    const clip: TimelineClip = {
      id: crypto.randomUUID(),
      sourceId,
      order: timelineClips.value.length
    }
    timelineClips.value.push(clip)
    return clip
  }

  function insertAtPosition(sourceId: string, position: number): TimelineClip {
    const clip: TimelineClip = {
      id: crypto.randomUUID(),
      sourceId,
      order: position
    }
    // Shift all clips at or after this position
    timelineClips.value.forEach(c => {
      if (c.order >= position) {
        c.order++
      }
    })
    timelineClips.value.push(clip)
    return clip
  }

  function removeFromTimeline(clipId: string) {
    timelineClips.value = timelineClips.value.filter(c => c.id !== clipId)
    reindexTimeline()
  }

  function reorderTimeline(fromIndex: number, toIndex: number) {
    const clips = sortedTimelineClips.value
    if (fromIndex < 0 || fromIndex >= clips.length || toIndex < 0 || toIndex >= clips.length) {
      return
    }

    const movedClip = clips[fromIndex]
    if (!movedClip) return

    // Remove from original position
    clips.splice(fromIndex, 1)
    // Insert at new position
    clips.splice(toIndex, 0, movedClip)

    // Update order values
    clips.forEach((clip, index) => {
      const originalClip = timelineClips.value.find(c => c.id === clip.id)
      if (originalClip) {
        originalClip.order = index
      }
    })
  }

  function reindexTimeline() {
    const sorted = sortedTimelineClips.value
    sorted.forEach((clip, index) => {
      const originalClip = timelineClips.value.find(c => c.id === clip.id)
      if (originalClip) {
        originalClip.order = index
      }
    })
  }

  function setResolution(resolution: Resolution) {
    selectedResolution.value = resolution
  }

  function setProcessing(value: boolean) {
    isProcessing.value = value
    if (!value) {
      processProgress.value = 0
    }
  }

  function setProcessProgress(value: number) {
    processProgress.value = value
  }

  function clearAll() {
    videoSources.value = []
    timelineClips.value = []
    selectedResolution.value = 720
    isProcessing.value = false
    processProgress.value = 0
  }

  function clearTimeline() {
    timelineClips.value = []
  }

  return {
    // State
    videoSources,
    timelineClips,
    selectedResolution,
    isProcessing,
    processProgress,
    // Computed
    hasVideoSources,
    hasTimelineClips,
    canCombine,
    sortedTimelineClips,
    timelineClipsWithSource,
    totalDuration,
    resolutionConfig,
    // Actions
    addVideoSource,
    removeVideoSource,
    addToTimeline,
    insertAtPosition,
    removeFromTimeline,
    reorderTimeline,
    setResolution,
    setProcessing,
    setProcessProgress,
    clearAll,
    clearTimeline
  }
})
