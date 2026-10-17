// =============================================================================
// plan-fecha-limite — qué fecha límite se le puede poner a una tarea del Plan (puro, con test)
// =============================================================================
// La usa `cambiar_fecha_tarea_plan` (lib/api-mako/areas/plan.run.ts), que desde el 17/10/2026 también viaja por WhatsApp
// («movela al viernes»). Un modelo convierte «el viernes» en una fecha: puede devolver el año pasado, un 31 de febrero o
// un formato raro. Una tarea que nace vencida ensucia «Vencidas» del tablero entero, así que lo que no sirve se rechaza
// con la razón (el modelo la corrige en el mismo turno) y nunca se adivina.
// =============================================================================

/** `null` = la fecha sirve. Si no, la razón en una línea. `hoy` es el día del NEGOCIO (YYYY-MM-DD). */
export function validarFechaLimite(fecha: string, hoy: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return 'La fecha va en YYYY-MM-DD (por ejemplo 2026-10-24).';
  const d = new Date(`${fecha}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== fecha) return `${fecha} no es una fecha que exista.`;
  if (fecha < hoy) return `${fecha} ya pasó (hoy es ${hoy}): una fecha límite va de hoy en adelante.`;
  return null;
}
