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
import { getSupabaseServer } from './supabase';
import type { CtxFlujo } from './flujos';
import { ctxParaDormir } from './flujo-pasos';
import { sinSecretos } from './variables-aviso';

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
  o?: { reintento?: boolean },
): Promise<number | null> {
  try {
    return await runWithWorkspace(ws, async () => {
      const db = await getTenantDb();
      // ⚠️ SE GUARDA SIN LO QUE ENVEJECE (`ctxParaDormir`, 11/10/2026): la corrida despierta días después,
      // y un «hace 1 día» guardado hoy sería falso al salir. La entrada ya salió con los datos completos.
      // ⚠️ SALVO UN REINTENTO (`reintento`, revisión del 11/10/2026): ahí no se durmió en un DELAY sino porque no se
      // pudo leer al lead en una CONDITION, y lo que viene puede ser la ENTRADA, que usa `{{cuota_dias}}` (antes de un
      // DELAY va: es el dato de hoy). Es el mismo momento unos minutos después (`reintentoDeHechos` tiene tope): sacarle
      // el dato la mandaría con la variable cruda. Lo de después de un DELAY no lo puede usar igual (`pasosDelEvento`).
      // ⚠️ Y NUNCA CON UN SECRETO (15/10/2026, `sinSecretos`): tampoco en el reintento, que guarda el contexto entero.
      // El link de restablecer es de UN uso; guardado en la base, ya no lo es.
      const { data, error } = await db.from('flujo_corridas').insert({
        aviso_id: avisoId, paso, proxima_at: proximaAt?.toISOString() ?? null,
        desde_at: new Date().toISOString(), ctx: sinSecretos(o?.reintento ? ctx : ctxParaDormir(ctx)),
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
  // ⚠️ CRUDO Y SIN SCOPE A PROPÓSITO: es la ÚNICA lectura cross-workspace del drenador, y
  // sirve para saber a quién hay que visitar. Con `getTenantDb()` —lo que había— el cron
  // corre sin sesión, el workspace cae al dueño por contrato, y la tabla está en
  // TENANT_TABLES: o sea que el drenador sólo veía las corridas del ws1. El Delay y el
  // Condicional de los demás clientes NO DESPERTABAN NUNCA, sin un solo error — un
  // «esperar 2 horas» que espera para siempre. Lo encontró el relevo del 06/10/2026.
  //
  // Es el mismo molde que el cron de insistencias (app/api/cron/insistencias/route.ts):
  // cada fila trae su `workspace_id`, y TODO lo que toca datos después corre adentro de un
  // `runWithWorkspace(c.ws, …)` (`retomarCorrida`, en lib/flujos.ts). Leer acá con el service
  // role no le da a nadie una fila ajena: sólo decide a qué workspace hay que ir.
  const db = getSupabaseServer();
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
  /** Sólo el reintento de una CONDITION (`reintentoDeHechos`): la cuenta de vueltas viaja en el contexto. */
  ctx?: CtxFlujo,
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
          ...(ctx ? { ctx: sinSecretos(ctx) } : {}),
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
/**
 * CIERRA LAS CORRIDAS QUE HABLABAN DE ESA CUOTA. La llama `marcarPago`.
 *
 * ⚠️ CERRAR Y NO «EVALUAR UNA CONDICIÓN». Lo que la tarjeta #19 pide es que «al marcar
 * el pago en la ficha la secuencia queda cortada sin que nadie la pause a mano», y eso
 * es un corte, no una rama: una condición `¿ya pagó?` adentro del flujo haría que la
 * corrida siga viva, despierte, pregunte y recién ahí se termine — o sea que seguiría
 * existiendo un camino por el que el recordatorio sale después del pago si el orden de
 * los pasos no es el que uno supone. Cerrada, no hay camino.
 *
 * Se cierra como `cortada` y no como `hecha`: «terminó» y «la cortamos» son dos hechos,
 * y el segundo es el que explica por qué no salieron los mensajes que faltaban.
 *
 * El `ctx` de la corrida es un jsonb, así que el filtro va sobre su clave: la cuota
 * viaja ahí desde que el cron de cobranza abre la corrida.
 */
export async function cerrarCorridasDeCuota(ws: number, cuotaId: number, opts: { tirar?: boolean } = {}): Promise<number> {
  // `tirar`: el corte que pide una PERSONA («Cortarlo», lib/pagos.ts) dice que falló; el de `marcarPago` no tira,
  // porque que falle el corte no puede tumbar el registro del pago.
  try {
    return await runWithWorkspace(ws, async () => {
      const db = await getTenantDb();
      const { data, error } = await db.from('flujo_corridas')
        .update({ estado: 'cortada', proxima_at: null })
        .eq('estado', 'pendiente')
        .eq('ctx->>cuotaId', String(cuotaId))
        .select('id');
      if (error) {
        if (opts.tirar) throw new Error(`No pude cortar el recordatorio: ${error.message}`);
        console.error('[corridas] cerrar por cuota:', error.message); return 0;
      }
      return (data as unknown[] | null)?.length ?? 0;
    });
  } catch (e) {
    if (opts.tirar) throw e;
    console.error('[corridas] cerrar por cuota:', e instanceof Error ? e.message : String(e));
    return 0;
  }
}

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
