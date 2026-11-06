// =============================================================================
// creaciones-guion — un guion del Copywriter como PLANTILLA: lo puro (6/11/2026)
// =============================================================================
// Leila (30/10/2026): guardar como plantilla en todas las tabs, para el negocio o para la comunidad. El enchufe que lee y
// crea la página vive en lib/creaciones-enchufes.ts; acá, lo que se decide sin la base y se prueba en
// tests/plantillas-propias-tabs.test.ts:
//   · LA DEFINICIÓN es la página (título, emoji, tipo, el método: ángulo, estructura, duración, y la plantilla de MaKo de
//     la que nació) y su documento. Nunca quién la editó (`editado`) ni su lugar en el árbol: del otro lado es otra página.
//   · PARA COMPARTIRLA se sacan los links (la marca `link` con su `href`): un link es del negocio y, vacío, no sirve. Los
//     textos los limpia el server con `limpiarTextos` (lib/plantillas-propias-reglas.ts), como en toda plantilla pública.
// SIN `server-only`.
// =============================================================================

import { INFO_TIPO, esTipoGuion, sanearProps, type JsonNodo, type PropsGuion, type TipoGuion } from './copywriter/tipos';
import { bloquesDelDoc, sanearContenido } from './copywriter/doc';

export type DefinicionGuion = { v: 1; titulo: string; emoji: string | null; tipo: TipoGuion; props: PropsGuion; contenido: JsonNodo };

/** La definición de una página: lo que se guarda en la plantilla. */
export function definicionDeGuion(pagina: { titulo: string; emoji: string | null; tipo: TipoGuion }, doc: { props: PropsGuion; contenido: JsonNodo }): DefinicionGuion {
  const props = sanearProps(doc.props, pagina.tipo);
  return { v: 1, titulo: pagina.titulo, emoji: pagina.emoji ?? null, tipo: pagina.tipo, props, contenido: doc.contenido };
}

/** Lee una definición guardada (de la base, o de otro negocio). null si no sirve. */
export function leerDefinicionGuion(def: unknown): DefinicionGuion | null {
  if (!def || typeof def !== 'object') return null;
  const d = def as Record<string, unknown>;
  if (!esTipoGuion(d.tipo)) return null;
  const s = sanearContenido(d.contenido);
  if (!s.ok) return null;
  const titulo = typeof d.titulo === 'string' ? d.titulo.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
  const emoji = typeof d.emoji === 'string' && d.emoji.trim() && d.emoji.length <= 16 ? d.emoji : null;
  return { v: 1, titulo, emoji, tipo: d.tipo, props: sanearProps(d.props, d.tipo), contenido: s.doc };
}

/** Un nodo sin sus marcas de link (recursivo). */
function sinLinks(n: JsonNodo): JsonNodo {
  const out: JsonNodo = { ...n };
  if (n.marks) {
    const marcas = n.marks.filter((m) => m.type !== 'link');
    if (marcas.length) out.marks = marcas; else delete out.marks;
  }
  if (n.content) out.content = n.content.map(sinLinks);
  return out;
}

/** Lo que no es texto y es del negocio, fuera: los links. */
export function guionParaPublico(def: unknown): unknown {
  const d = leerDefinicionGuion(def);
  if (!d) return def;
  return { ...d, contenido: sinLinks(d.contenido) };
}

/** Nombre y una línea para la galería. */
export function resumenGuion(def: unknown): { nombre: string; detalle: string } | null {
  const d = leerDefinicionGuion(def);
  if (!d) return null;
  const bloques = bloquesDelDoc(d.contenido).length;
  return { nombre: d.titulo || 'Sin título', detalle: `${INFO_TIPO[d.tipo].label} · ${bloques} ${bloques === 1 ? 'bloque' : 'bloques'}` };
}
