// =============================================================================
// lead-magnets/esqueleto — la página del Copywriter con la que nace un lead magnet (PURO)
// =============================================================================
// Nace con la ESTRUCTURA de su plantilla (./plantillas.ts), nunca con el ejemplo: un título por sección (Título 2 con su
// etiqueta, el molde de lib/copywriter/doc.ts → `tituloDeSeccion`), su guía en itálica debajo y la forma de la sección (un
// renglón, una lista de tareas, desplegables para los prompts o una tabla). La guía la reemplaza la persona.
// `guiasQueQuedan` dice qué secciones siguen con la guía puesta: el link público no sale con una guía adentro (la vería el lead).
// Sin server-only: lo usan la ruta, la API de MaKo y los tests.
// =============================================================================

import { NODOS, parrafo, textoDeNodo, tituloDeSeccion } from '../copywriter/doc';
import type { JsonNodo } from '../copywriter/tipos';
import type { PlantillaLeadMagnet, SeccionLM } from './plantillas';

const italica = (t: string): JsonNodo => ({ ...parrafo(), content: [{ type: NODOS.texto, text: t, marks: [{ type: 'italic' }] }] });
const negrita = (t: string): JsonNodo => ({ ...parrafo(), content: [{ type: NODOS.texto, text: t, marks: [{ type: 'bold' }] }] });
const celda = (t: string, titulo: boolean): JsonNodo => ({
  type: titulo ? NODOS.celdaTitulo : NODOS.celda,
  content: [{ type: NODOS.parrafo, ...(t ? { content: [{ type: NODOS.texto, text: t }] } : {}) }],
});

/** Lo que va debajo del título y la guía de una sección. */
function forma(s: SeccionLM): JsonNodo[] {
  const f = s.forma;
  switch (f.tipo) {
    case 'tareas':
      return [{
        type: NODOS.tareas,
        content: Array.from({ length: f.items }, () => ({ type: NODOS.tarea, attrs: { checked: false }, content: [{ type: NODOS.parrafo }] })),
      }];
    case 'prompts':
      return Array.from({ length: f.items }, (_, i) => ({
        type: NODOS.desplegable,
        attrs: { abierto: true },
        content: [negrita(`Prompt ${i + 1}`), parrafo()],
      }));
    case 'tabla':
      return [{
        type: NODOS.tabla,
        content: [
          { type: NODOS.fila, content: f.columnas.map((c) => celda(c, true)) },
          ...Array.from({ length: f.filas }, () => ({ type: NODOS.fila, content: f.columnas.map(() => celda('', false)) })),
        ],
      }];
    default:
      return [parrafo()];
  }
}

/** El documento con que nace la página: la estructura de la plantilla, con su guía en cada sección. */
export function esqueletoLeadMagnet(pl: PlantillaLeadMagnet): JsonNodo {
  const content: JsonNodo[] = [];
  for (const s of pl.secciones) content.push(tituloDeSeccion(s.etiqueta), italica(s.guia), ...forma(s));
  return { type: NODOS.doc, content };
}

/** Las secciones cuya guía sigue escrita tal cual en la página: falta reemplazarlas antes de que la vea un lead. */
export function guiasQueQuedan(doc: JsonNodo, pl: PlantillaLeadMagnet): string[] {
  const textos = new Set<string>();
  const recorrer = (n: JsonNodo) => {
    if (n.type === NODOS.parrafo) textos.add(textoDeNodo(n).trim());
    for (const h of n.content ?? []) recorrer(h);
  };
  recorrer(doc);
  return pl.secciones.filter((s) => textos.has(s.guia.trim())).map((s) => s.etiqueta);
}

/** ¿La página tiene algo escrito además de los títulos y las guías? Sin nada, no hay qué compartir. */
export function tieneContenidoPropio(doc: JsonNodo, pl: PlantillaLeadMagnet | null): boolean {
  const guias = new Set((pl?.secciones ?? []).map((s) => s.guia.trim()));
  const rotulos = /^Prompt \d+$/;
  let hay = false;
  const recorrer = (n: JsonNodo) => {
    if (hay) return;
    // Los títulos de sección y los de las columnas los puso la plantilla: no son de la persona.
    if (n.type === NODOS.titulo || n.type === NODOS.celdaTitulo) return;
    if (n.type === NODOS.parrafo) {
      const t = textoDeNodo(n).trim();
      if (t && !guias.has(t) && !rotulos.test(t)) { hay = true; return; }
    }
    for (const h of n.content ?? []) recorrer(h);
  };
  recorrer(doc);
  return hay;
}
