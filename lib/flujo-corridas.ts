// =============================================================================
// flujo-corridas — el estado de un flujo que todavía no terminó
// =============================================================================
// Lo que esta tabla hace posible: el DELAY y el CONDICIONAL. Antes del 04/10/2026
// `ejecutarPasos` era un `for` sincrónico adentro del webhook y el paso `esperar`
// hacía `break`, así que un flujo no podía sobrevivir al request que lo disparó.
//
// La parte que DECIDE (qué paso sigue, cuánto espera, si la condición se cumple) vive
// en `lib/flujo-pasos.ts`, sin `server-only`, para que tenga test. Acá está sólo lo
// que toca la base.

import 'server-only';
import { getTenantDb, runWithWorkspace } from './workspace';
import type { CtxFlujo } from './flujos';

export type Corrida = {
  id: number;
  avisoId: string;
  paso: number;
  desdeAt: Date;
  respondioAt: Date | null;
  ctx: CtxFlujo;
};

type Fila = {
  id: number; aviso_id: string; paso: number; desde_at: string;
  respondio_at: string | null; ctx: unknown; workspace_id: number;
};

const aCorrida = (f: Fila): Corrida => ({
  id: f.id,
  avisoId: f.aviso_id,
  paso: f.paso,
  desdeAt: new Date(f.desde_at),
  respondioAt: f.respondio_at ? new Date(f.respondio_at) : null,
  ctx: (f.ctx ?? {}) as CtxFlujo,
});

/**
 * Abre una corrida. Se llama cuando un flujo se duerme por primera vez, no cuando
 * arranca: un flujo sin `esperar` ni `condicional` corre entero en el webhook y no
 * deja fila — escribir una por cada evento llenaría la tabla de corridas que nacen
 * y mueren en el mismo milisegundo.
 */
export async function abrirCorrida(
  ws: number,
  avisoId: string,
  paso: number,
  proximaAt: Date | null,
  ctx: CtxFlujo,
): Promise<number | null> {
  try {
    return await runWithWorkspace(ws, async () => {
      const db = await getTenantDb();
      const { data, error } = await db.from('flujo_corridas').insert({
        aviso_id: avisoId, paso, proxima_at: proximaAt?.toISOString() ?? null,
        desde_at: new Date().toISOString(), ctx,
      }).select('id').single();
      if (error) { console.error('[corridas] abrir:', error.message); return null; }
      return (data as { id: number }).id;
    });
  } catch (e) {
    console.error('[corridas] abrir:', e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * Las corridas que toca despertar AHORA, de todos los workspaces.
 *
 * ⚠️ `proxima_at IS NULL` también entra: es una corrida que quedó a mitad sin
 * dormirse (un condicional que saltó al último paso, un reintento). Dejarla afuera
 * la congelaba para siempre sin que nada lo dijera.
 */
export async function corridasVencidas(limite = 50): Promise<Array<Corrida & { ws: number }>> {
  const db = await getTenantDb();
  const ahora = new Date().toISOString();
  const { data, error } = await db.from('flujo_corridas')
    .select('id, workspace_id, aviso_id, paso, desde_at, respondio_at, ctx')
    .eq('estado', 'pendiente')
    .or(`proxima_at.is.null,proxima_at.lte.${ahora}`)
    .order('proxima_at', { ascending: true, nullsFirst: true })
    .limit(limite);
  if (error) { console.error('[corridas] vencidas:', error.message); return []; }
  return (data ?? []).map((f) => ({ ...aCorrida(f as Fila), ws: (f as Fila).workspace_id }));
}

/**
 * Avanza una corrida, con COMPARE-AND-SET sobre el paso.
 *
 * ⚠️ EL `.eq('paso', pasoViejo)` ES LO QUE EVITA MANDAR DOS VECES. El drenador puede
 * correr dos veces sobre la misma fila —un reintento de Vercel, dos ticks que se
 * pisan— y sin esto las dos pasadas ejecutarían el mismo paso. Es el mismo reclamo
 * atómico que ya usan `lib/insistencias.ts` (`.eq('enviadas', …)`) y la 0183
 * (`.eq('proxima_at', …)`). Devuelve false si otro se la llevó: ahí NO se ejecuta.
 */
export async function avanzar(
  ws: number, id: number, pasoViejo: number, pasoNuevo: number, proximaAt: Date | null,
): Promise<boolean> {
  try {
    return await runWithWorkspace(ws, async () => {
      const db = await getTenantDb();
      const { data, error } = await db.from('flujo_corridas')
        .update({
          paso: pasoNuevo,
          proxima_at: proximaAt?.toISOString() ?? null,
          // `desde_at` se re-estampa en cada avance: la espera de un `esperar` se
          // mide desde que se DURMIÓ, no desde que arrancó la corrida.
          desde_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id).eq('paso', pasoViejo).eq('estado', 'pendiente')
        .select('id');
      if (error) { console.error('[corridas] avanzar:', error.message); return false; }
      return (data ?? []).length > 0;
    });
  } catch (e) {
    console.error('[corridas] avanzar:', e instanceof Error ? e.message : String(e));
    return false;
  }
}

/** Cierra una corrida. `hecha` = llegó al final; `cortada` = el flujo cambió debajo. */
export async function cerrarCorrida(ws: number, id: number, estado: 'hecha' | 'cortada'): Promise<void> {
  try {
    await runWithWorkspace(ws, async () => {
      const db = await getTenantDb();
      await db.from('flujo_corridas')
        .update({ estado, proxima_at: null, updated_at: new Date().toISOString() })
        .eq('id', id);
    });
  } catch (e) {
    console.error('[corridas] cerrar:', e instanceof Error ? e.message : String(e));
  }
}

/**
 * Alguien acusó recibo en el grupo: se estampa en TODAS las corridas abiertas del
 * workspace. Es la señal del condicional, y es la misma que cierra las insistencias
 * (`cerrarPorAcuse`) — la única respuesta que este motor puede observar.
 *
 * ⚠️ NO DESPIERTA NADA. Marcar y despertar son dos cosas: una corrida dormida tiene
 * un `esperar` que el dueño configuró, y adelantarlo porque alguien escribió «ok» en
 * el grupo manda el mensaje antes de tiempo. El condicional se evalúa cuando a la
 * corrida le toca, con la marca ya puesta.
 *
 * Devuelve cuántas marcó (0 es lo normal: casi nunca hay una corrida abierta).
 */
export async function marcarRespondieron(ws: number): Promise<number> {
  try {
    return await runWithWorkspace(ws, async () => {
      const db = await getTenantDb();
      const { data, error } = await db.from('flujo_corridas')
        .update({ respondio_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('estado', 'pendiente').is('respondio_at', null)
        .select('id');
      if (error) { console.error('[corridas] responder:', error.message); return 0; }
      return (data ?? []).length;
    });
  } catch (e) {
    console.error('[corridas] responder:', e instanceof Error ? e.message : String(e));
    return 0;
  }
}
