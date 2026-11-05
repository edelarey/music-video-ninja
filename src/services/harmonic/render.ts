import {
  DRONE_LEVEL_DB,
  PEAK_CEILING_DB,
  PTT_RATIO,
  SHIMMER_HP_HZ,
  SHIMMER_LEVEL_DB,
  SHIMMER_LP_HZ,
  SHIMMER_RATIO,
  SHIMMER_TAP_MS,
  type KeyResult,
  type MusicalMode,
  type VersionId
} from './constants'
import { synthesizeDrone } from './drone'
import { detectKey } from './fft'
import {
  allpassInPlace,
  applyButterworth4,
  applyRelativeEnvelope,
  channelRms,
  cloneChannels,
  fadeEdges,
  matchLoudnessAndLimit,
  mixInto,
  multiTap,
  peakDb,
  widenStereo
} from './filters'
import { pitchShift } from './pitch'
import { decodeWav, encodeWav, type DecodedAudio } from './wav'

export interface InspectedWav {
  sampleRate: number
  channels: number
  frames: number
  key: KeyResult
}

export interface RenderedVersion {
  version: VersionId
  bytes: Uint8Array
  peakDb: number
  frames: number
  sampleRate: number
  channels: number
}

export interface RenderOptions {
  versions: VersionId[]
  tempoLocked: boolean
  tonic: number
  mode: MusicalMode
  onProgress?: (version: VersionId, progress: number, status: string) => void
  onVersion?: (rendered: RenderedVersion) => void
}

const LEFT_TAP_MS = SHIMMER_TAP_MS
const RIGHT_TAP_MS = [58, 96, 134, 171, 188] as const
const TAP_GAINS = [0.42, 0.26, 0.16, 0.1, 0.06] as const
const LEFT_ALLPASS_MS = [3.1, 5.9, 9.7] as const
const RIGHT_ALLPASS_MS = [4.4, 7.3, 11.5] as const

export function inspectWav(bytes: Uint8Array, onProgress?: (progress: number, status: string) => void): InspectedWav {
  onProgress?.(0.05, 'Reading the WAV header')
  const audio = decodeWav(bytes)
  onProgress?.(0.15, 'Measuring pitch-class chroma')
  const key = detectKey(audio, (progress) => {
    onProgress?.(0.15 + progress * 0.85, 'Matching Krumhansl–Schmuckler profiles')
  })
  const frames = audio.channels[0]?.length ?? 0
  return {
    sampleRate: audio.sampleRate,
    channels: audio.channels.length,
    frames,
    key
  }
}

function upmixStereo(channels: Float32Array[]): Float32Array[] {
  if (channels.length === 1) {
    return [new Float32Array(channels[0]!), new Float32Array(channels[0]!)]
  }
  if (channels.length > 2) return [new Float32Array(channels[0]!), new Float32Array(channels[1]!)]
  return channels
}

function selected(options: RenderOptions, version: VersionId): boolean {
  return options.versions.includes(version)
}

function report(options: RenderOptions, version: VersionId, progress: number, status: string) {
  options.onProgress?.(version, Math.max(0, Math.min(100, Math.round(progress))), status)
}

function finishVersion(
  version: VersionId,
  channels: Float32Array[],
  sampleRate: number,
  referenceRms: number,
  options: RenderOptions
): void {
  report(options, version, 96, 'Matching loudness and holding the −1 dBFS ceiling')
  const peak = matchLoudnessAndLimit(channels, referenceRms)
  const bytes = encodeWav(channels, sampleRate)
  report(options, version, 100, 'Ready')
  options.onVersion?.({
    version,
    bytes,
    peakDb: Math.min(peakDb(peak), PEAK_CEILING_DB),
    frames: channels[0]?.length ?? 0,
    sampleRate,
    channels: channels.length
  })
}

