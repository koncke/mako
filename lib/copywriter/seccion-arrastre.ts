// =============================================================================
// seccion-arrastre — qué se lleva un TÍTULO cuando se lo arrastra en el Copywriter (6/11/2026)
// =============================================================================
// Llamada con Leila del 5/11 (y pendientes-30-10.md 1.8): «arrastrar un bloque deja su contenido atrás; tiene que arrastrar
// con sus hijos». En el editor (BlockNote, app/copywriter/editor/CuerpoNotion.tsx) un Título y lo que tiene debajo son
// bloques HERMANOS (los títulos desplegables están apagados: esquema.tsx), así que el asa ⋮⋮ movía sólo el título.
//
// Lo que se lleva un título es su SECCIÓN, como en Notion con un título desplegable: él y todo lo que sigue hasta el próximo
// título del MISMO nivel o más alto (un Título 2 se lleva sus Títulos 3). Un bloque que no es un título se sigue llevando a sí
// mismo y a sus hijos anidados, como siempre (eso ya lo hace BlockNote).
//
// Cómo se usa: al empezar el arrastre, el editor SELECCIONA desde el título hasta `hasta`, y el arrastre de BlockNote
// (`dragStart`, @blocknote/core extensions/SideMenu/dragging.ts) mueve la selección entera cuando abarca varios bloques.
// Su selección (`editor.setSelection`) exige que los dos extremos tengan texto: `hasta` es el ÚLTIMO bloque de la sección
// que lo tiene. Un divisor o una tabla al final de la sección (sin texto propio) quedan donde estaban: es raro, y se dice acá.
//
// Puro (sin BlockNote ni React): lo usa el editor y lo prueba tests/copywriter-arrastrar-seccion.test.ts.
// =============================================================================

/** Lo que hace falta de un bloque de primer nivel del documento de BlockNote (`editor.document`). */
export type BloqueArrastre = { id: string; type: string; props?: { level?: unknown }; content?: unknown };

const TITULO = 'heading';

/** El nivel de un título (1, 2 o 3), o null si el bloque no es un título. */
export function nivelDeTitulo(b: BloqueArrastre): number | null {
  if (b.type !== TITULO) return null;
  const n = Number(b.props?.level);
  return n >= 1 && n <= 3 ? n : 2;
}

/** ¿El bloque tiene texto propio? (un párrafo, un título, una viñeta…; no un divisor ni una tabla). */
const conTexto = (b: BloqueArrastre): boolean => Array.isArray(b.content);

/**
 * La sección que se lleva el título `id`: `{ desde, hasta }` (los ids de los dos extremos, para `editor.setSelection`), o null
 * si el bloque no es un título de primer nivel o si no tiene nada debajo que llevarse (ahí se arrastra solo, como siempre).
 */
export function seccionDe(bloques: readonly BloqueArrastre[], id: string): { desde: string; hasta: string; cuantos: number } | null {
  const i = bloques.findIndex((b) => b.id === id);
  if (i < 0) return null;
  const nivel = nivelDeTitulo(bloques[i]);
  if (nivel == null) return null;
  let fin = i;
  for (let k = i + 1; k < bloques.length; k++) {
    const n = nivelDeTitulo(bloques[k]);
    if (n != null && n <= nivel) break;
    fin = k;
  }
  let hasta = -1;
  for (let k = fin; k > i; k--) if (conTexto(bloques[k])) { hasta = k; break; }
  if (hasta < 0) return null;
  return { desde: bloques[i].id, hasta: bloques[hasta].id, cuantos: hasta - i + 1 };
}
