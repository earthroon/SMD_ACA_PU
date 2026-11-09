<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import useEmblaCarousel from 'embla-carousel-vue';
import Autoplay from 'embla-carousel-autoplay';
import { useStandalonePublishedMedia } from '~/composables/useStandalonePublishedMedia';
import { useContentMode } from '~/composables/useContentMode';
import { resolveHomeHeroLocalMedia } from '~/utils/homeHeroLocalMedia';
import type { HeroMediaStatus } from '~/utils/homeIntroMediaGate';
import {
  HERO_CAROUSEL_DELAY_MS, HERO_CAROUSEL_REVISION, resolveHeroCarouselSlots,
  type HeroCarouselSlot,
} from '~/data/home-hero-carousel';

const emit = defineEmits<{ 'media-status': [status: HeroMediaStatus] }>();
const media = useStandalonePublishedMedia();
const contentMode = useContentMode();
const slides = computed(() => resolveHeroCarouselSlots(id => {
  const binding = media.image('home', id);
  switch (binding.kind) {
    case 'local':
      switch (contentMode) {
        case 'standalone': {
          const local = resolveHomeHeroLocalMedia(id);
          return {kind: 'local' as const, ...local};
        }
        case 'cms': return binding; // CMS Hero schema is not yet part of HomeR2PublicProjection.
      }
      throw new Error('SMD_HOME_HERO_CONTENT_MODE_UNSUPPORTED');
    case 'published':case 'unbound': return binding;
  }
}));
const sourceRevision = computed(() => slides.value.map(s =>
  `${s.slotId}:${s.src}:${s.width}x${s.height}:${s.publicationId ?? 'local'}:${s.assetId ?? 'local'}`,
).join('|'));

// Nuxt request-scoped state is shared by the Figma and semantic instances.
// Hidden instances never write selection; this preserves the logical slide across breakpoints.
const selectedIndex = useState<number>('smd-hero-carousel-selected-r1', () => 0);
const autoplayLease = useState<string | null>('smd-hero-carousel-autoplay-lease-r1', () => null);
const instanceId = useId();
const viewportId = `${instanceId}-viewport`;
const root = ref<HTMLElement | null>(null);
const owner = ref(false);
const intersecting = ref(false);
const pageVisible = ref(true);
const reducedMotion = ref(false);
const hovered = ref(false);
const focused = ref(false);
// Mark decoded rather than network-loaded bytes: a frame must be paintable.
const loadedKeys = ref<ReadonlySet<string>>(new Set());
const decodingKeys = new Set<string>();
const loadFault = ref<string | null>(null);

const autoplay = Autoplay({
  delay: HERO_CAROUSEL_DELAY_MS,
  jump: false, // Auto progression must animate, not snap instantly.
  playOnInit: false,
  stopOnInteraction: false,
  stopOnMouseEnter: true,
  stopOnFocusIn: true,
});
const options = computed(() => ({
  loop: true,
  align: 'start' as const,
  slidesToScroll: 1,
  dragFree: false,
  watchDrag: true,
  duration: reducedMotion.value ? 0 : 35,
  active: owner.value,
}));
const [emblaRef, emblaApi] = useEmblaCarousel(options, [autoplay]);
type EmblaInstance = NonNullable<(typeof emblaApi)['value']>;

let desktopQuery: MediaQueryList | null = null;
let reducedQuery: MediaQueryList | null = null;
let intersectionObserver: IntersectionObserver | null = null;
let resizeObserver: ResizeObserver | null = null;
let mounted = false;

const imageKey = (s: HeroCarouselSlot): string => `${s.imageId}|${s.src}`;
const ready = computed(() => slides.value.every(s => loadedKeys.value.has(imageKey(s))));
const canPlay = computed(() => owner.value && intersecting.value && pageVisible.value &&
  !reducedMotion.value && !hovered.value && !focused.value && !loadFault.value && ready.value);

