// =============================================================================
// creaciones-diseno — un diseño del Image Editor como PLANTILLA: lo puro (6/11/2026)
// =============================================================================
// Leila (30/10/2026): guardar como plantilla en todas las tabs, para el negocio o para la comunidad. El enchufe vive en
// lib/creaciones-enchufes.ts (tipo `formato_imagen`); acá lo que se decide sin la base:
//   · LA DEFINICIÓN es el documento del editor y su título. Privada, viaja tal cual (las fotos son del mismo negocio).
//   · PARA COMPARTIRLA, cada FOTO que subió el negocio pasa a un MARCO VACÍO del mismo tamaño y en el mismo lugar (el
//     `rect` con `isPlaceholder` que ya usan las plantillas: no se exporta nunca), y un fondo de página con foto pasa a
//     blanco. Una foto es un dato del negocio que la limpieza de textos no ve: es un link a su storage. Y `meta` (la marca
//     del documento) no viaja. Los textos los limpia el server con `limpiarTextos`, como en toda plantilla pública.
// SIN `server-only`.
// =============================================================================

import { TOPE_DOC_BYTES, resumirDoc, srcsLocales } from './image-editor/reglas';

export type DefinicionDiseno = { v: 1; titulo: string; doc: Record<string, unknown> };

/** Lo que pesa como mucho un diseño compartido: el tope del editor (un diseño más grande no se guarda). */
export const TOPE_DEFINICION_DISENO = TOPE_DOC_BYTES + 4_096;

/** Lee una definición guardada. null si no tiene la forma de un diseño o trae fotos que sólo existen en un navegador. */
export function leerDefinicionDiseno(def: unknown): DefinicionDiseno | null {
  if (!def || typeof def !== 'object') return null;
  const d = def as Record<string, unknown>;
  if (!resumirDoc(d.doc) || srcsLocales(d.doc).length) return null;
  const titulo = typeof d.titulo === 'string' ? d.titulo.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
  return { v: 1, titulo, doc: d.doc as Record<string, unknown> };
}

const num = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? x : d);

/** Una foto, como un marco vacío del mismo tamaño (con su escala aplicada) y en el mismo lugar. */
function marcoDe(o: Record<string, unknown>): Record<string, unknown> {
  const ancho = Math.max(1, num(o.width, 100) * Math.abs(num(o.scaleX, 1)));
  const alto = Math.max(1, num(o.height, 100) * Math.abs(num(o.scaleY, 1)));
  const marco: Record<string, unknown> = {
    id: o.id, type: 'rect', name: typeof o.name === 'string' && o.name.trim() ? o.name : 'Tu foto',
    left: num(o.left, 0), top: num(o.top, 0), width: ancho, height: alto, scaleX: 1, scaleY: 1,
    angle: num(o.angle, 0), originX: o.originX ?? 'left', originY: o.originY ?? 'top',
    fill: '#E9E6E1', stroke: null, strokeWidth: 0, rx: 0, ry: 0, opacity: num(o.opacity, 1),
    isPlaceholder: true, maskShape: 'rounded', maskRadius: 0,
  };
  return marco;
}

/** Recorre los objetos (y los de adentro de un grupo) cambiando cada foto por su marco. */
function sinFotos(objetos: unknown): unknown {
  if (!Array.isArray(objetos)) return objetos;
  return objetos.map((x) => {
    if (!x || typeof x !== 'object') return x;
    const o = x as Record<string, unknown>;
    if (o.type === 'image' || typeof o.src === 'string') return marcoDe(o);
    if (Array.isArray(o.objects)) return { ...o, objects: sinFotos(o.objects) };
    return o;
  });
}

/** Lo que no es texto y es del negocio, fuera: las fotos y la marca. */
export function disenoParaPublico(def: unknown): unknown {
  const d = leerDefinicionDiseno(def);
  if (!d) return def;
  const { meta: _meta, ...doc } = d.doc;
  void _meta;
  const pages = (Array.isArray(doc.pages) ? doc.pages : []).map((p) => {
    if (!p || typeof p !== 'object') return p;
    const pg = p as Record<string, unknown>;
    const fondo = pg.background && typeof pg.background === 'object' && (pg.background as { type?: unknown }).type === 'image'
      ? { type: 'solid', color: '#FFFFFF' } : pg.background;
    return { ...pg, background: fondo, objects: sinFotos(pg.objects) };
  });
  return { ...d, doc: { ...doc, pages } };
}

/** Nombre y una línea para la galería. */
export function resumenDiseno(def: unknown): { nombre: string; detalle: string } | null {
  const d = leerDefinicionDiseno(def);
  if (!d) return null;
  const r = resumirDoc(d.doc)!;
  return { nombre: d.titulo || 'Diseño', detalle: `${r.ancho} × ${r.alto} · ${r.paginas} ${r.paginas === 1 ? 'página' : 'páginas'}` };
}
