// =============================================================================
// pago-directo-reglas — «Transferencia o Binance» al precio de lista, y las pasarelas con +5 %, en el checkout (18/11/2026)
// =============================================================================
// Martín (18/11): «el tema de la pasarela de pago, también deberías agregar ahí la opción de transferencia para el resto de personas,
// incluso que no son por partners». Primero fue «5 % de descuento si pagan por eso»; a la tarde lo dio vuelta: «tiene que ser al revés… el
// precio final que nosotros definimos. Si pagan por pasarela de pago, se le debe sumar el 5 %, no restarnos a nosotros». HOY: el precio de
// lista es el de transferencia o Binance (US$ 97 y US$ 47; por Binance, el monto en USDT es el de lista); la pasarela cobra lista + 5 %
// (`conRecargoDePasarela`, que lee `compra-plan.ts` en `ofertaDelPlan`: lo que se muestra es lo que se cobra).
//
// QUÉ ES HOY: una opción más junto a las pasarelas (app/planes/[plan]/CompraPlan.tsx). Al elegirla se ven los datos de MaKo para
// pagar, el monto exacto con el descuento y dos botones para mandar el comprobante (WhatsApp / email). Al confirmar entra por el
// flujo de «Quiero» (`pedirPlanSinPasarela`, lib/compra-plan.ts): el lead en el CRM, «Quieren entrar» y el aviso al equipo, con el
// medio, el monto (el precio de lista) y el código de partner si vino con uno.
// ⚠️ LA ACTIVACIÓN ES DE MARTÍN, A MANO. Todavía no se verifica la plata contra Mercado Pago ni Binance (docs/pendientes-partners-pagos-1811.md,
// sección 2): ningún texto de este checkout promete que «se activa sola».
//
// LOS DATOS DE MARTÍN NO SE INVENTAN, Y VIVEN EN UN SETTING (Cerebro, 18/11: «no en constantes: así se cargan sin otro despliegue»): la clave
// `CLAVE_PAGO_DIRECTO` del negocio de la plataforma, que se edita en Settings › Payments (lib/pago-directo.ts). Sin cargar sale vacío
// (`DATOS_VACIOS`). Una opción sin ningún dato cargado NO se muestra (`mediosDisponibles` da []): no se le pide a nadie que pague a un
// alias que no existe.
//
// A su partner, un negocio referido le deja SIEMPRE el 30 % del precio de lista, pague como pague (lib/partners-reglas.ts); el canal
// (`canalDelPago`) sólo se guarda como dato. Lo anota Martín en el CRM como pago de método transferencia o cripto.
//
// Puro (lo importa también el cliente): sin red ni base. Lo prueba tests/pago-directo.test.ts.
// =============================================================================

import { RECARGO_PASARELA } from './partners-reglas';

export type MedioDirecto = 'binance' | 'transferencia';
export const MEDIOS_DIRECTOS: readonly MedioDirecto[] = ['binance', 'transferencia'];
export const esMedioDirecto = (v: unknown): v is MedioDirecto => MEDIOS_DIRECTOS.includes(v as MedioDirecto);

export const NOMBRE_MEDIO_DIRECTO: Readonly<Record<MedioDirecto, string>> = { binance: 'Binance', transferencia: 'Transferencia' };

