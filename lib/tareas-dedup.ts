// =============================================================================
// tareas-dedup — "¿esta tarea YA ESTÁ en el tablero?", para TODOS los orígenes
// =============================================================================
// Las tareas entran al plan por muchas puertas: el modal de una reunión, el
// borrador que confirma el cliente, el reparto de otra persona, WhatsApp, el alta
// manual. Cada puerta creaba sin mirar lo que ya había, así que la misma reunión
// leída dos veces —o el mismo compromiso hablado en dos juntas— terminaba como dos
// tarjetas iguales, y el usuario las descubría a mano.
//
// Acá vive el juicio de "es la misma", en UN solo lugar y SIN IA: es parecido
// léxico, y una pasada de IA de "consolidá lo parecido" es justo el mecanismo que
// una vez dejó 8 tareas en vez de 95. El Perro sigue teniendo la última palabra
// sobre prioridad y contexto; esto solo evita la tarjeta repetida.
//
// SIN server-only A PROPÓSITO: el board (client component) tiene que poder correr
// el mismo chequeo con las tareas que ya tiene en memoria, sin ir al server.
//
// REGLA: ante la duda, NO es duplicado. Que se cuele una tarjeta repetida cuesta un
// clic; tirar una tarea real que nadie va a extrañar es un compromiso perdido.
// =============================================================================

/** Título normalizado (sin acentos, sin puntuación) — base del dedup. */
export const normTitulo = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// Palabras que no distinguen una tarea de otra (si dos títulos comparten solo estas,
// no son la misma tarea).
const VACIAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'o', 'en', 'para', 'por', 'con', 'un', 'una', 'al', 'a', 'que', 'su', 'sus', 'lo', 'sobre', 'como']);

export const palabrasClave = (titulo: string): Set<string> =>
  new Set(normTitulo(titulo).split(' ').filter((w) => w.length > 2 && !VACIAS.has(w)));

/**
 * ¿Son la misma tarea dicha de dos formas? Pasa siempre por el SOLAPE entre partes:
 * "Estudiar el framework Epiphany Bridge de Russell Branson" y "Estudiar el framework
 * de historia de origen (Epiphany Bridge) de Russell Branson" son una sola.
 *
 * Jaccard sobre palabras con contenido. Umbral alto a propósito: preferimos que se
 * cuele un duplicado —que el usuario destilda en un segundo— antes que perder una
 * tarea real.
 */
export function mismaTarea(a: string, b: string): boolean {
  const A = palabrasClave(a), B = palabrasClave(b);
  if (!A.size || !B.size) return false;
  let comunes = 0;
  for (const w of A) if (B.has(w)) comunes += 1;
  const jaccard = comunes / (A.size + B.size - comunes);
  if (jaccard >= 0.7) return true;
  // Uno contenido en el otro y con al menos 3 palabras propias en común: mismo pedido
  // dicho más corto ("Rediseñar la landing" vs "Rediseñar la landing page del VSL").
  const chico = A.size <= B.size ? A : B;
  return chico.size >= 3 && comunes === chico.size;
}

/**
 * ¿SE PARECE lo bastante como para AVISAR? Umbral bajo a propósito: acá el costo de
 * equivocarse es un clic (la fila nace destildada y se re-tilda), mientras que en
 * `mismaTarea` es tirar una tarea real.
 *
 * Hace falta porque el léxico solo, con el umbral de descarte, se pierde casi todo:
 * medido contra un caso real (la misma reunión grabada por dos notetakers), de 17
 * compromisos repetidos `mismaTarea` cazaba 1. "Montar la automatización del flujo
 * post-agenda" y "Configurar la automatización del envío de audios post-agendamiento"
 * son el mismo trabajo y comparten apenas el 15% de las palabras.
 *
 * NO subir a `mismaTarea`: esa se usa en cuatro lugares que descartan o fusionan sin
 * preguntarle a nadie.
 */
export function pareceLaMisma(a: string, b: string): { si: boolean; j: number } {
  const A = palabrasClave(a), B = palabrasClave(b);
  if (!A.size || !B.size) return { si: false, j: 0 };
  let comunes = 0;
  for (const w of A) if (B.has(w)) comunes += 1;
  const j = comunes / (A.size + B.size - comunes);
  return { si: j >= 0.4 || mismaTarea(a, b), j };
}

/** Lo mínimo que hace falta saber de una tarea que YA está en el tablero. */
export type TareaEnTablero = { id: string; titulo: string; hecha: boolean };

/** Una tarea entrante que resultó ser repetida, y contra cuál choca. */
export type Repetida<T> = { tarea: T; existente: TareaEnTablero };

/**
 * Separa lo que entra en NUEVO y REPETIDO contra el tablero.
 *
 * Solo compara contra las tareas ABIERTAS: si algo se hizo y vuelve a aparecer en
 * otra reunión, es un pedido nuevo ("volvé a mandar el reporte"), no un duplicado.
 * También deduplica el lote contra sí mismo, porque la misma llamada grabada dos
 * veces trae la misma tarea dos veces en la misma tanda.
 */
export function separarRepetidas<T extends { titulo: string }>(
  entrantes: T[],
  enTablero: TareaEnTablero[],
): { nuevas: T[]; repetidas: Array<Repetida<T>> } {
  const abiertas = enTablero.filter((t) => !t.hecha);
  const nuevas: T[] = [];
  const repetidas: Array<Repetida<T>> = [];
  for (const t of entrantes) {
    const ya = abiertas.find((x) => mismaTarea(x.titulo, t.titulo))
      // …y contra lo que ya entró en ESTE mismo lote.
      ?? nuevas.filter((n) => mismaTarea(n.titulo, t.titulo)).map((n) => ({ id: '', titulo: n.titulo, hecha: false }))[0];
    if (ya) repetidas.push({ tarea: t, existente: ya });
    else nuevas.push(t);
  }
  return { nuevas, repetidas };
}

/** "3 ya estaban en tu plan" / '' si no hubo ninguna (para el copy de la UI). */
export const textoRepetidas = (n: number): string =>
  (n === 0 ? '' : n === 1 ? '1 ya estaba en tu plan' : `${n} ya estaban en tu plan`);
