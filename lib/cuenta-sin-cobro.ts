// =============================================================================
// cuenta-sin-cobro — lee y guarda el interruptor «Habilitado sin cobro» de un negocio (19/11/2026)
// =============================================================================
// El ajuste `cuenta.sin_cobro` (lib/cuenta-sin-cobro-reglas.ts) de ESE negocio, con el cliente de servicio. Lo escribe sólo la acción del super
// admin; ningún cron ni código lo cambia solo. Sin migración (es un renglón de `app_settings`).
// Con el interruptor APAGADO (19/11/2026): la prueba de 7 días y la pausa si no activa su plan (`revisarSinCobro`, más abajo; las reglas en
// lib/cuenta-sin-cobro-reglas.ts, `pasoSinCobro`). ⚠️ `revisarSinCobro` sólo LEE el interruptor: pausa y reabre el NEGOCIO, nunca toca el ajuste.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { CLAVE_SIN_COBRO, MOTIVO_PRUEBA_TERMINADA, finDeLaPruebaSinCobro, pasoSinCobro, sinCobroDeSetting, type SinCobro } from './cuenta-sin-cobro-reglas';
import { CLAVE_CORTE, leerCorte } from './plan-acceso-reglas';

const esWs = (ws: unknown): ws is number => typeof ws === 'number' && Number.isInteger(ws) && ws > 0;

/** El interruptor de un negocio (`null` = nunca se tocó). Si no se puede leer, tira: «no pude leer» no es «apagado». */
export async function leerSinCobro(ws: number): Promise<SinCobro | null> {
  const { data, error } = await getSupabaseServer().from('app_settings').select('value').eq('workspace_id', ws).eq('key', CLAVE_SIN_COBRO).maybeSingle();
  if (error) throw new Error(`No pude leer el interruptor del negocio ${ws}: ${error.message}`);
  return sinCobroDeSetting(((data as { value?: string } | null)?.value) ?? null);
}

/** Los negocios con el interruptor PRENDIDO (para el chip de la lista). Si no se puede leer, vacío (y el aviso queda en el log). */
export async function negociosSinCobro(): Promise<Set<number>> {
  try {
    const { data, error } = await getSupabaseServer().from('app_settings').select('workspace_id, value').eq('key', CLAVE_SIN_COBRO).limit(5000);
    if (error) throw new Error(error.message);
    return new Set(((data ?? []) as Array<{ workspace_id: number; value: string }>).filter((f) => sinCobroDeSetting(f.value)?.activo === true).map((f) => Number(f.workspace_id)));
  } catch (e) {
    console.warn(`[sin-cobro] no pude leer los negocios sin cobro: ${e instanceof Error ? e.message : String(e)}`);
    return new Set();
  }
}

/** Prende o apaga el interruptor. Anota quién y cuándo. Devuelve lo guardado. */
export async function ponerSinCobro(ws: number, activo: boolean, por: string, ahora: Date = new Date()): Promise<{ ok: true; sinCobro: SinCobro } | { ok: false; error: string }> {
  if (!esWs(ws)) return { ok: false, error: 'Negocio inválido.' };
  const valor: SinCobro = { activo, por: por.slice(0, 120) || null, at: ahora.toISOString() };
  const { error } = await getSupabaseServer().from('app_settings')
    .upsert({ workspace_id: ws, key: CLAVE_SIN_COBRO, value: JSON.stringify(valor), updated_at: ahora.toISOString() }, { onConflict: 'workspace_id,key' });
  if (error) return { ok: false, error: `No pude guardarlo: ${error.message}` };
  return { ok: true, sinCobro: valor };
}

// ── Apagado: la prueba y la pausa (19/11/2026) ─────────────────────────────────────────────────────────────────

/**
 * ¿Tiene un plan de MaKo SUYO? Una suscripción de la plataforma atada a su negocio (`alta_ws`) que ya se pagó, o que autorizó y espera su
 * primer cobro (la tarjeta cargada en la prueba: Mercado Pago cobra el día que termina). `undefined` = no se pudo leer (nunca se pausa).
 */
export async function tienePlanPropio(ws: number): Promise<boolean | undefined> {
  try {
    const { wsSuperAdmin } = await import('./workspace');
    const { data, error } = await getSupabaseServer().from('cobros').select('estado, suscripcion_estado')
      .eq('workspace_id', await wsSuperAdmin()).eq('alta_ws', ws).eq('tipo', 'suscripcion').in('estado', ['pagado', 'pendiente']).limit(50);
    if (error) return undefined;
    return ((data ?? []) as Array<{ estado: string; suscripcion_estado: string | null }>)
      .some((c) => c.estado === 'pagado' || (c.suscripcion_estado != null && c.suscripcion_estado !== 'cancelada'));
  } catch { return undefined; }
}

/**
 * ¿PAGA SU LUGAR por alguna vía? Su plan propio (arriba), su mensualidad por Binance (una agencia, o una cuenta con ciclo propio como Leila), o
 * es cliente de una agencia (la paga la agencia). ⚠️ Sin esto, apagar el interruptor de un cliente de agencia o de Leila los PAUSABA a los 7 días
 * (no tienen un cobro con `alta_ws`). `undefined` = algo no se pudo leer (nunca se pausa ni se muestra la prueba).
 */
