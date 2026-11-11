/** SMD-HEADER-WORDMARK-R1: source/static gates only, not browser or deploy evidence. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

const root = resolve(import.meta.dirname, '../..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const vue = read('app/components/feature/SiteHeader.vue');
const css = read('app/assets/css/home-r2-header.css');
const originalLogo = read('public/brand/smd-academy-header-wordmark.svg');

const getCssBody = selector => {
  const i = css.indexOf(selector + ' {');
  assert.notEqual(i, -1, `missing CSS: ${selector}`);
  const end = css.indexOf('}', i);
  assert.notEqual(end, -1);
  return css.slice(i, end+1);
};

test('CF1 user SVG preserved with exact digest, geometry and source paints', () => {
  assert.equal(createHash('sha256').update(Buffer.from(originalLogo, 'utf8')).digest('hex'),
    'efca9ebbd9e13ee7f72071d33f4145c5d30347b11d8e614b7b3db15d55508dea');
  assert.match(originalLogo,/viewBox="0 0 270 50"/);
  assert.match(originalLogo,/#002c5a/i);
  assert.match(originalLogo,/#ed781e/i);
  assert.equal((originalLogo.match(/<path\b/g)??[]).length,9);
  assert.doesNotMatch(originalLogo,/(?:<script\b|onload=|onerror=|<image\b|\shref=|\sxlink:href=)/i);
});

test('CF2 brand uses one wordmark and a preserved semantic label, not duplicated Figma text', () => {
  assert.equal((vue.match(/src="\/brand\/smd-academy-header-wordmark\.svg"/g)??[]).length,1);
  assert.match(vue,/data-brand-presentation="SMD_HEADER_WORDMARK_R1"/);
  assert.match(vue,/width="270" height="50" alt="" aria-hidden="true"/);
  assert.match(vue,/:aria-label="`\$\{brand\} 홈으로`"/);
  assert.match(vue,/@error="figmaLogoError = true"/);
  assert.match(vue,/<span v-else class="smd-site-header__logo-error"/);
  assert.doesNotMatch(vue,/smd-site-header__brand-label|smd-site-header__symbol/);
  assert.doesNotMatch(vue,/src="\/figma\/smd-academy-header-logo\.svg"/);
});

test('CF3 Wordmark has one ratio, responsive widths and guarded desktop left offset', () => {
  const block = getCssBody('.smd-site-header__wordmark');
  assert.match(block,/width:\s*var\(--smd-wordmark-width\)/);
  assert.match(block,/height:\s*auto/);
  assert.match(block,/aspect-ratio:\s*270\s*\/\s*50/);
  assert.match(css,/--smd-wordmark-width:\s*270px/);
  assert.match(css,/--smd-wordmark-width:\s*min\(240px/);
  assert.match(css,/--smd-wordmark-width:\s*min\(205px/);
  assert.match(css,/--smd-wordmark-offset-x:\s*max\(-80px/);
  assert.match(css,/transform:\s*translateX\(var\(--smd-wordmark-offset-x\)\)/);
  assert.doesNotMatch(css,/\.smd-site-header__figma-logo|\.smd-site-header__symbol|\.smd-site-header__brand-label/);
});

test('CF4 Home surface is route/scroll/drawer owned, not dependent on intro reveal', () => {
  const surface = vue.match(/const headerSurface = computed<'glass' \| 'solid'>\(\(\) => \{([\s\S]*?)\n\}\);/);
  assert.ok(surface);
  assert.match(surface[1],/route\.path !== '\/'/);
  assert.match(surface[1],/!atDocumentTop\.value/);
  assert.match(surface[1],/open\.value/);
  assert.doesNotMatch(surface[1],/introHeaderReveal/);
  assert.match(vue,/:data-home-header-mode="homeHeaderMode"/);
  assert.match(vue,/:data-header-surface="headerSurface"/);
  assert.match(vue,/atDocumentTop\.value = y <= 2/);
  assert.match(getCssBody('.smd-site-header--home[data-header-surface="glass"]'),
    /background-color:\s*rgba\(255,\s*255,\s*255,\s*0\.20\)/);
  assert.match(getCssBody('.smd-site-header--home[data-header-surface="solid"]'),
    /background-color:\s*#fff/);
  assert.doesNotMatch(css,/background:\s*transparent\s*!important/);
  assert.doesNotMatch(css,/filter:\s*brightness\(0\)\s*invert\(1\)/);
  assert.doesNotMatch(css,/\.smd-site-header--home\s*\{[^}]*opacity:\s*0\.2/);
});

test('CF5 Existing menu links, CTA, focus/hover, reduced-motion and viewport height preserved',()=>{
  assert.match(vue,/const nav = homeHeaderNavigationV2\.items/);
  assert.match(vue,/:data-target-status="homeHeaderTargetStatus/);
  assert.match(vue,/v-if="standalone" to="\/contact"/);
  assert.match(vue,/:href="ctaHref" target="_blank"/);
  assert.match(vue,/window\.addEventListener\('scroll', onScroll/);
  assert.match(css,/--smd-desktop-header-height:\s*93\.75px/);
  assert.match(css,/\.smd-site-header\s*\{height:\s*76px/);
  assert.match(css,/\.smd-site-header--home\[data-home-header-mode\]\s*\.smd-site-header__nav-link:is\(:hover, :focus-visible\)/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css,/--home-header-offset:\s*0px/);
});
