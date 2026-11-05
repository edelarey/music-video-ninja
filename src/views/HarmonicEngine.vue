<template>
  <main class="main">
    <section class="card philosophy">
      <h2>Engineering as philosophy</h2>
      <p>
        Generators such as Suno write the song on the concert lattice: A4 = {{ A4_CONCERT }} Hz,
        twelve-tone equal temperament. This page does not change the format. It retunes that
        lattice onto Robert Edward Grant's Precise Temperament, then — if you ask — dresses it
        with the quarter-tone and chakra-tone harmony Toni Mazzotti works with. Input and output
        are WAV only.
      </p>

      <h3>Version 1 — {{ A4_PTT }} Hz PTT retune</h3>
      <p>
        Every partial is multiplied by {{ A4_PTT }} / {{ A4_CONCERT }} = {{ pttRatio }}, which is
        {{ pttCents }} cents. The recording is not sped up unless you open Advanced timing and
        choose tape varispeed ({{ varispeed }}% slower, no time-stretch at all). The default
        keeps the tempo: pitch comes from a Kaiser-windowed sinc resample, the same math as a
        clean sample-rate conversion, and a waveform-locked overlap puts the length back.
        The correction is only about 1.8%, so the vocal does not pick up the metallic flutter
        of a phase vocoder.
      </p>

      <h3>Version 2 — {{ A4_PTT }} Hz plus a {{ FREQ_528 }} Hz quarter-tone shimmer</h3>
      <p>
        In the retuned lattice, C5 sits at {{ c5 }} Hz. Grant's {{ FREQ_528 }} Hz tone is
        {{ FREQ_528 }} / {{ c5 }} = {{ shimmerRatio }}, or {{ shimmerCents }} cents above C5 —
        a quarter-tone, not a semitone and not unison. A dry copy of that shift fights the
        vocal and the drums. This version builds a halo instead: high-passed near {{ SHIMMER_HP_HZ }} Hz,
        low-passed near {{ (SHIMMER_LP_HZ / 1000).toFixed(1) }} kHz, diffused through taps from
        {{ SHIMMER_TAP_MS[0] }} to {{ SHIMMER_TAP_MS[SHIMMER_TAP_MS.length - 1] }} ms, widened in stereo,
        and ridden about {{ Math.abs(SHIMMER_LEVEL_DB) }} dB under the music so it follows the song's own loudness.
      </p>

      <h3>Version 3 — {{ A4_PTT }} Hz plus a chakra drone</h3>
      <p>
        The page reads pitch-class chroma and names the key with the Krumhansl–Schmuckler profiles.
        You can override the tonic. C is Root, D Sacral, E Solar Plexus, F Heart, G Throat,
        A Third Eye, B Crown. Sharps and flats are the bridges between those centres.
        The drone is a low, breathing bed on that tonic in {{ A4_PTT }} Hz tuning: unison 1:1,
        octave 2:1, a pure fifth 3:2 ({{ fifthCents }} cents), a ninth 9:8, and — in major keys
        only — Grant's major third 2^(1/3) = {{ majorThird }}. Minor keys stay on the open fifth
        and ninth so a third never argues with the mode. The bed is filtered from
        {{ DRONE_HP_HZ }} Hz to {{ DRONE_LP_HZ }} Hz, breathes at {{ DRONE_BREATH_HZ }} Hz, and sits
        about {{ Math.abs(DRONE_LEVEL_DB) }} dB under the retuned mix.
      </p>

      <pre class="command">{{ formula }}</pre>
      <p class="note">
        Processing runs in a Web Worker, so a full-length stereo WAV does not freeze the page.
        ffmpeg.wasm in this app can approximate a pitch move with asetrate and atempo, but that
        build has no Rubber Band, and atempo on a vocal is the flutter this path is built to avoid.
        Each render is 24-bit PCM at the file's own sample rate, peaked at or below {{ PEAK_CEILING_DB }} dBFS,
        with loudness matched to the source for a fair A/B.
      </p>
    </section>

    <section class="card">
      <h2>1. Upload a WAV</h2>
      <HarmonicUploader />
    </section>

    <section class="card">
      <h2>2. Choose the versions</h2>
      <VersionPicker />
    </section>

    <section v-if="store.file" class="card">
      <h2>3. Key and chakra</h2>
      <KeyPanel />
    </section>

    <section class="render-section">
      <h2>{{ store.file ? '4' : '3' }}. Render, listen, download</h2>
      <HarmonicRender />
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import HarmonicUploader from '@/components/harmonic/HarmonicUploader.vue'
import VersionPicker from '@/components/harmonic/VersionPicker.vue'
import KeyPanel from '@/components/harmonic/KeyPanel.vue'
import HarmonicRender from '@/components/harmonic/HarmonicRender.vue'
import { useHarmonicStore } from '@/stores/harmonic'
import {
  A4_CONCERT,
  A4_PTT,
  C5_PTT,
  DRONE_BREATH_HZ,
  DRONE_HP_HZ,
  DRONE_LEVEL_DB,
  DRONE_LP_HZ,
  FREQ_528,
  JUST_FIFTH_CENTS,
  PEAK_CEILING_DB,
  PTT_CENTS,
  PTT_MAJOR_THIRD,
  PTT_RATIO,
  SHIMMER_CENTS,
  SHIMMER_HP_HZ,
  SHIMMER_LEVEL_DB,
  SHIMMER_LP_HZ,
  SHIMMER_RATIO,
  SHIMMER_TAP_MS,
  VARISPEED_PERCENT,
  formatCents
} from '@/services/harmonic/constants'

