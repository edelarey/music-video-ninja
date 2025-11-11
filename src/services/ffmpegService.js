import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'
class FFmpegService {
  constructor() {
    this.ffmpeg = new FFmpeg()
    this.loaded = false
  }

  async load() {
    if (this.loaded) return

    this.ffmpeg.on('log', ({ message }) => {
      // Filter out verbose progress messages from the general log
      if (!message.startsWith('frame=')) {
        console.log('[FFmpeg Log]', message)
      }
    })

    // This progress listener is now driven by the audio duration for accuracy
    this.ffmpeg.on('progress', ({ time, progress }) => {
      const timeInSeconds = time / 1000000;
      // Log the ffmpeg progress in seconds for readability
      console.log(`[FFmpeg Progress] Time: ${timeInSeconds.toFixed(2)}s / ${this._mp3Duration.toFixed(2)}s`)
      if (this._mp3Duration > 0 && this._onProgress) {
        const percent = Math.min(100, Math.round((timeInSeconds / this._mp3Duration) * 100))
        this._onProgress(percent)
      }
    })

    console.log('Loading FFmpeg with @ffmpeg/core-mt...')

    try {
      const baseURL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm'
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
      }, {
        // Enable multi-threading
        pthreads: navigator.hardwareConcurrency,
      })
      console.log('FFmpeg loaded successfully!')
    } catch (error) {
      console.error('Error loading FFmpeg:', error)
      throw error
    }

    this.loaded = true
  }

  async processVideo(
    mp3File,
    clips,
    mp3Duration,
    onProgress,
    onStatusUpdate
  ) {
    this._onProgress = onProgress // Store the UI progress callback
    this._onStatusUpdate = onStatusUpdate // Store the status text callback
    this._mp3Duration = mp3Duration // Store the mp3 duration

    if (!this.ffmpeg || !this.loaded) {
      throw new Error('FFmpeg not loaded')
    }

    try {
      // Write MP3 to FFmpeg filesystem
      if (onStatusUpdate) onStatusUpdate('Loading audio file...')
      const mp3Data = new Uint8Array(await mp3File.arrayBuffer())
      await this.ffmpeg.writeFile('audio.mp3', mp3Data)

      // Step 1: Process each clip (loop, mute, scale)
      if (onStatusUpdate) onStatusUpdate('Processing video clips...')
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i]
        if (!clip) continue

        const segmentDuration = clip.end - clip.start
        if (onStatusUpdate) onStatusUpdate(`Processing clip ${i + 1}/${clips.length}...`)

        // Write original clip to filesystem
        const clipData = new Uint8Array(await clip.file.arrayBuffer())
        await this.ffmpeg.writeFile(`clip_${i}.mp4`, clipData)

        // --- The "Still Image" Optimization Strategy ---
        // Your command-line insight was key. Using `-tune stillimage` dramatically
        // reduces the resources needed for looping and re-encoding, which should
        // prevent the browser from running out of memory.
        await this.ffmpeg.exec([
          '-stream_loop', '-1',
          '-i', `clip_${i}.mp4`,
          '-t', segmentDuration.toString(),
          '-an', // Mute audio - this is correct for this step
          '-c:v', 'libx264',
          '-tune', 'stillimage', // The key optimization!
          '-preset', 'fast',
          '-crf', '23',
          '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
          `temp_${i}.mp4`
        ])

        // Clean up source clip
        await this.ffmpeg.deleteFile(`clip_${i}.mp4`)
      }

      // Step 2: Create concat file list
      if (onStatusUpdate) onStatusUpdate('Stitching clips together...')
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
      if (onStatusUpdate) onStatusUpdate('Adding audio track...')
      await this.ffmpeg.exec([
        '-i', 'stitched.mp4',
        '-i', 'audio.mp3',
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        '-movflags', '+faststart',
        'final_output.mp4'
      ])

      // Clean up intermediate files
      await this.ffmpeg.deleteFile('stitched.mp4')
      await this.ffmpeg.deleteFile('audio.mp3')

      // Read final output
      if (onStatusUpdate) onStatusUpdate('Finalizing...')
      const data = await this.ffmpeg.readFile('final_output.mp4')
      await this.ffmpeg.deleteFile('final_output.mp4')

      if (onStatusUpdate) onStatusUpdate('Complete!')

      // Return as Blob
      return new Blob([data.buffer], { type: 'video/mp4' })
    } catch (error) {
      console.error('FFmpeg processing error:', error)
      throw error
    }
  }

  isLoaded() {
    return this.loaded
  }
}

export const ffmpegService = new FFmpegService()