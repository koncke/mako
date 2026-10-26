// =============================================================================
// empezar-plan — «Empezar mi plan ya»: terminar la prueba gratis antes y pagar desde hoy (25/10/2026)
// =============================================================================
// El Cerebro (25/10): al llegar a un tope de la prueba, «un botón para empezar ya el plan». Mercado Pago no documenta mover
// el `start_date` de una suscripción ya autorizada, así que no se adelanta la prueba: se abre una suscripción NUEVA, sin
// prueba, atada a SU negocio (`alta_ws`), y la prueba se CANCELA recién cuando esa nueva se cobra
// (`cerrarPruebaAlEmpezarYa`, lib/cobros.ts). Si la persona abre el link y no paga, su prueba sigue como estaba.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { logLeadEvent } from './leads';
import { crearCobro, inicioDeLaPrueba, linkDelCobro, suscripcionDeMakoDe } from './cobros';
import { COLS_COBRO, cobroDeFila } from './cobros-tipos';
import { creadoPorEmpezarYa, esPruebaDePlan } from './prueba-plan-reglas';

const DIA_MS = 86_400_000;

export type ResultadoEmpezar = { ok: true; link: string } | { ok: false; resumen: string };

/** Abre el pago del plan desde hoy para un negocio EN PRUEBA. `autor`: quien lo pidió (al historial del lead). */
export async function empezarPlanAhora(ws: number, autor: string, ahoraMs: number = Date.now()): Promise<ResultadoEmpezar> {
  const plataforma = await wsSuperAdmin();
  if (ws === plataforma) return { ok: false, resumen: 'La cuenta de MaKo no tiene plan.' };
  const prueba = await suscripcionDeMakoDe(ws).catch(() => null);
  if (!prueba || !esPruebaDePlan(prueba) || prueba.estado !== 'pendiente') return { ok: false, resumen: 'Tu plan no está en prueba: ya se cobra solo.' };
  if (prueba.suscripcion_estado !== 'activa') return { ok: false, resumen: 'Tu prueba está dada de baja: para seguir, elige tu plan en /planes.' };
  if (!prueba.lead_id || !prueba.email) return { ok: false, resumen: 'No pudimos abrir el pago. Escríbenos y lo activamos.' };
  // A menos de un día del cobro no hace falta: Mercado Pago cobra solo, y dos cobros del mismo mes serían uno de más.
  const inicio = await inicioDeLaPrueba(prueba).catch(() => null);
  if (inicio && Date.parse(inicio) - ahoraMs < DIA_MS) return { ok: false, resumen: 'Tu prueba termina mañana y el cobro es automático: no hace falta hacer nada.' };

  const creadoPor = creadoPorEmpezarYa(prueba.id);
  const db = getSupabaseServer();
  // Un link que ya abrió y no pagó (en el último día) se devuelve el mismo: no se abren dos.
  const desde = new Date(ahoraMs - 23 * 3600_000).toISOString();
  const { data: vivo } = await db.from('cobros').select(COLS_COBRO).eq('workspace_id', plataforma).eq('alta_ws', ws)
    .eq('creado_por', creadoPor).eq('estado', 'pendiente').gte('created_at', desde).order('id', { ascending: false }).limit(1).maybeSingle();
  if (vivo) return { ok: true, link: linkDelCobro(cobroDeFila(vivo as Record<string, unknown>).token) };

  return runWithWorkspace(plataforma, async () => {
    const r = await crearCobro(plataforma, {
      leadId: prueba.lead_id!, pasarela: prueba.proveedor, tipo: 'suscripcion', concepto: prueba.concepto,
      monto: prueba.monto, moneda: prueba.moneda, montoUsd: prueba.monto_usd, email: prueba.email, nombre: prueba.nombre, creadoPor,
    });
    if (!r.ok) {
      console.error(`[empezar-plan] ws=${ws}: ${r.error}`);
      return { ok: false, resumen: 'No pudimos abrir el pago. Prueba otra vez en un minuto.' };
    }
    // ⚠️ ATADO A SU NEGOCIO ANTES DE DEVOLVER EL LINK (como reactivar): sin `alta_ws`, el pago no sería de este negocio.
    // ⚠️ Y CON EL CÓDIGO DEL PARTNER DE LA PRUEBA (25/10/2026, revisión del tren): al cobrarse éste, la prueba queda 'anulado'
    // y `acreditarReferidos` (lib/partners-programa.ts) sólo lee cobros pagados con `ref_codigo`; sin copiarlo, el partner que
    // trajo al negocio no cobraba nunca. Sólo si la prueba CREÓ la cuenta (alta 'hecha'): el programa es para clientes nuevos.
    // A éste NO se le marca `alta_estado` 'hecha' (le habilitaría el cambio de email del acceso, /api/pagar/email): el
    // programa lo reconoce por su `creado_por` (empezar-ya:<prueba>).
    const { data: conPlan } = await db.from('cobros').select('plan_mako, ref_codigo').eq('id', prueba.id).eq('workspace_id', plataforma).maybeSingle();
    const planMako = (conPlan as { plan_mako?: string | null } | null)?.plan_mako ?? null;
    const refCodigo = prueba.alta_estado === 'hecha' ? (conPlan as { ref_codigo?: string | null } | null)?.ref_codigo ?? null : null;
    const { error } = await db.from('cobros').update({ alta_ws: ws, ...(planMako ? { plan_mako: planMako } : {}), ...(refCodigo ? { ref_codigo: refCodigo } : {}) })
      .eq('id', r.cobro.id).eq('workspace_id', plataforma);
    if (error) {
      console.error(`[empezar-plan] ws=${ws}: no pude atar el cobro ${r.cobro.id}: ${error.message}`);
      return { ok: false, resumen: 'No pudimos abrir el pago. Prueba otra vez en un minuto.' };
    }
    await logLeadEvent(prueba.lead_id!, 'Compra de plan', `Pidió empezar su plan antes de terminar la prueba. Pedido por ${autor}.`, 'Checkout de MaKo').catch(() => {});
    return { ok: true, link: r.link };
  });
}
