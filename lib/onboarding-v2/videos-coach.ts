// =============================================================================
// LOS VIDEOS DE CADA COACH: SU LISTA Y LA CLASE DEL FUNNEL COMO MENSAJE (20/11/2026, V6, V7)
// =============================================================================
// La auditoría del Cerebro (auditoria-onboarding-reto-20-11.md) contra la maqueta (cuerpo.html: `videosCoachHtml`, :1958, :4155-4156,
// :4371; capturas vchat-1-clase y vchat-2-lista):
//   · V6: el ícono de videos de cada coach lista su bienvenida y SÓLO las clases de lo que ya eligió: en Funnel Coach, la de cada
//     funnel elegido (el principal y sus «otros»); en Offer Coach, la de la oferta recién con la oferta armada. Los títulos de la
//     maqueta: «Bienvenida a Funnel Coach», «La clase de «Anuncios a WhatsApp»».
//   · V7: con el funnel guardado, MaKo manda en el hilo la clase del funnel principal como un mensaje más («Te dejo la clase de…»),
//     en su lugar (justo después de lo que pasó hasta que se guardó), no clavada arriba del chat. La de la oferta no se manda: queda
//     en la lista.
// Aquí, sólo lo puro (lo prueba tests/onboarding-v2-coaches-videos.test.ts); lo dibujan app/second-brain/ChatDelCoach.tsx y
// VideoDelCoach.tsx.
// =============================================================================
import { ORIGEN_FUNNEL_COACH, ORIGEN_OFFER_COACH, type CoachDelOps } from '../chat-mako-reglas';
import { ROTULO_FUNNEL, type PlanFunnel } from '../funnel-plan';

export type VideoDeUnCoach = { clave: string; titulo: string };
type Funnel = PlanFunnel['funnel'];

export const tituloBienvenidaCoach = (cual: CoachDelOps): string => `Bienvenida a ${cual === 'offer' ? ORIGEN_OFFER_COACH : ORIGEN_FUNNEL_COACH}`;
export const claveClaseFunnel = (f: Funnel): string => `funnel-clase-${f}`;
export const tituloClaseFunnel = (f: Funnel): string => `La clase de «${ROTULO_FUNNEL[f]}»`;

/** Los videos de Funnel Coach: su bienvenida y la clase de cada funnel elegido (sin plan, sólo la bienvenida). */
export function videosDelFunnel(plan: Pick<PlanFunnel, 'funnel' | 'otros'> | null): VideoDeUnCoach[] {
  const elegidos = plan ? [plan.funnel, ...(plan.otros ?? [])] : [];
  return [
    { clave: 'funnel-coach', titulo: tituloBienvenidaCoach('funnel') },
    ...[...new Set(elegidos)].map((f) => ({ clave: claveClaseFunnel(f), titulo: tituloClaseFunnel(f) })),
  ];
}

/** Los videos de Offer Coach: su bienvenida y, con la oferta armada, su clase. */
export function videosDelOffer(conOferta: boolean): VideoDeUnCoach[] {
  return [{ clave: 'offer-coach', titulo: tituloBienvenidaCoach('offer') }, ...(conOferta ? [{ clave: 'offer-coach-clase', titulo: 'La clase de la oferta' }] : [])];
}

/** Lo que dice MaKo con la clase del funnel (la maqueta, textual). */
export const textoClaseFunnel = (f: Funnel): string =>
  `Te dejo la clase de «${ROTULO_FUNNEL[f]}», para cuando quieras: cómo funciona por dentro. No hace falta para seguir.`;

type MsgHilo = { k: 'msg'; id: string; role: 'user' | 'assistant'; texto: string; at: string | null };
/** El mensaje de la clase del funnel principal, con la hora en que se guardó el plan (no se guarda: se arma con el plan). */
export const itemClaseFunnel = (plan: Pick<PlanFunnel, 'funnel' | 'guardadoEn'>): MsgHilo =>
  ({ k: 'msg', id: `clase-${plan.funnel}`, role: 'assistant', texto: textoClaseFunnel(plan.funnel), at: plan.guardadoEn || null });

/**
 * El hilo con la clase en su lugar: después de todo lo que pasó hasta que se guardó el plan, antes de lo que vino después. Sin
 * hora (un plan viejo), al final. Lo que no tiene hora no corre a la clase.
 */
export function conLaClase<T extends { at?: string | null }>(items: readonly T[], clase: T | null): readonly T[] {
  if (!clase) return items;
  const t = Date.parse(clase.at ?? '');
  if (!Number.isFinite(t)) return [...items, clase];
  let i = items.length;
  while (i > 0) {
    const a = Date.parse(items[i - 1]?.at ?? '');
    if (!Number.isFinite(a) || a <= t) break;
    i -= 1;
  }
  return [...items.slice(0, i), clase, ...items.slice(i)];
}
