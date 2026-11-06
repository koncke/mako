// =============================================================================
// dlocal-reglas — lo que se decide de dLocal Go SIN red (y por eso tiene test)
// =============================================================================
// Puro y SIN `server-only`, a propósito y por el mismo motivo que lib/cobros-reglas.ts: lo ejecuta
// tests/dlocal-api.test.ts, y una regla que vive adentro del módulo que habla con la red es lo único
// que queda sin red justo donde más duele (AGENTS.md → «Un guard sobre algo destructivo se escribe
// en POSITIVO»). lib/dlocal-api.ts es el que llama a la API y usa esto.
//
// Lo que no se ve en el código y muerde (docs.dlocalgo.com, leído el 06/11/2026; la cuenta de MaKo
// medida el mismo día):
//   · LAS DOS CLAVES VAN EN UN SOLO HEADER: `Authorization: Bearer <API_KEY>:<SECRET_KEY>`. No es
//     `Bearer <token>` ni Basic. Con el formato mal armado dLocal contesta 403 «Invalid Credentials»,
//     el MISMO código que una clave equivocada: un error de formato se lee como «la clave no sirve»,
//     y la persona la copia de nuevo en vano.
//   · NO HAY SANDBOX EN LA MISMA CUENTA: el sandbox es otra cuenta con OTRAS claves
//     (api-sbx.dlocalgo.com). Medido el 06/11/2026 con las claves de MaKo: 200 en api.dlocalgo.com,
//     403 en api-sbx.dlocalgo.com. O sea que el modo NO se deduce de la clave (son 32 y 40
//     caracteres sin prefijo, al revés de `sk_live_`/`rk_test_` de Stripe): sólo se sabe preguntando.
//   · `GET /v1/me` DICE SI LA CUENTA PUEDE COBRAR DE VERDAD, y es lo único que lo dice. No hay un
//     `charges_enabled` como en Stripe: son tres campos, y los tres pueden estar mal con la clave
//     perfecta. Ver `cuentaPuedeCobrar`.
//   · EL MONTO ES DECIMAL, no unidades mínimas (al revés que Stripe, igual que Mercado Pago).
//   · CINCO ESTADOS, Y DOS NO SON UN PAGO FALLIDO. Ver `queHacerConPagoDlocal`.

/** Producción y sandbox son CUENTAS distintas, con claves distintas. */
export const DLOCAL_API = 'https://api.dlocalgo.com';
export const DLOCAL_API_SBX = 'https://api-sbx.dlocalgo.com';

export type ModoDlocal = 'real' | 'prueba';
export const baseDlocal = (modo: ModoDlocal): string => (modo === 'prueba' ? DLOCAL_API_SBX : DLOCAL_API);

/** Las dos claves que hacen una llamada. `secret` es además la que verifica la firma del aviso. */
export type ClavesDlocal = { apiKey: string; secret: string };

/**
 * El formato EXACTO del header, en UN solo lugar para que el test lo fije: armarlo mal da 403, el
 * mismo código que una clave inválida.
 */
export const authDlocal = (c: ClavesDlocal): string => `Bearer ${c.apiKey}:${c.secret}`;

/** Decimal con dos lugares: dLocal rechaza un monto con más, y un float suelto trae 47.000000001. */
export const decimalDlocal = (n: number): number => Math.round(n * 100) / 100;

// ── Los helpers de lectura: un campo que falta es null, nunca un 0 ni un '' que decidan ───────────

export type Json = Record<string, unknown>;
export const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
export const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : null);
export const num = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

// ── La cuenta ────────────────────────────────────────────────────────────────────────────────────

export type CuentaDlocal = {
  /** El `merchant_id`: es el identificador de ruteo del webhook (como el user_id de Mercado Pago). */
  id: string;
  /** La moneda del SALDO de la cuenta, no la del cobro. */
  moneda: string | null;
  modo: ModoDlocal;
  kycNivel: number | null;
  kycEstado: string | null;
  enRevisionDeFraude: boolean;
  topeExcedido: boolean;
};

