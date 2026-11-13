import type { homePsdSourceText } from './home-psd-r1-copy.generated.ts';

export type HomePsdTextId = keyof typeof homePsdSourceText;
export type HomePsdRun = Readonly<{
  startUtf16: number; endUtf16: number; rawText: string;
  fontName: string; fontWeight: number; fontSize: number; leading: number; autoLeading: boolean;
  effectiveFontSizeY: number; effectiveLeadingY: number; tracking: number; trackingEm: number;
  fillColorArgb: readonly number[]; sourceColor: string; fauxBold: boolean; fauxItalic: boolean;
  fontCaps: number; horizontalScale: number; verticalScale: number; baselineShift: number;
}>;
export type HomePsdText = Readonly<{
  sourceLayerId: number; sourceKey: string; rawText: string; sourceTextDigest: string;
  bbox: readonly number[]; transform: readonly number[]; baselineOrigin: readonly number[];
  layerOpacity: number; textType: number; writingDirection: number;
  warp: Readonly<{style: string; value: number; perspective: number; perspectiveOther: number}>;
  paragraphs: readonly Readonly<{startUtf16: number; endUtf16: number; rawText: string; justification: number; autoLeading: number; firstLineIndent: number; startIndent: number; endIndent: number; spaceBefore: number; spaceAfter: number; autoHyphenate: boolean}>[];
  runs: readonly HomePsdRun[];
}>;
export type HomeCurrentTextRun = Readonly<{
  characters: string; style: Readonly<Record<string, string | number>>; specialEmphasis?: boolean;
}>;
