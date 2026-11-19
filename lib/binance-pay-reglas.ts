// =============================================================================
// binance-pay-reglas — ¿el pago del comprobante ENTRÓ de verdad a la cuenta de Binance de MaKo? (19/11/2026)
// =============================================================================
// Martín (18/11/2026): «para evitar fraude o que me manden un comprobante y tú le actives la cuenta de una transferencia falsa… te
// fijas si realmente impactó y listo… no me tienes que estar preguntando todo el tiempo a mí». La regla: UN COMPROBANTE SOLO NUNCA
// ACTIVA NADA. Se busca el movimiento real en la cuenta de MaKo (Binance Pay, con la clave de SÓLO LECTURA: lib/binance-pay.ts) y:
//   · calza → se aplica solo (recibo y aviso, como siempre);
//   · todavía no está → no se aplica; se le dice a la agencia que se revisa sola y se vuelve a mirar unas 48 h; después, a Martín;
//   · dos movimientos calzan igual, o el número calza y el monto no → a Martín.
// Puro: sin base ni red. Lo prueba tests/binance-pay-calce.test.ts.
//
// ⚠️ EL NÚMERO DE 18 CIFRAS DEL COMPROBANTE ES `orderId`, NO `transactionId` (medido el 19/11/2026 contra los 6 recibos de Código y
// Leila: todos sus números están en `orderId`; `transactionId` es otra cosa, «P_A25PQJVAD2171114»). El brief del 18/11 decía
// `transactionId`: con eso no calzaba NINGÚN pago.
// ⚠️ UN NÚMERO MAL LEÍDO PASA: el pago de Código del 16/11 quedó anotado como «4660001999873228880» (19 cifras, un 0 de más) y en
// Binance es «466000199987322880». Por eso, si el número no aparece, se calza por MONTO EXACTO + VENTANA DE TIEMPO + QUIÉN PAGA
// (la regla del Cerebro con la corrección de Martín, docs/pendientes-partners-pagos-1811.md), y entonces se anota el número REAL.
// =============================================================================

/** Un pago que MaKo RECIBIÓ por Binance Pay (sólo entradas: `amount` > 0). */
export type MovimientoBinance = {
  /** El número de 18 cifras que sale en el comprobante. */
  orderId: string;
  /** Cuándo entró (ms). */
  at: number;
  monto: number;
  /** USDT, USDC, BTC… tal cual lo dice Binance. */
  moneda: string;
  pagadorNombre: string | null;
  /** El Binance ID de quien pagó (puede faltar: Binance no siempre lo da). */
  pagadorId: string | null;
};

/** Las monedas que valen dólares uno a uno. Otra (BTC) no se convierte sola: va a Martín. */
export const MONEDAS_DOLAR: readonly string[] = ['USDT', 'USDC', 'FDUSD', 'USD'];
export const esDolarBinance = (moneda: string | null | undefined): boolean => MONEDAS_DOLAR.includes(String(moneda ?? '').trim().toUpperCase());

/** Cuánto se espera a que aparezca un pago que el comprobante dice que se hizo, antes de pasárselo a Martín. */
export const HORAS_DE_ESPERA = 48;
/** Hasta cuánto ANTES del comprobante puede haber entrado el pago (una foto vieja de un pago de ayer). */
export const HORAS_ANTES = 72;
/** Y hasta cuánto DESPUÉS de la hora que dice el comprobante (relojes y zonas: el comprobante dice la hora del teléfono). */
export const HORAS_DESPUES = 24;

const num = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : null);

/**
 * Una fila de `GET /sapi/v1/pay/transactions`, como un movimiento recibido; null si no es una entrada o le falta algo. Binance da el
 * monto con signo: positivo es lo que entró, negativo lo que salió.
 */
export function movimientoDeBinance(fila: unknown): MovimientoBinance | null {
  if (!fila || typeof fila !== 'object') return null;
  const f = fila as Record<string, unknown>;
  const orderId = texto(f.orderId);
  const monto = num(f.amount);
  const at = num(f.transactionTime);
  const moneda = texto(f.currency);
  if (!orderId || !/^\d{6,30}$/.test(orderId) || !Number.isFinite(monto) || monto <= 0 || !Number.isFinite(at) || !moneda) return null;
  const pagador = (f.payerInfo && typeof f.payerInfo === 'object' ? f.payerInfo : {}) as Record<string, unknown>;
  return { orderId, at, monto, moneda: moneda.toUpperCase(), pagadorNombre: texto(pagador.name), pagadorId: texto(pagador.binanceId) };
}

/** Dos montos iguales al centavo. */
export const mismoMonto = (a: number, b: number): boolean => Math.abs(Math.round(a * 100) - Math.round(b * 100)) <= 0;

