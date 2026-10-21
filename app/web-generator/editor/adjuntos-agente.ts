// =============================================================================
// adjuntos-agente — lo PURO del ⊕ del chat del editor («Edición con IA», paneles/PanelAgente.tsx)
// =============================================================================
// Pedido de Martín (18/10/2026, llamada de Fathom 864249059, el onboarding de Florencia): «es un error… no te está
// permitiendo juntar documentos, yo lo voy a solucionar». La decisión del 11/10 («Lo que NO se copia: adjuntar archivos
// al chat») se dio vuelta el 20/10.
//
// LAS PIEZAS SON LAS DEL OPS CENTER (regla de Martín del 18/10: un solo chat en toda la app): el «+» (`MasCaja`), las
// miniaturas (`ListaAdjuntos`) y pegar y soltar (`alPegar`, `alSoltar`) de app/admin/operaciones/AdjuntosCaja.tsx y
// pegar.ts. Lo que cambia es qué se hace con el archivo: el Ops Center lo sube para que lo baje la PC; acá se LEE (la
// misma ruta que Importar, `leerArchivo`) y su texto viaja con el pedido a «editar» (lib/editor-landing/adjuntos.ts).
// Esto es lo que no se ve en una captura: qué se toma, qué se avisa, cuándo se puede mandar y qué viaja. Con test
// (tests/web-generator-adjuntos.test.ts).
//
// SIN 'use client' y sin React: lo importa su test.
// =============================================================================

import type { AdjuntoCaja } from '@/app/admin/operaciones/useCentro';
import { familiaDeArchivo, porQueNoPuedo, puedeLeerse } from '@/lib/formatos-archivo';
import { MAX_ARCHIVOS, type AdjuntoEditar } from '@/lib/editor-landing/adjuntos';
import { TOPE_IMPORTAR_BYTES } from '../cliente';

/**
 * Un archivo de la caja del editor: la pieza del Ops Center (`AdjuntoCaja`: el archivo, su vista previa y su `estado`,
 * que las miniaturas dibujan) más lo que se leyó. Leído = sin `estado` y con `texto`.
 */
export type AdjuntoAgente = AdjuntoCaja & { texto?: string; error?: string };

/** Foto o documento: lo que dibuja la miniatura (la foto misma, o el ícono con su tipo). */
export const tipoDeAdjunto = (f: { name: string; type: string }): 'image' | 'document' => (familiaDeArchivo(f.name, f.type) === 'imagen' ? 'image' : 'document');

const mismo = (a: { name: string; size: number; type: string }, b: { name: string; size: number; type: string }) =>
  a.name === b.name && a.size === b.size && a.type === b.type;

/**
 * Qué archivos del «+», de soltar o de pegar entran a la caja: los que el lector de la casa sabe leer
 * (lib/formatos-archivo.ts, el mismo de Importar), de hasta 15 MB, sin repetir uno que ya está y hasta `MAX_ARCHIVOS`.
 * `aviso`: por qué quedó afuera el primero que no entró (null si entraron todos). Nunca se descarta uno callado.
 */
export function queSumar(actuales: readonly { file: { name: string; size: number; type: string } }[], nuevos: readonly File[]): { tomar: File[]; aviso: string | null } {
  const tomar: File[] = [];
  let aviso: string | null = null;
  const avisar = (t: string) => { aviso ??= t; };
  for (const f of nuevos) {
    if (actuales.some((a) => mismo(a.file, f)) || tomar.some((t) => mismo(t, f))) continue;
    if (!puedeLeerse(f.name, f.type)) { avisar(porQueNoPuedo(f.name) || `No puedo leer «${f.name}».`); continue; }
    if (f.size > TOPE_IMPORTAR_BYTES) { avisar(`«${f.name}» pesa más de 15 MB.`); continue; }
    if (actuales.length + tomar.length >= MAX_ARCHIVOS) { avisar(`Hasta ${MAX_ARCHIVOS} archivos por mensaje.`); break; }
    tomar.push(f);
  }
  return { tomar, aviso };
}

/** Lo que volvió de leer un archivo (`leerArchivo`, ../cliente). */
export type LecturaAdjunto = { ok: true; texto: string } | { ok: false; error: string };

/** El adjunto `id` con su lectura: leído (sin estado, con su texto) o en rojo con el motivo. Los demás, igual. */
export function conLectura(items: readonly AdjuntoAgente[], id: string, r: LecturaAdjunto): AdjuntoAgente[] {
  return items.map((x) => {
    if (x.id !== id) return x;
    const base: AdjuntoAgente = { id: x.id, file: x.file, tipo: x.tipo, url: x.url };
    return r.ok ? { ...base, texto: r.texto } : { ...base, estado: 'error', error: r.error };
  });
}

export const leyendo = (items: readonly AdjuntoAgente[]): boolean => items.some((x) => x.estado === 'leyendo');

/** El primero que no se pudo leer: mientras esté, no se manda (se quita con su ✕). */
export const conError = (items: readonly AdjuntoAgente[]): AdjuntoAgente | null => items.find((x) => x.estado === 'error') ?? null;

/** Lo que viaja a «editar»: el nombre y el texto de cada uno leído. */
export const paraEnviar = (items: readonly AdjuntoAgente[]): AdjuntoEditar[] =>
  items.filter((x) => !x.estado && x.texto).map((x) => ({ nombre: x.file.name, texto: x.texto as string }));

/**
 * ¿Se prende el ↑? Con algo escrito o con archivos (mandar sólo archivos, como en Claude), y nunca con uno leyéndose
 * o en rojo: lo que la persona ve en la caja es lo que viaja.
 */
export function puedeMandar(texto: string, items: readonly AdjuntoAgente[]): boolean {
  if (leyendo(items) || conError(items)) return false;
  return !!texto.trim() || paraEnviar(items).length > 0;
}

/** La línea debajo de la caja: leyendo, o por qué no se manda. null = nada que decir. */
export function avisoDeAdjuntos(items: readonly AdjuntoAgente[]): { texto: string; error: boolean } | null {
  const mal = conError(items);
  if (mal) {
    const motivo = (mal.error ?? '').trim().replace(/\.+$/, '');
    return { texto: `No pude leer «${mal.file.name}»${motivo ? `: ${motivo}` : ''}. Quítalo para mandar.`, error: true };
  }
  const n = items.filter((x) => x.estado === 'leyendo').length;
  if (n) return { texto: n === 1 ? 'Leyendo el archivo…' : `Leyendo ${n} archivos…`, error: false };
  return null;
}

/** ¿El chip de «Lo que vendes» se ofrece? Sólo si existe y no está ya en la caja. */
export const ofreceDoc = (doc: { nombre: string } | null, items: readonly AdjuntoAgente[]): boolean =>
  !!doc && !items.some((x) => x.file.name === doc.nombre);
