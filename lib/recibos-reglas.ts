// =============================================================================
// recibos-reglas — lo que decide un RECIBO de MaKo sin tocar la base (5/11/2026)
// =============================================================================
// Puro y SIN `server-only` a propósito: lo importan los tests, la pantalla de SuperAdmin (Admin › Billing) y el PDF.
// El envío y la base viven en lib/recibos.ts; el documento, en lib/recibo-pdf.ts; el número, en la función SQL
// `emitir_recibo` (mig 0397). El diseño y sus agujeros: docs/relevo/recibos-encargo.md.
//
// ⚠️ ES UN RECIBO DE PAGO, NO UNA FACTURA FISCAL. Lo dice el PDF y lo dice el correo, con un pie que no se puede editar
// (`PIE_FIJO`). Si un negocio tiene que facturar (ARCA, el SAT…), eso va aparte y lo decide su contador.
//
// ⚠️ TODA DIFERENCIA ENTRE PASARELAS SE LEE DE `CAPACIDADES_PASARELA` O DE UN `Record<…>` TOTAL, nunca con un ternario de
// dos ramas (AGENTS.md, «Un cobro pasa por lib/cobros.ts»).

import { CAPACIDADES_PASARELA, esPasarela, type Pasarela } from './cobros-tipos';
import { formatoMonto } from './pasarela-moneda';
import { instanteDe } from './cron-aviso';

// ─────────────────────────────────────────────────────────────────────────────
// Los medios de pago
// ─────────────────────────────────────────────────────────────────────────────

export const MEDIOS = ['mercadopago', 'stripe', 'creem', 'binance', 'transferencia', 'efectivo', 'otro'] as const;
export type MedioRecibo = (typeof MEDIOS)[number];
export const esMedio = (v: unknown): v is MedioRecibo => MEDIOS.includes(v as MedioRecibo);

export const ROTULO_MEDIO: Readonly<Record<MedioRecibo, string>> = {
  mercadopago: 'Mercado Pago', stripe: 'Stripe', creem: 'Creem', binance: 'Binance', transferencia: 'Transferencia', efectivo: 'Efectivo', otro: 'Otro',
};

/** El rótulo de la referencia de cada medio («Order ID» en Binance, como en el 0002). */
export const ROTULO_REFERENCIA: Readonly<Record<MedioRecibo, string>> = {
  mercadopago: 'N.º de operación', stripe: 'Referencia', creem: 'Transacción', binance: 'Order ID', transferencia: 'Referencia', efectivo: 'Referencia', otro: 'Referencia',
};

/**
 * Cómo aparece el cargo en la tarjeta, si la pasarela es merchant of record. Creem: «CREEM.IO* STORE» (su doc,
 * /for-customers/why-creem-charged-me). Las demás cobran a nombre del negocio.
 */
const DESCRIPTOR_MOR: Readonly<Record<Pasarela, string | null>> = { stripe: null, mercadopago: null, creem: 'CREEM.IO* STORE' };

/**
 * LA REFERENCIA, NORMALIZADA: es media llave del pago (`recibo_pagos (medio, referencia)`), así que un espacio o un guion de
 * más no pueden volverla «otra orden». Binance: los 18 dígitos de la orden (lo que se ve en el comprobante, con o sin
 * espacios). null = no sirve (y quien carga tiene que corregirla).
 */
