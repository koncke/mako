// =============================================================================
// Adónde lleva un /second-brain guardado, para quien tiene el Ops Center (lógica pura, con test)
// =============================================================================
// Martín (17/10/2026, 19:31): «Me sigue apareciendo una tab de "ops center" y otra de "Second brain"... Elimina la de second
// brain, el second brain vive dentro de ops center y es el grafo, no otro chat». Para el super admin hay UNA sola pantalla
// (AGENTS.md → el Centro): el Second Brain se abre desde adentro, y la ruta de antes (un favorito, un link viejo) lleva al
// GRAFO del Ops Center. A los demás (el cliente y su equipo) /second-brain sigue siendo su chat con MaKo.

import { tabEnCapa } from './capas';

/** La puerta del Ops Center. */
export const RUTA_OPS_CENTER = '/admin/operaciones';
/** Su grafo: el Second Brain visto desde el Ops Center. */
export const RUTA_GRAFO_OPS_CENTER = `${RUTA_OPS_CENTER}?panel=mapa`;

/** Lo que dice la URL de que ya pide algo concreto: ese pedido se respeta y no se le pone el grafo. */
const PIDE_ALGO = ['panel', 'chat', 'centro', 'ticketera', 'area', 'grupo'] as const;

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

// =============================================================================
// La pantalla de entrada en la COMPUTADORA: el Ops Center (21/10/2026)
// =============================================================================
// Martín, 21/10 22:54: «en desktop siempre al iniciar me lleva a dashboard, cuando dijimos que debería ir a Ops Center
// siempre» (docs/ops-center-principal.md §1: «El Ops Center es la puerta principal de MaKo»). El teléfono ya entraba ahí
// desde el 20/10 (lib/movil-rutas.ts → ENTRADA_MOVIL); la computadora seguía con la casa de antes: /general, que redirige
// al Dashboard. La decide el repartidor (app/inicio/page.tsx), que es a donde van el login, el 2FA, el start_url de la PWA
// y todo «volver al inicio»; el onboarding pendiente sigue yendo al wizard ANTES de esto (lo decide la página).

/**
 * El Ops Center de cada negocio: la fila «Ops Center» de la barra del cliente, de su equipo (closer y setter incluidos) y
 * del super admin MIRANDO a un cliente (app/_components/nav.ts → MAKO_NAV, key `mako`). tests/inicio-ops-center.test.ts
 * fija que sea el `href` de esa fila: si la barra lo muda, la entrada lo sigue.
 */
export const RUTA_OPS_CENTER_NEGOCIO = '/second-brain';
/** Su clave en las capas (lib/capas.ts): la misma de la fila. */
const KEY_OPS_CENTER_NEGOCIO = 'mako';
/** Sin el Ops Center en el plan: la casa de antes (/general → el Dashboard). Hoy ninguna capa lo deja afuera. */
export const CASA_SIN_OPS_CENTER = '/general';

/** Lo que el repartidor sabe de quien entra. */
export type QuienEntra = {
  /** El super admin que opera MaKo, sin mirar a un cliente (`quienOpera`, lib/second-brain-opera.ts). */
  opera: boolean;
  /** La capa del negocio que se abre (`getCapaActual`). */
  capa: string | null | undefined;
};

/**
 * Adónde entra cada uno en la computadora. El super admin, a SU Ops Center (/admin/operaciones, la fila de su barra);
 * los demás, al de su negocio. ⚠️ Sin la tab en el plan NO se lo manda ahí igual: la portada sería el cartel «No está en
 * tu plan» (lib/tab-access.ts → requireCapa) y su «Ir al inicio» volvería acá. `enElPlan` es `tabEnCapa`; el test le
 * pasa un plan sin el Ops Center, que hoy no existe.
 */
export function casaEnLaComputadora(q: QuienEntra, enElPlan: typeof tabEnCapa = tabEnCapa): string {
  if (q.opera) return RUTA_OPS_CENTER;
  return enElPlan(KEY_OPS_CENTER_NEGOCIO, q.capa) ? RUTA_OPS_CENTER_NEGOCIO : CASA_SIN_OPS_CENTER;
}
