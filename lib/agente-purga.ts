// =============================================================================
// La purga de los turnos del agente a los 90 días: lo que vence se vacía, el acta se queda
// =============================================================================
// El plugin del cliente reporta, por sesión, un ACTA (se queda) y los TURNOS que escribió la persona (caducan: son lo único
// que puede traer contenido del negocio del cliente). `app/api/agente/telemetria/route.ts` escribe `purgar_despues` = ahora + 90
// días en cada reporte (mig 0124), y hasta el 17/10/2026 NADA lo leía: la columna estaba escrita y los turnos no se borraban
// solos (docs/hallazgos-agente.md → «Lo que quedó sin hacer»). Este módulo es el que lo lee; lo llama el cron
// `/api/cron/agente-purga` (diario).
//
// QUÉ HACE, y qué NO:
//   · vacía `turnos` (`[]`) y pone `purgar_despues` en NULL de las sesiones cuyo `purgar_despues` ya pasó. NO borra filas: el acta
//     sobrevive, que es la decisión de diseño de la 0124;
//   · poner `purgar_despues` en NULL es lo que hace que cada sesión se purgue UNA vez (el índice de la 0124 es parcial sobre
//     «no nulo»: las ya purgadas salen del índice y de la próxima consulta);
//   · SÓLO LO VENCIDO: sin fecha de purga, o con una a futuro, no se toca. Un reporte nuevo de la misma sesión (el upsert del
//     hook, que reintenta o continúa) reescribe `purgar_despues` a +90 días: por eso el update VUELVE a preguntar «sigue vencida»
//     (compare-and-set), y una sesión que se reportó entre la lectura y el update no se vacía;
//   · tope por vuelta (`TOPE_PURGA_AGENTE`): lo que sobra se purga mañana, y `hayMas` lo dice;
//   · MODO SECO (`?seco=1`): cuenta y no escribe nada.
// El cliente de servicio cruza workspaces A PROPÓSITO (como el resto de /api/agente y el panel del dueño): la tabla es de la
// plataforma entera y la retención es la misma para todos.

import { getSupabaseServer } from './supabase';

export const TOPE_PURGA_AGENTE = 500;
const TABLA = 'agente_sesiones';

export type AccesoPurga = {
  /** Los ids con `purgar_despues` no nulo y ANTERIOR a `ahoraIso`, los más viejos primero, hasta `tope`. */
  vencidas(ahoraIso: string, tope: number): Promise<number[]>;
  /** Vacía los turnos de esos ids que SIGAN vencidos a `ahoraIso`; devuelve los que de verdad vació. */
  vaciar(ids: readonly number[], ahoraIso: string): Promise<number[]>;
};

export type ResultadoPurga = {
  modo: 'seco' | 'borra';
  /** Cuántas sesiones vencidas encontró en esta vuelta (hasta el tope). */
  vencidas: number;
  /** Cuántas vació de verdad (0 en seco). */
  purgadas: number;
  /** Había más que el tope: el resto va en la vuelta de mañana. */
  hayMas: boolean;
};

export async function purgarTurnosVencidos(acceso: AccesoPurga, opts: { seco: boolean; ahora?: Date; tope?: number }): Promise<ResultadoPurga> {
  const tope = opts.tope ?? TOPE_PURGA_AGENTE;
  const ahoraIso = (opts.ahora ?? new Date()).toISOString();
  const ids = await acceso.vencidas(ahoraIso, tope);
  const hayMas = ids.length >= tope;
  if (opts.seco || !ids.length) return { modo: opts.seco ? 'seco' : 'borra', vencidas: ids.length, purgadas: 0, hayMas };
  const purgadas = await acceso.vaciar(ids, ahoraIso);
  return { modo: 'borra', vencidas: ids.length, purgadas: purgadas.length, hayMas };
}

/** `?seco=1` (o `true`): el modo seco. Cualquier otra cosa —o nada— es la purga de verdad: es la retención prometida. */
export const pideSeco = (v: string | null | undefined): boolean => v === '1' || v === 'true';

/** El acceso de verdad: la tabla `agente_sesiones` con el cliente de servicio. */
export function accesoSupabase(): AccesoPurga {
  const db = getSupabaseServer();
  return {
    async vencidas(ahoraIso, tope) {
      const { data, error } = await db.from(TABLA).select('id')
        .not('purgar_despues', 'is', null).lt('purgar_despues', ahoraIso)
        .order('purgar_despues', { ascending: true }).limit(tope);
      if (error) throw new Error(`no pude leer las sesiones vencidas: ${error.message}`);
      return (data ?? []).map((f) => Number(f.id));
    },
    async vaciar(ids, ahoraIso) {
      // `lt(purgar_despues)` otra vez: compare-and-set contra un reporte que llegó entre la lectura y este update.
      const { data, error } = await db.from(TABLA).update({ turnos: [], purgar_despues: null })
        .in('id', [...ids]).not('purgar_despues', 'is', null).lt('purgar_despues', ahoraIso).select('id');
      if (error) throw new Error(`no pude vaciar los turnos vencidos: ${error.message}`);
      return (data ?? []).map((f) => Number(f.id));
    },
  };
}
