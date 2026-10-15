import 'server-only';

// =============================================================================
// Quién puede abrir el Image Editor — cualquiera que tenga la tab
// =============================================================================
// Abierto a todos los workspaces el 15/10/2026 (Martín: «Que Image aparezca en todos
// los workspace»). Hasta ese día lo abría sólo el super admin, por persona, mientras
// se armaba por tandas. Molde: app/video-editor/acceso.ts (abierto el 12/10).
//
// Una sola pregunta, en UN lugar, que usan las páginas del editor (inicio, diseño y
// la ventana del presentador) y las rutas de /api/image-editor (lib/image-editor/
// server.ts → `puerta`): si cada una decidiera por su cuenta, un cambio de acceso se
// haría en dos de tres lados y el tercero rebotaría.
//
// Es la misma pregunta que toda tab (lib/tab-access.ts → `requireRolWs([])`): el rol
// del workspace tiene que ser admin (admin-cliente o agencia; closer y setter no) y la
// tab tiene que estar en la capa (lib/capas.ts: `completo` y `agencia` la ven por
// `navKeys: null`, `superadmin` por `userNavKeys: null`; `pm` no, igual que el Video
// Editor).
//
// ⚠️ El crédito de Doory (editor/CreditoDoory.tsx) lo ve desde ese día cada negocio
// que abra el editor: lo exige su licencia mientras haya código de Doory adentro.

import { requireRolWs } from '@/lib/tab-access';

// La pregunta sin redirigir vive en lib/image-editor/acceso.ts: la usa la API, que no puede arrastrar
// `next/navigation` (ver ese archivo).
export { veEditorImagen } from '@/lib/image-editor/acceso';

/** El guard de las pantallas del editor: lo de toda tab (sesión, capa, rol, onboarding). */
export async function requireEditorImagen(): Promise<void> {
  await requireRolWs([], { nav: 'image-editor' });
}
