// =============================================================================
// Qué hace cada entrada de la barra del Ops Center con el panel (23/10/2026)
// =============================================================================
// Martín, en la vista de un cliente: «Revisá la navegación con el Second Brain, porque funciona bastante mal... Si estoy dentro
// de la ticketera y entro allí no hace nada». Medido en producción (ws10): con la Ticketera abierta, «Second Brain» cambiaba la
// URL a `?panel=mapa` y la pantalla seguía en Soporte. La Ticketera del cliente era un estado suelto (`ticketsCliente`) que no
// estaba en la URL, nadie lo cerraba al ir al grafo, y el panel la dibuja ANTES que el grafo. La del super admin no fallaba:
// sigue a `?ticketera=` y su «Second Brain» la cierra.
//
// Las reglas, una sola vez para las dos barras (ChatSecondBrain.tsx las usa en cada botón):
//   · lo que se toca se VE: ninguna entrada deja el panel como estaba (salvo la Ticketera, que se abre y se cierra);
//   · la Ticketera se cierra con cualquier otra entrada, y ANTES de navegar: el `replaceState` que la saca de la URL en medio
//     de un `router.push` deja a Next en la URL vieja (docs/hallazgos-operaciones.md, el grafo que no se iba);
//   · lo que manda es la URL (`?ticketera=`, `?panel=mapa`): un link a la misma página que no la trae (la barra de la app)
//     la cierra igual.
// ⚠️ PURO: lo lee tests/ops-center-navegacion.test.ts en node.

/** Lo que ocupa el panel, en el orden en que se dibuja: la Ticketera tapa al grafo, el grafo al chat nuevo. */
export type PanelOps = 'ticketera' | 'mapa' | 'nuevo' | 'chat';
export type EstadoPanel = { ticketera: boolean; mapa: boolean; nuevo: boolean };
/** Las entradas de la barra: la Ticketera, el Second Brain (el grafo), un chat de la lista y «Nuevo chat». */
export type EntradaBarra = 'ticketera' | 'second-brain' | 'chat' | 'nuevo';
/**
 * Lo que queda después de tocar: la Ticketera y el chat nuevo abiertos o no, y adónde se navega (`ir`). El grafo lo arma el
 * SERVIDOR, así que entrar o salir de él es navegar: 'mapa' (`?panel=mapa`), 'volver' (a lo elegido), 'chat' (al chat tocado)
 * y 'base' (la página sin nada). null = no se navega.
 */
export type PasoBarra = { ticketera: boolean; nuevo: boolean; ir: 'mapa' | 'volver' | 'chat' | 'base' | null };

export function panelQueSeVe(s: EstadoPanel): PanelOps {
  return s.ticketera ? 'ticketera' : s.mapa ? 'mapa' : s.nuevo ? 'nuevo' : 'chat';
}

/**
 * Tocar una entrada. `veMapa`: quien ve el grafo (sin él, «Second Brain» abre el Cerebro, como un chat). `alterna`: «Second
 * Brain» con el grafo a la vista vuelve a lo elegido (el del cliente; el del super admin lo deja).
 */
export function tocarEnLaBarra(e: EntradaBarra, s: EstadoPanel, { veMapa = true, alterna = false } = {}): PasoBarra {
  if (e === 'ticketera') return s.ticketera ? { ticketera: false, nuevo: s.nuevo, ir: null } : { ticketera: true, nuevo: false, ir: null };
  if (e === 'second-brain' && veMapa) {
    const viendoMapa = panelQueSeVe(s) === 'mapa';
    return { ticketera: false, nuevo: false, ir: viendoMapa && alterna ? 'volver' : 'mapa' };
  }
  if (e === 'nuevo') return { ticketera: false, nuevo: true, ir: s.mapa ? 'base' : null };
  // Un chat (o «Second Brain» sin el grafo, que abre el Cerebro): con el grafo abierto, navegar a él.
  return { ticketera: false, nuevo: false, ir: s.mapa ? 'chat' : null };
}

/** Cómo queda el estado después del paso (el grafo está si se fue a él, o si estaba y no se navegó). */
export function despuesDe(s: EstadoPanel, p: PasoBarra): EstadoPanel {
  return { ticketera: p.ticketera, nuevo: p.nuevo, mapa: p.ir === 'mapa' ? true : p.ir ? false : s.mapa };
}
