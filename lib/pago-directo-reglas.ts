// =============================================================================
// pago-directo-reglas — «Transferencia o Binance · 5 % OFF» en el checkout, para TODOS (18/11/2026)
// =============================================================================
// Martín (18/11): «el tema de la pasarela de pago, también deberías agregar ahí la opción de transferencia para el resto de personas,
// incluso que no son por partners, y… ofrecerle también a ellos un descuento si pagan por eso… utilizamos lo mismo para todos y es el
// mismo descuento, es el 5 %».
//
// QUÉ ES HOY: una opción más junto a las pasarelas (app/planes/[plan]/CompraPlan.tsx). Al elegirla se ven los datos de MaKo para
// pagar, el monto exacto con el descuento y dos botones para mandar el comprobante (WhatsApp / email). Al confirmar entra por el
// flujo de «Quiero» (`pedirPlanSinPasarela`, lib/compra-plan.ts): el lead en el CRM, «Quieren entrar» y el aviso al equipo, con el
// medio, el monto con descuento y el código de partner si vino con uno.
// ⚠️ LA ACTIVACIÓN ES DE MARTÍN, A MANO. Todavía no se verifica la plata contra Mercado Pago ni Binance (docs/pendientes-partners-pagos-1811.md,
// sección 2): ningún texto de este checkout promete que «se activa sola».
//
// LOS DATOS DE MARTÍN NO SE INVENTAN, Y VIVEN EN UN SETTING (Cerebro, 18/11: «no en constantes: así se cargan sin otro despliegue»): la clave
// `CLAVE_PAGO_DIRECTO` del negocio de la plataforma, que se edita en Settings › Payments (lib/pago-directo.ts). Sin cargar sale vacío
// (`DATOS_VACIOS`). Una opción sin ningún dato cargado NO se muestra (`mediosDisponibles` da []): no se le pide a nadie que pague a un
// alias que no existe.
//
// A un negocio referido que paga así le cuenta el canal «directo» (30 % para su partner, lib/partners-reglas.ts `canalDelPago`) sobre lo
// que pagó, ya con el descuento: lo anota Martín en el CRM como pago de método transferencia o cripto.
//
// Puro (lo importa también el cliente): sin red ni base. Lo prueba tests/pago-directo.test.ts.
// =============================================================================

import { DESCUENTO_PAGO_DIRECTO } from './partners-reglas';

export type MedioDirecto = 'binance' | 'transferencia';
export const MEDIOS_DIRECTOS: readonly MedioDirecto[] = ['binance', 'transferencia'];
export const esMedioDirecto = (v: unknown): v is MedioDirecto => MEDIOS_DIRECTOS.includes(v as MedioDirecto);

export const NOMBRE_MEDIO_DIRECTO: Readonly<Record<MedioDirecto, string>> = { binance: 'Binance', transferencia: 'Transferencia' };
/** El chip de la fila del checkout: «5% OFF». */
export const CHIP_PAGO_DIRECTO = `${Math.round(DESCUENTO_PAGO_DIRECTO * 100)}% OFF`;

/** Los datos de MaKo para recibir el pago. Cada uno null hasta que Martín lo mande: NUNCA un número de ejemplo. */
export type DatosDePagoDirecto = {
  /** Binance: el Pay ID de MaKo. */
  binancePayId: string | null;
  /**
   * Binance: el «payment link» de Binance Pay EXIGE monto, así que hay uno por plan y período, en USDT y con el 5 % ya descontado
   * (Pro mensual 92,15; Essential 44,65…). Clave `<idDelPlan>:<mensual|anual>`; sólo https. Sin link para el plan, se muestra el Pay ID.
   */
  linksBinance: Record<string, string>;
  /** Transferencia: el link «Transferime con Mercado Pago» de la cuenta de MaKo (abre la app para transferir; no trae monto). */
  linkTransferencia: string | null;
  /** Transferencia: alias y CVU de la Mercado Pago de MaKo. */
  alias: string | null;
  cvu: string | null;
  /** A nombre de quién están las cuentas. */
  titular: string | null;
  /** Adónde mandar el comprobante: el WhatsApp de MaKo (sólo dígitos, con código de país) y el email de cobros. */
  whatsapp: string | null;
  email: string | null;
};

/** El ajuste del negocio de la plataforma donde Martín carga sus datos (Settings › Payments). */
export const CLAVE_PAGO_DIRECTO = 'planes.pago_directo';

// ⚠️ SIN INVENTAR NADA (Cerebro, 18/11): los carga Martín. Mientras estén vacíos, la opción no aparece en el checkout.
export const DATOS_VACIOS: DatosDePagoDirecto = { binancePayId: null, linksBinance: {}, linkTransferencia: null, alias: null, cvu: null, titular: null, whatsapp: null, email: null };

const texto = (v: unknown, max: number): string | null => {
  const t = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
  return t || null;
};

