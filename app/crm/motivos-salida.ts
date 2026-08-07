// =============================================================================
// Categorías de motivo al sacar un lead del pipeline (fuente única)
// =============================================================================
// Perder ≠ descalificar: son dos preguntas distintas y por eso las listas son
// distintas. Vivían sueltas dentro de StageMoveDialog; ahora las usan los DOS
// wizards que pueden cerrar un lead ("¿Qué hacer ahora?" del worklist y el de
// completar el movimiento de etapa). Módulo puro: sin 'use client' ni
// 'server-only', para que lo pueda importar cualquiera de los dos lados.

/** Chips de categoría según la etapa de salida. Se completan con un detalle escrito. */
export function motivosDeSalida(stageKey: string): string[] {
  return stageKey === 'descal'
    ? ['No calificado', 'Fuera de perfil', 'Sin presupuesto', 'No es quien decide', 'Otro']
    : ['Precio', 'Timing', 'Eligió a otro', 'Fantasma', 'No respondió', 'Otro'];
}

/** Cómo se guarda el motivo: "Categoría — detalle". El server lo lee como un texto solo. */
export function motivoFinalDe(categoria: string, detalle: string): string {
  return [categoria.trim(), detalle.trim()].filter(Boolean).join(' — ');
}

/**
 * ¿Mover a esta etapa exige registrar un motivo?
 *
 * Espeja el corte de `stepsForStage` (lib/stage-requirements.ts): perdido/descal
 * lo piden, 'noresp' no pide nada. La diferencia con el validador es que ACÁ se
 * pregunta siempre, aunque el lead ya tenga un `motivo_perdida` viejo: el
 * validador devuelve [] en ese caso y la pérdida nueva se quedaba con el motivo
 * de la anterior.
 */
export function pideMotivo(stageKey: string): boolean {
  return stageKey === 'perdido' || stageKey === 'descal';
}
