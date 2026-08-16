// =============================================================================
// onboarding-state — estado del onboarding de un workspace (wizard + extracción)
// =============================================================================
// Una sola fuente de verdad por cliente, en app_settings key 'onboarding.state'
// (JSON, patrón de mako.onboarding.answers). Regla de oro: el DUEÑO (ws 1) y
// los requests sin workspace NUNCA tienen onboarding pendiente — Mauricio jamás
// ve el wizard. Un workspace sin fila = 'pending' (cliente nuevo).

import 'server-only';
import { getSetting, setSetting } from './settings';
import { getCapaActual, getWorkspaceActual, getRolWsEfectivo, OWNER_WS } from './workspace';
import { capaDef, type PasoOnboarding } from './capas';
import { estadoInicial, type OnboardingState } from './onboarding-contrato';

// La FORMA del estado y las reglas puras viven en `onboarding-contrato.ts`, sin
// 'server-only', para que las pueda importar un test (lo que se decide ahí es si un
// cliente entra a la app o vuelve al wizard). Se re-exportan desde acá para que ningún
// call-site tenga que saber que son dos archivos.
export * from './onboarding-contrato';

export const ONBOARDING_KEY = 'onboarding.state';

/** Estado del workspace ACTUAL. Sin fila → pending (cliente nuevo). */
export async function getEstadoOnboarding(): Promise<OnboardingState> {
  try {
    const raw = await getSetting(ONBOARDING_KEY);
    if (!raw) return estadoInicial();
    const parsed = JSON.parse(raw) as OnboardingState;
    // Tolerancia a estados viejos/incompletos: mergear sobre el esqueleto.
    const base = estadoInicial(parsed.status ?? 'pending');
    return {
      ...base,
      ...parsed,
      steps: { ...base.steps, ...(parsed.steps ?? {}) },
      extraction: {
        ...base.extraction,
        ...(parsed.extraction ?? {}),
        jobs: { ...base.extraction.jobs, ...(parsed.extraction?.jobs ?? {}) },
      },
    };
  } catch {
    return estadoInicial();
  }
}

export async function setEstadoOnboarding(state: OnboardingState): Promise<void> {
  await setSetting(ONBOARDING_KEY, JSON.stringify(state));
}

/** Mutación cómoda: lee, aplica el patch y persiste. Devuelve el estado nuevo. */
export async function patchEstadoOnboarding(fn: (s: OnboardingState) => void): Promise<OnboardingState> {
  const s = await getEstadoOnboarding();
  fn(s);
  await setEstadoOnboarding(s);
  return s;
}

/**
 * ¿El request actual debe caer al wizard? El onboarding es OBLIGATORIO: solo un
 * status 'done' libera el dashboard. Todo lo demás (pending, in_progress, y
 * también 'skipped') vuelve al wizard — un cliente que no completó su arranque
 * NO puede entrar al dashboard bajo ningún motivo.
 *
 * Lo que SÍ libera es postergar un paso de conexión: no es una excepción a esta regla
 * sino la forma de cumplirla sin encerrar a nadie, porque ese paso pasa a contar como
 * cerrado (ver `onboardingCompleto`) y queda un recordatorio en /general.
 *
 * Aplica solo al ADMIN de cliente (o la agencia impersonando). El dueño (ws 1),
 * requests sin workspace y closer/setter → false (no hacen onboarding).
 */
export async function onboardingPendiente(): Promise<boolean> {
  const ws = await getWorkspaceActual();
  if (ws == null || ws === OWNER_WS) return false;
  const rol = await getRolWsEfectivo();
  if (rol !== 'admin') return false;
  // Una capa sin pasos entra directo a la app: no hay wizard que completar, y
  // mandarlo a un overlay vacío sería un callejón sin salida.
  if ((await pasosDeCapaActual()).length === 0) return false;
  const s = await getEstadoOnboarding();
  return s.status !== 'done';
}

/** Los pasos del wizard que le tocan al workspace actual, según su capa. */
export async function pasosDeCapaActual(): Promise<PasoOnboarding[]> {
  return capaDef(await getCapaActual()).onboarding;
}
