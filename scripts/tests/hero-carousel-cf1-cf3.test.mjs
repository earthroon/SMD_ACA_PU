/** CF1~CF3 source/model gates only. Browser pixels and Nuxt typecheck are separate. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { homeFilmAssets } from '../../app/data/home-film.ts';
import {
  HERO_CAROUSEL_REVISION, HERO_CAROUSEL_DELAY_MS, heroCarouselFocalPoints,
  resolveHeroCarouselSlots,
} from '../../app/data/home-hero-carousel.ts';
const project = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = path => readFileSync(resolve(project, path), 'utf8');

const local = () => ({ kind: 'local' });
test('CF1: exactly three stable source image IDs and neutral focal points', () => {
  assert.equal(HERO_CAROUSEL_REVISION, 'SMD-HOME-HERO-CAROUSEL-R1-CF1-CF3');
  assert.equal(HERO_CAROUSEL_DELAY_MS, 3000);
  assert.deepEqual(homeFilmAssets.map(s => s.id), ['hero-1', 'hero-2', 'hero-3']);
  assert.deepEqual(Object.keys(heroCarouselFocalPoints), homeFilmAssets.map(s => s.id));
  const slots = resolveHeroCarouselSlots(local);
  assert.deepEqual(slots.map(s => s.slotId), homeFilmAssets.map(s => s.id));
  for (const s of slots) {
    assert.equal(s.order, homeFilmAssets.findIndex(a => a.id === s.slotId));
    assert.deepEqual(s.focalPoint, { xPercent: 50, yPercent: 50 });
    assert.equal(s.publicationId, null);
    assert.equal(s.assetId, null);
  }
});

test('CF1: published source replaces local metadata without modifying image ID', () => {
  const slots = resolveHeroCarouselSlots(id => ({
    kind: 'published', publicationId: 'publication-fixture', assetId: `asset-${id}`,
    src: `/published/${id}`, width: 4000, height: 2250, alt: `Published ${id}`,
  }));
  for (const s of slots) {
    assert.equal(s.src, `/published/${s.imageId}`);
    assert.equal(s.publicationId, 'publication-fixture');
    assert.equal(s.assetId, `asset-${s.imageId}`);
    assert.equal(s.width, 4000);
    assert.equal(s.height, 2250);
    assert.equal(s.alt, `Published ${s.imageId}`);
  }
});

test('CF1: missing/invalid media is refused rather than silently mapped to local', () => {
  assert.throws(() => resolveHeroCarouselSlots(() => ({ kind: 'unbound' })), /STANDALONE_FILM_IMAGE_NOT_PUBLISHED/);
  assert.throws(() => resolveHeroCarouselSlots(() => ({
    kind: 'published', publicationId: '', assetId: 'a', src: '/bad', width: 1,
    height: 1, alt: '',
  })), /HERO_CAROUSEL_PUBLICATION_INVALID/);
  assert.throws(() => resolveHeroCarouselSlots(() => ({
    kind: 'published', publicationId: 'p', assetId: 'a', src: '/bad', width: NaN,
    height: 1, alt: '',
  })), /HERO_CAROUSEL_PUBLICATION_INVALID/);
});

test('CF2: unique Vue Carousel and one Embla autoplay owner, no LUT/Focus/rail runtime', () => {
  const wrapper = read('app/components/home/HomeHeroFilm.vue');
  const carousel = read('app/components/home/HomeHeroCarousel.vue');
  assert.match(wrapper, /<HomeHeroCarousel\s+@media-status="emit\(\'film-media-status\', \$event\)"\s*\/>/);
  assert.match(wrapper, /owner: 'HomeHeroFilm'/);
  assert.match(carousel, /embla-carousel-vue/);
  assert.match(carousel, /embla-carousel-autoplay/);
  assert.match(carousel, /playOnInit: false/);
  assert.match(carousel, /stopOnInteraction: false/);
  assert.match(carousel, /loop: true/);
  assert.match(carousel, /active: owner\.value/);
  assert.match(carousel, /useState<number>\('smd-hero-carousel-selected-r1'/);
  assert.match(carousel, /smd-hero-carousel-autoplay-lease-r1/);
  assert.match(carousel, /autoplayLease\.value === instanceId/);
  assert.match(carousel, /desktopQuery = matchMedia\('\(min-width: 1100px\)'\)/);
  assert.match(carousel, /document\.hidden/);
  assert.match(carousel, /reducedMotion\.value/);
  for (const source of [wrapper, carousel]) {
    assert.doesNotMatch(source, /homeFilmWind|homeFilmMotion|homeFilmSelection|homeFilmFocusAdmission/);
    assert.doesNotMatch(source, /requestAnimationFrame|\.animate\(|displayAssets|copies\.value/);
    assert.doesNotMatch(source, /<canvas|new Worker\(/);
  }
});

test('CF2: build and normal test entrypoint no longer require film LUT baking', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies['embla-carousel-vue'], '8.6.0');
  assert.equal(pkg.dependencies['embla-carousel-autoplay'], '8.6.0');
  assert.doesNotMatch(pkg.scripts.build, /scripts\/film\//);
  assert.match(pkg.scripts.build, /test:hero-carousel/);
  assert.equal(pkg.scripts['test:hero-film'], 'npm run test:hero-carousel');
});

test('CF3: full width full height image cover with a single 100% logical slide', () => {
  const css = read('app/assets/css/home-hero-film.css');
  assert.match(css, /\.smd-hero-carousel__slide\s*\{[\s\S]*?flex:\s*0 0 100%/);
  assert.match(css, /\.smd-hero-carousel__slide\s*>\s*img\s*\{[\s\S]*?object-fit:\s*cover/);
  assert.match(css, /object-position:\s*var\(--hero-focal-x/);
  assert.doesNotMatch(css, /object-fit:\s*contain/);
  assert.match(css, /node-1:5/);
  const wrapper = read('app/components/home/HomeHeroFilm.vue');
  assert.match(wrapper, /paintedHeightCss:\s*paintedHeight/);
  assert.match(wrapper, /viewportRectCss/);
  assert.match(wrapper, /layoutRevision/);
});

test('CF3: mathematical cover scale fills every requested viewport, never distorts source', () => {
  const cases = [
    [390, 844], [768, 1024], [1440, 900], [1920, 1080],
    [2560, 1440], [3440, 1440], [3840, 1600], [5120, 1440],
  ];
  for (const [w, h] of cases) {
    const source = homeFilmAssets[0];
    const scale = Math.max(w / source.width, h / source.height);
    assert.ok(scale * source.width >= w - 1e-8);
    assert.ok(scale * source.height >= h - 1e-8);
    assert.equal((scale * source.width) / (scale * source.height), source.width / source.height);
  }
});

test('CF3: legacy Intro overlay geometry admits a full-height cover viewport at every width', async () => {
  const {planIntroOverlay} = await import('../../app/utils/homeIntroOverlayGeometry.ts');
  for (const [width,height] of [[390,844],[768,1024],[1920,1080],[3440,1440],[5120,1440]]) {
    const frame = {left:0,top:80,width,height};
    const barHeight = Math.min(300,height/3);
    const result = planIntroOverlay({
      frameRectCss:frame,
      film:{owner:'HomeHeroFilm',viewportRectCss:frame,paintedTopCss:0,
        paintedHeightCss:height,layoutRevision:'SMD-HOME-HERO-CAROUSEL-R1-CF1-CF3',generation:1},
      overlayHeightCssPx:barHeight,overlayWidthCssPx:width,
      sourceRevision:'fixture-r1',expectedSourceRevision:'fixture-r1',
      minimumFilmGeneration:1,hostRevision:'fixture-r1',
    });
    assert.equal(result.kind,'admitted',`${width}x${height}`);
    assert.ok(Math.abs(result.topCssPx-(height-barHeight)) < 1e-8);
    assert.equal(result.widthCssPx,width);
  }
});
