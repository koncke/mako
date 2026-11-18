// =============================================================================
// razones-fundir — regenerar los anuncios planteados SIN borrar guiones (puro, sin server-only: lo prueban los tests)
// =============================================================================
// Pendiente O19, P0-11 (18/11/2026, docs/pendientes-verificados-17-11.md): «generar_anuncios_planteados (la matriz), que
// fusione sin borrar guiones». Generar la matriz en la pantalla (POST /api/onboarding/razones, sin `action`) la REEMPLAZA
// entera: `parseRazones` devuelve celdas nuevas con `guiones: []` e ids nuevos, así que «armá de nuevo las motivaciones» se
// llevaba los guiones en borrador, grabados y publicados, y dejaba huérfano todo lo que guardaba un `celdaId` afuera (el
// Video Generator). Por eso la API no lo ofrecía (contenido.def.ts, «NO entran»). Esto es lo que lo hace seguro:
//
//   · SE QUEDA TAL CUAL toda celda CON TRABAJO: con algún guion, con un formato de imagen o de video elegido, con una imagen,
//     o la celda virtual de los guiones propios. Mismo id, mismo texto, mismos guiones: lo que cuelga de ella sigue andando.
//   · SE REEMPLAZA la celda que no tiene nada todavía (sólo la motivación y su copy): es lo que la persona pide rehacer.
//   · LAS NUEVAS LLENAN EL LUGAR, hasta 3 por avatar (la metodología: 3 motivaciones por avatar), y nunca repiten el nombre
//     de una motivación que ya está en ese avatar. Un avatar con 3 celdas con trabajo no recibe ninguna.
//   · Una celda de un avatar que ya no existe: con trabajo se queda (sus guiones son de la persona); sin trabajo se va, como
//     se iba al generar en la pantalla.
//   · Con `soloAvatar`, sólo se tocan las celdas de ese avatar; las demás quedan como están.
//
// ⚠️ La pantalla sigue reemplazando entero (app/api/onboarding/razones/route.ts): llevarla a esto es una decisión de
// producto que no se tomó acá (docs/hallazgos-api-mako.md, «Las tres acciones que faltaban», 18/11/2026).
// =============================================================================

import type { RazonCelda } from './razones';
import { CELDA_GUIONES_PROPIOS } from './angulos-data';

/** Cuántas motivaciones por avatar (la metodología de «Anuncio Ganador», lib/razones.ts `RAZONES_SYSTEM_TEMPLATE`). */
export const RAZONES_POR_AVATAR = 3;

/** ¿La celda tiene algo que se perdería si se reemplaza? (un guion, un formato elegido, una imagen, o es la de los propios) */
export function tieneTrabajo(c: Pick<RazonCelda, 'id' | 'guiones' | 'anguloImagen' | 'anguloVideo' | 'imagenUrl'>): boolean {
  return c.id === CELDA_GUIONES_PROPIOS || (c.guiones?.length ?? 0) > 0 || !!c.anguloImagen || !!c.anguloVideo || !!c.imagenUrl;
}

/** El nombre de una motivación para compararlo: sin tildes, en minúsculas y con un espacio entre palabras. */
const plano = (t: string): string => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export type FusionMatriz = {
  /** La matriz que se guarda. */
  razones: RazonCelda[];
  /** Las celdas con trabajo que se quedan como están (en lo que se tocó: todas, o las del avatar elegido). */
  conservadas: RazonCelda[];
  /** Las que se sacan porque no tenían nada (las reemplazan las nuevas). */
  reemplazadas: RazonCelda[];
  /** Las nuevas que entran. */
  agregadas: RazonCelda[];
};

/**
 * Lo que queda de la matriz `actuales` con las motivaciones `nuevas` (las de `generarRazones`). `avatares`: los ids de los
 * avatares de hoy, en su orden (el de las filas). Ver la cabecera para las reglas.
 */
export function fundirMatriz(
  actuales: readonly RazonCelda[], nuevas: readonly RazonCelda[],
  o: { avatares: readonly string[]; soloAvatar?: string | null; porAvatar?: number },
): FusionMatriz {
  const tope = o.porAvatar ?? RAZONES_POR_AVATAR;
  const hoy = new Set(o.avatares);
  const toca = (avatarId: string) => !o.soloAvatar || avatarId === o.soloAvatar;
  const conservadas: RazonCelda[] = [];
  const reemplazadas: RazonCelda[] = [];
  const quedan: RazonCelda[] = [];
  for (const c of actuales) {
    if (!toca(c.avatarId)) { quedan.push(c); continue; }
    if (tieneTrabajo(c)) { conservadas.push(c); quedan.push(c); continue; }
    reemplazadas.push(c);
  }
  const agregadas: RazonCelda[] = [];
  for (const av of o.avatares) {
    if (!toca(av)) continue;
    const delAvatar = quedan.filter((c) => c.avatarId === av);
    const nombres = new Set(delAvatar.map((c) => plano(c.nombre)));
    let cupo = tope - delAvatar.length;
    for (const n of nuevas) {
      if (cupo <= 0) break;
      if (n.avatarId !== av) continue;
      const k = plano(n.nombre);
      if (!k || nombres.has(k)) continue;
      nombres.add(k);
      agregadas.push(n);
      cupo -= 1;
    }
  }
  // El orden: por avatar (el de las filas), lo que se queda primero y las nuevas detrás; después lo que no es de ningún
  // avatar de hoy (los guiones propios y las celdas con trabajo de un avatar que se borró), en el orden en que estaban.
  const razones: RazonCelda[] = [];
  for (const av of o.avatares) {
    razones.push(...quedan.filter((c) => c.avatarId === av), ...agregadas.filter((c) => c.avatarId === av));
  }
  razones.push(...quedan.filter((c) => !hoy.has(c.avatarId)));
  return { razones, conservadas, reemplazadas, agregadas };
}

/** Lo que pasa con las celdas de hoy si se regenera (para el resumen que la persona confirma, sin llamar a la IA). */
export function queQuedaAlRegenerar(actuales: readonly RazonCelda[], soloAvatar?: string | null): { conservadas: RazonCelda[]; reemplazadas: RazonCelda[] } {
  const toca = (c: RazonCelda) => !soloAvatar || c.avatarId === soloAvatar;
  return {
    conservadas: actuales.filter((c) => toca(c) && tieneTrabajo(c)),
    reemplazadas: actuales.filter((c) => toca(c) && !tieneTrabajo(c)),
  };
}
