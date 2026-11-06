// =============================================================================
// Cron: la red de seguridad de los cobros (Stripe y Mercado Pago), cada 30 minutos
// =============================================================================
// Los webhooks (app/api/webhooks/stripe y app/api/webhooks/mercadopago) son el camino rápido, y un
// aviso se puede perder: un deploy en el medio, un 200 que se contestó porque reintentar no lo
// arreglaba, lo que siguió en `after()` y se murió. Y hay un caso en que el aviso NO EXISTE: Mercado
// Pago no manda notificaciones a la notification_url de un pago de PRUEBA, así que probar el flujo
// entero depende de esto. El cron relee al proveedor los cobros pendientes de los últimos días y
// aplica lo que la pasarela ya confirmó, y reintenta las altas de MaKo que quedaron en error
// (`reconciliarCobros`, lib/cobros.ts: idempotente, repasar no duplica nada). Y una vez por día (la vuelta de las 06:17
// UTC) pone al día los eventos del aviso de Stripe de cada negocio (`mantenerAvisosStripe`, 15/10/2026).
//
// Molde: app/api/cron/meta-leads-poll (la red de seguridad del webhook de Meta).
//
// QUIÉNES: los workspaces con una pasarela conectada (`workspacesConPasarela`, que lee las filas de
// ruteo 'stripe' y 'mercadopago'), cada uno adentro de SU `runWithWorkspace`: sin el contexto,
// getTenantDb y logLeadEvent caen al ws1 (Mauricio, un cliente). Uno que falla no corta al resto.
//
// vercel.json: `17,47 * * * *` (cada 30 minutos, corrido de los demás crons de media hora).
// Auth: Bearer ${CRON_SECRET} (lib/cron-auth.ts).

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { runWithWorkspace } from '@/lib/workspace';
import { asegurarPlazosCreem, cobradoEnLaPasarela, getCobro, mantenerAvisosCreem, mantenerAvisosStripe, reconciliarCobros, renovacionesPerdidasStripe, workspacesConPasarela } from '@/lib/cobros';
import { despacharPendientes, recibosQueFaltan } from '@/lib/recibos';
import { esLaVueltaDelDia } from '@/lib/cobros-reglas';
import { renovacionesDeAgencia } from '@/lib/agencia-cobro';
import { aplicarSubidasPendientes } from '@/lib/agencia-plan';
import { revisarAccesosPorPago } from '@/lib/plan-acceso';
import { conciliarRetenciones } from '@/lib/retencion-plan';
import { conciliarPrimerMes } from '@/lib/primer-mes';
import { acreditarReferidos } from '@/lib/partners-programa';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** No se arranca un workspace nuevo si quedan menos de esto: uno lento no puede pasar el maxDuration. */
const RESERVA_MS = 60_000;

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

