// =============================================================================
// wizard-progreso — cuántos pasos faltan, cuando se puede saber
// =============================================================================
// La decisión que pintan los puntitos del WizardShell, sacada del componente
// para poder probarla: es aritmética pura y ya se equivocó dos veces de maneras
// que solo se ven mirando la pantalla (una fila de puntitos que promete cinco
// pasos y salta al tercero; un "Último paso" con un "Siguiente →" abajo).
//
// La regla de la pieza, en una línea: LA POSICIÓN ACTUAL SIEMPRE ES VERDAD, la
// cola solo se promete cuando se puede contar. Cuando no, se dicen tres puntitos
// chicos ("faltan pasos") en vez de una cantidad inventada.

/** Cómo le llega la cuenta a la pieza. Ver `ProgresoWizard` en WizardShell. */
export type EntradaProgreso =
  /**
   * El MAPA que el wizard está recorriendo. `pos` es dónde cae el paso actual
   * dentro del mapa (-1 = no está: mapa vacío o `pasoActual` viejo) y `variable`
   * marca que el mapa YA se movió con la pieza a la vista.
   */
  | { modo: 'mapa'; largo: number; pos: number; variable: boolean }
  /**
   * Dos números sueltos que mantiene el llamador. `salto` = se probó que este
   * wizard se saltea pantallas (fue de la 1 a la 3), y desde ahí `total` cuenta
   * pantallas que tampoco se van a ver.
   */
  | { modo: 'cuenta'; total: number | undefined; actual: number; salto: boolean };

/**
 * Pasos que faltan DESPUÉS del actual: `>0` faltan tantos · `0` ninguno ·
 * `-1` faltan, cantidad desconocida.
 *
 * `enUltimo` gana siempre, en las dos direcciones, y ese es el corazón de esto:
 *
 *   · Si dice que es el último, no hay cola que valga — lo manda el mismo estado
 *     que pinta el botón Confirmar, así que es la señal confiable.
 *   · Si dice que NO es el último y la cuenta da cero, la que miente es LA
 *     CUENTA, y hay que callarla. Los dos modos tienen que responder igual acá:
 *     el modo `cuenta` ya lo hacía y el modo `mapa` pintaba "Último paso (N)"
 *     con un "Siguiente →" abajo. Pasa de verdad cuando el mapa es más grueso
 *     que las pantallas — el onboarding tiene varias pantallas por sección y su
 *     mapa son las secciones, así que en la primera pantalla de la última
 *     sección la cuenta da cero y todavía faltan dos.
 */
export function colaDeProgreso(e: EntradaProgreso & { enUltimo: boolean }): number {
  if (e.enUltimo) return 0;
  if (e.modo === 'mapa') {
    // Sin poder ubicar el paso en el mapa no hay desde dónde contar; y un mapa
    // que ya cambió a la vista del usuario no vuelve a prometer una cantidad.
    if (e.variable || e.pos < 0) return -1;
    const restan = e.largo - 1 - e.pos;
    return restan > 0 ? restan : -1;
  }
  const total = typeof e.total === 'number' && Number.isFinite(e.total) ? Math.trunc(e.total) : null;
  if (total === null || e.salto || total <= e.actual + 1) return -1;
  return total - e.actual - 1;
}

/** La leyenda del indicador (también es el `aria-label` de los puntitos). */
export function etiquetaProgreso(actual: number, futuros: number): string {
  if (futuros === 0) return `Último paso (${actual + 1})`;
  if (futuros > 0) return `Paso ${actual + 1} de ${actual + 1 + futuros}`;
  return `Paso ${actual + 1} · faltan pasos`;
}
