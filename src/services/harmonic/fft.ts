import {
  KS_MAJOR,
  KS_MINOR,
  type KeyCandidate,
  type KeyResult,
  type MusicalMode
} from './constants'
import type { DecodedAudio } from './wav'

/** In-place radix-2 Cooley–Tukey FFT. `re` and `im` must share a power-of-two length. */
export function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tr = re[i]!
      re[i] = re[j]!
      re[j] = tr
      const ti = im[i]!
      im[i] = im[j]!
      im[j] = ti
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1
    const ang = (-2 * Math.PI) / len
    const wlenRe = Math.cos(ang)
    const wlenIm = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let wRe = 1
      let wIm = 0
      for (let k = 0; k < half; k++) {
        const even = i + k
        const odd = even + half
        const uRe = re[even]!
        const uIm = im[even]!
        const oRe = re[odd]!
        const oIm = im[odd]!
        const vRe = oRe * wRe - oIm * wIm
        const vIm = oRe * wIm + oIm * wRe
        re[even] = uRe + vRe
        im[even] = uIm + vIm
        re[odd] = uRe - vRe
        im[odd] = uIm - vIm
        const nextRe = wRe * wlenRe - wIm * wlenIm
        wIm = wRe * wlenIm + wIm * wlenRe
        wRe = nextRe
      }
    }
  }
}

function pearson(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = a.length
  let sumA = 0
  let sumB = 0
  for (let i = 0; i < n; i++) {
    sumA += a[i] ?? 0
    sumB += b[i] ?? 0
  }
  const meanA = sumA / n
  const meanB = sumB / n
  let num = 0
  let denA = 0
  let denB = 0
  for (let i = 0; i < n; i++) {
    const da = (a[i] ?? 0) - meanA
    const db = (b[i] ?? 0) - meanB
    num += da * db
    denA += da * da
    denB += db * db
  }
  if (denA <= 1e-18 || denB <= 1e-18) return 0
  return num / Math.sqrt(denA * denB)
}

function profileFor(mode: MusicalMode, tonic: number): number[] {
  const source = mode === 'major' ? KS_MAJOR : KS_MINOR
  const rotated = new Array<number>(12)
  for (let i = 0; i < 12; i++) {
    rotated[i] = source[(i - tonic + 12) % 12] ?? 0
  }
  return rotated
}

/** Score a 12-bin pitch-class chroma against the 24 Krumhansl–Schmuckler keys. */
export function detectKeyFromChroma(chroma: ArrayLike<number>): KeyResult {
  let best: KeyCandidate = { tonic: 0, mode: 'major', correlation: -Infinity }
  let runnerUp: KeyCandidate | null = null

  const modes: MusicalMode[] = ['major', 'minor']
  for (const mode of modes) {
    for (let tonic = 0; tonic < 12; tonic++) {
      const correlation = pearson(chroma, profileFor(mode, tonic))
      const candidate: KeyCandidate = { tonic, mode, correlation }
      if (correlation > best.correlation + 1e-12) {
        runnerUp = best.correlation === -Infinity ? null : best
        best = candidate
      } else if (!runnerUp || correlation > runnerUp.correlation) {
        runnerUp = candidate
      }
    }
  }

  if (!Number.isFinite(best.correlation)) {
    best = { tonic: 0, mode: 'major', correlation: 0 }
  }

  const margin = runnerUp ? best.correlation - runnerUp.correlation : best.correlation
  const ambiguous = best.correlation < 0.2 || margin < 0.025

  return {
    tonic: best.tonic,
    mode: best.mode,
    correlation: best.correlation,
    ambiguous,
    runnerUp
  }
}

function chooseFftSize(frames: number): number {
  let size = 16384
  while (size > 2048 && size > frames) size >>= 1
  return size
}

/**
 * Pitch-class chroma from the source recording (A4 = 440 Hz, the lattice Suno
 * and other generators write), then Krumhansl–Schmuckler key finding.
 * A −31 cent file still lands in the same pitch class, so an already-retuned
 * WAV names the same key.
 */
export function detectKey(
  audio: DecodedAudio,
  onProgress?: (progress: number) => void
): KeyResult {
  const frames = audio.channels[0]?.length ?? 0
  const channelCount = audio.channels.length
  if (frames < 32 || channelCount < 1) {
    return {
      tonic: 0,
      mode: 'major',
      correlation: 0,
      ambiguous: true,
      runnerUp: null
    }
  }

  const fftSize = chooseFftSize(frames)
  const hop = Math.max(1, fftSize >> 1)
  const re = new Float32Array(fftSize)
  const im = new Float32Array(fftSize)
  const hann = new Float32Array(fftSize)
  for (let i = 0; i < fftSize; i++) {
    hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / fftSize))
  }

  const chroma = new Float64Array(12)
  const binHz = audio.sampleRate / fftSize
  const kMin = Math.max(1, Math.floor(70 / binHz))
  const kMax = Math.min(fftSize >> 1, Math.ceil(5000 / binHz))
  const iterations = Math.max(1, frames <= fftSize ? 1 : Math.floor((frames - fftSize) / hop) + 1)

  for (let frame = 0; frame < iterations; frame++) {
    const pos = frames <= fftSize ? 0 : frame * hop
    for (let i = 0; i < fftSize; i++) {
      const index = pos + i
      let sample = 0
      if (index < frames) {
        for (let ch = 0; ch < channelCount; ch++) sample += audio.channels[ch]![index] ?? 0
        sample /= channelCount
      }
      re[i] = sample * hann[i]!
      im[i] = 0
    }
    fft(re, im)

    for (let k = kMin; k < kMax; k++) {
      const freq = k * binHz
      const mag = Math.hypot(re[k]!, im[k]!)
      if (mag < 1e-8) continue
      const midi = 69 + 12 * Math.log2(freq / 440)
      const nearest = Math.round(midi)
      const distance = Math.abs(midi - nearest)
      const weight = Math.log1p(mag) * Math.cos(distance * Math.PI)
      if (weight <= 0) continue
      const pitchClass = ((nearest % 12) + 12) % 12
      chroma[pitchClass] = (chroma[pitchClass] ?? 0) + weight
    }

    if (onProgress && frame % 8 === 0) onProgress(frame / iterations)
  }

  onProgress?.(1)
  return detectKeyFromChroma(chroma)
}
