// =============================================================================
// ¿La ficha del lead dibuja la pestaña «Tracking»?
// =============================================================================
// Pedido de Martín (12/10/2026, punto 18): «La tab de "Tracking" recién debería salir si configuré
// una campaña vinculado a ese funnel, sino que no aparezca».
//
// «Configuré una campaña vinculada a ese funnel» es una fila del mapa de campañas
// (`meta.campanas`, lib/campana-config.ts): una campaña o un conjunto de Meta asignado a un
// funnel desde «Lead entrante». El funnel del lead es su CASA (`leads.funnel_id`).
//
// ⚠️ EL FUNNEL DEL NEGOCIO SE ESCRIBE COMO `null` EN LOS DOS LADOS —el mapa de campañas y
// `leads.funnel_id`— (lib/campana-funnel.ts, lib/landing-funnel.ts), así que «null con null» es el
// caso normal y no un vacío. Y si alguna de las dos puntas trajera el id REAL del funnel del
// negocio (una fila vieja), se traduce a `null` antes de comparar: si no, ese lead perdería la
// pestaña teniendo su campaña asignada.
//
// Puro y sin `server-only`, para que el test lo EJECUTE (tests/lead-cabecera.test.ts). La lectura
// vive en lib/tracking-ficha-server.ts.
// =============================================================================

/** Un id de funnel como lo escriben las dos puntas (bigint: puede llegar como string). */
type IdFunnel = number | string | null | undefined;

export function funnelTieneCampana(
  asignadas: ReadonlyArray<{ funnelId: IdFunnel }>,
  funnelDelLead: IdFunnel,
  idDelDefault: number | null,
): boolean {
  const norm = (v: IdFunnel): number | null => {
    if (v == null || v === '') return null;
    const n = Number(v);
    if (!Number.isSafeInteger(n) || n <= 0) return null;
    return n === idDelDefault ? null : n;
  };
  const delLead = norm(funnelDelLead);
  return asignadas.some((c) => norm(c.funnelId) === delLead);
}
