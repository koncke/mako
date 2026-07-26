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

export const ONBOARDING_KEY = 'onboarding.state';

export type OnboardingStatus = 'pending' | 'in_progress' | 'skipped' | 'done';
export type JobStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';

export type JobKey = 'meta_metrics' | 'meta_leads' | 'ad_transcripts' | 'script_analyses' | 'fathom_calls' | 'vsl_metrics';

export type JobState = {
  status: JobStatus;
  /** cursor de reanudación (meta_metrics: fecha YYYY-MM-DD ya procesada más vieja). */
  cursor?: string | null;
  /** resumen corto para el panel ("día 120/365", "8 transcritos, 34 restantes"). */
  detail?: string | null;
  error?: string | null;
  updatedAt?: string | null;
};

export type ExtractionState = {
  status: 'idle' | 'running' | 'done' | 'error';
  startedAt?: string | null;
  finishedAt?: string | null;
  /** lease del runner activo (anti doble-tick entre pestañas): un tick solo
   *  arranca si el lease está vencido; el runner vivo lo refresca al persistir. */
  leaseAt?: string | null;
  jobs: Record<JobKey, JobState>;
};

export type OnboardingState = {
  version: 1;
  status: OnboardingStatus;
  /** paso actual del wizard (para retomar donde quedó). */
  step: PasoOnboarding;
  startedAt?: string | null;
  completedAt?: string | null;
  completedBy?: string | null;
  /**
   * Estado de CADA paso posible, no de los de una capa. Qué pasos se le muestran
   * al cliente lo decide su capa (lib/capas.ts → capaDef().onboarding); acá
   * guardamos todos para que cambiar de capa no pierda lo ya hecho: un cliente
   * que pasa de Project Manager a Completo conserva su 'negocio' y solo le
   * aparecen los pasos nuevos.
   */
  steps: {
    integraciones: { done: boolean };
    tabs: { done: boolean };
    negocio: { done: boolean };
    archivero: { done: boolean };
    gemini: { done: boolean };
    fase: { done: boolean };
    retro: { done: boolean; retroId?: number | null };
    plan: { done: boolean };
  };
  extraction: ExtractionState;
};

export const JOB_KEYS: JobKey[] = ['meta_metrics', 'meta_leads', 'ad_transcripts', 'script_analyses', 'fathom_calls', 'vsl_metrics'];

export function estadoInicial(status: OnboardingStatus = 'pending'): OnboardingState {
  const jobs = Object.fromEntries(JOB_KEYS.map((k) => [k, { status: 'pending' as JobStatus }])) as Record<JobKey, JobState>;
  return {
    version: 1,
    status,
    step: 'integraciones',
    startedAt: null,
    completedAt: null,
    completedBy: null,
    steps: {
      integraciones: { done: false },
      tabs: { done: false },
      negocio: { done: false },
      archivero: { done: false },
      gemini: { done: false },
      fase: { done: false },
      retro: { done: false, retroId: null },
      plan: { done: false },
    },
    extraction: { status: 'idle', startedAt: null, finishedAt: null, jobs },
  };
}

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
