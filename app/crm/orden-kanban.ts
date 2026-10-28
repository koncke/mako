// =============================================================================
// orden-kanban — cómo se ordenan las tarjetas de cada columna del CRM (puro)
// =============================================================================
// Pedido de Martín (06/10/2026), por el chat de Customer Success: el hueco del arrastre
// seguía al cursor también en la MISMA columna, y soltar ahí no movía nada.
//   «cuando se hace esto, es como poner un "ORDENAMIENTO" dentro de filtros... normalmente
//   se ordena por orden de llegada. Para quitar eso y volver a antes, simplemente es volver
//   a ordenar por fecha y listo. Y luego si quiero volver a la posición que había dejado las
//   tarjetas es simplemente quitar filtros.»
//
// O sea: arrastrar guarda la posición (mig 0200) y deja «Ordenar» en «Manual»; «Fecha de
// llegada» vuelve al orden de siempre SIN borrar lo manual; y con un orden manual guardado,
// «Manual» es la BASE — «Limpiar filtros» vuelve a él.
//
// Dónde cae una tarjeta y cómo queda la columna después (`antesDeQuien`,
// `columnaConInsercion`, `mismaLista`) son la MISMA pieza que Customer Success
// (app/customer-success/orden-manual.ts): se importan de ahí, no se copian.
//
// ⚠️ DESDE EL 24/10/2026 «ORDENAR» ES DE CADA COLUMNA y vive en su «⋯», no en «Filtrar». Martín, textual: «Y ahí pon la
// opción de "ordenar", y la sacas de filtros, que no este ordenamientos en el botón de filtros, sino que se pueda ordenar
// dentro de esos 3 puntos, y en este caso si pusiste un chip de "Respondió" se debe poder ordenar por eso... Aunque revisa
// porque estoy seguro que existen muchos otros posibles ordenamientos». La referencia es el «Ordenar por…» del menú de
// una lista de Trello: cada lista se ordena sola. Lo de arriba sigue valiendo POR COLUMNA: arrastrar en una la deja en
// «Manual», y «Manual» es su base si tiene algo arrastrado.
//
// Sin 'use client' ni 'server-only': lo usan el tablero y el menú, y un test lo EJECUTA
// (tests/crm-orden-manual.test.ts y tests/crm-orden-columna.test.ts).

export type OrdenKanban = 'manual' | 'llegada' | 'antiguos' | 'nombre' | 'respondio' | 'monto' | 'reunion' | 'vence';

/** Los rótulos de «Ordenar», en el orden en que se ofrecen. El orden de llegada es el de siempre: el más nuevo arriba. */
export const ORDEN_KANBAN: Record<OrdenKanban, string> = {
  manual: 'Manual', llegada: 'Más nuevos primero', antiguos: 'Más viejos primero', nombre: 'Nombre (A-Z)',
  respondio: 'Respondió primero', monto: 'Mayor monto', reunion: 'Fecha de reunión', vence: 'Vence primero',
};
export const ORDENES_KANBAN = Object.keys(ORDEN_KANBAN) as OrdenKanban[];
export const esOrdenKanban = (v: unknown): v is OrdenKanban => typeof v === 'string' && Object.prototype.hasOwnProperty.call(ORDEN_KANBAN, v);

/**
 * Lo que la columna tiene para ordenar. Un criterio sin con qué no se ofrece («lo que no se puede, no sale», Martín,
 * 29/09/2026): «Mayor monto» en una columna sin plata cargada daría el mismo orden que la llegada, haciéndose pasar por
 * otro.
 */
export type HayParaOrdenar = { manual: boolean; respondio: boolean; monto: boolean; reunion: boolean; vence: boolean };

/** Los criterios que se ofrecen en una columna, en orden. El elegido HOY va siempre, aunque ya no tenga con qué. */
export function ordenesDeColumna(hay: HayParaOrdenar, actual: OrdenKanban): OrdenKanban[] {
  const sale: Record<OrdenKanban, boolean> = {
    manual: hay.manual, llegada: true, antiguos: true, nombre: true,
    respondio: hay.respondio, monto: hay.monto, reunion: hay.reunion, vence: hay.vence,
  };
  return ORDENES_KANBAN.filter((o) => sale[o] || o === actual);
}

/**
 * Lo de cada tarjeta que mira un criterio. `respondio`: 0 = contestó a una automatización (el chip «Respondió»), 1 = está
 * en una y no contestó, 2 = no está en ninguna. Las fechas en ISO; `null` = no hay.
 */
export type DatoParaOrdenar = {
  nombre: string;
  creado: string | null;
  respondio: 0 | 1 | 2;
  monto: number | null;
  reunion: string | null;
  vence: string | null;
};

