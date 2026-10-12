// =============================================================================
// Quién ve qué ítem de la barra — UNA regla para el Sidebar y las secciones
// =============================================================================
// La regla vivía adentro del Sidebar. Desde las tabs unificadas (Video, Image,
// Copywriting, 12/10/2026) la usan dos: el Sidebar, para decidir si una tab se
// dibuja, y la barra de secciones (app/_components/SeccionesTab.tsx), para decidir
// qué secciones ofrece. Si fueran dos copias, la barra podría mostrar una sección
// que el Sidebar esconde (AGENTS.md → «Una cosa, un lugar»).
//
// Es COSMÉTICA: el cierre real de cada pantalla es el guard de su page
// (lib/tab-access.ts). Isomórfico a propósito (lo leen componentes de cliente).

import type { NavItem } from '@/app/_components/nav';
import { tabEnCapa } from '@/lib/capas';

export type VistaNav = {
  /** Super admin SIN impersonar: el único que ve lo `adminOnly`. */
  adminShell: boolean;
  /** Rol dentro del workspace ('admin' | 'closer' | 'setter' | ''). */
  rolWs: string;
  /** La capa que compró el cliente (lib/capas.ts). */
  capa: string;
};

/**
 * Tres ejes independientes: `adminOnly` (sólo la barra del super admin), ROL (closer y
 * setter ven sólo lo anotado con su rol) y CAPA (lo que contrató el cliente).
 */
export function puedeVerItem(it: NavItem, v: VistaNav): boolean {
  const rolCliente = v.rolWs === 'closer' || v.rolWs === 'setter';
  return (!it.adminOnly || v.adminShell)
    && (!rolCliente || (it.rolesWs as string[] | undefined)?.includes(v.rolWs) === true)
    && tabEnCapa(it.key, v.capa || undefined);
}

/** Las secciones de una tab unificada que esta persona puede ver, en su orden. */
export function seccionesVisibles(tab: NavItem, v: VistaNav): NavItem[] {
  return (tab.secciones ?? []).filter((s) => puedeVerItem(s, v));
}

/**
 * La tab como se dibuja en la barra, o `null` si no se ve. Una tab unificada se ve si se
 * ve alguna de sus secciones (su propia key no está en ninguna capa: no es una pantalla)
 * y lleva a la primera visible que NO sea «Próximamente».
 */
export function resolverTab(it: NavItem, v: VistaNav): NavItem | null {
  if (!it.secciones) return puedeVerItem(it, v) ? it : null;
  const visibles = seccionesVisibles(it, v);
  if (visibles.length === 0) return null;
  const destino = visibles.find((s) => !s.comingSoon) ?? visibles[0];
  return { ...it, href: destino.href };
}
