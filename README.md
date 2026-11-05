# 🪃 Loop Jitsu

A **100% client-side** Vue 3 video and audio toolkit. Create looped music videos with a custom MP3 soundtrack, stitch clips into one file, batch upscale/downscale short clips, upgrade a finished video to 1080p while keeping its soundtrack, retune a WAV from 440 Hz onto 432.081 Hz with optional harmonic layers, or convert WAV to high-quality MP3 — all in the browser. Nothing is uploaded to a server.

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

- **📋 Multi-file queue**: Select a list of **short clips** and convert each one independently.
- **⬆️⬇️ Up or down**: Upscale 480p/720p to 1080p, or downscale 1080p back to 720p/480p (and other 16:9 sizes).
- **🖼️ Letterbox**: Non-16:9 sources are padded to the target frame.
- **📥 Per-file download**: Download each result, or download the whole completed batch.
- Not for one long finished music video — use **HD Upgrade** when you need to keep that soundtrack.

### HD Upgrade (`/upgrade`)

- **🎬 One long video**: Upgrade a finished music video (for example 720p → 1080p) instead of a batch of short clips.
- **🔊 Soundtrack preserved**: Original audio is stream-copied when possible; otherwise re-encoded to AAC 320k. Never muted or replaced.
- **🧠 Memory-safe**: Video is encoded in ~20s slices, then concatenated, so a long file does not exhaust WASM memory.
- **🖼️ Letterbox**: Non-16:9 sources are padded to the target 16:9 frame.

### 432 Retune (`/harmonic`)

- **🎵 WAV in, WAV out:** Upload one uncompressed `.wav`. Downloads stay `.wav` at the file's own sample rate. MP3 encoding stays on **WAV to MP3**.
- **🎚️ Three versions:** Render any combination — or all three — of a Precise Temperament retune to A4 = 432.081 Hz (−31.44 cents, tempo locked by default), a diffused 528.099 Hz quarter-tone shimmer, and a just-ratio chakra drone on the detected tonic.
- **🎹 Key:** Krumhansl–Schmuckler detection from pitch-class chroma, with a manual tonic/mode override. C is Root through B is Crown; accidentals are the bridges between centres.
- **🧵 Worker DSP:** Kaiser-sinc pitch shift plus a small waveform-locked time correction. Peaks are held to −1 dBFS and loudness is matched to the source.

### WAV to MP3 (`/wav-to-mp3`)

- **🎵 Batch convert**: Select one or more `.wav` files and encode each independently.
- **💎 High quality**: `libmp3lame` at **320 kbps CBR**, **44.1 kHz**, stereo — the same settings as `ffmpeg -i input.wav -map_metadata -1 -map_metadata:s:a -1 -c:a libmp3lame -b:a 320k -ar 44100 -ac 2 output.mp3`. Source tags are not copied.
- **📥 Per-file download**: Download each MP3, or download the whole completed batch.

Shared across every tool:

- **⚡ Client-Side Processing**: All encoding happens in your browser — no server uploads.
- **📥 One-Click Download**: Finished files download locally.

## 🚀 Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm or yarn
- No system `ffmpeg` binary. Encoding uses FFmpeg.wasm (`@ffmpeg/ffmpeg` + `@ffmpeg/core-mt`), copied from `node_modules` at dev/build time.

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

1. **Select videos**: Click or drag a list of short clips into the uploader. Each row shows duration, current size (for example `480p · 854×480`), and whether the conversion is an upscale, downscale, or already at the target.
2. **Choose a target**: Select 144p–1080p. Typical use is 480p/720p → 1080p or the reverse.
3. **Scale & download**: Click **Scale Videos**. Files are processed one at a time. Download each result, or use **Download all** when the batch finishes. Videos already at the target resolution are copied rather than re-encoded.

For one long finished video (a rendered music video) where you must keep the soundtrack, use **HD Upgrade** instead.

### HD Upgrade

