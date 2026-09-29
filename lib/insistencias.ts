// =============================================================================
// insistencias — el aviso que vuelve hasta que alguien dice «lo vi»
// =============================================================================
// Dos casos, el mismo mecanismo:
//   · «que cuando un lead entre al CRM, MaKo le reviente a mensajes insistiendo que
//     le LLAME» (tarea #823, el pedido de un cliente de la agencia).
//   · Mauricio enterándose de una reunión una hora antes porque el aviso quedó
//     sepultado, y la sesión con el prospecto cortada a la mitad (tarea #724).
//
// El aviso sale UNA vez por el camino normal (emitirAviso). Lo que agrega esto es la
// vuelta: si nadie acusa recibo en el grupo, vuelve cada `cadaMin` hasta `veces`.
//
// ⚠️ LOS TRES CORTES, y ninguno es configurable:
//   1. El techo del producto (5 veces, 30 min) — recortado en `sanearInsistir`.
//   2. El acuse: cualquier «ok» en el grupo cierra TODAS las vivas de ese workspace.
//      No se cierra sólo la del caso porque quien escribe «ok» está mirando el grupo:
//      seguir insistiendo con otra cosa después de que contestó es el mismo ruido que
//      esto viene a resolver.
//   3. La noche: fuera de la ventana horaria no sale nada, se corre a la mañana.
//
// La línea de WhatsApp que se quema es la del CLIENTE, no la nuestra.

import 'server-only';
import { getTenantDb, getWorkspaceActual, runWithWorkspace } from './workspace';
import { INSISTIR_VENTANA, sanearInsistir, proximaSalida } from './flujos-tipos';
import { enviarAlGrupoMaKo } from './mako-grupo';
import { tzDeWorkspace } from './timezone';

/** La hora (0-23) que es AHORA en el workspace. La ventana horaria es la de su gente. */
async function horaLocalDe(ws: number): Promise<number> {
  const tz = await tzDeWorkspace(ws);
  const h = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(new Date());
  const n = Number(h);
  return Number.isFinite(n) ? n % 24 : 12;
}

export type InsistenciaNueva = { flujoId: string; leadId?: number | null; texto: string; cadaMin: number; veces: number };

/** Abre una insistencia. El primer mensaje YA salió por el camino normal. */
export async function abrirInsistencia(ws: number, n: InsistenciaNueva): Promise<number | null> {
  const p = sanearInsistir(n);
  if (!p.texto) return null;
  try {
    return await runWithWorkspace(ws, async () => {
      const db = await getTenantDb();
      const hora = await horaLocalDe(ws).catch(() => 12);
      const { data, error } = await db.from('insistencias').insert({
        flujo_id: n.flujoId,
        lead_id: n.leadId ?? null,
        texto: p.texto,
        cada_min: p.cadaMin,
        veces: p.veces,
        proxima_at: proximaSalida(new Date(), p.cadaMin, hora).toISOString(),
      }).select('id').single();
      if (error) { console.error('[insistencias] abrir:', error.message); return null; }
      return (data as { id: number }).id;
    });
  } catch (e) {
    console.error('[insistencias] abrir:', e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * Alguien acusó recibo en el grupo: se cierran TODAS las vivas del workspace.
 * Devuelve cuántas cerró (0 = no había ninguna esperando, que es lo normal).
 */
export async function cerrarPorAcuse(ws: number): Promise<number> {
  try {
    return await runWithWorkspace(ws, async () => {
      const db = await getTenantDb();
      const { data, error } = await db.from('insistencias')
        .update({ cerrada_por: 'acuse', cerrada_at: new Date().toISOString() })
        .is('cerrada_at', null)
        .select('id');
      if (error) { console.error('[insistencias] acuse:', error.message); return 0; }
      return (data ?? []).length;
    });
  } catch (e) {
    console.error('[insistencias] acuse:', e instanceof Error ? e.message : String(e));
    return 0;
  }
}

/**
 * Manda las que ya vencieron en el workspace ACTUAL. La llama el cron.
 *
 * El orden importa: primero se marca (enviadas + próxima), después se manda. Al revés,
 * un timeout del envío dejaría la fila sin avanzar y el próximo tick la mandaría de
 * nuevo — que es exactamente el daño que el techo viene a evitar.
 */
/**
 * Cierra las insistencias ABIERTAS de un flujo porque alguien las apagó.
 *
 * ⚠️ SIN ESTO, EL INTERRUPTOR MIENTE. `drenarInsistencias` no consulta ninguna
 * configuración —ni el flujo, ni la plantilla, ni los canales—: manda lo que haya
 * en la tabla hasta agotar las veces. Así que apagar el recordatorio dejaba saliendo
 * hasta cinco mensajes más, y lo que sigue saliendo es justo lo que quema la línea
 * de WhatsApp del cliente.
 *
 * Se cierra con su propio motivo y no con 'acuse': son dos hechos distintos —uno es
 * «alguien lo vio» y el otro «alguien no lo quiere más»— y meterlos en el mismo
 * casillero hace que el día que se quiera medir cuántas se acusan, el número mienta.
 */
export async function cerrarPorConfiguracion(ws: number, flujoId: string): Promise<number> {
  try {
    return await runWithWorkspace(ws, async () => {
      const db = await getTenantDb();
      const { data, error } = await db.from('insistencias')
        .update({ cerrada_por: 'config', cerrada_at: new Date().toISOString() })
        .eq('flujo_id', flujoId)
        .is('cerrada_at', null)
        .select('id');
      if (error) { console.error('[insistencias] cerrar por config:', error.message); return 0; }
      return (data ?? []).length;
    });
  } catch (e) {
    console.error('[insistencias] cerrar por config:', e instanceof Error ? e.message : String(e));
    return 0;
  }
}

export async function drenarInsistencias(): Promise<{ enviadas: number; cerradas: number }> {
  const ws = await getWorkspaceActual();
  if (ws == null) return { enviadas: 0, cerradas: 0 };
  const db = await getTenantDb();
  const ahora = new Date();
  const hora = await horaLocalDe(ws).catch(() => 12);
  // De noche no sale nada: el cron corre igual y no hace ruido.
  if (hora < INSISTIR_VENTANA.desde || hora >= INSISTIR_VENTANA.hasta) return { enviadas: 0, cerradas: 0 };

  const { data, error } = await db.from('insistencias')
    .select('id, texto, cada_min, veces, enviadas')
    .is('cerrada_at', null)
    .lte('proxima_at', ahora.toISOString())
    .order('proxima_at', { ascending: true })
    .limit(20);
  if (error || !data?.length) return { enviadas: 0, cerradas: 0 };

  let enviadas = 0, cerradas = 0;
  for (const row of data as Array<{ id: number; texto: string; cada_min: number; veces: number; enviadas: number }>) {
    const n = row.enviadas + 1;
    const agotada = n >= row.veces;
    const { error: upErr } = await db.from('insistencias').update({
      enviadas: n,
      proxima_at: proximaSalida(ahora, row.cada_min, hora).toISOString(),
      ...(agotada ? { cerrada_por: 'agotada', cerrada_at: ahora.toISOString() } : {}),
    }).eq('id', row.id).eq('enviadas', row.enviadas);  // compare-and-set: dos ticks a la vez no duplican
    if (upErr) continue;
    try {
      await enviarAlGrupoMaKo(ws, row.texto);
      enviadas++;
      if (agotada) cerradas++;
    } catch (e) {
      console.error(`[insistencias] envío ${row.id}:`, e instanceof Error ? e.message : String(e));
    }
  }
  return { enviadas, cerradas };
}
