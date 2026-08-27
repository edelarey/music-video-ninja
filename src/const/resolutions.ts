export type Resolution = 144 | 240 | 360 | 480 | 720 | 1080

export interface ResolutionConfig {
  label: string
  width: number
  height: number
}

export const RESOLUTION_MAP: Record<Resolution, ResolutionConfig> = {
  144: { label: '144p', width: 256, height: 144 },
  240: { label: '240p', width: 426, height: 240 },
  360: { label: '360p', width: 640, height: 360 },
  480: { label: '480p', width: 854, height: 480 },
  720: { label: '720p', width: 1280, height: 720 },
  1080: { label: '1080p', width: 1920, height: 1080 }
}

export function describeResolution(width: number, height: number): string {
  const match = Object.values(RESOLUTION_MAP).find(
    (config) => config.width === width && config.height === height
  )
  if (match) return match.label

  const byHeight = Object.values(RESOLUTION_MAP).find((config) => config.height === height)
  if (byHeight) return `${byHeight.label} (${width}×${height})`

  return `${width}×${height}`
}

export function scaleDirection(
  sourceHeight: number,
  targetHeight: number
): 'upscale' | 'downscale' | 'same' {
  if (sourceHeight < targetHeight) return 'upscale'
  if (sourceHeight > targetHeight) return 'downscale'
  return 'same'
}
