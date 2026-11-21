'use client';
// =============================================================================
// «AUTOCOMPLETAR»: el chat del onboarding lo ofrece y la barra del administrador lo dibuja (21/11/2026)
// =============================================================================
// Martín: «Datos de Mauricio» sale de la barra y en su lugar va «Autocompletar», con las respuestas de ejemplo que antes salían ADENTRO
// del chat (así el chat queda igual que el de un cliente). El chat (app/onboarding/ChatArranqueV2.tsx) pone acá qué hacer para contestar
// la pregunta de ahora, SÓLO en la revisión (la puerta la decide la página); la barra (app/_components/Autocompletar.tsx) lo dibuja si hay.
// =============================================================================
import { useSyncExternalStore } from 'react';

let hacer: (() => void) | null = null;
const oyentes = new Set<() => void>();

/** Lo pone el chat (null = nada que autocompletar ahora). */
export function ponerAutocompletar(f: (() => void) | null): void {
  hacer = f;
  for (const o of oyentes) o();
}

/** Qué hacer al tocar «Autocompletar», o null. */
export function useAutocompletar(): (() => void) | null {
  return useSyncExternalStore(
    (o) => { oyentes.add(o); return () => { oyentes.delete(o); }; },
    () => hacer,
    () => null,
  );
}