export function referenciaNormal(medio: MedioRecibo, ref: unknown): string | null {
  const t = String(ref ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (medio === 'binance') {
    const d = t.replace(/[\s-]/g, '');
    return /^\d{18,20}$/.test(d) ? d : null;
  }
  if (medio === 'mercadopago') return /^\d{1,20}$/.test(t) ? t : null;
  return t.length <= 200 ? t : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// La clave del recibo (la segunda llave, aparte de la del pago)
// ─────────────────────────────────────────────────────────────────────────────

export type ClaveRecibo =
  | { tipo: 'pago'; medio: MedioRecibo; id: string }
  | { tipo: 'mensualidad'; agenciaWs: number; mes: string }
  | { tipo: 'diferencial'; agenciaWs: number; clienteWs: number; mes: string }
  | { tipo: 'form'; uuid: string };

const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `pago:<medio>:<id>` (la pasarela), `mensualidad:<agencia>:<AAAA-MM>` y `diferencial:<agencia>:<cliente>:<AAAA-MM>` (la rama de
 * agencias, `punta/agencia-cobro`), `form:<uuid>` (el formulario «Cargar pago»: el uuid se genera al abrir, así un doble clic no da
 * dos recibos). El formulario NUNCA usa `mensualidad:`: con la clave del mes, un segundo pago del mismo mes contestaba «ya estaba»
 * con el recibo viejo (docs/relevo/recibos-encargo.md, agujero 2). Tira si la forma no sirve.
 */
export function claveDeRecibo(c: ClaveRecibo): string {
  switch (c.tipo) {
    case 'pago': if (!c.id.trim()) throw new Error('falta el id del pago'); return `pago:${c.medio}:${c.id.trim()}`.slice(0, 200);
    case 'mensualidad': if (!MES_RE.test(c.mes) || !(c.agenciaWs > 0)) throw new Error('mensualidad inválida'); return `mensualidad:${c.agenciaWs}:${c.mes}`;
    case 'diferencial': if (!MES_RE.test(c.mes) || !(c.agenciaWs > 0) || !(c.clienteWs > 0)) throw new Error('diferencial inválido'); return `diferencial:${c.agenciaWs}:${c.clienteWs}:${c.mes}`;
    case 'form': if (!UUID_RE.test(c.uuid)) throw new Error('formulario inválido'); return `form:${c.uuid.toLowerCase()}`;
    default: { const _x: never = c; throw new Error(`clave desconocida: ${JSON.stringify(_x)}`); }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// A QUIÉN LE LLEGA (docs/relevo/recibos-encargo.md, «A quién le llega», con los arreglos de los agujeros)
// ─────────────────────────────────────────────────────────────────────────────

export type PagaRecibo = 'solo' | 'cliente' | 'agencia' | 'manual';

export type EntradaDestino = {
  agenciaWs: number | null;
  clienteWs: number | null;
  /**
   * `agency.quien_paga` del CLIENTE, leído ESTRICTO por quien llama. undefined = no se pudo leer: entonces esto TIRA y el recibo
   * queda sin salir hasta poder leerlo (nunca cae a «no es de agencia»: le mandaría el PDF al correo equivocado).
   */
  quienPaga?: 'agencia' | 'cliente' | null;
  altaWs: number | null;
  email: string | null;
  nombreCobro: string | null;
  nombreAgencia?: string | null;
  nombreCliente?: string | null;
  nombreAlta?: string | null;
};

export type Destino =
  | { paga: 'sin_destino'; motivo: string; aNombre: string }
  | {
    paga: Exclude<PagaRecibo, 'manual'>;
    /** De quién son los admins que reciben el correo, y el grupo. null = nadie con cuenta (sólo `emailSuelto`). */
    destinoWs: number | null;
    /** El correo de quien pagó, sólo si NO hay cuenta: con la cuenta hecha mandan sus admins (el correo del cobro puede ser viejo). */
    emailSuelto: string | null;
    /** Ni grupo ni hilo: el grupo de un cliente de agencia lo ven los admins de la agencia (agujero 1). */
    soloCorreo: boolean;
    aNombre: string;
    /** El nombre del cliente va en el renglón cuando paga la agencia: el recibo lo ve sólo la agencia. */
    clienteEnElRenglon: string | null;
  };

const limpio = (s: string | null | undefined): string => String(s ?? '').replace(/\s+/g, ' ').trim();
const localDelCorreo = (e: string | null): string => limpio(e).split('@')[0] ?? '';

/**
 * El destino de un recibo de la PASARELA, congelado al emitir. Reglas:
 *   · sin agencia: quien pagó solo. Correo a los admins de su cuenta si ya la tiene (`altaWs`), si no al correo del cobro. Grupo e
 *     hilo de su cuenta, si la tiene.
 *   · con agencia y cliente, y paga el CLIENTE: correo a los admins del cliente (o al correo del cobro si no hay ninguno). Sólo
 *     correo: el grupo del cliente lo ven los admins de su agencia.
 *   · con agencia y cliente, y paga la AGENCIA (o sin elegir): correo a los admins de la agencia, su grupo, a nombre de la
 *     agencia, con el cliente en el renglón. NUNCA al cliente ni al correo del cobro (puede ser otro).
 *   · con UNO solo de los dos: `sin_destino` (la 0308 tiene `on delete set null` en cada uno: es un cobro roto, no uno propio).
 * Tira si hay agencia y no se pudo leer quién paga (`quienPaga === undefined`).
 */
export function destinoDelRecibo(e: EntradaDestino): Destino {
  const conAgencia = e.agenciaWs != null;
  const conCliente = e.clienteWs != null;
  if (conAgencia !== conCliente) {
    return { paga: 'sin_destino', motivo: 'el cobro tiene agencia o cliente, pero no los dos', aNombre: limpio(e.nombreCobro) || localDelCorreo(e.email) || 'Sin nombre' };
  }
  if (conAgencia && conCliente) {
    if (e.quienPaga === undefined) throw new Error('no pude leer quién paga la cuenta del cliente');
    if (e.quienPaga === 'cliente') {
      return {
        paga: 'cliente', destinoWs: e.clienteWs, emailSuelto: null, soloCorreo: true,
        aNombre: limpio(e.nombreCliente) || localDelCorreo(e.email) || `Cuenta ${e.clienteWs}`, clienteEnElRenglon: null,
      };
    }
    return {
      paga: 'agencia', destinoWs: e.agenciaWs, emailSuelto: null, soloCorreo: false,
      aNombre: limpio(e.nombreAgencia) || `Agencia ${e.agenciaWs}`, clienteEnElRenglon: limpio(e.nombreCliente) || `cuenta ${e.clienteWs}`,
    };
  }
  const email = limpio(e.email).toLowerCase() || null;
  return {
    paga: 'solo', destinoWs: e.altaWs, emailSuelto: e.altaWs == null ? email : null, soloCorreo: e.altaWs == null,
    aNombre: limpio(e.nombreCobro) || limpio(e.nombreAlta) || localDelCorreo(email) || 'Sin nombre', clienteEnElRenglon: null,
  };
}

/**
 * A quién le llega el CORREO, al despachar: los admins de la cuenta (o, si no tiene ninguno, el correo suelto del cobro), en
 * minúsculas y sin repetir. La pasarela de quien pagó solo puede ganar su cuenta DESPUÉS de emitir (el alta corre después del
 * recibo): por eso `destinoWs` se completa al despachar con el `alta_ws` del cobro, y sólo en ese caso.
 */
export function correosDelRecibo(admins: readonly string[], emailSuelto: string | null): string[] {
  const lista = admins.length ? admins : emailSuelto ? [emailSuelto] : [];
  return [...new Set(lista.map((x) => limpio(x).toLowerCase()).filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)))].slice(0, 10);
}

/**
 * Un recibo CARGADO A MANO a una cuenta: ¿se puede, y a quién? La cuenta que está aprobada en la cartera de una agencia y no la
 * paga ella misma no recibe el recibo (agujero 4: el PDF, con el precio y el comprobante de quien pagó, le llegaba al cliente
 * final). La que se paga sola y tiene agencia, sólo por correo. Lectura estricta: quien llama tira si no pudo leer.
 */
export function validarDestinoManual(e: { agencias: ReadonlyArray<{ agenciaWs: number; nombre: string }>; quienPaga: 'agencia' | 'cliente' | null }):
  { ok: true; soloCorreo: boolean } | { ok: false; error: string } {
  if (!e.agencias.length) return { ok: true, soloCorreo: false };
  if (e.quienPaga === 'cliente') return { ok: true, soloCorreo: true };
  const nombres = e.agencias.map((a) => a.nombre || `la agencia ${a.agenciaWs}`).join(' y ');
  return { ok: false, error: `Esta cuenta la paga ${nombres}. Elige la cuenta de la agencia.` };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que dice el documento
// ─────────────────────────────────────────────────────────────────────────────

export const numeroEnTexto = (n: number): string => String(Math.max(0, Math.trunc(n))).padStart(4, '0');

/** El pie que no se edita. Va en el PDF y en el correo. */
export const PIE_FIJO = (aNombre: string): string => `Este recibo acredita el pago. No es una factura fiscal. Es sólo para ${limpio(aNombre) || 'quien pagó'}.`;
export const ES_RECIBO_NO_FACTURA = 'Es un recibo de pago, no una factura fiscal.';

/** ¿Algún pago del recibo lo cobró una pasarela que es merchant of record (Creem)? */
export const conMerchantOfRecord = (medios: readonly string[]): Pasarela | null =>
  (medios.find((m) => esPasarela(m) && CAPACIDADES_PASARELA[m].merchantOfRecord) as Pasarela | undefined) ?? null;

/**
 * Los rótulos del documento. Con una pasarela merchant of record (Creem) el vendedor legal es ELLA: «Recibimos de» y «Total
 * recibido» afirmarían algo que no pasó (agujero 11). Mismo número, otro título.
 */
export function rotulosDelDocumento(medios: readonly string[]): { titulo: string; nombre: string; total: string } {
  return conMerchantOfRecord(medios)
    ? { titulo: 'Confirmación de pago', nombre: 'Pagó', total: 'Total pagado' }
    : { titulo: 'Recibo de pago', nombre: 'Recibimos de', total: 'Total recibido' };
}

/** La leyenda del medio, para el PDF y el correo. Sólo la pasarela merchant of record suma algo. */
export function leyendaDelMedio(medios: readonly string[]): string | null {
  const p = conMerchantOfRecord(medios);
  if (!p) return null;
  const nombre = { stripe: 'Stripe', mercadopago: 'Mercado Pago', creem: 'Creem' }[p];
  const desc = DESCRIPTOR_MOR[p];
  return `Pago procesado por ${nombre}.${desc ? ` En tu tarjeta aparece como ${desc}.` : ''} La factura, si corresponde, la emite ${nombre}.`;
}

/** La línea del impuesto, sólo si es mayor que cero (agujero 11: «Impuesto incluido: US$ 0» no dice nada). */
export function lineaDeImpuesto(impuesto: number | null | undefined, moneda: string, medios: readonly string[]): string | null {
  if (!(Number(impuesto) > 0)) return null;
  const p = conMerchantOfRecord(medios);
  return `Impuesto incluido: ${formatoMonto(Number(impuesto), moneda)}${p ? `, lo cobra y remite ${{ stripe: 'Stripe', mercadopago: 'Mercado Pago', creem: 'Creem' }[p]}` : ''}.`;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'] as const;

/** `2026-11` → `noviembre 2026`. null si no es un mes. */
export function mesEnTexto(mes: string | null | undefined): string | null {
  const m = MES_RE.exec(String(mes ?? '').trim());
  if (!m) return null;
  const [a, n] = String(mes).split('-');
  return `${MESES[Number(n) - 1]} ${a}`;
}

/** Las partes de una fecha en una zona, sin depender de la zona de la máquina. */
function partes(iso: string, zona: string): { d: string; m: string; a: string; h: string; mi: string; s: string; mes: number } | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  let f: Intl.DateTimeFormat;
  try { f = new Intl.DateTimeFormat('en-GB', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }); }
  catch { f = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }); }
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return { d: p.day, m: p.month, a: p.year, h: p.hour, mi: p.minute, s: p.second, mes: Number(p.month) };
}