/** Los datos como los escribió Martín, limpios (lo que no se entiende queda en null: nunca se guarda basura que se muestre a un cliente). */
export function datosLimpios(v: unknown): DatosDePagoDirecto {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const wa = String(o.whatsapp ?? '').replace(/\D/g, '');
  const email = texto(o.email, 200);
  const link = texto(o.linkTransferencia, 300);
  // Los links de Binance por plan: clave `<plan>:<mensual|anual>`, valor https. Lo que no cumple se descarta (no se le muestra a un cliente).
  const linksBinance: Record<string, string> = {};
  const crudos = o.linksBinance && typeof o.linksBinance === 'object' && !Array.isArray(o.linksBinance) ? (o.linksBinance as Record<string, unknown>) : {};
  for (const [k, v] of Object.entries(crudos).slice(0, 40)) {
    const u = texto(v, 300);
    if (/^[a-z0-9-]{1,32}:(mensual|anual)$/.test(k) && u && /^https:\/\/[^\s]+$/i.test(u)) linksBinance[k] = u;
  }
  return {
    binancePayId: texto(o.binancePayId, 40),
    linksBinance,
    // Sólo https (se dibuja como un enlace para un cliente: nunca `javascript:` ni nada raro).
    linkTransferencia: link && /^https:\/\/[^\s]+$/i.test(link) ? link : null,
    alias: texto(o.alias, 60),
    cvu: texto(o.cvu, 40),
    titular: texto(o.titular, 120),
    whatsapp: wa.length >= 10 && wa.length <= 15 ? wa : null,
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email.toLowerCase() : null,
  };
}

/** Lo guardado en el setting (JSON) como datos; vacío o roto = sin datos (la opción no se muestra). */
export function datosDeSetting(crudo: string | null): DatosDePagoDirecto {
  if (!crudo) return { ...DATOS_VACIOS };
  try { return datosLimpios(JSON.parse(crudo)); } catch { return { ...DATOS_VACIOS }; }
}

/** Con qué se puede pagar HOY: Binance si hay Pay ID; transferencia si hay link, alias o CVU. Vacío = la opción no se muestra. */
export function mediosDisponibles(d: DatosDePagoDirecto): MedioDirecto[] {
  const out: MedioDirecto[] = [];
  if (d.binancePayId || Object.keys(d.linksBinance).length) out.push('binance');
  if (d.alias || d.cvu || d.linkTransferencia) out.push('transferencia');
  return out;
}

/** El link de Binance Pay del plan y período elegidos, o null (entonces el checkout muestra el Pay ID). */
export const linkDeBinance = (d: DatosDePagoDirecto, plan: string, periodo: 'mensual' | 'anual' = 'mensual'): string | null => d.linksBinance[`${plan}:${periodo}`] ?? null;

const centavos = (n: number) => Math.round(n * 100) / 100;

/** El precio en dólares/USDT con el descuento: Pro 97 → 92,15; Essential 47 → 44,65. */
export const usdConDescuento = (usd: number): number => centavos(Math.max(0, usd) * (1 - DESCUENTO_PAGO_DIRECTO));

/** El precio en pesos con el descuento, redondeado al millar HACIA ARRIBA (la regla de la casa, lib/dolar-blue-reglas.ts `pesosDelPlan`). */
export function pesosConDescuento(pesos: number): number {
  const exacto = Math.round(Math.max(0, pesos) * (1 - DESCUENTO_PAGO_DIRECTO) * 1e6) / 1e6;
  return Math.ceil(exacto / 1000) * 1000;
}

/** Lo que se paga con ese medio: dólares/USDT por Binance, pesos por transferencia (null = el plan no tiene precio en pesos). */
export function montoDelMedio(medio: MedioDirecto, p: { precioUsd: number; precioArs: number | null }): { monto: number; moneda: 'USD' | 'ARS' } | null {
  if (medio === 'binance') return { monto: usdConDescuento(p.precioUsd), moneda: 'USD' };
  return p.precioArs != null && p.precioArs > 0 ? { monto: pesosConDescuento(p.precioArs), moneda: 'ARS' } : null;
}

export function formatoDelMonto(m: { monto: number; moneda: 'USD' | 'ARS' }): string {
  const n = m.monto.toLocaleString('es-AR', { minimumFractionDigits: m.moneda === 'USD' && !Number.isInteger(m.monto) ? 2 : 0, maximumFractionDigits: 2 });
  return m.moneda === 'USD' ? `US$ ${n}` : `$ ${n} ARS`;
}

/** El texto que arma el botón de WhatsApp / el email: quién es, qué plan, cuánto y por qué medio. */
export function textoDelComprobante(p: { nombre: string; plan: string; medio: MedioDirecto; monto: { monto: number; moneda: 'USD' | 'ARS' } | null }): string {
  const cuanto = p.monto ? formatoDelMonto(p.monto) : 'el monto del plan con el 5% de descuento';
  return `Hola, soy ${p.nombre.trim() || '—'}. Pagué ${p.plan} por ${NOMBRE_MEDIO_DIRECTO[p.medio]}: ${cuanto} (con el ${Math.round(DESCUENTO_PAGO_DIRECTO * 100)}% de descuento). Te mando el comprobante.`;
}

/** `wa.me` al WhatsApp de MaKo con el texto armado. null si todavía no hay WhatsApp cargado (el botón no se muestra). */
export function urlDeWhatsApp(whatsapp: string | null, texto: string): string | null {
  const n = String(whatsapp ?? '').replace(/\D/g, '');
  return n.length >= 10 ? `https://wa.me/${n}?text=${encodeURIComponent(texto)}` : null;
}

/** `mailto:` al email de cobros con asunto y cuerpo. null si todavía no hay email cargado. */
export function urlDeEmail(email: string | null, asunto: string, texto: string): string | null {
  const e = String(email ?? '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? `mailto:${e}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}` : null;
}
