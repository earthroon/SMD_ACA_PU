/** SMD-HOME-HERO-CAROUSEL-R1-CF1: presentation-only slots.
 * Existing hero IDs and Standalone Media publication authority remain canonical.
 * Focal points start at the explicit neutral center; they are not measured scene anchors.
 */
import { homeFilmAssets, type FilmImageId } from './home-film.ts';

export const HERO_CAROUSEL_REVISION = 'SMD-HOME-HERO-CAROUSEL-R1-CF1-CF3' as const;
export const HERO_CAROUSEL_DELAY_MS = 3000 as const;
/** R2 motion timing; image fade start is the caption delay's T=0 authority. */
export const HERO_DISSOLVE_DURATION_MS = 700 as const;
export const HERO_CAPTION_START_DELAY_MS = 20 as const;
export const HERO_CAPTION_FADE_MS = 420 as const;
export const HERO_CAPTION_RISE_PX = 12 as const;
const HERO_IMAGE_IDS = ['hero-1', 'hero-2', 'hero-3'] as const satisfies readonly FilmImageId[];

/** Presentation copy only. The frozen Figma text and image publication binding are unchanged.
 * Change these three records to edit each hero slide's visible text.
 * Keep desktop headline/intro explicit line breaks inside the existing Figma paint boxes.
 */
export type HeroCarouselCopy = Readonly<{
  eyebrow: string;
  heading: string;
  introduction: string;
  mobileHeading: readonly [string, string];
}>;

export const heroCarouselCopyById: Readonly<Record<FilmImageId, HeroCarouselCopy>> = Object.freeze({
  'hero-1': Object.freeze({
    eyebrow: 'INTERIOR · GLASS FILM ACADEMY',
    heading: '업계 최초, 인테리어필름 · 유리필름전문\n기술교육의 시작',
    introduction: '기술을 배우는 것을 넘어, 전문가로 성장하는 곳,\nSMD아카데미에서 실무 기술의 새로운 기준을 경험하세요.',
    mobileHeading: ['업계 최초, 인테리어필름 · 유리필름전문', '기술교육의 시작'] as const,
  }),
  'hero-2': Object.freeze({
    eyebrow: 'REAL FIELD · PRACTICAL TRAINING',
    heading: '현장의 메커니즘을 그대로,\n100% 실무 중심 기술교육.',
    introduction: '실제 시공 환경과 작업 프로세스를 그대로 반영한 교육.\n현장에서 바로 통하는 실전 기술을 완성합니다.',
    mobileHeading: ['실습으로 익히는 필름 기술', '현장에서 이어지는 시공 교육'] as const,
  }),
  'hero-3': Object.freeze({
    eyebrow: 'PERSONAL CAREER · STARTUP CONSULTING',
    heading: '기술교육 그 이상,\n취업부터 창업까지 맞춤 컨설팅.',
    introduction: '개인의 목표와 역량에 맞춘 체계적인 진로 설계.\n기술 습득부터 새로운 커리어의 시작까지 함께합니다.',
    mobileHeading: ['유리필름과 인테리어필름', '손으로 익히는 시공 과정'] as const,
  }),
});

export function resolveHeroCarouselCopy(index: number): HeroCarouselCopy {
  const asset = homeFilmAssets[index];
  if (!asset) throw new Error(`HERO_CAROUSEL_COPY_INDEX_INVALID:${index}`);
  const copy = heroCarouselCopyById[asset.id];
  if (!copy) throw new Error(`HERO_CAROUSEL_COPY_MISSING:${asset.id}`);
  return copy;
}

/** Hero-only subscription: other Figma/CMS text nodes never observe carousel changes. */
export function isHeroCarouselTextNode(nodeKey: string): boolean {
  switch (nodeKey) {
    case 'node-36:6':
    case 'node-35:5':
    case 'node-36:7': return true;
    default: return false;
  }
}

