// =============================================================================
// Webhook: Stripe → los pagos de los cobros de MaKo entran al CRM
// =============================================================================
// Cada negocio conecta SU cuenta de Stripe pegando su clave (BYOK, decisión de Martín del 11/10/2026)
// y MaKo le registra este webhook con `?acct=<acct_…>` (lib/stripe-api.ts, asegurarWebhookStripe).
// Sin Stripe Connect el evento NO trae de qué cuenta es (`event.account` sólo existe con Connect):
// lo único que lo dice es ese `?acct=`, y lo único que lo PRUEBA es la firma con el secreto de ESE
// negocio. El contrato: docs/diseno-pasarela-pagos.md §4.5 «Webhook de Stripe».
//
// El orden, y cada paso tiene su porqué:
//   1. EL CUERPO CRUDO (`req.text()`), antes de parsear nada: la firma es sobre esos bytes.
//   2. DE QUIÉN ES, ESTRICTO: `?acct=` (≤64, [A-Za-z0-9_]) → `wsPorIdentificadorEstricto('stripe', …)`
//      → el secreto de ESE workspace con `credWsEstricta`. «No pude leer» no es «no es de nadie»: va
//      por `responderFalloDeRuteo` (503 si reintentar lo arregla, y anotado en el super admin).
//   3. LA FIRMA (`Stripe-Signature`, lib/pasarela-firma.ts: el `whsec_` TAL CUAL, cualquier `v1`).
//      ANTES de contestar «sin workspace»: si se cortara antes, 200 = «no es cliente» y 401 = «sí» y
//      se podría enumerar la cartera. Sin workspace no hay secreto, y eso ya es un 401.
//   4. UNA VEZ POR EVENTO: el `event.id` se reclama en `pasarela_eventos` (lib/pasarela-eventos.ts)
//      ANTES de aplicar. Stripe entrega «al menos una vez» y reintenta hasta 3 días.
//   5. EL COBRO Y LA RELECTURA (lib/cobros-webhook.ts) adentro de `runWithWorkspace(ws, …)`: sin el
//      contexto, getTenantDb y logLeadEvent caen al ws1 (Mauricio, un cliente).
//
// ⚠️ 5xx SÓLO A LO TRANSITORIO (AGENTS.md «Una integracion son TRES registros»): lo que falla igual
// en el próximo intento va 200 con el motivo en la fila de `pasarela_eventos`. Stripe reintenta un
// no-2xx durante 3 días y le manda mails al dueño de la cuenta: un evento que falla siempre sólo
// llenaría eso. La red de seguridad de lo que no entra es el cron de reconciliación
// (app/api/cron/cobros-reconciliar).
//
// ⚠️ EL TIEMPO: Stripe espera hasta 10 s la respuesta de `checkout.session.completed` antes de
// devolver al comprador a /pagar/<token>/listo. Lo rápido se contesta adentro del pedido (y si falla
// transitorio, 503 y Stripe reintenta); si pasa del tope —el alta de una cuenta de MaKo, un Stripe
// lento—, se contesta 200 y lo que falta sigue en `after()`, con el workspace fijado OTRA vez adentro.

import { after, type NextRequest } from 'next/server';
import { wsPorIdentificadorEstricto } from '@/lib/webhook-routing';
import { credWsEstricta } from '@/lib/credenciales';
import { responderFalloDeRuteo } from '@/lib/webhook-fallo-ruteo';
import { verificarFirmaStripe, MOTIVO_FIRMA_PASARELA } from '@/lib/pasarela-firma';
import { runWithWorkspace } from '@/lib/workspace';
import { esErrorTransitorio, mensajeDeError } from '@/lib/calendly-error';
import { acctDelWebhook, conPresupuesto, eventoStripe, motivoSinDatos } from '@/lib/cobros-eventos';
import { cerrarAlTerminar, marcarEvento, reclamarEvento } from '@/lib/pasarela-eventos';
import { procesarEventoStripe } from '@/lib/cobros-webhook';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Debajo de los 10 s que Stripe espera en `checkout.session.completed`. */
const PRESUPUESTO_MS = 8_000;

/** Un fallo de proceso: 503 SÓLO si reintentar lo arregla; si no, 200 y el motivo queda en la fila. */
function responderFallo(donde: string, e: unknown): Response {
  const motivo = motivoSinDatos(mensajeDeError(e));
  if (esErrorTransitorio(e)) {
    console.error(`[webhook:stripe] ${donde} (TRANSITORIO) → 503: ${motivo}`);
    return Response.json({ ok: false, error: donde, reintentar: true }, { status: 503 });
  }
  console.error(`[webhook:stripe] ${donde} → 200, reintentar no lo arregla: ${motivo}`);
  return Response.json({ ok: false, error: donde, reintentar: false, motivo });
}

