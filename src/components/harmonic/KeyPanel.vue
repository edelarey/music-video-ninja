<template>
  <div class="key-panel">
    <p v-if="store.isAnalyzing" class="muted">Reading pitch-class chroma…</p>
    <template v-else-if="store.detectedKey">
      <p class="detected" data-testid="detected-key">
        Detected <strong>{{ detectedLabel }}</strong>
        · {{ detectedChakra.name }}
      </p>
      <p v-if="store.detectedKey.ambiguous" class="muted">
        Low confidence — the profile match is soft. Set the tonic yourself if the song is modal or mostly one note.
      </p>
      <p v-else-if="store.detectedKey.runnerUp" class="muted">
        Next closest: {{ runnerUpLabel }}.
        Profile match {{ store.detectedKey.correlation.toFixed(2) }}.
      </p>

      <div class="wheel-wrap">
        <div class="wheel" aria-hidden="false">
          <button
            v-for="(label, index) in PITCH_CLASS_SHORT"
            :key="label"
            type="button"
            class="spoke"
            :class="{
              active: store.effectiveTonic === index,
              bridge: CHAKRA_BY_PITCH_CLASS[index]?.bridge
            }"
            :style="{ '--i': String(index) }"
            :disabled="store.isRendering"
            @click="store.chooseTonic(index)"
          >
            {{ label }}
          </button>
          <div class="wheel-center">
            <strong>{{ activeChakra.name }}</strong>
            <span>{{ effectiveLabel }}</span>
          </div>
        </div>
      </div>

      <p class="wheel-note">
        Naturals name the seven centres. Sharps and flats are the bridges between them.
        A 24-tone wheel would set a quarter-tone halfway between each semitone — the same
        neighbourhood as 528.099 Hz sitting {{ shimmerCents }} cents above C5.
      </p>

      <div class="mode-row">
        <button
          type="button"
          class="mode-btn"
          :class="{ on: store.effectiveMode === 'major' }"
          :disabled="store.isRendering"
          @click="store.chooseMode('major')"
        >
          Major
        </button>
        <button
          type="button"
          class="mode-btn"
          :class="{ on: store.effectiveMode === 'minor' }"
          :disabled="store.isRendering"
          @click="store.chooseMode('minor')"
        >
          Minor
        </button>
        <button
          v-if="store.overrideEnabled"
          type="button"
          class="text-btn"
          :disabled="store.isRendering"
          @click="store.resetKey()"
        >
          Use detected key
        </button>
      </div>

      <p v-if="store.overrideEnabled" class="override-note">
        Drone override: <strong>{{ effectiveLabel }}</strong> · {{ activeChakra.name }}.
        {{ activeChakra.explanation }}
      </p>
      <p v-else class="muted">{{ detectedChakra.explanation }} Click the wheel to override the tonic.</p>

      <div class="recipe">
        <h3>Drone recipe in 432.081 Hz tuning</h3>
        <p>
          Fundamental {{ fundamental.note }} at {{ fundamental.hz.toFixed(2) }} Hz,
          then pure ratios, high-passed at 45 Hz and low-passed at 1.2 kHz,
          breathing at 0.08 Hz.
        </p>
        <ul>
          <li v-for="partial in recipe" :key="partial.label">
            <span>{{ partial.label }}</span>
            <span>{{ (fundamental.hz * partial.ratio).toFixed(2) }} Hz</span>
          </li>
        </ul>
        <p v-if="store.effectiveMode === 'minor'" class="muted">
          Minor keys stay on the open fifth and ninth. The PTT major third is left out so the bed does not fight the mode.
        </p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useHarmonicStore } from '@/stores/harmonic'
import {
  CHAKRA_BY_PITCH_CLASS,
  PITCH_CLASS_SHORT,
  SHIMMER_CENTS,
  chakraFor,
  droneRecipe,
  formatCents,
  keyName,
  midiNoteName,
  tonicFundamental
} from '@/services/harmonic/constants'

