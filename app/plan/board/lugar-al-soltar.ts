/**
 * DÓNDE QUEDA UNA TAREA QUE SOLTASTE EN EL KANBAN, Y A QUIÉN HAY QUE CORRER PARA QUE QUEDE AHÍ.
 *
 * El pedido (06/10/2026), sobre el orden al arrastrar: «en el plan funciona diferente, ya que
 * la posición son PRIORIDADES, creo que el plan ya lo hace. Si lo hace bien, que no modifique
 * nada». No lo hacía bien. El punto medio entre la de arriba y la de abajo (`scoreEntre`) es
 * correcto; lo que lo rompe son los DATOS: las tareas admiten empates a propósito —208 abiertas
 * en 85 números, ver la rama de tareas de `fijarPrioridadAMano`— y el Kanban desempata por
 * `num`. Entre dos tarjetas con el mismo número no existe un número que deje a la soltada en el
 * medio, así que el lugar lo decidía `num` y no la persona. Medido contra el tablero real: en
 * 472 de 618 lugares (76%) quedaba corrida 1 a 3 lugares, y elegir mejor el número arreglaba
 * sólo el 21%.
 *
 * La cura la eligió Martín el 09/10/2026, entre tres: «Correr las de abajo». Las de abajo que
 * estorban bajan un punto, sin que ninguna cambie de columna. Las otras dos eran dejarlo así y
 * guardar una posición manual como el CRM —que es justo lo que el Plan no es—.
 *
 * ⚠️ UN MÓDULO, TRES LECTORES. Lo llaman el Kanban (qué número sugiere el pop-up), el server
 * del dueño (`fijarPrioridadAMano`, con el tablero recién leído) y el repo del cliente
 * (`TodoBoard`). Con dos copias de la regla, la pantalla sugiere un número que el server corre
 * distinto. Por eso no lleva `server-only` ni `'use client'`.
 */
import { prioFromScore, type Prio } from './types';

/** Lo único que la regla necesita de una tarea: su número y su `num` (el desempate). */
export type FilaLugar = { id: string; score: number; num: number };
/**
 * DÓNDE se soltó, dicho con las VECINAS y no con un índice. Un índice es de la lista que dibujó
 * la pantalla —con su buscador y sus filtros— y el server lee otra; las vecinas son las mismas
 * en las dos. `null` es «no había ninguna de ese lado».
 */
export type Lugar = { arriba: string | null; abajo: string | null };
/** Una vecina que se corrió para hacerle lugar a la soltada. */
export type Corrimiento = { id: string; antes: number; despues: number };
/**
 * Lo que puede acompañar a un número fijado a mano (`Repo.prioridadManual`).
 * - `lugar`: dónde se soltó en el Kanban. Quien escribe corre a las de abajo con `hacerLugar`.
 * - `deshacer`: los corrimientos de un arrastre que se está deshaciendo. Cada vecina vuelve a
 *   `antes` SÓLO si todavía tiene `despues`: si alguien la movió en el medio, ese número es
 *   más nuevo que el deshacer y no se pisa.
 */
export type OpcionesPrioridadManual = { lugar?: Lugar; deshacer?: Corrimiento[] };

/**
 * El orden del Kanban con «Prioridad» de mayor a menor: el número, y a igual número la más
 * nueva (num más alto) primero. Es el mismo `b.num - a.num` del `sort` de `Kanban`.
 */
export const vaAntes = (a: FilaLugar, b: FilaLugar): boolean => a.score > b.score || (a.score === b.score && a.num > b.num);

/**
 * Los números de una columna, sacados de `prioFromScore` y no escritos a mano: si mañana el
 * corte de «Alta» se mueve, esto se mueve con él.
 */
export function bandaDe(p: Prio): { min: number; max: number } {
  let min = 101;
  let max = 0;
  for (let n = 1; n <= 100; n++) if (prioFromScore(n) === p) { min = Math.min(min, n); max = Math.max(max, n); }
  return { min, max };
}

