<template>
  <div class="render-card">
    <div class="status">
      <p v-if="!store.file">Upload a WAV to begin.</p>
      <p v-else-if="store.isAnalyzing">Finding the key before rendering…</p>
      <p v-else-if="store.isRendering">Rendering in a worker — the page stays usable.</p>
      <p v-else-if="store.orderedResults.length">
        {{ store.orderedResults.length }} WAV{{ store.orderedResults.length === 1 ? '' : 's' }} ready. Compare them with the original, then download.
      </p>
      <p v-else-if="store.canRender">
        Ready to render {{ store.selectedIds.length }} WAV version{{ store.selectedIds.length === 1 ? '' : 's' }}.
      </p>
      <p v-else-if="!store.someSelected">Pick at least one version.</p>
    </div>

    <button
      type="button"
      class="render-btn"
      data-testid="render-harmonic"
      :disabled="!store.canRender"
      :class="{ processing: store.isRendering }"
      @click="store.render()"
    >
      <span v-if="!store.isRendering">Render {{ store.selectedIds.length || '' }} WAV{{ store.selectedIds.length === 1 ? '' : 's' }}</span>
      <span v-else><span class="spinner"></span> Rendering…</span>
    </button>

    <ul v-if="store.someSelected && (store.isRendering || store.orderedResults.length)" class="job-list">
      <li v-for="id in store.selectedIds" :key="id" class="job-item" :class="{ complete: !!store.results[id] }">
        <div class="job-main">
          <span class="job-name">{{ titles[id] }}</span>
          <span class="job-meta">{{ store.statusText[id] || (store.results[id] ? 'Ready' : 'Waiting') }}</span>
        </div>
        <div v-if="store.isRendering && !store.results[id]" class="job-progress">
          <div class="job-progress-fill" :style="{ width: `${store.progress[id]}%` }"></div>
        </div>
      </li>
    </ul>

    <p v-if="store.renderError" class="error-note" data-testid="harmonic-error">{{ store.renderError }}</p>

    <div v-if="store.originalUrl && store.orderedResults.length" class="players">
      <article class="player-card">
        <header>
          <h3>Original</h3>
          <span>{{ store.sampleRate }} Hz</span>
        </header>
        <audio data-testid="player-original" :src="store.originalUrl" controls preload="metadata"></audio>
      </article>

      <article v-for="result in store.orderedResults" :key="result.version" class="player-card">
        <header>
          <h3>{{ titles[result.version] }}</h3>
          <span>
            {{ result.sampleRate }} Hz · {{ formatDuration(result.duration) }} · peak {{ result.peakDb.toFixed(1) }} dBFS
          </span>
        </header>
        <audio :data-testid="`player-${result.version}`" :src="result.url" controls preload="auto"></audio>
        <a
          class="download"
          :data-testid="`download-${result.version}`"
          :href="result.url"
          :download="result.filename"
        >
          Download {{ result.filename }}
        </a>
      </article>

      <button
        v-if="store.orderedResults.length > 1 && !store.isRendering"
        type="button"
        class="download-all"
        data-testid="download-all"
        @click="downloadAll"
      >
        Download all ({{ store.orderedResults.length }})
      </button>

      <p class="followup">
        These stay WAV, at the source sample rate.
        <router-link data-testid="wav-to-mp3-link" to="/wav-to-mp3">Open WAV to MP3</router-link>
        if you want 320 kbps copies after you have listened.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useHarmonicStore } from '@/stores/harmonic'
import type { VersionId } from '@/services/harmonic/constants'

const store = useHarmonicStore()

const titles: Record<VersionId, string> = {
  ptt: '432.081 Hz PTT',
  shimmer: '432 + 528 shimmer',
  drone: '432 + chakra drone'
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const downloadAll = async () => {
  for (const result of store.orderedResults) {
    const anchor = document.createElement('a')
    anchor.href = result.url
    anchor.download = result.filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    await new Promise((resolve) => setTimeout(resolve, 350))
  }
}
</script>

<style scoped>
.render-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}
.status p { margin: 0 0 1rem; color: #213547; }

.render-btn {
  width: 100%;
  padding: 1rem 2rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: white;
  background: linear-gradient(135deg, #646cff 0%, #535bf2 100%);
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
.render-btn:hover:not(:disabled) { transform: translateY(-1px); }
.render-btn:disabled { background: #ccc; cursor: not-allowed; }
.render-btn.processing { background: #42b883; cursor: wait; }

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  margin-right: 0.4rem;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  vertical-align: -2px;
}
@keyframes spin { to { transform: rotate(360deg); } }

.job-list { list-style: none; margin: 1rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.job-item {
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid rgba(100, 108, 255, 0.2);
  background: rgba(100, 108, 255, 0.05);
}
.job-item.complete { border-color: #42b883; }
.job-main { display: flex; flex-direction: column; gap: 0.15rem; }
.job-name { font-weight: 600; color: #213547; }
.job-meta { font-size: 0.85rem; color: #666; }
.job-progress { margin-top: 0.45rem; height: 6px; background: #e8e8e8; border-radius: 3px; overflow: hidden; }
.job-progress-fill { height: 100%; background: #646cff; }

.players { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1.25rem; }
.player-card {
  padding: 0.9rem 1rem;
  border-radius: 10px;
  background: rgba(100, 108, 255, 0.05);
  border: 1px solid rgba(100, 108, 255, 0.15);
}
.player-card header { display: flex; justify-content: space-between; gap: 1rem; align-items: baseline; margin-bottom: 0.45rem; }
.player-card h3 { margin: 0; font-size: 1rem; color: #213547; }
.player-card header span { color: #666; font-size: 0.8rem; }
.player-card audio { width: 100%; }

.download, .download-all {
  display: inline-block;
  margin-top: 0.55rem;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}
.download { color: #646cff; }
.download-all {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 2px solid #646cff;
  background: transparent;
  color: #646cff;
  font-size: 1rem;
}
.followup { margin: 0.25rem 0 0; color: #666; font-size: 0.92rem; line-height: 1.5; }
.followup a { color: #646cff; font-weight: 700; }
.error-note { margin: 0.8rem 0 0; color: #cc0000; }

@media (prefers-color-scheme: dark) {
  .render-card { background: #1a1a1a; }
  .status p, .job-name, .player-card h3 { color: #fff; }
  .job-meta, .player-card header span, .followup { color: #aaa; }
  .job-item, .player-card { background: rgba(255, 255, 255, 0.05); border-color: rgba(255, 255, 255, 0.12); }
  .job-progress { background: #333; }
}
</style>