type Resultado = { ws: number; ok: boolean; revisados?: number; cambiados?: number; errores?: number; error?: string };

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  const t0 = Date.now();

  let workspaces: number[];
  try {
    workspaces = (await workspacesConPasarela()).sort((a, b) => a - b);
  } catch (e) {
    console.error('[cron:cobros-reconciliar] no pude leer los workspaces con pasarela:', msg(e));
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }

  // El orden ROTA cada media hora: si uno lento se come la corrida, la próxima arranca por otro y
  // nadie queda sin turno para siempre. Los que no entran salen en `sinTurno` (no se pierden en silencio).
  const giro = workspaces.length ? Math.floor(t0 / 1_800_000) % workspaces.length : 0;
  const orden = [...workspaces.slice(giro), ...workspaces.slice(0, giro)];

  // Una vez por día, además, los avisos de Stripe se ponen al día con los eventos de HOY (los contracargos llegan sin
  // que MaKo haga nada; un aviso registrado antes de sumarlos no los escucharía). Best effort: nunca corta la corrida.
  const delDia = esLaVueltaDelDia(t0);
  // LA RETENCIÓN (23/10/2026, lib/retencion-plan.ts): conciliar las marcas trabadas, la capa de «bajar» y lo que MP no
  // restaura solo. AL PRINCIPIO (segunda revisión, R9): al final se la comía la vuelta de los workspaces. Nunca tira.
  const retencion = await conciliarRetenciones();
  if (retencion.conciliadas || retencion.liberadas || retencion.capas || retencion.restauradas) console.log(`[cron:cobros-reconciliar] retención: ${JSON.stringify(retencion)}`);
  // EL 50% DEL PRIMER MES en Mercado Pago (30/10/2026): si no volvió al precio de lista, el próximo cobro sale a mitad. Nunca tira.
  const primerMes = await conciliarPrimerMes();
  if (primerMes.restaurados || primerMes.errores) console.log(`[cron:cobros-reconciliar] primer mes: ${JSON.stringify(primerMes)}`);
  const resultados: Resultado[] = [];
  const sinTurno: number[] = [];
  for (const ws of orden) {
    if (Date.now() - t0 > maxDuration * 1000 - RESERVA_MS) { sinTurno.push(ws); continue; }
    try {
      // Con su propio límite (28/10/2026): uno con cientos de pruebas no se come la corrida ni lo que va después (agencia, accesos,
      // Partners); lo que no entró sigue en la próxima.
      const r = await runWithWorkspace(ws, () => reconciliarCobros(ws, { hasta: t0 + maxDuration * 1000 - 2 * RESERVA_MS }));
      resultados.push({ ws, ok: true, ...r });
      if (delDia) await runWithWorkspace(ws, () => mantenerAvisosStripe(ws)).catch((e) => console.warn(`[cron:cobros-reconciliar] ws=${ws} avisos de Stripe:`, msg(e)));
      // Las renovaciones de Stripe cuyo `invoice.paid` se perdió (6/11/2026, lib/cobros.ts): una vez por día, con la misma reserva.
      if (delDia) await runWithWorkspace(ws, () => renovacionesPerdidasStripe(ws, { hasta: t0 + maxDuration * 1000 - 2 * RESERVA_MS })).catch((e) => console.warn(`[cron:cobros-reconciliar] ws=${ws} renovaciones de Stripe:`, msg(e)));
      await runWithWorkspace(ws, () => mantenerAvisosCreem(ws)).catch((e) => console.warn(`[cron:cobros-reconciliar] ws=${ws} avisos de Creem:`, msg(e)));
      if (delDia) await runWithWorkspace(ws, () => asegurarPlazosCreem(ws)).catch((e) => console.warn(`[cron:cobros-reconciliar] ws=${ws} plazos de Creem:`, msg(e)));
      if (r.cambiados || r.errores) {
        console.log(`[cron:cobros-reconciliar] ws=${ws} revisados=${r.revisados} cambiados=${r.cambiados} errores=${r.errores}`);
      }
    } catch (e) {
      console.error(`[cron:cobros-reconciliar] ws=${ws} falló:`, msg(e));
      resultados.push({ ws, ok: false, error: msg(e) });
    }
  }
  if (sinTurno.length) console.warn(`[cron:cobros-reconciliar] sin turno en esta corrida: ${sinTurno.join(', ')}`);

  // LOS CLIENTES DE AGENCIA (#867, 17/10/2026): al terminar el onboarding, la suscripción mensual que empieza a cobrar un
  // mes después; y las que la agencia ya autorizó. Una vez por corrida, después de los workspaces y con su reserva. Nunca
  // corta la respuesta: sin la migración 0308 (o sin la Mercado Pago de MaKo) lo dice y sigue.
  let agencia: Awaited<ReturnType<typeof renovacionesDeAgencia>> | { error: string } | null = null;
  if (Date.now() - t0 < maxDuration * 1000 - RESERVA_MS) {
    agencia = await renovacionesDeAgencia().catch((e) => ({ error: msg(e) }));
    if ('error' in agencia) console.warn('[cron:cobros-reconciliar] clientes de agencia:', agencia.error);
    else if (agencia.creadas || agencia.autorizadas || agencia.errores) console.log(`[cron:cobros-reconciliar] clientes de agencia: ${JSON.stringify(agencia)}`);
    // La subida a Pro que no se cobró en el acto (29/10/2026, lib/agencia-plan.ts): la capa sube con el primer pago a precio de Pro.
    const subidas = await aplicarSubidasPendientes().catch((e) => ({ subidas: 0, errores: 1, error: msg(e) }));
    if (subidas.subidas || subidas.errores) console.log(`[cron:cobros-reconciliar] subidas a Pro de clientes de agencia: ${JSON.stringify(subidas)}`);
  }

  // LOS RECIBOS (5/11/2026, lib/recibos.ts): la red. Emite los pagos de la plataforma que quedaron sin recibo (el monto se relee a la
  // pasarela) y manda lo que quedó pendiente. Después de la agencia, con la misma reserva; nunca corta la respuesta. Sin la mig 0397,
  // no hace nada.
  let recibos: { emitidos: number; errores: number; despachados: number; devoluciones: number } | { error: string } | null = null;
  if (Date.now() - t0 < maxDuration * 1000 - RESERVA_MS) {
    const hasta = t0 + maxDuration * 1000 - RESERVA_MS;
    recibos = await (async () => {
      const faltan = await recibosQueFaltan({ hasta, leerCobro: getCobro, releer: cobradoEnLaPasarela });
      const pendientes = await despacharPendientes({ hasta });
      return { emitidos: faltan.emitidos, errores: faltan.errores, ...pendientes };
    })().catch((e) => ({ error: msg(e) }));
    if ('error' in recibos) console.warn('[cron:cobros-reconciliar] recibos:', recibos.error);
    else if (recibos.emitidos || recibos.errores || recibos.despachados || recibos.devoluciones) console.log(`[cron:cobros-reconciliar] recibos: ${JSON.stringify(recibos)}`);
  }

  // QUIEN DEJA DE PAGAR SU LUGAR DEJA DE ENTRAR (17/10/2026, lib/plan-acceso.ts): DESPUÉS de reconciliar, para decidir con
  // los pagos ya asentados. Sólo negocios con un cobro de la plataforma; con tope por corrida; nunca corta la respuesta.
  let accesos: Awaited<ReturnType<typeof revisarAccesosPorPago>> | { error: string } | null = null;
  if (Date.now() - t0 < maxDuration * 1000 - RESERVA_MS) {
    accesos = await revisarAccesosPorPago().catch((e) => ({ error: msg(e) }));
    if ('error' in accesos) console.warn('[cron:cobros-reconciliar] accesos por pago:', accesos.error);
    else if (accesos.cortados.length || accesos.reabiertos.length || accesos.soltados.length || accesos.postergados.length || accesos.errores) {
      console.log(`[cron:cobros-reconciliar] accesos por pago: ${JSON.stringify({ ...accesos, pasos: undefined })}`);
    }
  }


  // MAKO PARTNERS (23/10/2026, lib/partners-programa.ts): el referido queda en su negocio con sus dos bienvenidas, y con su
  // 2º mes pagado, lo que gana el partner: el 100% de su primer mes (una sola vez: el índice único de partner_creditos). Nunca tira.
  const partners = Date.now() - t0 < maxDuration * 1000 - RESERVA_MS ? await acreditarReferidos().catch((e) => ({ error: msg(e) })) : null;
  if (partners && 'acreditados' in partners && (partners.atados || partners.acreditados)) console.log(`[cron:cobros-reconciliar] MaKo Partners: ${JSON.stringify(partners)}`);

  return Response.json({ ok: true, workspaces: resultados, sinTurno, agencia, recibos, accesos, retencion, partners, ms: Date.now() - t0 });
}
