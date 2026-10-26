// =============================================================================
// Quién mira, en el idioma del Sidebar (para la barra de secciones de una tab de creación)
// =============================================================================
// La barra de secciones de Video, Image, Copywriting y AI Avatar es <SeccionesTabM> (app/m/_ui/SeccionesTabM.tsx: la
// misma de Offer › Strategy). Le falta saber QUIÉN mira con la regla de la sidebar (lib/nav-visibilidad.ts):
// `adminShell` es el super admin SIN mirar a un cliente (el único que ve lo `adminOnly`), la misma pregunta que More
// hace para el Ops Center. Una función, para que las doce páginas no la escriban cada una.
// =============================================================================

import type { VistaNav } from '@/lib/nav-visibilidad';

export function vistaDe(ctx: { sesion: { rol?: string | null }; rol: string | null; capa: string | null; impersonando: boolean }): VistaNav {
  return { adminShell: ctx.sesion.rol === 'admin' && !ctx.impersonando, rolWs: ctx.rol ?? '', capa: ctx.capa ?? '' };
}
