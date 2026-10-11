// =============================================================================
// Webhook: Mercado Pago → los pagos de los cobros de MaKo entran al CRM
// =============================================================================
// Cada negocio conecta SU cuenta de Mercado Pago pegando su access token (BYOK, decisión de Martín
// del 11/10/2026); MaKo lee su `user_id` (GET /users/me) y lo reclama en `webhook_routing`. Las
// notificaciones llegan por dos caminos: la `notification_url` de cada preferencia (MaKo le pone
// `?u=<user_id>`) y la URL que el negocio carga en su panel de MP (la única por la que llegan los
// avisos de suscripción: `/preapproval` no acepta notification_url). El contrato:
// docs/diseno-pasarela-pagos.md §4.5 «Webhook de MP».
//
// El orden, y cada paso tiene su porqué:
//   1. EL CUERPO CRUDO (`req.text()`). La notificación es FLACA: un tipo, un id y el `user_id` de la
//      cuenta. El formato IPN viejo (`?topic=payment&id=…`) también se acepta (lib/cobros-eventos.ts).
//   2. DE QUIÉN ES, ESTRICTO: el `user_id` del cuerpo o el `?u=` → `wsPorIdentificadorEstricto(
//      'mercadopago', …)`, y el secreto de ESE negocio con `credWsEstricta`. «No pude leer» va por
//      `responderFalloDeRuteo`.
//   3. LA FIRMA, si el negocio pegó su secreto y la notificación trae `x-signature` (sólo el formato
//      nuevo: MP dice que la de un IPN «no se puede validar»). Inválida → 401.
//      ⚠️ SIN SECRETO SE ACEPTA, y alcanza: lo que se aplica sale de RELEER el recurso con el token del
//      negocio y de exigir que lo haya cobrado SU cuenta (`collector_id === MERCADOPAGO_USER_ID`) y
//      que su `external_reference` sea un cobro de ESE negocio (lib/cobros-webhook.ts,
//      `releerNotificacionMp`). Una notificación falsa sólo provoca una relectura.
//   4. LA RELECTURA (`/v1/payments`, `/preapproval`, `/authorized_payments`): sólo lee.
//   5. UNA VEZ POR ESTADO: MP manda varias notificaciones por el mismo pago y sin un id de evento
//      estable, así que la fila de `pasarela_eventos` es `<tipo>:<id>:<estado resultante>`, reclamada
//      DESPUÉS de releer (el estado sale de ahí) y ANTES de aplicar.
//   6. El CRM, adentro de `runWithWorkspace(ws, …)`.
//
// ⚠️ 5xx SÓLO A LO TRANSITORIO. MP pide 200/201 en menos de 22 s y, si no, reintenta cada 15 minutos
// sin un máximo documentado: un aviso que falla siempre se repetiría para siempre. Lo que no se
// arregla reintentando va 200 con el motivo en la fila; lo que no entra lo recoge el cron
// (app/api/cron/cobros-reconciliar), que además es el ÚNICO camino de los pagos de PRUEBA: MP no
// manda notificaciones a la notification_url de un pago de prueba.

import { after, type NextRequest } from 'next/server';
import { wsPorIdentificadorEstricto } from '@/lib/webhook-routing';
import { credWsEstricta } from '@/lib/credenciales';
import { responderFalloDeRuteo } from '@/lib/webhook-fallo-ruteo';
import { verificarFirmaMercadoPago, MOTIVO_FIRMA_PASARELA } from '@/lib/pasarela-firma';
import { runWithWorkspace } from '@/lib/workspace';
import { esErrorTransitorio, mensajeDeError } from '@/lib/calendly-error';
import { claveEventoMp, conPresupuesto, motivoSinDatos, notificacionMp } from '@/lib/cobros-eventos';
import { anotarEvento, cerrarAlTerminar, marcarEvento, reclamarEvento } from '@/lib/pasarela-eventos';
import { aplicarNotificacionMp, releerNotificacionMp, type LecturaMp } from '@/lib/cobros-webhook';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Bien debajo de los 22 s que da Mercado Pago. */
const PRESUPUESTO_MS = 15_000;

/** Un fallo de proceso: 503 SÓLO si reintentar lo arregla; si no, 200 y el motivo queda en la fila. */
function responderFallo(donde: string, e: unknown): Response {
  const motivo = motivoSinDatos(mensajeDeError(e));
  if (esErrorTransitorio(e)) {
    console.error(`[webhook:mercadopago] ${donde} (TRANSITORIO) → 503: ${motivo}`);
    return Response.json({ ok: false, error: donde, reintentar: true }, { status: 503 });
  }
  console.error(`[webhook:mercadopago] ${donde} → 200, reintentar no lo arregla: ${motivo}`);
  return Response.json({ ok: false, error: donde, reintentar: false, motivo });
}

export async function GET() {
  return Response.json({ ok: true, endpoint: 'mercadopago webhook', usage: 'POST con la notificación de Mercado Pago' });
}

