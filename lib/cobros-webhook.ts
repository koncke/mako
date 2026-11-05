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
  aplicarContracargo, aplicarPagoAprobado, aplicarPagoFallido, aplicarReembolso, aplicarReembolsoFallido, aplicarSuscripcionCancelada, cobroDelAviso,
  registrarVentaExterna,
} from './cobros';
import {
  INTERRUPTOR_VENTAS_EXTERNAS, MOTIVO_APAGADO, esCobroExterno, esVentaExterna, filaDeVentaExterna, ventasExternasPrendidas,
} from './cobros-externos-reglas';
import { getSettingEstricto } from './settings';
import { wsSuperAdmin } from './workspace';
import { avisarCompraAMeta } from './cobros-externos-meta';
import type { Cobro } from './cobros-tipos';
import { avisarFacturaDeOtraSuscripcion, avisarSesionQueNoCuadra } from './cobro-sesion-ajena';
import { CUENTA_PRINCIPAL, claveDeCuenta } from './cuentas-integracion';
import { textoContracargo } from './cobros-reglas';
import { transaccionQueCobra } from './prueba-plan-reglas';
import {
  avisoStripe, buscarDePagoMp, claveEventoMp, confirmarCargo, confirmarCheckout, confirmarDevolucionFallida, confirmarFactura, esDelCobro, faseDeDisputa,
  mismoModo, nombreModo, planDePagoMp, sesionDelCobro, suscripcionMpCancelada, tokenReleido,
  avisoCreem,
  type ClaveCobro, type EventoCreem, type EventoStripe, type NotificacionMp, type PlanPagoMp, type ResultadoEvento,
} from './cobros-eventos';
import {
  facturaDePagoStripe, leerCargoStripe, leerCheckoutExternoStripe, leerCheckoutStripe, leerDisputaStripe, leerFacturaStripe, leerReembolsoStripe, leerSuscripcionStripe, modoDeClaveStripe,
} from './stripe-api';
import { leerCuotaSuscripcionMp, leerPagoMp, leerSuscripcionMp, type PagoMp } from './mercadopago-api';
import { buscarTransaccionesCreem, leerTransaccionCreem, leerCheckoutCreem, leerSuscripcionCreem, modoDeClaveCreem } from './creem-api';

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

/**
 * ¿El cobro es de OTRA cuenta del negocio que la que mandó el aviso? (varias por proveedor, mig 0328). Un pago de la
 * cuenta A nunca aplica un cobro de la cuenta B: se releyó con las claves de A.
 */
type QuienAvisa = { cuenta: string; ref: string | null };
const PRINCIPAL_SIN_REF: QuienAvisa = { cuenta: CUENTA_PRINCIPAL, ref: null };
// Por el id en el proveedor cuando el cobro lo tiene (mig 0328): una cuenta que volvió con otro sufijo sigue siendo la suya.
const deOtraCuenta = (c: Cobro, q: QuienAvisa): boolean =>
  c.cuenta_ref ? c.cuenta_ref.trim() !== (q.ref ?? '').trim() : (c.cuenta ?? CUENTA_PRINCIPAL) !== q.cuenta;

/**
 * La suscripción VIGENTE de un cobro de Stripe (29/10/2026): la que ya se le anotó o, antes del primer pago, la de la sesión que
 * MaKo armó por última vez (`proveedor_ref`; null si todavía no se completó). Una factura o una cancelación de OTRA suscripción
 * es de un intento anterior (`urlParaPagar` la canceló al armar otra sesión). Si no se puede leer, tira: Stripe reintenta el aviso.
 */
async function suscripcionVigente(key: string, c: Cobro): Promise<string | null> {
  if (c.proveedor_suscripcion_id) return c.proveedor_suscripcion_id;
  if (!c.proveedor_ref) return null;
  const s = await leerCheckoutStripe(key, c.proveedor_ref);
  if (!s.ok) {
    if (s.status === 404) return null;
    throw errorDelProveedor('Stripe', 'la sesión vigente del cobro', s);
  }
  return s.subscription;
}

