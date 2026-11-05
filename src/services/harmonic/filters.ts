import { PEAK_CEILING } from './constants'

export interface Biquad {
  b0: number
  b1: number
  b2: number
  a1: number
  a2: number
}

/** RBJ cookbook biquad, coefficients normalized by a0. */
export function designBiquad(
  type: 'lowpass' | 'highpass',
  freq: number,
  sampleRate: number,
  q: number
): Biquad {
  const f = Math.min(Math.max(freq, 5), sampleRate * 0.45)
  const w0 = (2 * Math.PI * f) / sampleRate
  const cos = Math.cos(w0)
  const sin = Math.sin(w0)
  const alpha = sin / (2 * q)
  const a0 = 1 + alpha
  const a1 = -2 * cos
  const a2 = 1 - alpha
  const b0 = type === 'lowpass' ? (1 - cos) / 2 : (1 + cos) / 2
  const b1 = type === 'lowpass' ? 1 - cos : -(1 + cos)
  const b2 = b0
  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0
  }
}

export function applyBiquad(x: Float32Array, coef: Biquad): void {
  let z1 = 0
  let z2 = 0
  const b0 = coef.b0
  const b1 = coef.b1
  const b2 = coef.b2
  const a1 = coef.a1
  const a2 = coef.a2
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i]!
    const y = b0 * x0 + z1
    z1 = b1 * x0 - a1 * y + z2
    z2 = b2 * x0 - a2 * y
    x[i] = y
  }
}

/** Two cascaded Butterworth sections, 24 dB/octave. */
export function applyButterworth4(
  x: Float32Array,
  type: 'lowpass' | 'highpass',
  freq: number,
  sampleRate: number
): void {
  applyBiquad(x, designBiquad(type, freq, sampleRate, 0.5411961))
  applyBiquad(x, designBiquad(type, freq, sampleRate, 1.306563))
}

/** Schroeder one-pole allpass. `delaySamples` is the loop length. */
export function allpassInPlace(x: Float32Array, delaySamples: number, gain: number): void {
  const delay = Math.max(1, delaySamples | 0)
  const buffer = new Float32Array(delay)
  let index = 0
  for (let i = 0; i < x.length; i++) {
    const delayed = buffer[index]!
    const y = -gain * x[i]! + delayed
    buffer[index] = x[i]! + gain * y
    x[i] = y
    index++
    if (index >= delay) index = 0
  }
}

export function multiTap(
  input: Float32Array,
  sampleRate: number,
  tapsMs: readonly number[],
  gains: readonly number[]
): Float32Array {
  const out = new Float32Array(input.length)
  let norm = 0
  for (const gain of gains) norm += Math.abs(gain)
  if (norm < 1e-8) norm = 1
  for (let t = 0; t < tapsMs.length; t++) {
    const delay = Math.round(((tapsMs[t] ?? 0) * sampleRate) / 1000)
    const gain = (gains[t] ?? 0) / norm
    if (delay <= 0 || delay >= input.length) continue
    for (let i = delay; i < input.length; i++) {
      out[i] = out[i]! + input[i - delay]! * gain
    }
  }
  return out
}

export function widenStereo(channels: Float32Array[], sideGain: number, midGain: number): void {
  const left = channels[0]
  const right = channels[1]
  if (!left || !right) return
  const n = Math.min(left.length, right.length)
  for (let i = 0; i < n; i++) {
    const mid = (left[i]! + right[i]!) * 0.5 * midGain
    const side = (left[i]! - right[i]!) * 0.5 * sideGain
    left[i] = mid + side
    right[i] = mid - side
  }
}

export function fadeEdges(channels: Float32Array[], fadeSamples: number): void {
  const n = channels[0]?.length ?? 0
  const fade = Math.min(Math.max(0, fadeSamples), n >> 1)
  if (fade < 2) return
  for (const channel of channels) {
    for (let i = 0; i < fade; i++) {
      const gain = i / fade
      channel[i] = channel[i]! * gain
      const j = n - 1 - i
      channel[j] = channel[j]! * gain
    }
  }
}

/**
 * Ride `wet` so its block RMS sits `levelDb` under `dry`, following the song.
 * Both channels share one gain so the stereo image of the halo stays put.
 */
