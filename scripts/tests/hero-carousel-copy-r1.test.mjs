import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {heroCarouselCopyById,resolveHeroCarouselCopy,resolveHeroCarouselText} from '../../app/data/home-hero-carousel.ts';
import {homeFilmAssets} from '../../app/data/home-film.ts';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>readFileSync(resolve(root,p),'utf8');

test('all 3 hero IDs have complete independent copy',()=>{
  assert.deepEqual(homeFilmAssets.map(x=>x.id),['hero-1','hero-2','hero-3']);
  assert.deepEqual(Object.keys(heroCarouselCopyById),homeFilmAssets.map(x=>x.id));
  for(const [i,asset] of homeFilmAssets.entries()){
    const copy=resolveHeroCarouselCopy(i);
    assert.equal(heroCarouselCopyById[asset.id],copy);
    for(const key of ['eyebrow','heading','introduction']) {
      assert.equal(typeof copy[key],'string');
      assert.ok(copy[key].trim().length>0);
    }
    assert.equal(copy.mobileHeading.length,2);
    assert.equal(resolveHeroCarouselText(i,'node-36:6'),copy.eyebrow);
    assert.equal(resolveHeroCarouselText(i,'node-35:5'),copy.heading);
    assert.equal(resolveHeroCarouselText(i,'node-36:7'),copy.introduction);
    assert.equal(resolveHeroCarouselText(i,'node-1:478'),null);
  }
  assert.equal(new Set(homeFilmAssets.map((_,i)=>resolveHeroCarouselCopy(i).heading)).size,3);
  assert.throws(()=>resolveHeroCarouselCopy(3),/HERO_CAROUSEL_COPY_INDEX_INVALID/);
});

test('copy switches at caption-hide frame, and both render paths share its state',()=>{
  const carousel=read('app/components/home/HomeHeroCarousel.vue');
  const figma=read('app/components/figma/FigmaNativeText.vue');
  const semantic=read('app/components/home/HomeFigmaText.vue');
  const mobile=read('app/components/home/HeroSection.vue');
  assert.match(carousel,/captionPhase\.value = 'hidden';\s*captionIndex\.value = target;\s*enteringVisible\.value = true;/);
  assert.match(carousel,/captionIndex\.value = selectedIndex\.value;/);
  assert.match(figma,/resolveHeroCarouselText\(captionIndex\.value, props\.nodeKey\)/);
  assert.match(semantic,/resolveHeroCarouselText\(captionIndex\.value, props\.textKey\)/);
  assert.match(mobile,/resolveHeroCarouselCopy\(captionIndex\.value\)\.mobileHeading/);
  assert.match(carousel,/HERO_DISSOLVE_DURATION_MS \+ 96/);
  assert.doesNotMatch(carousel,/activeSlide\.title|activeSlide\.description/);
});
