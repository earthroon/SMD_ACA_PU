/** SMD_HOME_MEDIA_SLOT_R1 · VS Code editable LOCAL image addresses only.
 * The slot IDs and Figma geometry remain owned by home-r2-manifest.ts.
 * Published/CMS assets are resolved elsewhere, never overridden here.
 * Copy each image into public/media/home/, then edit src to its root URL.
 */
import type {HomeMediaSlotId} from './home-r2-manifest';
import {homeFilmAssets, type FilmImageId} from './home-film.ts';

export type HomeLocalMediaDraft = Readonly<{
  src: string | null;
  alt: string;
  title: string;
  width: number | null;
  height: number | null;
}>;

/** Only replace values after src. A null src intentionally leaves the original placeholder. */
export const homeLocalMediaSlots: Readonly<Record<HomeMediaSlotId,HomeLocalMediaDraft>> = {
  'home.special-start.photo': {
    // VS Code edit example: src: '/media/home/statement.png',
    src: '/media/home/statement.png',
    alt: 'SMD 아카데미 교육장 입구',
    title: 'SMD 아카데미 교육장',
    width: 1448,
    height: 1086,
  },
  'home.benefits.01.image': {src:null,alt:'',title:'',width:null,height:null},
  'home.benefits.02.image': {src:null,alt:'',title:'',width:null,height:null},
  'home.benefits.03.image': {src:null,alt:'',title:'',width:null,height:null},
  'home.benefits.04.image': {src:null,alt:'',title:'',width:null,height:null},
  'home.methods.01.image': {src:'/media/home/1.png',alt:'교육 방법 이미지 1',title:'교육 방법 1',width:1756,height:896},
  'home.methods.02.image': {src:'/media/home/2.jpg',alt:'교육 방법 이미지 2',title:'교육 방법 2',width:4000,height:3000},
  'home.methods.03.image': {src:'/media/home/3.png',alt:'교육 방법 이미지 3',title:'교육 방법 3',width:1774,height:887},
};

/** SMD_HOME_MEDIA_SLOT_R2: 3 independently editable Hero photos.
 * Defaults reuse the already checked-in /media/hero/* pictures; no duplicate upload.
 * New manual images: place under public/media/home/ and set a root-relative src.
 * Standalone Published ignores this map. CMS mode retains its existing Hero behavior.
 */
export const homeHeroLocalMediaSlots: Readonly<Record<FilmImageId,HomeLocalMediaDraft>> = {
  'hero-1': {src:homeFilmAssets[0].src,alt:homeFilmAssets[0].alt,title:homeFilmAssets[0].alt,
    width:homeFilmAssets[0].width,height:homeFilmAssets[0].height},
  'hero-2': {src:homeFilmAssets[1].src,alt:homeFilmAssets[1].alt,title:homeFilmAssets[1].alt,
    width:homeFilmAssets[1].width,height:homeFilmAssets[1].height},
  'hero-3': {src:homeFilmAssets[2].src,alt:homeFilmAssets[2].alt,title:homeFilmAssets[2].alt,
    width:homeFilmAssets[2].width,height:homeFilmAssets[2].height},
};