export function applyRelativeEnvelope(
  dry: Float32Array[],
  wet: Float32Array[],
  levelDb: number,
  sampleRate: number
): void {
  const length = Math.min(dry[0]?.length ?? 0, wet[0]?.length ?? 0)
  if (length === 0) return
  const block = Math.max(32, Math.round(0.02 * sampleRate))
  const level = 10 ** (levelDb / 20)
  const blocks = Math.ceil(length / block)
  const gains = new Float32Array(blocks)
  const maxGain = 10 ** (12 / 20)
  const dryCount = dry.length
  const wetCount = wet.length

  for (let b = 0; b < blocks; b++) {
    const start = b * block
    const end = Math.min(length, start + block)
    let dryEnergy = 0
    let wetEnergy = 0
    let count = 0
    for (let i = start; i < end; i++) {
      for (let c = 0; c < dryCount; c++) {
        const sample = dry[c]![i]!
        dryEnergy += sample * sample
      }
      for (let c = 0; c < wetCount; c++) {
        const sample = wet[c]![i]!
        wetEnergy += sample * sample
      }
      count++
    }
    const dryRms = Math.sqrt(dryEnergy / (count * dryCount))
    const wetRms = Math.sqrt(wetEnergy / (count * wetCount))
    if (dryRms < 1e-5 || wetRms < 1e-8) gains[b] = 0
    else gains[b] = Math.min(maxGain, (dryRms * level) / wetRms)
  }

  const attack = Math.exp(-block / (0.03 * sampleRate))
  const release = Math.exp(-block / (0.18 * sampleRate))
  let envelope = 0
  const smooth = new Float32Array(blocks)
  for (let b = 0; b < blocks; b++) {
    const target = gains[b]!
    const coeff = target > envelope ? attack : release
    envelope = coeff * envelope + (1 - coeff) * target
    smooth[b] = envelope
  }

  for (let c = 0; c < wetCount; c++) {
    const channel = wet[c]!
    for (let i = 0; i < length; i++) {
      const position = i / block
      const b0 = Math.floor(position)
      const b1 = Math.min(blocks - 1, b0 + 1)
      const frac = position - b0
      const gain = smooth[b0]! * (1 - frac) + smooth[b1]! * frac
      channel[i] = channel[i]! * gain
    }
    for (let i = length; i < channel.length; i++) channel[i] = 0
  }
}

export function channelRms(channels: Float32Array[]): number {
  let sum = 0
  let n = 0
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      const sample = channel[i]!
      sum += sample * sample
    }
    n += channel.length
  }
  return n ? Math.sqrt(sum / n) : 0
}

export function channelPeak(channels: Float32Array[]): number {
  let peak = 0
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      const mag = Math.abs(channel[i]!)
      if (mag > peak) peak = mag
    }
  }
  return peak
}

export function scaleChannels(channels: Float32Array[], gain: number): void {
  if (gain === 1) return
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) channel[i] = channel[i]! * gain
  }
}

export function mixInto(destination: Float32Array[], source: Float32Array[]): void {
  const count = Math.min(destination.length, source.length)
  for (let c = 0; c < count; c++) {
    const dst = destination[c]!
    const src = source[c]!
    const n = Math.min(dst.length, src.length)
    for (let i = 0; i < n; i++) dst[i] = dst[i]! + src[i]!
  }
}

export function cloneChannels(channels: Float32Array[]): Float32Array[] {
  return channels.map((channel) => new Float32Array(channel))
}

/**
 * Match overall RMS to the source so A/B listening is fair, then pull the
 * peak down to −1.0 dBFS if the sum would clip. Makeup is capped so a quiet
 * processing glitch cannot blast the file.
 */
export function matchLoudnessAndLimit(channels: Float32Array[], referenceRms: number): number {
  const currentRms = channelRms(channels)
  const currentPeak = channelPeak(channels)
  let gain = 1
  if (referenceRms > 1e-8 && currentRms > 1e-8) {
    gain = Math.min(referenceRms / currentRms, 10 ** (6 / 20))
  }
  // A hair under the published ceiling so 24-bit quantization stays <= −1.0 dBFS.
  const safeCeiling = PEAK_CEILING * 10 ** (-0.03 / 20)
  const peakAfter = currentPeak * gain
  if (currentPeak > 0 && peakAfter > safeCeiling) {
    gain *= safeCeiling / peakAfter
  }
  scaleChannels(channels, gain)
  return channelPeak(channels)
}

export function peakDb(peak: number): number {
  if (peak <= 1e-12) return -120
  return 20 * Math.log10(peak)
}