function syncAutoplay(): void {
  const api = emblaApi.value;
  const pluginReady = Boolean(api?.plugins()?.autoplay);
  if (!canPlay.value || !pluginReady) {
    if (pluginReady && autoplay.isPlaying()) autoplay.stop();
    if (autoplayLease.value === instanceId) autoplayLease.value = null;
    return;
  }
  // A Nuxt request-scoped lease serializes handoff between Figma and semantic
  // instances. Releasing the lease occurs only AFTER stopping the old timer.
  if (autoplayLease.value !== null && autoplayLease.value !== instanceId) return;
  if (autoplayLease.value === null) autoplayLease.value = instanceId;
  if (!autoplay.isPlaying()) autoplay.play(false);
}
function onSelected(api: EmblaInstance): void {
  if (!owner.value || !mounted || document.hidden) return;
  const index = api.selectedScrollSnap();
  if (index >= 0 && index < slides.value.length) selectedIndex.value = index;
}
function alignToSelection(api: EmblaInstance): void {
  if (!owner.value || !mounted) return;
  const wanted = selectedIndex.value;
  if (!Number.isInteger(wanted) || wanted < 0 || wanted >= slides.value.length) {
    throw new Error('HERO_CAROUSEL_SELECTION_INVALID');
  }
  if (api.selectedScrollSnap() !== wanted) api.scrollTo(wanted, true);
}
function onReInit(api: EmblaInstance): void {
  alignToSelection(api);
  // Embla v8 leaves plugins() undefined while options.active=false.
  // After an active reInit, however, the registered autoplay must exist.
  if (owner.value && !api.plugins()?.autoplay) {
    throw new Error('HERO_CAROUSEL_AUTOPLAY_PLUGIN_UNAVAILABLE');
  }
  syncAutoplay();
}
watch(emblaApi, (current, previous) => {
  previous?.off('select', onSelected);
  previous?.off('reInit', onReInit);
  if (current) {
    current.on('select', onSelected);
    current.on('reInit', onReInit);
    void nextTick().then(() => {
      if (!mounted || emblaApi.value !== current) return;
      alignToSelection(current);
      syncAutoplay();
    });
  }
}, { flush: 'post' });
watch(selectedIndex, index => {
  if (!owner.value || !Number.isInteger(index) || index < 0 || index >= slides.value.length) return;
  const api = emblaApi.value;
  if (api && api.selectedScrollSnap() !== index) api.scrollTo(index, true);
});
watch([owner, reducedMotion], () => {
  void nextTick().then(() => {
    if (!mounted) return;
    const api = emblaApi.value;
    if (api) alignToSelection(api);
    syncAutoplay();
  });
}, { flush: 'post' });
watch(canPlay, syncAutoplay, { flush: 'sync' });
watch(autoplayLease, syncAutoplay, { flush: 'sync' });