1. **Select one video**: Upload the finished file (MP4, WebM, MOV, AVI, MKV). Preview plays with sound so you can confirm the soundtrack.
2. **Choose a target**: Default is 1080p. Output is 16:9; other aspect ratios are letterboxed. Pick a size larger than the source (for example 720p → 1080p).
3. **Upgrade & download**: Click **Upgrade to 1080p**. Keep the tab open. Encoding runs in ~20s slices, then the original audio is muxed back. The upgraded MP4 downloads when it finishes.

### 432 Retune

1. **Upload one WAV:** Click or drag an uncompressed `.wav`. The page shows its real sample rate and reads the key.
2. **Choose versions:** Tick any combination, or All 3. Tempo-locked pitch shift is the default; Advanced timing can switch to tape varispeed.
3. **Render:** Preview the original beside each result, then download. Filenames end in `_432Hz_PTT.wav`, `_432_528_shimmer.wav`, and `_432_chakra_drone.wav`. For MP3s, open **WAV to MP3** and drop those files in.

### WAV to MP3

1. **Select WAV files**: Click or drag one or more `.wav` files into the uploader.
2. **Convert**: Click **Convert to MP3**. Each file is encoded to `libmp3lame` 320 kbps / 44.1 kHz stereo. **Scrub WAV metadata** is off by default and leaves the WAV alone. Turn it on to also download a WAV with metadata tags removed. A WAV with no extra metadata still converts.
3. **Download**: Save each MP3, or use **Download all** when the batch finishes. With scrubbing on, each finished file also downloads the scrubbed WAV.

## 🏗️ Technical Architecture

### Core Technologies

- **Vue 3** (Composition API) - Reactive UI framework
- **TypeScript** - Type-safe development for components
- **Vite** - Fast build tool and dev server
- **Pinia** - State management
- **Wavesurfer.js** - Interactive waveform visualization (music video editor)
- **FFmpeg.wasm** - Client-side video processing via `@ffmpeg/ffmpeg` and `@ffmpeg/core-mt`

### FFmpeg.wasm core

The first Convert / Render / Scale / Combine / Upgrade click loads FFmpeg in the browser. Core files are **same-origin**, not unpkg or another CDN:

- `ffmpeg-core.js`, `ffmpeg-core.wasm` (~32MB), and `ffmpeg-core.worker.js` from `@ffmpeg/core-mt/dist/esm`
- Vite copies them to `public/ffmpeg` on `npm start` / `npm run build` (`public/ffmpeg` is gitignored)
- The dev server also serves `/ffmpeg/*` straight from `node_modules` so a stale SPA fallback cannot replace the wasm with `index.html`
- `ffmpegService.load()` fetches those URLs and passes blob URLs into `ffmpeg.load()`

Use the **ESM** core (with `export default`). `@ffmpeg/ffmpeg`'s class worker is `type=module` and loads core with `import()`. The UMD build has no default export, and feeding a Vite-transformed module into classic pthread workers throws `Cannot use import statement outside a module`.

Video encodes cap decoder, filter, and libx264 at **4 threads**. `@ffmpeg/core-mt` 0.12.x pre-creates 32 pthread workers and cannot grow that pool. On machines with 9 or more cores, uncapped libx264 + filters can deadlock with progress stuck at 0%. Concat and stream-copy steps stay uncapped.

