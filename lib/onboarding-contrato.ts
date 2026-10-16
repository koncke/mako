// =============================================================================
// onboarding-contrato — la FORMA del estado del onboarding, y las reglas puras
// =============================================================================
// La mitad de `onboarding-state.ts` que no toca la base: los tipos, el esqueleto y las
// dos preguntas que deciden si el cliente ya terminó y qué le quedó pendiente.
//
// ⚠️ SIN 'server-only', a propósito, y es el mismo criterio de `exigirClienteDePrueba` y
// de `lib/model-catalogo.ts`: lo que gobierna una decisión importante tiene que poder
// importarlo un test. Acá lo que se decide es si un cliente entra a la app o vuelve al
// wizard — si vive adentro del módulo que lee `app_settings`, ningún test lo puede
// importar y justo eso queda sin red. Ya se pagó una vez: el estado 'skipped' existía,
// no liberaba nada, y nadie se enteró hasta que una clienta estuvo nueve días afuera.
//
// El que lee y escribe la fila sigue siendo `onboarding-state.ts`, que re-exporta todo
// esto para que nadie tenga que saber que son dos archivos.
// =============================================================================

import { PASOS_ONBOARDING, esPostergable, type PasoOnboarding } from './capas';

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

/**
 * `done` = lo terminó. `postergado` = eligió seguir sin terminarlo, y solo puede pasar
 * en los pasos de `PASOS_POSTERGABLES` (los que se cierran en un sistema de afuera).
 *
 * Son campos SEPARADOS a propósito, no un enum de tres estados: «lo hizo» y «decidió
 * seguir sin hacerlo» son hechos distintos, y el día que conecte Meta de verdad hay que
 * poder marcar `done` sin borrar que alguna vez lo postergó. Es la regla de AGENTS.md:
 * cada pregunta, su campo.
 */
export type PasoState = { done: boolean; postergado?: boolean };

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
   *
   * ⚠️ Las claves SALEN de `PASOS_ONBOARDING`, no se escriben a mano. Esta lista
   * era una de las cuatro copias paralelas que dejaron nacer roto el paso
   * `productos`: mientras se mantengan por separado, el próximo paso nuevo repite
   * el bug. `retroId` es el único dato extra de un paso, así que va aparte.
   */
  steps: Record<PasoOnboarding, PasoState> & { retro: PasoState & { retroId?: number | null } };
  extraction: ExtractionState;
};

export const JOB_KEYS: JobKey[] = ['meta_metrics', 'meta_leads', 'ad_transcripts', 'script_analyses', 'fathom_calls', 'vsl_metrics'];

export function estadoInicial(status: OnboardingStatus = 'pending'): OnboardingState {
  const jobs = Object.fromEntries(JOB_KEYS.map((k) => [k, { status: 'pending' as JobStatus }])) as Record<JobKey, JobState>;
  const steps = Object.fromEntries(PASOS_ONBOARDING.map((k) => [k, { done: false }])) as OnboardingState['steps'];
  steps.retro = { done: false, retroId: null };
  return {
    version: 1,
    status,
    step: 'integraciones',
    startedAt: null,
    completedAt: null,
    completedBy: null,
    steps,
    extraction: { status: 'idle', startedAt: null, finishedAt: null, jobs },
  };
}

/**
 * ¿Terminó el wizard? Un paso cuenta como cerrado si lo TERMINÓ o si eligió
 * POSTERGARLO —y postergar solo se puede en los de `PASOS_POSTERGABLES`, que son los
 * que dependen de un sistema de afuera.
 *
 * ⚠️ Esta función reemplaza al `paso === ultimo` que había en el endpoint, y no es un
 * refactor cosmético: aquella regla preguntaba «¿cerraste el ÚLTIMO?» en vez de
 * «¿cerraste TODOS?». Mientras el único camino fue avanzar de a uno hasta el final, las
 * dos coincidían; con una salida en el medio dejan de coincidir, y quien postergara el
 * último paso de su capa se quedaba `in_progress` para siempre. Es la misma familia de
 * bug que ya se había arreglado ahí una vez, cuando estaba clavado a 'retro'.
 *
 * El guard de largo no es decoración: `[].every(...)` es `true`, así que sin él una
 * capa sin pasos entraría como «terminada» por vacuidad.
 */
export function onboardingCompleto(s: OnboardingState, pasos: PasoOnboarding[]): boolean {
  return pasos.length > 0 && pasos.every((p) => s.steps[p]?.done || s.steps[p]?.postergado);
}

/**
 * Lo que el cliente dejó pendiente y TODAVÍA no resolvió por su cuenta.
 *
 * ⚠️ Recibe `sigueFaltando` en vez de creerle al estado guardado, y ésa es toda la
 * gracia: postergar Meta y conectarlo tres días después desde /integraciones tiene que
 * APAGAR el recordatorio solo, sin que nadie vuelva a marcar nada. Es la regla de la
 * casa —estado vivo, no recordado—: un flag que hay que acordarse de bajar es un flag
 * que dentro de un mes le va a estar pidiendo a alguien algo que ya hizo.
 */
export function pendientesDeOnboarding(
  s: OnboardingState,
  pasos: PasoOnboarding[],
  sigueFaltando: (p: PasoOnboarding) => boolean,
): PasoOnboarding[] {
  return pasos.filter((p) => s.steps[p]?.postergado && !s.steps[p]?.done && sigueFaltando(p));
}

/** Lo que se hace con UN paso al cerrarlo: hecho, o postergado (sólo los de `PASOS_POSTERGABLES`). */
export type CambioDePaso = { paso: PasoOnboarding; done?: boolean; postergar?: boolean };

/** Un paso que no se puede postergar: no depende de nada de afuera. */
export class PasoNoPostergable extends Error {
  constructor(public readonly paso: string) {
    super(`El paso «${paso}» no se puede dejar pendiente: no depende de nada de afuera.`);
  }
}

/**
 * Aplica los cambios a un estado y decide si el onboarding quedó CERRADO. Es la regla que comparten el
 * wizard (acción 'paso' de /api/onboarding) y el chat de arranque (/api/onboarding/arranque): con dos
 * copias, una cerraba el onboarding con una regla y la otra con otra, y el cliente quedaba encerrado o
 * entraba con un paso sin hacer. Pura y sin `server-only` para que un test la ejecute.
 *
 * Postergar se valida ACÁ, en positivo, contra el catálogo: esconder el botón no protege nada. Y el
 * cierre pregunta «¿están TODOS cerrados?» (`onboardingCompleto`), nunca «¿cerraste el último?».
 */
export function aplicarCambiosDePaso(
  s: OnboardingState,
  cambios: CambioDePaso[],
  pasos: PasoOnboarding[],
  quien: string,
  ahora: string,
): OnboardingState {
  for (const c of cambios) if (c.postergar && !esPostergable(c.paso)) throw new PasoNoPostergable(c.paso);
  if (s.status === 'pending') { s.status = 'in_progress'; s.startedAt = s.startedAt ?? ahora; }
  for (const c of cambios) {
    s.step = c.paso;
    // `postergado` y `done` conviven: postergar no cierra el paso, lo saca del camino. Cuando el
    // cliente lo resuelva de verdad, se marca `done` encima.
    if (c.postergar) s.steps[c.paso].postergado = true;
    if (c.done) s.steps[c.paso].done = true;
  }
  if (s.status !== 'done' && onboardingCompleto(s, pasos)) {
    s.status = 'done';
    s.completedAt = ahora;
    s.completedBy = quien;
  }
  return s;
}
