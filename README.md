# 🪃 Loop Jitsu

A **100% client-side** Vue 3 video editor that lets you create professional video mashups with custom audio tracks. Built with Vite, TypeScript, and powered by FFmpeg WebAssembly.

## ✨ Features

- **🎵 MP3 Audio Track**: Upload an MP3 file as your soundtrack.
- **🎬 Multiple Video Clips**: Add multiple MP4 clips to your project.
- **🌊 Interactive Timeline**: Visual waveform with drag-and-drop regions for precise clip positioning.
- **🔄 Automatic Looping**: Video clips automatically loop to fill their assigned timeline section.
- **🔇 Audio Control**: Input video audio is muted, using only your MP3 soundtrack.
- **⚡ Client-Side Processing**: All processing happens in your browser—no server uploads!
- **📥 One-Click Download**: Render and download your final MP4.

## 🚀 Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Building for Production

```bash
npm run build
npm run preview
```

## 🎯 How to Use

1.  **Upload Audio**: Click or drag an MP3 file into the audio uploader.
2.  **Upload Video Clips**: Click or drag multiple MP4 files into the video uploader.
3.  **Adjust Timeline**: Drag and resize the colored regions on the waveform to position your clips.
4.  **Render Video**: Click "Render Video" to start processing. The progress bar will show the status, and your video will automatically download when complete.

## 🏗️ Technical Architecture

### Core Technologies

- **Vue 3** (Composition API) - Reactive UI framework
- **TypeScript** - Type-safe development for components
- **Vite** - Fast build tool and dev server
- **Pinia** - State management
- **Wavesurfer.js** - Interactive waveform visualization
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

### Project Structure

```
loop-jitsu/
├── src/
│   ├── components/
│   │   ├── MP3Uploader.vue       # Audio file upload
│   │   ├── MP4Uploader.vue       # Video clips upload
│   │   ├── WaveformTimeline.vue  # Interactive waveform
│   │   └── RenderButton.vue      # Render control
│   ├── services/
│   │   ├── ffmpegService.js      # The core FFmpeg rendering logic
│   │   └── ffmpegService.d.ts    # Type declarations for the JS service
│   ├── stores/
│   │   └── editor.ts             # Pinia state management
│   ├── App.vue                   # Main application
│   ├── main.ts                   # App entry point
│   └── style.css                 # Global styles
├── vite.config.ts                # Vite configuration
└── package.json
```

## ⚠️ Browser Requirements

This application relies on `SharedArrayBuffer` for multi-threaded FFmpeg performance. This requires specific HTTP headers to be served. The included `vite.config.ts` handles this automatically for development and preview servers.

- **Supported Browsers**: Chrome/Edge 92+, Firefox 89+
- **Incompatible Browsers**: Safari (does not support `SharedArrayBuffer` in workers from different origins, which affects the CDN-based FFmpeg core).
- **RAM**: A minimum of 8GB RAM is recommended for smooth processing.

## 📝 License

MIT License - feel free to use and modify!
