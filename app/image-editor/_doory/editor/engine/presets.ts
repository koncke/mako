import { RESIZE_SIZES, type ResizeGroup } from '../dialogs/resizeSizes'
import { t } from '../strings'

/** Common design sizes (all storage is CSS px @96dpi). */
export interface SizePreset {
  id: string
  label: string
  width: number
  height: number
  group: ResizeGroup
}

/**
 * Los tamaños del editor: UNA lista, la de «Redimensionar» (`dialogs/resizeSizes.ts`), con su nombre de Canva. La
 * usan el popover de tamaño de la página y el Inicio de MaKo. (Antes Doory tenía su propia lista de 17, con ids en
 * kebab-case: un diseño viejo puede tener uno de esos en `meta.presetId`; sólo es un dato, nadie lo busca.)
 */
export const SIZE_PRESETS: readonly SizePreset[] = RESIZE_SIZES.map((s) => ({ id: s.id, label: t.dialog.resizeSizes[s.id], width: s.width, height: s.height, group: s.group }))

export function findPreset(width: number, height: number): SizePreset | undefined {
  return SIZE_PRESETS.find((p) => p.width === width && p.height === height)
}
