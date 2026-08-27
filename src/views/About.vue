<template>
  <div class="about-page">
    <h2>About Loop Jitsu</h2>
    <p>
      Loop Jitsu is a client-side video toolkit that runs entirely in your web browser. Use it to
      build looped music videos synced to an MP3, combine clips into one file, or batch
      upscale/downscale a list of videos. Because all processing happens on your computer, your
      files remain private and secure.
    </p>

    <h3>How It Works</h3>
    <p>
      The application leverages modern web technologies like <strong>FFmpeg.wasm</strong> for video
      processing and <strong>WaveSurfer.js</strong> for audio visualization. Complex encoding runs
      locally — nothing is uploaded to a server.
    </p>

    <h3>Music Video</h3>
    <p>
      Sync video clips to an MP3 soundtrack. Clips loop to fill their timeline region, source audio
      is muted, and the rendered video matches the MP3 duration exactly.
    </p>
    <ol>
      <li>
        <strong>Upload Audio:</strong> Start by uploading an MP3 file. This will serve as the
        soundtrack for your video. The waveform will be generated, giving you a visual
        representation of the audio.
      </li>
      <li>
        <strong>Upload Video Clips:</strong> Add one or more MP4 video clips. These are the visual
        elements you'll sync with your audio. You can add the same clip multiple times.
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
        <strong>Render Your Video:</strong> Once you are happy with your timeline, click the
        "Render Video" button. The application will process the video and audio, and a download
        will begin automatically.
        <ul>
          <li>
            <strong>Automatic Scaling:</strong> During rendering, all clip segments on the timeline
            are automatically and proportionally scaled to perfectly match the total duration of
            the MP3 audio. This ensures a seamless final video with no gaps or overlaps, regardless
            of how you've arranged them.
          </li>
          <li>The final video will have the exact same duration as your MP3.</li>
        </ul>
      </li>
    </ol>
    <p>
      <router-link to="/" class="inline-link">Open Music Video →</router-link>
    </p>

    <h3>Video Combiner</h3>
    <p>
      Stitch full clips into a single video at a chosen 16:9 resolution. Unlike the music video
      editor, combiner keeps each clip's audio and does not loop or trim against a soundtrack.
    </p>
    <ol>
      <li>
        <strong>Upload clips:</strong> Add one or more videos (MP4, WebM, MOV, AVI, MKV). Click a
        clip to preview it.
      </li>
      <li>
        <strong>Arrange the timeline:</strong> Drag clips onto the timeline, or click <strong>+</strong>
        to append. Reorder by dragging. The same source can appear more than once. Remove a clip
        with × or by selecting it and pressing Delete.
      </li>
      <li>
        <strong>Pick a resolution:</strong> Choose 144p through 1080p. Every clip is re-encoded to
        that size; non-16:9 sources are letterboxed.
      </li>
      <li>
        <strong>Combine:</strong> Click <strong>Combine Videos</strong>. When encoding finishes, the
        stitched MP4 downloads automatically.
      </li>
    </ol>
    <p>
      <router-link to="/combiner" class="inline-link">Open Video Combiner →</router-link>
    </p>

    <h3>Batch Scaler</h3>
    <p>
      Convert a list of videos to a new resolution without combining them. Use this to upscale
      480p or 720p footage to 1080p, or to downscale 1080p back down.
    </p>
    <ol>
      <li>
        <strong>Select videos:</strong> Click or drag multiple files into the uploader. Each row
        shows duration, current resolution (for example <strong>480p · 854×480</strong>), and
        whether the job is an upscale, a downscale, or already at the target.
      </li>
      <li>
        <strong>Choose a target:</strong> Select 144p–1080p. Output is always 16:9; other aspect
        ratios are letterboxed. Audio is preserved when the source has a track.
      </li>
      <li>
        <strong>Scale &amp; download:</strong> Click <strong>Scale Videos</strong>. Files are
        processed one at a time so the browser stays within memory limits. Download each finished
        file, or use <strong>Download all</strong> when the batch is done. Videos that already
        match the target size are copied instead of re-encoded.
      </li>
    </ol>
    <p>
      <router-link to="/scaler" class="inline-link">Open Batch Scaler →</router-link>
    </p>

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

.inline-link {
  color: #646cff;
  font-weight: 600;
  text-decoration: none;
}

.inline-link:hover {
  text-decoration: underline;
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

@media (prefers-color-scheme: dark) {
  .about-page {
    background: #1a1a1a;
    color: #eee;
  }

  h2, h3 {
    color: #fff;
  }
}
</style>
