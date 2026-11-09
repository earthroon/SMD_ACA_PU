/** R1E SOURCE + VM contract tests. Browser animation is verified separately. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const vue = readFileSync(resolve(root, 'app/components/home/HomeHeroCarousel.vue'), 'utf8');
const data = readFileSync(resolve(root, 'app/data/home-hero-carousel.ts'), 'utf8');
const css = readFileSync(resolve(root, 'app/assets/css/home-hero-film.css'), 'utf8');
const oldTests = readFileSync(resolve(root, 'scripts/tests/hero-carousel-r1b-autoplay.test.mjs'), 'utf8');

function extract(start, end, replacement) {
  const a = vue.indexOf(start), b = vue.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `FUNCTION_EXTRACTION_FAILED ${start}`);
  return vue.slice(a, b).replace(start, replacement);
}
const syncCode = extract('function syncAutoplay(): void {', 'function onSelected(', 'function syncAutoplay() {');
const navigateCode = extract("function navigate(direction: 'previous' | 'next'): void {", 'function onKeydown(', 'function navigate(direction) {');
const focusCode = extract('function onFocusIn(event: FocusEvent): void {', 'function onFocusOut(', 'function onFocusIn(event) {');

function harness({playing = true, ready = true, owner = true, apiPresent = true, reducedMotion = false, fault = null} = {}) {
  const trace = [];
  let isPlaying = playing;
  const autoplay = {
    isPlaying: () => isPlaying,
    play: jump => { trace.push(['play', jump]); isPlaying = true; },
    reset: () => trace.push(['reset']),
    stop: () => { trace.push(['stop']); isPlaying = false; },
  };
  const api = apiPresent ? {
    plugins: () => ({ autoplay }),
    scrollPrev: jump => trace.push(['prev', jump]),
    scrollNext: jump => trace.push(['next', jump]),
  } : undefined;
  const env = {
    emblaApi: { value: api }, autoplay, owner: { value: owner },
    ready: { value: ready }, loadFault: { value: fault },
    reducedMotion: { value: reducedMotion }, canPlay: { value: true },
    autoplayLease: { value: null }, instanceId: 'owner',
  };
  const methods = vm.runInNewContext(`${syncCode}\n${navigateCode}\n({syncAutoplay,navigate})`, env);
  return { ...methods, env, trace };
}

test('R1E timer is 3000ms and replaces both 5500 and 5000', () => {
  assert.match(data, /export const HERO_CAROUSEL_DELAY_MS = 3000 as const;/);
  assert.doesNotMatch(data, /HERO_CAROUSEL_DELAY_MS = (5500|5000)/);
  assert.match(vue, /delay: HERO_CAROUSEL_DELAY_MS,/);
});

test('R1E auto uses animated transition with no instant jump', () => {
  assert.match(vue, /jump: false,/);
  assert.match(vue, /duration: reducedMotion\.value \? 0 : 35,/);
  const h = harness({ playing: false });
  h.syncAutoplay();
  assert.deepEqual(h.trace, [['play', false]]);
  h.syncAutoplay();
  assert.deepEqual(h.trace, [['play', false]], 'steady state must not keep resetting 3s countdown');
});

test('R1E keyboard, manual arrows, and auto all route through one Embla instance', () => {
  assert.match(vue, /api\.scrollNext\(reducedMotion\.value\)/);
  assert.match(vue, /api\.scrollPrev\(reducedMotion\.value\)/);
  assert.match(vue, /emblaApi\.value\.scrollNext\(reducedMotion\.value\)/);
  assert.match(vue, /emblaApi\.value\.scrollPrev\(reducedMotion\.value\)/);
  assert.match(vue, /const \[emblaRef, emblaApi\] = useEmblaCarousel\(options, \[autoplay\]\);/);
});

test('R1E click previous animates and resets only an active timer', () => {
  const h = harness();
  h.navigate('previous');
  assert.deepEqual(h.trace, [['prev', false], ['reset']]);
});

test('R1E click next animates and resets only an active timer', () => {
  const h = harness();
  h.navigate('next');
  assert.deepEqual(h.trace, [['next', false], ['reset']]);
  const paused = harness({ playing: false });
  paused.navigate('next');
  assert.deepEqual(paused.trace, [['next', false]]);
});

test('R1E reduced motion uses immediate navigation only when OS preference requires it', () => {
  const h = harness({ reducedMotion: true });
  h.navigate('next');
  assert.deepEqual(h.trace, [['next', true], ['reset']]);
});

test('R1E controls cannot operate while hidden, unready, faulted or uninitialized', () => {
  for (const options of [{owner:false},{ready:false},{fault:'failed'},{apiPresent:false}]) {
    const h = harness(options);
    h.navigate('next');
    assert.deepEqual(h.trace, []);
  }
});

test('R1E two real buttons exist outside draggable viewport and expose labels', () => {
  const endViewport = vue.indexOf('</div>\n    <button type="button" class="smd-hero-carousel__control');
  assert.ok(endViewport >= 0);
  assert.match(vue, /data-hero-carousel-action="previous" aria-label="이전 이미지"/);
  assert.match(vue, /data-hero-carousel-action="next" aria-label="다음 이미지"/);
  assert.match(vue, /@click\.stop="navigate\('previous'\)"/);
  assert.match(vue, /@click\.stop="navigate\('next'\)"/);
  assert.match(vue, /:disabled="!owner \|\| !ready \|\| Boolean\(loadFault\)"/);
  assert.match(vue, /:aria-controls="viewportId"/);
  assert.match(vue, /:id="viewportId" ref="emblaRef"/);
  assert.equal((vue.match(/data-hero-carousel-action=/g) ?? []).length, 2);
});

test('R1E CSS positions buttons above slides at left and right, focus visible', () => {
  assert.match(css, /\.smd-hero-carousel__control\s*\{[\s\S]*?position: absolute;[\s\S]*?z-index: 2;/);
  assert.match(css, /\.smd-hero-carousel__control--previous\s*\{\s*left:/);
  assert.match(css, /\.smd-hero-carousel__control--next\s*\{\s*right:/);
  assert.match(css, /\.smd-hero-carousel__control:focus-visible/);
  assert.match(css, /\.smd-hero-carousel__slide\s*\{[\s\S]*?flex: 0 0 100%/);
  assert.match(css, /object-fit: cover/);
});

test('R1E mouse click focus does not cause permanent autoplay focus latch', () => {
  assert.match(vue, /focused\.value = target instanceof HTMLElement && target\.matches\(':focus-visible'\)/);
  assert.doesNotMatch(vue, /@focusin="focused = true"/);
  const h = { focused:{value:true}, HTMLElement:class HTMLElement{}, event:null };
  h.target = new h.HTMLElement(); h.target.matches = selector => selector === ':focus-visible' ? false : null;
  const focus = vm.runInNewContext(`${focusCode}\nonFocusIn`, h);
  focus({ target:h.target });
  assert.equal(h.focused.value, false);
  h.target.matches = () => true;
  focus({ target:h.target });
  assert.equal(h.focused.value,true);
});

test('R1E preserves old R1B plugin-lifetime assertions with animated play', () => {
  assert.match(oldTests, /assert\.equal\(h\.trace\[1\]\[1\],false\)/);
  assert.match(vue, /api\?\.plugins\(\)\?\.autoplay/);
  assert.match(vue, /HERO_CAROUSEL_AUTOPLAY_PLUGIN_UNAVAILABLE/);
});
