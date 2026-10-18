// =============================================================================
// Adónde lleva un /second-brain guardado, para quien tiene el Ops Center (lógica pura, con test)
// =============================================================================
// Martín (17/10/2026, 19:31): «Me sigue apareciendo una tab de "ops center" y otra de "Second brain"... Elimina la de second
// brain, el second brain vive dentro de ops center y es el grafo, no otro chat». Para el super admin hay UNA sola pantalla
// (AGENTS.md → el Centro): el Second Brain se abre desde adentro, y la ruta de antes (un favorito, un link viejo) lleva al
// GRAFO del Ops Center. A los demás (el cliente y su equipo) /second-brain sigue siendo su chat con MaKo.

/** La puerta del Ops Center. */
export const RUTA_OPS_CENTER = '/admin/operaciones';
/** Su grafo: el Second Brain visto desde el Ops Center. */
export const RUTA_GRAFO_OPS_CENTER = `${RUTA_OPS_CENTER}?panel=mapa`;

/** Lo que dice la URL de que ya pide algo concreto: ese pedido se respeta y no se le pone el grafo. */
const PIDE_ALGO = ['panel', 'chat', 'centro', 'ticketera', 'area'] as const;

/**
 * El destino de un `/second-brain?…` para el super admin: el Ops Center con la misma query (menos `ws`, que cada puerta
 * vuelve a poner con `rutaConWs`). Sin pedir nada concreto abre el grafo (`?panel=mapa`).
 */
export function rutaDelSecondBrainEnOpsCenter(query: Readonly<Record<string, string | string[] | undefined>> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (k === 'ws' || v == null) continue;
    for (const x of Array.isArray(v) ? v : [v]) q.append(k, x);
  }
  if (!PIDE_ALGO.some((k) => q.has(k))) q.set('panel', 'mapa');
  return `${RUTA_OPS_CENTER}?${q.toString()}`;
}
