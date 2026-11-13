import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homePsdR1Source } from '../../app/data/home-psd-r1-manifest.ts';
import { homePsdSourceText } from '../../app/data/home-psd-r1-copy.generated.ts';
import { homePsdTextMappings } from '../../app/data/home-psd-r1-mapping.ts';
import { homePsdColorTokens, homePsdSurfaceTokens } from '../../app/data/home-psd-r1-tokens.ts';
import { homePsdTextById, homePsdTextLines } from '../../app/utils/homePsdR1Text.ts';
import { figmaScene } from '../../app/data/figma-r2-scene.generated.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const digest = data => createHash('sha256').update(data).digest('hex');
const EXPECTED_MANIFEST = '0712113fc4fb47af3beb4411c91a78717c6b4d0adfeba85afabf8cf8c9353736';

export function verifyHomePsdSource(project = root) {
  const read = path => readFileSync(resolve(project, path));
  const lock = JSON.parse(read('docs/migration/smd-home-psd-r1/source-lock.json'));
  const bytes = read('docs/migration/smd-home-psd-r1/source-manifest.json');
  assert.equal(digest(bytes), EXPECTED_MANIFEST, 'HOME_PSD_MANIFEST_DRIFT');
  assert.equal(lock.sourceManifestSha256, EXPECTED_MANIFEST);
  assert.equal(lock.baseCommit, homePsdR1Source.baseCommit);
  const frozen = JSON.parse(bytes);
  const policyBytes = read('scripts/home-psd-r1/policy.json');
  const policy = JSON.parse(policyBytes);
  assert.equal(digest(policyBytes), homePsdR1Source.policySha256, 'HOME_PSD_MAPPING_POLICY_DRIFT');
  assert.deepEqual(frozen.manifest, homePsdR1Source);
  assert.deepEqual(frozen.texts, homePsdSourceText);
  assert.deepEqual(policy.textMappings, homePsdTextMappings);
  for (const [path, hash] of Object.entries(lock.protectedFiles)) {
    assert.equal(digest(read(path)), hash, `HOME_PSD_PROTECTED_SOURCE_DRIFT:${path}`);
  }
  assert.equal(frozen.layers.length, 131);
  assert.equal(Object.keys(frozen.texts).length, 68);
  assert.equal(Object.keys(frozen.shapes).length, 42);
  assert.equal(Object.keys(frozen.assets).length, 13);
  const layerById = new Map(frozen.layers.map(layer => [layer.layerId, layer]));
  assert.equal(layerById.size, 131);
  frozen.layers.forEach((layer, index) => {
    assert.equal(layer.painterOrder, index);
    if (layer.parentLayerId !== null) {
      const parent = layerById.get(layer.parentLayerId);
      assert.ok(parent, `missing parent:${layer.layerId}`);
      assert.equal(parent.childLayerIds[layer.siblingOrder], layer.layerId);
      assert.ok(parent.painterOrder < layer.painterOrder);
    }
    if (layer.clipping) {
      const base = layerById.get(layer.clipBaseLayerId);
      assert.ok(base && !base.clipping && base.parentLayerId === layer.parentLayerId && base.siblingOrder < layer.siblingOrder);
    }
  });
  assert.equal(frozen.layers.filter(l => l.clipping).length, 7);
  assert.equal(layerById.get(1819).parentLayerId, 142, 'empty nested text must not be flattened');
  assert.equal(layerById.get(108).visible, true, 'occlusion is not source visibility');
  assert.equal(layerById.get(102).visible, false);
  assert.deepEqual(frozen.assets['1274'].transformBox, [1925, 7352, 5, 7352, 5, 8433, 1925, 8433]);
  assert.equal(frozen.crosswalk.length, 131);
  const mappedIds = new Set();
  for (const [key, ids] of Object.entries(homePsdTextMappings)) {
    assert.ok(figmaScene.texts[key], `HOME_PSD_FIGMA_TEXT_MISSING:${key}`);
    for (const id of ids) {
      assert.ok(!mappedIds.has(id), `ambiguous text owner:${id}`);
      mappedIds.add(id);
      homePsdTextLines(homePsdTextById(String(id)));
    }
  }
  for (const text of Object.values(frozen.texts)) {
    assert.equal(digest(Buffer.from(text.rawText, 'utf8')), text.sourceTextDigest);
    assert.equal(text.runs.map(r => r.rawText).join(''), text.rawText);
    let offset = 0;
    for (const run of text.runs) {
      assert.equal(run.startUtf16, offset);
      offset += run.rawText.length;
      assert.equal(run.endUtf16, offset);
      assert.ok(homePsdColorTokens[run.sourceColor]);
    }
    assert.equal(offset, text.rawText.length);
  }
  for (const mapping of [...policy.mediaMappings, ...Object.values(policy.shapeMappings)]) {
    if (mapping.figmaNode) assert.ok(figmaScene.nodes[mapping.figmaNode], `missing shape target:${mapping.figmaNode}`);
  }
  for (const [role, token] of Object.entries(homePsdSurfaceTokens)) {
    for (const id of token.layerIds) {
      const shape = frozen.shapes[String(id)];
      assert.equal(shape.sourceFill, token.color, role);
      assert.equal(shape.layerOpacity, token.alphaByte, role);
      if ('radius' in token) assert.deepEqual(shape.origins[0].radii, Array(4).fill(token.radius));
    }
  }
  const mainCss = read('app/assets/css/main.css').toString();
  const homeCss = read('app/assets/css/home-r2.css').toString();
  for (const [color, name] of Object.entries(homePsdColorTokens)) {
    const css = name.startsWith('--home-') ? homeCss : mainCss;
    const matches = [...css.matchAll(new RegExp(name + '\\s*:\\s*([^;]+);', 'g'))];
    assert.equal(matches.length, 1, `token owner:${name}`);
    assert.equal(matches[0][1].trim(), color);
  }
  assert.match(homeCss, /--home-psd-step-alpha: calc\(135 \/ 255\)/);
  assert.match(homeCss, /--home-psd-step-background: rgb\(215 228 255 \/ var\(--home-psd-step-alpha\)\)/);
  for (const id of [1044, 1057, 1059, 1061, 1082, 1819, 108, 109]) assert.ok(!mappedIds.has(id));
  return { status: 'PASS', tier: 'SOURCE_STATIC', layers: 131, texts: 68, shapes: 42, smartObjects: 13,
    mappedFigmaTextNodes: Object.keys(homePsdTextMappings).length, mappedPsdTextLayers: mappedIds.size,
    protectedFiles: Object.keys(lock.protectedFiles).length, productionPresentation: 'current', pixelParity: 'NOT_CLAIMED' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(verifyHomePsdSource()));
