// =============================================================================
// tope-social — los TOPES de Instagram y Messenger, dichos al negocio (Leandro, 28/10/2026)
// =============================================================================
// Leandro (Fiesta Music, ws10), por audio en su grupo: hace ~500 respuestas a comentarios y ~1.000 DMs por mes y preguntó si
// hay un límite; pidió que MaKo le avise ANTES de que se trabe la automatización, «para no encontrarme con mil mensajes sin
// responder». Los topes (medidos por el Cerebro, 28/10): Meta, 750 respuestas privadas a comentarios por hora y por cuenta
// de Instagram (y 300 mensajes por segundo); Zernio, 60 pedidos por minuto con 0-2 cuentas conectadas y 600 con 3 o más, con
// un 429, `Retry-After` y `X-RateLimit-Remaining` (docs.zernio.com/rate-limits).
//
// LO QUE NO SE PIERDE lo resuelve el envío (`topeDe`, lib/zernio.ts; `porTope`, lib/canal-zernio.ts): un tope no cierra el
// hilo, el paso vuelve a salir cuando pasa la espera. ESTO es lo que se le DICE al negocio: una vez por tanda (la corrida del
// motor que se topó, y no más de uno por hora), cuántos quedaron esperando, por culpa de quién y cuándo salen; y, ANTES del
// tope de Meta, cuando lo que salió en la última hora se acerca a 750 (`CERCA_DEL_TOPE_META`). Sale por el evento de la
// plataforma `social_tope` (la automatización del ws 9 dice el texto: regla del 16/10, «sin fila no sale»).
// Puro: lo usan el motor (`avisarTopesSociales`, lib/nutricion.ts) y el test.
// =============================================================================

import type { TopeSocial } from './zernio-tope';
import type { CanalSocial } from './canal-social';

/** El tope de Meta para las respuestas privadas a comentarios: por hora y por cuenta de Instagram. */
export const TOPE_META_POR_HORA = 750;
/** Desde cuánto se avisa ANTES de llegar (80 %): con la hora de Leandro en ~20, es un margen de sobra. */
export const CERCA_DEL_TOPE_META = 600;
/** Un aviso por negocio cada tanto, aunque el motor corra cada minuto: «una vez por tanda, no por mensaje». */
export const VENTANA_AVISO_TOPE_MIN = 60;

/** Lo que el motor anota de cada envío que frenó un tope. */
export type TopeDeLaCorrida = TopeSocial & { canal: CanalSocial };

/** El aviso, ya resumido: lo que llega como datos al evento (`datosTopeSocial`). */
export type ResumenTope = {
  estado: 'frenado' | 'cerca';
  quien: 'zernio' | 'meta';
  canales: CanalSocial[];
  cuantos: number;
  esperaMs: number;
};

/**
 * LA CORRIDA, RESUMIDA: cuántos esperan, de quién es la culpa (si en la misma corrida frenaron los dos, se dice Meta: es el
 * que tarda una hora) y la espera más larga. null = ninguno frenó.
 */
export function resumirTopes(topes: readonly TopeDeLaCorrida[]): ResumenTope | null {
  if (!topes.length) return null;
  const quien = topes.some((t) => t.quien === 'meta') ? 'meta' : 'zernio';
  return {
    estado: 'frenado', quien,
    canales: [...new Set(topes.map((t) => t.canal))],
    cuantos: topes.length,
    esperaMs: Math.max(...topes.filter((t) => t.quien === quien).map((t) => t.esperaMs)),
  };
}

/** ¿Lo que salió por Instagram o Messenger en la última hora ya está cerca del tope de Meta? */
export const cercaDelTopeDeMeta = (enviadosUltimaHora: number): boolean => enviadosUltimaHora >= CERCA_DEL_TOPE_META;

/**
 * LA CUENTA MÁS CARGADA DE LA ÚLTIMA HORA (la verificación del Cerebro sobre 69b49a31c, 29/10/2026). El tope de Meta es POR
 * CUENTA y el «cerca» sumaba el negocio entero: Leandro con sus dos cuentas a 320 cada una daba 640 y un falso «te estás
 * acercando». Cada envío cuenta en la cuenta de la conversación del lead por ese canal (`cuentaDe`: la misma que usa el envío);
 * sin cuenta legible, aparte, por canal. Y el canal es el de esa cuenta: un negocio que manda sólo por Messenger no recibe
 * «Instagram». null = no salió nada.
 */
export function cuentaMasCargada(
  envios: ReadonlyArray<{ leadId: number; canal: CanalSocial }>,
  cuentaDe: (leadId: number, canal: CanalSocial) => string | null,
): { canal: CanalSocial; cuenta: string | null; cuantos: number } | null {
  const por = new Map<string, { canal: CanalSocial; cuenta: string | null; cuantos: number }>();
  for (const e of envios) {
    const cuenta = cuentaDe(e.leadId, e.canal);
    const k = `${e.canal}:${cuenta ?? ''}`;
    const g = por.get(k) ?? { canal: e.canal, cuenta, cuantos: 0 };
    g.cuantos += 1;
    por.set(k, g);
  }
  let max: { canal: CanalSocial; cuenta: string | null; cuantos: number } | null = null;
  for (const g of por.values()) if (!max || g.cuantos > max.cuantos) max = g;
  return max;
}

/** «en 1 min», «en 25 min», «en 1 h», «en 2 h». */
export function textoEspera(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `en ${min} min`;
  return `en ${Math.round(min / 60)} h`;
}

const NOMBRE_QUIEN = { meta: 'Instagram', zernio: 'Zernio' } as const;

/** Los DATOS del evento `social_tope` (`{{tope_estado}}`, `{{tope_quien}}`, …): lo que la fila del ws 9 pone en su texto. */
export function datosTopeSocial(r: ResumenTope): Record<string, string> {
  const canales = r.canales.map((c) => (c === 'instagram' ? 'Instagram' : 'Messenger')).join(' y ');
  return {
    tope_estado: r.estado,
    // Por Messenger el de Meta también es de Meta, pero el negocio lo conoce como «Facebook».
    tope_quien: r.quien === 'meta' && !r.canales.includes('instagram') ? 'Facebook' : NOMBRE_QUIEN[r.quien],
    tope_canal: canales,
    tope_cuantos: r.estado === 'cerca' ? `${r.cuantos} mensajes en la última hora` : `${r.cuantos} ${r.cuantos === 1 ? 'mensaje' : 'mensajes'}`,
    tope_espera: r.estado === 'cerca' ? '' : textoEspera(r.esperaMs),
    tope_limite: `${TOPE_META_POR_HORA} por hora`,
  };
}
