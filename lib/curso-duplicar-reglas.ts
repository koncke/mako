// =============================================================================
// curso-duplicar-reglas — cómo se copia un PROGRAMA (un producto con su curso) sin llevarse a nadie (puro)
// =============================================================================
// Pedido (25/10/2026, Martín por el Cerebro, después de la llamada con Leandro): «Duplicar un programa, de punta a
// punta: curso, módulos, clases y su configuración; nunca los alumnos ni su progreso».
//
// La copia la hace lib/curso-duplicar.ts; acá vive lo que decide cada pieza, sin tocar la base, para que un test lo
// ejecute. Lo que NO es obvio y por eso está acá:
//   · LOS IDS DE LAS CLASES CAMBIAN: un candado «al terminar la tarea de la clase N», la portada y los comentarios de
//     una clase (`portada:clase:N`, `comentarios:clase:N` en `curso_estilo`) apuntan al id viejo. Se traducen con el
//     mapa viejo → nuevo; lo que apunta a una clase que no se copió (estaba en la papelera) se suelta.
//   · LAS CLAVES DE LOS MÓDULOS NO CAMBIAN: son las de las etapas de la entrega, que también se copian.
//   · UNA TAREA DE LA COMUNIDAD NO SE LLEVA EL POST NI LA CATEGORÍA: son de la comunidad del original. Sin ellos la
//     tarea cae a su default (el último post fijado, la primera categoría donde puede publicar), que es lo que tiene la
//     comunidad nueva.
//   · LOS ADJUNTOS SE COPIAN CON OTRO ID: el alumno ve un adjunto sólo si es del MISMO producto que la clase
//     (`decidirAdjuntoAlumno`); con el id del original, las imágenes de la copia le darían 404. Se reescribe la
//     referencia `mako-adjunto:<id>` en la descripción y en las tareas.
//   · LOS VIDEOS SUBIDOS PESAN: el Storage tiene un tope para TODA la plataforma (lib/curso-admin.ts). Se copian sólo
//     si entre todos no pasan `TOPE_VIDEOS_COPIA`; si no, la clase de la copia queda sin video y se dice cuántos.
//
// Sin `server-only` ni `'use client'`: lo ejecuta tests/clients-duplicar-programa.test.ts.

import type { Bloqueo } from './curso-bloqueo';
import type { Campo } from './curso';

/** Lo que se agrega al nombre de la copia. */
export const SUFIJO_COPIA = ' (copia)';
/** Hasta cuánto pesan, entre todos, los videos SUBIDOS que se copian (el Storage es uno para toda la plataforma). */
export const TOPE_VIDEOS_COPIA = 300 * 1024 * 1024;

/** El nombre de la copia: «X (copia)», recortando X si hace falta para no pasar el tope. */
export function nombreDeCopia(nombre: string, tope: number): string {
  const base = (nombre ?? '').replace(/\s+/g, ' ').trim() || 'Programa';
  const lugar = Math.max(1, tope - SUFIJO_COPIA.length);
  return `${base.length > lugar ? base.slice(0, lugar).trimEnd() : base}${SUFIJO_COPIA}`;
}

/** El candado de la copia: el de «la tarea de la clase N» pasa a la clase nueva; si ésa no se copió, se suelta. */
export function bloqueoDeCopia(b: Bloqueo | null | undefined, clases: ReadonlyMap<number, number>): Bloqueo | null {
  if (!b) return null;
  if (b.tipo !== 'tarea') return b;
  const nuevo = clases.get(b.claseId);
  return nuevo ? { ...b, claseId: nuevo } : null;
}

/** Reescribe las referencias a adjuntos (`mako-adjunto:<id>`) con los ids de la copia. */
export function conAdjuntosDeCopia(html: string | null | undefined, adjuntos: ReadonlyMap<string, string>): string {
  let out = html ?? '';
  for (const [viejo, nuevo] of adjuntos) out = out.split(`mako-adjunto:${viejo}`).join(`mako-adjunto:${nuevo}`);
  return out;
}

/** Las tareas de la copia: sin el post ni la categoría de la comunidad del original, y con sus adjuntos nuevos. */
export function camposDeCopia(campos: readonly Campo[], adjuntos: ReadonlyMap<string, string>): Campo[] {
  return campos.map((c) => {
    const { categoriaId: _cat, postId: _post, postTitulo: _titulo, ...resto } = c;
    return resto.descripcionHtml ? { ...resto, descripcionHtml: conAdjuntosDeCopia(resto.descripcionHtml, adjuntos) } : resto;
  });
}

/**
 * La clave de un ajuste del estilo en la copia (`curso_estilo.clave`). Las de una clase cambian de id; las de una
 * etapa y las del curso quedan iguales. `null` = no va (la clase no se copió, o la clave no se entiende).
 */
export function claveDeEstiloEnCopia(clave: string, clases: ReadonlyMap<number, number>): string | null {
  const m = /^(portada|comentarios):clase:(\d{1,15})$/.exec(clave);
  if (!m) return clave;
  const nuevo = clases.get(Number(m[2]));
  return nuevo ? `${m[1]}:clase:${nuevo}` : null;
}

/** El título puesto a mano de la copia («X (copia)»), o `null` si el original no tenía uno (manda el de su oferta). */
export function tituloDeCopia(titulo: string | null | undefined, tope: number): string | null {
  return titulo && titulo.trim() ? nombreDeCopia(titulo, tope) : null;
}

/**
 * Qué videos SUBIDOS se copian. Todos o ninguno: una copia con la mitad de los videos se lee como rota, y elegir cuáles
 * es adivinar. Un video cuyo peso no se pudo leer cuenta como que no entra.
 */
export function videosACopiar(paths: readonly string[], peso: ReadonlyMap<string, number>, tope = TOPE_VIDEOS_COPIA):
  { copiar: string[]; sinCopiar: string[]; bytes: number } {
  const unicos = [...new Set(paths)];
  if (!unicos.length) return { copiar: [], sinCopiar: [], bytes: 0 };
  const sinPeso = unicos.some((p) => !Number.isFinite(peso.get(p) ?? NaN));
  const bytes = unicos.reduce((s, p) => s + (peso.get(p) ?? 0), 0);
  return sinPeso || bytes > tope ? { copiar: [], sinCopiar: unicos, bytes } : { copiar: unicos, sinCopiar: [], bytes };
}

/** La extensión de un archivo del bucket (`<ws>/<producto>/<uuid>.<ext>`), o `null`. */
export const extensionDe = (path: string): string | null => /\.([a-z0-9]{2,5})$/.exec(path)?.[1] ?? null;
