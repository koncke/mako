import type { FontCategory } from '@/app/image-editor/_doory/types/api'
import { COMBINACIONES_FUENTES } from '@/app/image-editor/mako/fuentes'
import { fontStack } from '../engine/text/fontStack'
import type { TextOptions } from '../engine/objects/factories'

interface Face {
  family: string
  category: FontCategory
  weight: number
  color: string
}

/** A heading face and a body face that look good together. */
export interface Pairing {
  id: string
  /** El nombre visible («Elegante», «Impacto»…). */
  name: string
  heading: Face
  body: Face
}

// Colores de Canva para las combinaciones: el título en el texto de la interfaz, el cuerpo un gris más suave.
const HEADING_COLOR = '#0e1318'
const BODY_COLOR = '#545c6b'

/**
 * Las combinaciones del panel «Texto» de Canva. Salen del catálogo de MaKo (`mako/fuentes.ts → COMBINACIONES_FUENTES`,
 * archivo generado): todas sus familias y pesos están verificados en ese mismo catálogo, así que ninguna cae en
 * silencio a la fuente del sistema. Las 6 de Doory se reemplazaron por estas 14.
 */
export const PAIRINGS: readonly Pairing[] = COMBINACIONES_FUENTES.map((c) => ({
  id: c.id,
  name: c.nombre,
  heading: { ...c.titulo, color: HEADING_COLOR },
  body: { ...c.cuerpo, color: BODY_COLOR },
}))

/** Factory options for one half of a pairing (the heading is the large half). */
export function faceOptions(face: Face, role: 'heading' | 'body', text: string): TextOptions {
  return { text, preset: role === 'heading' ? 'heading' : 'body', fontFamily: fontStack(face.family, face.category), fontWeight: face.weight, fill: face.color }
}