const store = useHarmonicStore()
const shimmerCents = formatCents(SHIMMER_CENTS)

const detectedLabel = computed(() =>
  store.detectedKey ? keyName(store.detectedKey.tonic, store.detectedKey.mode) : ''
)
const detectedChakra = computed(() => chakraFor(store.detectedKey?.tonic ?? 0))
const runnerUpLabel = computed(() => {
  const runner = store.detectedKey?.runnerUp
  return runner ? keyName(runner.tonic, runner.mode) : ''
})
const effectiveLabel = computed(() => keyName(store.effectiveTonic, store.effectiveMode))
const activeChakra = computed(() => chakraFor(store.effectiveTonic))
const fundamental = computed(() => {
  const fund = tonicFundamental(store.effectiveTonic)
  return { ...fund, note: midiNoteName(fund.midi) }
})
const recipe = computed(() => droneRecipe(store.effectiveMode))
</script>

<style scoped>
.key-panel { display: flex; flex-direction: column; gap: 0.75rem; color: #213547; }
.detected { margin: 0; font-size: 1.05rem; }
.muted { margin: 0; color: #666; font-size: 0.9rem; line-height: 1.5; }
.wheel-note, .override-note { margin: 0; color: #666; font-size: 0.9rem; line-height: 1.5; }

.wheel-wrap { display: flex; justify-content: center; }
.wheel {
  position: relative;
  width: min(320px, 100%);
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(100, 108, 255, 0.14), transparent 68%);
}
.spoke {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 64px;
  margin-left: -32px;
  margin-top: -16px;
  transform: rotate(calc(var(--i) * 30deg)) translateY(-118px) rotate(calc(var(--i) * -30deg));
  border: 1px solid rgba(100, 108, 255, 0.35);
  background: white;
  color: #213547;
  border-radius: 999px;
  padding: 0.2rem 0.3rem;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}
.spoke.bridge { border-style: dashed; font-weight: 600; color: #666; }
.spoke.active { background: #646cff; color: white; border-color: #646cff; }
.spoke:disabled { cursor: not-allowed; }

.wheel-center {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 120px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.wheel-center strong { font-size: 0.95rem; }
.wheel-center span { font-size: 0.8rem; color: #666; }

.mode-row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.mode-btn, .text-btn {
  border-radius: 8px;
  padding: 0.4rem 0.8rem;
  font-weight: 700;
  cursor: pointer;
}
.mode-btn { border: 1px solid rgba(100, 108, 255, 0.4); background: transparent; color: #213547; }
.mode-btn.on { background: #646cff; color: white; border-color: #646cff; }
.text-btn { border: none; background: transparent; color: #646cff; }

.recipe {
  padding: 0.9rem 1rem;
  border-radius: 8px;
  background: rgba(100, 108, 255, 0.06);
}
.recipe h3 { margin: 0 0 0.4rem; font-size: 1rem; }
.recipe p { margin: 0 0 0.5rem; color: #666; font-size: 0.9rem; line-height: 1.5; }
.recipe ul { list-style: none; margin: 0; padding: 0; }
.recipe li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.2rem 0;
  font-size: 0.9rem;
  color: #213547;
}

@media (max-width: 700px) {
  .spoke { transform: rotate(calc(var(--i) * 30deg)) translateY(-96px) rotate(calc(var(--i) * -30deg)); width: 52px; margin-left: -26px; font-size: 0.7rem; }
}

@media (prefers-color-scheme: dark) {
  .key-panel, .recipe li, .mode-btn { color: #fff; }
  .muted, .wheel-note, .override-note, .recipe p, .wheel-center span, .spoke.bridge { color: #aaa; }
  .spoke { background: #1a1a1a; color: #fff; }
  .spoke.active { background: #646cff; color: white; }
  .recipe { background: rgba(255, 255, 255, 0.05); }
}
</style>
