// =============================================================================
// ¿Está abierto el panel de MaKo de una tab? (22/10/2026)
// =============================================================================
// Martín: «si abro a MaKo, se debería plegar la sidebar principal, para optimizar espacios. Si antes la tenía desplegada y
// fija, al cerrar MaKo debe volver a su lugar». La estrella de cada tab (app/_chat/MakoEnLaTab.tsx) lo marca al abrir su panel
// y lo desmarca al cerrarlo o al salir de la tab; la barra de la app (app/_components/Sidebar.tsx) lo suma a su pliegue
// TEMPORAL (`plegadaAca`): se pliega a íconos sin tocar lo que la persona guardó, y al cerrar vuelve sola a como estaba.
// Sin CSS: lo cargan en node los tests de la barra.

import { useSyncExternalStore } from 'react';

let abierto = false;
const oyentes = new Set<() => void>();

/** El panel se abrió (true) o se cerró (false). Avisa sólo si cambió. */
export function marcarMakoAbierto(v: boolean): void {
  if (abierto === v) return;
  abierto = v;
  for (const avisar of oyentes) avisar();
}

export function makoAbierto(): boolean {
  return abierto;
}

export function suscribirMakoAbierto(avisar: () => void): () => void {
  oyentes.add(avisar);
  return () => { oyentes.delete(avisar); };
}

/** En el server y al hidratar, cerrado: el panel sólo se abre con un toque. */
export function useMakoAbierto(): boolean {
  return useSyncExternalStore(suscribirMakoAbierto, makoAbierto, () => false);
}
