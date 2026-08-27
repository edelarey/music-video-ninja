# 🪃 Loop Jitsu

A **100% client-side** Vue 3 video toolkit. Create looped music videos with a custom MP3 soundtrack, stitch clips into one file, or batch upscale/downscale videos — all in the browser with FFmpeg WebAssembly. Nothing is uploaded to a server.

## ✨ Features

### Music Video editor (`/`)

- **🎵 MP3 Audio Track**: Upload an MP3 file as your soundtrack.
- **🎬 Multiple Video Clips**: Add multiple MP4 clips to your project.
- **🌊 Interactive Timeline**: Visual waveform with drag-and-drop regions for precise clip positioning.
- **🔄 Automatic Looping**: Video clips automatically loop to fill their assigned timeline section.
- **🔇 Audio Control**: Input video audio is muted, using only your MP3 soundtrack.

### Video Combiner (`/combiner`)

- **📎 Arrange clips**: Upload clips, then drag or add them onto a timeline in any order.
- **🔁 Repeat clips**: The same source can appear more than once in the sequence.
- **📐 Output resolution**: Re-encode the result to 144p through 1080p (16:9, letterboxed).
- **🔊 Keep clip audio**: Sequential audio from each clip is preserved.

### Batch Scaler (`/scaler`)

- **📋 Multi-file queue**: Select a list of videos and convert each one independently.
- **⬆️⬇️ Up or down**: Upscale 480p/720p to 1080p, or downscale 1080p back to 720p/480p (and other 16:9 sizes).
- **🖼️ Letterbox**: Non-16:9 sources are padded to the target frame.
- **📥 Per-file download**: Download each result, or download the whole completed batch.

Shared across every tool:

- **⚡ Client-Side Processing**: All encoding happens in your browser — no server uploads.
- **📥 One-Click Download**: Finished MP4s download locally.

## 🚀 Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start
```

The app will be available at `http://localhost:5173`.

### Building for Production

```bash
npm run build
npm run preview
```

## 🎯 How to Use

### Music Video

1. **Upload Audio**: Click or drag an MP3 file into the audio uploader.
2. **Upload Video Clips**: Click or drag multiple MP4 files into the video uploader.
3. **Adjust Timeline**: Drag and resize the colored regions on the waveform to position your clips.
4. **Render Video**: Click "Render Video" to start processing. The progress bar will show the status, and your video will automatically download when complete.

### Video Combiner

1. **Upload clips**: Add one or more videos (MP4, WebM, MOV, AVI, MKV).
2. **Arrange the timeline**: Drag clips onto the timeline, click **+** to append, or reorder by dragging. The same clip can be added more than once.
3. **Pick a resolution**: Choose 144p–1080p. Every clip is re-encoded to that 16:9 size.
4. **Combine**: Click **Combine Videos**. The stitched MP4 downloads when encoding finishes.

### Batch Scaler

1. **Select videos**: Click or drag a list of files into the uploader. Each row shows duration, current size (for example `480p · 854×480`), and whether the conversion is an upscale, downscale, or already at the target.
2. **Choose a target**: Select 144p–1080p. Typical use is 480p/720p → 1080p or the reverse.
3. **Scale & download**: Click **Scale Videos**. Files are processed one at a time. Download each result, or use **Download all** when the batch finishes. Videos already at the target resolution are copied rather than re-encoded.

## 🏗️ Technical Architecture

### Core Technologies

- **Vue 3** (Composition API) - Reactive UI framework
- **TypeScript** - Type-safe development for components
- **Vite** - Fast build tool and dev server
- **Pinia** - State management
- **Wavesurfer.js** - Interactive waveform visualization (music video editor)
- **FFmpeg.wasm** - Client-side video processing via `@ffmpeg/ffmpeg`

### The FFmpeg Rendering Pipeline

The rendering process is carefully designed to operate within the memory constraints of a web browser. A naive `ffmpeg` command that tries to loop and re-encode a long video segment at once will crash the browser's WebAssembly instance.

To solve this, the application uses a robust, multi-step "divide and conquer" strategy for each video clip:

**Step 1: Pre-process the Source Clip (Memory-Safe Re-encoding)**
First, a short, memory-safe command re-encodes the *original short clip* to apply scaling and mute its audio. This is the only CPU-intensive step, and it operates on a small file to prevent memory issues.

