// =============================================================================
// mako-fases — instrucción por sección del dashboard (config en app_settings)
// =============================================================================
// Para cada sección, qué tiene que mirar y hacer MaKo ahí. Editable sin deploy.
// Si una fase está vacía, no se inyecta nada (MaKo se comporta como hoy).

import 'server-only';
import { getSetting, setSetting } from './settings';

export type Fase = { key: string; label: string; ejemplo: string };

export const FASES: Fase[] = [
  { key: 'general', label: 'Vista General', ejemplo: 'Lectura rápida del estado del negocio y el foco de la semana.' },
  { key: 'crm', label: 'CRM', ejemplo: 'Por qué un lead está trabado y cuál es la próxima acción.' },
  { key: 'marketing', label: 'Marketing', ejemplo: 'Dónde se cae la adquisición y si el gasto rinde (CPM/CPC, CTR, costo por landing y por VSL).' },
  { key: 'comercial', label: 'Comercial', ejemplo: 'Dónde se enfría el funnel: R1→R2, no-show, tasa de cierre.' },
  { key: 'closing', label: 'Closing', ejemplo: 'Qué mejorar en las llamadas de cierre.' },
];

const keyOf = (k: string) => `mako.fase.${k}`;

export async function getFases(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(FASES.map(async (f) => { out[f.key] = (await getSetting(keyOf(f.key))) ?? ''; }));
  return out;
}

export async function setFase(key: string, value: string): Promise<void> {
  if (!FASES.some((f) => f.key === key)) throw new Error('fase inválida');
  await setSetting(keyOf(key), value);
}

/** chartKey → sección de Fases. */
export function faseForChart(chartKey: string): string {
  if (!chartKey || chartKey === 'mako-general') return 'general';
  if (chartKey.startsWith('comercial')) return 'comercial';
  if (chartKey.startsWith('marketing')) return 'marketing';
  if (chartKey.startsWith('leads') || chartKey.startsWith('crm')) return 'crm';
  if (chartKey.startsWith('closing')) return 'closing';
  return 'general';
}

export async function getFaseInstruccion(chartKey: string): Promise<string> {
  return (await getSetting(keyOf(faseForChart(chartKey)))) ?? '';
}
