export interface DecodedAudio {
  sampleRate: number
  channels: Float32Array[]
}

const PCM = 1
const IEEE_FLOAT = 3
const EXTENSIBLE = 0xfffe

function fourCC(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0
  )
}

function u16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8)
}

function u32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>>
    0
  )
}

export interface WavInfo {
  sampleRate: number
  channels: number
  frames: number
  bitsPerSample: number
  audioFormat: number
  blockAlign: number
  data: Uint8Array
}

/**
 * Read the header and locate the data chunk without converting samples.
 * Duration is frames / sampleRate at whatever rate the file was written with.
 */
export function readWavInfo(input: Uint8Array): WavInfo {
  if (input.length < 44 || fourCC(input, 0) !== 'RIFF' || fourCC(input, 8) !== 'WAVE') {
    throw new Error('That file is not a WAV. This page reads and writes .wav only.')
  }

  let audioFormat = 0
  let channelCount = 0
  let sampleRate = 0
  let blockAlign = 0
  let bitsPerSample = 0
  let data: Uint8Array | null = null

  let pos = 12
  while (pos + 8 <= input.length) {
    const id = fourCC(input, pos)
    const size = u32(input, pos + 4)
    const start = pos + 8
    if (start + size > input.length) break
    const chunk = input.subarray(start, start + size)

    if (id === 'fmt ') {
      audioFormat = u16(chunk, 0)
      channelCount = u16(chunk, 2)
      sampleRate = u32(chunk, 4)
      blockAlign = u16(chunk, 12)
      bitsPerSample = u16(chunk, 14)
      if (audioFormat === EXTENSIBLE && chunk.length >= 26) {
        audioFormat = u16(chunk, 24)
      }
    } else if (id === 'data') {
      data = chunk
    }

    pos = start + size + (size & 1)
  }

  if (!data || channelCount < 1 || channelCount > 8 || sampleRate < 8000 || sampleRate > 192000) {
    throw new Error('Could not read a usable WAV header (need 8–192 kHz, 1–8 channels).')
  }

  const bytesPerSample = bitsPerSample / 8
  const frameBytes = blockAlign || channelCount * bytesPerSample
  const frames = Math.floor(data.length / frameBytes)
  if (frames < 1) throw new Error('The WAV has no audio samples.')

  return {
    sampleRate,
    channels: channelCount,
    frames,
    bitsPerSample,
    audioFormat,
    blockAlign: frameBytes,
    data
  }
}

/**
 * Decode a standard PCM or IEEE-float WAV into planar float channels at the
 * file's own sample rate. Compressed WAV (ADPCM, and so on) is rejected.
 */
export function decodeWav(input: Uint8Array): DecodedAudio {
  const info = readWavInfo(input)
  const { audioFormat, bitsPerSample, channels: channelCount, sampleRate, blockAlign, frames, data } = info

  if (audioFormat !== PCM && audioFormat !== IEEE_FLOAT) {
    throw new Error('This WAV is compressed. Export uncompressed PCM or float WAV and try again.')
  }
  if (audioFormat === IEEE_FLOAT && bitsPerSample !== 32) {
    throw new Error('Float WAV must be 32-bit.')
  }
  if (audioFormat === PCM && ![8, 16, 24, 32].includes(bitsPerSample)) {
    throw new Error(`Unsupported PCM width (${bitsPerSample}-bit). Use 16, 24, or 32-bit WAV.`)
  }

  const bytesPerSample = bitsPerSample / 8
  const channels: Float32Array[] = Array.from({ length: channelCount }, () => new Float32Array(frames))
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)

  for (let frame = 0; frame < frames; frame++) {
    const frameStart = frame * blockAlign
    for (let ch = 0; ch < channelCount; ch++) {
      const offset = frameStart + ch * bytesPerSample
      channels[ch]![frame] = readSample(view, data, offset, audioFormat, bitsPerSample)
    }
  }

  return { sampleRate, channels }
}

function readSample(
  view: DataView,
  bytes: Uint8Array,
  offset: number,
  format: number,
  bits: number
): number {
  if (format === IEEE_FLOAT) return view.getFloat32(offset, true)
  if (bits === 8) return ((bytes[offset] ?? 128) - 128) / 128
  if (bits === 16) return view.getInt16(offset, true) / 32768
  if (bits === 24) {
    const v = (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16)
    const signed = v & 0x800000 ? v - 0x1000000 : v
    return signed / 8388608
  }
  return view.getInt32(offset, true) / 2147483648
}

/**
 * Write interleaved 24-bit PCM WAV at `sampleRate`.
 * Samples are clamped to the −1.0 dBFS integer ceiling so the file itself cannot clip.
 */
export function encodeWav(channels: Float32Array[], sampleRate: number): Uint8Array {
  const channelCount = channels.length
  const first = channels[0]
  if (!first || channelCount < 1) throw new Error('Nothing to encode.')
  const frames = first.length
  for (const ch of channels) {
    if (ch.length !== frames) throw new Error('Channel lengths do not match.')
  }

  const bits = 24
  const bytesPerSample = 3
  const blockAlign = channelCount * bytesPerSample
  const dataSize = frames * blockAlign
  const paddedData = dataSize + (dataSize & 1)
  const buffer = new Uint8Array(44 + paddedData)
  const view = new DataView(buffer.buffer)

  writeFourCC(buffer, 0, 'RIFF')
  view.setUint32(4, 36 + paddedData, true)
  writeFourCC(buffer, 8, 'WAVE')
  writeFourCC(buffer, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, PCM, true)
  view.setUint16(22, channelCount, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bits, true)
  writeFourCC(buffer, 36, 'data')
  view.setUint32(40, dataSize, true)

  const fullScale = 8388608
  const limit = Math.floor(fullScale * 10 ** (-1 / 20))

  let offset = 44
  for (let i = 0; i < frames; i++) {
    for (let ch = 0; ch < channelCount; ch++) {
      const sample = channels[ch]![i] ?? 0
      let q = Math.round(sample * fullScale)
      if (q > limit) q = limit
      else if (q < -limit) q = -limit
      buffer[offset] = q & 0xff
      buffer[offset + 1] = (q >> 8) & 0xff
      buffer[offset + 2] = (q >> 16) & 0xff
      offset += 3
    }
  }

  return buffer
}

function writeFourCC(bytes: Uint8Array, offset: number, text: string) {
  for (let i = 0; i < 4; i++) bytes[offset + i] = text.charCodeAt(i)
}
