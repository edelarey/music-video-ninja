import type { KeyResult, MusicalMode, VersionId } from './constants'
import type { InMessage, OutMessage } from './protocol'

export interface AnalyzedWav {
  sampleRate: number
  channels: number
  frames: number
  key: KeyResult
}

export interface RenderedWavBuffer {
  version: VersionId
  buffer: ArrayBuffer
  peakDb: number
  frames: number
  sampleRate: number
  channels: number
}

export interface RenderJob {
  versions: VersionId[]
  tempoLocked: boolean
  tonic: number
  mode: MusicalMode
}

interface PendingJob {
  requestId: number
  onAnalyze?: (result: AnalyzedWav) => void
  onRendered?: (result: RenderedWavBuffer) => void
  onProgress?: (progress: number, status: string) => void
  onVersionProgress?: (version: VersionId, progress: number, status: string) => void
  resolve: () => void
  reject: (error: Error) => void
}

let worker: Worker | null = null
let requestSerial = 0
let pending: PendingJob | null = null

function spawn(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<OutMessage>) => {
      const message = event.data
      if (!pending || message.requestId !== pending.requestId) return
      if (message.type === 'analyze-progress') {
        pending.onProgress?.(message.progress, message.status)
        return
      }
      if (message.type === 'analyzed') {
        const job = pending
        pending = null
        job.onAnalyze?.({
          sampleRate: message.sampleRate,
          channels: message.channels,
          frames: message.frames,
          key: message.key
        })
        job.resolve()
        return
      }
      if (message.type === 'progress') {
        pending.onVersionProgress?.(message.version, message.progress, message.status)
        return
      }
      if (message.type === 'rendered') {
        pending.onRendered?.({
          version: message.version,
          buffer: message.buffer,
          peakDb: message.peakDb,
          frames: message.frames,
          sampleRate: message.sampleRate,
          channels: message.channels
        })
        return
      }
      if (message.type === 'complete') {
        const job = pending
        pending = null
        job.resolve()
        return
      }
      const job = pending
      pending = null
      job.reject(new Error(message.message))
    }
    worker.onerror = (event) => {
      const job = pending
      pending = null
      job?.reject(new Error(event.message || 'The audio worker crashed.'))
    }
  }
  return worker
}

export function cancelHarmonicWork(): void {
  requestSerial += 1
  const job = pending
  pending = null
  job?.reject(new Error('Cancelled'))
  worker?.terminate()
  worker = null
}

function start(job: Omit<PendingJob, 'requestId' | 'resolve' | 'reject'>, message: InMessage): Promise<void> {
  cancelHarmonicWork()
  const requestId = requestSerial
  const payload = { ...message, requestId }
  return new Promise<void>((resolve, reject) => {
    pending = { ...job, requestId, resolve, reject }
    const active = spawn()
    const transfer = payload.buffer
    active.postMessage(payload, [transfer])
  })
}

export function analyzeWavBuffer(
  buffer: ArrayBuffer,
  onProgress?: (progress: number, status: string) => void
): Promise<AnalyzedWav> {
  let result: AnalyzedWav | null = null
  return start(
    {
      onProgress,
      onAnalyze: (value) => {
        result = value
      }
    },
    { type: 'analyze', requestId: 0, buffer }
  ).then(() => {
    if (!result) throw new Error('Could not read that WAV.')
    return result
  })
}

export function renderWavBuffer(
  buffer: ArrayBuffer,
  job: RenderJob,
  onVersionProgress: (version: VersionId, progress: number, status: string) => void,
  onRendered: (result: RenderedWavBuffer) => void
): Promise<void> {
  return start(
    { onVersionProgress, onRendered },
    {
      type: 'render',
      requestId: 0,
      buffer,
      versions: job.versions,
      tempoLocked: job.tempoLocked,
      tonic: job.tonic,
      mode: job.mode
    }
  )
}