/** Los datos de MaKo para recibir el pago. Cada uno null hasta que Martín lo mande: NUNCA un número de ejemplo. */
export type DatosDePagoDirecto = {
  /** Binance: el Pay ID de MaKo. */
  binancePayId: string | null;
  /**
   * Binance: el QR personal de «Recibir» de Binance Pay de MaKo (`https://app.binance.com/uni-qr/<código>`): PERMANENTE, lo paga cualquiera, todas las
   * veces que quiera, y quien paga pone el monto (por eso el checkout muestra el monto en USDT bien grande). ⚠️ NO un «payment request»: vence a los 30
   * días y puede ser de un solo pago (medido por el Cerebro, 18/11; los 4 links por plan que Martín había creado se descartaron). Sólo https.
   */
  linkBinance: string | null;
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
export const DATOS_VACIOS: DatosDePagoDirecto = { binancePayId: null, linkBinance: null, linkTransferencia: null, alias: null, cvu: null, titular: null, whatsapp: null, email: null };

const texto = (v: unknown, max: number): string | null => {
  const t = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
  return t || null;
};

/** Un enlace sólo si es https (se dibuja como un link para un cliente: nunca `javascript:` ni nada raro). */
const soloHttps = (u: string | null): string | null => (u && /^https:\/\/[^\s]+$/i.test(u) ? u : null);

/** Los datos como los escribió Martín, limpios (lo que no se entiende queda en null: nunca se guarda basura que se muestre a un cliente). */
export function datosLimpios(v: unknown): DatosDePagoDirecto {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const wa = String(o.whatsapp ?? '').replace(/\D/g, '');
  const email = texto(o.email, 200);
  const link = texto(o.linkTransferencia, 300);
  return {
    binancePayId: texto(o.binancePayId, 40),
    linkBinance: soloHttps(texto(o.linkBinance, 300)),
    // Sólo https (se dibuja como un enlace para un cliente: nunca `javascript:` ni nada raro).
    linkTransferencia: soloHttps(link),
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
  if (d.binancePayId || d.linkBinance) out.push('binance');
  if (d.alias || d.cvu || d.linkTransferencia) out.push('transferencia');
  return out;
}

const centavos = (n: number) => Math.round(n * 100) / 100;

/**
 * El precio por PASARELA: el de lista + 5 % (`RECARGO_PASARELA`). En dólares, a centavos (97 → 101,85; 47 → 49,35). En pesos (ARS), al
 * millar HACIA ARRIBA, la regla de la casa (lib/dolar-blue-reglas.ts `pesosDelPlan`). Otra moneda local (la de una Mercado Pago de otro
 * país), a centavos. A la millonésima antes de redondear: 97 × 1,05 no debe dar 101,85000000000001.
 */
export function conRecargoDePasarela(monto: number, moneda: string): number {
  const exacto = Math.round(Math.max(0, monto) * (1 + RECARGO_PASARELA) * 1e6) / 1e6;
  return moneda.toUpperCase() === 'ARS' ? Math.ceil(exacto / 1000) * 1000 : centavos(exacto);
}

/** Lo que se paga con ese medio, AL PRECIO DE LISTA: dólares/USDT por Binance, pesos por transferencia (null = el plan no tiene precio en pesos). */
export function montoDelMedio(medio: MedioDirecto, p: { precioUsd: number; precioArs: number | null }): { monto: number; moneda: 'USD' | 'ARS' } | null {
  if (medio === 'binance') return { monto: centavos(Math.max(0, p.precioUsd)), moneda: 'USD' };
  return p.precioArs != null && p.precioArs > 0 ? { monto: p.precioArs, moneda: 'ARS' } : null;
}

export function formatoDelMonto(m: { monto: number; moneda: 'USD' | 'ARS' }): string {
  const n = m.monto.toLocaleString('es-AR', { minimumFractionDigits: m.moneda === 'USD' && !Number.isInteger(m.monto) ? 2 : 0, maximumFractionDigits: 2 });
  return m.moneda === 'USD' ? `US$ ${n}` : `$ ${n} ARS`;
}

/** El texto que arma el botón de WhatsApp / el email: quién es, qué plan, cuánto y por qué medio. */
export function textoDelComprobante(p: { nombre: string; plan: string; medio: MedioDirecto; monto: { monto: number; moneda: 'USD' | 'ARS' } | null }): string {
  const cuanto = p.monto ? formatoDelMonto(p.monto) : 'el precio del plan';
  return `Hola, soy ${p.nombre.trim() || '—'}. Pagué ${p.plan} por ${NOMBRE_MEDIO_DIRECTO[p.medio]}: ${cuanto}. Te mando el comprobante.`;
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
