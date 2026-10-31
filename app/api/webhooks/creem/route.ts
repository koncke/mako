// =============================================================================
// Webhook: Creem → los pagos de los cobros de MaKo entran al CRM
// =============================================================================
// Cada negocio conecta SU cuenta de Creem pegando su clave (BYOK, como Stripe y Mercado Pago) y MaKo
// le registra este webhook (lib/creem-api.ts, `asegurarWebhookCreem`), que le devuelve el SECRETO con
// el que se verifica cada aviso. El contrato: docs/diseno-pasarela-pagos.md §4.5.
//
// ⚠️ DE QUIÉN ES UN AVISO DE CREEM: el `?w=<wh_…>`. Y acá está la diferencia incómoda con las otras
// dos pasarelas: Creem NO tiene un endpoint que diga de qué cuenta es una clave (Stripe tiene
// `GET /v1/account` → `acct_…`; Mercado Pago `GET /users/me` → `user_id`), y el cuerpo del evento no
// trae ningún id de comerciante. Así que el identificador de ruteo es el id del ENDPOINT DE AVISO que
// MaKo registró en esa cuenta: es estable, es de esa cuenta, y sólo lo conoce quien tiene la clave.
// Lo que PRUEBA de quién es sigue siendo la firma con el secreto de ESE negocio.
//
// El orden, y cada paso tiene su porqué:
//   1. EL CUERPO CRUDO (`req.text()`), antes de parsear nada: la firma es sobre esos bytes exactos.
//      ⚠️ El ejemplo oficial de la doc de Creem arma el mensaje con `JSON.stringify(req.body)`, y eso
//      ROMPE la verificación en cuanto el cuerpo trae un nombre con acento (re-serializar cambia
//      bytes). No se copia: se firma el crudo.
//   2. DE QUIÉN ES, ESTRICTO: `?w=` → `wsPorIdentificadorEstricto('creem', …)` → el secreto de ESE
//      workspace con `credWsEstricta`. «No pude leer» no es «no es de nadie»: va por
//      `responderFalloDeRuteo` (503 si reintentar lo arregla, y anotado en el super admin).
//   3. LA FIRMA — FAIL-CLOSED, y es una decisión, no un descuido. Sin secreto se RECHAZA.
//      El de Mercado Pago se relee igual sin firma, porque allá el aviso es flaco (un id) y la
//      seguridad real es la relectura obligatoria: un aviso falso sólo provoca una lectura. El de
//      Creem trae el objeto entero y el `eventType`, así que aceptar sin verificar sería dejar que
//      cualquiera POSTee un `subscription.paid` y se dé de alta un plan de MaKo gratis. Mientras no
//      esté el secreto, este endpoint no acepta NADA.
//      Va ANTES de contestar «sin workspace»: si se cortara antes, 200 = «no es cliente» y 401 =
//      «sí» y se podría enumerar la cartera.
//   4. UNA VEZ POR EVENTO: el `id` del evento (`evt_…`) se reclama en `pasarela_eventos` ANTES de
//      aplicar. Creem entrega más de una vez a propósito: 5 intentos (inicial + 30 s, 5 min, 30 min,
//      6 h) y nada después de 24 h.
//      ⚠️ Y el detalle que la doc aclara y que conviene no olvidar: los reintentos AUTOMÁTICOS
//      conservan el `id`, pero un reenvío A MANO desde el panel llega con un `id` NUEVO. O sea que
//      deduplicar por `id` no protege de un reenvío manual: lo que protege de verdad es que el estado
//      y la plata salgan de RELEER a Creem (lib/cobros-webhook.ts), que es idempotente.
//   5. EL COBRO Y LA RELECTURA adentro de `runWithWorkspace(ws, …)`: sin el contexto, getTenantDb y
//      logLeadEvent caen al ws1 (Mauricio, que es un cliente).
//
// ⚠️ 5xx SÓLO A LO TRANSITORIO. Creem espera hasta 15 s («a slower response counts as a failed
// attempt») y abandona a las 24 h: un evento que falla siempre sólo gastaría los 5 intentos y se
// perdería. Lo que no se arregla reintentando va 200 con el motivo en la fila de `pasarela_eventos`,
// y la red de lo que no entra es el cron (app/api/cron/cobros-reconciliar).
//
// ⚠️ Creem NO publica IPs fijas de origen («do not rely on source-IP allowlists»), y su doc avisa que
// el bot protection de Cloudflare rompe la entrega: «Bot Fight Mode cannot be skipped with custom
// rules». Si los avisos no llegan y la firma está bien, mirar ahí antes que acá.