/** El cobro del aviso de Stripe, con el corte de modo (real/prueba) contra el del evento, y el de la cuenta. */
async function cobroStripe(ws: number, ev: EventoStripe, buscar: ClaveCobro, quien: QuienAvisa = PRINCIPAL_SIN_REF): Promise<{ cobro: Cobro } | { ignorar: ResultadoEvento; noEsDeMako?: true }> {
  const c = await cobroDelAviso(ws, { proveedor: 'stripe', ...buscar });
  // ⚠️ Se SUMA `noEsDeMako` y se conserva `ignorar` (el diseño, §1): todos los llamadores miran `'ignorar' in b`, y el respaldo por
  // factura de un reembolso o una disputa de una cuota (también de la suscripción de MaKo) depende de esta forma.
  if (!c) return { ignorar: ignorado('no es un cobro de MaKo'), noEsDeMako: true };
  if (deOtraCuenta(c, quien)) return { ignorar: ignorado('el cobro es de otra cuenta de Stripe del negocio', c.id) };
  if (!mismoModo(ev.livemode, c.modo)) {
    return { ignorar: ignorado(`el aviso es de modo ${nombreModo(ev.livemode!)} y el cobro de modo ${c.modo}`, c.id) };
  }
  return { cobro: c };
}

/**
 * La venta de un Payment Link PROPIO del negocio (MAU-10, 27/10/2026, docs/diseno-venta-externa-stripe.md): no es un cobro de MaKo,
 * pero es plata que entró. Se relee la sesión con su ítem y, si es una venta externa (`esVentaExterna`: nunca en la plataforma,
 * nunca con metadata de MaKo, sólo desde un Payment Link, pagada y en el modo del aviso) y el negocio lo prendió, entra como un
 * cobro externo ya pagado con su lead y su cuota (`registrarVentaExterna`, lib/cobros.ts). Después, la compra a Meta.
 * Apagado, sólo la compra a Meta (lo que había antes de esto): sin lead no hay línea que la marque, y Meta deduplica por el id.
 */
async function ventaExternaStripe(ws: number, key: string, sesionId: string, ev: EventoStripe, quien: QuienAvisa): Promise<ResultadoEvento> {
  const r = await leerCheckoutExternoStripe(key, sesionId);
  if (!r.ok) throw errorDelProveedor('Stripe', 'la sesión de pago', r);
  const s = r.sesion;
  const [plataforma, interruptor] = await Promise.all([wsSuperAdmin(), getSettingEstricto(INTERRUPTOR_VENTAS_EXTERNAS)]);
  const d = esVentaExterna({ esPlataforma: ws === plataforma, prendido: ventasExternasPrendidas(interruptor), s, livemodeEvento: ev.livemode });
  const { compraDeLaSesion } = await import('./meta-capi-payload');
  // null en una venta de prueba: no entra al píxel como una compra de verdad.
  const compra = compraDeLaSesion(s);
  if (!d.ok) {
    if (d.motivo === MOTIVO_APAGADO && compra) return ignorado(`${d.motivo}; ${await avisarCompraAMeta(compra, ev.creado, null)}`.slice(0, 300));
    return ignorado(d.motivo);
  }
  const f = filaDeVentaExterna(s, quien, ev.creado ?? new Date().toISOString());
  if (!f.ok) return ignorado(f.motivo);
  const v = await registrarVentaExterna(ws, {
    fila: f.fila,
    contacto: { email: s.email, telefono: s.telefono, nombre: s.nombre },
    item: s.item ? { nombre: s.item.nombre, montoUsdLista: s.item.monedaLista === 'USD' ? s.item.montoLista : null, tipo: s.item.recurrente ? 'suscripcion' : 'unico' } : null,
  });
  invalidarLecturas();
  // La compra, DESPUÉS de asentar la plata: un fallo de Meta no deshace la venta ni hace reintentar a Stripe.
  const meta = compra ? await avisarCompraAMeta(compra, ev.creado, v.leadId) : 'venta de prueba: no se le avisa a Meta';
  return procesado(v.cobro.id, [v.aviso, meta].filter(Boolean).join('; ').slice(0, 300) || null);
}

/**
 * Un evento de Stripe ya verificado (firma del webhook de ESE negocio) y ya reclamado en
 * `pasarela_eventos`. Devuelve lo que queda en la fila; tira lo que la ruta tiene que clasificar.
 */
