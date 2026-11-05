<template>
  <div class="picker">
    <label class="select-all">
      <input
        ref="allBox"
        data-testid="select-all"
        type="checkbox"
        :checked="store.allSelected"
        :disabled="store.isRendering"
        @change="onAll"
      />
      <span>All 3</span>
    </label>

    <div class="version-grid">
      <label
        v-for="card in cards"
        :key="card.id"
        class="version-card"
        :class="{ on: store.selected[card.id], disabled: store.isRendering }"
      >
        <input
          type="checkbox"
          :data-testid="`version-${card.id}`"
          :checked="store.selected[card.id]"
          :disabled="store.isRendering"
          @change="onOne(card.id, $event)"
        />
        <span class="card-kicker">{{ card.kicker }}</span>
        <span class="card-title">{{ card.title }}</span>
        <span class="card-copy">{{ card.copy }}</span>
      </label>
    </div>

    <details class="advanced">
      <summary>Advanced timing</summary>
      <p>
        The default keeps the tempo and only moves pitch. Tape varispeed is the
        zero-artifact alternative: the same sinc resample, with no time stretch,
        so the song also runs {{ varispeed }}% slower.
      </p>
      <label class="radio">
        <input
          data-testid="tempo-locked"
          type="radio"
          name="timing-mode"
          :checked="store.tempoLocked"
          :disabled="store.isRendering"
          @change="store.tempoLocked = true"
        />
        <span>Tempo-locked pitch shift</span>
      </label>
      <label class="radio">
        <input
          data-testid="tempo-varispeed"
          type="radio"
          name="timing-mode"
          :checked="!store.tempoLocked"
          :disabled="store.isRendering"
          @change="store.tempoLocked = false"
        />
        <span>Tape varispeed −{{ varispeed }}%</span>
      </label>
    </details>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useHarmonicStore } from '@/stores/harmonic'
import { VARISPEED_PERCENT, type VersionId } from '@/services/harmonic/constants'

const store = useHarmonicStore()
const allBox = ref<HTMLInputElement | null>(null)
const varispeed = VARISPEED_PERCENT.toFixed(2)

const cards: { id: VersionId; kicker: string; title: string; copy: string }[] = [
  {
    id: 'ptt',
    kicker: 'Version 1',
    title: '432.081 Hz PTT',
    copy: 'The whole lattice slides down by the Precise Temperament ratio. Tempo stays put.'
  },
  {
    id: 'shimmer',
    kicker: 'Version 2',
    title: '432 + 528 shimmer',
    copy: 'A diffused, widened quarter-tone halo around 528.099 Hz, about 18 dB under the mix.'
  },
  {
    id: 'drone',
    kicker: 'Version 3',
    title: '432 + chakra drone',
    copy: 'A just-ratio drone on the detected tonic, breathing about 20 dB under the mix.'
  }
]

const syncIndeterminate = () => {
  if (!allBox.value) return
  allBox.value.indeterminate = store.someSelected && !store.allSelected
}

onMounted(syncIndeterminate)
watch(() => [store.allSelected, store.someSelected], syncIndeterminate)

const onAll = (event: Event) => {
  store.setAll((event.target as HTMLInputElement).checked)
}

const onOne = (id: VersionId, event: Event) => {
  store.setVersion(id, (event.target as HTMLInputElement).checked)
}
</script>

<style scoped>
.picker { display: flex; flex-direction: column; gap: 1rem; }

.select-all {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
  color: #213547;
  width: fit-content;
}

.version-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
}

.version-card {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 1rem;
  border-radius: 10px;
  border: 2px solid rgba(100, 108, 255, 0.25);
  background: rgba(100, 108, 255, 0.04);
  cursor: pointer;
  text-align: left;
}

.version-card.on {
  border-color: #646cff;
  background: rgba(100, 108, 255, 0.12);
  box-shadow: 0 0 0 3px rgba(100, 108, 255, 0.12);
}

.version-card.disabled { cursor: not-allowed; opacity: 0.7; }
.version-card input { margin-bottom: 0.25rem; }

.card-kicker {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #646cff;
}
.card-title { font-weight: 700; color: #213547; }
.card-copy { color: #666; font-size: 0.9rem; line-height: 1.45; }

.advanced {
  border-top: 1px solid rgba(100, 108, 255, 0.2);
  padding-top: 0.75rem;
}
.advanced summary { cursor: pointer; font-weight: 600; color: #213547; }
.advanced p { margin: 0.6rem 0; color: #666; font-size: 0.9rem; line-height: 1.5; }

.radio {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0.35rem 0;
  color: #213547;
  font-weight: 600;
}

@media (prefers-color-scheme: dark) {
  .select-all, .card-title, .advanced summary, .radio { color: #fff; }
  .card-copy, .advanced p { color: #aaa; }
  .version-card { background: rgba(255, 255, 255, 0.04); border-color: rgba(255, 255, 255, 0.16); }
  .version-card.on { background: rgba(100, 108, 255, 0.22); }
}
</style>