export async function GET() {
  return Response.json({ ok: true, endpoint: 'stripe webhook', usage: 'POST con Stripe-Signature y ?acct=' });
}

export async function POST(req: NextRequest) {
  // ── 1. El cuerpo crudo ──
  const raw = await req.text();
  const acct = acctDelWebhook(req.nextUrl.searchParams.get('acct'));

  // ── 2. De quién es: ESTRICTO ──
  let ws: number | null = null;
  let secreto: string | null = null;
  try {
    ws = acct ? await wsPorIdentificadorEstricto('stripe', acct) : null;
    secreto = ws == null ? null : await credWsEstricta('STRIPE_WEBHOOK_SECRET', ws);
  } catch (err) {
    return responderFalloDeRuteo('stripe', err, acct);
  }

  // ── 3. La firma, con el secreto de ESE negocio, antes de decir «no te conozco» ──
  const fallo = verificarFirmaStripe(raw, req.headers.get('stripe-signature'), secreto);
  if (fallo) {
    console.warn(`[webhook:stripe] firma rechazada (acct ${acct ?? '—'}, ws ${ws ?? '—'}): ${MOTIVO_FIRMA_PASARELA[fallo]}`);
    // La MISMA respuesta para todo rechazo: con el motivo en el cuerpo, «sin-secreto» (cuenta desconocida)
    // contra «no-coincide» (cuenta conocida) dejaba saber qué cuentas de Stripe son clientes de MaKo.
    return Response.json({ ok: false, error: 'signature' }, { status: 401 });
  }
  if (ws == null) {
    // Sin workspace no hay secreto, y sin secreto la firma ya rechazó: esto queda por si eso cambia.
    console.warn(`[webhook:stripe] sin workspace para acct ${acct ?? '—'}: ignorado`);
    return Response.json({ ok: true, ignorado: 'sin workspace' });
  }
  const wsFinal = ws;

  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(raw);
  } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }
  const ev = eventoStripe(cuerpo);
  if (!ev) {
    console.warn(`[webhook:stripe] ws ${wsFinal}: el cuerpo firmado no es un evento de Stripe`);
    return Response.json({ ok: true, ignorado: 'no es un evento' });
  }

  // ── 4. Una vez por evento, ANTES de aplicar ──
  const reclamo = await reclamarEvento({ proveedor: 'stripe', eventoId: ev.id, ws: wsFinal, tipo: ev.tipo });
  if (reclamo === 'sin_tabla') {
    // Sin la 0255 no hay cómo deduplicar (ni cobros que aplicar: viven en la misma migración).
    console.error('[webhook:stripe] falta la tabla pasarela_eventos (mig 0255): no se aplica nada sin poder deduplicar');
    return Response.json({ ok: false, error: 'sin_tabla' });
  }
  if (reclamo === 'duplicado') return Response.json({ ok: true, evento: ev.tipo, duplicado: true });
  if (typeof reclamo === 'object') return responderFallo('registro', reclamo.error);

  // ── 5. El cobro, la relectura y el CRM, adentro de SU workspace ──
  const trabajo = runWithWorkspace(wsFinal, () => procesarEventoStripe(wsFinal, ev));
  try {
    const r = await conPresupuesto(trabajo, PRESUPUESTO_MS);
    if (!r.listo) {
      // `after` corre FUERA del contexto del pedido: el workspace se vuelve a fijar adentro.
      after(() => runWithWorkspace(wsFinal, () => cerrarAlTerminar('stripe', ev.id, trabajo)));
      console.warn(`[webhook:stripe] ${ev.tipo} ${ev.id} ws=${wsFinal}: pasó de ${PRESUPUESTO_MS} ms, sigue en segundo plano`);
      return Response.json({ ok: true, evento: ev.tipo, enCurso: true });
    }
    await marcarEvento('stripe', ev.id, r.valor);
    console.log(`[webhook:stripe] ${ev.tipo} ${ev.id} ws=${wsFinal}: ${r.valor.estado}${r.valor.motivo ? ` (${r.valor.motivo})` : ''}`);
    return Response.json({ ok: true, evento: ev.tipo, estado: r.valor.estado, motivo: r.valor.motivo });
  } catch (e) {
    // La fila queda en `error`: el reintento de Stripe (si fue transitorio) la vuelve a reclamar.
    await marcarEvento('stripe', ev.id, { estado: 'error', motivo: mensajeDeError(e) });
    return responderFallo('proceso', e);
  }
}