```bash
# This command is run for each clip.
ffmpeg -i source_clip_N.mp4 -an -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p" \
  -c:v libx264 -preset ultrafast -crf 23 processed_clip_N.mp4
```

**Step 2: Loop via Concat Demuxer (Fast and Memory-Free)**
Next, a temporary text file (`looplist_N.txt`) is created, which lists the newly `processed_clip_N.mp4` multiple times. FFmpeg's `concat` demuxer reads this file to generate a long video loop *without re-encoding*, using virtually no memory. The result is trimmed to the exact duration required for the timeline segment.

```bash
# Create a text file listing the processed clip N times
# file 'processed_clip_N.mp4'
# file 'processed_clip_N.mp4'
# ...

# Loop and trim using stream copy (no re-encoding)
ffmpeg -f concat -safe 0 -i looplist_N.txt -t DURATION -c copy temp_N.mp4
```

**Step 3: Final Concatenation and Audio Muxing**
Finally, all the temporary `temp_N.mp4` segments are stitched together, and the main MP3 audio track is merged in. This step also uses stream copy for the video, making it very fast.

```bash
# 1. Stitch all temp clips together
ffmpeg -f concat -safe 0 -i filelist.txt -c copy stitched.mp4

# 2. Add the main audio track
ffmpeg -i stitched.mp4 -i audio.mp3 -map 0:v:0 -map 1:a:0 -c:v copy \
  -c:a aac -b:a 192k -shortest -movflags +faststart final_output.mp4
```

This architecture ensures stability and performance, even when creating long videos from short, looping clips.

### Combiner and Scaler

**Video Combiner** re-encodes each timeline clip to the chosen 16:9 size (scale + pad), muxes original audio (or silence), then concatenates with the concat demuxer.

**Batch Scaler** runs the same scale/pad/mux path on one file at a time so WASM memory stays bounded. Lanczos scaling is used for cleaner upscales. Videos whose width and height already match the target are skipped.

### Project Structure

```
loop-jitsu/
├── src/
│   ├── components/
│   │   ├── MP3Uploader.vue            # Audio file upload
│   │   ├── MP4Uploader.vue            # Video clips upload (music video)
│   │   ├── WaveformTimeline.vue       # Interactive waveform
│   │   ├── RenderButton.vue           # Music video render control
│   │   ├── combiner/
│   │   │   ├── VideoUploader.vue      # Combiner clip library
│   │   │   ├── CombinerTimeline.vue   # Drag-and-drop sequence
│   │   │   ├── ResolutionSelector.vue # Shared 16:9 resolution picker
│   │   │   └── CombineButton.vue      # Combine + download
│   │   └── scaler/
│   │       ├── ScalerUploader.vue     # Batch file list
│   │       └── ScaleButton.vue        # Batch scale + download
│   ├── const/
│   │   └── resolutions.ts             # Shared 144p–1080p map
│   ├── services/
│   │   ├── ffmpegService.js           # FFmpeg render / combine / scale
│   │   └── ffmpegService.d.ts
│   ├── stores/
│   │   ├── editor.ts                  # Music video state
│   │   ├── combiner.ts                # Combiner state
│   │   └── scaler.ts                  # Batch scaler state
│   ├── views/
│   │   ├── Home.vue                   # Music video page
│   │   ├── VideoCombiner.vue          # Combiner page
│   │   ├── VideoScaler.vue            # Batch scaler page
│   │   └── About.vue
│   ├── router/
│   │   └── index.ts
│   ├── App.vue
│   ├── main.ts
│   └── style.css
├── vite.config.ts
└── package.json
```

## ⚠️ Browser Requirements

This application relies on `SharedArrayBuffer` for multi-threaded FFmpeg performance. This requires specific HTTP headers to be served. The included `vite.config.ts` handles this automatically for development and preview servers.

- **Supported Browsers**: Chrome/Edge 92+, Firefox 89+
- **Incompatible Browsers**: Safari (does not support `SharedArrayBuffer` in workers from different origins, which affects the CDN-based FFmpeg core).
- **RAM**: A minimum of 8GB RAM is recommended for smooth processing.

## 📝 License

MIT License - feel free to use and modify!
