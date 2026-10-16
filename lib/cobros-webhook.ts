// =============================================================================
// cobros-webhook — un aviso de Stripe o de Mercado Pago, ya ruteado y verificado, entra al CRM
// =============================================================================
// Lo llaman las dos rutas (app/api/webhooks/stripe y app/api/webhooks/mercadopago) adentro de
// `runWithWorkspace(ws, …)` con el ws que ya rutearon. Lo que DECIDE sin red vive en
// lib/cobros-eventos.ts (puro, con test); acá se relee al proveedor, se busca el cobro y se aplica
// por las funciones de lib/cobros.ts (el único escritor de `cobros`). El contrato:
// docs/diseno-pasarela-pagos.md §4.5.
//
// EL ORDEN, en cada aviso:
//   1. Qué dice el aviso (cobros-eventos): qué objeto releer y con qué buscar el cobro.
//   2. EL COBRO, con `cobroDelAviso(ws, …)` y SIEMPRE el ws ruteado: un token o una referencia de
//      otro negocio no aparece, y la cuenta de un cliente no puede marcar pagado el cobro de otro.
//      Lo que no es de un cobro de MaKo se ignora con su motivo (fase 2 si hace falta).
//   3. LA RELECTURA al proveedor con la clave de ESE negocio: el estado y la plata salen de ahí,
//      nunca del cuerpo del aviso.
//   4. `aplicarPagoAprobado` / `aplicarPagoFallido` / `aplicarReembolso` / `aplicarSuscripcionCancelada`:
//      idempotentes, así que una reentrega o los dos caminos de la primera factura no duplican nada.
//
// ⚠️ UN ERROR TIRA, no se traga: lo clasifica la ruta (`esErrorTransitorio` → 503 y el proveedor
// reintenta; si no, 200 y el motivo en la fila de `pasarela_eventos`). Un 404 del proveedor no es
// transitorio; un timeout, un 429 o un 5xx sí (el error lleva `status`, que es lo que lee el clasificador).

import 'server-only';
import { revalidateTag } from 'next/cache';
import { credDelCliente, credWsEstricta } from './credenciales';
import { TAG } from './cache';
import {
  aplicarPagoAprobado, aplicarPagoFallido, aplicarReembolso, aplicarReembolsoFallido, aplicarSuscripcionCancelada, cobroDelAviso,
} from './cobros';
import type { Cobro } from './cobros-tipos';
import {
  avisoStripe, buscarDePagoMp, claveEventoMp, confirmarCargo, confirmarCheckout, confirmarDevolucionFallida, confirmarFactura, esDelCobro,
  mismoModo, nombreModo, planDePagoMp, suscripcionMpCancelada, tokenReleido,
  type ClaveCobro, type EventoStripe, type NotificacionMp, type PlanPagoMp, type ResultadoEvento,
} from './cobros-eventos';
import {
  facturaDePagoStripe, leerCargoStripe, leerCheckoutStripe, leerFacturaStripe, leerReembolsoStripe, leerSuscripcionStripe, modoDeClaveStripe,
} from './stripe-api';
import { leerCuotaSuscripcionMp, leerPagoMp, leerSuscripcionMp, type PagoMp } from './mercadopago-api';

const ignorado = (motivo: string, cobroId: number | null = null): ResultadoEvento => ({ estado: 'ignorado', motivo, cobroId });
const procesado = (cobroId: number, motivo: string | null = null): ResultadoEvento => ({ estado: 'procesado', motivo, cobroId });

/**
 * La clave de la pasarela de ESE negocio, ESTRICTA y SIN el respaldo del entorno. Las dos lecturas
 * que existen fallan distinto, y por eso van las dos:
 *   · `credDelCliente` no lee el `error` de supabase-js: con la base caída devuelve null, y null acá
 *     es «Stripe no está conectado» → el aviso se ignoraría con un 200 y se perdería.
 *   · `credWsEstricta` sí tira, pero cae a `process.env` cuando el ws es OWNER_WS (el 1, Mauricio, un
 *     cliente): con una clave de la plataforma en el entorno, releería con la cuenta equivocada.
 * La estricta pregunta «¿pude leer?» (y tira si no) y la del cliente da el valor.
 */
async function credPasarela(clave: string, ws: number): Promise<string | null> {
  await credWsEstricta(clave, ws);
  return credDelCliente(clave, ws);
}

