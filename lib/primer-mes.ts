// =============================================================================
// primer-mes — Mercado Pago no vuelve solo al precio lleno después del 50% del primer mes (30/10/2026)
// =============================================================================
// Lo puro en lib/primer-mes-reglas.ts. Stripe vuelve solo (un cupón `once`). Mercado Pago no tiene un descuento de un solo cobro: la
// suscripción nace con el monto rebajado y hay que subirla antes del segundo cobro. Se intenta apenas entra el primer pago
// (`volverAlPrecioLleno`, desde lib/cobros.ts) y el cron lo reintenta (`conciliarPrimerMes`, app/api/cron/cobros-reconciliar),
// porque si esa llamada se pierde, el segundo mes se cobra a mitad de precio y nadie lo ve.
// ⚠️ Sin medir con claves de verdad, como `montoSuscripcionMp` (lib/pasarela-plan-api.ts): falta un cobro real.
// ⚠️ NO pisa una retención: quien aceptó «2 meses al 50%» antes de darse de baja tiene su monto rebajado a propósito.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { wsSuperAdmin } from './workspace';
import { credDelCliente } from './credenciales';
import { avisarDePlataforma } from './invitaciones';
import { EMAIL_MAKO } from './app-url';
import { montoSuscripcionMp, suscripcionMpDetalle } from './pasarela-plan-api';
import { CLAVE_RETENCION } from './retencion-reglas';
import { pctDelPrimerMes } from './primer-mes-reglas';

const DIA_MS = 86_400_000;
/** Hasta cuándo se sigue mirando un cobro: pasado el segundo mes y un poco, ya no hay primer mes que arreglar. */
const DIAS_QUE_SE_MIRA = 45;

type CobroMp = { id: number; monto: number; moneda: string; creado_por: string | null; proveedor_suscripcion_id: string | null; proveedor_ref: string | null; alta_ws: number | null };
const idDeLaSuscripcion = (c: Pick<CobroMp, 'proveedor_suscripcion_id' | 'proveedor_ref'>) => c.proveedor_suscripcion_id ?? c.proveedor_ref;

/** Le pone a la suscripción de Mercado Pago el precio de lista. Tira si no se pudo: quien llama decide. */
export async function volverAlPrecioLleno(c: CobroMp, sufijoIdem = ''): Promise<void> {
  const token = await credDelCliente('MERCADOPAGO_ACCESS_TOKEN', await wsSuperAdmin());
  const id = idDeLaSuscripcion(c);
  if (!token || !id) throw new Error('Mercado Pago no está conectado o el cobro no tiene suscripción');
  const r = await montoSuscripcionMp(token, id, Number(c.monto), `mako-primer-mes-fin-${c.id}${sufijoIdem}`);
  if (!r.ok) throw new Error(r.error);
}

/**
 * La vuelta del cron: las suscripciones de Mercado Pago con el 50% del primer mes que siguen cobrando menos que su precio. Si no
 * se puede, le avisa a Martín, porque el próximo cobro saldría a mitad de precio. Nunca tira.
 */
export async function conciliarPrimerMes(ahoraMs: number = Date.now()): Promise<{ revisados: number; restaurados: number; errores: number }> {
  const out = { revisados: 0, restaurados: 0, errores: 0 };
  try {
    const plataforma = await wsSuperAdmin();
    const db = getSupabaseServer();
    const { data, error } = await db.from('cobros').select('id, monto, moneda, creado_por, proveedor_suscripcion_id, proveedor_ref, alta_ws')
      .eq('workspace_id', plataforma).eq('tipo', 'suscripcion').eq('proveedor', 'mercadopago').eq('estado', 'pagado').eq('suscripcion_estado', 'activa')
      .like('creado_por', 'planes:%:primer-mes-%').gte('pagado_at', new Date(ahoraMs - DIAS_QUE_SE_MIRA * DIA_MS).toISOString()).limit(200);
    if (error) throw new Error(error.message);
    const cobros = ((data ?? []) as CobroMp[]).filter((c) => pctDelPrimerMes(c.creado_por) != null);
    if (!cobros.length) return out;
    const token = await credDelCliente('MERCADOPAGO_ACCESS_TOKEN', plataforma);
    if (!token) throw new Error('Mercado Pago no está conectado');
    for (const c of cobros) {
      out.revisados++;
      const id = idDeLaSuscripcion(c);
      try {
        if (!id) throw new Error('el cobro no tiene suscripción');
        if (c.alta_ws != null) {
          const { data: ret } = await db.from('app_settings').select('value').eq('workspace_id', c.alta_ws).eq('key', CLAVE_RETENCION).maybeSingle();
          if (ret) continue;
        }
        const d = await suscripcionMpDetalle(token, id);
        if (!d.ok) throw new Error(d.error);
        if (d.monto == null || d.monto >= Number(c.monto) - 0.01) continue;
        await volverAlPrecioLleno(c, `-${new Date(ahoraMs).toISOString().slice(0, 10)}`);
        out.restaurados++;
      } catch (e) {
        out.errores++;
        const motivo = e instanceof Error ? e.message : String(e);
        console.error(`[primer-mes] no pude volver al precio lleno el cobro ${c.id}: ${motivo}`);
        await avisarDePlataforma({
          to: EMAIL_MAKO, tag: 'primer-mes-precio', asunto: 'Una suscripción sigue con el precio del primer mes',
          preheader: 'El próximo cobro saldría a mitad de precio.',
          cuerpo: `La suscripción del cobro ${c.id} en Mercado Pago sigue con el 50% del primer mes y no pude volverla al precio de lista: ${motivo}.\nSi no se arregla, el próximo cobro sale a mitad de precio. Lo reintento en la próxima vuelta.`,
        }).catch(() => {});
      }
    }
  } catch (e) {
    out.errores++;
    console.error('[primer-mes] la vuelta falló:', e instanceof Error ? e.message : String(e));
  }
  return out;
}
