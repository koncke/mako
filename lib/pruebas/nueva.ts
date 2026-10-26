// =============================================================================
// pruebas/nueva — lo que necesita una prueba A/B para crearse, y lo que puede tener mal (PURO, 25/10/2026)
// =============================================================================
// Lo usa `crearPrueba` (lib/pruebas/store.ts) antes de escribir, y lo puede usar una pantalla o la API para decirlo antes
// de llamar. Vive aparte del store para probarlo sin la base.
// =============================================================================

import { problemasDeRamas } from './asignar';
import { problemasDeMetrica, type DefinicionMetrica, type Superficie } from './metricas';

export type NuevaPrueba = {
  superficie: Superficie; lugar: Record<string, unknown>; claveLugar: string;
  titulo: string; hipotesis: string; cambio?: string | null; origen: 'dueno' | 'mako';
  metrica: string; metricaDef?: DefinicionMetrica; guardrails?: Array<{ metrica: string; toleranciaRel: number }>;
  ventanaDias: number; tasaBase?: number | null; mdeRel: number; nPorRama: number; minDias?: number; maxDias: number;
  autoAplicar?: boolean;
  ramas: Array<{ clave: string; nombre: string; peso: number; control?: boolean; contenido?: Record<string, unknown>; firma?: string | null; porque?: string | null; autor?: 'dueno' | 'ia' }>;
  /** Arranca en el acto (la tarjeta del dueño); sin esto nace «propuesta» y vence a las 72 h. */
  arrancar?: boolean;
};

/** Una propuesta que nadie aprobó vence a las 72 h (diseño 2.7). */
export const VENCE_PROPUESTA_HORAS = 72;

/** Lo que una prueba nueva tiene mal, en palabras. Vacío = se puede crear. */
export function problemasDeNuevaPrueba(p: NuevaPrueba): string[] {
  const err = [...problemasDeRamas(p.ramas), ...problemasDeMetrica(p.metrica, p.superficie, p.metricaDef ?? {})];
  for (const g of p.guardrails ?? []) err.push(...problemasDeMetrica(g.metrica, p.superficie, {}, true));
  if (!(p.nPorRama >= 1) || !(p.maxDias >= 1) || !(p.mdeRel > 0)) err.push('Falta el plan (el n por rama, el tope de días y el efecto): calcúlalo con planDePrueba.');
  if (!p.claveLugar || p.claveLugar.length < 3) err.push('Falta el lugar de la prueba (landing:<doc> o auto:<secuencia>).');
  return err;
}
