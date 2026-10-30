// =============================================================================
// copywriter/texto — un guion escrito como TEXTO, convertido en bloques del documento (PURO)
// =============================================================================
// Lo que llega por la API de MaKo (lib/api-mako/areas/copywriter.*) es texto: un agente de Claude, WhatsApp o un
// integrador no escribe JSON de ProseMirror. El contrato es el de toda la casa (lib/guion-secciones.ts): una etiqueta de
// sección en MAYÚSCULA en su propio renglón abre esa sección. Además, como en Notion al pegar: «- » es una viñeta,
// «1. » una numerada, «[] » una tarea, «> » una cita, «# »/«## »/«### » un encabezado y una línea vacía separa párrafos.
//
// `docDeEjemplo` (29/10/2026, los ejemplos de las plantillas: ./plantillas-ejemplos.ts) es la MISMA lectura con tres casos
// más: «!<emoji> texto» es un destacado, las líneas «| a | b |» seguidas son una tabla (la primera fila, el encabezado) y
// «**x**» es negrita. `bloquesDeTexto` NO los lee: lo usa la API de MaKo, y cambiarle la lectura cambiaría lo que crean
// los integradores. ⚠️ Un renglón de 20 caracteres o menos en MAYÚSCULA abre una sección (también en los ejemplos): el
// texto en pantalla va siempre entre «».
// =============================================================================

import { esSubtitulo } from '../guion-secciones';
import { NODOS, bidNuevo, esEtiqueta, parrafo, tituloDeSeccion } from './doc';
import type { JsonNodo } from './tipos';

const linea = (t: string): JsonNodo[] => (t ? [{ type: NODOS.texto, text: t }] : []);

/** Un renglón con «**negrita**»: sus pedazos, cada uno con su marca. */
const conNegrita = (t: string): JsonNodo[] =>
  t.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((p) => {
    const m = p.match(/^\*\*([^*]+)\*\*$/);
    return m ? { type: NODOS.texto, text: m[1], marks: [{ type: 'bold' }] } : { type: NODOS.texto, text: p };
  });

/** Las celdas de una fila «| a | b |». */
const celdasDe = (l: string): string[] => l.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

function leer(texto: string, ejemplo: boolean): JsonNodo[] {
  const enLinea = ejemplo ? conNegrita : linea;
  const item = (tipo: string, t: string, attrs?: Record<string, unknown>): JsonNodo => ({ type: tipo, ...(attrs ? { attrs } : {}), content: [{ type: NODOS.parrafo, content: enLinea(t) }] });
  const out: JsonNodo[] = [];
  const agregarALista = (tipo: string, n: JsonNodo, attrs: Record<string, unknown> = {}) => {
    const ult = out[out.length - 1];
    if (ult && ult.type === tipo) { ult.content!.push(n); return; }
    out.push({ type: tipo, attrs: { ...attrs, bid: bidNuevo() }, content: [n] });
  };
  let filas: string[][] = [];
  const cerrarTabla = () => {
    if (!filas.length) return;
    const ancho = Math.max(...filas.map((f) => f.length));
    out.push({
      type: NODOS.tabla, attrs: { bid: bidNuevo() },
      content: filas.map((f, i) => ({
        type: NODOS.fila,
        content: Array.from({ length: ancho }, (_, k) => ({ type: i === 0 ? NODOS.celdaTitulo : NODOS.celda, content: [{ type: NODOS.parrafo, content: enLinea(f[k] ?? '') }] })),
      })),
    });
    filas = [];
  };
  for (const crudo of texto.replace(/\r/g, '').split('\n')) {
    const l = crudo.trim();
    if (ejemplo && l.startsWith('|')) { filas.push(celdasDe(l)); continue; }
    cerrarTabla();
    if (!l) continue;
    const limpia = l.replace(/\*\*/g, '').replace(/[:：]$/, '').trim();
    if (esSubtitulo(limpia, 20) && esEtiqueta(limpia)) { out.push(tituloDeSeccion(limpia)); continue; }
    let m: RegExpMatchArray | null;
    if (ejemplo && (m = l.match(/^!(\S+)\s+(.+)$/))) { out.push({ type: NODOS.destacado, attrs: { emoji: m[1], bid: bidNuevo() }, content: [{ type: NODOS.parrafo, content: enLinea(m[2].trim()) }] }); continue; }
    if ((m = l.match(/^(#{1,3})\s+(.+)$/))) { out.push({ type: NODOS.titulo, attrs: { level: m[1].length, bid: bidNuevo(), seccion: null }, content: enLinea(m[2].trim()) }); continue; }
    if ((m = l.match(/^\[( |x)?\]\s+(.+)$/i))) { agregarALista(NODOS.tareas, { ...item(NODOS.tarea, m[2].trim()), attrs: { checked: (m[1] ?? '').toLowerCase() === 'x' } }); continue; }
    if ((m = l.match(/^[-•*]\s+(.+)$/))) { agregarALista(NODOS.vinetas, item(NODOS.item, m[1].trim())); continue; }
    if ((m = l.match(/^\d+[.)]\s+(.+)$/))) { agregarALista(NODOS.numerada, item(NODOS.item, m[1].trim()), { start: 1 }); continue; }
    if ((m = l.match(/^>\s+(.+)$/))) { out.push({ type: NODOS.cita, attrs: { bid: bidNuevo() }, content: [{ type: NODOS.parrafo, content: enLinea(m[1].trim()) }] }); continue; }
    out.push(ejemplo ? { ...parrafo(), content: enLinea(l) } : parrafo(l));
  }
  cerrarTabla();
  return out;
}

/** Los bloques de un texto (ver la cabecera). Las listas seguidas del mismo tipo se juntan en una. */
export const bloquesDeTexto = (texto: string): JsonNodo[] => leer(texto, false);

/** Un ejemplo de plantilla (ver la cabecera): la lectura de `bloquesDeTexto` más destacados, tablas y negritas. */
export function docDeEjemplo(texto: string): JsonNodo {
  const content = leer(texto, true);
  return { type: NODOS.doc, content: content.length ? content : [parrafo()] };
}

/** Un documento entero a partir de un texto (vacío = un renglón). */
export function docDeTexto(texto: string): JsonNodo {
  const content = bloquesDeTexto(texto);
  return { type: NODOS.doc, content: content.length ? content : [parrafo()] };
}
