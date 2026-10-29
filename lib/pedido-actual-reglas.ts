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

/**
 * ¿El pedido es una NAVEGACIÓN DEL CLIENTE —el router de Next pidiendo el RSC de otra pantalla, o precargándolo— y no la
 * carga de un documento? (28/10/2026, Martín: «Cada vez que entro a web generator, hay un bug que aparece todo en blanco,
 * le tengo que dar a refresh para que me cargue la tab».) El router manda `Next-Url` (la pantalla en la que está) y el
 * navegador `Sec-Fetch-Dest: empty` (es un fetch); una carga trae `document` (o `iframe`) y nunca `Next-Url`. Sin ninguno
 * de los dos (curl, un navegador viejo) se toma como documento: es lo de siempre. `headers()` no deja ver el `RSC: 1`
 * (Next lo saca: `FLIGHT_HEADERS`), por eso estas dos.
 */
export function esNavegacionDelClienteDe(nextUrl: string | null | undefined, secFetchDest: string | null | undefined): boolean {
  if (nextUrl) return true;
  const d = (secFetchDest ?? '').toLowerCase();
  return !!d && d !== 'document' && d !== 'iframe' && d !== 'frame';
}