function eventIsCurrent(node: EventTarget | null, slot: HeroCarouselSlot): node is HTMLImageElement {
  return node instanceof HTMLImageElement &&
    node.getAttribute('src') === slot.src &&
    slides.value.some(current => current.imageId === slot.imageId && current.src === slot.src);
}
function decodeImage(img: HTMLImageElement, slot: HeroCarouselSlot): void {
  if (!img.complete || img.naturalWidth <= 0 || !eventIsCurrent(img, slot)) return;
  const key = imageKey(slot);
  if (loadedKeys.value.has(key) || decodingKeys.has(key)) return;
  decodingKeys.add(key);
  // decode() resolves after the browser has a paint-ready decoded bitmap.
  const decoded = typeof img.decode === 'function' ? img.decode() : Promise.resolve();
  void decoded.then(() => {
    decodingKeys.delete(key);
    if (!mounted || !img.isConnected || !eventIsCurrent(img, slot)) return;
    const next = new Set(loadedKeys.value);
    next.add(key);
    loadedKeys.value = next;
  }).catch(error => {
    decodingKeys.delete(key);
    if (!mounted || !img.isConnected || !eventIsCurrent(img, slot)) return;
    loadFault.value = `HERO_CAROUSEL_IMAGE_DECODE_FAILED:${slot.imageId}`;
    console.error(loadFault.value, error);
  });
}
function onImageLoad(event: Event, slot: HeroCarouselSlot): void {
  const img = event.currentTarget;
  if (!eventIsCurrent(img, slot)) return;
  decodeImage(img, slot);
}
function reportImageLoadFailure(slot: HeroCarouselSlot): void {
  loadFault.value = `HERO_CAROUSEL_IMAGE_LOAD_FAILED:${slot.imageId}`;
  console.error(loadFault.value);
}
function onImageError(event: Event, slot: HeroCarouselSlot): void {
  if (!eventIsCurrent(event.currentTarget, slot)) return;
  reportImageLoadFailure(slot);
}
function reconcileLoadedImages(): void {
  if (!root.value) return;
  const valid = new Map(slides.value.map(s => [s.imageId, s] as const));
  for (const img of root.value.querySelectorAll<HTMLImageElement>('img[data-hero-image-id]')) {
    const slot = valid.get(img.dataset.heroImageId as HeroCarouselSlot['imageId']);
    if (!slot || img.getAttribute('src') !== slot.src || !img.complete) continue;
    if (img.naturalWidth > 0) decodeImage(img, slot);
    else if (eventIsCurrent(img, slot)) reportImageLoadFailure(slot);
  }
}
watch([owner, ready, loadFault, sourceRevision], () => {
  if (!owner.value) return;
  emit('media-status', {
    phase: loadFault.value ? 'failed' : ready.value ? 'ready' : 'loading',
    sourceRevision: sourceRevision.value,
    reason: loadFault.value,
  });
}, { flush: 'post' });
watch(sourceRevision, () => {
  // A late load from the previous Publication cannot admit a new image generation.
  loadedKeys.value = new Set();
  decodingKeys.clear();
  loadFault.value = null;
  void nextTick().then(() => { if (mounted) reconcileLoadedImages(); });
}, { flush: 'post' });

function updateOwner(): void {
  if (!mounted || !root.value || !desktopQuery || !reducedQuery) return;
  const figma = Boolean(root.value.closest('.smd-home--figma-scene'));
  const semantic = Boolean(root.value.closest('.smd-home--semantic-reflow'));
  const match = (figma && desktopQuery.matches) || (semantic && !desktopQuery.matches);
  const rect = root.value.getBoundingClientRect();
  // CSS hides the other renderer. A hidden component never starts an independent timer.
  owner.value = match && rect.width > 0 && rect.height > 0 &&
    getComputedStyle(root.value).visibility !== 'hidden';
  reducedMotion.value = reducedQuery.matches;
  pageVisible.value = !document.hidden;
}
function onVisibility(): void {
  pageVisible.value = !document.hidden;
  updateOwner();
}
function onPointerEnter(event: PointerEvent): void {
  if (event.pointerType === 'mouse') hovered.value = true;
}
function onPointerLeave(event: PointerEvent): void {
  if (event.pointerType === 'mouse') hovered.value = false;
}
function onFocusIn(event: FocusEvent): void {
  // Keyboard focus pauses autoplay. A mouse click must not leave a stuck focus latch.
  const target = event.target;
  focused.value = target instanceof HTMLElement && target.matches(':focus-visible');
}
function onFocusOut(event: FocusEvent): void {
  const next = event.relatedTarget;
  if (!root.value || !(next instanceof Node) || !root.value.contains(next)) focused.value = false;
}
function navigate(direction: 'previous' | 'next'): void {
  const api = emblaApi.value;
  if (!owner.value || !api || !ready.value || loadFault.value) return;
  switch (direction) {
    case 'previous':
      api.scrollPrev(reducedMotion.value);
      break;
    case 'next':
      api.scrollNext(reducedMotion.value);
      break;
  }
  // Reset only an active timer. Paused-by-hover/focus autoplay resumes via syncAutoplay.
  if (autoplay.isPlaying()) autoplay.reset();
}
function onKeydown(event: KeyboardEvent): void {
  if (!owner.value || !emblaApi.value || event.altKey || event.ctrlKey || event.metaKey) return;
  switch (event.key) {
    case 'ArrowRight':
      event.preventDefault();
      emblaApi.value.scrollNext(reducedMotion.value);
      break;
    case 'ArrowLeft':
      event.preventDefault();
      emblaApi.value.scrollPrev(reducedMotion.value);
      break;
  }
}
onMounted(() => {
  mounted = true;
  if (typeof IntersectionObserver !== 'function' || typeof ResizeObserver !== 'function') {
    throw new Error('HERO_CAROUSEL_OBSERVER_UNAVAILABLE');
  }
  desktopQuery = matchMedia('(min-width: 1100px)');
  reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
  desktopQuery.addEventListener('change', updateOwner);
  reducedQuery.addEventListener('change', updateOwner);
  document.addEventListener('visibilitychange', onVisibility);
  intersectionObserver = new IntersectionObserver(entries => {
    intersecting.value = Boolean(entries[0]?.isIntersecting);
  }, { threshold: 0 });
  resizeObserver = new ResizeObserver(updateOwner);
  if (root.value) {
    intersectionObserver.observe(root.value);
    resizeObserver.observe(root.value);
  }
  updateOwner();
  reconcileLoadedImages();
});
onBeforeUnmount(() => {
  mounted = false;
  if (emblaApi.value?.plugins()?.autoplay && autoplay.isPlaying()) autoplay.stop();
  if (autoplayLease.value === instanceId) autoplayLease.value = null;
  decodingKeys.clear();
  emblaApi.value?.off('select', onSelected);
  emblaApi.value?.off('reInit', onReInit);
  intersectionObserver?.disconnect();
  resizeObserver?.disconnect();
  desktopQuery?.removeEventListener('change', updateOwner);
  reducedQuery?.removeEventListener('change', updateOwner);
  document.removeEventListener('visibilitychange', onVisibility);
});
</script>

