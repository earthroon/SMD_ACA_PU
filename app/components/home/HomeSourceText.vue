<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import type { HomeCurrentTextRun, HomePsdTextId } from '~/data/home-psd-r1-types';
import { homePsdR1Source } from '~/data/home-psd-r1-manifest';
import { homePsdTextMappings } from '~/data/home-psd-r1-mapping';

const HomePsdTextPaint = defineAsyncComponent(() => import('./HomePsdTextPaint.vue'));
const props = defineProps<{
  mode: 'current' | 'psd';
  layerIds?: readonly number[];
  currentRuns?: readonly HomeCurrentTextRun[];
  layerId?: HomePsdTextId;
}>();
const admittedLayers = computed(() => {
  switch (props.mode) {
    case 'current': {
      if (!props.layerIds?.length || !props.currentRuns?.length) throw new Error('HOME_PSD_CURRENT_PRESENTATION_MISSING');
      const exactMapping = Object.values(homePsdTextMappings).some(ids => ids.length === props.layerIds!.length && ids.every((id, index) => id === props.layerIds![index]));
      if (!exactMapping) throw new Error('HOME_PSD_CURRENT_LAYER_MAPPING_UNKNOWN');
      return props.layerIds;
    }
    case 'psd':
      if (!props.layerId) throw new Error('HOME_PSD_SOURCE_LAYER_MISSING');
      return [Number(props.layerId)];
    default: throw new Error('HOME_PSD_PRESENTATION_MODE_INVALID');
  }
});
</script>

<template>
  <span v-if="mode === 'current'" data-source-mode="current" :data-psd-layers="admittedLayers.join(',')"
    :data-psd-sha256="homePsdR1Source.psdSha256">
    <span v-for="(run, index) in currentRuns" :key="index" :style="run.style"
      :data-special-emphasis="run.specialEmphasis ? 'true' : undefined">{{ run.characters }}</span>
  </span>
  <HomePsdTextPaint v-else-if="admittedLayers.length && layerId" :layer-id="layerId" />
</template>
