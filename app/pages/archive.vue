<script setup lang="ts">
import { useSiteContent } from '~/composables/useSiteContent';
import CmsSlot from '~/components/cms/CmsSlot.vue';
import PageHero from '~/components/feature/PageHero.vue';
import ArchiveGallery from '~/components/feature/ArchiveGallery.vue';
import GalleryFrame2 from '~/components/gallery/GalleryFrame2.vue';
import GalleryStandalonePreview from '~/components/gallery/GalleryStandalonePreview.vue';
import { useContentMode } from '~/composables/useContentMode';
import CtaBand from '~/components/feature/CtaBand.vue';
import GalleryCtaFrame3 from '~/components/gallery/GalleryCtaFrame3.vue';
import { galleryNavigationPresentation } from '~/utils/gallery-presentation';

const c = useSiteContent();
// Standalone uses an explicitly UNPUBLISHED gallery design fixture in dev and Workers production.
// This route-local decision never changes CMS/V3 or other page data sources.
const localGalleryPreview = useContentMode() === 'standalone';
const pages = computed(() => c.value?.pages);
const galleryV3 = computed(() => {
  const archive = c.value?.archive;
  return archive && 'kind' in archive && archive.kind === 'archive-collection' &&
    archive.schemaVersion === 3 ? archive : null;
});
const archiveNavigationLabel=computed(()=>{
  const all=[...(c.value?.navigation.leftNav??[]),...(c.value?.navigation.rightNav??[])];
  return galleryNavigationPresentation(all.find(link=>link.to==='/archive') ?? { to: '/archive', label: '수강갤러리' }).label;
});
useSeoMeta({title:computed(()=>`${archiveNavigationLabel.value} | SMD 아카데미`)});
</script>

<template>
  <GalleryStandalonePreview v-if="localGalleryPreview" />
  <template v-else>
  <GalleryFrame2
    v-if="galleryV3 && c"
    :archive="galleryV3"
    :publication-id="c.publication.id"
    :publication-digest="c.publication.digest"
    :eyebrow="pages?.archive.hero.eyebrow ?? ''"
    :title-lines="pages?.archive.hero.titleLines ?? []"
    :lede-segments="pages?.archive.hero.ledeSegments ?? []"
  />
  <template v-else>
    <!-- Historical V2 or legacy publication: preserve the original rendering semantics. -->
    <PageHero :eyebrow="pages?.archive.hero.eyebrow ?? ''" :lede="pages?.archive.hero.ledeSegments.join(' ')">
      <template #title>{{ pages?.archive.hero.titleLines[0] }}<br />{{ pages?.archive.hero.titleLines[1] }}</template>
    </PageHero>
    <ArchiveGallery mode="full" />
  </template>
  </template>
  <CmsSlot :nodes="c?.pageSlots.archive.afterGallery ?? []" />
  <CmsSlot :nodes="c?.pageSlots.archive.beforeCta ?? []" />
  <GalleryCtaFrame3 v-if="localGalleryPreview || galleryV3" />
  <CtaBand v-else :title="pages?.archive.cta.title ?? ''" :link-label="pages?.archive.cta.label" external />
</template>
