// =============================================================================
// Las operaciones del editor — mover un borde, quitar un tramo, partirlo
// =============================================================================
// SIN `server-only` y sin React a propósito: son las que deciden qué se renderiza
// después, así que son lo que hay que poder testear. Un editor cuyo recorte vive
// adentro de un `onMouseMove` sólo se puede probar arrastrando el mouse.
//
// ── La regla de este módulo: ACOTA, no rechaza ─────────────────────────────
// Ninguna de estas funciones puede devolver un plan inválido. Arrastrar un borde
// más allá del otro no da error: se frena. Es la diferencia entre un editor y un
// formulario — en un programa de edición el borde se para contra el tope y se
// ve, no se pierde el arrastre entero con un cartel rojo.
//
// `porQueNoSirveElPlan` (en `plan-montaje.ts`) sigue siendo la red del server:
// esto acota lo que produce ESTA pantalla, aquello valida lo que llega de
// cualquier lado.

import type { Plan, Tramo } from './plan-montaje';

/** Lo mínimo que puede quedar de un tramo. Menos que esto es un parpadeo. */
export const MINIMO_SEG = 0.35;

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Rearma el plan con estos tramos, recalculando el total. */
function con(segs: Tramo[]): Plan {
  return { total: r3(segs.reduce((t, s) => t + (s.fin - s.ini), 0)), segs };
}

/**
 * El vecino del mismo clip contra el que este tramo no se puede pasar.
 *
 * ⚠️ EL TOPE NO ES SIEMPRE EL CLIP. Si una toma quedó partida en dos tramos —el
 * uso normal para sacarle un bache del medio—, estirar el primero hasta el final
 * del clip lo mete adentro del segundo, y eso produce un anuncio que REPITE lo
 * que dice ahí. Sale bien formado y dice otra cosa.
 */
/**
 * ⚠️ `duracionClip` ES LA DE **ESA** TOMA. Quien llama tiene el array y saca la
 * que corresponde: dos tomas del mismo anuncio pueden durar distinto, y acotar
 * un borde de una toma de 10 s contra los 8 s de otra recorta material pagado sin
 * decir nada.
 */
function topes(segs: Tramo[], i: number, duracionClip: number): { min: number; max: number } {
  const s = segs[i];
  let min = 0;
  let max = duracionClip;
  for (const [j, o] of segs.entries()) {
    if (j === i || o.toma !== s.toma) continue;
    if (o.fin <= s.ini) min = Math.max(min, o.fin);
    if (o.ini >= s.fin) max = Math.min(max, o.ini);
  }
  return { min, max };
}

/**
 * Mueve un borde de un tramo. `a` es el segundo del CLIP, no de la línea de
 * tiempo. Devuelve el plan acotado.
 */
export function moverBorde(plan: Plan, i: number, borde: 'ini' | 'fin', a: number, duracionClip: number): Plan {
  const segs = plan.segs.map((s) => ({ ...s }));
  const s = segs[i];
  if (!s) return plan;
  const { min, max } = topes(segs, i, duracionClip);

  if (borde === 'ini') s.ini = r3(Math.min(Math.max(a, min), s.fin - MINIMO_SEG));
  else s.fin = r3(Math.max(Math.min(a, max), s.ini + MINIMO_SEG));

  return con(segs);
}

/**
 * Saca un tramo.
 *
 * ⚠️ NO DEJA LA LÍNEA VACÍA. Un plan sin tramos no es un anuncio corto: es un
 * render que falla, o peor, un mp4 de cero segundos que se sube igual.
 */
export function quitarTramo(plan: Plan, i: number): Plan {
  if (plan.segs.length <= 1) return plan;
  return con(plan.segs.filter((_, j) => j !== i).map((s) => ({ ...s })));
}

/**
 * Parte un tramo en dos por un punto del CLIP, para poder sacarle un bache del
 * medio sin perder las dos puntas.
 *
 * Los dos pedazos quedan CONTIGUOS: partir no cambia lo que se ve ni cuánto
 * dura. Lo que cambia es que ahora hay dos bordes más para mover.
 */
export function partirTramo(plan: Plan, i: number, a: number): Plan {
  const s = plan.segs[i];
  if (!s) return plan;
  // Partir a menos de un mínimo de cualquiera de las dos puntas daría un
  // parpadeo que el server rechaza. Se ignora en vez de producirlo.
  if (a <= s.ini + MINIMO_SEG || a >= s.fin - MINIMO_SEG) return plan;
  const p = r3(a);
  const segs = plan.segs.map((x) => ({ ...x }));
  segs.splice(i, 1, { toma: s.toma, ini: s.ini, fin: p }, { toma: s.toma, ini: p, fin: s.fin });
  return con(segs);
}

// ── La línea de tiempo ──────────────────────────────────────────────────────
// El plan son tramos de clips distintos; la línea de tiempo es un solo reloj
// corrido. Traducir entre los dos es lo que hace que el cabezal, la previsión y
// los arrastres hablen del mismo lugar.

/** Dónde arranca cada tramo en la línea de tiempo. */
export function inicios(plan: Plan): number[] {
  const out: number[] = [];
  let t = 0;
  for (const s of plan.segs) { out.push(r3(t)); t += s.fin - s.ini; }
  return out;
}

/**
 * Un segundo de la línea de tiempo → qué clip está sonando y en qué segundo.
 *
 * Es lo que permite previsualizar SIN renderizar: la pantalla reproduce las
 * tomas originales saltando de una a otra en los cortes. Un editor que para
 * poder mostrar un cambio necesita esperar el render no es un editor.
 */
export function enSegundo(plan: Plan, t: number): { i: number; toma: number; dentro: number } | null {
  let acum = 0;
  for (const [i, s] of plan.segs.entries()) {
    const dur = s.fin - s.ini;
    if (t < acum + dur || i === plan.segs.length - 1) {
      return { i, toma: s.toma, dentro: r3(s.ini + Math.max(0, Math.min(t - acum, dur))) };
    }
    acum += dur;
  }
  return null;
}

/** Cuánto se le sacó al material original. Es el número que da confianza. */
export function recorte(plan: Plan, cuantasTomas: number, duracionClip: number): { antes: number; despues: number } {
  return { antes: r3(cuantasTomas * duracionClip), despues: plan.total };
}

/**
 * ¿Son el mismo corte? Con tolerancia de milisegundo.
 *
 * La usa la pila de deshacer para no guardar entradas que no cambian nada: un
 * arrastre que arranca y vuelve al mismo lugar, o un `partir` que se abstuvo. Sin
 * esto, Ctrl+Z tendría que apretarse cuatro veces para deshacer una cosa — y las
 * tres primeras no harían nada visible, que es peor que no tener deshacer.
 */
export function mismoPlan(a: Plan, b: Plan): boolean {
  if (a.segs.length !== b.segs.length) return false;
  return a.segs.every((s, i) => {
    const o = b.segs[i];
    return !!o && o.toma === s.toma
      && Math.abs(o.ini - s.ini) < 0.001 && Math.abs(o.fin - s.fin) < 0.001;
  });
}
