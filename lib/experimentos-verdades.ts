// =============================================================================
// experimentos-verdades — lo que MaKo cita como PROBADO en un negocio (módulo puro, 25/10/2026)
// =============================================================================
// Lo arma `resumenExperimentos` (lib/experimentos.ts) para el contexto de MaKo: las verdades validadas, lo que se probó
// que NO funciona y lo que todavía se mide. Vive aparte para poder probarlo sin la base (experimentos.ts es server-only).
//
// ⚠️ «PROBADO QUE NO FUNCIONA» sólo con las refutadas que vienen de una PRUEBA A/B (`config.prueba_id`, lib/pruebas/):
// el juez las da sólo con daño demostrado en el horizonte fijo (un corte temprano o «da lo mismo» son no_concluyente).
// Un experimento de antes/después refutado no entra: medía toda la cuenta contra sí misma, y «no subió» no es «no sirve».
// =============================================================================

export type ExperimentoParaVerdades = {
  titulo: string; estado: string; veredicto: string | null; aprendizaje: string | null;
  metrica: string; metrica_label: string | null; config: Record<string, unknown> | null;
};

const dePrueba = (e: ExperimentoParaVerdades): boolean => e.config != null && e.config.prueba_id != null;

/** El texto para el contexto de MaKo, o '' si no hay nada que citar. */
export function textoDeVerdades(todos: readonly ExperimentoParaVerdades[]): string {
  const validadas = todos.filter((e) => e.estado === 'cerrado' && e.veredicto === 'validada');
  const noFunciona = todos.filter((e) => e.estado === 'cerrado' && e.veredicto === 'refutada' && dePrueba(e));
  const activos = todos.filter((e) => e.estado === 'activo');
  if (!validadas.length && !noFunciona.length && !activos.length) return '';
  const partes: string[] = [];
  if (validadas.length) {
    const lineas = validadas.slice(0, 12).map((e) => `- ${e.aprendizaje || e.titulo}`).join('\n');
    partes.push(`VERDADES VALIDADAS (lo ÚNICO probado con datos en este negocio — cita esto cuando aplique):\n${lineas}`);
  }
  if (noFunciona.length) {
    const lineas = noFunciona.slice(0, 8).map((e) => `- ${e.aprendizaje || e.titulo}`).join('\n');
    partes.push(`PROBADO QUE NO FUNCIONA (una prueba A/B con daño demostrado — no lo recomiendes de nuevo):\n${lineas}`);
  }
  if (activos.length) {
    const lineas = activos.slice(0, 12).map((e) => `- "${e.titulo}" mide ${e.metrica_label ?? e.metrica} (sin verdad todavía)`).join('\n');
    partes.push(`EXPERIMENTOS EN CURSO (todavía sin conclusión — no adelantes el resultado):\n${lineas}`);
  }
  return partes.join('\n\n');
}