function diffuseChannel(input: Float32Array, sampleRate: number, allpassMs: readonly number[], tapMs: readonly number[]): Float32Array {
  const colored = new Float32Array(input)
  applyButterworth4(colored, 'highpass', SHIMMER_HP_HZ, sampleRate)
  applyButterworth4(colored, 'lowpass', SHIMMER_LP_HZ, sampleRate)
  for (const ms of allpassMs) {
    allpassInPlace(colored, Math.max(1, Math.round((ms * sampleRate) / 1000)), 0.55)
  }
  const taps = multiTap(colored, sampleRate, tapMs, TAP_GAINS)
  const wet = new Float32Array(colored.length)
  for (let i = 0; i < colored.length; i++) wet[i] = colored[i]! * 0.22 + taps[i]! * 0.78
  return wet
}

function buildShimmer(
  dry: Float32Array[],
  sampleRate: number,
  onProgress: (progress: number) => void
): Float32Array[] {
  const shifted = pitchShift(dry, sampleRate, {
    ratio: SHIMMER_RATIO,
    tempoLocked: true,
    targetFrames: dry[0]?.length ?? 0,
    onProgress: (progress) => onProgress(progress * 0.8)
  })
  onProgress(0.84)
  const wet = [
    diffuseChannel(shifted[0] ?? new Float32Array(), sampleRate, LEFT_ALLPASS_MS, LEFT_TAP_MS),
    diffuseChannel(shifted[1] ?? shifted[0] ?? new Float32Array(), sampleRate, RIGHT_ALLPASS_MS, RIGHT_TAP_MS)
  ]
  if (dry.length < 2) wet.splice(1)
  widenStereo(wet, 1.5, 1)
  applyRelativeEnvelope(dry, wet, SHIMMER_LEVEL_DB, sampleRate)
  fadeEdges(wet, Math.round(0.008 * sampleRate))
  onProgress(1)
  return wet
}

export function renderVersions(bytes: Uint8Array, options: RenderOptions): void {
  if (options.versions.length === 0) throw new Error('Pick at least one version to render.')

  const audio: DecodedAudio = decodeWav(bytes)
  const sampleRate = audio.sampleRate
  const referenceRms = channelRms(audio.channels)
  const source = upmixStereo(audio.channels)
  const targetFrames = source[0]?.length ?? 0
  const active = options.versions

  const base = pitchShift(source, sampleRate, {
    ratio: PTT_RATIO,
    tempoLocked: options.tempoLocked,
    targetFrames,
    onProgress: (progress) => {
      for (const version of active) {
        const span = version === 'ptt' ? 90 : version === 'shimmer' ? 34 : 40
        const status = options.tempoLocked
          ? 'Retuning the lattice to 432.081 Hz, tempo locked'
          : 'Tape varispeed toward 432.081 Hz'
        report(options, version, progress * span, status)
      }
    }
  })
  source.length = 0
  audio.channels = []

  if (selected(options, 'ptt')) {
    finishVersion('ptt', cloneChannels(base), sampleRate, referenceRms, options)
  }

  if (selected(options, 'shimmer')) {
    report(options, 'shimmer', 36, 'Building the 528.099 Hz quarter-tone halo')
    const wet = buildShimmer(base, sampleRate, (progress) => {
      const status = progress < 0.8
        ? 'Pitching the halo a quarter-tone toward 528.099 Hz'
        : 'Diffusing and widening the halo'
      report(options, 'shimmer', 36 + progress * 56, status)
    })
    const mix = cloneChannels(base)
    mixInto(mix, wet)
    finishVersion('shimmer', mix, sampleRate, referenceRms, options)
  }

  if (selected(options, 'drone')) {
    report(options, 'drone', 42, 'Synthesizing the chakra drone')
    const frames = base[0]?.length ?? 0
    const drone = synthesizeDrone(frames, sampleRate, options.tonic, options.mode, (progress) => {
      report(options, 'drone', 42 + progress * 36, 'Voicing just ratios under the tonic')
    })
    if (base.length < 2) drone.splice(1)
    applyRelativeEnvelope(base, drone, DRONE_LEVEL_DB, sampleRate)
    const mix = cloneChannels(base)
    mixInto(mix, drone)
    finishVersion('drone', mix, sampleRate, referenceRms, options)
  }
}
