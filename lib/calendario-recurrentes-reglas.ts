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
//   4. UNA VEZ ES UNA VEZ: el molde lleva el último día que el cron ya atendió (`repetir_hasta`) y nunca se crea uno anterior. Se
//      cuenta en el MOLDE y no por las filas que existen: así, borrar o mover una vez no la hace renacer (revisión de privacidad,
//      29/10, A1). Dos pasadas a la vez, igual: las frena el índice único (`serie_de` + `inicio`).
//   5. EL MOLDE COMPLETO: hora, cuenta, archivo y TEXTO (`faltaParaRepetir`): un borrador sin el pie no sale solo todos los días (M5).
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

/**
 * Los días de la serie DESPUÉS del molde y desde `desde` (incluido) hasta `hasta` (incluido), y DESPUÉS de `atendidaHasta` (el
 * `repetir_hasta` del molde: lo que el cron ya atendió no vuelve, aunque la vez se haya borrado o movido).
 */
export function vecesDeLaSerie(p: {
  regla: unknown; ancla: string; desde: string; hasta: string; atendidaHasta: string | null; max: number;
}): string[] {
  // Lo atendido corre el arranque: nada en o antes de ese día.
  const desde = p.atendidaHasta && p.atendidaHasta >= p.desde ? sumarDias(p.atendidaHasta, 1) : p.desde;
  if (p.hasta < desde) return [];
  // `ocurrenciasEntre` devuelve las fechas DESPUÉS de su `desde`: se arranca un día antes para que `desde` cuente, y nunca antes
  // del molde (el molde es la primera vez: no se crea otra para su mismo día).
  const arranque = p.ancla > sumarDias(desde, -1) ? p.ancla : sumarDias(desde, -1);
  return ocurrenciasEntre(p.regla, arranque, p.hasta, p.ancla, p.max + 1).slice(0, p.max);
}

/** Las veces que el cron CREA hoy: de hoy a `HORIZONTE_DIAS` adelante (nada hacia atrás), las no atendidas, hasta `MAX_POR_PASADA`. */
export const vecesACrear = (p: { regla: unknown; ancla: string; hoy: string; atendidaHasta: string | null }): string[] =>
  vecesDeLaSerie({ regla: p.regla, ancla: p.ancla, desde: p.hoy, hasta: sumarDias(p.hoy, HORIZONTE_DIAS), atendidaHasta: p.atendidaHasta, max: MAX_POR_PASADA });

/**
 * Las veces que el Calendario DIBUJA en una vista (`desde`/`hasta`, días de la zona del negocio): las que todavía no nacieron, y
 * desde HOY. Las que ya nacieron se ven como lo que son: una Publicación de verdad. ⚠️ Una vez del pasado que no nació no va a salir
 * nunca (nada hacia atrás): dibujarla como «próxima» era decir que salió.
 */
export const vecesADibujar = (p: { regla: unknown; ancla: string; desde: string; hasta: string; hoy: string; atendidaHasta: string | null }): string[] =>
  vecesDeLaSerie({ regla: p.regla, ancla: p.ancla, desde: p.desde > p.hoy ? p.desde : p.hoy, hasta: p.hasta, atendidaHasta: p.atendidaHasta, max: MAX_DIBUJADAS });

/** El id de una vez dibujada (no es una fila): `serie:<molde>:<día>`. */
export const idDeVezDibujada = (molde: string, fecha: string): string => `serie:${molde}:${fecha}`;

/** Qué le falta a un molde para que sus veces se programen solas; null si no le falta nada. */
export function faltaParaRepetir(m: {
  red: string | null; cuenta_red: string | null; archivo: string | null; dia_completo: boolean; texto: string | null;
}): string | null {
  if (m.dia_completo) return 'Ponle una hora: cada vez sale a esa hora.';
  if (!m.red || !m.cuenta_red) return 'Elige la cuenta donde se publica.';
  if (!m.archivo) return 'Sube el archivo (la imagen o el video).';
  if (!m.texto?.trim()) return 'Escribe el texto: cada vez sale con él.';
  return null;
}

/** «Repetir» en una vez de una serie (A2): no arma otra serie. */
export const ES_UNA_VEZ_DE_LA_SERIE = 'Es una de las veces de una publicación que se repite: la repetición se cambia en la primera.';
