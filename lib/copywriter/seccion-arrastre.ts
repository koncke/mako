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
// `hasta` es el ÚLTIMO bloque de la sección que tiene TEXTO: el arrastre de BlockNote sólo toma la selección entera si sus dos
// extremos caen en el contenido de un bloque (`blockPositionsFromSelection`); un extremo adentro de una tabla cae en el
// párrafo de una celda (grupo «tableContent») y BlockNote se lleva el título solo. Medido leyendo @blocknote/core 0.56.
//
// ⚠️ LO QUE QUEDA AL FINAL SIN TEXTO (una tabla, un divisor) ES LA `cola`, Y SIGUE A LA SECCIÓN AL SOLTAR (18/11/2026). Hasta
// ese día se quedaba donde estaba, con un comentario que lo llamaba «raro»: cuatro plantillas de fábrica tienen esa forma
// (lib/copywriter/plantillas.ts: los ganchos del anuncio, la historia del Reel, el contexto de las Stories y los slides del
// Carrusel, todos un título con una tabla debajo), y arrastrar esos títulos era el mismo «deja su contenido atrás» de Leila.
// La selección no puede terminar en la tabla, así que se arrastra hasta `hasta` (o el título solo) y, cuando BlockNote
// terminó de soltar, `llevarCola` pone la cola detrás de lo que se movió. Son DOS pasos de deshacer (el soltar y la cola).
//
// Puro (sin BlockNote ni React): `llevarCola` recibe el editor por su forma. Lo usa el editor (CuerpoNotion, `MenuLateral`)
// y lo prueba tests/copywriter-arrastrar-seccion.test.ts, la cola contra un BlockNote de verdad (headless, en jsdom).
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

/** La sección de un título: lo que se selecciona antes del arrastre y lo que lo sigue después. */
export type Seccion = {
  /** El título. */
  desde: string;
  /** El último bloque CON texto de la sección (el otro extremo de `editor.setSelection`), o null si debajo no hay ninguno. */
  hasta: string | null;
  /** Lo que queda al final de la sección sin texto (una tabla, un divisor): no entra en la selección y sigue al soltar. */
  cola: string[];
  /** Cuántos bloques tiene la sección entera, con el título. */
  cuantos: number;
};

/**
 * La sección que se lleva el título `id`, o null si el bloque no es un título de primer nivel o si no tiene nada debajo que
 * llevarse (ahí se arrastra solo, como siempre).
 */
export function seccionDe(bloques: readonly BloqueArrastre[], id: string): Seccion | null {
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
  if (fin === i) return null;
  let hasta = i;
  for (let k = fin; k > i; k--) if (conTexto(bloques[k])) { hasta = k; break; }
  return {
    desde: bloques[i].id,
    hasta: hasta > i ? bloques[hasta].id : null,
    cola: bloques.slice(hasta + 1, fin + 1).map((b) => b.id),
    cuantos: fin - i + 1,
  };
}

/** Lo que `llevarCola` usa del editor de BlockNote (por su forma: este módulo no importa BlockNote). */
export type EditorCola = {
  readonly document: readonly { id: string }[];
  getBlock(id: string): unknown;
  removeBlocks(ids: string[]): unknown;
  insertBlocks(bloques: never[], referencia: string, lugar: 'after'): unknown;
  transact<T>(fn: () => T): T;
};

/**
 * Después de soltar: si lo que se llevó la selección (`hasta`, o el título si no había texto debajo) se movió y su `cola` quedó
 * donde estaba, la cola va detrás de él, en su orden y en UNA transacción. Devuelve cuántos bloques movió. No toca nada (0) si la
 * cola ya va detrás (el arrastre se canceló o se soltó en el mismo lugar), si falta un bloque, o si lo movido ya no está en el
 * primer nivel (se soltó adentro de otro bloque, o en otro editor): ahí no se adivina dónde iría.
 */
export function llevarCola(editor: EditorCola, tramo: Pick<Seccion, 'desde' | 'hasta' | 'cola'>): number {
  if (!tramo.cola.length) return 0;
  const tras = tramo.hasta ?? tramo.desde;
  const doc = editor.document.map((b) => b.id);
  const i = doc.indexOf(tras);
  if (i < 0 || !tramo.cola.every((id) => doc.includes(id))) return 0;
  if (tramo.cola.every((id, k) => doc[i + 1 + k] === id)) return 0;
  const bloques = tramo.cola.map((id) => editor.getBlock(id));
  if (bloques.some((b) => !b)) return 0;
  editor.transact(() => {
    editor.removeBlocks([...tramo.cola]);
    editor.insertBlocks(bloques as never[], tras, 'after');
  });
  return bloques.length;
}
