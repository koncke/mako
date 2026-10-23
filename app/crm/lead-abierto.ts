// =============================================================================
// El lead con la ficha abierta en el tablero, para la estrella de MaKo (22/10/2026, CR3 con OC6)
// =============================================================================
// La estrella del CRM (app/crm/mako-crm/PanelMakoCrm.tsx) va AL LADO del tablero y no adentro (app/crm/page.tsx), así que
// no sabe qué ficha está abierta. Con la ficha de Ana abierta, «movelo a Ganado» desde la estrella tiene que ser Ana: la
// pieza lo toma de su `entidad` (lib/chat-desde.ts) y el mensaje lleva el chip «desde CRM › Ana». El tablero publica acá
// el lead que abre (y null al cerrarla o al desmontarse), y la estrella lo lee.
// Sin estado de React compartido entre los dos: un almacén chico con `useSyncExternalStore`, como la pieza lo pide.
// =============================================================================

import { useSyncExternalStore } from 'react';
import type { EntidadChat } from '@/lib/chat-desde';

export type LeadAbierto = { id: number; nombre: string };

let actual: LeadAbierto | null = null;
const oyentes = new Set<() => void>();

/** El tablero avisa qué ficha abrió (null = ninguna). Lo mismo dos veces no despierta a nadie. */
export function publicarLeadAbierto(l: LeadAbierto | null): void {
  if (l === actual || (l && actual && l.id === actual.id && l.nombre === actual.nombre)) return;
  actual = l;
  for (const f of oyentes) f();
}

const suscribir = (f: () => void) => { oyentes.add(f); return () => { oyentes.delete(f); }; };

/** El lead con la ficha abierta, para quien lo dibuja (en el server, ninguno). */
export const useLeadAbierto = (): LeadAbierto | null => useSyncExternalStore(suscribir, () => actual, () => null);

/** La entidad de la estrella: el lead, con su nombre (sin nombre, «Lead 4821»: la pieza descarta una entidad sin título). */
export const entidadDelLead = (l: LeadAbierto | null): EntidadChat | null =>
  l ? { tipo: 'lead', id: l.id, titulo: l.nombre.trim() || `Lead ${l.id}` } : null;
