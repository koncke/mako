// =============================================================================
// editor-landing/tope-landings — el tope del plan al PUBLICAR una landing y al CONECTAR un dominio (puro)
// =============================================================================
// Pedido del Cerebro (23/10/2026): hacer cumplir `web.landings_publicadas` y `web.dominios` de lib/topes-plan.ts en
// Web Generator. Regla de AGENTS.md («Hacer cumplir un tope del plan»): sólo a quien MaKo le cobra el plan por la
// pasarela, nunca al ws1 ni al ws de la plataforma, sólo a lo que se va a CREAR (publicar una landing que no estaba
// publicada, conectar un dominio a una landing que no tenía) y nunca se despublica ni se suelta nada. Si no se puede
// leer el plan, deja pasar. Molde: `topeParaLineaNueva` (lib/tope-lineas.ts).
// =============================================================================

import { cabeOtra, textoTope, topeDe, type Tope } from '../topes-plan';
import { WS_MAURICIO } from '../aviso-arreglo-reglas';

export type ResultadoTope = { ok: true } | { ok: false; tope: number; texto: string };

export type PedidoTope = {
  ws: number;
  /** El ws de la plataforma (`wsSuperAdmin`): nunca tiene tope. */
  wsPlataforma: number;
  capa: string;
  /** Si MaKo le cobra el plan por Stripe o Mercado Pago (`suscripcionDeMakoDe(ws) != null`). */
  cobradoPorPasarela: boolean;
  /** Las que ya tiene el negocio (landings publicadas, o landings con dominio propio). */
  usadas: number;
  /** Esta landing ya está publicada (o ya tiene dominio): republicar o cambiarlo no suma una más. */
  yaCuenta: boolean;
};

function tope(p: PedidoTope, cual: Tope): ResultadoTope {
  if (!p.cobradoPorPasarela || p.ws === WS_MAURICIO || p.ws === p.wsPlataforma || p.yaCuenta) return { ok: true };
  if (cabeOtra(p.capa, cual, p.usadas)) return { ok: true };
  const n = topeDe(p.capa, cual) ?? 0;
  return { ok: false, tope: n, texto: textoTope(n) };
}

/** ¿Puede publicar esta landing? */
export const topeParaPublicar = (p: PedidoTope): ResultadoTope => tope(p, 'web.landings_publicadas');
/** ¿Puede conectarle un dominio propio? */
export const topeParaDominio = (p: PedidoTope): ResultadoTope => tope(p, 'web.dominios');