/** Un fallo del proveedor como error, con su `status` (408/429/5xx → transitorio; 0 trae «no contestó (…timeout…)»). */
function errorDelProveedor(quien: string, que: string, r: { status: number; error: string }): Error {
  return Object.assign(new Error(`${quien} ${r.status || 'sin respuesta'} releyendo ${que}: ${r.error}`), r.status ? { status: r.status } : {});
}

/** Lo que cambió el CRM: las lecturas cacheadas (60 s) lo ven ya. Best-effort. */
function invalidarLecturas(): void {
  for (const t of [TAG.pagos, TAG.leads, TAG.pipeline]) {
    try { revalidateTag(t, { expire: 0 }); } catch { /* vence por TTL */ }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stripe
// ─────────────────────────────────────────────────────────────────────────────

/** El cobro del aviso de Stripe, con el corte de modo (real/prueba) contra el del evento. */
async function cobroStripe(ws: number, ev: EventoStripe, buscar: ClaveCobro): Promise<{ cobro: Cobro } | { ignorar: ResultadoEvento }> {
  const c = await cobroDelAviso(ws, { proveedor: 'stripe', ...buscar });
  if (!c) return { ignorar: ignorado('no es un cobro de MaKo') };
  if (!mismoModo(ev.livemode, c.modo)) {
    return { ignorar: ignorado(`el aviso es de modo ${nombreModo(ev.livemode!)} y el cobro de modo ${c.modo}`, c.id) };
  }
  return { cobro: c };
}

/**
 * Un evento de Stripe ya verificado (firma del webhook de ESE negocio) y ya reclamado en
 * `pasarela_eventos`. Devuelve lo que queda en la fila; tira lo que la ruta tiene que clasificar.
 */
export async function procesarEventoStripe(ws: number, ev: EventoStripe): Promise<ResultadoEvento> {
  const aviso = avisoStripe(ev);
  if (aviso.accion === 'ignorar') return ignorado(aviso.motivo);

  const key = await credPasarela('STRIPE_SECRET_KEY', ws);
  if (!key) return ignorado('Stripe no está conectado en este negocio');
  // Un aviso de prueba releído con una clave real (o al revés) da 404 «a similar object exists in
  // test mode»: no es un error, es otro modo.
  const modoClave = modoDeClaveStripe(key);
  if (ev.livemode != null && modoClave && (modoClave === 'real') !== ev.livemode) {
    return ignorado(`el aviso es de modo ${nombreModo(ev.livemode)} y la clave conectada es de modo ${modoClave}`);
  }

  const { objeto, id } = aviso.leer;

  if (objeto === 'checkout') {
    const b = await cobroStripe(ws, ev, aviso.buscar);
    if ('ignorar' in b) return b.ignorar;
    const c = b.cobro;
    const s = await leerCheckoutStripe(key, id);
    if (!s.ok) throw errorDelProveedor('Stripe', 'la sesión de pago', s);
    if (!esDelCobro(c.token, tokenReleido(s))) return ignorado('la sesión releída es de otro cobro', c.id);
    const conf = confirmarCheckout(aviso.accion === 'fallido' ? 'fallido' : 'aprobado', s);
    if (!conf.ok) return ignorado(conf.motivo, c.id);
    if (aviso.accion === 'fallido') {
      await aplicarPagoFallido(c, 'El pago diferido no se completó.');
      invalidarLecturas();
      return procesado(c.id);
    }
    if (!conf.proveedorPagoId) return ignorado('la sesión pagada no trae el pago', c.id);
    const r = await aplicarPagoAprobado(c, { proveedorPagoId: conf.proveedorPagoId, suscripcionId: conf.suscripcionId });
    invalidarLecturas();
    return procesado(c.id, r.nuevo ? null : 'ya estaba pagado');
  }

  if (objeto === 'factura') {
    const b = await cobroStripe(ws, ev, aviso.buscar);
    if ('ignorar' in b) return b.ignorar;
    const c = b.cobro;
    const f = await leerFacturaStripe(key, id);
    if (!f.ok) throw errorDelProveedor('Stripe', 'la factura', f);
    if (!esDelCobro(c.token, tokenReleido({ metadata: f.metadata }))) return ignorado('la factura releída es de otro cobro', c.id);
    const conf = confirmarFactura(aviso.accion === 'fallido' ? 'fallido' : 'aprobado', f);
    if (!conf.ok) return ignorado(conf.motivo, c.id);
    if (aviso.accion === 'fallido') {
      await aplicarPagoFallido(c, 'Stripe no pudo cobrar la factura.');
      invalidarLecturas();
      return procesado(c.id);
    }
    // La renovación (subscription_cycle) entra con el id de ESA factura: es otra cuota del CRM. La
    // primera (subscription_create) lleva el mismo id que usó checkout.session.completed.
    const r = await aplicarPagoAprobado(c, { proveedorPagoId: conf.proveedorPagoId, monto: conf.monto, moneda: conf.moneda, suscripcionId: conf.suscripcionId });
    invalidarLecturas();
    return procesado(c.id, r.renovacion ? 'renovación' : r.nuevo ? null : 'ya estaba pagado');
  }

  if (objeto === 'suscripcion') {
    const b = await cobroStripe(ws, ev, aviso.buscar);
    if ('ignorar' in b) return b.ignorar;
    const c = b.cobro;
    const s = await leerSuscripcionStripe(key, id);
    if (!s.ok) throw errorDelProveedor('Stripe', 'la suscripción', s);
    if (!esDelCobro(c.token, tokenReleido({ metadata: s.metadata }))) return ignorado('la suscripción releída es de otro cobro', c.id);
    if (s.estado !== 'canceled') return ignorado(`la suscripción releída no está cancelada (${s.estado ?? '—'})`, c.id);
    await aplicarSuscripcionCancelada(c);
    invalidarLecturas();
    return procesado(c.id);
  }

  if (objeto === 'reembolso') {
    // ⚠️ UNA DEVOLUCIÓN QUE FALLÓ (15/10/2026): se relee la devolución (que de verdad falló) y su CARGO, que es lo que
    // dice si sigue devuelto por otra. Lo que `aplicarReembolso` deshizo, `aplicarReembolsoFallido` lo rehace.
    const dev = await leerReembolsoStripe(key, id);
    if (!dev.ok) throw errorDelProveedor('Stripe', 'la devolución', dev);
    const fallo = confirmarDevolucionFallida(dev);
    if (!fallo.ok) return ignorado(fallo.motivo);
    const cargo = await leerCargoStripe(key, fallo.cargo);
    if (!cargo.ok) throw errorDelProveedor('Stripe', 'el cargo', cargo);
    const pi = cargo.paymentIntent ?? dev.paymentIntent ?? aviso.buscar.pagoId ?? null;
    const { b, pagoId } = await cobroDelPagoStripe(key, ws, ev, aviso.buscar.token ?? null, pi);
    if ('ignorar' in b) return b.ignorar;
    await aplicarReembolsoFallido(b.cobro, { proveedorPagoId: pagoId, sigueDevuelto: cargo.reembolsado, razon: dev.motivo, fechaCargo: cargo.creado });
    invalidarLecturas();
    return procesado(b.cobro.id, cargo.reembolsado ? 'devolución fallida (el cargo sigue devuelto por otra)' : 'devolución fallida');
  }

  // objeto === 'cargo': un reembolso. Se relee el cargo PRIMERO (es lo que dice si fue total).
  const cargo = await leerCargoStripe(key, id);
  if (!cargo.ok) throw errorDelProveedor('Stripe', 'el cargo', cargo);
  const conf = confirmarCargo(cargo);
  if (!conf.ok) return ignorado(conf.motivo);
  const pi = conf.paymentIntent ?? aviso.buscar.pagoId ?? null;
  const { b, pagoId } = await cobroDelPagoStripe(key, ws, ev, aviso.buscar.token ?? null, pi);
  if ('ignorar' in b) return b.ignorar;
  await aplicarReembolso(b.cobro, { proveedorPagoId: pagoId, total: conf.total });
  invalidarLecturas();
  return procesado(b.cobro.id, conf.total ? null : 'reembolso parcial');
}

/**
 * El cobro de un PAGO de Stripe (un reembolso o una devolución fallida): por el payment intent (pago único) o, si no
 * aparece, por la factura que pagó ese payment intent (una cuota de suscripción: desde basil el cargo ya no trae
 * `invoice`). Devuelve también el id con que se asentó ese pago en el CRM (el payment intent o la factura).
 */
async function cobroDelPagoStripe(
  key: string, ws: number, ev: EventoStripe, token: string | null, pi: string | null,
): Promise<{ b: { cobro: Cobro } | { ignorar: ResultadoEvento }; pagoId: string | null }> {
  let pagoId: string | null = pi;
  let b = await cobroStripe(ws, ev, { token, pagoId: pi });
  // Sólo si NO apareció (cobroId null): uno que apareció y se ignoró por el modo ya está decidido.
  if ('ignorar' in b && b.ignorar.cobroId == null && pi) {
    const fp = await facturaDePagoStripe(key, pi);
    if (!fp.ok) throw errorDelProveedor('Stripe', 'la factura del pago', fp);
    if (fp.invoice) {
      const f = await leerFacturaStripe(key, fp.invoice);
      if (!f.ok) throw errorDelProveedor('Stripe', 'la factura', f);
      pagoId = f.id;
      b = await cobroStripe(ws, ev, { token: tokenReleido({ metadata: f.metadata }), suscripcionId: f.suscripcion, pagoId: f.id });
    }
  }
  return { b, pagoId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mercado Pago
// ─────────────────────────────────────────────────────────────────────────────

type QueHacerMp =
  | { accion: 'ignorar'; motivo: string }
  | { accion: 'pago'; pago: PagoMp; plan: PlanPagoMp; buscar: ClaveCobro }
  | { accion: 'suscripcion_cancelada'; buscar: ClaveCobro };

/**
 * Lo que se releyó de una notificación de MP. `clave` es su `evento_id` en `pasarela_eventos`
 * (`<tipo>:<id>:<estado resultante>`): sale de la RELECTURA, por eso la ruta reclama la fila después
 * de releer y antes de aplicar.
 */
export type LecturaMp = { clave: string; tipo: string; que: QueHacerMp };

const lecturaIgnorada = (n: { tipo: string; id: string }, estado: string, motivo: string): LecturaMp =>
  ({ clave: claveEventoMp(n.tipo, n.id, estado), tipo: n.tipo, que: { accion: 'ignorar', motivo } });

/**
 * Relee el recurso de la notificación con el token de ESE negocio. Sólo lee (GET): no aplica nada.
 *
 * ⚠️ POR QUÉ ALCANZA SIN FIRMA. MP sólo firma lo que llega por la URL del panel (y el formato IPN
 * «no se puede validar»), así que la mayoría de las notificaciones vienen sin una firma verificable.
 * No hace falta: la notificación es un tipo y un id, nada más, y lo que se aplica sale de releer ese
 * id con el token del negocio, exigiendo que el pago lo haya COBRADO su cuenta (`collector_id ===
 * MERCADOPAGO_USER_ID`: con su token también se leen los pagos donde esa cuenta es la que PAGÓ) y que
 * su `external_reference` sea el token de un cobro de ESE negocio. Una notificación falsa sólo
 * provoca una relectura: no puede inventar un pago ni marcar pagado uno ajeno.
 */
export async function releerNotificacionMp(ws: number, n: Extract<NotificacionMp, { ok: true }>): Promise<LecturaMp> {
  if (!n.procesable) return { clave: claveEventoMp(n.tipo, n.id, 'recibido'), tipo: n.tipo, que: { accion: 'ignorar', motivo: `notificación ${n.tipo}: MaKo no la procesa` } };

  const [token, cuenta] = [await credPasarela('MERCADOPAGO_ACCESS_TOKEN', ws), await credPasarela('MERCADOPAGO_USER_ID', ws)];
  if (!token || !cuenta) return lecturaIgnorada(n, 'sin-conexion', 'Mercado Pago no está conectado en este negocio');

  if (n.tipo === 'subscription_preapproval') {
    const s = await leerSuscripcionMp(token, n.id);
    if (!s.ok) {
      if (s.status === 404) return lecturaIgnorada(n, 'no-encontrado', 'esa suscripción no existe en la cuenta de este negocio');
      throw errorDelProveedor('Mercado Pago', 'la suscripción', s);
    }
    if (s.cobradorId !== cuenta) return lecturaIgnorada(n, 'otra-cuenta', 'la suscripción no la cobra esta cuenta');
    const estado = s.estado ?? 'sin-estado';
    if (!suscripcionMpCancelada(s.estado)) return lecturaIgnorada(n, estado, `suscripción ${estado}: el pago llega en su propia notificación`);
    return { clave: claveEventoMp(n.tipo, n.id, estado), tipo: n.tipo, que: { accion: 'suscripcion_cancelada', buscar: { token: tokenReleido({ referencia: s.referencia }), ref: s.id, suscripcionId: s.id } } };
  }

  // Un pago, directo (`payment`) o como cuota de una suscripción (`subscription_authorized_payment`).
  let pagoId = n.id;
  let preapprovalId: string | null = null;
  let referenciaCuota: string | null = null;
  if (n.tipo === 'subscription_authorized_payment') {
    const q = await leerCuotaSuscripcionMp(token, n.id);
    if (!q.ok) {
      if (q.status === 404) return lecturaIgnorada(n, 'no-encontrado', 'esa cuota no existe en la cuenta de este negocio');
      throw errorDelProveedor('Mercado Pago', 'la cuota de la suscripción', q);
    }
    if (!q.pagoId) return lecturaIgnorada(n, q.estado ?? 'sin-pago', `cuota ${q.estado ?? 'sin estado'}: todavía no tiene un pago`);
    pagoId = q.pagoId;
    preapprovalId = q.preapprovalId;
    referenciaCuota = q.referencia;
  }
  const p = await leerPagoMp(token, pagoId);
  if (!p.ok) {
    if (p.status === 404) return lecturaIgnorada(n, 'no-encontrado', 'ese pago no existe en la cuenta de este negocio');
    throw errorDelProveedor('Mercado Pago', 'el pago', p);
  }
  if (p.cobradorId !== cuenta) return lecturaIgnorada(n, 'otra-cuenta', 'el pago no lo cobró esta cuenta');
  const pago: PagoMp = { ...p, preapprovalId: p.preapprovalId ?? preapprovalId, referencia: p.referencia ?? referenciaCuota };
  const plan = planDePagoMp(pago);
  return { clave: claveEventoMp(n.tipo, n.id, plan.estadoResultante), tipo: n.tipo, que: { accion: 'pago', pago, plan, buscar: buscarDePagoMp(pago) } };
}

/** Aplica lo releído (la fila ya está reclamada). */
export async function aplicarNotificacionMp(ws: number, l: LecturaMp): Promise<ResultadoEvento> {
  const que = l.que;
  if (que.accion === 'ignorar') return ignorado(que.motivo);
  if (que.accion === 'pago' && que.plan.accion === 'ignorar') return ignorado(que.plan.motivo);

  const c = await cobroDelAviso(ws, { proveedor: 'mercadopago', ...que.buscar });
  if (!c) return ignorado('no es un cobro de MaKo');
  const releido = que.accion === 'pago' ? que.pago.referencia : que.buscar.token ?? null;
  if (!esDelCobro(c.token, tokenReleido({ referencia: releido }))) return ignorado('el recurso releído es de otro cobro', c.id);

  if (que.accion === 'suscripcion_cancelada') {
    await aplicarSuscripcionCancelada(c);
    invalidarLecturas();
    return procesado(c.id);
  }

  const { pago, plan } = que;
  if (plan.accion === 'aprobado') {
    // La renovación (otra cuota de la suscripción) entra con el id de ESE pago: es otra cuota del CRM.
    const r = await aplicarPagoAprobado(c, { proveedorPagoId: pago.id, monto: pago.monto, moneda: pago.moneda, suscripcionId: pago.preapprovalId });
    if (plan.reembolsoParcial) await aplicarReembolso(c, { proveedorPagoId: pago.id, total: false });
    invalidarLecturas();
    return procesado(c.id, plan.reembolsoParcial ? 'reembolso parcial' : r.renovacion ? 'renovación' : r.nuevo ? null : 'ya estaba pagado');
  }
  if (plan.accion === 'fallido') {
    await aplicarPagoFallido(c, plan.motivo);
    invalidarLecturas();
    return procesado(c.id);
  }
  if (plan.accion === 'reembolso') {
    await aplicarReembolso(c, { proveedorPagoId: pago.id, total: true });
    invalidarLecturas();
    return procesado(c.id);
  }
  return ignorado(plan.motivo, c.id);
}
