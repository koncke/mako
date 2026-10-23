// La parte pura de lib/pedido-actual.ts (sin `server-only`, para que un test la corra): la query como la recibe una página.

export type QueryDelPedido = Record<string, string | string[]>;

/** La query como la recibe una página en `searchParams`: un valor, o una lista si se repite. */
export function queryComoSearchParams(search: string): QueryDelPedido {
  const out: QueryDelPedido = {};
  for (const [k, v] of new URLSearchParams(search)) {
    const ya = out[k];
    out[k] = ya == null ? v : Array.isArray(ya) ? [...ya, v] : [ya, v];
  }
  return out;
}
