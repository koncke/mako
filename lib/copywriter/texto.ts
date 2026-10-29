// =============================================================================
// copywriter/texto — un guion escrito como TEXTO, convertido en bloques del documento (PURO)
// =============================================================================
// Lo que llega por la API de MaKo (lib/api-mako/areas/copywriter.*) es texto: un agente de Claude, WhatsApp o un
// integrador no escribe JSON de ProseMirror. El contrato es el de toda la casa (lib/guion-secciones.ts): una etiqueta de
// sección en MAYÚSCULA en su propio renglón abre esa sección. Además, como en Notion al pegar: «- » es una viñeta,
// «1. » una numerada, «[] » una tarea, «> » una cita, «# »/«## »/«### » un encabezado y una línea vacía separa párrafos.
// =============================================================================

import { esSubtitulo } from '../guion-secciones';
import { NODOS, bidNuevo, esEtiqueta, parrafo, tituloDeSeccion } from './doc';
import type { JsonNodo } from './tipos';

const linea = (t: string): JsonNodo[] => (t ? [{ type: NODOS.texto, text: t }] : []);
const item = (tipo: string, t: string, attrs?: Record<string, unknown>): JsonNodo => ({ type: tipo, ...(attrs ? { attrs } : {}), content: [{ type: NODOS.parrafo, content: linea(t) }] });

/** Los bloques de un texto (ver la cabecera). Las listas seguidas del mismo tipo se juntan en una. */
export function bloquesDeTexto(texto: string): JsonNodo[] {
  const out: JsonNodo[] = [];
  const agregarALista = (tipo: string, n: JsonNodo, attrs: Record<string, unknown> = {}) => {
    const ult = out[out.length - 1];
    if (ult && ult.type === tipo) { ult.content!.push(n); return; }
    out.push({ type: tipo, attrs: { ...attrs, bid: bidNuevo() }, content: [n] });
  };
  for (const crudo of texto.replace(/\r/g, '').split('\n')) {
    const l = crudo.trim();
    if (!l) continue;
    const limpia = l.replace(/\*\*/g, '').replace(/[:：]$/, '').trim();
    if (esSubtitulo(limpia, 20) && esEtiqueta(limpia)) { out.push(tituloDeSeccion(limpia)); continue; }
    let m: RegExpMatchArray | null;
    if ((m = l.match(/^(#{1,3})\s+(.+)$/))) { out.push({ type: NODOS.titulo, attrs: { level: m[1].length, bid: bidNuevo(), seccion: null }, content: linea(m[2].trim()) }); continue; }
    if ((m = l.match(/^\[( |x)?\]\s+(.+)$/i))) { agregarALista(NODOS.tareas, { ...item(NODOS.tarea, m[2].trim()), attrs: { checked: (m[1] ?? '').toLowerCase() === 'x' } }); continue; }
    if ((m = l.match(/^[-•*]\s+(.+)$/))) { agregarALista(NODOS.vinetas, item(NODOS.item, m[1].trim())); continue; }
    if ((m = l.match(/^\d+[.)]\s+(.+)$/))) { agregarALista(NODOS.numerada, item(NODOS.item, m[1].trim()), { start: 1 }); continue; }
    if ((m = l.match(/^>\s+(.+)$/))) { out.push({ type: NODOS.cita, attrs: { bid: bidNuevo() }, content: [{ type: NODOS.parrafo, content: linea(m[1].trim()) }] }); continue; }
    out.push(parrafo(l));
  }
  return out;
}

/** Un documento entero a partir de un texto (vacío = un renglón). */
export function docDeTexto(texto: string): JsonNodo {
  const content = bloquesDeTexto(texto);
  return { type: NODOS.doc, content: content.length ? content : [parrafo()] };
}
