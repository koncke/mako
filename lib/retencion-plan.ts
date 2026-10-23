// =============================================================================
// retencion-plan — antes de darse de baja, un descuento (23/10/2026)
// =============================================================================
// Pedido de Martín (22/10/2026): «si te querés dar de baja en la suscripción debería habilitarte un descuento como lo
// tienen todas las aplicaciones». Copiado de lo que hacen (Spotify, Canva, los SaaS con Stripe): al tocar «Darme de
// baja» aparece UNA oferta —la mitad de precio los próximos 2 meses— y la persona elige: quedarse con el descuento o
// seguir con la baja. Una vez por negocio: quien ya la usó, la próxima vez va directo a la baja.
//
//   · Stripe: un cupón `repeating` de 2 meses en la suscripción. Vuelve solo al precio de lista.
//   · Mercado Pago: el monto de las próximas cuotas a la mitad (PUT /preapproval). MP no vuelve solo: el cron de la
//     pasarela lo restaura cuando se cobraron las cuotas con descuento (`restaurarRetencionesMp`).
//   · La oferta se guarda en el negocio (`plan.retencion`) con compare-and-set: dos clics no la aplican dos veces.
//
// PARAMETRIZABLE: el % y los meses (RETENCION, abajo). Las ofertas finales las define el Cerebro.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { cambiarSettingSi, getSetting, setSetting } from './settings';
import { credDelCliente } from './credenciales';
import { logLeadEvent } from './leads';
import { suscripcionDeMakoDe } from './cobros';
import { esBajaPedida } from './cobros-reglas';
import { formatoMonto } from './pasarela-moneda';
import { descuentoStripe, montoSuscripcionMp } from './pasarela-plan-api';

/** La oferta: `pct`% de descuento por `meses` meses. */
export const RETENCION = { pct: 50, meses: 2 } as const;
export const CLAVE_RETENCION = 'plan.retencion';

type Guardada = {
  estado: 'aplicando' | 'aplicada' | 'error';
  cobroId: number; pasarela: 'stripe' | 'mercadopago'; pct: number; meses: number;
  aplicadaAt: string; montoOriginal: number; moneda: string; restaurada?: boolean; error?: string;
};

const leer = (crudo: string | null): Guardada | null => { try { return crudo ? (JSON.parse(crudo) as Guardada) : null; } catch { return null; } };

export type OfertaRetencion = { pct: number; meses: number; monto: string; montoConDescuento: string } | null;

/** ¿Este negocio tiene la oferta? Con una suscripción de MaKo que se sigue cobrando, sin baja pedida, y sin haberla usado. */
export async function ofertaDeRetencion(ws: number): Promise<OfertaRetencion> {
  const c = await suscripcionDeMakoDe(ws).catch(() => null);
  if (!c || c.suscripcion_estado === 'cancelada' || esBajaPedida(c.motivo)) return null;
  if (c.proveedor === 'stripe' ? !c.proveedor_suscripcion_id : !(c.proveedor_suscripcion_id ?? c.proveedor_ref)) return null;
  const usada = await runWithWorkspace(ws, () => getSetting(CLAVE_RETENCION)).catch(() => 'x');
  if (usada) return null;
  const con = Math.round(c.monto * (100 - RETENCION.pct)) / 100;
  return { pct: RETENCION.pct, meses: RETENCION.meses, monto: formatoMonto(c.monto, c.moneda), montoConDescuento: formatoMonto(con, c.moneda) };
}

