const KEEP_CHUNKS = new Set(['fmt ', 'data', 'fact'])

function fourCC(bytes, offset) {
  return String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3]
  )
}

function u32le(bytes, offset) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0
}

/**
 * Return a WAV that keeps the audio chunks and drops the rest (LIST comments,
 * C2PA, and any other metadata). A file that already has no extra chunks is
 * rewritten the same way and does not fail.
 * @param {Uint8Array | ArrayBuffer} input
 * @returns {Uint8Array}
 */
export function scrubWavMetadata(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  if (bytes.length < 12 || fourCC(bytes, 0) !== 'RIFF' || fourCC(bytes, 8) !== 'WAVE') {
    throw new Error('Not a WAV file')
  }

  const kept = []
  let hasFmt = false
  let hasData = false
  let pos = 12

  while (pos + 8 <= bytes.length) {
    const id = fourCC(bytes, pos)
    const size = u32le(bytes, pos + 4)
    const chunkEnd = pos + 8 + size
    if (chunkEnd > bytes.length) break
    if (KEEP_CHUNKS.has(id)) {
      const end = Math.min(bytes.length, chunkEnd + (size % 2))
      kept.push(bytes.subarray(pos, end))
      if (id === 'fmt ') hasFmt = true
      if (id === 'data') hasData = true
    }
    pos = chunkEnd + (size % 2)
  }

  if (!hasFmt || !hasData) {
    throw new Error('WAV is missing audio data')
  }

  let payload = 4
  for (const chunk of kept) payload += chunk.length
  const out = new Uint8Array(8 + payload)
  out.set(bytes.subarray(0, 4), 0)
  const view = new DataView(out.buffer)
  view.setUint32(4, payload, true)
  out.set([0x57, 0x41, 0x56, 0x45], 8)
  let writeAt = 12
  for (const chunk of kept) {
    out.set(chunk, writeAt)
    writeAt += chunk.length
  }
  return out
}
