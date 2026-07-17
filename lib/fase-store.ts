// =============================================================================
// fase-store — persistencia del diagnóstico de fase del negocio
// =============================================================================
// El diagnóstico (lib/fase-diagnostico.ts) es el "Norte" del cliente: en qué
// fase está y cuál es su cuello de botella. Se guarda por workspace en
// app_settings (patrón de mako.onboarding.answers) y alimenta el contexto de
// MaKo. Más adelante lo van a leer el Perro Guardián y la Retro.

import 'server-only';
import { getSetting, setSetting } from './settings';
import { diagnosticar, faseContextoTexto, type Diagnostico } from './fase-diagnostico';

const FASE_KEY = 'negocio.fase.diagnostico';

export async function getDiagnosticoFase(): Promise<Diagnostico | null> {
  const raw = await getSetting(FASE_KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Diagnostico;
    return Array.isArray(p.respuestas) ? p : null;
  } catch {
    return null;
  }
}

/** Guarda las respuestas crudas y el diagnóstico derivado (recomputado acá, no
 *  confiado del cliente). Devuelve el diagnóstico. */
export async function setDiagnosticoFase(respuestas: number[]): Promise<Diagnostico> {
  const d = diagnosticar(respuestas);
  await setSetting(FASE_KEY, JSON.stringify(d));
  return d;
}

/** Texto del Norte para inyectar en el contexto de MaKo (vacío si no hay diagnóstico). */
export async function faseNegocioTexto(): Promise<string> {
  return faseContextoTexto(await getDiagnosticoFase());
}
