import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyHomePsdSource } from '../verify-source.mjs';
import { homePsdTextById, homePsdTextLines, homePsdPositionedLines, assertHomePsdText, homePsdSvgRunStyle } from '../../../app/utils/homePsdR1Text.ts';
import { homePsdLayersForFigma } from '../../../app/utils/homePsdR1Mapping.ts';
import { homePsdColor, homePsdSurfaceTokens } from '../../../app/data/home-psd-r1-tokens.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const clone = id => structuredClone(homePsdTextById(id));

test('pinned PSD, generated tables, mappings and protected Figma sources agree', () => {
  assert.equal(verifyHomePsdSource().status, 'PASS');
});

test('manifest tampering is rejected before generated code is trusted', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'smd-home-psd-'));
  try {
    mkdirSync(resolve(dir, 'docs/migration/smd-home-psd-r1'), { recursive: true });
    for (const name of ['source-lock.json', 'source-manifest.json']) {
      writeFileSync(resolve(dir, 'docs/migration/smd-home-psd-r1', name), readFileSync(resolve(root, 'docs/migration/smd-home-psd-r1', name)));
    }
    const path = resolve(dir, 'docs/migration/smd-home-psd-r1/source-manifest.json');
    writeFileSync(path, readFileSync(path).toString().replace('9003', '9004'));
    assert.throws(() => verifyHomePsdSource(dir), /HOME_PSD_MANIFEST_DRIFT/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('many-to-one mapping retains ordered PSD layers; placeholders have no target', () => {
  assert.deepEqual(homePsdLayersForFigma('node-1:92'), [241, 242]);
  assert.deepEqual(homePsdLayersForFigma('node-35:4'), [1076, 1077, 1265]);
  assert.equal(homePsdLayersForFigma('node-1:30'), null);
  assert.throws(() => homePsdTextById('1044'), /NOT_ADMITTED/);
  assert.throws(() => homePsdTextById('1819'), /NOT_ADMITTED/);
  assert.throws(() => homePsdTextById('999999'), /NOT_ADMITTED/);
});

test('CR paragraphs retain raw content, separate baselines and mixed emphasis', () => {
  const text = clone('2063'), before = JSON.stringify(text), lines = homePsdTextLines(text);
  assert.equal(lines.length, 2);
  assert.equal(lines[1].baseline, text.runs[0].leading);
  assert.deepEqual(lines[0].segments.map(s => s.style.fontWeight), [700, 700, 700, 400]);
  assert.equal(lines[0].segments[0].style.horizontalScale, .97);
  assert.equal(lines[1].segments[0].style.fontWeight, 400);
  assert.equal(lines.map(l => l.segments.map(s => s.characters).join('')).join('\r'), text.rawText);
  assert.equal(JSON.stringify(text), before);
});

test('UTF-16 supplementary characters and a CR boundary are not counted as code points', () => {
  const t = clone('125');
  t.rawText = 'A😀\rB';
  t.runs = [{ ...t.runs[0], rawText: 'A😀', startUtf16: 0, endUtf16: 3 },
    { ...t.runs[1], rawText: '\rB', startUtf16: 3, endUtf16: 5 }];
  t.paragraphs = [{ ...t.paragraphs[0], rawText: 'A😀\r', startUtf16: 0, endUtf16: 4 },
    { ...t.paragraphs[1], rawText: 'B', startUtf16: 4, endUtf16: 5 }];
  const lines = homePsdTextLines(t);
  assert.equal(lines[0].segments[0].endUtf16, 3);
  assert.equal(lines[1].segments[0].startUtf16, 4);
  t.runs[0].endUtf16 = 2;
  assert.throws(() => homePsdTextLines(t), /run-coverage/);
});

test('center alignment is anchored on the baseline origin after per-run scaling', () => {
  const text = clone('110'), lines = homePsdTextLines(text);
  const widths = Object.fromEntries(lines[0].segments.map((s, i) => [s.key, i ? 90 : 10]));
  const positioned = homePsdPositionedLines(lines, widths)[0];
  assert.equal(positioned.segments[0].x, -50);
  assert.equal(positioned.segments[1].x, -40);
  assert.equal(positioned.segments[1].x + positioned.segments[1].advance, 50);
  assert.deepEqual(text.baselineOrigin, [1138.4379615683551, 1260.082108484734]);
});

test('97 percent run advances change subsequent origins without dropping source matrix', () => {
  const t = clone('2063'), lines = homePsdTextLines(t);
  const widths = Object.fromEntries(lines.flatMap(l => l.segments).map(s => [s.key, 100]));
  const p = homePsdPositionedLines(lines, widths)[0];
  assert.equal(p.segments[0].advance, 97);
  assert.equal(p.segments[1].x, 97);
  assert.equal(p.segments[2].x, 194);
  assert.equal(t.transform.length, 6);
});

test('missing, zero, negative and nonfinite measurements never become plausible widths', () => {
  const lines = homePsdTextLines(clone('110'));
  for (const value of [undefined, 0, -1, NaN, Infinity]) {
    const widths = Object.fromEntries(lines[0].segments.map(s => [s.key, value]));
    assert.throws(() => homePsdPositionedLines(lines, widths), /MEASUREMENT_MISSING/);
  }
});

test('source caps and faux italic are display properties, not raw text edits', () => {
  const t = clone('126');
  assert.equal(homePsdTextLines(t)[0].segments.map(s => s.characters).join(''), t.rawText.toUpperCase());
  assert.equal(t.rawText, 'Interior · glass Film academy');
  assert.equal(homePsdSvgRunStyle(clone('2068').runs[0]).fontStyle, 'oblique');
  assert.equal(homePsdSvgRunStyle(clone('242').runs[0]).fontWeight, 800);
});

test('color and background alpha have distinct owners; similar composites are not aliases', () => {
  assert.equal(homePsdColor('#172C57'), 'var(--smd-brand-navy)');
  assert.equal(homePsdColor('#EAF1FF'), 'var(--home-psd-benefit-surface)');
  assert.equal(homePsdSurfaceTokens.specialStep.alphaByte, 135);
  assert.notEqual(homePsdSurfaceTokens.specialStep.color, homePsdSurfaceTokens.benefit.color);
  assert.throws(() => homePsdColor('#F2F6FF'), /UNMAPPED/);
});

test('wrong source identity, unsupported metrics and unsupported style fail explicitly', () => {
  for (const mutate of [t => { t.sourceKey = 'other:125'; }, t => { t.transform = [0, 0, 0, 0, 0, 0]; },
    t => { t.runs[0].fontWeight = 600; }, t => { t.runs[0].leading = 0; },
    t => { t.runs[0].verticalScale = .8; }, t => { t.runs[0].fontCaps = 1; },
    t => { t.runs[0].fillColorArgb[0] = 2; }]) {
    const t = clone('125'); mutate(t);
    assert.throws(() => assertHomePsdText(t), /HOME_PSD_TEXT_INVALID/);
  }
});