/** Figma node ID maps only the three Hero copy owners; other nodes are unchanged. */
export function resolveHeroCarouselText(index: number, nodeKey: string): string | null {
  switch (nodeKey) {
    case 'node-36:6': return resolveHeroCarouselCopy(index).eyebrow;
    case 'node-35:5': return resolveHeroCarouselCopy(index).heading;
    case 'node-36:7': return resolveHeroCarouselCopy(index).introduction;
    default: return null;
  }
}

export type HeroFocalPoint = Readonly<{ xPercent: number; yPercent: number }>;
export type HeroMediaResolution =
  | Readonly<{ kind: 'local'; src?: string; alt?: string; width?: number; height?: number }>
  | Readonly<{
      kind: 'published'; publicationId: string; assetId: string;
      src: string; alt: string; width: number; height: number;
    }>
  | Readonly<{ kind: 'unbound' }>;
export type HeroCarouselSlot = Readonly<{
  slotId: FilmImageId;
  imageId: FilmImageId;
  order: number;
  src: string;
  alt: string;
  width: number;
  height: number;
  focalPoint: HeroFocalPoint;
  publicationId: string | null;
  assetId: string | null;
}>;

export const heroCarouselFocalPoints: Readonly<Record<FilmImageId, HeroFocalPoint>> = Object.freeze({
  'hero-1': Object.freeze({ xPercent: 50, yPercent: 50 }),
  'hero-2': Object.freeze({ xPercent: 50, yPercent: 50 }),
  'hero-3': Object.freeze({ xPercent: 50, yPercent: 50 }),
});

function validDimension(n: number): boolean {
  return Number.isSafeInteger(n) && n > 0;
}

export function resolveHeroCarouselSlots(
  resolveMedia: (id: FilmImageId) => HeroMediaResolution,
): readonly HeroCarouselSlot[] {
  if (homeFilmAssets.length !== HERO_IMAGE_IDS.length ||
      homeFilmAssets.some((asset, i) => asset.id !== HERO_IMAGE_IDS[i])) {
    throw new Error('HERO_CAROUSEL_SLOT_ORDER_DRIFT');
  }

  const observed = new Set<FilmImageId>();
  const slots = homeFilmAssets.map((asset, order): HeroCarouselSlot => {
    if (observed.has(asset.id)) throw new Error(`HERO_CAROUSEL_DUPLICATE_IMAGE:${asset.id}`);
    observed.add(asset.id);
    const focalPoint = heroCarouselFocalPoints[asset.id];
    if (!focalPoint || ![focalPoint.xPercent, focalPoint.yPercent]
      .every(n => Number.isFinite(n) && n >= 0 && n <= 100)) {
      throw new Error(`HERO_CAROUSEL_FOCAL_INVALID:${asset.id}`);
    }
    const binding = resolveMedia(asset.id);
    switch (binding.kind) {
      case 'unbound':
        throw new Error(`STANDALONE_FILM_IMAGE_NOT_PUBLISHED:${asset.id}`);
      case 'local': {
        const src = binding.src ?? asset.src;
        const alt = binding.alt ?? asset.alt;
        const width = binding.width ?? asset.width;
        const height = binding.height ?? asset.height;
        if (!src || !alt || !validDimension(width) || !validDimension(height)) {
          throw new Error(`HERO_CAROUSEL_SOURCE_INVALID:${asset.id}`);
        }
        return {
          slotId: asset.id, imageId: asset.id, order, src, alt,
          width, height, focalPoint,
          publicationId: null, assetId: null,
        };
      }
      case 'published': {
        if (!binding.publicationId || !binding.assetId || !binding.src ||
            !validDimension(binding.width) || !validDimension(binding.height) ||
            typeof binding.alt !== 'string') {
          throw new Error(`HERO_CAROUSEL_PUBLICATION_INVALID:${asset.id}`);
        }
        return {
          slotId: asset.id, imageId: asset.id, order, src: binding.src, alt: binding.alt,
          width: binding.width, height: binding.height, focalPoint,
          publicationId: binding.publicationId, assetId: binding.assetId,
        };
      }
    }
  });
  return Object.freeze(slots);
}
