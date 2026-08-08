// =============================================================================
// El workspace de ESTA pestaña — `?ws=N`
// =============================================================================
// El super admin necesita mirar varios clientes A LA VEZ: uno por pestaña del
// navegador, y seguir viendo su propio panel en otra.
//
// ⚠️ Por qué NO se puede resolver con una cookie —que es como estaba—: las
// cookies son del NAVEGADOR, no de la pestaña. Entrar a un cliente le cambiaba
// el contexto a todas las pestañas abiertas, incluida la del panel de admin.
// Y no hay forma de arreglarlo del lado del cliente: `sessionStorage` sí es por
// pestaña, pero el server no lo puede leer cuando pinta la página, y 61 de las
// 104 pantallas deciden con un gate server-side (`requireCapa`) qué mostrar.
//
// Lo único que viaja por pestaña Y llega en el request del documento es la URL.
// De ahí `?ws=N`. Una sola regla para todo —páginas y llamadas a /api—, para que
// auditarlo sea leer una cosa.
//
// LA SEGURIDAD NO ESTÁ ACÁ. Este archivo solo mueve un número. Quien decide si
// ese número vale es `proxy.ts`, que lo acepta ÚNICAMENTE si la sesión firmada
// dice que sos admin de agencia, y que borra el header interno en cada request
// para que nadie lo mande a mano. Sin esa validación, `?ws=` sería un IDOR: el
// peor de esta app, porque abre los datos de otro cliente.
//
// ISOMÓRFICO a propósito (sin `server-only`): lo importan el proxy, el
// resolvedor del workspace y los componentes de cliente.

/** El parámetro en la URL. Se ve, y está bien que se vea: te dice a quién mirás. */
export const WS_PARAM = 'ws';

/**
 * El header interno con el que el proxy le pasa el workspace ya validado al
 * resto de la app. NUNCA se confía en el que venga de afuera: el proxy lo borra
 * siempre antes de decidir si lo pone.
 */
export const WS_HEADER = 'x-mako-ws';

/** Un id de workspace válido, o null. Acepta lo que sea y no explota. */
export function parseWs(v: string | number | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Le pega el `?ws=` de la pestaña actual a un destino interno.
 *
 * Devuelve el href intacto cuando no hay workspace de pestaña, cuando el destino
 * es externo o cuando YA trae su propio `ws` (un link que apunta a un cliente
 * puntual manda sobre el contexto).
 */
export function conWs(href: string, ws: number | null): string {
  if (!ws || !href) return href;
  // Externos, anclas y protocolos raros: no son navegación adentro de la app.
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const [sinHash, hash] = href.split('#');
  const [ruta, query = ''] = sinHash.split('?');
  const qs = new URLSearchParams(query);
  if (qs.has(WS_PARAM)) return href;
  qs.set(WS_PARAM, String(ws));
  return `${ruta}?${qs.toString()}${hash ? `#${hash}` : ''}`;
}

/** El workspace de un `location.search` (o de cualquier query string). */
export function wsDeBusqueda(search: string | null | undefined): number | null {
  if (!search) return null;
  return parseWs(new URLSearchParams(search).get(WS_PARAM));
}