const ms = (iso: string | null): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
};
/** Lo que no tiene el dato va AL FINAL, suba o baje el criterio: un hueco no es «el más chico». */
const conHuecoAlFinal = (a: number | null, b: number | null, asc: boolean): number =>
  a == null ? (b == null ? 0 : 1) : b == null ? -1 : asc ? a - b : b - a;
const nombres = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
const positivo = (n: number | null): number | null => (n != null && n > 0 ? n : null);

/**
 * Una columna con un criterio que no es «Manual» (ése es `ordenarKanbanManual`). La entrada viene en orden de llegada (el
 * más nuevo arriba) y el desempate es ése: dos con el mismo monto quedan como llegaron.
 */
export function ordenarColumna<T>(cs: readonly T[], criterio: Exclude<OrdenKanban, 'manual'>, dato: (c: T) => DatoParaOrdenar): T[] {
  if (criterio === 'llegada') return [...cs];
  const xs = cs.map((c, i) => ({ c, i, d: dato(c) }));
  const cmp = (a: (typeof xs)[number], b: (typeof xs)[number]): number => {
    switch (criterio) {
      // Al revés de la llegada: el más viejo arriba. Sin fecha, al final; entre dos iguales, el de más abajo primero.
      case 'antiguos': return conHuecoAlFinal(ms(a.d.creado), ms(b.d.creado), true) || b.i - a.i;
      case 'nombre': {
        // `?? ''` (ticket #14, 27/10/2026): un lead que entró sin nombre (los traídos de un grupo, sólo con teléfono) rompía
        // la columna ordenada por nombre al abrir el CRM.
        const na = (a.d.nombre ?? '').trim();
        const nb = (b.d.nombre ?? '').trim();
        return (na ? (nb ? nombres.compare(na, nb) : -1) : nb ? 1 : 0) || a.i - b.i;
      }
      case 'respondio': return a.d.respondio - b.d.respondio || a.i - b.i;
      case 'monto': return conHuecoAlFinal(positivo(a.d.monto), positivo(b.d.monto), false) || a.i - b.i;
      // La más cercana en el calendario arriba: las que ya pasaron sin desenlace quedan primero, que son las que hay que mirar.
      case 'reunion': return conHuecoAlFinal(ms(a.d.reunion), ms(b.d.reunion), true) || a.i - b.i;
      case 'vence': return conHuecoAlFinal(ms(a.d.vence), ms(b.d.vence), true) || a.i - b.i;
    }
  };
  return xs.sort(cmp).map((x) => x.c);
}

/** Lo elegido en cada columna de un embudo, con una cambiada. `null` = vuelve a su base (no se guarda nada para ella). */
export function conOrdenDe(porEtapa: Readonly<Record<string, OrdenKanban>>, etapa: string, valor: OrdenKanban | null): Record<string, OrdenKanban> {
  const out: Record<string, OrdenKanban> = { ...porEtapa };
  if (valor == null) delete out[etapa];
  else out[etapa] = valor;
  return out;
}

/**
 * Ordena cada columna por SU lista manual. La entrada viene en orden de llegada y el sort es
 * estable.
 *
 * ⚠️ LOS QUE LA LISTA NO NOMBRA VAN ARRIBA, no al final como en Customer Success. La lista se
 * guarda con la columna ENTERA al arrastrar, así que los únicos que no figuran son los que
 * llegaron DESPUÉS del último arrastre — y al CRM llegan leads nuevos todos los días. Al
 * final, un lead recién entrado a una columna que alguien ordenó una vez quedaría debajo de
 * todo, donde nadie lo ve; arriba es donde el orden de llegada ya los pone.
 *
 * ⚠️ Y LA LISTA PUEDE NOMBRAR A QUIEN YA NO ESTÁ EN ESA COLUMNA (se movió, se borró): se
 * ignora. Por eso la clave es la posición en la lista de SU etapa actual.
 */
export function ordenarKanbanManual<T>(
  cs: readonly T[],
  idDe: (c: T) => number,
  etapaDe: (c: T) => string,
  listaDe: (etapa: string) => readonly number[] | undefined,
): T[] {
  const pos = new Map<string, Map<number, number>>();
  const posEn = (etapa: string) => {
    let m = pos.get(etapa);
    if (!m) { m = new Map((listaDe(etapa) ?? []).map((id, i) => [id, i])); pos.set(etapa, m); }
    return m;
  };
  return cs
    .map((c, i) => ({ c, i, k: posEn(etapaDe(c)).get(idDe(c)) ?? -1 }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.c);
}
