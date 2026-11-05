import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  analyzeWavBuffer,
  cancelHarmonicWork,
  renderWavBuffer,
  type RenderedWavBuffer
} from '@/services/harmonic/client'
import {
  VERSION_IDS,
  outputFilename,
  type KeyResult,
  type MusicalMode,
  type VersionId
} from '@/services/harmonic/constants'
import { readWavInfo } from '@/services/harmonic/wav'

export interface HarmonicResult {
  version: VersionId
  filename: string
  url: string
  peakDb: number
  frames: number
  sampleRate: number
  channels: number
  duration: number
}

function isCancel(error: unknown): boolean {
  return error instanceof Error && error.message === 'Cancelled'
}

export const useHarmonicStore = defineStore('harmonic', () => {
  const file = ref<File | null>(null)
  const originalUrl = ref<string | null>(null)
  const sampleRate = ref<number | null>(null)
  const sourceChannels = ref<number | null>(null)
  const frames = ref<number | null>(null)

  const selected = ref<Record<VersionId, boolean>>({
    ptt: true,
    shimmer: true,
    drone: true
  })
  const tempoLocked = ref(true)

  const detectedKey = ref<KeyResult | null>(null)
  const overrideEnabled = ref(false)
  const overrideTonic = ref(0)
  const overrideMode = ref<MusicalMode>('major')

  const isAnalyzing = ref(false)
  const analyzeProgress = ref(0)
  const analyzeStatus = ref('')
  const analyzeError = ref<string | null>(null)

  const isRendering = ref(false)
  const renderError = ref<string | null>(null)
  const progress = ref<Record<VersionId, number>>({ ptt: 0, shimmer: 0, drone: 0 })
  const statusText = ref<Record<VersionId, string>>({ ptt: '', shimmer: '', drone: '' })
  const results = ref<Partial<Record<VersionId, HarmonicResult>>>({})

  let loadToken = 0
  let renderToken = 0

  const duration = computed(() => {
    if (!sampleRate.value || !frames.value) return 0
    return frames.value / sampleRate.value
  })

  const allSelected = computed(() => VERSION_IDS.every((id) => selected.value[id]))
  const someSelected = computed(() => VERSION_IDS.some((id) => selected.value[id]))
  const selectedIds = computed(() => VERSION_IDS.filter((id) => selected.value[id]))

  const effectiveTonic = computed(() =>
    overrideEnabled.value ? overrideTonic.value : (detectedKey.value?.tonic ?? 0)
  )
  const effectiveMode = computed<MusicalMode>(() =>
    overrideEnabled.value ? overrideMode.value : (detectedKey.value?.mode ?? 'major')
  )

  const orderedResults = computed(() =>
    VERSION_IDS.flatMap((id) => {
      const result = results.value[id]
      return result ? [result] : []
    })
  )

  const canRender = computed(
    () =>
      !!file.value &&
      !isRendering.value &&
      !isAnalyzing.value &&
      detectedKey.value !== null &&
      selectedIds.value.length > 0 &&
      !analyzeError.value
  )

  function revokeResults() {
    for (const result of Object.values(results.value)) {
      if (result) URL.revokeObjectURL(result.url)
    }
    results.value = {}
  }

  function resetProgress() {
    progress.value = { ptt: 0, shimmer: 0, drone: 0 }
    statusText.value = { ptt: '', shimmer: '', drone: '' }
  }

  function setVersion(id: VersionId, value: boolean) {
    selected.value = { ...selected.value, [id]: value }
  }

  function setAll(value: boolean) {
    selected.value = { ptt: value, shimmer: value, drone: value }
  }

  function chooseTonic(tonic: number) {
    overrideTonic.value = ((tonic % 12) + 12) % 12
    overrideEnabled.value = true
  }

  function chooseMode(mode: MusicalMode) {
    overrideMode.value = mode
    overrideEnabled.value = true
  }

  function resetKey() {
    overrideEnabled.value = false
    if (detectedKey.value) {
      overrideTonic.value = detectedKey.value.tonic
      overrideMode.value = detectedKey.value.mode
    }
  }

  function clearFile() {
    loadToken += 1
    renderToken += 1
    cancelHarmonicWork()
    revokeResults()
    if (originalUrl.value) URL.revokeObjectURL(originalUrl.value)
    file.value = null
    originalUrl.value = null
    sampleRate.value = null
    sourceChannels.value = null
    frames.value = null
    detectedKey.value = null
    overrideEnabled.value = false
    isAnalyzing.value = false
    isRendering.value = false
    analyzeError.value = null
    renderError.value = null
    analyzeProgress.value = 0
    analyzeStatus.value = ''
    resetProgress()
  }

  async function loadFile(next: File) {
    const token = ++loadToken
    renderToken += 1
    cancelHarmonicWork()
    revokeResults()
    resetProgress()
    if (originalUrl.value) URL.revokeObjectURL(originalUrl.value)

    file.value = next
    originalUrl.value = URL.createObjectURL(next)
    sampleRate.value = null
    sourceChannels.value = null
    frames.value = null
    detectedKey.value = null
    overrideEnabled.value = false
    analyzeError.value = null
    renderError.value = null
    isAnalyzing.value = true
    analyzeProgress.value = 0
    analyzeStatus.value = 'Reading the WAV'

    try {
      const buffer = await next.arrayBuffer()
      if (token !== loadToken) return
      const info = readWavInfo(new Uint8Array(buffer))
      sampleRate.value = info.sampleRate
      sourceChannels.value = info.channels
      frames.value = info.frames
      const analyzed = await analyzeWavBuffer(buffer, (value, status) => {
        if (token !== loadToken) return
        analyzeProgress.value = value
        analyzeStatus.value = status
      })
      if (token !== loadToken) return
      detectedKey.value = analyzed.key
      overrideTonic.value = analyzed.key.tonic
      overrideMode.value = analyzed.key.mode
      analyzeProgress.value = 100
      analyzeStatus.value = 'Key found'
    } catch (error) {
      if (token !== loadToken || isCancel(error)) return
      analyzeError.value = error instanceof Error ? error.message : 'Could not read that WAV.'
      detectedKey.value = null
    } finally {
      if (token === loadToken) isAnalyzing.value = false
    }
  }

  function storeResult(rendered: RenderedWavBuffer) {
    const current = file.value
    if (!current) return
    const blob = new Blob([rendered.buffer], { type: 'audio/wav' })
    const url = URL.createObjectURL(blob)
    const previous = results.value[rendered.version]
    if (previous) URL.revokeObjectURL(previous.url)
    results.value = {
      ...results.value,
      [rendered.version]: {
        version: rendered.version,
        filename: outputFilename(current.name, rendered.version),
        url,
        peakDb: rendered.peakDb,
        frames: rendered.frames,
        sampleRate: rendered.sampleRate,
        channels: rendered.channels,
        duration: rendered.frames / rendered.sampleRate
      }
    }
  }

  async function render() {
    const current = file.value
    const key = detectedKey.value
    if (!current || !key || selectedIds.value.length === 0 || isAnalyzing.value) return

    const token = ++renderToken
    const versions = [...selectedIds.value]
    const tonic = effectiveTonic.value
    const mode = effectiveMode.value
    const locked = tempoLocked.value

    revokeResults()
    resetProgress()
    renderError.value = null
    isRendering.value = true
    for (const id of versions) {
      statusText.value[id] = 'Queued'
    }

    try {
      const buffer = await current.arrayBuffer()
      if (token !== renderToken) return
      await renderWavBuffer(
        buffer,
        { versions, tempoLocked: locked, tonic, mode },
        (version, value, status) => {
          if (token !== renderToken) return
          progress.value[version] = value
          statusText.value[version] = status
        },
        (rendered) => {
          if (token !== renderToken) return
          storeResult(rendered)
        }
      )
    } catch (error) {
      if (token !== renderToken || isCancel(error)) return
      renderError.value = error instanceof Error ? error.message : 'Rendering failed.'
    } finally {
      if (token === renderToken) isRendering.value = false
    }
  }

  return {
    file,
    originalUrl,
    sampleRate,
    sourceChannels,
    frames,
    duration,
    selected,
    tempoLocked,
    detectedKey,
    overrideEnabled,
    effectiveTonic,
    effectiveMode,
    isAnalyzing,
    analyzeProgress,
    analyzeStatus,
    analyzeError,
    isRendering,
    renderError,
    progress,
    statusText,
    results,
    orderedResults,
    allSelected,
    someSelected,
    selectedIds,
    canRender,
    setVersion,
    setAll,
    chooseTonic,
    chooseMode,
    resetKey,
    clearFile,
    loadFile,
    render
  }
})