import { after, type NextRequest } from 'next/server';
import { wsPorIdentificadorEstricto } from '@/lib/webhook-routing';
import { credWsEstricta } from '@/lib/credenciales';
import { claveDeCuenta } from '@/lib/cuentas-integracion';
import { cuentaDeIdentificador } from '@/lib/cuentas-pago-server';
import { responderFalloDeRuteo } from '@/lib/webhook-fallo-ruteo';
import { verificarFirmaCreem, MOTIVO_FIRMA_PASARELA } from '@/lib/pasarela-firma';
import { runWithWorkspace } from '@/lib/workspace';
import { esErrorTransitorio, mensajeDeError } from '@/lib/calendly-error';
import { conPresupuesto, eventoCreem, motivoSinDatos } from '@/lib/cobros-eventos';
import { cerrarAlTerminar, marcarEvento, reclamarEvento } from '@/lib/pasarela-eventos';
import { procesarEventoCreem } from '@/lib/cobros-webhook';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Bien debajo de los 15 s que Creem espera antes de contar el intento como fallido. */
const PRESUPUESTO_MS = 12_000;

/** El id del endpoint de aviso que rutea (`wh_…`), acotado como el `?acct=` de Stripe. */
function webhookDelAviso(v: string | null): string | null {
  const s = (v ?? '').trim();
  return s && s.length <= 64 && /^[A-Za-z0-9_-]+$/.test(s) ? s : null;
}

/** Un fallo de proceso: 503 SÓLO si reintentar lo arregla; si no, 200 y el motivo queda en la fila. */
function responderFallo(donde: string, e: unknown): Response {
  const motivo = motivoSinDatos(mensajeDeError(e));
  if (esErrorTransitorio(e)) {
    console.error(`[webhook:creem] ${donde} (TRANSITORIO) → 503: ${motivo}`);
    return Response.json({ ok: false, error: donde, reintentar: true }, { status: 503 });
  }
  console.error(`[webhook:creem] ${donde} → 200, reintentar no lo arregla: ${motivo}`);
  return Response.json({ ok: false, error: donde, reintentar: false, motivo });
}

export async function GET() {
  return Response.json({ ok: true, endpoint: 'creem webhook', usage: 'POST con creem-signature y ?w=' });
}

