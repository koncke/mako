import 'server-only';

// =============================================================================
// onboarding-sync — escribe en `onboarding.tab.cs-comunidad` lo que los datos ya dicen
// =============================================================================
// La regla (qué dato cierra qué paso) está en ./onboarding-comunidad.ts y es pura. Acá están las dos
// cosas que tocan la base: contar en las tablas de la comunidad y anotar los pasos. Lo anotado es lo
// que lee MaKo (`resumenOnboardingTabs`) y la pantalla final del onboarding global
// (`tabsPorConfigurar`): por eso se ESCRIBE y no sólo se calcula al dibujar. Molde: el del Curso
// (app/customer-success/curso/onboarding-sync.ts).

import { getEstadoTab, marcarPasoTab } from '@/lib/tab-onboarding-state';
import { hechosDeLaComunidad } from '@/lib/comunidad-datos';
import { TAB_COMUNIDAD, cambiosDeOnboarding } from './onboarding-comunidad';

type Steps = Record<string, { done: boolean; at?: string }>;

/**
 * Deja el estado guardado igual a lo que dicen los datos y devuelve los pasos como quedaron.
 * Best-effort: si algo falla devuelve lo que pudo leer (o `null`) y la página se dibuja igual.
 *
 * ⚠️ UN PASO QUE TODAVÍA NO SE PUEDE MARCAR SE SALTEA, no corta los demás: `marcarPasoTab` tira si
 *    falta uno obligatorio anterior (un alumno que comentó antes del primer post del equipo), y eso se
 *    resuelve solo en la carga en que el anterior se cumpla.
 */
export async function sincronizarOnboardingComunidad(ws: number): Promise<Steps | null> {
  let steps: Steps;
  try { steps = (await getEstadoTab(TAB_COMUNIDAD)).steps; } catch { return null; }
  const hechos = await hechosDeLaComunidad(ws);
  for (const c of cambiosDeOnboarding(steps, hechos)) {
    try { steps = (await marcarPasoTab(TAB_COMUNIDAD, c.paso, c.done)).steps; } catch { /* ver arriba */ }
  }
  return steps;
}
