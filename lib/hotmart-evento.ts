// =============================================================================
// hotmart-evento — qué dice un aviso de Hotmart (webhook v2.0.0), sin tocar la base
// =============================================================================
// Hotmart avisa por webhook cada compra, cada carrito abandonado, cada reembolso y cada
// suscripción cancelada de la cuenta del PRODUCTOR. Acá se lee el cuerpo y se decide qué es para
// el CRM: quién (nombre, email, teléfono), qué pasó, y la línea que va al historial del lead.
//
// ⚠️ LA FORMA SALE DE LOS EJEMPLOS DEL WEBHOOK, NO DE LA API REST (regla de AGENTS.md: son dos
// contratos). La referencia es el repo público trichains/hotmart-webhooks (MIT, «Shapes follow the
// official examples»: src/fixtures/index.ts y src/schemas/*.ts), que modela la doc oficial
// https://developers.hotmart.com/docs/en/2.0.0/webhook/purchase-webhook/ con sus contradicciones:
//   · el comprador viene en `data.buyer` en las compras, en `data.buyer` (con `phone`) en el carrito
//     abandonado, en `data.subscriber` en la cancelación de una suscripción y en `data.user` en los
//     eventos del área de miembros (Club);
//   · el teléfono de una compra viene PARTIDO: `checkout_phone` y `checkout_phone_code` (el DDD, que
//     sólo existe en Brasil); en el carrito abandonado viene entero y con el código de país;
//   · un AFILIADO no recibe `buyer`: esa vista no trae a nadie a quien sumar.
// ⚠️ NO MEDIDO contra un aviso real de una cuenta: el primer aviso de un cliente se mira en el
// historial del webhook de Hotmart («Histórico» de la configuración) antes de dar esto por cerrado.
//
// SIN `server-only`: lo prueban los tests (tests/hotmart-evento.test.ts).

/** Qué es el aviso para el CRM. */
export type TipoHotmart =
  | 'abandono' | 'compra' | 'pendiente' | 'vencido' | 'rechazado' | 'reembolso' | 'contracargo'
  | 'reclamo' | 'atrasado' | 'suscripcion_cancelada' | 'primer_acceso' | 'modulo_completo';

/** Los eventos de Hotmart que entran, con lo que son. Lo que no está acá se ignora (y se dice). */
export const EVENTOS_HOTMART: Readonly<Record<string, TipoHotmart>> = {
  PURCHASE_OUT_OF_SHOPPING_CART: 'abandono',
  PURCHASE_APPROVED: 'compra',
  // La compra que pasó la garantía. Es la MISMA transacción que el APPROVED, así que la línea del
  // historial sale idéntica y no se repite; y si el APPROVED no llegó (el aviso se configuró
  // después), éste crea al comprador igual.
  PURCHASE_COMPLETE: 'compra',
  PURCHASE_BILLET_PRINTED: 'pendiente',
  PURCHASE_EXPIRED: 'vencido',
  PURCHASE_CANCELED: 'rechazado',
  PURCHASE_REFUNDED: 'reembolso',
  PURCHASE_CHARGEBACK: 'contracargo',
  PURCHASE_PROTEST: 'reclamo',
  PURCHASE_DELAYED: 'atrasado',
  SUBSCRIPTION_CANCELLATION: 'suscripcion_cancelada',
  CLUB_FIRST_ACCESS: 'primer_acceso',
  CLUB_MODULE_COMPLETED: 'modulo_completo',
};

/**
 * Los que sólo ANOTAN en un lead que ya existe: entrar al área de miembros o terminar un módulo es
 * algo que hace un comprador, y el comprador ya entró con su compra. Si no está, no se inventa un
 * lead por un módulo terminado.
 */
const SOLO_ANOTA: ReadonlySet<TipoHotmart> = new Set(['primer_acceso', 'modulo_completo']);

export type ContactoHotmart = { nombre: string | null; email: string | null; telefono: string | null };