export function cuentaDlocalDeCuerpo(b: Json, modo: ModoDlocal): CuentaDlocal | null {
  const id = str(b.merchant_id);
  if (!id) return null;
  return {
    id,
    moneda: str(b.currency),
    modo,
    kycNivel: num(b.kyc_level),
    kycEstado: str(b.kyc_level_status),
    enRevisionDeFraude: b.is_in_fraud_review === true,
    topeExcedido: b.is_limit_exceeded === true,
  };
}

/**
 * Por qué una cuenta que contesta 200 igual no cobra. Devuelve null si puede cobrar, o la frase de
 * lo que falta (para la tarjeta de /integraciones).
 *
 * ⚠️ MEDIDO EN LA CUENTA DE MAKO EL 06/11/2026, y es el motivo de que esta función exista:
 * `kyc_level: 2`, `kyc_level_status: "PENDING"`, `is_in_fraud_review: true`. O sea que la cuenta
 * contesta 200 a todo, publica sus 32 monedas, y NO cobra. Sin esta lectura la tarjeta diría
 * «Conectada» y el primer comprador se encontraría con un checkout que rechaza.
 */
export function cuentaPuedeCobrar(c: CuentaDlocal): string | null {
  if (c.enRevisionDeFraude) return 'dLocal Go tiene la cuenta en revisión de fraude: todavía no cobra.';
  if (c.topeExcedido) return 'La cuenta llegó a su tope de dLocal Go: no cobra hasta que lo levanten.';
  // `kyc_level_status` es el estado del nivel que figura en `kyc_level`: PENDING en el nivel 2
  // significa «lo pedí y no está aprobado», no «estoy en el nivel 2».
  const estado = String(c.kycEstado ?? '').trim().toUpperCase();
  if (estado && estado !== 'APPROVED' && estado !== 'ACCEPTED') {
    return `dLocal Go todavía no aprobó los papeles de la cuenta (nivel ${c.kycNivel ?? '—'}: ${estado}).`;
  }
  return null;
}

// ── El pago ──────────────────────────────────────────────────────────────────────────────────────

export type PagoDlocal = {
  id: string;
  estado: string | null;
  detalle: string | null;
  monto: number | null;
  moneda: string | null;
  /** Lo que de verdad entra a la cuenta, y la comisión de dLocal por esa venta. */
  acreditado: number | null;
  comision: number | null;
  monedaSaldo: string | null;
  pais: string | null;
  /** `order_id`: el token del cobro de MaKo. Es el ÚNICO cruce con el CRM. */
  referencia: string | null;
  rechazo: string | null;
  creado: string | null;
  aprobado: string | null;
};

export function pagoDlocalDeCuerpo(b: Json): PagoDlocal | null {
  const id = str(b.id);
  if (!id) return null;
  return {
    id,
    estado: str(b.status),
    detalle: str(b.status_detail),
    monto: num(b.amount),
    moneda: str(b.currency),
    acreditado: num(b.balance_amount),
    comision: num(b.balance_fee),
    monedaSaldo: str(b.balance_currency),
    pais: str(b.country),
    referencia: str(b.order_id),
    rechazo: str(b.rejected_reason),
    creado: str(b.created_date),
    aprobado: str(b.approved_date),
  };
}

/** Los cinco estados de un pago de dLocal Go (docs.dlocalgo.com → Retrieve a payment). */
export const ESTADOS_DLOCAL = ['PENDING', 'PAID', 'REJECTED', 'CANCELLED', 'EXPIRED'] as const;

/**
 * Qué hacer con un pago releído.
 *
 * ⚠️ NO ES UN TERNARIO DE DOS RAMAS, A PROPÓSITO. Con `estado === 'PAID' ? 'aprobado' : 'fallido'`,
 * `CANCELLED` y `EXPIRED` se vuelven «el pago se rechazó» — y MaKo le escribe eso al lead cuando
 * nadie intentó pagar nunca (se canceló el checkout, o venció el link), con el cobro todavía
 * cobrable. Es la misma familia de los «53 ternarios de dos ramas» que costó agregar la tercera
 * pasarela la vez anterior. Y un estado que dLocal agregue mañana cae en 'ignorar' NOMBRÁNDOSE, no
 * en «pagado» ni en «fallido» por descarte.
 */
