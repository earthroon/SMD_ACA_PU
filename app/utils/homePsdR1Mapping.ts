import { homePsdTextMappings } from '../data/home-psd-r1-mapping.ts';

export function homePsdLayersForFigma(key: string): readonly number[] | null {
  return Object.hasOwn(homePsdTextMappings, key)
    ? homePsdTextMappings[key as keyof typeof homePsdTextMappings] : null;
}

