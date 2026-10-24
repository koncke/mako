// =============================================================================
// leerCentro — las lecturas del Ops Center por GET (app/api/operaciones/lectura/route.ts), no por server action (23/10/2026)
// =============================================================================
// Next corre las server actions de a una por cliente: con la de Vercel (hasta 8 s) y el refresco cada 2,5-8 s, la Ticketera
// y el Uso de IA esperaban en la cola sin mostrar nada. Por GET van en paralelo. Las ESCRITURAS siguen siendo acciones.
// Tira si la ruta no contesta 200, como tiraba la acción con un 503: quien llama ya tiene su `.catch`.
// =============================================================================

// `turnos` (lo que se dijo en el chat abierto) se suma el 23/10/2026: corre en CADA refresco, y como acción también hacía cola.
// `pedidos` (los terminados viejos de un chat, al abrirlo) se suma el mismo día: la carga ya no los trae (pedidosDeLaCarga).
export const LECTURAS_CENTRO = ['pushes', 'foto', 'credito', 'computadoras', 'bandeja', 'turnos', 'pedidos'] as const;
export type LecturaCentro = (typeof LECTURAS_CENTRO)[number];

/** `extra`: los parámetros de la lectura; una lista va repetida (`l=a&l=b`). */
export async function leerCentro<T>(que: LecturaCentro, extra: Record<string, string | readonly string[]> = {}): Promise<T> {
  const q = new URLSearchParams({ que });
  for (const [k, v] of Object.entries(extra)) for (const x of typeof v === 'string' ? [v] : v) q.append(k, x);
  const r = await fetch(`/api/operaciones/lectura?${q}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`La lectura «${que}» contestó ${r.status}.`);
  return (await r.json()) as T;
}
