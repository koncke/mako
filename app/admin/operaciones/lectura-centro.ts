// =============================================================================
// leerCentro — las lecturas del Ops Center por GET (app/api/operaciones/lectura/route.ts), no por server action (23/10/2026)
// =============================================================================
// Next corre las server actions de a una por cliente: con la de Vercel (hasta 8 s) y el refresco cada 2,5-8 s, la Ticketera
// y el Uso de IA esperaban en la cola sin mostrar nada. Por GET van en paralelo. Las ESCRITURAS siguen siendo acciones.
// Tira si la ruta no contesta 200, como tiraba la acción con un 503: quien llama ya tiene su `.catch`.
// =============================================================================

export const LECTURAS_CENTRO = ['pushes', 'foto', 'credito', 'computadoras', 'bandeja'] as const;
export type LecturaCentro = (typeof LECTURAS_CENTRO)[number];

export async function leerCentro<T>(que: LecturaCentro, extra: Record<string, string> = {}): Promise<T> {
  const q = new URLSearchParams({ que, ...extra });
  const r = await fetch(`/api/operaciones/lectura?${q}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`La lectura «${que}» contestó ${r.status}.`);
  return (await r.json()) as T;
}
