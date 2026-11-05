// =============================================================================
// recomendarFunnel — qué funnel le conviene a un negocio, con su porqué (PURO; 5/11/2026)
// =============================================================================
// Martín (29/10/2026): «"¿qué funnel te gustaría? ¿o quieres que te recomiende uno?", alimentado por su presupuesto, qué funnel
// desea, qué ya está haciendo o qué resultado le trajo». El plan: docs/mako-iniciativa/plan.md §3.3.
//
// LO DECIDE EL CÓDIGO, NUNCA LA IA: el tipo sale de esta tabla y la IA, a lo sumo, le pone a sus etapas las palabras del negocio
// (lib/onboarding-crm.ts, con UN solo candidato). Es la ÚNICA traducción entre los cuatro catálogos de funnel (TIPOS_CRM,
// FUNNEL_TEMPLATES, TIPOS_FUNNEL, `funnelSugerido`): quien quiera recomendar un funnel (el onboarding, la escalera del Ops
// Center, Offer sin funnels, el CRM sin declarar) llama a ésta.
//
// SIEMPRE RESPETA EL CANAL que dijo (dónde cierra la venta): nunca le recomienda un funnel de chat a quien cierra por llamada.
// Gana la primera regla que aplica. El `porque` lo escribe el código con los datos de la persona, en una frase.
//
// Puro (sin `server-only`): lo importan el onboarding, la pantalla y los tests.
// =============================================================================

import type { CanalId } from './fase-diagnostico';
import { TIPOS_CRM, type EntradaId, type TipoCrmId } from './pipeline';

/**
 * Lo que se sabe del negocio. Los tramos son el ÍNDICE de la opción del diagnóstico (lib/fase-diagnostico.ts → PREGUNTAS):
 *   · `inversion`: 0 = «Nada o menos de $600», 1 = «$600 – $3.000»…
 *   · `creativos`: 0 = «0 – 3», 1 = «4 – 10»… (4 o más piezas al mes = 1 o más);
 *   · `funnelHoy`: 0 = todavía no hay camino, 1 = vende sin sistema, 2 = funnel completo que funciona…;
 *   · `fase`: el índice de la fase diagnosticada (0 = fase 1).
 * Lo que no se sabe va `null`: cuenta como el tramo más bajo (no se le recomienda pagar anuncios a quien no dijo cuánto invierte).
 */
export type DatosFunnel = {
  canal: CanalId | null;
  entrada?: EntradaId | null;
  inversion?: number | null;
  funnelHoy?: number | null;
  creativos?: number | null;
  fase?: number | null;
};

export type FunnelRecomendado = { tipo: TipoCrmId; porque: string };

/** Desde qué tramo «invierte»: $600 al mes o más. */
const INVIERTE = 1;
/** Desde qué tramo «publica seguido»: 4 piezas al mes o más. */
const PUBLICA = 1;
/** Desde qué respuesta «ya le funciona»: un funnel completo con algo que funciona seguro. */
const FUNCIONA = 2;

const rec = (tipo: TipoCrmId, porque: string): FunnelRecomendado => ({ tipo, porque });

/** El funnel que se le recomienda, con su porqué. Siempre devuelve uno (sin canal, «Llamada de venta», sin porqué). */
export function recomendarFunnel(d: DatosFunnel): FunnelRecomendado {
  const inversion = d.inversion ?? 0;
  const creativos = d.creativos ?? 0;
  const funnelHoy = d.funnelHoy ?? 0;
  const fase = d.fase ?? 0;
  const entrada = d.entrada ?? null;
  const invierte = inversion >= INVIERTE;
  const publica = creativos >= PUBLICA;

  // 1. El canal ya decide: uno por canal.
  if (d.canal === 'webinar') return rec('webinar', 'Cierras en un webinar.');
  if (d.canal === 'carrito') return rec('carrito', 'Vendes en tu página.');
  if (d.canal === 'presencial') return rec('presencial', 'Cierras en persona.');

  const llamada = d.canal === 'llamadas';
  const chat = d.canal === 'conversaciones';

  // 2. Ya le funciona y dijo cómo le llegan: el de su canal y su entrada, medido como está.
  if (funnelHoy >= FUNCIONA && entrada) {
    const ya = 'Ya te funciona: lo medimos como está.';
    if (llamada && (entrada === 'landing' || entrada === 'agenda_sola')) return rec('llamada', ya);
    if (llamada && entrada === 'chat_saliente') return rec('linkedin', ya);
    if (chat && entrada === 'chat_entrante') return rec('conversaciones', ya);
    if (chat && entrada === 'formulario_anuncio') return rec('formulario_meta', ya);
    if (chat && entrada === 'landing') return rec('recurso_gratis', ya);
  }

  if (chat) {
    // 3. Le dejan sus datos: el funnel de esa entrada.
    if (entrada === 'formulario_anuncio') return rec('formulario_meta', 'Te dejan sus datos en el anuncio.');
    if (entrada === 'landing') return rec('recurso_gratis', 'Te dejan sus datos en un formulario.');
    // 4 a 6. Por chat: con inversión, un anuncio que abre la charla; sin ella, lo orgánico.
    if (invierte) return rec('conversaciones', 'Con tu inversión, un anuncio que abre la charla.');
    if (publica) return rec('dm_funnel', 'Publicas seguido: que te comenten una palabra.');
    return rec('instagram', 'Inviertes menos de $600 al mes: empieza sin pagar anuncios.');
  }

  if (llamada) {
    // 7 y 8. Por llamada, sin pagar anuncios: les escribe, o publica seguido.
    if (entrada === 'chat_saliente' || (!invierte && !publica)) return rec('linkedin', 'Les escribes y agendan, sin pagar anuncios.');
    if (!invierte) return rec('youtube', 'Publicas seguido: del video a la agenda.');
    // 9. Con inversión: anuncios a una página donde agendan. Desde la fase 2, con un video de venta; desde la 3, y anuncios a
    // quien ya lo vio (el «VSL Funnel» de la fase). Dos reuniones desde la fase 4.
    const extra = fase >= 2 ? ', con un video de venta en la página y anuncios para quien ya te vio'
      : fase >= 1 ? ', con un video de venta en la página' : '';
    return rec(fase >= 3 ? 'dos_reuniones' : 'llamada', `Con tu inversión: anuncios a una página donde agendan${extra}.`);
  }

  // 10. Sin canal: el de siempre, sin porqué (no se sabe nada para escribirlo).
  return rec('llamada', '');
}

/** El nombre del funnel recomendado, como se lee en pantalla («Instagram orgánico»). */
export const nombreDelFunnel = (tipo: TipoCrmId): string => TIPOS_CRM.find((t) => t.id === tipo)?.label ?? tipo;

/** Cuántos funnels hay en MaKo (el «Ver los 12»). */
export const CUANTOS_FUNNELS = TIPOS_CRM.length;