/**
 * Las vecinas de un lugar de la lista que se ve, salteando las que no compiten (terminadas,
 * las que se repiten): esas se dibujan en la columna pero el número no las ordena.
 */
export function lugarEn<T extends { id: string }>(lista: T[], idx: number, compite: (t: T) => boolean): Lugar {
  const arriba = lista.slice(0, idx).filter(compite).at(-1)?.id ?? null;
  const abajo = lista.slice(idx).find(compite)?.id ?? null;
  return { arriba, abajo };
}

/**
 * Qué vecinas hay que correr para que `yo`, con el número `yo.score`, quede justo entre las dos
 * de `lugar`. Devuelve `[]` si no hace falta correr a nadie.
 *
 * Devuelve `null` —y entonces se escribe el número solo, como siempre— en tres casos, los tres
 * a propósito:
 * - **El número contradice el lugar.** Si en el pop-up se eligió un número más alto que el de
 *   la de arriba (o más bajo que el de la de abajo), la persona cambió de idea: soltar dice
 *   DÓNDE y el pop-up dice CUÁNTO, y gana el CUÁNTO. Correr a las vecinas para sostener un lugar
 *   que ya no se pidió sería mover números que nadie tocó.
 * - **Una vecina ya no está** (se cerró, se borró o cambió de columna entre el arrastre y el
 *   «Aplicar»): el lugar que se vio ya no existe.
 * - **Correr a alguien la sacaría de su columna.** Bajar una de 50 a 49 la pasa de Media a
 *   Baja, que es un cambio de prioridad que nadie pidió.
 *
 * Primero se corren las de ABAJO, que es lo que se eligió. Las de arriba se corren sólo si el
 * número que quedó en el pop-up es el mismo que el de la de arriba y el desempate la pone
 * detrás: ahí no hay otra forma de cumplir el lugar sin tocar el número que eligió la persona.
 */
export function hacerLugar(col: FilaLugar[], yo: FilaLugar, lugar: Lugar): Corrimiento[] | null {
  const p = prioFromScore(yo.score);
  const { min, max } = bandaDe(p);
  const orden = col
    .filter((c) => c.id !== yo.id && prioFromScore(c.score) === p)
    .sort((a, b) => (vaAntes(a, b) ? -1 : vaAntes(b, a) ? 1 : 0));

  let idx: number;
  if (lugar.abajo != null) {
    idx = orden.findIndex((c) => c.id === lugar.abajo);
    if (idx < 0) return null;
    if (lugar.arriba != null) {
      const iArriba = orden.findIndex((c) => c.id === lugar.arriba);
      if (iArriba < 0 || iArriba >= idx) return null;
    }
  } else if (lugar.arriba != null) {
    const iArriba = orden.findIndex((c) => c.id === lugar.arriba);
    if (iArriba < 0) return null;
    idx = iArriba + 1;
  } else {
    // Ni arriba ni abajo: la columna no tenía ninguna que compitiera. Sólo es cierto si
    // sigue sin tener; si ahora tiene, el lugar que se vio no existe más.
    return orden.length === 0 ? [] : null;
  }

  const arriba = orden[idx - 1];
  const abajo = orden[idx];
  if (arriba && yo.score > arriba.score) return null;
  // Un punto por debajo de la de abajo todavía es ESTE lugar: es correr a la de abajo, que es
  // justo lo que se eligió. Más abajo que eso, el número ya contradice el lugar.
  if (abajo && yo.score < abajo.score - 1) return null;

  const out: Corrimiento[] = [];
  // Hacia ABAJO: cada una tiene que quedar detrás de la anterior. A igual número alcanza con
  // que el desempate la ponga detrás; si no, un punto menos. La primera que ya queda detrás
  // corta: de ahí para abajo la lista ya estaba en orden.
  let previa: FilaLugar = yo;
  for (let j = idx; j < orden.length; j++) {
    const c = orden[j];
    if (vaAntes(previa, c)) break;
    const despues = c.num < previa.num ? previa.score : previa.score - 1;
    if (despues < min) return null;
    out.push({ id: c.id, antes: c.score, despues });
    previa = { ...c, score: despues };
  }
  // Hacia ARRIBA, el espejo, y sólo cuando el número elegido empata con la de arriba.
  let siguiente: FilaLugar = yo;
  for (let j = idx - 1; j >= 0; j--) {
    const c = orden[j];
    if (vaAntes(c, siguiente)) break;
    const despues = c.num > siguiente.num ? siguiente.score : siguiente.score + 1;
    if (despues > max) return null;
    out.push({ id: c.id, antes: c.score, despues });
    siguiente = { ...c, score: despues };
  }
  return out;
}