Production hosts must send the same COOP/COEP headers as `vite.config.ts` (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`) so `SharedArrayBuffer` is available.

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

### Combiner, Scaler, and HD Upgrade

**Video Combiner** re-encodes each timeline clip to the chosen 16:9 size (scale + pad), muxes original audio (or silence), then concatenates with the concat demuxer.

**Batch Scaler** runs the same scale/pad/mux path on one short file at a time so WASM memory stays bounded. Lanczos scaling is used for cleaner upscales. Videos whose width and height already match the target are skipped. Audio is re-encoded to AAC 192k when present.

**HD Upgrade** is for one long finished video (a rendered music video). Audio is extracted first (stream copy, or AAC 320k if copy is not possible). Video is then scaled in 20-second slices, concatenated with stream copy, and muxed with that soundtrack — never muted or replaced:

```bash
# 1. Extract soundtrack (copy when possible)
ffmpeg -i source.mp4 -vn -map 0:a:0 -c:a copy audio.mp4

# 2. Scale each time slice (video only)
ffmpeg -ss START -t 20 -i source.mp4 -an \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p" \
  -c:v libx264 -preset ultrafast -crf 23 chunk_N.mp4

# 3. Concat slices, then mux original audio
ffmpeg -f concat -safe 0 -i filelist.txt -c copy stitched.mp4
ffmpeg -i stitched.mp4 -i audio.mp4 -map 0:v:0 -map 1:a:0 -c:v copy -c:a copy \
  -movflags +faststart output.mp4
```

**WAV to MP3** encodes each file with `libmp3lame` at 320 kbps CBR, 44.1 kHz, stereo:

```bash
ffmpeg -i input.wav -map_metadata -1 -map_metadata:s:a -1 -c:a libmp3lame -b:a 320k -ar 44100 -ac 2 output.mp3
```

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
│   │   ├── scaler/
│   │   │   ├── ScalerUploader.vue     # Batch file list
│   │   │   └── ScaleButton.vue        # Batch scale + download
│   │   ├── upgrader/
│   │   │   ├── UpgradeUploader.vue    # Single long-video upload
│   │   │   └── UpgradeButton.vue      # HD upgrade + download
│   │   ├── converter/
│   │   │   ├── WavUploader.vue        # WAV file list
│   │   │   └── ConvertButton.vue      # Batch WAV → MP3
│   │   └── harmonic/
│   │       ├── HarmonicUploader.vue   # Single WAV upload
│   │       ├── VersionPicker.vue      # The three retune versions
│   │       ├── KeyPanel.vue           # Key, chakra wheel, drone recipe
│   │       └── HarmonicRender.vue     # Render, preview, download
│   ├── const/
│   │   └── resolutions.ts             # Shared 144p–1080p map
│   ├── services/
│   │   ├── ffmpegService.js           # FFmpeg render / combine / scale / upgrade / convert
│   │   ├── ffmpegService.d.ts
│   │   ├── wavMetadata.js             # Optional WAV chunk scrubber
│   │   └── harmonic/                  # Worker DSP for the 432 retune
│   ├── stores/
│   │   ├── editor.ts                  # Music video state
│   │   ├── combiner.ts                # Combiner state
│   │   ├── scaler.ts                  # Batch scaler state
│   │   ├── upgrader.ts                # HD upgrade state
│   │   ├── converter.ts               # WAV → MP3 state
│   │   └── harmonic.ts                # 432 retune state
│   ├── views/
│   │   ├── Home.vue                   # Music video page
│   │   ├── VideoCombiner.vue          # Combiner page
│   │   ├── VideoScaler.vue            # Batch scaler page
│   │   ├── VideoUpgrader.vue          # HD upgrade page
│   │   ├── WavToMp3.vue               # WAV → MP3 page
│   │   ├── HarmonicEngine.vue         # 432 Hz retune page
│   │   └── About.vue
│   ├── router/
│   │   └── index.ts
│   ├── App.vue
│   ├── main.ts
│   └── style.css
├── vite.config.ts                     # COOP/COEP + copy/serve FFmpeg core
└── package.json
```

`public/ffmpeg` is generated from `@ffmpeg/core-mt` and is gitignored. After `npm install`, `npm start` or `npm run build` creates it.

## ⚠️ Browser Requirements

Multi-threaded FFmpeg.wasm needs `SharedArrayBuffer`, which requires cross-origin isolation. `vite.config.ts` sends these headers on the dev and preview servers; production must send them too:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

FFmpeg core is served from the **same origin** at `/ffmpeg/` (see above), so it no longer depends on unpkg. The first encode in a session loads about 32MB of wasm.

- **Supported Browsers**: Chrome/Edge 92+, Firefox 89+
- **RAM**: A minimum of 8GB RAM is recommended for smooth processing.

## 📝 License

MIT License - feel free to use and modify!
