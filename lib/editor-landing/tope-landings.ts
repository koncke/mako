// =============================================================================
// editor-landing/tope-landings — el tope del plan al PUBLICAR una landing y al CONECTAR un dominio (puro)
// =============================================================================
// Pedido del Cerebro (23/10/2026): hacer cumplir `web.landings_publicadas` y `web.dominios` de lib/topes-plan.ts en
// Web Generator. Regla de AGENTS.md («Hacer cumplir un tope del plan»): sólo a quien MaKo le cobra el plan por la
// pasarela, nunca al ws1 ni al ws de la plataforma, sólo a lo que se va a CREAR (publicar una landing que no estaba
// publicada, conectar un dominio a una landing que no tenía) y nunca se despublica ni se suelta nada. Si no se puede
// leer el plan, deja pasar. Molde: `topeParaLineaNueva` (lib/tope-lineas.ts).
//
// ⚠️ UN TOPE EN 0 NO ES «LLEGASTE AL TOPE» (14/11/2026, Martín: Esencial SIN dominio propio; `web.dominios` pasó de 1 a 0).
//    `textoTope(0)` le decía «Llegaste al tope de tu plan (0)» a quien nunca conectó uno: se leía como un error. Con 0, la
//    cosa es de Pro y se dice así (`TEXTO_DOMINIO_SOLO_PRO`, el molde de `textoSoloPro`), con el mismo «Pasar a Pro».
// =============================================================================

import { cabeOtra, textoTope, topeDe, type Tope } from '../topes-plan';
import { WS_MAURICIO } from '../aviso-arreglo-reglas';

export type ResultadoTope = { ok: true } | { ok: false; tope: number; texto: string };

/** Lo que dice conectar un dominio a quien su plan no lo trae (tope 0): el molde de `textoSoloPro` (lib/topes-plan.ts). */
export const TEXTO_DOMINIO_SOLO_PRO = 'El dominio propio es de MaKo Pro. Pasa a Pro para usarlo.';

/** Lo que se dice con el tope en 0, por cosa. Lo que no está acá, con 0, dice `textoTope(0)` (hoy no hay ninguno). */
const SOLO_PRO_CON_CERO: Partial<Record<Tope, string>> = { 'web.dominios': TEXTO_DOMINIO_SOLO_PRO };

/** ¿El texto de una falla lleva «Pasar a Pro»? Un tope lleno, o algo que el plan no trae. La pantalla dibuja el botón con esto. */
export const pidePasarAPro = (texto: string | null | undefined): boolean =>
  typeof texto === 'string' && (texto.startsWith('Llegaste al tope de tu plan') || texto === TEXTO_DOMINIO_SOLO_PRO);

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
  return { ok: false, tope: n, texto: (n === 0 ? SOLO_PRO_CON_CERO[cual] : undefined) ?? textoTope(n) };
}

/** ¿Puede publicar esta landing? */
export const topeParaPublicar = (p: PedidoTope): ResultadoTope => tope(p, 'web.landings_publicadas');
/** ¿Puede conectarle un dominio propio? */
export const topeParaDominio = (p: PedidoTope): ResultadoTope => tope(p, 'web.dominios');