export function queHacerConPagoDlocal(p: PagoDlocal): { accion: 'aprobado' | 'fallido' | 'ignorar'; motivo: string } {
  const e = String(p.estado ?? '').trim().toUpperCase();
  if (e === 'PAID') return { accion: 'aprobado', motivo: 'pagado' };
  if (e === 'REJECTED') return { accion: 'fallido', motivo: p.rechazo ? `dLocal Go rechazó el pago: ${p.rechazo}` : 'dLocal Go rechazó el pago.' };
  if (e === 'CANCELLED') return { accion: 'ignorar', motivo: 'el pago se canceló antes de intentarse' };
  if (e === 'EXPIRED') return { accion: 'ignorar', motivo: 'el link del pago venció' };
  if (e === 'PENDING') {
    // PAYMENT_FAILED adentro de PENDING es un intento rechazado con el cobro todavía abierto.
    const d = String(p.detalle ?? '').trim().toUpperCase();
    if (d === 'PAYMENT_FAILED') return { accion: 'ignorar', motivo: 'un intento se rechazó y el pago sigue abierto' };
    return { accion: 'ignorar', motivo: 'el pago todavía está pendiente' };
  }
  return { accion: 'ignorar', motivo: `estado ${e || 'sin estado'}: MaKo no lo procesa` };
}

// ── La devolución: su propio id y sus propios estados ────────────────────────────────────────────

export type ReembolsoDlocal = {
  id: string;
  pagoId: string | null;
  monto: number | null;
  moneda: string | null;
  estado: string | null;
  creado: string | null;
};

/** Los cuatro estados de una DEVOLUCIÓN (docs.dlocalgo.com → Create a refund). No son los del pago. */
export const ESTADOS_REEMBOLSO_DLOCAL = ['PENDING', 'SUCCESS', 'REJECTED', 'CANCELLED'] as const;

export function reembolsoDlocalDeCuerpo(b: Json): ReembolsoDlocal | null {
  const id = str(b.id);
  if (!id) return null;
  return {
    id,
    pagoId: str(b.payment_id),
    monto: num(b.amount),
    moneda: str(b.currency),
    estado: str(b.status),
    creado: str(b.created_date),
  };
}

// ── De dónde puede pagar alguien ─────────────────────────────────────────────────────────────────

/**
 * Los países desde los que esta cuenta PUEDE recibir un pago.
 *
 * ⚠️ NO RECIBE PAGOS DE ESTADOS UNIDOS NI DE EUROPA. Está escrito en el centro de ayuda de dLocal Go
 * («You cannot receive payments from the United States and Europe»,
 * helpcenter.dlocalgo.com/en/articles/7229161) y confirmado en la refutación del 5/11/2026 de
 * docs/proveedores-de-cobro.md. Un comprador de allá NO puede ir por este camino: hay que ofrecerle
 * otro, no dejarlo rebotar en el checkout.
 *
 * ⚠️ Y UNA TASA DE CAMBIO NO ES UN PERMISO. `GET /v1/currency-exchanges` de la cuenta de MaKo
 * devuelve 32 monedas, EUR y GBP entre ellas (medido el 06/11/2026). Que exista la tasa NO habilita
 * a ese comprador: lo que decide es esta lista, nunca la de monedas.
 *
 * Es deliberadamente una lista BLANCA: con una lista negra, un país nuevo entraría solo y sin que
 * nadie lo mida (AGENTS.md → «Un guard sobre algo destructivo se escribe en POSITIVO»).
 */
export const PAISES_DLOCAL: readonly string[] = ['AR', 'BR', 'MX', 'CL', 'CO', 'PE', 'UY', 'PY', 'BO', 'EC', 'CR', 'GT', 'DO', 'NI', 'HN', 'PA', 'SV'];

export const paisCobrableDlocal = (pais: string | null | undefined): boolean =>
  PAISES_DLOCAL.includes(String(pais ?? '').trim().toUpperCase());
