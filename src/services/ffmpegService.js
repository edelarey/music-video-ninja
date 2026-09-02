import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

const H264_ENCODE = ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23']
// Keep in sync with PING_PONG_MAX_SOURCE_SECONDS in the editor store
const PING_PONG_MAX_SOURCE_SECONDS = 15

function formatClock(seconds) {
  const s = Math.max(0, Number(seconds) || 0)
  const mins = Math.floor(s / 60)
  const secs = Math.floor(s % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function clipLabel(clip, index) {
  const name = clip?.source?.file?.name || clip?.source?.name || 'untitled clip'
  const start = clip?.originalStart ?? clip?.start
  const end = clip?.originalEnd ?? clip?.end
  const range = Number.isFinite(start) && Number.isFinite(end)
    ? `, ${formatClock(start)}–${formatClock(end)}`
    : ''
  return `clip ${index + 1} (${name}${range})`
}

function isOomError(error) {
  if (error == null) return true
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  return /OOM|out of memory|Aborted|RuntimeError|Cannot enlarge memory/i.test(text)
}

function clipFailureError(clip, index, error, stage) {
  const label = clipLabel(clip, index)
  const oom = isOomError(error)
  if (stage === 'reverse') {
    return new Error(
      oom
        ? `Ran out of memory reversing ${label}. Turn off Ping-Pong Loop for that segment and render again.`
        : `Failed reversing ${label}. Turn off Ping-Pong Loop for that segment and render again.`
    )
  }
  if (clip?.loopMode === 'ping-pong' && oom) {
    return new Error(
      `Ran out of memory processing ${label}. Turn off Ping-Pong Loop for that segment and render again.`
    )
  }
  return new Error(
    oom
      ? `Ran out of memory processing ${label}.`
      : `Failed processing ${label}.`
  )
}

class FFmpegService {
  constructor() {
    this.ffmpeg = new FFmpeg()
    this.loaded = false
    this._mp3Duration = 0
    this._onProgress = null
  }

  attachListeners() {
    this.ffmpeg.on('log', (event) => {
      try {
        const message = event?.message
        if (typeof message !== 'string') return
        if (!message.startsWith('frame=')) {
          console.log('[FFmpeg Log]', message)
        }
      } catch {
        // Logging must never fail an encode (wasm abort events can omit message)
      }
    })

    this.ffmpeg.on('progress', ({ time } = {}) => {
      if (!this._mp3Duration || this._mp3Duration <= 0) return
      if (typeof time !== 'number' || !Number.isFinite(time) || time < 0) return

      const timeInSeconds = time / 1000000
      // AV_NOPTS_VALUE shows up as ~9.22e12 seconds during reverse/copy
      if (timeInSeconds > this._mp3Duration * 2) return

      console.log(`[FFmpeg Progress] Time: ${timeInSeconds.toFixed(2)}s / ${this._mp3Duration.toFixed(2)}s`)
      if (this._onProgress) {
        const percent = Math.min(100, Math.round((timeInSeconds / this._mp3Duration) * 100))
        this._onProgress(percent)
      }
    })
  }

  destroyInstance() {
    try {
      this.ffmpeg.terminate()
    } catch {
      // Worker may already be dead after OOM
    }
    this.ffmpeg = new FFmpeg()
    this.loaded = false
    this._mp3Duration = 0
    this._onProgress = null
  }

  async load() {
    if (this.loaded) return

    this.ffmpeg = new FFmpeg()
    this.attachListeners()

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
      this.destroyInstance()
      throw error
    }

    this.loaded = true
  }

  async deleteFile(fileName) {
    try {
      await this.ffmpeg.deleteFile(fileName)
    } catch {
      // File may not exist
    }
  }

  async deleteFiles(fileNames) {
    for (const fileName of fileNames) {
      if (fileName) await this.deleteFile(fileName)
    }
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

    const filesToClean = new Set(['audio.mp3', 'filelist.txt', 'stitched.mp4', 'final_output.mp4']);

    try {
      // Write MP3 to FFmpeg filesystem
      if (onStatusUpdate) onStatusUpdate('Loading audio file...')
      const mp3Data = new Uint8Array(await mp3File.arrayBuffer())
      await this.ffmpeg.writeFile('audio.mp3', mp3Data)

      // Step 1: Process each clip (loop, mute, scale)
      if (onStatusUpdate) onStatusUpdate('Processing video clips...')
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i]
        if (!clip || !clip.source) continue

        const segmentDuration = clip.end - clip.start
        const sourceClipName = `source_clip_${i}.mp4`;
        const processedClipName = `processed_clip_${i}.mp4`;
        const reversedClipName = `processed_clip_${i}_rev.mp4`;
        const loopListName = `looplist_${i}.txt`;
        const tempClipName = `temp_${i}.mp4`;

        const usePingPong =
          clip.loopMode === 'ping-pong' &&
          Number(clip.source.duration) < PING_PONG_MAX_SOURCE_SECONDS

        filesToClean.add(sourceClipName).add(processedClipName).add(loopListName).add(tempClipName);
        if (usePingPong) filesToClean.add(reversedClipName);

        try {
          // Write original clip to filesystem
          const clipData = new Uint8Array(await clip.source.file.arrayBuffer())
          await this.ffmpeg.writeFile(sourceClipName, clipData)

          // 1. Pre-process: Scale and mute the *short* source clip.
          if (onStatusUpdate) onStatusUpdate(`Pre-processing ${clipLabel(clip, i)}...`)
          await this.ffmpeg.exec([
            '-i', sourceClipName,
            '-an',
            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
            ...H264_ENCODE,
            processedClipName
          ])

          // Source is no longer needed after the scaled/muted copy exists
          await this.deleteFile(sourceClipName)

          // 1b. Create reversed clip if needed for ping-pong (skipped for sources 15s+)
          if (usePingPong) {
            if (onStatusUpdate) onStatusUpdate(`Creating reverse loop for ${clipLabel(clip, i)}...`)
            try {
              await this.ffmpeg.exec([
                '-i', processedClipName,
                '-vf', 'reverse',
                '-an',
                ...H264_ENCODE,
                reversedClipName
              ])
            } catch (error) {
              throw clipFailureError(clip, i, error, 'reverse')
            }
          }

          // 2. Loop: Use the pre-processed clip (and optionally its reverse) with the efficient concat demuxer.
          if (onStatusUpdate) onStatusUpdate(`Looping ${clipLabel(clip, i)}...`)
          const clipDuration = clip.source.duration
          const loopCount = Math.max(1, Math.ceil(segmentDuration / clipDuration))
          let loopListContent = ''
          for (let j = 0; j < loopCount; j++) {
            if (usePingPong && j % 2 === 1) {
              loopListContent += `file '${reversedClipName}'\n`
            } else {
              loopListContent += `file '${processedClipName}'\n`
            }
          }
          await this.ffmpeg.writeFile(loopListName, new TextEncoder().encode(loopListContent))

          // 3. Final Segment: Create the final segment by stream-copying and trimming.
          await this.ffmpeg.exec([
            '-f', 'concat',
            '-safe', '0',
            '-i', loopListName,
            '-t', segmentDuration.toString(),
            '-c', 'copy',
            tempClipName
          ])

          // Keep only the trimmed segment; drop per-clip intermediates to free MEMFS
          await this.deleteFiles([processedClipName, reversedClipName, loopListName])
        } catch (error) {
          if (error?.message?.includes('Turn off Ping-Pong Loop') || error?.message?.startsWith('Failed processing') || error?.message?.startsWith('Ran out of memory processing')) {
            throw error
          }
          throw clipFailureError(clip, i, error, 'process')
        }
      }

      // Step 2: Concat incrementally so MEMFS never holds every segment plus the stitch
      if (onStatusUpdate) onStatusUpdate('Stitching clips together...')
      const tempClips = []
      for (let i = 0; i < clips.length; i++) {
        if (clips[i] && clips[i].source) tempClips.push(`temp_${i}.mp4`)
      }
      if (tempClips.length === 0) {
        throw new Error('No valid video clips to stitch')
      }

      let currentStitch = tempClips[0]
      for (let i = 1; i < tempClips.length; i++) {
        if (onStatusUpdate) onStatusUpdate(`Stitching clips together (${i + 1}/${tempClips.length})...`)
        const outName = i === tempClips.length - 1 ? 'stitched.mp4' : `stitch_partial_${i}.mp4`
        filesToClean.add(outName)
        const listContent = `file '${currentStitch}'\nfile '${tempClips[i]}'\n`
        await this.ffmpeg.writeFile('filelist.txt', new TextEncoder().encode(listContent))
        await this.ffmpeg.exec([
          '-f', 'concat',
          '-safe', '0',
          '-i', 'filelist.txt',
          '-c', 'copy',
          outName
        ])
        await this.deleteFiles([currentStitch, tempClips[i]])
        currentStitch = outName
      }

      if (currentStitch !== 'stitched.mp4') {
        await this.ffmpeg.exec(['-i', currentStitch, '-c', 'copy', 'stitched.mp4'])
        await this.deleteFile(currentStitch)
      }

      // Step 3: Mux with MP3 audio
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

      await this.deleteFiles(['stitched.mp4', 'audio.mp3', 'filelist.txt'])

      // Read final output
      if (onStatusUpdate) onStatusUpdate('Finalizing...')
      const data = await this.ffmpeg.readFile('final_output.mp4')

      if (onStatusUpdate) onStatusUpdate('Complete!')

      // Return as Blob
      return new Blob([data.buffer], { type: 'video/mp4' })
    } catch (error) {
      console.error('FFmpeg processing error:', error)
      this.destroyInstance()
      throw error
    } finally {
      this._mp3Duration = 0
      this._onProgress = null
      if (this.loaded) {
        if (onStatusUpdate) onStatusUpdate('Cleaning up virtual files...')
        await this.deleteFiles([...filesToClean])
        if (onStatusUpdate) onStatusUpdate('Cleanup complete.')
      }
    }
  }

  isLoaded() {
    return this.loaded
  }

  /**
   * Combine multiple video clips into a single video with a specific resolution.
   * @param {Array} clips - Array of { id, sourceId, source: { file, duration, name } }
   * @param {Object} resolution - { width, height } target resolution
   * @param {number} totalDuration - Total duration of all clips combined
   * @param {Function} onProgress - Progress callback (percentage)
   * @param {Function} onStatusUpdate - Status text callback
   * @returns {Promise<Blob>} - Combined video as a Blob
   */
  async combineVideos(
    clips,
    resolution,
    totalDuration,
    onProgress,
    onStatusUpdate
  ) {
    // For combineVideos, we'll track progress manually based on clip processing stages
    // Don't set this._mp3Duration as the FFmpeg progress events would give incorrect readings
    
    if (!this.ffmpeg || !this.loaded) {
      throw new Error('FFmpeg not loaded')
    }

    const filesToClean = new Set(['filelist.txt', 'final_output.mp4'])
    const validClips = clips.filter(c => c && c.source)
    const totalSteps = validClips.length + 2 // encoding each clip + concat + finalize
    let completedSteps = 0

    // Custom progress handler for combineVideos to support sub-step progress
    const reportOverallProgress = (subStepPercent = 0) => {
      if (onProgress) {
        const currentStepProgress = subStepPercent / 100
        const totalProgress = ((completedSteps + currentStepProgress) / totalSteps) * 100
        onProgress(Math.min(100, Math.round(totalProgress)))
      }
    }

    try {
      const { width, height } = resolution

      // Step 1: Process each clip (scale to target resolution with letterboxing)
      if (onStatusUpdate) onStatusUpdate('Processing video clips...')
      reportOverallProgress()
      
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i]
        if (!clip || !clip.source) continue

        const sourceClipName = `source_clip_${i}.mp4`
        const processedClipName = `processed_clip_${i}.mp4`
        const videoTemp = `temp_v_${i}.mp4`
        const audioTemp = `temp_a_${i}.m4a`

        filesToClean.add(sourceClipName)
        filesToClean.add(processedClipName)
        filesToClean.add(videoTemp)
        filesToClean.add(audioTemp)

        // Write original clip to filesystem
        if (onStatusUpdate) onStatusUpdate(`Loading clip ${i + 1}/${validClips.length}: ${clip.source.name}`)
        const clipData = new Uint8Array(await clip.source.file.arrayBuffer())
        await this.ffmpeg.writeFile(sourceClipName, clipData)

        // Re-encode with scaling (Separate Video and Audio passes to avoid WASM hanging)
        if (onStatusUpdate) onStatusUpdate(`Processing clip ${i + 1}/${validClips.length}: ${clip.source.name}`)
        
        // Scaling and Padding Filter
        const scaleFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p`
        
        console.log(`[FFmpeg Combiner] Starting processing of ${sourceClipName}`)
        
        // Setup clip-specific progress tracking
        this._mp3Duration = clip.source.duration
        this._onProgress = (percent) => reportOverallProgress(percent)

        // Pass 1: Video Only (Resize/Pad) - Isolated to prevent hanging
        if (onStatusUpdate) onStatusUpdate(`Encoding Video ${i + 1}/${validClips.length}...`)
        await this.ffmpeg.exec([
          '-i', sourceClipName,
          '-vf', scaleFilter,
          '-an', // No Audio
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '23',
          videoTemp
        ])

        // Pass 2: Mux with Audio
        // We attempt to mux the new video with the ORIGINAL audio directly.
        // This avoids intermediate extraction files - we map the audio stream from the source file.
        if (onStatusUpdate) onStatusUpdate(`Muxing clip ${i + 1}/${validClips.length}...`)
        
        let muxSuccess = false
        try {
          // Attempt 1: Mux with audio directly from the source file
          // We stream copy the video we just created, and transcode the audio from the source
          const res = await this.ffmpeg.exec([
            '-i', videoTemp,        // Input 0: processed video (no audio)
            '-i', sourceClipName,   // Input 1: original source (likely has audio)
            '-map', '0:v:0',        // Use video from Input 0
            '-map', '1:a:0',        // Use first audio stream from Input 1
            '-c:v', 'copy',         // Copy video stream (fast)
            '-c:a', 'aac',          // Encode audio to AAC
            '-b:a', '192k',         // Good quality bitrate
            '-ac', '2',             // Force Stereo
            '-ar', '44100',         // Force 44.1kHz
            '-shortest',            // Stop when the shortest stream ends (usually video)
            processedClipName
          ])
          
          if (res === 0) muxSuccess = true
        } catch (e) {
          console.warn(`[FFmpeg Combiner] Mux with source audio failed (possibly no audio track in source).`, e)
        }

        if (!muxSuccess) {
          console.log(`[FFmpeg Combiner] Fallback: Generating silence for ${sourceClipName}`)
          if (onStatusUpdate) onStatusUpdate(`Adding silent audio ${i + 1}/${validClips.length}...`)
          
          // Attempt 2: Mux with generated silence if the source had no audio
          await this.ffmpeg.exec([
             '-i', videoTemp,
             '-f', 'lavfi',
             '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
             '-map', '0:v:0',
             '-map', '1:a:0',
             '-c:v', 'copy',
             '-c:a', 'aac',
             '-b:a', '192k',
             '-shortest',
             processedClipName
          ])
        }
        
        console.log(`[FFmpeg Combiner] Finished processing ${processedClipName}`)
        
        completedSteps++
        reportOverallProgress()
      }

      // Step 2: Create concat file list
      if (onStatusUpdate) onStatusUpdate('Preparing to combine clips...')
      let fileListContent = ''
      for (let i = 0; i < clips.length; i++) {
        if (clips[i] && clips[i].source) {
          fileListContent += `file 'processed_clip_${i}.mp4'\n`
        }
      }
      await this.ffmpeg.writeFile('filelist.txt', new TextEncoder().encode(fileListContent))

      // Step 3: Concatenate all clips
      if (onStatusUpdate) onStatusUpdate('Combining clips...')
      await this.ffmpeg.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'filelist.txt',
        '-c', 'copy',
        '-movflags', '+faststart',
        'final_output.mp4'
      ])
      
      completedSteps++
      reportOverallProgress(100)

      // Read final output
      if (onStatusUpdate) onStatusUpdate('Finalizing...')
      const data = await this.ffmpeg.readFile('final_output.mp4')

      completedSteps++
      reportOverallProgress(100)
      
      if (onStatusUpdate) onStatusUpdate('Complete!')

      // Return as Blob
      return new Blob([data.buffer], { type: 'video/mp4' })
    } catch (error) {
      console.error('FFmpeg combineVideos error:', error)
      throw error
    } finally {
      // --- Guaranteed Cleanup ---
      if (onStatusUpdate) onStatusUpdate('Cleaning up virtual files...')
      for (const fileName of filesToClean) {
        try {
          await this.ffmpeg.deleteFile(fileName)
        } catch (e) {
          // Ignore errors for files that might not have been created
        }
      }
      if (onStatusUpdate) onStatusUpdate('Cleanup complete.')
    }
  }

  /**
   * Scale a single video to a target resolution (upscale or downscale).
   * Letterboxes/pillarboxes to 16:9 and preserves audio when present.
   * @param {File} file - Source video file
   * @param {number} duration - Source duration in seconds
   * @param {{ width: number, height: number }} resolution - Target resolution
   * @param {Function} onProgress - Progress callback (percentage)
   * @param {Function} onStatusUpdate - Status text callback
   * @returns {Promise<Blob>} - Scaled video as a Blob
   */
  async scaleVideo(file, duration, resolution, onProgress, onStatusUpdate) {
    if (!this.ffmpeg || !this.loaded) {
      throw new Error('FFmpeg not loaded')
    }

    const { width, height } = resolution
    const sourceName = 'scale_source.mp4'
    const videoTemp = 'scale_video.mp4'
    const outputName = 'scale_output.mp4'
    const filesToClean = new Set([sourceName, videoTemp, outputName])

    try {
      if (onStatusUpdate) onStatusUpdate('Loading video...')
      const data = new Uint8Array(await file.arrayBuffer())
      await this.ffmpeg.writeFile(sourceName, data)

      const scaleFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p`

      this._mp3Duration = duration
      this._onProgress = onProgress

      if (onStatusUpdate) onStatusUpdate('Scaling video...')
      await this.ffmpeg.exec([
        '-i', sourceName,
        '-vf', scaleFilter,
        '-an',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        videoTemp
      ])

      if (onStatusUpdate) onStatusUpdate('Muxing audio...')

      let muxSuccess = false
      try {
        const res = await this.ffmpeg.exec([
          '-i', videoTemp,
          '-i', sourceName,
          '-map', '0:v:0',
          '-map', '1:a:0',
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-ac', '2',
          '-ar', '44100',
          '-shortest',
          '-movflags', '+faststart',
          outputName
        ])
        if (res === 0) muxSuccess = true
      } catch (e) {
        console.warn('[FFmpeg Scaler] Mux with source audio failed (possibly no audio track).', e)
      }

      if (!muxSuccess) {
        if (onStatusUpdate) onStatusUpdate('Adding silent audio...')
        await this.ffmpeg.exec([
          '-i', videoTemp,
          '-f', 'lavfi',
          '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
          '-map', '0:v:0',
          '-map', '1:a:0',
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-shortest',
          '-movflags', '+faststart',
          outputName
        ])
      }

      if (onStatusUpdate) onStatusUpdate('Finalizing...')
      const output = await this.ffmpeg.readFile(outputName)
      if (onProgress) onProgress(100)
      if (onStatusUpdate) onStatusUpdate('Complete!')

      return new Blob([output.buffer], { type: 'video/mp4' })
    } catch (error) {
      console.error('FFmpeg scaleVideo error:', error)
      throw error
    } finally {
      this._mp3Duration = 0
      this._onProgress = null
      if (onStatusUpdate) onStatusUpdate('Cleaning up virtual files...')
      for (const fileName of filesToClean) {
        try {
          await this.ffmpeg.deleteFile(fileName)
        } catch (e) {
          // Ignore missing files
        }
      }
    }
  }

  /**
   * Convert a WAV file to a high-quality MP3.
   * Matches: ffmpeg -i input.wav -c:a libmp3lame -b:a 320k -ar 44100 -ac 2 output.mp3
   * @param {File} file - Source WAV file
   * @param {number} duration - Source duration in seconds
   * @param {Function} onProgress - Progress callback (percentage)
   * @param {Function} onStatusUpdate - Status text callback
   * @returns {Promise<Blob>} - MP3 as a Blob
   */
  async convertWavToMp3(file, duration, onProgress, onStatusUpdate) {
    if (!this.ffmpeg || !this.loaded) {
      throw new Error('FFmpeg not loaded')
    }

    const sourceName = 'convert_source.wav'
    const outputName = 'convert_output.mp3'
    const filesToClean = new Set([sourceName, outputName])

    try {
      if (onStatusUpdate) onStatusUpdate('Loading WAV...')
      const data = new Uint8Array(await file.arrayBuffer())
      await this.ffmpeg.writeFile(sourceName, data)

      this._mp3Duration = duration
      this._onProgress = onProgress

      if (onStatusUpdate) onStatusUpdate('Encoding MP3 (320 kbps)...')
      const result = await this.ffmpeg.exec([
        '-i', sourceName,
        '-c:a', 'libmp3lame',
        '-b:a', '320k',
        '-ar', '44100',
        '-ac', '2',
        outputName
      ])

      if (typeof result === 'number' && result !== 0) {
        throw new Error('FFmpeg MP3 encode failed')
      }

      if (onStatusUpdate) onStatusUpdate('Finalizing...')
      const output = await this.ffmpeg.readFile(outputName)
      if (onProgress) onProgress(100)
      if (onStatusUpdate) onStatusUpdate('Complete!')

      return new Blob([output.buffer], { type: 'audio/mpeg' })
    } catch (error) {
      console.error('FFmpeg convertWavToMp3 error:', error)
      throw error
    } finally {
      this._mp3Duration = 0
      this._onProgress = null
      if (onStatusUpdate) onStatusUpdate('Cleaning up virtual files...')
      for (const fileName of filesToClean) {
        try {
          await this.ffmpeg.deleteFile(fileName)
        } catch (e) {
          // Ignore missing files
        }
      }
    }
  }
}

export const ffmpegService = new FFmpegService()