<template>
  <div ref="root" class="smd-hero-carousel"
    :data-hero-revision="HERO_CAROUSEL_REVISION"
    :data-hero-owner="owner ? 'active' : 'inactive'"
    :data-hero-selected-index="selectedIndex"
    :data-hero-delay-ms="HERO_CAROUSEL_DELAY_MS"
    :data-hero-ready="ready ? 'true' : 'false'"
    :data-hero-fault="loadFault ?? undefined"
    role="region" aria-roledescription="carousel" aria-label="시공 현장 이미지"
    tabindex="0" @keydown="onKeydown" @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeave" @focusin="onFocusIn" @focusout="onFocusOut">
    <div :id="viewportId" ref="emblaRef" class="smd-hero-carousel__viewport">
      <div class="smd-hero-carousel__container">
        <figure v-for="slide in slides" :key="`${slide.slotId}:${slide.src}`"
          class="smd-hero-carousel__slide" :data-hero-slot-id="slide.slotId"
          :aria-hidden="slide.order !== selectedIndex"
          :style="{
            '--hero-focal-x': `${slide.focalPoint.xPercent}%`,
            '--hero-focal-y': `${slide.focalPoint.yPercent}%`,
          }">
          <img :src="slide.src" :alt="slide.alt" :width="slide.width" :height="slide.height"
            :data-hero-image-id="slide.imageId" loading="eager"
            :fetchpriority="slide.order === 0 ? 'high' : 'auto'" decoding="async"
            draggable="false" @load="onImageLoad($event, slide)" @error="onImageError($event, slide)" />
        </figure>
      </div>
    </div>
    <button type="button" class="smd-hero-carousel__control smd-hero-carousel__control--previous"
      data-hero-carousel-action="previous" aria-label="이전 이미지"
      :aria-controls="viewportId" :disabled="!owner || !ready || Boolean(loadFault)"
      @click.stop="navigate('previous')">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none"
        stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
    <button type="button" class="smd-hero-carousel__control smd-hero-carousel__control--next"
      data-hero-carousel-action="next" aria-label="다음 이미지"
      :aria-controls="viewportId" :disabled="!owner || !ready || Boolean(loadFault)"
      @click.stop="navigate('next')">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none"
        stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  </div>
</template>
