import { DRONE_BREATH_HZ, DRONE_HP_HZ, DRONE_LP_HZ, droneRecipe, tonicFundamental, type MusicalMode } from './constants'
import { applyButterworth4, fadeEdges } from './filters'

function addOscillator(dest: Float32Array, sampleRate: number, freq: number, gain: number): void {
  if (!(freq > 0) || freq >= sampleRate * 0.45 || gain === 0) return
  const delta = (2 * Math.PI * freq) / sampleRate
  const dcos = Math.cos(delta)
  const dsin = Math.sin(delta)
  let sin = 0
  let cos = 1
  for (let i = 0; i < dest.length; i++) {
    dest[i] = dest[i]! + sin * gain
    const nextSin = sin * dcos + cos * dsin
    const nextCos = cos * dcos - sin * dsin
    sin = nextSin
    cos = nextCos
    if ((i & 1023) === 0) {
      const mag = Math.hypot(sin, cos) || 1
      sin /= mag
      cos /= mag
    }
  }
}

/**
 * Low-register just-ratio drone on the chosen tonic in A4 = 432.081 Hz tuning.
 * Left and right are detuned by a tenth of a cent and breathe slightly out of
 * phase so the bed has width without a chorus effect on the vocal.
 */
export function synthesizeDrone(
  frames: number,
  sampleRate: number,
  tonic: number,
  mode: MusicalMode,
  onProgress?: (progress: number) => void
): Float32Array[] {
  const { hz } = tonicFundamental(tonic)
  const recipe = droneRecipe(mode)
  const left = new Float32Array(frames)
  const right = new Float32Array(frames)
  const detune = 2 ** (0.12 / 1200)

  recipe.forEach((partial, index) => {
    addOscillator(left, sampleRate, hz * partial.ratio, partial.gain)
    addOscillator(right, sampleRate, hz * partial.ratio * detune, partial.gain)
    onProgress?.((index + 1) / (recipe.length + 2))
  })

  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate
    left[i] = left[i]! * (0.84 + 0.16 * Math.sin(2 * Math.PI * DRONE_BREATH_HZ * t))
    right[i] = right[i]! * (0.84 + 0.16 * Math.sin(2 * Math.PI * DRONE_BREATH_HZ * t + 0.8))
  }

  const channels = [left, right]
  for (const channel of channels) {
    applyButterworth4(channel, 'highpass', DRONE_HP_HZ, sampleRate)
    applyButterworth4(channel, 'lowpass', DRONE_LP_HZ, sampleRate)
  }
  fadeEdges(channels, Math.round(0.02 * sampleRate))
  onProgress?.(1)
  return channels
}