const store = useHarmonicStore()
const pttRatio = PTT_RATIO.toFixed(6)
const pttCents = formatCents(PTT_CENTS)
const c5 = C5_PTT.toFixed(3)
const shimmerRatio = SHIMMER_RATIO.toFixed(6)
const shimmerCents = formatCents(SHIMMER_CENTS)
const fifthCents = formatCents(JUST_FIFTH_CENTS)
const majorThird = PTT_MAJOR_THIRD.toFixed(6)
const varispeed = VARISPEED_PERCENT.toFixed(2)

const formula = computed(() =>
  [
    `PTT ratio       ${A4_PTT} / ${A4_CONCERT} = ${pttRatio}   (${pttCents} cents)`,
    `C5 at 432.081   ${A4_PTT} × 2^(3/12) = ${c5} Hz`,
    `528.099 halo    ${FREQ_528} / ${c5} = ${shimmerRatio}   (${shimmerCents} cents)`,
    `just fifth      3:2 = ${fifthCents} cents`,
    `PTT major third 2^(1/3) = ${majorThird}`
  ].join('\n')
)
</script>

<style scoped>
.main {
  flex: 1;
  max-width: 1100px;
  width: 100%;
  margin: 0 auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.card h2, .philosophy h3 {
  margin: 0 0 0.75rem;
  color: #213547;
}

.philosophy h3 { margin-top: 1.1rem; font-size: 1.05rem; }
.philosophy p, .note {
  margin: 0 0 0.75rem;
  color: #444;
  line-height: 1.65;
}

.command {
  margin: 0 0 0.75rem;
  padding: 0.75rem 1rem;
  background: rgba(100, 108, 255, 0.08);
  border-radius: 8px;
  overflow-x: auto;
  font-size: 0.82rem;
  color: #213547;
  line-height: 1.55;
}

.note { margin-bottom: 0; font-size: 0.92rem; color: #666; }

.render-section h2 {
  margin: 0 0 1rem;
  color: white;
  font-size: 1.3rem;
  text-align: center;
}

@media (prefers-color-scheme: dark) {
  .card { background: #1a1a1a; }
  .card h2, .philosophy h3, .command { color: #fff; }
  .philosophy p, .note { color: #bbb; }
  .command { background: rgba(100, 108, 255, 0.15); }
}
</style>
