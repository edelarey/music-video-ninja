<template>
  <div class="resolution-selector">
    <h3>Output Resolution</h3>
    <div class="resolution-options">
      <button
        v-for="res in resolutions"
        :key="res.value"
        class="resolution-btn"
        :class="{ active: store.selectedResolution === res.value }"
        @click="selectResolution(res.value)"
      >
        <span class="res-label">{{ res.label }}</span>
        <span class="res-dimensions">{{ res.width }}×{{ res.height }}</span>
      </button>
    </div>
    <p class="resolution-info">
      Output: {{ store.resolutionConfig.width }}×{{ store.resolutionConfig.height }} (16:9)
    </p>
  </div>
</template>

<script setup lang="ts">
import { useCombinerStore, RESOLUTION_MAP, type Resolution } from '../../stores/combiner'

const store = useCombinerStore()

const resolutions = Object.entries(RESOLUTION_MAP).map(([value, config]) => ({
  value: Number(value) as Resolution,
  label: config.label,
  width: config.width,
  height: config.height
}))

const selectResolution = (resolution: Resolution) => {
  store.setResolution(resolution)
}
</script>

<style scoped>
.resolution-selector {
  width: 100%;
}

.resolution-selector h3 {
  margin: 0 0 1rem 0;
  color: #213547;
  font-size: 1.1rem;
}

.resolution-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.resolution-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
  background: rgba(100, 108, 255, 0.05);
  border: 2px solid rgba(100, 108, 255, 0.2);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 80px;
}

.resolution-btn:hover {
  background: rgba(100, 108, 255, 0.1);
  border-color: rgba(100, 108, 255, 0.4);
}

.resolution-btn.active {
  background: #646cff;
  border-color: #646cff;
  color: white;
}

.res-label {
  font-weight: 600;
  font-size: 1rem;
}

.res-dimensions {
  font-size: 0.75rem;
  opacity: 0.7;
}

.resolution-info {
  margin: 1rem 0 0 0;
  font-size: 0.9rem;
  color: #666;
}

@media (prefers-color-scheme: dark) {
  .resolution-selector h3 {
    color: #fff;
  }

  .resolution-btn {
    background: rgba(100, 108, 255, 0.1);
    border-color: rgba(100, 108, 255, 0.25);
    color: #fff;
  }

  .resolution-btn:hover {
    background: rgba(100, 108, 255, 0.2);
    border-color: rgba(100, 108, 255, 0.4);
  }

  .resolution-btn.active {
    background: #646cff;
    border-color: #646cff;
  }

  .resolution-info {
    color: #aaa;
  }
}
</style>