/**
 * El número que sugiere el pop-up al soltar: el que deja la tarjeta en el lugar moviendo a la
 * menor cantidad de vecinas, sin correr a ninguna de ARRIBA si se puede evitar, y entre esos el
 * más cerca del punto medio de siempre (`base`). Si ningún número cumple el lugar —la columna
 * está llena hasta su borde—, se sugiere `base` y el lugar se pierde como antes.
 */
export function sugerirNumero(col: FilaLugar[], yo: { id: string; num: number }, lugar: Lugar, destino: Prio, base: number): number {
  const { min, max } = bandaDe(destino);
  const deId = (id: string | null) => (id == null ? undefined : col.find((c) => c.id === id));
  const hi = Math.min(max, deId(lugar.arriba)?.score ?? max);
  const debajo = deId(lugar.abajo);
  const lo = Math.max(min, debajo ? debajo.score - 1 : min);
  let mejor: { n: number; clave: [number, number, number] } | null = null;
  for (let n = hi; n >= lo; n--) {
    const plan = hacerLugar(col, { id: yo.id, num: yo.num, score: n }, lugar);
    if (!plan) continue;
    const clave: [number, number, number] = [plan.some((c) => c.despues > c.antes) ? 1 : 0, plan.length, Math.abs(n - base)];
    if (!mejor || clave[0] < mejor.clave[0] || (clave[0] === mejor.clave[0] && (clave[1] < mejor.clave[1] || (clave[1] === mejor.clave[1] && clave[2] < mejor.clave[2])))) {
      mejor = { n, clave };
    }
  }
  return mejor ? mejor.n : base;
}

/**
 * Lo que una vecina corrida le hace a su `scoreBase`: lo mismo que a su número, para que el
 * juicio del Perro sobre ella se mueva junto con lo que se ve.
 *
 * ⚠️ ESTO NO ES LO QUE SOSTIENE EL LUGAR DE LA SOLTADA, aunque hasta el 14/10/2026 este
 * comentario decía que sí. El reparto del Perro (`recurvarPlanOwner`) no lee el número de la
 * base: reparte por RANKING sobre una pirámide fija, así que la vecina corrida volvía al
 * número de su puesto y quedaba otra vez encima. Medido sobre el tablero real: 240 de 513
 * lugares se deshacían en la primera corrida. Lo que lo sostiene es `respetarFijadas`.
 */
export const baseCorrida = (base: number | undefined | null, c: Corrimiento): number =>
  Math.max(1, Math.min(100, (base ?? c.antes) + (c.despues - c.antes)));

/** Una tarea en el reparto diario del Perro: el número que se ve HOY y si está fijada a mano. */
export type FilaReparto = { id: string; num: number; mostrado: number; manual: boolean };

/**
 * Cuántos puntos tiene que poner el Perro a una tarjeta del OTRO lado de una fijada para que la
 * cruce. Menos que eso es ruido del reparto, no un juicio: ver `respetarFijadas`.
 */
export const MARGEN_CRUCE = 3;

