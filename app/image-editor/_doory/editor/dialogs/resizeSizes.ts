import { t } from '../strings'

/**
 * Los tamaños de Canva para «Redimensionar» (relevamiento §8, tabla de tipos de diseño de Canva), con las medidas
 * que muestra Canva: las de impresión en cm o in, las de pantalla en px. Todo se guarda en px CSS a 96 dpi.
 *
 * Es LA lista de tamaños del editor: `engine/presets.ts` (SIZE_PRESETS: el popover de tamaño de la página) y el
 * Inicio de MaKo (`app/image-editor/inicio/tamanos.ts`) salen de acá. Un tamaño nuevo se agrega acá y en
 * `strings.ts → dialog.resizeSizes`.
 */
export type ResizeGroup = keyof typeof t.dialog.resizeGroups
export type ResizeSizeId = keyof typeof t.dialog.resizeSizes

export interface ResizeSize {
  id: ResizeSizeId
  group: ResizeGroup
  /** px a 96 dpi. */
  width: number
  height: number
  /** Las medidas como las escribe Canva: «1080 × 1080 px», «21 × 29,7 cm». */
  display: string
}

const IN = 96
const CM = 96 / 2.54
const dec = (n: number): string => String(n).replace('.', ',')

const px = (id: ResizeSizeId, group: ResizeGroup, width: number, height: number): ResizeSize => ({ id, group, width, height, display: `${width} × ${height} px` })
const cm = (id: ResizeSizeId, group: ResizeGroup, width: number, height: number): ResizeSize => ({
  id,
  group,
  width: Math.round(width * CM),
  height: Math.round(height * CM),
  display: `${dec(width)} × ${dec(height)} cm`,
})
const inch = (id: ResizeSizeId, group: ResizeGroup, width: number, height: number): ResizeSize => ({
  id,
  group,
  width: Math.round(width * IN),
  height: Math.round(height * IN),
  display: `${dec(width)} × ${dec(height)} in`,
})

export const RESIZE_SIZES: readonly ResizeSize[] = [
  px('instagramPost', 'social', 1080, 1080),
  px('instagramPortrait', 'social', 1080, 1350),
  px('instagramStory', 'social', 1080, 1920),
  px('facebookPost', 'social', 940, 788),
  px('facebookAd', 'social', 1200, 628),
  px('facebookEvent', 'social', 1920, 1080),
  px('pinterest', 'social', 1000, 1500),
  px('xPost', 'social', 1600, 900),
  px('xHeader', 'social', 1500, 500),
  px('linkedinBanner', 'social', 1584, 396),
  px('socialSquare', 'social', 800, 800),
  px('youtubeThumbnail', 'video', 1280, 720),
  px('youtubeBanner', 'video', 2560, 1440),
  px('video', 'video', 1920, 1080),
  px('mobileVideo', 'video', 1080, 1920),
  px('presentation', 'presentation', 1920, 1080),
  px('presentation43', 'presentation', 1024, 768),
  // «Foto» de Canva (el acceso del Inicio): Doory no traía un grupo de fotos.
  px('photoLandscape', 'photo', 1800, 1200),
  px('photoPortrait', 'photo', 1200, 1800),
  cm('photoCollage', 'photo', 25, 20),
  cm('a4', 'print', 21, 29.7),
  inch('letter', 'print', 8.5, 11),
  cm('a5', 'print', 14.8, 21),
  cm('a3', 'print', 29.7, 42),
  cm('poster', 'print', 42, 59.4),
  cm('flyer', 'print', 21, 29.7),
  cm('businessCard', 'print', 8.5, 5),
  cm('postcard', 'print', 14.8, 10.5),
  cm('invitation', 'print', 14, 14),
  cm('certificate', 'print', 29.7, 21),
  px('logo', 'web', 500, 500),
  px('infographic', 'web', 800, 2000),
  px('emailHeader', 'web', 600, 200),
  px('blogBanner', 'web', 560, 315),
  px('leaderboard', 'web', 728, 90),
  px('desktopWallpaper', 'web', 1920, 1080),
  px('podcastCover', 'web', 3000, 3000),
]

/** Sin tildes y en minúsculas: «publicacion» encuentra «Publicación». */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** Los tamaños cuyo nombre, categoría o medidas contienen lo buscado. */
export function searchSizes(query: string): readonly ResizeSize[] {
  const q = normalizeSearch(query)
  if (!q) return RESIZE_SIZES
  return RESIZE_SIZES.filter((s) => normalizeSearch(`${t.dialog.resizeSizes[s.id]} ${t.dialog.resizeGroups[s.group]} ${s.display} ${s.width}x${s.height}`).includes(q))
}
