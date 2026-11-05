/**
 * Stereo-locked WSOLA time stretch.
 *
 * After the sinc resample has set the pitch, this restores the original
 * duration. The ratio on this page is about 1.8%, so each hop only has to
 * slide a few milliseconds. Overlaps follow the waveform (normalized
 * cross-correlation on the mid signal) instead of a fixed grid, which is what
 * keeps vocals from comb-filtering. Both channels share one offset so the
 * stereo image does not tear. A periodic Hann window is removed by dividing
 * out the accumulated weight, so the edges are not faded.
 */

const WINDOW_SECONDS = 0.05
const SEARCH_SECONDS = 0.004

function periodicHann(win: number): Float32Array {
  const window = new Float32Array(win)
  for (let i = 0; i < win; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / win))
  }
  return window
}

function fitLength(channels: Float32Array[], targetLength: number): Float32Array[] {
  return channels.map((src) => {
    const out = new Float32Array(targetLength)
    out.set(src.subarray(0, Math.min(src.length, targetLength)))
    return out
  })
}

function correlation(
  channels: Float32Array[],
  refStart: number,
  cand: number,
  length: number,
  nIn: number,
  decim: number
): number {
  let dot = 0
  let eRef = 0
  let eCand = 0
  for (let i = 0; i < length; i += decim) {
    const rIndex = refStart + i
    const cIndex = cand + i
    if (rIndex < 0 || cIndex < 0 || rIndex >= nIn || cIndex >= nIn) continue
    let ref = 0
    let sample = 0
    for (let ch = 0; ch < channels.length; ch++) {
      ref += channels[ch]![rIndex]!
      sample += channels[ch]![cIndex]!
    }
    dot += ref * sample
    eRef += ref * ref
    eCand += sample * sample
  }
  return dot / Math.sqrt(eRef * eCand + 1e-18)
}

function findOffset(
  channels: Float32Array[],
  prevPos: number,
  ideal: number,
  hs: number,
  win: number,
  radius: number,
  nIn: number
): number {
  const maxPos = nIn - win
  if (maxPos <= 0) return 0
  const clamp = (value: number) => Math.max(0, Math.min(maxPos, value))
  const refStart = prevPos + hs
  const decim = 4

  // Periodic audio correlates once per cycle. Take the best splice, then if
  // several offsets are essentially tied, keep the one nearest the ideal
  // timeline so the search does not hop between identical cycles.
  const idealRound = Math.round(ideal)
  const scored: { cand: number; score: number }[] = []
  let bestScore = -Infinity
  const start = idealRound - radius
  const end = idealRound + radius
  for (let cand = start; cand <= end; cand += decim) {
    if (cand < 0 || cand > maxPos) continue
    const score = correlation(channels, refStart, cand, hs, nIn, decim)
    scored.push({ cand, score })
    if (score > bestScore) bestScore = score
  }

  const threshold = bestScore - 0.02
  let best = clamp(idealRound)
  let bestDist = Infinity
  for (const item of scored) {
    if (item.score < threshold) continue
    const dist = Math.abs(item.cand - idealRound)
    if (dist < bestDist) {
      bestDist = dist
      best = item.cand
    }
  }

  let refinedScore = -Infinity
  let refined = best
  for (let cand = best - decim; cand <= best + decim; cand++) {
    if (cand < 0 || cand > maxPos) continue
    const score = correlation(channels, refStart, cand, hs, nIn, 1)
    if (score > refinedScore) {
      refinedScore = score
      refined = cand
    }
  }
  return refined
}

export function timeStretch(
  channels: Float32Array[],
  targetLength: number,
  sampleRate: number,
  onProgress?: (progress: number) => void
): Float32Array[] {
  const nIn = channels[0]?.length ?? 0
  if (channels.length === 0 || nIn === 0) {
    return channels.map(() => new Float32Array(Math.max(0, targetLength)))
  }
  if (targetLength === nIn) {
    onProgress?.(1)
    return channels.map((channel) => new Float32Array(channel))
  }

  const maxWin = nIn >= 128 ? Math.floor(nIn / 4) * 2 : 0
  if (maxWin < 32) {
    onProgress?.(1)
    return fitLength(channels, targetLength)
  }
  let win = Math.round(WINDOW_SECONDS * sampleRate)
  if (win % 2) win += 1
  if (win > maxWin) win = maxWin
  if (win % 2) win -= 1
  if (win < 32) {
    onProgress?.(1)
    return fitLength(channels, targetLength)
  }

  const hs = win >> 1
  const alpha = targetLength / nIn
  const ha = hs / alpha
  const radius = Math.max(4, Math.round(SEARCH_SECONDS * sampleRate))
  const hann = periodicHann(win)
  const outputs = channels.map(() => new Float32Array(targetLength))
  const weight = new Float32Array(targetLength)
  const frameCount = Math.max(1, Math.ceil(targetLength / hs))

  let prevPos = 0
  for (let frame = 0; frame < frameCount; frame++) {
    const syn = frame * hs
    if (syn >= targetLength) break
    const ideal = frame * ha
    const pos = frame === 0 ? 0 : findOffset(channels, prevPos, ideal, hs, win, radius, nIn)
    prevPos = pos

    for (let ch = 0; ch < channels.length; ch++) {
      const src = channels[ch]!
      const dst = outputs[ch]!
      for (let i = 0; i < win; i++) {
        const s = syn + i
        if (s >= targetLength) break
        dst[s] = (dst[s] ?? 0) + src[pos + i]! * hann[i]!
      }
    }
    for (let i = 0; i < win; i++) {
      const s = syn + i
      if (s >= targetLength) break
      weight[s] = (weight[s] ?? 0) + hann[i]!
    }
    if (onProgress && (frame & 15) === 0) onProgress(frame / frameCount)
  }

  for (let ch = 0; ch < outputs.length; ch++) {
    const dst = outputs[ch]!
    for (let i = 0; i < targetLength; i++) {
      const w = weight[i]!
      if (w > 1e-6) dst[i] = dst[i]! / w
    }
  }

  onProgress?.(1)
  return outputs
}
