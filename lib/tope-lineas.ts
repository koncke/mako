// =============================================================================
// tope-lineas — cuántas líneas de WhatsApp puede conectar un negocio según su plan (23/10/2026)
// =============================================================================
// El Cerebro, 23/10/2026: «Hacé cumplir `topeDe(capa, 'chats.lineas_whatsapp')` con `cabeOtra` al conectar una línea nueva,
// con un cartel corto `textoTope(n)` y «Pasar a Pro»». La tabla es lib/topes-plan.ts (Esencial 1, Pro 3); esto decide si
// se aplica, y es PURO para poder probarlo. Lo llama `conectar({ nueva: true })` (lib/evolution.ts), que es «Agregar otro
// número» y es por donde nace TODA línea nueva de un negocio.
//
// ⚠️ SÓLO A QUIEN MAKO LE COBRA EL PLAN POR LA PASARELA (`suscripcionDeMakoDe(ws) != null`, lib/cobros.ts): el ws1 y los
//    acuerdos a mano también tienen capa `completo`, y con la tabla sola quedaban en una línea. El ws1 va aparte y además
//    explícito: es el de Mauricio, que nunca entra a un tope.
// ⚠️ UNA LÍNEA YA CONECTADA NUNCA SE DESCONECTA POR EL TOPE: esto sólo frena la que se va a CREAR. Reconectar una que ya
//    existe (`conectar({ linea })`, el «↻ Nuevo QR») no pasa por acá.

import { cabeOtra, textoTope, topeDe } from './topes-plan';
import { WS_MAURICIO } from './aviso-arreglo-reglas';

/** A dónde lleva «Pasar a Pro»: la página del plan (app/planes/[plan], de la suscripción). */
export const RUTA_PASAR_A_PRO = '/planes/pro';

export type TopeLineaNueva = { ok: true } | { ok: false; tope: number; texto: string };

/**
 * ¿Puede conectar una línea MÁS? `usadas`: las que el negocio ya tiene (todas sus filas, conectadas o no: una caída se
 * reconecta con su QR, no con otra). `cobradoPorPasarela`: si MaKo le cobra el plan por Stripe o Mercado Pago.
 */
export function topeParaLineaNueva(p: { ws: number; capa: string; cobradoPorPasarela: boolean; usadas: number }): TopeLineaNueva {
  if (!p.cobradoPorPasarela || p.ws === WS_MAURICIO) return { ok: true };
  if (cabeOtra(p.capa, 'chats.lineas_whatsapp', p.usadas)) return { ok: true };
  const tope = topeDe(p.capa, 'chats.lineas_whatsapp') ?? 0;
  return { ok: false, tope, texto: textoTope(tope) };
}
