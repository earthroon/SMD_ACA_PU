import { homePsdSourceText } from '../data/home-psd-r1-copy.generated.ts';
import { homePsdTextMappings } from '../data/home-psd-r1-mapping.ts';
import { homePsdR1Source } from '../data/home-psd-r1-manifest.ts';
import { homePsdColor } from '../data/home-psd-r1-tokens.ts';
import type { HomePsdRun, HomePsdText, HomePsdTextId } from '../data/home-psd-r1-types.ts';


export function homePsdTextById(id: HomePsdTextId): HomePsdText {
  const text: HomePsdText | undefined = homePsdSourceText[id];
  if (!text || !Object.values(homePsdTextMappings).some(ids => (ids as readonly number[]).includes(text.sourceLayerId))) {
    throw new Error(`HOME_PSD_TEXT_NOT_ADMITTED:${id}`);
  }
  return text;
}

export function assertHomePsdText(text: HomePsdText): void {
  const fail = (reason: string): never => { throw new Error(`HOME_PSD_TEXT_INVALID:${text.sourceLayerId}:${reason}`); };
  if (text.sourceKey !== `${homePsdR1Source.psdSha256}:${text.sourceLayerId}`) fail('identity');
  if (!text.rawText || !text.runs.length) fail('empty');
  if (text.textType !== 0 || text.writingDirection !== 0 || text.warp.style !== 'warpNone'
    || text.warp.value !== 0 || text.warp.perspective !== 0 || text.warp.perspectiveOther !== 0) fail('unsupported-text-shape');
  if (text.transform.length !== 6 || !text.transform.every(Number.isFinite)) fail('transform');
  const [a, b, c, d] = text.transform as readonly [number, number, number, number, number, number];
  if (Math.abs(a * d - b * c) < 1e-12) fail('singular-transform');
  if (text.bbox.length !== 4 || !text.bbox.every(Number.isFinite) || text.bbox[2]! <= text.bbox[0]! || text.bbox[3]! <= text.bbox[1]!) fail('bbox');
  if (!Number.isInteger(text.layerOpacity) || text.layerOpacity < 0 || text.layerOpacity > 255) fail('opacity');
  let offset = 0;
  for (const run of text.runs) {
    if (run.startUtf16 !== offset || run.endUtf16 !== offset + run.rawText.length || text.rawText.slice(offset, run.endUtf16) !== run.rawText) fail('run-coverage');
    const weights: Record<string, number> = { Regular: 400, Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800 };
    if (!run.fontName.startsWith('Pretendard-') || weights[run.fontName.slice(11)] !== run.fontWeight) fail('font');
    if (![run.fontSize, run.leading, run.horizontalScale].every(v => Number.isFinite(v) && v > 0)) fail('metrics');
    if (!Number.isFinite(run.trackingEm) || run.trackingEm !== run.tracking / 1000) fail('tracking');
    if (run.verticalScale !== 1 || run.baselineShift !== 0 || run.fauxBold || ![0, 2].includes(run.fontCaps)) fail('unsupported-style');
    if (run.fillColorArgb.length !== 4 || !run.fillColorArgb.every(v => Number.isFinite(v) && v >= 0 && v <= 1)) fail('paint');
    if (run.leading !== text.runs[0]!.leading || run.fontSize !== text.runs[0]!.fontSize) fail('mixed-line-metrics');
    homePsdColor(run.sourceColor);
    offset = run.endUtf16;
  }
  if (offset !== text.rawText.length) fail('run-tail');
  offset = 0;
  for (const p of text.paragraphs) {
    if (p.startUtf16 !== offset || p.endUtf16 !== offset + p.rawText.length || text.rawText.slice(offset, p.endUtf16) !== p.rawText || ![0, 1, 2].includes(p.justification)) fail('paragraph');
    if ([p.firstLineIndent, p.startIndent, p.endIndent, p.spaceBefore, p.spaceAfter].some(value => value !== 0) || p.autoHyphenate) fail('paragraph-flow');
    if (/\r/.test(p.rawText.slice(0, -1)) || /\n/.test(p.rawText)) fail('paragraph-break');
    offset = p.endUtf16;
  }
  if (offset !== text.rawText.length) fail('paragraph-tail');
}

export type HomePsdSegment = Readonly<{
  key: string; startUtf16: number; endUtf16: number; characters: string;
  style: HomePsdRun; lineIndex: number;
}>;
export type HomePsdLine = Readonly<{
  baseline: number; anchor: 'start' | 'middle' | 'end'; segments: readonly HomePsdSegment[];
}>;

/** Raw UTF-16 offsets survive CR removal and all-caps display derivation. */
export function homePsdTextLines(text: HomePsdText): readonly HomePsdLine[] {
  assertHomePsdText(text);
  const lines: HomePsdLine[] = [];
  let start = 0;
  for (const paragraph of text.paragraphs) {
    const end = paragraph.endUtf16 - (paragraph.rawText.endsWith('\r') ? 1 : 0);
    const index = lines.length;
    const segments = text.runs.flatMap((run, runIndex): HomePsdSegment[] => {
      const from = Math.max(start, run.startUtf16), to = Math.min(end, run.endUtf16);
      if (from >= to) return [];
      const raw = text.rawText.slice(from, to);
      return [{ key: `${index}:${runIndex}:${from}`, startUtf16: from, endUtf16: to,
        characters: run.fontCaps === 2 ? raw.toUpperCase() : raw, style: run, lineIndex: index }];
    });
    lines.push({ baseline: index * text.runs[0]!.leading,
      anchor: paragraph.justification === 2 ? 'middle' : paragraph.justification === 1 ? 'end' : 'start', segments });
    start = paragraph.endUtf16;
  }
  return lines;
}

/** Measured SVG advances, then Photoshop's per-run horizontal scale. No guessed width. */
export function homePsdPositionedLines(lines: readonly HomePsdLine[], widths: Readonly<Record<string, number>>) {
  return lines.map(line => {
    const advances = line.segments.map(s => {
      const width = widths[s.key];
      if (width === undefined || !Number.isFinite(width) || width < 0 || (s.characters.length > 0 && width === 0)) {
        throw new Error(`HOME_PSD_TEXT_MEASUREMENT_MISSING:${s.key}`);
      }
      return width * s.style.horizontalScale;
    });
    const total = advances.reduce((sum, value) => sum + value, 0);
    let x = line.anchor === 'middle' ? -total / 2 : line.anchor === 'end' ? -total : 0;
    return { ...line, width: total, segments: line.segments.map((s, index) => {
      const positioned = { ...s, x, advance: advances[index]!, transform: `translate(${x} ${line.baseline}) scale(${s.style.horizontalScale} 1)` };
      x += advances[index]!;
      return positioned;
    }) };
  });
}

export function homePsdSvgRunStyle(run: HomePsdRun): Record<string, string | number> {
  return { fontFamily: 'var(--font-ui)', fontSize: `${run.fontSize}px`, fontWeight: run.fontWeight,
    fontStyle: run.fauxItalic ? 'oblique' : 'normal', letterSpacing: `${run.fontSize * run.trackingEm}px`,
    fill: homePsdColor(run.sourceColor), fillOpacity: run.fillColorArgb[0]!, whiteSpace: 'pre' };
}
