// =============================================================================
// tabs-que-entran — qué hojas de la ficha se ven en la fila y cuáles van a «Ver más» (puro)
// =============================================================================
// Martín (24/10/2026), textual: «Y llegará un punto donde "nueva hoja" ya no se vea bien, ahí si deberías poner la ultima
// hoja con un desplegable, algo como "Ver más" o algo así y que ahí salte el desplegable con el resto de hojas y que el botón
// de "nueva hoja" se meta allí». Es el «Más ▾» de las tabs de GitHub (UnderlineNav) y de Jira: la fila no se desplaza de
// costado; lo que no entra va a un desplegable al final, y «＋ Nueva hoja» se mete ahí también.
//
// Las reglas:
//   · Si entran todas Y «Nueva hoja», va todo en la fila (sin «Ver más»).
//   · Si no, «Ver más» al final, y las hojas que no entran (de la última para atrás) van adentro con «Nueva hoja». Al menos
//     una va adentro: «la ultima hoja con un desplegable».
//   · LA ABIERTA SE VE SIEMPRE: si su lugar quedó adentro, ocupa el último lugar de la fila (como GitHub con la elegida).
//   · Sin medir todavía (el primer render, el server), todas en la fila: es lo que había.
// Lo usa app/crm/lead-view/LeadTabs.tsx con los anchos medidos en la pantalla; lo prueba tests/ficha-ver-mas.test.ts.
// =============================================================================

export type EntradaTabs = {
  /** El ancho de cada tab, en el orden de la fila. */
  anchos: readonly number[];
  /** Lo que mide la fila (sin el «Editar» y el «⋯» de la derecha). 0 = no se midió. */
  disponible: number;
  /** El hueco entre dos tabs. */
  gap: number;
  /** El ancho de «＋ Nueva hoja». 0 = no se ofrece (no se puede crear, o es el teléfono). */
  anchoNueva: number;
  /** El ancho de «Ver más ▾». */
  anchoVerMas: number;
  /** La abierta (su índice). */
  activa: number;
};

export type SalidaTabs = {
  /** Los índices que van en la fila, en su orden. */
  visibles: number[];
  /** Los que van adentro de «Ver más», en su orden. */
  ocultas: number[];
  /** «＋ Nueva hoja» va en la fila (si no, adentro de «Ver más», si se ofrece). */
  nuevaEnLinea: boolean;
  /** Se dibuja «Ver más». */
  verMas: boolean;
};

const suma = (xs: readonly number[], gap: number): number => (xs.length ? xs.reduce((a, b) => a + b, 0) + gap * (xs.length - 1) : 0);

export function tabsQueEntran(e: EntradaTabs): SalidaTabs {
  const n = e.anchos.length;
  const todas = Array.from({ length: n }, (_, i) => i);
  const conNueva = e.anchoNueva > 0;
  const enLinea: SalidaTabs = { visibles: todas, ocultas: [], nuevaEnLinea: conNueva, verMas: false };
  if (n === 0 || e.disponible <= 0) return enLinea;
  const ocupan = suma(e.anchos, e.gap) + (conNueva ? e.gap + e.anchoNueva : 0);
  if (ocupan <= e.disponible) return enLinea;

  const activa = Math.min(Math.max(0, e.activa), n - 1);
  const presupuesto = e.disponible - e.gap - e.anchoVerMas;
  // La abierta tiene su lugar reservado; las demás entran EN ORDEN mientras haya lugar (sin saltear: una fila con huecos
  // de la mitad confunde más que una cortada al final).
  let usado = e.anchos[activa];
  const entran: number[] = [];
  for (const i of todas) {
    if (i === activa) continue;
    if (usado + e.gap + e.anchos[i] > presupuesto) break;
    entran.push(i);
    usado += e.gap + e.anchos[i];
  }
  // «La ultima hoja con un desplegable»: con «Ver más», al menos una va adentro (si hay otra además de la abierta).
  if (entran.length === n - 1 && entran.length > 0) entran.pop();
  const visibles = [...entran, activa].sort((a, b) => a - b);
  const ocultas = todas.filter((i) => !visibles.includes(i));
  return { visibles, ocultas, nuevaEnLinea: false, verMas: ocultas.length > 0 || conNueva };
}
