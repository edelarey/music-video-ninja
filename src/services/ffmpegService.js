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
    // Only fires progress updates when _mp3Duration is set (i.e., during processVideo)
    this.ffmpeg.on('progress', ({ time, progress }) => {
      // Skip if _mp3Duration is not set (e.g., during combineVideos which handles its own progress)
      if (!this._mp3Duration || this._mp3Duration <= 0) return
      
      const timeInSeconds = time / 1000000;
      // Log the ffmpeg progress in seconds for readability
      console.log(`[FFmpeg Progress] Time: ${timeInSeconds.toFixed(2)}s / ${this._mp3Duration.toFixed(2)}s`)
      if (this._onProgress) {
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

        filesToClean.add(sourceClipName).add(processedClipName).add(loopListName).add(tempClipName);
        if (clip.loopMode === 'ping-pong') filesToClean.add(reversedClipName);

        // Write original clip to filesystem
        const clipData = new Uint8Array(await clip.source.file.arrayBuffer())
        await this.ffmpeg.writeFile(sourceClipName, clipData)

        // --- Definitive Strategy: Isolate Intensive Operations ---

        // 1. Pre-process: Scale and mute the *short* source clip.
        if (onStatusUpdate) onStatusUpdate(`Pre-processing clip ${i + 1}...`)
        await this.ffmpeg.exec([
          '-i', sourceClipName,
          '-an',
          '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '23',
          processedClipName
        ])

        // 1b. Create reversed clip if needed for ping-pong
        if (clip.loopMode === 'ping-pong') {
          if (onStatusUpdate) onStatusUpdate(`Creating reverse loop for clip ${i + 1}...`)
          await this.ffmpeg.exec([
            '-i', processedClipName,
            '-vf', 'reverse',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '23',
            reversedClipName
          ])
        }

        // 2. Loop: Use the pre-processed clip (and optionally its reverse) with the efficient concat demuxer.
        if (onStatusUpdate) onStatusUpdate(`Looping clip ${i + 1}...`)
        const clipDuration = clip.source.duration
        const loopCount = Math.ceil(segmentDuration / clipDuration)
        let loopListContent = ''
        for (let j = 0; j < loopCount; j++) {
          if (clip.loopMode === 'ping-pong' && j % 2 === 1) {
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
      }

      // Step 2: Create concat file list
      if (onStatusUpdate) onStatusUpdate('Stitching clips together...')
      let fileListContent = ''
      for (let i = 0; i < clips.length; i++) {
        fileListContent += `file 'temp_${i}.mp4'\n`
      }
      await this.ffmpeg.writeFile('filelist.txt', new TextEncoder().encode(fileListContent))

      // Concatenate all clips
      await this.ffmpeg.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'filelist.txt',
        '-c', 'copy',
        'stitched.mp4'
      ])

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

      // Read final output
      if (onStatusUpdate) onStatusUpdate('Finalizing...')
      const data = await this.ffmpeg.readFile('final_output.mp4')

      if (onStatusUpdate) onStatusUpdate('Complete!')

      // Return as Blob
      return new Blob([data.buffer], { type: 'video/mp4' })
    } catch (error) {
      console.error('FFmpeg processing error:', error)
      throw error
    } finally {
      // --- Guaranteed Cleanup ---
      // This block runs whether the process succeeds or fails, ensuring
      // the virtual filesystem is always left clean.
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

        // Pass 1: Video Only (Resize/Pad)
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

        // Pass 2: Audio Only (Extract & Normalize)
        // Ensure EVERY clip has an audio track for successful concatenation
        let audioSuccess = false
        
        try {
          if (onStatusUpdate) onStatusUpdate(`Encoding Audio ${i + 1}/${validClips.length}...`)
          
          // Attempt to extract and normalize audio from source
          const audioRes = await this.ffmpeg.exec([
            '-i', sourceClipName,
            '-vn', // No Video
            '-c:a', 'aac',
            '-b:a', '192k',
            '-ac', '2',
            '-ar', '44100',
            audioTemp
          ])
          
          if (audioRes === 0) {
             audioSuccess = true
          }
        } catch (e) {
           console.warn(`[FFmpeg Combiner] Audio extraction failed for ${sourceClipName}.`, e)
        }

        // If extraction failed (no audio in source), generate silence
        if (!audioSuccess) {
           if (onStatusUpdate) onStatusUpdate(`Generating silence for clip ${i + 1}/${validClips.length}...`)
           console.log(`[FFmpeg Combiner] Generating silence for ${sourceClipName} (${clip.source.duration}s)`)
           
           try {
             await this.ffmpeg.exec([
                '-f', 'lavfi',
                '-i', 'anullsrc=r=44100:cl=stereo',
                '-t', clip.source.duration.toString(),
                '-c:a', 'aac',
                '-b:a', '192k',
                '-ac', '2',
                '-ar', '44100',
                audioTemp
             ])
             audioSuccess = true
           } catch (e) {
             console.error(`[FFmpeg Combiner] Failed to generate silence for ${sourceClipName}`, e)
           }
        }

        // Pass 3: Mux
        // Always mux video and audio (real or silent) to ensure consistent streams
        if (onStatusUpdate) onStatusUpdate(`Muxing clip ${i + 1}/${validClips.length}...`)
        
        const muxInputs = ['-i', videoTemp]
        const muxMaps = ['-map', '0:v:0']
        
        if (audioSuccess) {
            muxInputs.push('-i', audioTemp)
            muxMaps.push('-map', '1:a:0')
        }
        
        await this.ffmpeg.exec([
          ...muxInputs,
          ...muxMaps,
          '-c', 'copy',
          '-shortest', // Ensure we don't extend beyond video if silence is slightly long
          processedClipName
        ])
        
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
}

export const ffmpegService = new FFmpegService()