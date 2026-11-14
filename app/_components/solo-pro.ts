'use client';

// =============================================================================
// solo-pro — lo que es SÓLO de MaKo Pro, visto desde el navegador (14/11/2026, la IA de los editores)
// =============================================================================
// Martín: «el editor de imágenes y editor de videos sí deberían estar disponibles para la versión de 47, pero no deberían
// estar disponibles el tema de editar con inteligencia artificial». La defensa es el servidor (lib/editores-ia-pro.ts: 403
// con `pasarAPro`); esto es para que un Esencial vea el CANDADO en la entrada (./CandadoSoloPro.tsx) en vez de tocar y
// recibir un error.
//
// Dos fuentes, y basta una:
//   · `planEsencial` de /api/auth/me (la misma lectura, una vez por pestaña: ./useClienteDeAgencia.ts);
//   · una respuesta del servidor con `pasarAPro` (`marcarSoloPro`): si la lectura todavía no llegó, o el plan cambió después
//     de cargar la pestaña, el primer 403 prende el candado en todas las entradas de esa función a la vez.
// ⚠️ ES COSMÉTICO, como `nav-visibilidad`: esconder la entrada no defiende nada. Ante la duda (no se pudo leer el plan), no
//    hay candado; el servidor decide igual.
// =============================================================================

import { useSyncExternalStore } from 'react';
import type { FuncionSoloPro } from '@/lib/topes-plan';
import { leerPlanEsencial, usePlanEsencial } from './useClienteDeAgencia';

const marcadas = new Set<FuncionSoloPro>();
const oyentes = new Set<() => void>();
const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => { oyentes.delete(f); };
};

/** Lo que contesta el candado del servidor (lib/editores-ia-pro.ts, app/crm/grupo-wa-actions.ts): el texto y a dónde va el botón. */
export const esRespuestaSoloPro = (j: unknown): j is { error: string; pasarAPro: string } =>
  !!j && typeof j === 'object' && typeof (j as { error?: unknown }).error === 'string'
  && typeof (j as { pasarAPro?: unknown }).pasarAPro === 'string';

/** El servidor dijo que `f` es de Pro: todas sus entradas pasan a mostrar el candado. */
export function marcarSoloPro(f: FuncionSoloPro): void {
  if (marcadas.has(f)) return;
  marcadas.add(f);
  for (const o of oyentes) o();
}

/** ¿`f` lleva el candado para quien mira? `false` mientras no se sabe (primero se dibuja abierto, como el Sidebar). */
export function useSoloPro(f: FuncionSoloPro): boolean {
  const plan = usePlanEsencial();
  const marcada = useSyncExternalStore(suscribir, () => marcadas.has(f), () => false);
  return plan === true || marcada;
}

/** Lo mismo, sin hook: para lo que corre fuera de un componente (la «Edición automática», su botón de la barra). */
export async function esSoloPro(f: FuncionSoloPro): Promise<boolean> {
  return marcadas.has(f) || (await leerPlanEsencial());
}
