/** Home paint roles. Shared colors keep their existing main.css owner. */
export const homePsdColorTokens = {
  '#172C57': '--smd-brand-navy',
  '#D95E22': '--smd-action-orange',
  '#2E2E2E': '--smd-footer-background',
  '#F2F2F2': '--smd-surface-alternate',
  '#FFFFFF': '--home-psd-ink-inverse',
  '#000000': '--home-psd-ink-black',
  '#2A2A2A': '--home-psd-ink-benefit',
  '#323232': '--home-psd-ink-special',
  '#161616': '--home-psd-ink-method',
  '#8196C2': '--home-psd-step-number',
  '#535353': '--home-psd-ink-note',
  '#3A3A3A': '--home-psd-ink-faq',
  '#5A5A5A': '--home-psd-ink-residual',
  '#272727': '--home-psd-ink-residual-secondary',
  '#EAF1FF': '--home-psd-benefit-surface',
  '#D7E4FF': '--home-psd-step-fill',
} as const;

/** RGB and alpha stay separate; card opacity must never fade child text. */
export const homePsdSurfaceTokens = {
  benefit: { layerIds: [243, 244, 245, 246], color: '#EAF1FF', alphaByte: 255, radius: 51 },
  specialStep: { layerIds: [2062, 2064, 2065], color: '#D7E4FF', alphaByte: 135, radius: 15 },
  heroShade: { layerIds: [124], color: '#000000', alphaByte: 153 },
  trainingShade: { layerIds: [172], color: '#000000', alphaByte: 153 },
  consultationShade: { layerIds: [1073], color: '#000000', alphaByte: 179 },
} as const;

export function homePsdColor(color: string): string {
  if (!Object.hasOwn(homePsdColorTokens, color)) {
    throw new Error(`HOME_PSD_COLOR_UNMAPPED:${color}`);
  }
  return `var(${homePsdColorTokens[color as keyof typeof homePsdColorTokens]})`;
}