export type EventoHotmart = {
  /** El id del aviso (lo que Hotmart repite si reintenta). */
  id: string;
  /** El nombre crudo del evento (PURCHASE_APPROVED…). */
  evento: string;
  tipo: TipoHotmart;
  /** false = sólo se anota en un lead que ya existe. */
  creaLead: boolean;
  contacto: ContactoHotmart;
  producto: string | null;
  transaccion: string | null;
  monto: { valor: number; moneda: string } | null;
  /** El `src` y el `sck` del link de pago: lo que Hotmart usa como utm. */
  origen: { src: string | null; sck: string | null };
  modulo: string | null;
  /** La fecha del aviso (ms), para la línea del historial. */
  cuando: number | null;
};

/** Por qué un cuerpo no es un evento que entra. */
export type Ignorado = { ignorado: string };

const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const txt = (v: unknown, tope = 200): string | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, tope) : null;
};

const soloDigitos = (v: unknown): string => (txt(v, 40) ?? '').replace(/\D/g, '');

/** Un email que se puede guardar, o null. */
export function emailValido(v: unknown): string | null {
  const t = txt(v, 200)?.toLowerCase() ?? null;
  return t && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t : null;
}

/**
 * EL TELÉFONO DE UNA COMPRA viene partido. `checkout_phone_code` es el DDD de Brasil (el repo de
 * referencia lo dice: «Area code (DDD), Brazilian buyers only»), así que con el país BR se arma
 * +55 + DDD + número. Sin DDD se usa el número tal cual: si ya trae el código de país (11 dígitos o
 * más) va con +, y si no, va como vino (no se le inventa un país).
 */
export function telefonoDeCompra(telefono: unknown, codigo: unknown, pais: unknown): string | null {
  const n = soloDigitos(telefono);
  if (!n) return null;
  const ddd = soloDigitos(codigo);
  const br = typeof pais === 'string' && pais.trim().toUpperCase() === 'BR';
  if (ddd) return br ? `+55${ddd}${n}` : `${ddd}${n}`;
  return n.length >= 11 ? `+${n}` : n;
}

/** El teléfono que viene entero (carrito abandonado: «includes country code»). */
function telefonoEntero(v: unknown): string | null {
  const n = soloDigitos(v);
  if (!n) return null;
  return n.length >= 11 ? `+${n}` : n;
}

function nombreDe(p: Record<string, unknown> | null, email: string | null): string | null {
  const directo = txt(p?.name, 120);
  if (directo) return directo;
  const partes = [txt(p?.first_name, 60), txt(p?.last_name, 60)].filter(Boolean).join(' ').trim();
  if (partes) return partes;
  // Sin nombre, la parte de adelante del email: un lead sin nombre no se puede crear (`createLead`).
  return email ? email.split('@')[0] : null;
}

function montoDe(v: unknown): { valor: number; moneda: string } | null {
  const o = obj(v);
  const valor = typeof o?.value === 'number' ? o.value : Number(o?.value);
  const moneda = txt(o?.currency_value, 3)?.toUpperCase() ?? null;
  return Number.isFinite(valor) && valor > 0 && moneda ? { valor, moneda } : null;
}

/**
 * Lee el cuerpo de un aviso. Devuelve el evento, o `{ ignorado }` con el motivo: un evento que no
 * entra al CRM (un cambio de plan, un envío físico), una forma que no se reconoce, o un aviso sin
 * nadie a quien sumar (la vista de un afiliado no trae comprador).
 */
