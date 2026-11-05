import type { InMessage, OutMessage } from './protocol'
import { inspectWav, renderVersions } from './render'

interface WorkerScope {
  onmessage: ((event: MessageEvent<InMessage>) => void) | null
  postMessage: (message: OutMessage, transfer?: Transferable[]) => void
}

const scope = self as unknown as WorkerScope

scope.onmessage = (event: MessageEvent<InMessage>) => {
  const message = event.data
  try {
    if (message.type === 'analyze') {
      const bytes = new Uint8Array(message.buffer)
      const inspected = inspectWav(bytes, (progress, status) => {
        scope.postMessage({
          type: 'analyze-progress',
          requestId: message.requestId,
          progress: Math.round(progress * 100),
          status
        })
      })
      const result: OutMessage = {
        type: 'analyzed',
        requestId: message.requestId,
        sampleRate: inspected.sampleRate,
        channels: inspected.channels,
        frames: inspected.frames,
        key: inspected.key
      }
      scope.postMessage(result)
      return
    }

    renderVersions(new Uint8Array(message.buffer), {
      versions: message.versions,
      tempoLocked: message.tempoLocked,
      tonic: message.tonic,
      mode: message.mode,
      onProgress: (version, progress, status) => {
        scope.postMessage({
          type: 'progress',
          requestId: message.requestId,
          version,
          progress,
          status
        })
      },
      onVersion: (rendered) => {
        const buffer = rendered.bytes.buffer as ArrayBuffer
        scope.postMessage(
          {
            type: 'rendered',
            requestId: message.requestId,
            version: rendered.version,
            buffer,
            peakDb: rendered.peakDb,
            frames: rendered.frames,
            sampleRate: rendered.sampleRate,
            channels: rendered.channels
          },
          [buffer]
        )
      }
    })
    scope.postMessage({ type: 'complete', requestId: message.requestId })
  } catch (error) {
    const text = error instanceof Error ? error.message : 'Rendering failed.'
    scope.postMessage({ type: 'error', requestId: message.requestId, message: text })
  }
}
