# 🪃 Loop Jitsu

A **100% client-side** Vue 3 video editor that lets you create professional video mashups with custom audio tracks. Built with Vite, TypeScript, and powered by FFmpeg WebAssembly.

## ✨ Features

- **🎵 MP3 Audio Track**: Upload an MP3 file (with optional embedded cover art) as your soundtrack
- **🎬 Multiple Video Clips**: Add multiple MP4 clips to your project
- **🌊 Interactive Timeline**: Visual waveform with drag-and-drop regions for precise clip positioning
- **🔄 Automatic Looping**: Video clips automatically loop to fill their assigned timeline section
- **🔇 Audio Control**: Input video audio is muted, using only your MP3 soundtrack
- **⚡ Client-Side Processing**: All processing happens in your browser - no server uploads!
- **📥 One-Click Download**: Render and download your final MP4

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

The app will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
npm run preview
```

## 🎯 How to Use

1. **Upload Audio** (Step 1)
   - Click or drag an MP3 file into the audio uploader
   - The app will extract the duration and display it

2. **Upload Video Clips** (Step 2)
   - Click or drag multiple MP4 files into the video uploader
   - Each clip will be automatically positioned on the timeline

3. **Adjust Timeline** (Step 3)
   - View the interactive waveform of your audio
   - Drag colored regions to reposition clips
   - Resize regions by dragging edges to adjust duration
   - Clips will loop to fill their assigned section

4. **Render Video** (Step 4)
   - Click "Render Video" to start processing
   - Wait for FFmpeg to process (progress bar shows status)
   - Your video will automatically download when complete

## 🏗️ Technical Architecture

### Core Technologies

- **Vue 3** (Composition API) - Reactive UI framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Pinia** - State management
- **Wavesurfer.js** - Interactive waveform visualization
- **FFmpeg.wasm** - Client-side video processing

### FFmpeg Processing Pipeline

The app follows a precise 3-step FFmpeg process:

```bash
# Step 1: Process each clip (loop, mute, scale)
ffmpeg -stream_loop -1 -i clip.mp4 -t DURATION -an \
  -c:v libx264 -preset fast -crf 23 \
  -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p" \
  -map 0:v:0 temp_N.mp4

# Step 2: Concatenate all clips
ffmpeg -f concat -safe 0 -i filelist.txt -c copy stitched.mp4

# Step 3: Mux with MP3 audio
ffmpeg -i stitched.mp4 -i audio.mp3 \
  -map 0:v:0 -map 1:a:0 \
  -c:v libx264 -preset medium -crf 23 -tune stillimage \
  -c:a aac -b:a 192k -t MP3_DURATION \
  -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p" \
  -movflags +faststart final_output.mp4
```

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
│   │   └── ffmpegService.ts      # FFmpeg processing logic
│   ├── stores/
│   │   └── editor.ts             # Pinia state management
│   ├── App.vue                   # Main application
│   ├── main.ts                   # App entry point
│   └── style.css                 # Global styles
├── vite.config.ts                # Vite configuration
└── package.json
```

## 🔧 Key Features Explained

### Audio Processing
- Extracts audio stream only (ignores embedded cover art PNG)
- Maintains original MP3 quality (192kbps AAC output)
- Final video duration matches MP3 length exactly

### Video Processing
- All input video audio is muted (`-an` flag)
- Videos loop seamlessly using `-stream_loop -1`
- Clips are cut to exact assigned duration with `-t`
- Even dimensions ensured for web compatibility
- H.264 encoding with web-optimized settings (`-movflags +faststart`)

### Timeline Management
- Visual waveform representation of audio
- Color-coded regions for each video clip
- Drag to reposition, resize to adjust duration
- Real-time updates to clip positions in state

## 🎨 Customization

### Changing FFmpeg Settings

Edit `src/services/ffmpegService.ts` to adjust:
- Video quality: Change `-crf` value (23 = default, lower = better)
- Encoding speed: Change `-preset` (fast/medium/slow)
- Audio bitrate: Change `-b:a` value

### Styling

- Component styles are scoped in each `.vue` file
- Global styles in `src/style.css`
- Dark/light mode support included

## ⚠️ Browser Requirements

- Modern browser with SharedArrayBuffer support
- Minimum 4GB RAM recommended for video processing
- Chrome/Edge 92+, Firefox 89+, Safari 15.2+

## 📝 License

MIT License - feel free to use and modify!

## 🤝 Contributing

Contributions welcome! Please feel free to submit a Pull Request.

## 🐛 Known Issues

- Large video files (>100MB) may cause memory issues
- Safari may require specific CORS settings
- FFmpeg initial load takes ~10-15 seconds

## 🙏 Credits

- [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) - WebAssembly port of FFmpeg
- [Wavesurfer.js](https://wavesurfer-js.org/) - Audio waveform visualization
- [Vue.js](https://vuejs.org/) - Progressive JavaScript framework