export function leerEventoHotmart(cuerpo: unknown): EventoHotmart | Ignorado {
  const raiz = obj(cuerpo);
  if (!raiz) return { ignorado: 'el cuerpo no es un objeto' };
  const evento = txt(raiz.event, 60);
  if (!evento) return { ignorado: 'sin «event»' };
  const tipo = EVENTOS_HOTMART[evento];
  if (!tipo) return { ignorado: `el evento ${evento} no entra al CRM` };
  const id = txt(raiz.id, 200);
  if (!id) return { ignorado: 'sin «id»' };
  const data = obj(raiz.data);
  if (!data) return { ignorado: 'sin «data»' };

  const producto = txt(obj(data.product)?.name, 160)
    ?? txt(obj(obj(data.subscription)?.product)?.name, 160)
    ?? null;
  const compra = obj(data.purchase);

  let persona: Record<string, unknown> | null;
  let telefono: string | null;
  if (tipo === 'abandono') {
    persona = obj(data.buyer);
    telefono = telefonoEntero(persona?.phone);
  } else if (tipo === 'suscripcion_cancelada') {
    persona = obj(data.subscriber);
    const tel = obj(persona?.phone);
    // `{ dddCell, cell }`: el mismo DDD de Brasil, sin el país.
    telefono = tel ? telefonoDeCompra(tel.cell, tel.dddCell, null) : telefonoEntero(persona?.phone);
  } else if (tipo === 'primer_acceso' || tipo === 'modulo_completo') {
    persona = obj(data.user);
    telefono = null;
  } else {
    persona = obj(data.buyer);
    const pais = txt(obj(persona?.address)?.country_iso, 2) ?? txt(obj(compra?.checkout_country)?.iso, 2);
    telefono = telefonoDeCompra(persona?.checkout_phone, persona?.checkout_phone_code, pais);
  }

  const email = emailValido(persona?.email);
  if (!email && !telefono) return { ignorado: `${evento} sin email ni teléfono (la vista de un afiliado no trae comprador)` };

  const origen = obj(compra?.origin);
  const fecha = typeof raiz.creation_date === 'number' ? raiz.creation_date : Number(raiz.creation_date);
  return {
    id, evento, tipo, creaLead: !SOLO_ANOTA.has(tipo),
    contacto: { nombre: nombreDe(persona, email), email, telefono },
    producto,
    transaccion: txt(compra?.transaction, 60),
    monto: montoDe(compra?.price) ?? montoDe(compra?.full_price),
    origen: { src: txt(origen?.src, 120), sck: txt(origen?.sck, 120) },
    modulo: txt(obj(data.module)?.name, 160),
    cuando: Number.isFinite(fecha) && fecha > 0 ? fecha : null,
  };
}

const fmtMonto = (m: { valor: number; moneda: string }) => `${m.valor.toFixed(2)} ${m.moneda}`;
const fmtDia = (ms: number | null) => {
  if (ms == null) return null;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
};

/**
 * LA LÍNEA DEL HISTORIAL del lead. Es además la llave de que no se repita: Hotmart reintenta, y el
 * mismo aviso (o el APPROVED y el COMPLETE de una misma transacción) arma el mismo texto, así que
 * se anota una vez (`anotarUnaVez`, lib/fuentes-leads.ts). Por eso lleva la transacción o el día.
 */
export function lineaDelHistorial(e: EventoHotmart): string {
  const prod = e.producto ? `«${e.producto}»` : 'tu producto';
  const tx = e.transaccion ? ` (${e.transaccion})` : '';
  const dia = fmtDia(e.cuando);
  const plata = e.monto ? ` por ${fmtMonto(e.monto)}` : '';
  switch (e.tipo) {
    case 'abandono': return `Abandonó el carrito de ${prod}${dia ? ` el ${dia}` : ''}`;
    case 'compra': return `Compró ${prod}${plata}${tx}`;
    case 'pendiente': return `Generó un pago pendiente de ${prod}${plata}${tx}`;
    case 'vencido': return `Dejó vencer el pago de ${prod}${tx}`;
    case 'rechazado': return `Le rechazaron el pago de ${prod}${tx}`;
    case 'reembolso': return `Pidió el reembolso de ${prod}${tx}`;
    case 'contracargo': return `Hizo un contracargo de ${prod}${tx}`;
    case 'reclamo': return `Abrió un reclamo por ${prod}${tx}`;
    case 'atrasado': return `Tiene atrasado el pago de ${prod}${tx}`;
    case 'suscripcion_cancelada': return `Canceló su suscripción a ${prod}${dia ? ` el ${dia}` : ''}`;
    case 'primer_acceso': return `Entró por primera vez a ${prod}`;
    case 'modulo_completo': return `Terminó el módulo «${e.modulo ?? 'sin nombre'}» de ${prod}`;
  }
}
