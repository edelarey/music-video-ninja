import type { KeyResult, MusicalMode, VersionId } from './constants'

export interface AnalyzeRequest {
  type: 'analyze'
  requestId: number
  buffer: ArrayBuffer
}

export interface RenderRequestMessage {
  type: 'render'
  requestId: number
  buffer: ArrayBuffer
  versions: VersionId[]
  tempoLocked: boolean
  tonic: number
  mode: MusicalMode
}

export type InMessage = AnalyzeRequest | RenderRequestMessage

export interface AnalyzeProgressMessage {
  type: 'analyze-progress'
  requestId: number
  progress: number
  status: string
}

export interface AnalyzedMessage {
  type: 'analyzed'
  requestId: number
  sampleRate: number
  channels: number
  frames: number
  key: KeyResult
}

export interface RenderProgressMessage {
  type: 'progress'
  requestId: number
  version: VersionId
  progress: number
  status: string
}

export interface RenderedMessage {
  type: 'rendered'
  requestId: number
  version: VersionId
  buffer: ArrayBuffer
  peakDb: number
  frames: number
  sampleRate: number
  channels: number
}

export interface CompleteMessage {
  type: 'complete'
  requestId: number
}

export interface ErrorMessage {
  type: 'error'
  requestId: number
  message: string
}

export type OutMessage =
  | AnalyzeProgressMessage
  | AnalyzedMessage
  | RenderProgressMessage
  | RenderedMessage
  | CompleteMessage
  | ErrorMessage
