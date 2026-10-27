// =============================================================================
// Media Buyer — los AGENTES de MaKo (los de AdAmigo: Strategist, Media Buyer, Creative Designer, Protect) (PURO)
// =============================================================================
// Cada acción la firma un agente, y cada agente maneja sus tácticas (lib/media-buyer/tacticas.ts): prender, pausar o poner
// en automático a un agente es cambiar el estado de TODAS sus tácticas, sin tocar sus umbrales ni sus campañas. Lo usan la
// pantalla (app/ads-manager/mb-modelo.ts lo reexporta) y la API de MaKo (`modo_agente_media_buyer`).
// =============================================================================

import type { Tactica } from './tipos';
import type { ConfigTacticas, EstadoTactica, TacticaAuto } from './tacticas';

export type Agente = 'media_buyer' | 'protect' | 'estratega' | 'disenador' | 'tu';
export type AgenteMako = Exclude<Agente, 'tu'>;
export const AGENTES_MAKO: AgenteMako[] = ['estratega', 'media_buyer', 'disenador', 'protect'];

/** Qué agente firma cada táctica. Stop Loss cuida la plata (Protect); Calidad sale del CRM (Estratega). */
export const AGENTE_DE: Record<Tactica, Agente> = {
  surf: 'media_buyer', sunsetting: 'media_buyer', revive: 'media_buyer', stop_loss: 'protect', calidad: 'estratega', ganador: 'disenador', manual: 'tu',
};
export const NOMBRE_AGENTE: Record<Agente, string> = {
  media_buyer: 'Media Buyer', protect: 'Protect', estratega: 'Estratega', disenador: 'Diseñador de creativos', tu: 'Tú',
};
/** Las tácticas que maneja cada agente. */
export const TACTICAS_DE: Record<AgenteMako, TacticaAuto[]> = {
  media_buyer: ['surf', 'sunsetting', 'revive'], protect: ['stop_loss'], estratega: ['calidad'], disenador: ['ganador'],
};
export const QUE_HACE: Record<AgenteMako, string> = {
  media_buyer: 'Sube lo que rinde, baja lo que encarece y prende lo que volvió a andar',
  protect: 'Pausa lo que gasta sin traer resultados',
  estratega: 'Mira tu CRM: pausa lo que trae leads que no agendan',
  disenador: 'Escribe textos y ganchos nuevos de tus ganadores',
};
export type EstadoAgente = 'pausado' | 'propone' | 'automatico';
export const TACTICA_DE_ESTADO: Record<EstadoAgente, EstadoTactica> = { pausado: 'apagada', propone: 'propone', automatico: 'automatica' };

/** El estado de un agente: pausado si todas sus tácticas están apagadas; automático si alguna lanza sola. */
export function estadoDeAgente(a: AgenteMako, r: Record<TacticaAuto, { estado: EstadoTactica }>): EstadoAgente {
  const es = TACTICAS_DE[a].map((t) => r[t].estado);
  if (es.every((e) => e === 'apagada')) return 'pausado';
  return es.some((e) => e === 'automatica') ? 'automatico' : 'propone';
}

/**
 * Lo que se MANDA para cambiar el estado de un agente: sólo `{ estado }` de cada una de sus tácticas. El servidor lo mezcla campo
 * por campo con lo guardado (tacticas.ts → mezclarTacticas), así una copia vieja de la pantalla o de una confirmación del chat no
 * pisa los umbrales ni las campañas que otro cambió (verificación de tren-m, falla 2).
 */
export const cambioDeAgente = (a: AgenteMako, estado: EstadoTactica): ConfigTacticas =>
  Object.fromEntries(TACTICAS_DE[a].map((t) => [t, { estado }])) as ConfigTacticas;

/** Cambia el estado de TODAS las tácticas de un agente, sin tocar sus umbrales ni sus campañas. */
export function cambiarAgente(cfg: ConfigTacticas, a: AgenteMako, estado: EstadoTactica): ConfigTacticas {
  const out: ConfigTacticas = { ...cfg };
  for (const t of TACTICAS_DE[a]) out[t] = { ...(cfg[t] ?? {}), estado };
  return out;
}