/**
 * EL REPARTO DEL PERRO SIN PASARLE POR ENCIMA A LO FIJADO A MANO.
 *
 * `recurvarPlanOwner` reparte cada día los números de las tareas por RANKING sobre una pirámide
 * fija (`curveTaskScores`), y a las fijadas (`score_manual`) no les escribe nada. Lo que no
 * hacía es mirar DÓNDE quedaban las otras respecto de ellas, y un arrastre se deshacía solo:
 * la vecina que se corrió de 92 a 91 para hacerle lugar a la soltada volvía a 92, el número de
 * su puesto, y quedaba otra vez encima. Medido sobre el tablero real el 14/10/2026: de 513
 * lugares donde se puede soltar una tarjeta, 240 se deshacían en la primera corrida, que además
 * se dispara con cada alta de tareas. Correr también la base (`baseCorrida`) no lo evitaba.
 *
 * La regla: una tarjeta no fijada se queda del lado de la fijada en que HOY se ve, salvo que el
 * Perro la ponga claramente del otro lado —`MARGEN_CRUCE` puntos o más—. Si se queda, se le
 * recorta el número lo justo: las de arriba no bajan de la fijada y las de abajo no la pasan,
 * con el mismo desempate por `num` del Kanban.
 *
 * ⚠️ POR QUÉ UN MARGEN Y NO EL ORDEN DEL PERRO. Se probaron cuatro formas de ubicar a la
 * fijada en el orden de mañana y en todas quedaban lugares deshechos (65, 103, 80 y 28 de 513):
 * el ranking del Perro distingue tarjetas que en pantalla se ven con el mismo número —y el
 * Kanban las desempata por `num`, o sea muchas veces al revés—, y la fijada, que entra al
 * ranking con su número contra la BASE de las demás (otra escala: 5 de 174 tareas tienen base =
 * número visible), ocupa un puesto casi al azar y corre uno a todas las del medio. Las dos
 * cosas mueven a una vecina 1 o 2 puntos sin que nadie haya cambiado de opinión. Un juicio
 * nuevo del Perro —un deadline que se acerca, una dependencia— mueve más que eso, y cruza.
 *
 * El margen se midió, no se eligió: con 1 se deshacían 169 de 513, con 2 cuatro, con 3 ninguno.
 * Y el recorte es chico: por corrida toca p50 1 tarjeta, p90 2 y como máximo 4, y ninguna
 * cambia de columna por eso.
 *
 * Sin fijadas devuelve el reparto tal cual: el tablero que nadie tocó a mano no cambia.
 *
 * @param filas las que compiten (sin las que se repiten), fijadas incluidas
 * @param curva el reparto de siempre, id → número
 * @returns id → número de las NO fijadas; las fijadas no se escriben
 */
export function respetarFijadas(filas: FilaReparto[], curva: Record<string, number>, margen = MARGEN_CRUCE): Record<string, number> {
  const out: Record<string, number> = {};
  const libres = filas.filter((f) => !f.manual && curva[f.id] != null);
  for (const u of libres) out[u.id] = curva[u.id];
  const hoy = (f: FilaReparto): FilaLugar => ({ id: f.id, score: f.mostrado, num: f.num });
  // En el orden en que se ven: si dos fijadas piden cosas incompatibles a la misma tarjeta, que
  // gane la de más abajo es lo mismo para todas las corridas.
  const fijadas = filas.filter((f) => f.manual).sort((a, b) => (vaAntes(hoy(a), hoy(b)) ? -1 : vaAntes(hoy(b), hoy(a)) ? 1 : 0));
  for (const u of libres) {
    const juicio = out[u.id];
    let v = juicio;
    for (const m of fijadas) {
      const n = m.mostrado;
      if (vaAntes(hoy(u), hoy(m))) {
        if (juicio > n - margen) v = Math.max(v, u.num > m.num ? n : n + 1);
      } else if (juicio < n + margen) {
        v = Math.min(v, u.num < m.num ? n : n - 1);
      }
    }
    out[u.id] = Math.max(1, Math.min(100, v));
  }
  return out;
}
