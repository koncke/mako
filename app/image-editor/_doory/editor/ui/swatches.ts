import { Registry } from '../engine/registry'
import { t } from '../strings'

export interface Palette {
  id: string
  label: string
  colors: readonly string[]
  /** Lower comes first. */
  order?: number
}

/** Preset swatch palettes shown in the colour picker. Extensions (brand kits…) can add their own. */
export const palettes = new Registry<Palette>((a, b) => (a.order ?? 100) - (b.order ?? 100))

export function registerPalette(palette: Palette): () => void {
  return palettes.register(palette)
}

/**
 * Los «Colores predeterminados» de Canva (colores sólidos), en su orden: grises, rojos a violetas, celestes a azules,
 * verdes a naranjas. Seis por fila, como en su panel «Color». Un color es un dato, no un diseño: se copia tal cual.
 */
export const DEFAULT_COLORS: readonly string[] = [
  '#000000', '#545454', '#737373', '#a6a6a6', '#d9d9d9', '#ffffff',
  '#ff3131', '#ff5757', '#ff66c4', '#cb6ce6', '#8c52ff', '#5e17eb',
  '#0097b2', '#0cc0df', '#5ce1e6', '#38b6ff', '#5170ff', '#004aad',
  '#00bf63', '#7ed957', '#c1ff72', '#ffde59', '#ffbd59', '#ff914d',
]

// El id sigue siendo 'doory' porque el panel de Fondo lo pide por ese id (`palettes.get('doory')`).
registerPalette({
  id: 'doory',
  label: t.swatches.defaults,
  order: 0,
  colors: DEFAULT_COLORS,
})
registerPalette({
  id: 'vivid',
  label: t.swatches.palettes.vivid,
  order: 10,
  colors: ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#f43f5e'],
})
registerPalette({
  id: 'pastel',
  label: t.swatches.palettes.pastel,
  order: 20,
  colors: ['#fecaca', '#fed7aa', '#fef08a', '#d9f99d', '#bbf7d0', '#a5f3fc', '#bfdbfe', '#c7d2fe', '#e9d5ff', '#fbcfe8'],
})
registerPalette({
  id: 'earth',
  label: t.swatches.palettes.earth,
  order: 30,
  colors: ['#292524', '#57534e', '#78716c', '#a8a29e', '#d6d3d1', '#92400e', '#b45309', '#d97706', '#65a30d', '#3f6212'],
})
registerPalette({
  id: 'mono',
  label: t.swatches.palettes.mono,
  order: 40,
  colors: ['#000000', '#262626', '#404040', '#525252', '#737373', '#a3a3a3', '#d4d4d4', '#e5e5e5', '#f5f5f5', '#ffffff'],
})

type PresetId = keyof typeof t.swatches.presets

const preset = (id: PresetId, from: string, to: string): { id: string; label: string; stops: { offset: number; color: string }[]; angle: number } => ({
  id,
  label: t.swatches.presets[id],
  // En Doory el ángulo 0 apunta a la derecha: el degradado va de izquierda a derecha, como los de Canva.
  angle: 0,
  stops: [
    { offset: 0, color: from },
    { offset: 1, color: to },
  ],
})

/** Los degradados predeterminados de Canva: dos colores de su paleta, de izquierda a derecha. */
export const GRADIENT_PRESETS: readonly { id: string; label: string; stops: { offset: number; color: string }[]; angle: number }[] = [
  preset('blackGray', '#000000', '#737373'),
  preset('grayWhite', '#a6a6a6', '#ffffff'),
  preset('redOrange', '#ff3131', '#ff914d'),
  preset('coralViolet', '#ff5757', '#8c52ff'),
  preset('bluePink', '#5170ff', '#ff66c4'),
  preset('navyLilac', '#004aad', '#cb6ce6'),
  preset('violetCyan', '#8c52ff', '#5ce1e6'),
  preset('cyanNavy', '#5de0e6', '#004aad'),
  preset('violetGreen', '#8c52ff', '#00bf63'),
  preset('tealLime', '#0097b2', '#7ed957'),
  preset('mintPink', '#c9ffbf', '#ffafbd'),
  preset('yellowOrange', '#ffde59', '#ff914d'),
]
