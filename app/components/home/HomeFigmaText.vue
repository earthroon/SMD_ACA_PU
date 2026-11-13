
<script setup lang="ts">
import HomeSourceText from './HomeSourceText.vue';
import { homePsdLayersForFigma } from '~/utils/homePsdR1Mapping';
import { homeFigmaText, type HomeFigmaTextKey } from '~/data/home-r2-copy';
import { homeR2VisualText } from '~/data/home-r2-visual-text';
import { homeVisibleBrandText } from '~/utils/homeBrandVisibleText';
import { HOME_FILM_INFO_NODE, homeVisibleFilmText } from '~/utils/homeFilmCopyPresentation';
import { isHomeSpecialEmphasisRun, presentHomeSpecialPointRuns } from '~/utils/homeSpecialPointPresentation';
import { homeBenefitsVisibleText } from '~/utils/homeBenefitsCopyPresentation';
import { isHeroCarouselTextNode, resolveHeroCarouselText } from '~/data/home-hero-carousel';

// 신규: 교육 트랙 표시 문구
import { homeTrainingTimelineVisibleText } from '~/utils/homeTrainingTimelineCopyPresentation';

const props = defineProps<{ textKey: HomeFigmaTextKey }>();

const captionIndex = useState<number>(
  'smd-hero-carousel-caption-r1',
  () => 0,
);

const text = computed(() => {
  const sourceRuns = presentHomeSpecialPointRuns(
    props.textKey,
    homeR2VisualText[props.textKey].runs,
  );

  const copy = isHeroCarouselTextNode(props.textKey)
    ? resolveHeroCarouselText(captionIndex.value, props.textKey)
    : null;

  const sourceDisplayed = sourceRuns.map(run =>
    homeBenefitsVisibleText(
      props.textKey,
      homeVisibleFilmText(
        props.textKey,
        homeVisibleBrandText(props.textKey, run.characters),
      ),
    ),
  ).join('');

  if (copy === null || copy === sourceDisplayed) return sourceRuns;

  const first = sourceRuns[0];

  if (!first) {
    throw new Error(
      `HERO_CAROUSEL_SEMANTIC_COPY_RUN_MISSING:${props.textKey}`,
    );
  }

  return [{ ...first, characters: copy }];
});

const source = computed(() => homeFigmaText[props.textKey]);
const psdLayers = computed(() => homePsdLayersForFigma(props.textKey));
// CF2 explicitly retains current presentation until the CF4 layout/paint migration.
const currentRuns = computed(() => text.value.map((run, index) => ({
  characters: homeTrainingTimelineVisibleText(props.textKey,
    homeBenefitsVisibleText(props.textKey, homeVisibleFilmText(props.textKey,
      homeVisibleBrandText(props.textKey, run.characters)))),
  style: textKeyStyle(run.style),
  specialEmphasis: isHomeSpecialEmphasisRun(props.textKey, index),
})));
function textKeyStyle(style: Readonly<Record<string, string | number>>) {
  return props.textKey === HOME_FILM_INFO_NODE ? { ...style, whiteSpace: 'nowrap !important' } : style;
}
</script>

<template>
  <HomeSourceText v-if="psdLayers" mode="current" :layer-ids="psdLayers" :current-runs="currentRuns"
    class="smd-home-figma-text" :data-figma-text="textKey" :data-text-digest="source.textDigest" />
  <span v-else
    class="smd-home-figma-text"
    :data-figma-text="textKey"
    :data-text-digest="source.textDigest"
  >
    <span
      v-for="(run, index) in text"
      :key="index"
      :style="[
        run.style,
        textKey === HOME_FILM_INFO_NODE
          ? { whiteSpace: 'nowrap !important' }
          : undefined,
      ]"
      :data-special-emphasis="
        isHomeSpecialEmphasisRun(textKey, index) ? 'true' : undefined
      "
    >{{
      homeTrainingTimelineVisibleText(
        textKey,
        homeBenefitsVisibleText(
          textKey,
          homeVisibleFilmText(
            textKey,
            homeVisibleBrandText(textKey, run.characters),
          ),
        ),
      )
    }}</span>
  </span>
</template>
