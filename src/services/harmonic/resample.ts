/**
 * Band-limited resample (windowed-sinc, Kaiser window).
 *
 * Pitch is changed by reading the source at a non-1:1 step while writing the
 * file's native sample rate. That is the same math as a clean sample-rate
 * conversion, so a pure tone moves in frequency without the metallic sidebands
 * of a phase vocoder. `step` is input samples advanced per output sample:
 * step < 1 lowers pitch and lengthens the buffer.
 */

const HALF = 16
const TAPS = HALF * 2 + 1
const PHASES = 128
const BETA = 8.5

const kernelCache = new Map<number, Float32Array>()

function besselI0(x: number): number {
  let sum = 1
  let term = 1
  const y = (x * x) / 4
  for (let k = 1; k < 40; k++) {
    term *= y / (k * k)
    sum += term
    if (term < 1e-14 * sum) break
  }
  return sum
}

function sinc(x: number): number {
  if (Math.abs(x) < 1e-8) return 1
  const pix = Math.PI * x
  return Math.sin(pix) / pix
}

function buildKernel(cutoff: number): Float32Array {
  const table = new Float32Array(PHASES * TAPS)
  const i0beta = besselI0(BETA)
  for (let phase = 0; phase < PHASES; phase++) {
    const frac = phase / PHASES
    let sum = 0
    const base = phase * TAPS
    for (let tap = 0; tap < TAPS; tap++) {
      const t = tap - HALF - frac
      const windowX = t / HALF
      let window = 0
      if (windowX >= -1 && windowX <= 1) {
        window = besselI0(BETA * Math.sqrt(1 - windowX * windowX)) / i0beta
      }
      const coeff = sinc(cutoff * t) * cutoff * window
      table[base + tap] = coeff
      sum += coeff
    }
    if (Math.abs(sum) > 1e-8) {
      for (let tap = 0; tap < TAPS; tap++) table[base + tap]! /= sum
    }
  }
  return table
}

function kernelForStep(step: number): Float32Array {
  const cutoff = step > 1 ? 1 / step : 1
  const key = Math.round(cutoff * 1e6)
  let kernel = kernelCache.get(key)
  if (!kernel) {
    kernel = buildKernel(cutoff)
    kernelCache.set(key, kernel)
  }
  return kernel
}

export function resampleChannel(
  input: Float32Array,
  step: number,
  onProgress?: (progress: number) => void
): Float32Array {
  const n = input.length
  if (n === 0) return new Float32Array(0)
  if (Math.abs(step - 1) < 1e-9) {
    onProgress?.(1)
    return new Float32Array(input)
  }

  const kernel = kernelForStep(step)
  const outLen = Math.max(1, Math.floor((n - 1) / step) + 1)
  const out = new Float32Array(outLen)
  const padded = new Float32Array(n + TAPS)
  padded.set(input, HALF)

  for (let i = 0; i < outLen; i++) {
    const pos = i * step
    let idx = Math.floor(pos)
    let phase = Math.round((pos - idx) * PHASES)
    if (phase >= PHASES) {
      phase = 0
      idx += 1
    } else if (phase < 0) {
      phase = 0
    }
    const coeffBase = phase * TAPS
    let acc = 0
    for (let tap = 0; tap < TAPS; tap++) {
      acc += padded[idx + tap]! * kernel[coeffBase + tap]!
    }
    out[i] = acc
    if (onProgress && (i & 32767) === 0) onProgress(i / outLen)
  }

  onProgress?.(1)
  return out
}
