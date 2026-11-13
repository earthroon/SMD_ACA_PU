<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { HomePsdTextId } from '~/data/home-psd-r1-types';
import { homePsdR1Source } from '~/data/home-psd-r1-manifest';
import { homePsdPositionedLines, homePsdSvgRunStyle, homePsdTextById, homePsdTextLines } from '~/utils/homePsdR1Text';

const props = defineProps<{ layerId: HomePsdTextId }>();
const record = computed(() => homePsdTextById(props.layerId));
const lines = computed(() => record.value ? homePsdTextLines(record.value) : []);
const segments = computed(() => lines.value.flatMap(line => line.segments));
const widths = ref<Record<string, number> | null>(null);
const positioned = computed(() => widths.value ? homePsdPositionedLines(lines.value, widths.value) : []);
const measuring = ref<SVGSVGElement | null>(null);
const gate = ref<'UNMEASURED' | 'READY' | 'ERROR'>('UNMEASURED');
const failure = ref<string | null>(null);
const viewBox = computed(() => {
  const b = record.value?.bbox;
  return b ? `${b[0]} ${b[1]} ${b[2]! - b[0]!} ${b[3]! - b[1]!}` : undefined;
});
let generation = 0;
let mounted = false;

async function measure(): Promise<void> {
  const current = ++generation;
  widths.value = null;
  failure.value = null;
  gate.value = 'UNMEASURED';
  try {
    await nextTick();
    const element = measuring.value;
    if (!element) throw new Error('HOME_PSD_MEASURE_ELEMENT_MISSING');
    const nodes = Array.from(element.querySelectorAll<SVGTextElement>('text[data-measure-key]'));
    if (nodes.length !== segments.value.length) throw new Error('HOME_PSD_MEASURE_RUN_COUNT');
    const css = nodes.map(node => getComputedStyle(node));
    if (css.some(style => !/Pretendard/i.test(style.fontFamily))) throw new Error('HOME_PSD_FONT_FAMILY_MISSING');
    const loaded = await Promise.all(nodes.map((node, index) => document.fonts.load(
      `${css[index]!.fontStyle} ${css[index]!.fontWeight} ${css[index]!.fontSize} "Pretendard Variable"`, node.textContent ?? '',
    )));
    if (loaded.some(faces => faces.length === 0)) throw new Error('HOME_PSD_PRETENDARD_NOT_LOADED');
    await document.fonts.ready;
    if (current !== generation) return;
    const measured = Object.fromEntries(nodes.map(node => [node.dataset.measureKey!, node.getComputedTextLength()]));
    homePsdPositionedLines(lines.value, measured);
    widths.value = measured;
    gate.value = 'READY';
  } catch (error) {
    if (current !== generation) return;
    failure.value = error instanceof Error ? error.message : String(error);
    gate.value = 'ERROR';
    console.error(failure.value);
  }
}
onMounted(() => { mounted = true; void measure(); });
watch(() => props.layerId, () => { if (mounted) void measure(); });
onBeforeUnmount(() => { mounted = false; generation++; });
</script>

<template>
  <span class="smd-home-source-text" data-source-mode="psd" :data-psd-layers="record.sourceLayerId"
    :data-psd-sha256="homePsdR1Source.psdSha256" :data-source-text-digest="record.sourceTextDigest">
    <template v-if="record">
      <svg ref="measuring" class="smd-home-source-text__measure" aria-hidden="true" focusable="false">
        <text v-for="segment in segments" :key="segment.key" :data-measure-key="segment.key"
          :style="homePsdSvgRunStyle(segment.style)">{{ segment.characters }}</text>
      </svg>
      <svg :viewBox="viewBox" :width="record.bbox[2]! - record.bbox[0]!" :height="record.bbox[3]! - record.bbox[1]!"
        class="smd-home-source-text__paint" role="img" :aria-label="record.rawText.replace(/\r/g, '\n')"
        :data-text-gate="gate" :data-text-error="failure || undefined">
        <g v-if="gate === 'READY'" :transform="`matrix(${record.transform.join(' ')})`" :opacity="record.layerOpacity / 255" aria-hidden="true">
          <template v-for="(line, index) in positioned" :key="index">
            <text v-for="segment in line.segments" :key="segment.key" :transform="segment.transform"
              :style="homePsdSvgRunStyle(segment.style)" :data-source-start="segment.startUtf16"
              :data-source-end="segment.endUtf16">{{ segment.characters }}</text>
          </template>
        </g>
      </svg>
      <span v-if="failure" role="alert">{{ failure }}</span>
    </template>
  </span>
</template>
