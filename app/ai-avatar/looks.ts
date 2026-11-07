// =============================================================================
// Los LOOKS de AI Avatar: la persona, con su cara, en una escena de la galería
// =============================================================================
// Un look es lo que HeyGen llama «Look = personaje + escena»: una imagen de Flow
// hecha con la foto de la persona y la composición de una plantilla
// (lib/ai-avatar/plantillas.ts). Con esa imagen se anima el video.
//
// ⚠️ VIVEN APARTE DEL HISTORIAL DEL VIDEO GENERATOR, y es a propósito. El
// historial tiene un CUPO POR TIPO de 10 (`CUPOS`, app/video-generator/historial-cupos.ts):
// meter cada look ahí como un plan empujaría afuera anuncios reales, con el único
// puntero a sus clips pagados. Acá van en su propia clave, con su propio tope.
//
// ⚠️ Y un cupo propio para los avatares NO cambia esto: un look no es un plan.
// Lo que el cupo arregló (item 558, 6/11/2026) es el VIDEO de avatar, que sí es un
// plan y sí se guarda allá. Un look es una imagen, no tiene clips colgando, y su
// tope de 40 no tiene nada que ver con el de los planes.
//
// La escritura lee con `getSettingEstricto`: «no pude leer» no puede escribirse
// como «no había nada» (docs/hallazgos-generativa.md → «Leer el Video Generator
// sin la pantalla abierta»), o un error de lectura borraría todos los looks.

import 'server-only';
import { getSetting, getSettingEstricto, setSetting } from '@/lib/settings';

export const KEY_LOOKS = 'ai-avatar.looks';
/** Los más nuevos primero. Un look viejo no tiene clips colgando: se puede soltar. */
const MAX_LOOKS = 40;

export type Look = {
  id: string;
  plantillaId: string;
  fotoId: string;
  /** El trabajo `generar_imagen` del puente que lo está haciendo. */
  trabajoId: number | null;
  /** '' hasta que Flow lo devuelve. Es con lo que se anima: no vence. */
  mediaId: string;
  url: string;
  /** Por qué no salió, en una frase para la persona. */
  error: string;
  /** Lo que la persona escribió en la barra encima del preset (29/10/2026): «Recrear» lo vuelve a mandar igual. */
  detalle: string;
  creadoEn: string;
};

function sano(v: unknown): Look | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const s = (x: unknown) => (typeof x === 'string' ? x : '');
  if (!s(o.id) || !s(o.plantillaId)) return null;
  return {
    id: s(o.id),
    plantillaId: s(o.plantillaId),
    fotoId: s(o.fotoId),
    trabajoId: Number.isInteger(o.trabajoId) ? (o.trabajoId as number) : null,
    mediaId: s(o.mediaId),
    url: s(o.url),
    error: s(o.error),
    detalle: s(o.detalle),
    creadoEn: s(o.creadoEn),
  };
}

function parsear(crudo: string | null): Look[] {
  try {
    const a = JSON.parse(crudo || '[]');
    return Array.isArray(a) ? a.map(sano).filter((x): x is Look => !!x) : [];
  } catch {
    return [];
  }
}

/** Para MOSTRAR: si no se puede leer, la pantalla dice que no hay. */
export async function leerLooks(): Promise<Look[]> {
  return parsear(await getSetting(KEY_LOOKS));
}

/** Para la API: si no se puede leer, TIRA (no contesta «no hay» sobre un error). */
export async function leerLooksEstricto(): Promise<Look[]> {
  return parsear(await getSettingEstricto(KEY_LOOKS));
}

/**
 * Cambia UN look (o lo agrega arriba). Lee estricto: si la lectura falla, tira, y
 * no se escribe una lista vacía encima de la real.
 */
export async function guardarLook(look: Look): Promise<void> {
  const actual = parsear(await getSettingEstricto(KEY_LOOKS));
  const resto = actual.filter((l) => l.id !== look.id);
  const lista = actual.some((l) => l.id === look.id)
    ? actual.map((l) => (l.id === look.id ? look : l))
    : [look, ...resto];
  await setSetting(KEY_LOOKS, JSON.stringify(lista.slice(0, MAX_LOOKS)));
}

/**
 * Saca UN look de la lista (el «Eliminar» de su proyecto). Lee estricto, como `guardarLook`: con la lectura caída tira, y
 * no se escribe encima de la lista real. ⚠️ En POSITIVO: se escribe la lista SIN ese id, y sólo si ese id estaba. La
 * imagen sigue en el Flow de la persona y en Storage: esto saca el proyecto de MaKo, no borra su archivo.
 */
export async function quitarLook(id: string): Promise<boolean> {
  const actual = parsear(await getSettingEstricto(KEY_LOOKS));
  if (!id || !actual.some((l) => l.id === id)) return false;
  await setSetting(KEY_LOOKS, JSON.stringify(actual.filter((l) => l.id !== id)));
  return true;
}
