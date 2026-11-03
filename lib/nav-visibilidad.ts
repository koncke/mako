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
  /** La cuenta de un cliente de una AGENCIA (29/10/2026): no ve lo marcado `noParaClienteDeAgencia` (MaKo Partners). */
  clienteDeAgencia?: boolean;
};

/**
 * Tres ejes independientes: `adminOnly` (sólo la barra del super admin), ROL (closer y
 * setter ven sólo lo anotado con su rol) y CAPA (lo que contrató el cliente).
 */
export function puedeVerItem(it: NavItem, v: VistaNav): boolean {
  const rolCliente = v.rolWs === 'closer' || v.rolWs === 'setter';
  return (!it.adminOnly || v.adminShell)
    && (!rolCliente || (it.rolesWs as string[] | undefined)?.includes(v.rolWs) === true)
    // `soloCapas` (MaKo Partners, 17/10/2026): el ADMIN de un workspace de esas capas, o el super admin.
    && (!it.soloCapas || v.adminShell || (it.soloCapas.includes(v.capa) && !rolCliente))
    // `noEnPlataforma` (26/10/2026): Partners y Agency, fuera de la barra del super admin; sus programas los mira en Customers.
    && !(it.noEnPlataforma && v.adminShell)
    // `noParaClienteDeAgencia` (29/10/2026, Thiago: «yo no me meto con ese cliente»): MaKo no le ofrece nada al cliente de una agencia.
    && !(it.noParaClienteDeAgencia && v.clienteDeAgencia)
    // `fueraDeLaBarra` (2/11/2026, Martín: «la de offer no la quiero»): el ítem EXISTE —su key es
    // contrato con la base: los permisos por capa, el onboarding por tab y el móvil la resuelven con
    // `itemNav`— pero no se dibuja. Borrar la entrada habría devuelto `undefined` en todos esos
    // lugares, y el daño no es que falte un renglón: es un negocio que pierde el permiso de una tab
    // porque su key dejó de existir.
    // ⚠️ NO BLOQUEA LA PÁGINA: el enforcement real es server-side (lib/tab-access). /offer sigue
    // respondiendo, y se llega desde el Ops Center.
    && !it.fueraDeLaBarra
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