/** Aceptar la oferta. Mueve plata a futuro (lo que se cobra): sólo desde la pantalla, por el admin, una vez. */
export async function aplicarRetencion(ws: number, autor: string): Promise<{ ok: boolean; resumen: string }> {
  const c = await suscripcionDeMakoDe(ws);
  if (!c || c.suscripcion_estado === 'cancelada' || esBajaPedida(c.motivo)) return { ok: false, resumen: 'Tu plan no tiene una suscripción activa.' };
  const ahora = new Date().toISOString();
  const marca: Guardada = { estado: 'aplicando', cobroId: c.id, pasarela: c.proveedor, pct: RETENCION.pct, meses: RETENCION.meses, aplicadaAt: ahora, montoOriginal: c.monto, moneda: c.moneda };
  // El reclamo: de null a «aplicando». Si ya había algo, la oferta ya se usó (o se está usando en otra pestaña).
  const gano = await runWithWorkspace(ws, () => cambiarSettingSi(CLAVE_RETENCION, null, JSON.stringify(marca)));
  if (!gano) return { ok: false, resumen: 'Esta oferta ya la usaste.' };
  const plataforma = await wsSuperAdmin();
  const idem = `mako-retencion-${c.id}`;
  let error: string | null = null;
  if (c.proveedor === 'stripe') {
    const key = await credDelCliente('STRIPE_SECRET_KEY', plataforma);
    const r = key && c.proveedor_suscripcion_id ? await descuentoStripe(key, c.proveedor_suscripcion_id, { pct: RETENCION.pct, meses: RETENCION.meses, idem }) : null;
    if (!r?.ok) error = r && !r.ok ? r.error : 'Stripe no está conectado';
  } else {
    const token = await credDelCliente('MERCADOPAGO_ACCESS_TOKEN', plataforma);
    const id = c.proveedor_suscripcion_id ?? c.proveedor_ref;
    const r = token && id ? await montoSuscripcionMp(token, id, Math.round(c.monto * (100 - RETENCION.pct)) / 100, idem) : null;
    if (!r?.ok) error = r && !r.ok ? r.error : 'Mercado Pago no está conectado';
  }
  if (error) {
    // Lo que falló se deja dicho (no se devuelve la oferta sola: una persona mira por qué, y si la pasarela sí la tomó,
    // reintentar la aplicaría dos veces en MP).
    await runWithWorkspace(ws, () => setSetting(CLAVE_RETENCION, JSON.stringify({ ...marca, estado: 'error', error: error!.slice(0, 200) })));
    console.error(`[retencion] ws=${ws} cobro ${c.id}: ${error}`);
    return { ok: false, resumen: 'No pudimos aplicar el descuento. Escríbenos y lo resolvemos.' };
  }
  await runWithWorkspace(ws, () => setSetting(CLAVE_RETENCION, JSON.stringify({ ...marca, estado: 'aplicada', restaurada: c.proveedor === 'stripe' })));
  if (c.lead_id) {
    await runWithWorkspace(plataforma, () => logLeadEvent(c.lead_id!, 'Retención', `Iba a darse de baja y aceptó ${RETENCION.pct}% por ${RETENCION.meses} meses (${autor}).`, autor)).catch(() => {});
  }
  return { ok: true, resumen: `Listo: los próximos ${RETENCION.meses} meses pagas la mitad.` };
}

/**
 * Mercado Pago no vuelve solo al precio de lista: cuando ya se cobraron las cuotas con descuento, se restaura. Lo llama
 * el cron de la pasarela. Idempotente (PUT con el monto de lista, marcado `restaurada`). Nunca tira.
 */
export async function restaurarRetencionesMp(): Promise<{ restauradas: number }> {
  let restauradas = 0;
  try {
    const db = getSupabaseServer();
    const { data } = await db.from('app_settings').select('workspace_id, value').eq('key', CLAVE_RETENCION).like('value', '%"pasarela":"mercadopago"%').limit(200);
    const plataforma = await wsSuperAdmin();
    const token = await credDelCliente('MERCADOPAGO_ACCESS_TOKEN', plataforma);
    if (!token) return { restauradas };
    for (const fila of (data ?? []) as Array<{ workspace_id: number; value: string }>) {
      const g = leer(fila.value);
      if (!g || g.estado !== 'aplicada' || g.restaurada) continue;
      // Cuotas cobradas de ese cobro DESPUÉS de aceptar: cuando llegan a los meses del descuento, vuelve el de lista.
      const { count } = await db.from('pagos').select('id', { count: 'exact', head: true })
        .eq('workspace_id', plataforma).eq('cobro_id', g.cobroId).eq('pagado', true).gt('fecha_pago', g.aplicadaAt.slice(0, 10)); // gt: la cuota del mismo día pudo cobrarse a precio de lista
      if ((count ?? 0) < g.meses) continue;
      const { data: c } = await db.from('cobros').select('proveedor_suscripcion_id, proveedor_ref, suscripcion_estado').eq('id', g.cobroId).maybeSingle();
      const cc = c as { proveedor_suscripcion_id: string | null; proveedor_ref: string | null; suscripcion_estado: string | null } | null;
      const id = cc?.proveedor_suscripcion_id ?? cc?.proveedor_ref;
      if (!id || cc?.suscripcion_estado === 'cancelada') { await runWithWorkspace(fila.workspace_id, () => setSetting(CLAVE_RETENCION, JSON.stringify({ ...g, restaurada: true }))); continue; }
      const r = await montoSuscripcionMp(token, id, g.montoOriginal, `mako-retencion-fin-${g.cobroId}`);
      if (!r.ok) { console.error(`[retencion] no pude volver al precio de lista el cobro ${g.cobroId}: ${r.error}`); continue; }
      await runWithWorkspace(fila.workspace_id, () => setSetting(CLAVE_RETENCION, JSON.stringify({ ...g, restaurada: true })));
      restauradas++;
    }
  } catch (e) {
    console.error('[retencion] restaurar MP:', e instanceof Error ? e.message : String(e));
  }
  return { restauradas };
}
