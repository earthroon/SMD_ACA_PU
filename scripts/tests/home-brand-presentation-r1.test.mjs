import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {figmaScene} from '../../app/data/figma-r2-scene.generated.ts';
import {HOME_HEADER_BRAND_R1,assertHomeHeaderBrandR1} from '../../app/data/home-r2-brand-display.ts';
import {HOME_BRAND_COPY_NODE_KEYS, homeVisibleBrandText} from '../../app/utils/homeBrandVisibleText.ts';
const root = resolve(import.meta.dirname,'../..');
const read = (p) => readFileSync(resolve(root,p),'utf8');

test('header brand copy remains semantic while the integrated SVG has sole visual ownership',() => {
  assertHomeHeaderBrandR1();
  assert.equal(HOME_HEADER_BRAND_R1.displayText,'SMD아카데미');
  assert.equal(HOME_HEADER_BRAND_R1.fontWeight,800);
  const vue = read('app/components/feature/SiteHeader.vue');
  assert.match(vue,/const brand = HOME_HEADER_BRAND_R1\.displayText/);
  assert.match(vue,/:aria-label="`\$\{brand\} 홈으로`"/);
  assert.match(vue,/src="\/brand\/smd-academy-header-wordmark\.svg"/);
  assert.doesNotMatch(vue,/smd-site-header__brand-label|smd-site-header__symbol/);
});

test('only five known Figma source nodes are allowlisted',() => {
  assert.deepEqual(HOME_BRAND_COPY_NODE_KEYS,
    ['node-35:4','node-1:60','node-1:92','node-36:7','node-1:11']);
  for (const key of HOME_BRAND_COPY_NODE_KEYS) {
    const original = figmaScene.texts[key];
    assert.ok(original,`missing ${key}`);
    assert.match(original.characters,/SMD 아카데미/);
    const projected = original.runs.map(r=>homeVisibleBrandText(key,r.characters)).join('');
    assert.equal(projected, original.characters.replaceAll('SMD 아카데미','SMD아카데미'));
    assert.doesNotMatch(projected,/SMD 아카데미/);
    assert.equal(original.runs.map(r=>r.characters).join(''),original.characters);
  }
});

test('unrelated nodes and unlisted text remain byte-for-byte unchanged',() => {
  assert.equal(homeVisibleBrandText('node-1:103','정규 교육 트랙'),'정규 교육 트랙');
  assert.equal(homeVisibleBrandText('node-1:103','SMD 아카데미'),'SMD 아카데미');
  assert.equal(homeVisibleBrandText('node-1:92','정규 교육 트랙'),'정규 교육 트랙');
});

test('source copy files stay frozen and presentation override is isolated',() => {
  const native=read('app/components/figma/FigmaNativeText.vue');
  const semantic=read('app/components/home/HomeFigmaText.vue');
  assert.match(native,/homeVisibleBrandText\(\s*props\.nodeKey,\s*run\.characters\s*,?\s*\)/);
  assert.match(native,/:data-source-text-digest="original\.digest"/);
  assert.match(semantic,/homeVisibleBrandText\(\s*textKey,\s*run\.characters\s*,?\s*\)/);
  assert.match(semantic,/:data-text-digest="source\.textDigest"/);
  assert.equal(figmaScene.texts['node-1:11'].characters,'SMD 아카데미');
});
