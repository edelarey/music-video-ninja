declare module '@/services/wavMetadata.js' {
  export function scrubWavMetadata(input: Uint8Array | ArrayBuffer): Uint8Array<ArrayBuffer>
}
