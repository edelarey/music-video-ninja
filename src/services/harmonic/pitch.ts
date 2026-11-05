import { resampleChannel } from './resample'
import { timeStretch } from './wsola'

export interface PitchShiftOptions {
  /** Output pitch / input pitch. Values below 1 lower the pitch. */
  ratio: number
  /**
   * When true, waveform-locked WSOLA restores the original duration after the
   * sinc resample. When false, the buffer is pure tape varispeed: pitch and
   * tempo move together and nothing is time-stretched.
   */
  tempoLocked: boolean
  /** Exact frame count to land on when tempo-locked. Defaults to the input length. */
  targetFrames?: number
  onProgress?: (progress: number) => void
}

/**
 * Tempo-locked pitch shift for a small musical interval.
 *
 * ffmpeg.wasm in this project can approximate the same move with
 * `asetrate` + `aresample` + `atempo`, but that core does not include Rubber
 * Band, `atempo` is a coarser WSOLA inside the wasm heap, and a full-length
 * stereo WAV is the wrong thing to push through it. The resample here is
 * band-limited, the time correction only has to undo about 1.8%, and both
 * channels stay sample-locked. The worker that calls this keeps the UI thread
 * free.
 */
export function pitchShift(
  channels: Float32Array[],
  sampleRate: number,
  options: PitchShiftOptions
): Float32Array[] {
  const step = options.ratio
  if (!(step > 0) || !Number.isFinite(step)) {
    throw new Error('Pitch ratio must be a positive finite number.')
  }

  const channelCount = channels.length
  const resampled = channels.map((channel, index) =>
    resampleChannel(channel, step, (progress) => {
      const span = options.tempoLocked ? 0.72 : 1
      const base = index / channelCount
      options.onProgress?.((base + progress / channelCount) * span)
    })
  )

  if (!options.tempoLocked) {
    options.onProgress?.(1)
    return resampled
  }

  const target = options.targetFrames ?? channels[0]?.length ?? 0
  return timeStretch(resampled, target, sampleRate, (progress) => {
    options.onProgress?.(0.72 + progress * 0.28)
  })
}
