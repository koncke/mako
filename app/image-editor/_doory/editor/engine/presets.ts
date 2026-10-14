import { t } from '../strings'

/** Common design sizes offered by the Resize dialog (all storage is CSS px @96dpi). */
export interface SizePreset {
  id: string
  label: string
  width: number
  height: number
  group: 'social' | 'presentation' | 'print' | 'web' | 'video'
}

const IN = 96
const MM = 96 / 25.4

export const SIZE_PRESETS: readonly SizePreset[] = [
  { id: 'instagram-post', label: t.sizes.instagramPost, width: 1080, height: 1080, group: 'social' },
  { id: 'instagram-portrait', label: t.sizes.instagramPortrait, width: 1080, height: 1350, group: 'social' },
  { id: 'instagram-story', label: t.sizes.instagramStory, width: 1080, height: 1920, group: 'social' },
  { id: 'facebook-post', label: t.sizes.facebookPost, width: 1200, height: 630, group: 'social' },
  { id: 'twitter-post', label: t.sizes.twitterPost, width: 1600, height: 900, group: 'social' },
  { id: 'linkedin-banner', label: t.sizes.linkedinBanner, width: 1584, height: 396, group: 'social' },
  { id: 'youtube-thumbnail', label: t.sizes.youtubeThumbnail, width: 1280, height: 720, group: 'video' },
  { id: 'presentation', label: t.sizes.presentation, width: 1920, height: 1080, group: 'presentation' },
  { id: 'presentation-4-3', label: t.sizes.presentation43, width: 1024, height: 768, group: 'presentation' },
  { id: 'a4', label: t.sizes.a4, width: Math.round(210 * MM), height: Math.round(297 * MM), group: 'print' },
  { id: 'a5', label: t.sizes.a5, width: Math.round(148 * MM), height: Math.round(210 * MM), group: 'print' },
  { id: 'a3', label: t.sizes.a3, width: Math.round(297 * MM), height: Math.round(420 * MM), group: 'print' },
  { id: 'letter', label: t.sizes.letter, width: Math.round(8.5 * IN), height: Math.round(11 * IN), group: 'print' },
  { id: 'business-card', label: t.sizes.businessCard, width: Math.round(3.5 * IN), height: Math.round(2 * IN), group: 'print' },
  { id: 'postcard', label: t.sizes.postcard, width: Math.round(6 * IN), height: Math.round(4 * IN), group: 'print' },
  { id: 'web-banner', label: t.sizes.webBanner, width: 728, height: 90, group: 'web' },
  { id: 'logo', label: t.sizes.logo, width: 500, height: 500, group: 'web' },
]

export function findPreset(width: number, height: number): SizePreset | undefined {
  return SIZE_PRESETS.find((p) => p.width === width && p.height === height)
}