export async function POST(req: NextRequest) {
  // ── 1. El cuerpo crudo. Un IPN puede venir vacío: lo que importa va en el query ──
  const raw = await req.text();
  let cuerpo: unknown = null;
  if (raw.trim()) {
    try { cuerpo = JSON.parse(raw); } catch { cuerpo = null; }
  }
  const q = req.nextUrl.searchParams;
  const n = notificacionMp({ query: q, cuerpo });
  if (!n.ok) {
    console.warn(`[webhook:mercadopago] notificación ignorada: ${n.motivo}`);
    return Response.json({ ok: true, ignorado: n.motivo });
  }

  // ── 2. De quién es: ESTRICTO ──
  let ws: number | null = null;
  let secreto: string | null = null;
  try {
    ws = n.userId ? await wsPorIdentificadorEstricto('mercadopago', n.userId) : null;
    secreto = ws == null ? null : await credWsEstricta('MERCADOPAGO_WEBHOOK_SECRET', ws);
  } catch (err) {
    return responderFalloDeRuteo('mercadopago', err, n.userId);
  }

  // ── 3. La firma, si hay con qué verificarla ──
  const firma = req.headers.get('x-signature');
  if (secreto && firma && n.formato === 'webhook') {
    const fallo = verificarFirmaMercadoPago({ dataId: q.get('data.id'), requestId: req.headers.get('x-request-id'), header: firma }, secreto);
    if (fallo) {
      console.warn(`[webhook:mercadopago] firma rechazada (ws ${ws ?? '—'}): ${MOTIVO_FIRMA_PASARELA[fallo]}`);
      return Response.json({ ok: false, error: 'signature', motivo: fallo }, { status: 401 });
    }
  }
  if (ws == null) {
    // Rastro sin datos personales: el tipo, el id del recurso y que no es de ningún negocio.
    await anotarEvento(
      { proveedor: 'mercadopago', eventoId: claveEventoMp(n.tipo, n.id, 'sin-workspace'), ws: null, tipo: n.tipo },
      { estado: 'ignorado', motivo: n.userId ? 'ninguna cuenta conectada con ese user_id' : 'la notificación no dice de qué cuenta es' },
    );
    return Response.json({ ok: true, ignorado: 'sin workspace' });
  }
  const wsFinal = ws;

  // ── 4. La relectura (sólo lee) ──
  let lectura: LecturaMp;
  try {
    lectura = await runWithWorkspace(wsFinal, () => releerNotificacionMp(wsFinal, n));
  } catch (e) {
    await anotarEvento(
      { proveedor: 'mercadopago', eventoId: claveEventoMp(n.tipo, n.id, 'sin-leer'), ws: wsFinal, tipo: n.tipo },
      { estado: 'error', motivo: mensajeDeError(e) },
    );
    return responderFallo('relectura', e);
  }

  // ── 5. Una vez por estado, ANTES de aplicar ──
  const reclamo = await reclamarEvento({ proveedor: 'mercadopago', eventoId: lectura.clave, ws: wsFinal, tipo: lectura.tipo });
  if (reclamo === 'sin_tabla') {
    console.error('[webhook:mercadopago] falta la tabla pasarela_eventos (mig 0250): no se aplica nada sin poder deduplicar');
    return Response.json({ ok: false, error: 'sin_tabla' });
  }
  if (reclamo === 'duplicado') return Response.json({ ok: true, evento: lectura.clave, duplicado: true });
  if (typeof reclamo === 'object') return responderFallo('registro', reclamo.error);

  // ── 6. El CRM, adentro de SU workspace ──
  const trabajo = runWithWorkspace(wsFinal, () => aplicarNotificacionMp(wsFinal, lectura));
  try {
    const r = await conPresupuesto(trabajo, PRESUPUESTO_MS);
    if (!r.listo) {
      // `after` corre FUERA del contexto del pedido: el workspace se vuelve a fijar adentro.
      after(() => runWithWorkspace(wsFinal, () => cerrarAlTerminar('mercadopago', lectura.clave, trabajo)));
      console.warn(`[webhook:mercadopago] ${lectura.clave} ws=${wsFinal}: pasó de ${PRESUPUESTO_MS} ms, sigue en segundo plano`);
      return Response.json({ ok: true, evento: lectura.clave, enCurso: true });
    }
    await marcarEvento('mercadopago', lectura.clave, r.valor);
    console.log(`[webhook:mercadopago] ${lectura.clave} ws=${wsFinal}: ${r.valor.estado}${r.valor.motivo ? ` (${r.valor.motivo})` : ''}`);
    return Response.json({ ok: true, evento: lectura.clave, estado: r.valor.estado, motivo: r.valor.motivo });
  } catch (e) {
    // La fila queda en `error`: el reintento de MP (si fue transitorio) la vuelve a reclamar.
    await marcarEvento('mercadopago', lectura.clave, { estado: 'error', motivo: mensajeDeError(e) });
    return responderFallo('proceso', e);
  }
}
