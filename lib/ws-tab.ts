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

// =============================================================================
// El workspace de un TABLERO EMBEBIDO — `?ws=` sin tocar la pestaña
// =============================================================================
// «Aun no veo el plan, las tareas y proyectos de cada cliente» (28/09/2026): la
// ficha de un cliente en el panel de la plataforma monta el tablero de OTRO
// workspace. La pestaña sigue siendo la del super admin —tiene que seguir siéndolo,
// porque la lista de atrás es la suya— así que el `?ws=` de arriba no sirve: ponerlo
// en la URL apaga el propio panel (`estaImpersonando()` pasa a true y
// `/customer-success` deja de renderizar la vista de la plataforma).
//
// ⚠️ NO CAMBIA NADA DE LA SEGURIDAD, y eso es lo que lo hace aceptable. Lo único que
// hace es poner en la URL de esas llamadas el MISMO `?ws=` que ya pone «Inspeccionar»;
// quien decide si ese número vale sigue siendo `proxy.ts`, que lo acepta únicamente si
// la sesión FIRMADA dice `rol === 'admin'`. Un cliente que setee esto no consigue nada.
//
// ⚠️ LA LISTA ES POSITIVA Y CERRADA: sólo las rutas del tablero. Sin eso, la llamada
// que el panel de atrás hace mientras el modal está abierto (`/api/admin/workspaces`,
// `/api/admin/usuarios`) también saldría apuntando al cliente — y ahí es donde una
// carrera se convierte en una escritura en el inquilino equivocado. Todo lo que no
// esté acá sigue yendo al workspace de la pestaña, que es el default correcto.
//
// ⚠️ Y LA LISTA NO SE PUEDE QUEDAR VIEJA EN SILENCIO: `tests/ws-de-trabajo.test.ts`
// barre los `fetch('/api/…')` del subárbol del tablero y falla si aparece uno que no
// esté acá. Una ruta nueva del board sin su entrada escribiría en el workspace del que
// MIRA, con 200 y sin un error — que es el modo de falla que esto viene a cerrar.

/** Las rutas que el tablero llama. Medido sobre `app/plan/` el 28/09/2026. */
export const RUTAS_DEL_TABLERO = [
  '/api/todo',
  '/api/plan-board',
  '/api/plan-buscar',
  '/api/plan-propuesta',
  '/api/plan-dictado',
  '/api/plan-fathom',
  '/api/plan-reunion',
  '/api/mako-guardian',
  '/api/checklist-coach',
] as const;

/** ¿Esta ruta es del tablero? Compara el PATH exacto o su prefijo de segmento. */
export function esRutaDelTablero(pathname: string): boolean {
  return RUTAS_DEL_TABLERO.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

/**
 * El workspace del tablero embebido, mientras haya uno montado.
 *
 * Es estado de MÓDULO y no de React a propósito: lo tiene que leer el parche de
 * `fetch`, que vive fuera del árbol. Lo pone y lo saca el componente que monta el
 * tablero (ver `app/admin/TableroDelCliente.tsx`), y `null` es el estado normal.
 */
let wsEmbebido: number | null = null;

export const setWsDeTrabajo = (ws: number | null): void => { wsEmbebido = parseWs(ws); };
export const getWsDeTrabajo = (): number | null => wsEmbebido;