/** `05/11/2026`, en la zona dada. */
export const fechaCorta = (iso: string, zona: string): string => { const p = partes(iso, zona); return p ? `${p.d}/${p.m}/${p.a}` : ''; };
/** `05/11/2026 12:20:19`, en la zona dada. */
export const fechaConHora = (iso: string, zona: string): string => { const p = partes(iso, zona); return p ? `${p.d}/${p.m}/${p.a} ${p.h}:${p.mi}:${p.s}` : ''; };
/** `5/11`, para el pie de WhatsApp y el correo. */
export const diaYMes = (iso: string, zona: string): string => { const p = partes(iso, zona); return p ? `${Number(p.d)}/${Number(p.m)}` : ''; };
/** El nombre del mes de una fecha, en la zona: `noviembre`. */
export const mesDeFecha = (iso: string, zona: string): string => { const p = partes(iso, zona); return p ? MESES[p.mes - 1] : ''; };

/** Una fecha del formulario: con zona, tal cual; sin zona («2026-11-05T12:20»), la hora de pared de `zona` (dos pasadas). */
export function instanteDeLaFecha(fecha: string, zona: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(fecha.trim());
  if (m) {
    const [y, mo, d, h = '12', mi = '00', se = '00'] = m.slice(1);
    const t = instanteDe(zona, Number(y), Number(mo), Number(d), Number(h), Number(mi));
    return new Date(t.getTime() + Number(se) * 1000).toISOString();
  }
  const t = Date.parse(fecha);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** El total por moneda, como texto: `238 USDT` o `US$ 50 + 100 USDT`. */
export function totalesEnTexto(totales: ReadonlyArray<{ moneda: string; monto: number }>): string {
  return totales.map((t) => formatoMonto(Number(t.monto), t.moneda)).join(' + ');
}

/**
 * La diferencia entre lo recibido y el detalle, sólo si se pagó en la MISMA moneda del detalle (nunca se calcula una tasa).
 * Positiva = se recibió de más. null = no se puede comparar.
 */
export function diferencia(totalDetalle: number, monedaDetalle: string, totales: ReadonlyArray<{ moneda: string; monto: number }>): number | null {
  if (totales.length !== 1 || totales[0].moneda !== monedaDetalle) return null;
  return Math.round((Number(totales[0].monto) - Number(totalDetalle)) * 100) / 100;
}

/** El nombre del adjunto: `MaKo - Recibo 0003 - noviembre - Código Inmobiliario.pdf`. Sin caracteres que rompan un nombre de archivo. */
export function nombreDelPdf(p: { numero: number; mes: string | null; aNombre: string }): string {
  const seguro = (s: string) => limpio(s).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').slice(0, 60);
  const partesNombre = ['MaKo', `Recibo ${numeroEnTexto(p.numero)}`, p.mes ? seguro(p.mes) : '', seguro(p.aNombre)].filter(Boolean);
  return `${partesNombre.join(' - ')}.pdf`;
}

// ─────────────────────────────────────────────────────────────────────────────
// El emisor («Datos del recibo», `recibos.emisor` en app_settings de la plataforma)
// ─────────────────────────────────────────────────────────────────────────────

export const KEY_EMISOR = 'recibos.emisor';
/** El interruptor «WhatsApp a quien paga solo» (prendido por defecto): `recibos.wa_solo`, 'no' lo apaga. */
export const KEY_WA_SOLO = 'recibos.wa_solo';

export type Emisor = { nombre: string; documento: string | null; direccion: string | null; correo: string | null; asunto: string | null; intro: string | null };
export const EMISOR_POR_DEFECTO: Emisor = { nombre: 'MaKo · hola-mako.com', documento: null, direccion: null, correo: null, asunto: null, intro: null };

/** Lo guardado, saneado. Nunca inventa un dato fiscal: lo que falta queda null y no se imprime. */
export function emisorDe(raw: unknown): Emisor {
  let o: Record<string, unknown> = {};
  try { o = typeof raw === 'string' ? JSON.parse(raw) : raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}; } catch { o = {}; }
  const t = (v: unknown, max: number): string | null => { const s = limpio(typeof v === 'string' ? v : ''); return s ? s.slice(0, max) : null; };
  return {
    nombre: t(o.nombre, 120) ?? EMISOR_POR_DEFECTO.nombre,
    documento: t(o.documento, 80),
    direccion: t(o.direccion, 200),
    correo: t(o.correo, 120),
    asunto: t(o.asunto, 120),
    intro: t(o.intro, 400),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// El correo y el pie de WhatsApp
// ─────────────────────────────────────────────────────────────────────────────

export type DatosDelTexto = { numero: number; monto: string; concepto: string; fecha: string; medio: string; aNombre: string };

const conDatos = (plantilla: string, d: DatosDelTexto): string =>
  plantilla.replace(/\{\{\s*(numero|monto|concepto|fecha|medio|nombre)\s*\}\}/g, (_, k: string) => ({
    numero: numeroEnTexto(d.numero), monto: d.monto, concepto: d.concepto, fecha: d.fecha, medio: d.medio, nombre: d.aNombre,
  } as Record<string, string>)[k] ?? '');

/**
 * El correo del recibo. El asunto y la primera frase se editan en «Datos del recibo» (con `{{numero}}`, `{{monto}}`,
 * `{{concepto}}`, `{{fecha}}`, `{{medio}}`, `{{nombre}}`); el «no es una factura fiscal» y la leyenda del medio, no.
 */
export function textoCorreo(d: DatosDelTexto & { leyenda: string | null; contacto: string; asunto?: string | null; intro?: string | null; titulo: string }): { asunto: string; preheader: string; cuerpo: string } {
  const asunto = conDatos(d.asunto || `Tu ${d.titulo.toLowerCase()} de MaKo N.º {{numero}}`, d).slice(0, 150);
  const intro = conDatos(d.intro || 'Recibimos tu pago de {{monto}} por {{concepto}}, el {{fecha}}, por {{medio}}.', d);
  return {
    asunto,
    preheader: 'Recibimos tu pago.',
    cuerpo: [
      'Hola,', '',
      intro, '',
      `Te adjunto el recibo N.º ${numeroEnTexto(d.numero)} en PDF.`, '',
      [ES_RECIBO_NO_FACTURA, d.leyenda].filter(Boolean).join(' '), '',
      `Si algo no coincide, escríbenos a ${d.contacto}.`,
    ].join('\n'),
  };
}

/** El correo de una devolución: una vez por estado, con el mismo PDF sellado. */
export function textoCorreoDevolucion(d: { numero: number; total: boolean; contacto: string }): { asunto: string; preheader: string; cuerpo: string } {
  const que = d.total ? 'quedó devuelto' : 'tiene una devolución parcial';
  return {
    asunto: `Tu recibo N.º ${numeroEnTexto(d.numero)} ${que}`,
    preheader: d.total ? 'Te devolvimos el pago.' : 'Te devolvimos una parte del pago.',
    cuerpo: [
      'Hola,', '',
      d.total ? `Te devolvimos el pago del recibo N.º ${numeroEnTexto(d.numero)}.` : `Te devolvimos una parte del pago del recibo N.º ${numeroEnTexto(d.numero)}.`,
      'Te adjunto el mismo recibo, con el sello de la devolución.', '',
      `Si algo no coincide, escríbenos a ${d.contacto}.`,
    ].join('\n'),
  };
}

/**
 * El pie del PDF en WhatsApp. SIN MONTO (agujero 1): el grupo y el hilo los pueden ver más personas que quien pagó, y el eco de
 * WhatsApp crea una fila con este texto. Lo importante en el primer renglón (`anotarLoDelEquipo` corta a 300).
 */
export const pieWhatsApp = (numero: number, titulo = 'Recibo de pago'): string =>
  `${titulo} N.º ${numeroEnTexto(numero)}. El detalle está en el PDF.\n\n— Equipo de MaKo`;

/** El aviso_tipo de la fila del hilo: lo esconde de los invitados (lib/grupo-reglas.ts, `AVISOS_QUE_NO_VE_UN_INVITADO`). */
export const AVISO_TIPO_RECIBO = 'recibo';

// ─────────────────────────────────────────────────────────────────────────────
// El envío: cuándo se toma, cuándo se reintenta, cuándo se rinde
// ─────────────────────────────────────────────────────────────────────────────

export const MIN_10 = 10 * 60_000;
export const MIN_30 = 30 * 60_000;
/** La clave de idempotencia de Resend dura 24 h (su doc, 5/11/2026): pasadas 23 h desde que se tomó el lote, no se reintenta solo. */
export const HORAS_23 = 23 * 3600_000;
export const INTENTOS_CORREO = 5;

export type FilaCorreo = { estado: string; correo_estado: string; correo_intentos: number; correo_tomado_at: string | null; updated_at: string };

/**
 * Qué hacer con el correo de un recibo:
 *   · `tomar`: mandarlo (o retomarlo con la MISMA clave: Resend devuelve lo de antes si ya salió);
 *   · `rendirse`: pasa a `fallo` con «no sé si salió» (un `enviando` de más de 23 h: la clave ya puede haber vencido);
 *   · `nada`: esperar, o no hay nada que hacer.
 * Sólo un recibo `emitido` se manda (agujero 7: un anulado o devuelto pendiente no sale por la red).
 */
export function decidirCorreo(f: FilaCorreo, ahora: number): 'tomar' | 'rendirse' | 'nada' {
  if (f.estado !== 'emitido') return 'nada';
  const desdeLote = f.correo_tomado_at ? ahora - Date.parse(f.correo_tomado_at) : 0;
  const quieto = ahora - Date.parse(f.updated_at);
  if (f.correo_estado === 'pendiente') return 'tomar';
  if (f.correo_estado === 'enviando') {
    if (desdeLote > HORAS_23) return 'rendirse';
    return quieto > MIN_10 ? 'tomar' : 'nada';
  }
  if (f.correo_estado === 'fallo') {
    if (f.correo_intentos >= INTENTOS_CORREO || desdeLote > HORAS_23) return 'nada';
    return quieto > MIN_30 ? 'tomar' : 'nada';
  }
  return 'nada';
}

/** WhatsApp: UNA vez, sin reintento automático (un error de Evolution no prueba que no salió). Un `enviando` de 10 min es «no sé». */
export function decidirWa(f: { estado: string; wa_estado: string; wa_tomado_at: string | null }, ahora: number): 'tomar' | 'rendirse' | 'nada' {
  if (f.estado !== 'emitido') return 'nada';
  if (f.wa_estado === 'pendiente') return 'tomar';
  if (f.wa_estado === 'enviando' && f.wa_tomado_at && ahora - Date.parse(f.wa_tomado_at) > MIN_10) return 'rendirse';
  return 'nada';
}

/** Un 409 de Resend por una petición IGUAL en curso se reintenta sin gastar intento; con OTRO cuerpo, no se arregla reintentando. */
export const esConcurrenteDeResend = (status: number | undefined, nombre: string | undefined): boolean =>
  status === 409 && nombre === 'concurrent_idempotent_requests';

/** Un hash corto y estable (FNV-1a 32), para la clave por destinatario sin depender de node:crypto. */
export function huellaCorta(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/** `recibo-<id>-<lote>-<hash del correo>`: un POST por destinatario, y un reenvío manual cambia el lote. */
export const claveDeEnvio = (id: number, lote: number, email: string, tipo: 'recibo' | 'devolucion' = 'recibo'): string =>
  `${tipo}-${id}-${lote}-${huellaCorta(email.trim().toLowerCase())}`;

// ─────────────────────────────────────────────────────────────────────────────
// Devolución, disputa y anulación: la máquina de estados (agujero 14)
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoRecibo = 'emitido' | 'devuelto' | 'devuelto_parcial' | 'contracargo' | 'anulado';
export type EventoRecibo =
  | { tipo: 'devolucion'; total: boolean }
  | { tipo: 'devolucion_fallida'; sigueDevuelto: boolean }
  | { tipo: 'contracargo'; plataAfuera: boolean | null };

/**
 * Lo que le pasa a un recibo con un evento. `avisar`: el estado de devolución que hay que avisarle a quien pagó (una vez por
 * estado, y sólo si el recibo original le llegó). Un anulado no cambia nunca; un devuelto no vuelve a «parcial»; un contracargo
 * que se resolvió a favor vuelve a `emitido` sólo si estaba en `contracargo` (no pisa un devuelto).
 */
export function transicionRecibo(
  r: { estado: EstadoRecibo; correo_estado: string; devolucion_avisada: string | null },
  ev: EventoRecibo,
): { estado: EstadoRecibo; avisar: 'devuelto' | 'devuelto_parcial' | null } {
  const sin = { estado: r.estado, avisar: null };
  if (r.estado === 'anulado') return sin;
  const salio = r.correo_estado === 'enviado';
  switch (ev.tipo) {
    case 'devolucion': {
      const nuevo: EstadoRecibo = ev.total ? 'devuelto' : r.estado === 'devuelto' ? 'devuelto' : 'devuelto_parcial';
      if (nuevo === r.estado) return sin;
      const avisar = !salio ? null
        : nuevo === 'devuelto' ? (r.devolucion_avisada === 'devuelto' ? null : 'devuelto')
          : (r.devolucion_avisada ? null : 'devuelto_parcial');
      return { estado: nuevo, avisar };
    }
    case 'devolucion_fallida':
      if (ev.sigueDevuelto) return sin;
      return r.estado === 'devuelto' || r.estado === 'devuelto_parcial' ? { estado: 'emitido', avisar: null } : sin;
    case 'contracargo':
      if (ev.plataAfuera === true) return r.estado === 'emitido' || r.estado === 'devuelto_parcial' ? { estado: 'contracargo', avisar: null } : sin;
      if (ev.plataAfuera === false) return r.estado === 'contracargo' ? { estado: 'emitido', avisar: null } : sin;
      return sin;
    default: { const _x: never = ev; void _x; return sin; }
  }
}

/**
 * ¿Qué aviso de devolución le falta a este recibo? Lo usa la red para el aviso que se cortó entre el estado y el correo. Mismas
 * reglas que `transicionRecibo`: una vez por estado, y sólo si el recibo original salió (a un correo que rebotó no se le escribe).
 */
export function devolucionPorAvisar(r: { estado: string; correo_estado: string; devolucion_avisada: string | null }): 'devuelto' | 'devuelto_parcial' | null {
  if (r.correo_estado !== 'enviado') return null;
  if (r.estado === 'devuelto') return r.devolucion_avisada === 'devuelto' ? null : 'devuelto';
  if (r.estado === 'devuelto_parcial') return r.devolucion_avisada ? null : 'devuelto_parcial';
  return null;
}

/** Un comprobante: SÓLO JPEG o PNG, por sus bytes (el `type` del archivo lo pone quien lo manda). */
export function sniffComprobante(b: Uint8Array): 'image/png' | 'image/jpeg' | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// El registro: los totales por moneda (agujero 11)
// ─────────────────────────────────────────────────────────────────────────────

export type ReciboParaTotal = { estado: EstadoRecibo; totales_recibido: ReadonlyArray<{ moneda: string; monto: number }>; impuesto: number | null; medios: readonly string[] };

/**
 * Los totales del filtro, por moneda: excluye los anulados, muestra los devueltos aparte, y resta el impuesto de lo cobrado por una
 * pasarela merchant of record (es plata de Creem, no de MaKo). Nunca suma entre monedas.
 */
export function totalesDelRegistro(rs: readonly ReciboParaTotal[]): { vigentes: Record<string, number>; devueltos: Record<string, number> } {
  const vigentes: Record<string, number> = {};
  const devueltos: Record<string, number> = {};
  for (const r of rs) {
    if (r.estado === 'anulado') continue;
    const bolsa = r.estado === 'devuelto' ? devueltos : vigentes;
    const mor = !!conMerchantOfRecord(r.medios);
    for (const t of r.totales_recibido) {
      const neto = Number(t.monto) - (mor && r.totales_recibido.length === 1 ? Number(r.impuesto ?? 0) : 0);
      bolsa[t.moneda] = Math.round(((bolsa[t.moneda] ?? 0) + neto) * 100) / 100;
    }
  }
  return { vigentes, devueltos };
}

/** Los rótulos de los estados, para la pantalla. */
export const ROTULO_ESTADO_RECIBO: Readonly<Record<EstadoRecibo, string>> = {
  emitido: 'Emitido', devuelto: 'Devuelto', devuelto_parcial: 'Devolución parcial', contracargo: 'Contracargo', anulado: 'Anulado',
};
export const ROTULO_CORREO: Readonly<Record<string, string>> = {
  pendiente: 'Por salir', enviando: 'Saliendo', enviado: 'Enviado', fallo: 'Falló', reboto: 'Rebotó', sin_destino: 'Sin destino', no_va: 'No va',
};
export const ROTULO_WA: Readonly<Record<string, string>> = {
  pendiente: 'Por salir', enviando: 'Saliendo', enviado: 'Enviado', en_app: 'En la app', sin_grupo: 'Sin grupo', fallo: 'Falló', no_va: 'No va',
};

/** El texto de un `RECIBO_OCUPADO <numero> <referencia>` de la base, para la persona. null si no es esa marca. */
export function textoDeOcupado(mensaje: string): string | null {
  const m = /RECIBO_OCUPADO (\d+) (\S+)/.exec(mensaje);
  return m ? `Esa orden (${m[2]}) ya está en el recibo N.º ${numeroEnTexto(Number(m[1]))}.` : null;
}
/** El texto de un `RECIBO_INVALIDO <motivo>`, para la persona. */
export function textoDeInvalido(mensaje: string): string | null {
  const m = /RECIBO_INVALIDO (.+)$/.exec(mensaje);
  return m ? `${m[1].charAt(0).toUpperCase()}${m[1].slice(1)}.` : null;
}