/** ¿`a` y `b` difieren en a lo sumo UN dígito (uno de más, uno de menos o uno cambiado)? */
export function difiereEnUnDigito(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  // Saltear el dígito distinto en el más largo (o en los dos si miden lo mismo) y el resto tiene que ser igual.
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/**
 * LOS NÚMEROS YA USADOS, con los MAL COPIADOS adentro. Un número anotado (libro o recibo) que NO existe en la cuenta pero difiere en un
 * solo dígito de uno que sí, es ése mal copiado: se lo da por usado. Sin esto, el pago de Código del 16/11 (anotado «4660001999873228880»,
 * real «466000199987322880») quedaba «sin usar», y el mismo comprobante reenviado calzaba por monto y se contaba DOS veces.
 */
export function numerosUsados(anotados: Iterable<string>, movs: readonly MovimientoBinance[]): Set<string> {
  const usadas = new Set<string>();
  const reales = new Set(movs.map((m) => m.orderId));
  for (const a of anotados) {
    const n = String(a).trim().toUpperCase();
    if (!n) continue;
    usadas.add(n);
    if (reales.has(n)) continue;
    for (const m of movs) if (difiereEnUnDigito(n, m.orderId)) usadas.add(m.orderId);
  }
  return usadas;
}

export type Calce =
  /** Entró, y es éste. `por`: el número exacto, o el monto + la hora (+ quién paga). */
  | { tipo: 'calza'; mov: MovimientoBinance; por: 'orden' | 'monto' }
  /** Todavía no está en la cuenta (o la cuenta no contestó): se vuelve a mirar. */
  | { tipo: 'no-entro' }
  /** Lo decide una persona: el porqué en una frase para Martín. */
  | { tipo: 'revisar'; porque: string };

/**
 * ¿CALZA el pago del comprobante con un movimiento REAL de la cuenta? `usadas`: los números ya anotados en algún lado (recibos,
 * libros de las agencias): un movimiento cuenta UNA vez. `conocidos`: los Binance ID que ya le pagaron a MaKo por esta cuenta.
 *
 *   1. El número del comprobante está en la cuenta → calza si el monto es el mismo y no se usó; el monto distinto va a Martín (el
 *      comprobante dice una cosa y la cuenta otra), y uno ya usado también (no es «todavía no entró»: entró y ya se contó).
 *   2. No está (no se leyó, o se leyó mal) → los movimientos sin usar, en dólares, del MISMO monto al centavo, entre `HORAS_ANTES` antes y
 *      `HORAS_DESPUES` después de la hora del pago. Uno solo → calza. Varios → si UNO solo es de alguien que ya le pagó a MaKo por esta
 *      cuenta, ése; si no, a Martín (dos pagos iguales a la vez no se adivinan). Ninguno → todavía no entró.
 */
export function calzarConBinance(
  pedido: { orden: string | null; monto: number; at: number },
  movs: readonly MovimientoBinance[],
  o: { usadas: ReadonlySet<string>; conocidos?: ReadonlySet<string> },
): Calce {
  if (!(pedido.monto > 0) || !Number.isFinite(pedido.at)) return { tipo: 'revisar', porque: 'el comprobante no dice bien el monto o la fecha' };
  const porNumero = pedido.orden ? movs.find((m) => m.orderId === pedido.orden) : undefined;
  if (porNumero) {
    if (o.usadas.has(porNumero.orderId)) return { tipo: 'revisar', porque: `la orden ${porNumero.orderId} ya está anotada` };
    if (!esDolarBinance(porNumero.moneda)) return { tipo: 'revisar', porque: `en la cuenta entró en ${porNumero.moneda}, no en dólares` };
    if (!mismoMonto(porNumero.monto, pedido.monto)) {
      return { tipo: 'revisar', porque: `el comprobante dice US$ ${pedido.monto} y en la cuenta de Binance la orden ${porNumero.orderId} es de ${porNumero.monto} ${porNumero.moneda}` };
    }
    return { tipo: 'calza', mov: porNumero, por: 'orden' };
  }
  const desde = pedido.at - HORAS_ANTES * 3_600_000;
  const hasta = pedido.at + HORAS_DESPUES * 3_600_000;
  const candidatos = movs.filter((m) => !o.usadas.has(m.orderId) && esDolarBinance(m.moneda) && mismoMonto(m.monto, pedido.monto) && m.at >= desde && m.at <= hasta);
  if (candidatos.length === 1) return { tipo: 'calza', mov: candidatos[0], por: 'monto' };
  if (candidatos.length > 1) {
    const deConocidos = o.conocidos?.size ? candidatos.filter((m) => m.pagadorId != null && o.conocidos!.has(m.pagadorId)) : [];
    if (deConocidos.length === 1) return { tipo: 'calza', mov: deConocidos[0], por: 'monto' };
    return { tipo: 'revisar', porque: `en la cuenta hay ${candidatos.length} pagos de ${pedido.monto} a esa hora y el comprobante no dice cuál es` };
  }
  return { tipo: 'no-entro' };
}

/** El momento del pago que dice el comprobante (`fecha` AAAA-MM-DD y `hora` HH:MM, sin zona: se toma como UTC-3 de Argentina); si no
 *  dice fecha, el momento en que llegó. Un error de zona lo cubre la ventana de `HORAS_DESPUES`. */
export function momentoDelComprobante(fecha: string | null | undefined, hora: string | null | undefined, recibido: number): number {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return recibido;
  const h = hora && /^\d{1,2}:\d{2}/.test(hora) ? hora.slice(0, 5).padStart(5, '0') : '12:00';
  const t = Date.parse(`${fecha}T${h}:00-03:00`);
  // Una fecha del futuro (mal leída) no puede correr la ventana hacia adelante: se usa la de llegada.
  return Number.isFinite(t) && t <= recibido + HORAS_DESPUES * 3_600_000 ? t : recibido;
}

/** Lo que se le dice a la agencia mientras el pago no aparece (lo arma el código, nunca un modelo). */
export const TEXTO_ESPERANDO_EL_PAGO = 'Recibí tu comprobante. Todavía no veo el pago en la cuenta de MaKo: lo reviso solo en un rato y te aviso por aquí.';

/** ¿Ya pasó el tiempo de espera de un comprobante que llegó en `desde` (ISO)? */
export const seVencioLaEspera = (desde: string, ahora: number): boolean => {
  const t = Date.parse(desde);
  return !Number.isFinite(t) || ahora - t >= HORAS_DE_ESPERA * 3_600_000;
};
