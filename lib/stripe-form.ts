// =============================================================================
// stripe-form — el cuerpo `application/x-www-form-urlencoded` con anidado de Stripe
// =============================================================================
// Puro y SIN `server-only`: lo ejecuta el test contra los ejemplos curl oficiales.
//
// Stripe NO recibe JSON: recibe form-urlencoded con los objetos y las listas aplanados como
// `line_items[0][price_data][currency]=usd` y `enabled_events[]=…` (docs.stripe.com/api, ejemplos
// curl de checkout/sessions y webhook_endpoints, 11/10/2026). Un `JSON.stringify` o un
// `URLSearchParams(obj)` pelado mandan `[object Object]` y Stripe contesta 400 con un mensaje que
// culpa al parámetro, no al formato.

type Valor = string | number | boolean | null | undefined | Valor[] | { [k: string]: Valor };

function aplanar(prefijo: string, v: Valor, out: Array<[string, string]>, listaSinIndice: boolean): void {
  if (v === undefined || v === null) return;
  if (Array.isArray(v)) {
    v.forEach((x, i) => {
      // Una lista de escalares va como `clave[]=a&clave[]=b` (enabled_events); una de objetos, con índice.
      const esEscalar = x === null || typeof x !== 'object';
      aplanar(listaSinIndice && esEscalar ? `${prefijo}[]` : `${prefijo}[${i}]`, x, out, listaSinIndice);
    });
    return;
  }
  if (typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) aplanar(prefijo ? `${prefijo}[${k}]` : k, x, out, listaSinIndice);
    return;
  }
  out.push([prefijo, typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v)]);
}

/** `{ a: { b: [ { c: 1 } ] }, ev: ['x', 'y'] }` → `a[b][0][c]=1&ev[]=x&ev[]=y`. Omite null/undefined. */
export function formStripe(params: Record<string, Valor>): string {
  const pares: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(params)) aplanar(k, v, pares, true);
  return pares.map(([k, v]) => `${encodeURIComponent(k).replace(/%5B/g, '[').replace(/%5D/g, ']')}=${encodeURIComponent(v)}`).join('&');
}
