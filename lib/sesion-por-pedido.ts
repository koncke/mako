// =============================================================================
// sesion-por-pedido — la sesión se lee UNA vez por pedido, también en una ruta /api (23/10/2026)
// =============================================================================
// Lo usa `getUsuarioActual` (lib/auth.ts). Vive aparte, sin `server-only`, para que un test lo corra.
// =============================================================================

/**
 * ⚠️ LA SESIÓN SE LEE UNA VEZ POR PEDIDO, TAMBIÉN EN UNA RUTA /api (23/10/2026, «Rendimiento y loaders»).
 *
 * El `cache()` de React de `getUsuarioActual` sólo memoiza dentro de un render de React (páginas y layouts). En una ruta /api no hay
 * render y no memoiza NADA: cada `getTenantDb()` → `getWorkspaceActual()` → `getUsuarioActual()` volvía a leer `usuarios`
 * (y la fecha del 2FA). Medido con scripts/consultas-por-pedido.mts: un pedido a /api/auth/me leía la sesión 19 veces
 * (41 idas a la base) y uno a /api/chat-agent/secuencias 61 veces (150 idas). Con las funciones en iad1 y la base en
 * us-west-2 son ~97 ms cada una: /api/auth/me tardaba 4,5 s con la función caliente, en CADA carga de pantalla.
 *
 * La clave es el objeto de cookies del pedido (Next devuelve el MISMO durante todo el pedido; uno nuevo en el siguiente,
 * así que el WeakMap no retiene nada) y el valor del token: si el pedido cambia la cookie de sesión (un login), la clave
 * cambia y se vuelve a leer. Una lectura que TIRA no queda guardada.
 */
const porPedido = new WeakMap<object, Map<string, Promise<unknown>>>();
export function enElPedido<T>(pedido: object, token: string, leer: () => Promise<T>): Promise<T> {
  let delPedido = porPedido.get(pedido);
  if (!delPedido) { delPedido = new Map(); porPedido.set(pedido, delPedido); }
  const ya = delPedido.get(token) as Promise<T> | undefined;
  if (ya) return ya;
  const p = leer();
  delPedido.set(token, p);
  p.catch(() => { if (delPedido.get(token) === p) delPedido.delete(token); });
  return p;
}