export async function procesarEventoStripe(ws: number, ev: EventoStripe, cuenta: string = CUENTA_PRINCIPAL, acct?: string | null): Promise<ResultadoEvento> {
  const aviso = avisoStripe(ev);
  if (aviso.accion === 'ignorar') return ignorado(aviso.motivo);

  // Las claves de LA cuenta que mandó el aviso (la ruta la saca de su `acct`): con varias cuentas, releer con otra da 404.
  const key = await credPasarela(claveDeCuenta('STRIPE_SECRET_KEY', cuenta), ws);
  if (!key) return ignorado('Stripe no está conectado en este negocio');
  // El `acct` que la ruta ya validó (rutea y verifica la firma con él). Releerlo con la lectura tolerante daba null ante un
  // error de la base, y el cobro se tomaba como «de otra cuenta» y se ignoraba con un 200 (segunda revisión de plata).
  const quien: QuienAvisa = { cuenta, ref: acct ?? (await credPasarela(claveDeCuenta('STRIPE_ACCOUNT_ID', cuenta), ws)) };
  // Un aviso de prueba releído con una clave real (o al revés) da 404 «a similar object exists in
  // test mode»: no es un error, es otro modo.
  const modoClave = modoDeClaveStripe(key);
  if (ev.livemode != null && modoClave && (modoClave === 'real') !== ev.livemode) {
    return ignorado(`el aviso es de modo ${nombreModo(ev.livemode)} y la clave conectada es de modo ${modoClave}`);
  }

  const { objeto, id } = aviso.leer;

  if (objeto === 'checkout') {
    const b = await cobroStripe(ws, ev, aviso.buscar, quien);
    // Una venta de un Payment Link armado en el Stripe del negocio (MAU-10, 27/10/2026): no es un cobro de MaKo, pero es plata que
    // entró. Sólo el aprobado: un pago diferido que falló sin fila no tiene nada que registrar.
    // ⚠️ Y SI YA ESTÁ, TAMBIÉN (28/10/2026): un aviso que se cortó después de reclamar la venta (la base no contestó: la ruta
    // responde 503 y Stripe reintenta) deja el cobro externo sin lead, y su reintento lo encuentra. Por el camino de MaKo decía
    // «ya estaba pagado» y la venta quedaba sin lead, sin cuota y sin la compra a Meta para siempre. `registrarVentaExterna` sigue
    // desde el paso que falte. NO cubre el corte pasado el tope de 8 s: ahí la ruta ya contestó 200 y Stripe no reintenta.
    if (aviso.accion === 'aprobado' && ('ignorar' in b ? b.noEsDeMako === true : esCobroExterno(b.cobro))) return ventaExternaStripe(ws, key, id, ev, quien);
    if ('ignorar' in b) return b.ignorar;
    const c = b.cobro;
    const s = await leerCheckoutStripe(key, id);
    if (!s.ok) throw errorDelProveedor('Stripe', 'la sesión de pago', s);
    if (!esDelCobro(c.token, tokenReleido(s))) return ignorado('la sesión releída es de otro cobro', c.id);
    const conf = confirmarCheckout(aviso.accion === 'fallido' ? 'fallido' : 'aprobado', s);
    if (!conf.ok) return ignorado(conf.motivo, c.id);
    // ⚠️ LA SESIÓN TIENE QUE SER LA QUE MaKo ARMÓ PARA ESTE COBRO (28/10/2026): el token llega también por el
    // `client_reference_id` de un Payment Link, y una venta de US$1 marcaba pagado un cobro de US$1.500 (`sesionDelCobro`).
    const deEste = sesionDelCobro(c, s, aviso.accion === 'fallido' ? 'fallido' : 'aprobado');
    if (!deEste.ok) {
      if (aviso.accion !== 'fallido') await avisarSesionQueNoCuadra(ws, c, s, deEste.motivo);
      return ignorado(deEste.motivo, c.id);
    }
    if (aviso.accion === 'fallido') {
      // ⚠️ EL FALLO DE UNA SESIÓN ANTERIOR NO TOCA EL COBRO (29/10/2026, la verificación de ddfa645d4): «Volver a intentar» arma
      //    otra (B) y vuelve el cobro a `pendiente`. El segundo aviso del mismo fallo de A, o uno tardío, lo devolvía a `fallido`
      //    con el SEPA de B en curso, y se armaba C: dos cuotas y tres suscripciones. Un PAGO de una sesión anterior sí entra (es
      //    plata, y `urlParaPagar` la expiró si seguía abierta).
      if (c.proveedor_ref && s.id !== c.proveedor_ref) return ignorado('el fallo es de una sesión anterior de este cobro: ya se armó otra', c.id);
      await aplicarPagoFallido(c, 'El pago diferido no se completó.');
      invalidarLecturas();
      return procesado(c.id);
    }
    if (!conf.proveedorPagoId) return ignorado('la sesión pagada no trae el pago', c.id);
    const r = await aplicarPagoAprobado(c, { proveedorPagoId: conf.proveedorPagoId, suscripcionId: conf.suscripcionId, pagadoAt: ev.creado ?? null });
    invalidarLecturas();
    return procesado(c.id, r.nuevo ? null : 'ya estaba pagado');
  }

  if (objeto === 'factura') {
    const b = await cobroStripe(ws, ev, aviso.buscar, quien);
    if ('ignorar' in b) return b.ignorar;
    const c = b.cobro;
    const f = await leerFacturaStripe(key, id);
    if (!f.ok) throw errorDelProveedor('Stripe', 'la factura', f);
    if (!esDelCobro(c.token, tokenReleido({ metadata: f.metadata }))) return ignorado('la factura releída es de otro cobro', c.id);
    const conf = confirmarFactura(aviso.accion === 'fallido' ? 'fallido' : 'aprobado', f);
    if (!conf.ok) return ignorado(conf.motivo, c.id);
    // ⚠️ SÓLO LA FACTURA DE LA SUSCRIPCIÓN VIGENTE (29/10/2026, la verificación de ddfa645d4): «Volver a intentar» arma otra sesión
    //    (otra suscripción) y cancela la de antes. Un fallo tardío de la vieja (un reintento de Stripe) devolvía el cobro a
    //    `fallido` y se armaba una tercera; un pago tardío de la vieja entraba como «renovación»: dos suscripciones cobrando. El
    //    pago no se asienta y queda un ticket (la plata entró: alguien la mira y la devuelve).
    if (f.suscripcion) {
      const vigente = await suscripcionVigente(key, c);
      if (f.suscripcion !== vigente) {
        if (aviso.accion !== 'fallido') await avisarFacturaDeOtraSuscripcion(ws, c, { factura: f.id, suscripcion: f.suscripcion, vigente, monto: f.montoPagado, moneda: f.moneda });
        return ignorado(`la factura es de una suscripción anterior de este cobro (${f.suscripcion}), no de la vigente`, c.id);
      }
    }
    if (aviso.accion === 'fallido') {
      await aplicarPagoFallido(c, 'Stripe no pudo cobrar la factura.');
      invalidarLecturas();
      return procesado(c.id);
    }
    // La renovación (subscription_cycle) entra con el id de ESA factura: es otra cuota del CRM. La
    // primera (subscription_create) lleva el mismo id que usó checkout.session.completed.
    const r = await aplicarPagoAprobado(c, { proveedorPagoId: conf.proveedorPagoId, monto: conf.monto, moneda: conf.moneda, suscripcionId: conf.suscripcionId, pagadoAt: ev.creado ?? null });
    invalidarLecturas();
    return procesado(c.id, r.renovacion ? 'renovación' : r.nuevo ? null : 'ya estaba pagado');
  }

  if (objeto === 'suscripcion') {
    const b = await cobroStripe(ws, ev, aviso.buscar, quien);
    if ('ignorar' in b) return b.ignorar;
    const c = b.cobro;
    const s = await leerSuscripcionStripe(key, id);
    if (!s.ok) throw errorDelProveedor('Stripe', 'la suscripción', s);
    if (!esDelCobro(c.token, tokenReleido({ metadata: s.metadata }))) return ignorado('la suscripción releída es de otro cobro', c.id);
    if (s.estado !== 'canceled') return ignorado(`la suscripción releída no está cancelada (${s.estado ?? '—'})`, c.id);
    // ⚠️ SÓLO LA VIGENTE (29/10/2026): la de una sesión que falló la cancela `urlParaPagar` al armar otra, y su aviso marcaba
    //    «Suscripción cancelada» en el cobro y en el lead (el MRR la dejaba de contar) aunque la nueva estuviera cobrando.
    if (id !== (await suscripcionVigente(key, c))) return ignorado('la suscripción cancelada es de una sesión anterior de este cobro', c.id);
    await aplicarSuscripcionCancelada(c);
    invalidarLecturas();
    return procesado(c.id);
  }

  if (objeto === 'disputa') {
    // ⚠️ UN CONTRACARGO (15/10/2026). El texto sale de la FASE (el tipo del evento); la plata, de la disputa releída
    // (`retirada` / `reintegrada`, sus balance_transactions), no del evento: los avisos pueden llegar desordenados.
    const fase = faseDeDisputa(ev.tipo);
    if (!fase) return ignorado(`evento ${ev.tipo}: no es de una disputa`);
    const d = await leerDisputaStripe(key, id);
    if (!d.ok) throw errorDelProveedor('Stripe', 'la disputa', d);
    if (!d.cargo) return ignorado('la disputa releída no dice de qué cargo es');
    const cargo = await leerCargoStripe(key, d.cargo);
    if (!cargo.ok) throw errorDelProveedor('Stripe', 'el cargo', cargo);
    const pi = cargo.paymentIntent ?? d.paymentIntent ?? aviso.buscar.pagoId ?? null;
    const { b, pagoId } = await cobroDelPagoStripe(key, ws, ev, null, pi, quien);
    if ('ignorar' in b) return b.ignorar;
    // Una disputa PARCIAL no mueve la cuota (no se parte), y un cargo ya devuelto entero tampoco (la cuota ya salió).
    const total = d.monto != null && cargo.monto != null && d.monto >= cargo.monto - 0.005;
    const plataAfuera = !total || cargo.reembolsado ? null : d.retirada && !d.reintegrada;
    await aplicarContracargo(b.cobro, {
      fase, texto: textoContracargo({ pasarela: 'stripe', fase, estado: d.estado, razon: d.motivo }),
      plataAfuera, proveedorPagoId: pagoId, fechaCargo: cargo.creado,
    });
    invalidarLecturas();
    return procesado(b.cobro.id, `contracargo: ${fase}${total ? '' : ' (parcial)'}`);
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
    const { b, pagoId } = await cobroDelPagoStripe(key, ws, ev, aviso.buscar.token ?? null, pi, quien);
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
  const { b, pagoId } = await cobroDelPagoStripe(key, ws, ev, aviso.buscar.token ?? null, pi, quien);
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
  key: string, ws: number, ev: EventoStripe, token: string | null, pi: string | null, quien: QuienAvisa = PRINCIPAL_SIN_REF,
): Promise<{ b: { cobro: Cobro } | { ignorar: ResultadoEvento }; pagoId: string | null }> {
  let pagoId: string | null = pi;
  let b = await cobroStripe(ws, ev, { token, pagoId: pi }, quien);
  // Sólo si NO apareció (cobroId null): uno que apareció y se ignoró por el modo ya está decidido.
  if ('ignorar' in b && b.ignorar.cobroId == null && pi) {
    const fp = await facturaDePagoStripe(key, pi);
    if (!fp.ok) throw errorDelProveedor('Stripe', 'la factura del pago', fp);
    if (fp.invoice) {
      const f = await leerFacturaStripe(key, fp.invoice);
      if (!f.ok) throw errorDelProveedor('Stripe', 'la factura', f);
      pagoId = f.id;
      b = await cobroStripe(ws, ev, { token: tokenReleido({ metadata: f.metadata }), suscripcionId: f.suscripcion, pagoId: f.id }, quien);
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
export async function releerNotificacionMp(ws: number, n: Extract<NotificacionMp, { ok: true }>, cuentaMp: string = CUENTA_PRINCIPAL): Promise<LecturaMp> {
  if (!n.procesable) return { clave: claveEventoMp(n.tipo, n.id, 'recibido'), tipo: n.tipo, que: { accion: 'ignorar', motivo: `notificación ${n.tipo}: MaKo no la procesa` } };

  // Las claves de LA cuenta de la notificación (la ruta la saca de su `user_id`; varias por proveedor, mig 0328).
  const [token, cuenta] = [await credPasarela(claveDeCuenta('MERCADOPAGO_ACCESS_TOKEN', cuentaMp), ws), await credPasarela(claveDeCuenta('MERCADOPAGO_USER_ID', cuentaMp), ws)];
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
export async function aplicarNotificacionMp(ws: number, l: LecturaMp, cuenta: string = CUENTA_PRINCIPAL, userId?: string | null): Promise<ResultadoEvento> {
  const que = l.que;
  if (que.accion === 'ignorar') return ignorado(que.motivo);
  if (que.accion === 'pago' && que.plan.accion === 'ignorar') return ignorado(que.plan.motivo);

  const c = await cobroDelAviso(ws, { proveedor: 'mercadopago', ...que.buscar });
  if (!c) return ignorado('no es un cobro de MaKo');
  // La cuenta que lo cobró (mig 0328): un pago de la cuenta A nunca aplica un cobro de la cuenta B.
  // El `user_id` que la ruta ya validó (ver procesarEventoStripe).
  const quien: QuienAvisa = { cuenta, ref: userId ?? (await credPasarela(claveDeCuenta('MERCADOPAGO_USER_ID', cuenta), ws)) };
  if (deOtraCuenta(c, quien)) return ignorado('el cobro es de otra cuenta de Mercado Pago del negocio', c.id);
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
    const r = await aplicarPagoAprobado(c, { proveedorPagoId: pago.id, monto: pago.monto, moneda: pago.moneda, suscripcionId: pago.preapprovalId, pagadoAt: pago.fecha, cobrado: { monto: pago.monto, moneda: pago.moneda } });
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
  if (plan.accion === 'contracargo') {
    // Se CUENTA, sin mover la cuota (`plataAfuera: null`): MP documenta `settled`/`reimbursed` de dos maneras opuestas.
    await aplicarContracargo(c, {
      fase: 'mp', texto: textoContracargo({ pasarela: 'mercadopago', fase: 'mp', estado: plan.detalle }),
      plataAfuera: null, proveedorPagoId: pago.id, fechaCargo: pago.fecha,
    });
    invalidarLecturas();
    return procesado(c.id, `contracargo: ${plan.detalle ?? 'sin detalle'}`);
  }
  return ignorado(plan.motivo, c.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Creem (31/10/2026)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un aviso de Creem, ya ruteado y con la firma verificada, entra al CRM.
 *
 * EL ORDEN es el mismo que los otros dos, y por el mismo motivo: lo que se aplica sale de RELEER a Creem con la clave
 * de ESE negocio, nunca del cuerpo del aviso. Acá importa más que en Mercado Pago, porque el aviso de Creem SÍ trae el
 * objeto entero y la plata: sería cómodo creerle, y es justo lo que no se hace.
 *
 * ⚠️ Y hay un motivo extra, propio de Creem: su firma NO lleva timestamp (es HMAC del cuerpo pelado), así que una firma
 * válida capturada vale para siempre. La deduplicación por `id` cubre el reintento automático, pero no un reenvío a
 * mano (que llega con `id` nuevo). Lo único que de verdad corta ahí es que el estado y el monto salgan de la relectura:
 * un cuerpo repetido hace releer, y releer dos veces da el mismo resultado idempotente.
 */
export async function procesarEventoCreem(ws: number, ev: EventoCreem, cuenta: string = CUENTA_PRINCIPAL, webhookId?: string | null): Promise<ResultadoEvento> {
  const a = avisoCreem(ev);
  if (a.accion === 'ignorar') return ignorado(a.motivo);

  const key = await credPasarela(claveDeCuenta('CREEM_API_KEY', cuenta), ws);
  // null acá es «no está conectado»; `credPasarela` ya tiró si no se pudo LEER (con la base caída, un null se
  // ignoraría con 200 y el aviso se perdería para siempre: Creem abandona a las 24 h).
  if (!key) return ignorado('Creem no está conectado en este negocio');

  // ── El cobro, SIEMPRE dentro del ws ruteado ──
  const cobro = await cobroDelAviso(ws, {
    proveedor: 'creem', token: a.token, ref: a.checkoutId, suscripcionId: a.suscripcionId, pagoId: a.pagoId,
  });
  if (!cobro) return ignorado(`no es un cobro de MaKo (${ev.tipo})`);
  if (deOtraCuenta(cobro, { cuenta, ref: webhookId ?? null })) {
    return ignorado('el cobro es de otra cuenta de Creem de este negocio', cobro.id);
  }
  // El MODO: un aviso de una clave de prueba no aplica un cobro real, ni al revés.
  const modoClave = modoDeClaveCreem(key);
  if (modoClave && modoClave !== cobro.modo) {
    return ignorado(`el aviso es de una clave ${modoClave} y el cobro es ${cobro.modo}`, cobro.id);
  }

  switch (a.accion) {
    case 'aprobado': {
      // ⚠️ LA PLATA SALE DE LA RELECTURA. En una suscripción, el id del pago es el de la TRANSACCIÓN y no el de la
      // suscripción ni el del checkout: hay una transacción por mes, y usar el id de la suscripción haría que la
      // renovación del mes siguiente se leyera como una reentrega del primer pago (y no se asentaría nunca).
      const susId = a.suscripcionId ?? cobro.proveedor_suscripcion_id;
      if (cobro.tipo === 'suscripcion') {
        if (!susId) return ignorado('el aviso no dice de qué suscripción es', cobro.id);
        const s = await leerSuscripcionCreem(key, susId);
        if (!s.ok) throw errorDelProveedor('Creem', 'la suscripción', s);
        if (s.referencia && s.referencia !== cobro.token) {
          return ignorado('la suscripción del aviso no es la de este cobro', cobro.id);
        }
        const tx = await buscarTransaccionesCreem(key, susId, s.clienteId);
        if (!tx.ok) throw errorDelProveedor('Creem', 'las transacciones de la suscripción', tx);
        const pagadas = tx.transacciones.filter((x) => transaccionQueCobra(cobro, x));
        if (!pagadas.length) return ignorado('la suscripción todavía no tiene un cobro pagado', cobro.id);
        // La que acaba de entrar: la que dice la suscripción («the last paid transaction»), y si no la más NUEVA, porque el listado
        // no tiene orden. `aplicarPagoAprobado` es idempotente por el id del pago, así que una reentrega no asienta dos veces y
        // una renovación entra como lo que es.
        const ultima = pagadas.find((x) => x.id === s.ultimaTransaccionId)
          ?? pagadas.slice().sort((x, y) => Date.parse(y.fecha ?? '') - Date.parse(x.fecha ?? ''))[0];
        // `monto` es SIN impuesto: lo que cobra el plan. El impuesto lo cobra y lo remite Creem (merchant of record),
        // no es ingreso de MaKo y no se asienta como tal.
        await aplicarPagoAprobado(cobro, {
          proveedorPagoId: ultima.id, monto: ultima.monto ?? undefined, moneda: ultima.moneda ?? undefined,
          pagadoAt: ultima.fecha ?? undefined, suscripcionId: susId, autor: `Creem · ${ev.tipo}`,
          // El RECIBO dice lo que pagó la persona (`amount_paid`, con el impuesto aparte): lib/recibos.ts. La cuota sigue con `monto`.
          cobrado: { monto: ultima.montoPagado ?? ultima.monto, moneda: ultima.moneda, impuesto: ultima.impuesto },
        });
        invalidarLecturas();
        return procesado(cobro.id);
      }
      // Pago ÚNICO: la verdad está en el checkout.
      const refCheckout = a.checkoutId ?? cobro.proveedor_ref;
      if (!refCheckout) return ignorado('el aviso no dice de qué checkout es', cobro.id);
      const ch = await leerCheckoutCreem(key, refCheckout);
      if (!ch.ok) throw errorDelProveedor('Creem', 'el checkout', ch);
      if (ch.estado !== 'completed') return ignorado(`el checkout está en ${ch.estado ?? 'sin estado'}`, cobro.id);
      if (ch.referencia !== cobro.token) return ignorado('el checkout del aviso no es de este cobro', cobro.id);
      if (!ch.transaccionId) return ignorado('el checkout todavía no tiene la transacción del pago', cobro.id);
      await aplicarPagoAprobado(cobro, {
        proveedorPagoId: ch.transaccionId, monto: ch.monto ?? undefined, moneda: ch.moneda ?? undefined,
        suscripcionId: null, autor: `Creem · ${ev.tipo}`,
      });
      invalidarLecturas();
      return procesado(cobro.id);
    }
    case 'fallido': {
      // `past_due` / `unpaid` son el período de gracia mientras Creem reintenta. Se anota el fallo (el CRON «Pagos»
      // y la ficha lo muestran) y NO se cancela nada: un reintento puede volver a `active`.
      // ⚠️ CUÁNTAS VECES Y CADA CUÁNTO REINTENTA CREEM: NO ESTÁ DOCUMENTADO en ninguna página de su doc (dice
      // «according to the retry schedule» y nunca define el schedule). Por eso MaKo no predice cuándo se da por
      // perdido: espera el `subscription.canceled`, que es el único estado terminal.
      await aplicarPagoFallido(cobro, `Creem: ${ev.tipo.replace('subscription.', '')}`);
      invalidarLecturas();
      return procesado(cobro.id, 'cobro rechazado: Creem lo está reintentando');
    }
    case 'cancelada': {
      const susId = a.suscripcionId ?? cobro.proveedor_suscripcion_id;
      if (!susId) return ignorado('el aviso no dice de qué suscripción es', cobro.id);
      // Se RELEE: el estado sale de Creem, no del nombre del evento (hay eventos cuyo ejemplo oficial llega con
      // `status: "active"`). Sólo `canceled` es terminal.
      const s = await leerSuscripcionCreem(key, susId);
      if (!s.ok && s.status !== 404) throw errorDelProveedor('Creem', 'la suscripción cancelada', s);
      if (s.ok && s.estado !== 'canceled') return ignorado(`la suscripción está en ${s.estado ?? 'sin estado'}, no cancelada`, cobro.id);
      await aplicarSuscripcionCancelada(cobro);
      invalidarLecturas();
      return procesado(cobro.id, 'suscripción cancelada');
    }
    case 'reembolso': {
      // ⚠️ CUÁL Y CUÁNTO SALEN DE RELEER LA TRANSACCIÓN. Era siempre `total` sobre el primer pago: US$5 devueltos del mes 5 dejaban el
      // cobro «reembolsado» y desmarcaban el mes 1 entero, y un plan vivo desaparecía de «Tu plan». `refunded_amount` incluye el
      // impuesto y no se compara con `amount`: lo dice su estado. `aplicarReembolso` es idempotente.
      if (!a.pagoId) return ignorado('el aviso no dice qué transacción se devolvió', cobro.id);
      const tx = await leerTransaccionCreem(key, a.pagoId);
      if (!tx.ok) throw errorDelProveedor('Creem', 'la transacción devuelta', tx);
      const deEste = tx.suscripcionId ? tx.suscripcionId === cobro.proveedor_suscripcion_id : tx.id === cobro.proveedor_pago_id;
      if (!deEste) return ignorado('la transacción devuelta no es de este cobro', cobro.id);
      // Todavía sin asentar del lado de Creem: que lo reintente, y no se registra una devolución que no se ve.
      if (tx.estado === 'paid') throw new Error(`Creem avisó una devolución y la transacción ${tx.id} sigue pagada`);
      await aplicarReembolso(cobro, { proveedorPagoId: tx.id, total: tx.estado === 'refunded' });
      invalidarLecturas();
      return procesado(cobro.id, tx.estado === 'refunded' ? 'reembolso registrado' : 'reembolso parcial registrado');
    }
    case 'disputa': {
      // `plataAfuera: null` = «no se sabe todavía». La doc de Creem tiene el evento `dispute.created` pero NO dice si
      // al abrirse la disputa la plata ya se descontó (en Stripe eso se lee del balance transaction). Con null,
      // `aplicarContracargo` anota la disputa y NO toca la cuota del CRM: no se desmarca un pago que puede seguir ahí.
      await aplicarContracargo(cobro, {
        fase: 'abierto', texto: textoContracargo({ pasarela: 'creem', fase: 'abierto' }),
        plataAfuera: null, proveedorPagoId: a.pagoId, fechaCargo: ev.creado,
      });
      invalidarLecturas();
      return procesado(cobro.id, 'contracargo abierto');
    }
    default: {
      // El guard va sobre `a`, no sobre `a.accion`: acá `a` ya es `never` (el switch cubre todas las acciones), y
      // pedirle una propiedad a `never` no compila. Así, una acción nueva en `AvisoCreem` rompe el build.
      const _x: never = a;
      return ignorado(`acción desconocida: ${JSON.stringify(_x)}`);
    }
  }
}