export async function POST(req: NextRequest) {
  // ── 1. El cuerpo crudo: la firma es sobre estos bytes ──
  const raw = await req.text();
  const wh = webhookDelAviso(req.nextUrl.searchParams.get('w'));

  // ── 2. De quién es: ESTRICTO ──
  let ws: number | null = null;
  let secreto: string | null = null;
  // La CUENTA del negocio que manda el aviso (varias por proveedor, mig 0328): su `wh_…` dice cuál, y con ella el
  // secreto que verifica la firma y la clave que relee.
  let cuenta: string | null = null;
  try {
    ws = wh ? await wsPorIdentificadorEstricto('creem', wh) : null;
    cuenta = ws == null ? null : await cuentaDeIdentificador(ws, 'creem', wh);
    secreto = ws == null || cuenta == null ? null : await credWsEstricta(claveDeCuenta('CREEM_WEBHOOK_SECRET', cuenta), ws);
  } catch (err) {
    return responderFalloDeRuteo('creem', err, wh);
  }

  // ── 3. La firma, FAIL-CLOSED, antes de decir «no te conozco» ──
  const fallo = verificarFirmaCreem(raw, req.headers.get('creem-signature'), secreto);
  if (fallo) {
    console.warn(`[webhook:creem] firma rechazada (w ${wh ?? '—'}, ws ${ws ?? '—'}): ${MOTIVO_FIRMA_PASARELA[fallo]}`);
    // La MISMA respuesta para todo rechazo: con el motivo en el cuerpo, «sin-secreto» (cuenta desconocida) contra
    // «no-coincide» (cuenta conocida) dejaba saber qué cuentas de Creem son clientes de MaKo.
    return Response.json({ ok: false, error: 'signature' }, { status: 401 });
  }
  if (ws == null) {
    // Sin workspace no hay secreto, y sin secreto la firma ya rechazó: esto queda por si eso cambia.
    console.warn(`[webhook:creem] sin workspace para w ${wh ?? '—'}: ignorado`);
    return Response.json({ ok: true, ignorado: 'sin workspace' });
  }
  const wsFinal = ws;

  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(raw);
  } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }
  const ev = eventoCreem(cuerpo);
  if (!ev) {
    console.warn(`[webhook:creem] ws ${wsFinal}: el cuerpo firmado no es un evento de Creem`);
    return Response.json({ ok: true, ignorado: 'no es un evento' });
  }

  // ── 4. Una vez por evento, ANTES de aplicar ──
  const reclamo = await reclamarEvento({ proveedor: 'creem', eventoId: ev.id, ws: wsFinal, tipo: ev.tipo });
  if (reclamo === 'sin_tabla') {
    // Sin la 0255 no hay cómo deduplicar, y sin la 0358 el CHECK de `proveedor` no deja entrar 'creem'.
    console.error('[webhook:creem] no pude dejar rastro en pasarela_eventos (migs 0255 y 0358): no se aplica nada sin poder deduplicar');
    return Response.json({ ok: false, error: 'sin_tabla' });
  }
  if (reclamo === 'duplicado') return Response.json({ ok: true, evento: ev.tipo, duplicado: true });
  if (typeof reclamo === 'object') return responderFallo('registro', reclamo.error);

  // ── 5. El cobro, la relectura y el CRM, adentro de SU workspace ──
  const cuentaFinal = cuenta ?? undefined;
  const trabajo = runWithWorkspace(wsFinal, () => procesarEventoCreem(wsFinal, ev, cuentaFinal, cuenta ? wh : null));
  try {
    const r = await conPresupuesto(trabajo, PRESUPUESTO_MS);
    if (!r.listo) {
      // `after` corre FUERA del contexto del pedido: el workspace se vuelve a fijar adentro.
      after(() => runWithWorkspace(wsFinal, () => cerrarAlTerminar('creem', ev.id, trabajo)));
      console.warn(`[webhook:creem] ${ev.tipo} ${ev.id} ws=${wsFinal}: pasó de ${PRESUPUESTO_MS} ms, sigue en segundo plano`);
      return Response.json({ ok: true, evento: ev.tipo, enCurso: true });
    }
    await marcarEvento('creem', ev.id, r.valor);
    console.log(`[webhook:creem] ${ev.tipo} ${ev.id} ws=${wsFinal}: ${r.valor.estado}${r.valor.motivo ? ` (${r.valor.motivo})` : ''}`);
    return Response.json({ ok: true, evento: ev.tipo, estado: r.valor.estado, motivo: r.valor.motivo });
  } catch (e) {
    // La fila queda en `error`: el reintento de Creem (si fue transitorio) la vuelve a reclamar.
    await marcarEvento('creem', ev.id, { estado: 'error', motivo: mensajeDeError(e) });
    return responderFallo('proceso', e);
  }
}
