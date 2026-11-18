// =============================================================================
// revelado-propuesta — la propuesta del chat de la landing se ve ARMARSE, sección por sección (18/11/2026)
// =============================================================================
// AGENTS.md, «Lo que MaKo construye se ve CONSTRUYÉNDOSE» (Martín, 28/10/2026): «si el resultado llega entero de una
// vez, igual se revela por partes». La respuesta de «editar» (PanelAgente.tsx, AskAgent.tsx) llega entera, y la tarjeta
// «Original | Modificado» la dibujaba de golpe. Ahora las secciones que cambian aparecen de a una con la cadencia de la
// pieza compartida (`useRevelado`, app/_ui/ArmadoEnVivo.tsx: la cadencia y el «reducir movimiento» viven AHÍ, no acá).
//
// Lo que decide este módulo (puro, con test: tests/web-generator-propuesta-revelada.test.ts):
//   · qué propuesta se revela: SÓLO la que llegó y todavía no se vio. El chat es un store de módulo que sobrevive al
//     panel (⇤ lo desmonta): sin esta marca, cada vez que el panel se abre todas las tarjetas se volverían a armar;
//   · cuántas filas se ven y si se puede aceptar: «Aceptar» sale recién con todo a la vista (lo que se aprueba se ve
//     entero); mientras tanto, «Ver todo» lo muestra de una. Nada de esto frena el trabajo: aplicar sigue siendo UN
//     paso, con su versión de respaldo antes (`aceptarPropuesta`).
// =============================================================================

/** Las propuestas que ya se vieron armarse (por el objeto: el store guarda la misma referencia mientras vive). */
const vistas = new WeakSet<object>();

/** ¿Esta propuesta se revela de a una? Sólo la pendiente que todavía no se vio. */
export function seRevela(propuesta: object, estado: string): boolean {
  return estado === 'pendiente' && !vistas.has(propuesta);
}

/** Ya se vio entera (terminó de armarse, se salteó o dejó de estar pendiente): no se vuelve a armar. */
export function marcarRevelada(propuesta: object): void {
  vistas.add(propuesta);
}

/**
 * Cuántas filas se dibujan y si la revisión ya está completa. `visibles` es lo que devuelve `useRevelado`;
 * sin revelado (una propuesta ya vista, o que no está pendiente), todas.
 */
export function comoSeVe(p: { total: number; visibles: number; revelando: boolean }): { mostrar: number; completa: boolean } {
  const total = Math.max(0, Math.floor(p.total));
  const mostrar = p.revelando ? Math.min(Math.max(0, Math.floor(p.visibles)), total) : total;
  return { mostrar, completa: mostrar >= total };
}
