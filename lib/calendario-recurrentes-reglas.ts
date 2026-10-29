// =============================================================================
// calendario-recurrentes-reglas — una Publicación que se repite: qué veces se crean y cuáles se dibujan (29/10/2026)
// =============================================================================
// Martín, en la llamada con Thiago (29/10, [19:25]): «podés programarte publicaciones recurrentes». Una Publicación «molde» (con su
// red, su cuenta, su archivo y su texto) lleva una regla (`repetir`, la MISMA RRULE del Plan: lib/plan-recurrentes.ts, con su frase
// en español y sus presets) y el cron le crea cada vez una Publicación igual, a la misma hora, y la programa en la red por Zernio
// (lib/calendario-recurrentes.ts). Acá viven las decisiones, puras:
//
//   1. EL MOLDE ES LA PRIMERA VEZ: las veces que nacen son las que vienen DESPUÉS de su día (`ancla`).
//   2. NADA HACIA ATRÁS: con el cron caído, las veces que pasaron no se crean (una publicación de ayer no se programa).
//   3. SÓLO LO QUE ESTÁ CERCA: se crean las de los próximos `HORIZONTE_DIAS` días (Zernio las tiene con tiempo); las de más
//      adelante el Calendario las DIBUJA, sin crear filas (la capa «Se repite», como las tareas del Plan).
//   4. UNA VEZ ES UNA VEZ: la que ya nació (`serie_de` + su día) no se crea de nuevo (y la base lo impide igual: índice único).
//
// Puro (sin `server-only`): lo prueba tests/calendario-recurrentes.test.ts.
// =============================================================================

import { recurrenciaOk, textoRepeticion, textoRepeticionCorto } from './plan-recurrentes';
import { ocurrenciasEntre } from './plan-recurrentes-fechas';
import { sumarDias } from './calendario-modelo';

/** Hasta cuántos días adelante se CREAN (y se programan) las veces de una Publicación que se repite. */
export const HORIZONTE_DIAS = 2;
/** Un tope de cordura por molde y por pasada del cron. */
export const MAX_POR_PASADA = 5;
/** Un tope de cordura de lo que se dibuja por molde en una vista (un «todos los días» en el Año no dibuja 365). */
export const MAX_DIBUJADAS = 62;

/** La regla que se guarda (normalizada), o null si no es una regla válida. Vacío = «no se repite». */
export const reglaDePublicacion = (v: unknown): string | null => recurrenciaOk(v);

/** Cómo se dice la regla en pantalla («Todos los lunes»), o null. */
export const textoDeRegla = (v: unknown): string | null => textoRepeticion(v);
export const textoCortoDeRegla = (v: unknown): string | null => textoRepeticionCorto(v);

/** Los días de la serie DESPUÉS del molde y desde `desde` (incluido) hasta `hasta` (incluido), sin las que ya nacieron. */
export function vecesDeLaSerie(p: {
  regla: unknown; ancla: string; desde: string; hasta: string; nacidas: ReadonlySet<string>; max: number;
}): string[] {
  if (p.hasta < p.desde) return [];
  // `ocurrenciasEntre` devuelve las fechas DESPUÉS de su `desde`: se arranca un día antes para que `desde` cuente, y nunca antes
  // del molde (el molde es la primera vez: no se crea otra para su mismo día).
  const arranque = p.ancla > sumarDias(p.desde, -1) ? p.ancla : sumarDias(p.desde, -1);
  return ocurrenciasEntre(p.regla, arranque, p.hasta, p.ancla, p.max + p.nacidas.size + 1)
    .filter((f) => !p.nacidas.has(f))
    .slice(0, p.max);
}

/** Las veces que el cron CREA hoy: de hoy a `HORIZONTE_DIAS` adelante (nada hacia atrás), las que no nacieron, hasta `MAX_POR_PASADA`. */
export const vecesACrear = (p: { regla: unknown; ancla: string; hoy: string; nacidas: ReadonlySet<string> }): string[] =>
  vecesDeLaSerie({ regla: p.regla, ancla: p.ancla, desde: p.hoy, hasta: sumarDias(p.hoy, HORIZONTE_DIAS), nacidas: p.nacidas, max: MAX_POR_PASADA });

/**
 * Las veces que el Calendario DIBUJA en una vista (`desde`/`hasta`, días de la zona del negocio): las que todavía no nacieron, y
 * desde HOY. Las que ya nacieron se ven como lo que son: una Publicación de verdad. ⚠️ Una vez del pasado que no nació no va a salir
 * nunca (nada hacia atrás): dibujarla como «próxima» era decir que salió.
 */
export const vecesADibujar = (p: { regla: unknown; ancla: string; desde: string; hasta: string; hoy: string; nacidas: ReadonlySet<string> }): string[] =>
  vecesDeLaSerie({ regla: p.regla, ancla: p.ancla, desde: p.desde > p.hoy ? p.desde : p.hoy, hasta: p.hasta, nacidas: p.nacidas, max: MAX_DIBUJADAS });

/** El id de una vez dibujada (no es una fila): `serie:<molde>:<día>`. */
export const idDeVezDibujada = (molde: string, fecha: string): string => `serie:${molde}:${fecha}`;

/** Qué le falta a un molde para que sus veces se programen solas; null si no le falta nada. */
export function faltaParaRepetir(m: { red: string | null; cuenta_red: string | null; archivo: string | null; dia_completo: boolean }): string | null {
  if (m.dia_completo) return 'Ponle una hora: cada vez sale a esa hora.';
  if (!m.red || !m.cuenta_red) return 'Elige la cuenta donde se publica.';
  if (!m.archivo) return 'Sube el archivo (la imagen o el video).';
  return null;
}