export async function pagaSuLugar(ws: number): Promise<boolean | undefined> {
  const [propio, mensualidad, deAgencia] = await Promise.all([
    tienePlanPropio(ws),
    import('./agencia-mes').then((m) => m.planDeLaMensualidad(ws), () => undefined),
    import('./agencia').then((m) => m.esClienteDeAgencia(ws), () => null),
  ]);
  if (propio === true || (mensualidad !== undefined && mensualidad !== null) || deAgencia === true) return true;
  if (propio === undefined || mensualidad === undefined || deAgencia == null) return undefined;
  return false;
}

/**
 * La prueba del negocio, para el aviso de la esquina: hasta cuándo, si el interruptor está APAGADO, la prueba sigue y todavía no paga.
 * null en cualquier otro caso (y si algo no se pudo leer: el aviso no se muestra antes que mostrar uno falso).
 */
export async function pruebaSinCobroDe(ws: number, ahora: number = Date.now()): Promise<{ hasta: string } | null> {
  try {
    const fin = finDeLaPruebaSinCobro(await leerSinCobro(ws));
    if (!fin || Date.parse(fin) <= ahora) return null;
    return (await pagaSuLugar(ws)) === false ? { hasta: fin } : null;
  } catch { return null; }
}

export type RevisionSinCobro = { revisados: number; pausados: number[]; reabiertos: number[]; errores: number };

/**
 * Pausa al negocio con el interruptor APAGADO que terminó su prueba sin su plan, y reabre al que pausó ESTE corte cuando ya tiene su plan o Martín
 * lo volvió a prender. Lo corre el cron de cobros (cada media hora) y el interruptor (`soloWs`, para que prenderlo reabra en el acto). Pausa con
 * compare-and-set (`cortar`, lib/plan-acceso.ts: si guardar el corte falla, deshace la pausa). Nunca tira.
 */
export async function revisarSinCobro(o: { soloWs?: number; ahora?: number } = {}): Promise<RevisionSinCobro> {
  const out: RevisionSinCobro = { revisados: 0, pausados: [], reabiertos: [], errores: 0 };
  const ahora = o.ahora ?? Date.now();
  try {
    const db = getSupabaseServer();
    const { wsSuperAdmin } = await import('./workspace');
    const plataforma = await wsSuperAdmin();
    let q = db.from('app_settings').select('workspace_id, value').eq('key', CLAVE_SIN_COBRO);
    if (o.soloWs != null) q = q.eq('workspace_id', o.soloWs);
    const { data, error } = await q.limit(5000);
    if (error) throw new Error(error.message);
    const filas = ((data ?? []) as Array<{ workspace_id: number; value: string }>).map((f) => ({ ws: Number(f.workspace_id), s: sinCobroDeSetting(f.value) })).filter((f) => f.ws !== plataforma);
    if (!filas.length) return out;
    const wss = filas.map((f) => f.ws);
    const [estados, cortes] = await Promise.all([
      db.from('workspaces').select('id, estado').in('id', wss),
      db.from('app_settings').select('workspace_id, value').eq('key', CLAVE_CORTE).in('workspace_id', wss),
    ]);
    if (estados.error || cortes.error) throw new Error((estados.error ?? cortes.error)!.message);
    const estadoDe = new Map(((estados.data ?? []) as Array<{ id: number; estado: string }>).map((w) => [Number(w.id), w.estado]));
    const corteDe = new Map(((cortes.data ?? []) as Array<{ workspace_id: number; value: string }>).map((c) => [Number(c.workspace_id), leerCorte(c.value)]));
    const { cortar, reabrir } = await import('./plan-acceso');
    for (const { ws, s } of filas) {
      out.revisados++;
      try {
        const corte = corteDe.get(ws) ?? null;
        const corteNuestro = corte?.motivo === MOTIVO_PRUEBA_TERMINADA && corte.vigente;
        const apagado = finDeLaPruebaSinCobro(s) != null;
        const plan = apagado ? await pagaSuLugar(ws) : undefined;
        const paso = pasoSinCobro({ sinCobro: s, plan, estado: estadoDe.get(ws) ?? null, corteNuestro, ahora });
        if (paso.tipo === 'pausar') {
          if (await cortar(ws, { cobroId: 0, hasta: paso.hasta, motivo: MOTIVO_PRUEBA_TERMINADA, desde: new Date(ahora).toISOString(), vigente: true })) {
            out.pausados.push(ws);
            const { enviarAlGrupoSuperAdmin } = await import('./mako-grupo');
            const { data: w } = await db.from('workspaces').select('nombre').eq('id', ws).maybeSingle();
            await enviarAlGrupoSuperAdmin(`${(w as { nombre?: string } | null)?.nombre ?? `El negocio ${ws}`} terminó su prueba de 7 días sin activar su plan: quedó en pausa hasta que pague. Si quieres que siga sin cobro, prende «Habilitado sin cobro» en Admin › Customers.`)
              .catch((e) => console.warn(`[sin-cobro] ws=${ws}: no pude avisar a Martín: ${e instanceof Error ? e.message : String(e)}`));
          }
        } else if (paso.tipo === 'reabrir' && corte) {
          if (await reabrir(ws, corte)) out.reabiertos.push(ws);
        }
      } catch (e) {
        out.errores++;
        console.error(`[sin-cobro] ws=${ws}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } catch (e) {
    out.errores++;
    console.error(`[sin-cobro] no pude revisar los negocios sin cobro: ${e instanceof Error ? e.message : String(e)}`);
  }
  return out;
}
