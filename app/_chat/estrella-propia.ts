// =============================================================================
// ¿Esta pantalla ya tiene su estrella? (1/11/2026)
// =============================================================================
// La barra monta una estrella en toda tab que no tenga la suya (./EstrellaDeLaApp.tsx); la tab que la tiene
// (`<MakoEnLaTab tab="CRM" … />`, con sus sugerencias y su pedido) se anota acá, y la de la barra se retira. Vive aparte de
// MakoEnLaTab porque la barra está en todas las páginas y ese archivo trae el motor del chat: importarlo la haría pesar.

import { useSyncExternalStore } from 'react';

let propias = 0;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((o) => o());

/** La tab montó su estrella. Devuelve con qué se borra al desmontar. */
export function anotarEstrellaPropia(): () => void {
  propias += 1;
  avisar();
  return () => { propias -= 1; avisar(); };
}

function suscribir(o: () => void) { oyentes.add(o); return () => { oyentes.delete(o); }; }

export function useHayEstrellaPropia(): boolean {
  return useSyncExternalStore(suscribir, () => propias > 0, () => false);
}
