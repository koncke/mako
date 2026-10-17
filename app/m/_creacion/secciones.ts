// =============================================================================
// La barra de secciones de una tab de creación en el teléfono: QUÉ secciones y a dónde lleva cada una
// =============================================================================
// En escritorio, Video, Image, Copywriting y AI Avatar son tabs con SECCIONES (nav.ts → `secciones`), y arriba de
// cada una va la barra de secciones (app/_components/SeccionesTab.tsx) con las que esa persona puede ver. El teléfono
// la DESTILA: las mismas secciones, en el mismo orden y con el mismo nombre, con la MISMA regla
// (`seccionesVisibles`, lib/nav-visibilidad.ts) y cada una a su pantalla del teléfono (`rutaMovil`). Una que no
// tuviera pantalla en el teléfono no se ofrece: llevaría a la cubierta «se usa en la computadora» (hasta el 17/10/2026
// era Copy Method; ese día tuvo la suya, app/m/admin/copywriting).
//
// Lo dibuja <SeccionesTabM> (app/m/_ui). Vive acá y no en lib/movil-creacion.ts porque necesita `rutaMovil`, y
// lib/movil-rutas.ts importa aquel módulo (un import de vuelta deja sus listas en `undefined`).
// =============================================================================

import { FAMILIAS, type NavItem } from '@/app/_components/nav';
import { seccionesVisibles, type VistaNav } from '@/lib/nav-visibilidad';
import { rutaMovil } from '@/lib/movil-rutas';
import type { SeccionTabM } from '@/app/m/_ui/SeccionesTabM';

/** Las tabs de escritorio con secciones que el teléfono ya tiene. */
export type TabCreacion = 'video' | 'image' | 'copywriting' | 'ai-avatar';

function tabDe(key: TabCreacion): NavItem | null {
  for (const f of FAMILIAS) for (const it of f.bloques.flat()) if (it.key === key) return it;
  return null;
}

/**
 * Quién mira, en el idioma del Sidebar: `adminShell` es el super admin SIN mirar a un cliente (el único que ve lo
 * `adminOnly`), la misma pregunta que /m/mas hace para el Ops Center.
 */
export function vistaDe(ctx: { sesion: { rol?: string | null }; rol: string | null; capa: string | null; impersonando: boolean }): VistaNav {
  return { adminShell: ctx.sesion.rol === 'admin' && !ctx.impersonando, rolWs: ctx.rol ?? '', capa: ctx.capa ?? '' };
}

/** Las secciones de la tab que esta persona ve, con su pantalla del teléfono, en el orden de escritorio. */
export function seccionesTabM(tab: TabCreacion, v: VistaNav): SeccionTabM[] {
  const t = tabDe(tab);
  if (!t) return [];
  return seccionesVisibles(t, v).flatMap((s): SeccionTabM[] => {
    const href = rutaMovil(s.href);
    if (!href) return [];
    return [{ key: s.key, label: s.seccion ?? s.label, href: href.split('?')[0], pronto: !!s.comingSoon }];
  });
}

/** El nombre de la tab (lo que lee el lector de pantalla en la barra). */
export function nombreTab(tab: TabCreacion): string {
  return tabDe(tab)?.label ?? tab;
}
