import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'
import type { VideoClip } from '../stores/editor'

class FFmpegService {
  private ffmpeg: FFmpeg | null = null
  private loaded = false

  async load(onProgress?: (progress: number) => void): Promise<void> {
    if (this.loaded) return

    this.ffmpeg = new FFmpeg()

    this.ffmpeg.on('log', ({ message }) => {
      console.log('[FFmpeg]', message)
    })

    this.ffmpeg.on('progress', ({ progress }) => {
      if (onProgress) {
        onProgress(Math.round(progress * 100))
      }
    })

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
    
    await this.ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })

    this.loaded = true
  }

  async processVideo(
    mp3File: File,
    clips: VideoClip[],
    mp3Duration: number,
    onProgress?: (progress: number, status: string) => void
  ): Promise<Blob> {
    if (!this.ffmpeg || !this.loaded) {
      throw new Error('FFmpeg not loaded')
    }

    try {
      // Write MP3 to FFmpeg filesystem
      onProgress?.(5, 'Loading audio file...')
      const mp3Data = new Uint8Array(await mp3File.arrayBuffer())
      await this.ffmpeg.writeFile('audio.mp3', mp3Data)

      // Step 1: Process each clip (loop, mute, scale)
      onProgress?.(10, 'Processing video clips...')
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i]
        if (!clip) continue
        
        const duration = clip.end - clip.start
        
        onProgress?.(
          10 + (i / clips.length) * 40,
          `Processing clip ${i + 1}/${clips.length}...`
        )

        // Write clip to filesystem
        const clipData = new Uint8Array(await clip.file.arrayBuffer())
        await this.ffmpeg.writeFile(`clip_${i}.mp4`, clipData)

        // Loop, mute, and scale the clip to fill the assigned duration
        await this.ffmpeg.exec([
          '-stream_loop', '-1',
          '-i', `clip_${i}.mp4`,
          '-t', duration.toString(),
          '-an',
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
          '-map', '0:v:0',
          `temp_${i}.mp4`
        ])

        // Clean up source clip
        await this.ffmpeg.deleteFile(`clip_${i}.mp4`)
      }

      // Step 2: Create concat file list
      onProgress?.(50, 'Stitching clips together...')
      let fileListContent = ''
      for (let i = 0; i < clips.length; i++) {
        fileListContent += `file 'temp_${i}.mp4'\n`
      }
      await this.ffmpeg.writeFile(
        'filelist.txt',
        new TextEncoder().encode(fileListContent)
      )

      // Concatenate all clips
      await this.ffmpeg.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'filelist.txt',
        '-c', 'copy',
        'stitched.mp4'
      ])

      // Clean up temp files
      for (let i = 0; i < clips.length; i++) {
        await this.ffmpeg.deleteFile(`temp_${i}.mp4`)
      }
      await this.ffmpeg.deleteFile('filelist.txt')

      // Step 3: Mux with MP3 audio (skip cover art, use only audio stream)
      onProgress?.(80, 'Adding audio track...')
      await this.ffmpeg.exec([
        '-i', 'stitched.mp4',
        '-i', 'audio.mp3',
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-tune', 'stillimage',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-t', mp3Duration.toString(),
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
        '-movflags', '+faststart',
        'final_output.mp4'
      ])

      // Clean up intermediate files
      await this.ffmpeg.deleteFile('stitched.mp4')
      await this.ffmpeg.deleteFile('audio.mp3')

      // Read final output
      onProgress?.(95, 'Finalizing...')
      const data = await this.ffmpeg.readFile('final_output.mp4') as Uint8Array
      await this.ffmpeg.deleteFile('final_output.mp4')

      onProgress?.(100, 'Complete!')

      // Return as Blob
      return new Blob([data.buffer as ArrayBuffer], { type: 'video/mp4' })
    } catch (error) {
      console.error('FFmpeg processing error:', error)
      throw error
    }
  }

  isLoaded(): boolean {
    return this.loaded
  }
}

export const ffmpegService = new FFmpegService()