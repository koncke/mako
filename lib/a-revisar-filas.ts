// =============================================================================
// a-revisar-filas — las filas de «A revisar»: UNA por lead, con todos sus datos adentro
// =============================================================================
// Martín (14/10/2026): «No pongas muchas filas del mismo lead, en todo caso un número de cuantos
// datos sin revisar tiene». La ruta (app/api/datos-sin-marcar-count/route.ts) arma con esto lo que
// dibuja el panel (app/_components/MakoConfirmGate.tsx).
//
// Puro y sin `server-only`, para que el test lo EJECUTE: la revisión del 14/10 mostró que los tests
// de la ruta eran regex sobre el fuente y daban verde con la agrupación rota.
// =============================================================================

export type PasoFila = { id: string; label: string };

/**
 * Una fila: un lead. `pasos` vacío = está en la lista por otra cosa (una nutrición manual vencida,
 * una reunión pasada sin desenlace) y no hay nada que ignorar. `porOtraCosa` es ese caso CON datos
 * (tipo 'R' y 'M' del worklist): ignorar sus datos no lo saca de la lista.
 */
export type FilaLead = { lead_id: number; lead_nombre: string; pasos: PasoFila[]; porOtraCosa?: true };

type ItemWorklist = { lead_id: number; lead_nombre: string; tipo?: string; faltantes?: ReadonlyArray<{ id: string; label: string }> };
type Ignorado = { lead_id: number; lead_nombre: string; paso: { id: string; label: string } };

/** Los leads del worklist (que ya viene uno por lead), con sus datos, hasta `tope` leads. */
export function filasPorLead(items: readonly ItemWorklist[], tope: number): FilaLead[] {
  const filas: FilaLead[] = [];
  for (const i of items) {
    if (filas.length >= tope) break;
    filas.push({
      lead_id: i.lead_id, lead_nombre: i.lead_nombre, pasos: (i.faltantes ?? []).map((f) => ({ id: f.id, label: f.label })),
      ...(i.tipo === 'R' || i.tipo === 'M' ? { porOtraCosa: true as const } : {}),
    });
  }
  return filas;
}

/**
 * Los ignorados llegan UNO POR DATO: se juntan por lead, en el orden en que aparecen, sin repetir un
 * dato, hasta `tope` leads. Es el «Ver más» con su «volver a avisar»: si un lead ignorado no entra
 * acá, lo que se ignoró con la ✕ no tiene vuelta desde el panel, por eso el tope es generoso.
 */
export function ocultosPorLead(ignorados: readonly Ignorado[], tope: number): FilaLead[] {
  const ocultos: FilaLead[] = [];
  for (const x of ignorados) {
    const ya = ocultos.find((o) => o.lead_id === x.lead_id);
    if (ya) { if (!ya.pasos.some((p) => p.id === x.paso.id)) ya.pasos.push({ id: x.paso.id, label: x.paso.label }); continue; }
    if (ocultos.length >= tope) continue;
    ocultos.push({ lead_id: x.lead_id, lead_nombre: x.lead_nombre, pasos: [{ id: x.paso.id, label: x.paso.label }] });
  }
  return ocultos;
}
