<template>
  <div class="about-page">
    <h2>About Loop Jitsu</h2>
    <p>
      Loop Jitsu is a powerful, client-side video editor that runs entirely in your web browser. It allows you to create dynamic, perfectly looped music videos by syncing video clips to an MP3 soundtrack. Because all processing happens on your computer, your files remain private and secure.
    </p>

    <h3>How It Works</h3>
    <p>
      The application leverages modern web technologies like <strong>FFmpeg.wasm</strong> for video processing and <strong>WaveSurfer.js</strong> for audio visualization. This means you can perform complex video editing tasks without needing to upload your files to a server.
    </p>

    <h3>How to Use Loop Jitsu</h3>
    <ol>
      <li>
        <strong>Upload Audio:</strong> Start by uploading an MP3 file. This will serve as the soundtrack for your video. The waveform will be generated, giving you a visual representation of the audio.
      </li>
      <li>
        <strong>Upload Video Clips:</strong> Add one or more MP4 video clips. These are the visual elements you'll sync with your audio. You can add the same clip multiple times.
      </li>
      <li>
        <strong>Build Your Timeline:</strong>
        <ul>
          <li>Drag video clips from the "Available Clips" list and drop them onto the waveform to place them on the timeline.</li>
          <li>Use the playback controls (Play, Pause, Rewind, Fast-Forward) to navigate the audio.</li>
          <li>Drag the colored regions on the timeline to change their start and end points.</li>
          <li>Resize regions by dragging their edges to make them longer or shorter.</li>
          <li>To remove a clip from the timeline, click on it to select it (it will be highlighted) and press the <strong>Delete</strong> key.</li>
        </ul>
      </li>
      <li>
        <strong>Render Your Video:</strong> Once you are happy with your timeline, click the "Render Video" button. The application will process the video and audio, and a download will begin automatically.
        <ul>
          <li><strong>Automatic Scaling:</strong> During rendering, all clip segments on the timeline are automatically and proportionally scaled to perfectly match the total duration of the MP3 audio. This ensures a seamless final video with no gaps or overlaps, regardless of how you've arranged them.</li>
          <li>The final video will have the exact same duration as your MP3.</li>
        </ul>
      </li>
    </ol>

    <router-link to="/" class="back-link">← Back to Editor</router-link>
  </div>
</template>

<script setup lang="ts">
// No script needed for this simple page
</script>

<style scoped>
.about-page {
  max-width: 800px;
  margin: 2rem auto;
  padding: 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  color: #213547;
}

h2, h3 {
  color: #213547;
  border-bottom: 2px solid #646cff;
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}

p, li {
  line-height: 1.7;
  font-size: 1rem;
}

ol, ul {
  padding-left: 2rem;
  margin-bottom: 1.5rem;
}

li {
  margin-bottom: 0.5rem;
}

strong {
  color: #535bf2;
}

.back-link {
  display: inline-block;
  margin-top: 2rem;
  padding: 0.75rem 1.5rem;
  background: #646cff;
  color: white;
  text-decoration: none;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.back-link:hover {
  background: #535bf2;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(100, 108, 255, 0.4);
}
</style>