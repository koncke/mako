// =============================================================================
// tope-cuentas-reglas — cuántas cuentas de cobro y de agenda puede conectar un plan de MaKo (23/10/2026)
// =============================================================================
// Las ofertas del 23/10 (docs/ofertas-mako.md): MaKo Esencial trae «1 cuenta de Stripe o Mercado Pago»; MaKo Pro, varias
// de Stripe, Mercado Pago, Calendly y Cal. El número vive en lib/topes-plan.ts (`cobros.cuentas`); esto decide cuándo
// se aplica. Se cuentan por GRUPO: las de cobro (Stripe y Mercado Pago juntas) y las de agenda (Calendly y Cal juntas).
//
// Lo que no se ve en el código y muerde (el Cerebro, 23/10/2026):
//   · SÓLO A QUIEN MAKO LE COBRA EL PLAN POR LA PASARELA. El ws1 y los acuerdos a mano también tienen capa `completo`,
//     y a ellos no se les aplica nada.
//   · SÓLO AL CONECTAR UNA MÁS. Volver a conectar, cambiar la clave o renombrar no cuentan. Una cuenta ya conectada
//     nunca se desconecta por el tope, y un cobro nunca se frena por él.
//   · SIN PODER LEER EL PLAN, NO SE FRENA. El tope es una venta, no una seguridad: el error no se le cobra al cliente.
//
// Puro: lo usan lib/tope-cuentas.ts y tests/tope-cuentas.test.ts.
// =============================================================================

import { OWNER_WS } from './auth-session';
import { RUTA_CAMBIAR_PLAN, cabeOtra, textoTope, topeDe } from './topes-plan';

/** Adónde lleva «Pasar a Pro»: la de topes-plan (cambiar de plan desde Configuración), no una copia. */
export const LINK_PLANES = RUTA_CAMBIAR_PLAN;

/** null = puede conectarla; si no, el cartel corto. */
export function topeAlConectar(p: { ws: number; cobradoPorPasarela: boolean; capa: string | null; usadas: number }): { texto: string; tope: number } | null {
  if (p.ws === OWNER_WS || !p.cobradoPorPasarela) return null;
  const capa = p.capa ?? '';
  if (cabeOtra(capa, 'cobros.cuentas', p.usadas)) return null;
  const tope = topeDe(capa, 'cobros.cuentas');
  return tope == null ? null : { texto: textoTope(tope), tope };
}
