// =============================================================================
// Las miniaturas VERTICALES (9:16): las portadas de los Shorts y los Reels (13/11/2026)
// =============================================================================
// Martín, 13/11/2026 (por el Cerebro): «miniaturas verticales en Image, para shorts y reels, además de las horizontales de
// YouTube. Con plantillas y réplica de outliers verticales, y que el piloto de YouTube de CoPilot las pueda pedir».
//
// DE DÓNDE SALEN: de los outliers de VIDEO (lib/video-outliers.ts → la portada de `/video-editor`): los reels que Spy ya trajo,
// con la portada guardada en NUESTRO bucket, su «×» de toda la app y su link. No se paga ninguna lectura nueva. La biblioteca de
// Thumbnails sigue siendo de videos LARGOS a propósito (lib/thumbnails/carga.ts: «un Short no es una miniatura que se diseñe»);
// lo vertical es otra fuente, no un filtro de la misma.
//
// Puro (sin `server-only`): lo usan la pantalla, la ruta del explorador, la réplica y los tests.
// =============================================================================

import type { Multiplo } from '../multiplo-rendimiento';
import type { OutlierVideo, RedOutlier } from '../video-outliers';
import { plano } from '../carruseles/texto';

/** Las dos miniaturas de Image: la de YouTube (16:9, 1280 × 720) y la de un Short o un Reel (9:16, 1080 × 1920). */
export type FormatoThumbnail = 'horizontal' | 'vertical';
export const ANCHO_VERTICAL = 1080;
export const ALTO_VERTICAL = 1920;

/**
 * El link a las verticales de Image (el que da el CoPilot en su tarjeta de YouTube). Escrito y no armado con `queryDeThumbnails`
 * para que el CoPilot no cargue el explorador entero; tests/thumbnails-verticales.test.ts lo compara con el que arma la pantalla.
 */
export const RUTA_VERTICALES = '/image-editor?que=thumbnails&tformato=vertical';

export type Vertical = {
  /** El id del outlier de video (`<fuente>:<id>`): lo que viaja a la réplica. */
  id: string;
  red: RedOutlier;
  formato: 'reel' | 'short';
  creador: { nombre: string; usuario: string | null; foto: string | null };
  /** El link al original (siempre). */
  url: string;
  /** La portada: una imagen que la fuente puede servir (nuestro bucket). */
  miniatura: string;
  titulo: string;
  multiplo: Multiplo | null;
  /** El «×» como número (null = sin número): para ordenar y para el chip. */
  veces: number | null;
  vistas: number | null;
  publicada: string | null;
};

/**
 * Las verticales de la portada de Video: los reels y los Shorts CON portada (sin imagen no hay nada que replicar), sin repetir,
 * los que más se salen de lo normal de su cuenta primero (después, los más vistos).
 */
export function verticalesDe(outliers: readonly OutlierVideo[]): Vertical[] {
  const vistos = new Set<string>();
  const out: Vertical[] = [];
  for (const o of outliers) {
    if ((o.formato !== 'reel' && o.formato !== 'short') || !o.miniatura || !/^https:\/\//.test(o.miniatura) || vistos.has(o.id)) continue;
    vistos.add(o.id);
    out.push({
      id: o.id, red: o.red, formato: o.formato,
      creador: { nombre: o.creador.nombre, usuario: o.creador.usuario, foto: o.creador.foto ?? null },
      url: o.url, miniatura: o.miniatura, titulo: o.titulo, multiplo: o.multiplo,
      veces: o.multiplo && o.multiplo.veces != null ? o.multiplo.veces : null,
      vistas: o.vistas ?? null, publicada: o.publicada ?? null,
    });
  }
  return out.sort((a, b) => (b.veces ?? -1) - (a.veces ?? -1) || (b.vistas ?? -1) - (a.vistas ?? -1) || a.id.localeCompare(b.id));
}

/** Lo que se busca en Thumbnails también busca en las verticales: palabras del título, o un @cuenta. */
export function coincideVertical(v: Vertical, q: string): boolean {
  const s = plano(q);
  if (!s) return true;
  if (s.startsWith('@')) {
    const u = s.slice(1).replace(/\s+/g, '');
    return !u || plano(v.creador.usuario ?? '').replace(/\s+/g, '').includes(u) || plano(v.creador.nombre).replace(/\s+/g, '').includes(u);
  }
  const donde = plano([v.titulo, v.creador.nombre, v.creador.usuario].filter(Boolean).join(' '));
  return s.split(' ').every((p) => donde.includes(p));
}

/** Un id de outlier de video que se puede pedir (`spy:123`, `mako:reel-x`): nunca cualquier texto. */
export const esIdDeVertical = (id: unknown): id is string => typeof id === 'string' && /^[a-z][a-z0-9-]{1,20}:[A-Za-z0-9_.-]{1,80}$/.test(id);

/** Las notas del diseño replicado: de dónde salió (no salen en la imagen). */
export function notasDeVertical(v: Pick<Vertical, 'creador' | 'url' | 'formato'>): string {
  const quien = v.creador.usuario ? `@${v.creador.usuario}` : v.creador.nombre;
  return `Diseño tomado de la portada de un ${v.formato === 'short' ? 'Short' : 'Reel'} de ${quien} (${v.url}). Los textos son tuyos: cámbialos como quieras. · Lo importante va en el centro: arriba y abajo los tapa la app (el título y los botones) y tu perfil de Instagram la recorta a 3:4.`;
}
