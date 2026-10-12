// =============================================================================
// Quién puede abrir el Video Editor — cualquiera que tenga la tab
// =============================================================================
// Abierto a todos el 12/10/2026 («habilitalo para cualquiera», Martín). Hasta ese
// día lo abría sólo el super admin, mientras se armaba por tandas.
//
// Una sola pregunta, en UN lugar, que usan las dos pantallas del editor, la ruta
// de Texto a voz y el botón «Editar en el editor» de Video Generator: si cada uno
// decidiera por su cuenta, un cambio de acceso se haría en dos de tres lados, y el
// tercero ofrecería un botón que rebota.
//
// Es la misma pregunta que toda tab (lib/tab-access.ts → `requireRolWs([])`): el
// rol del workspace tiene que ser admin (admin-cliente o agencia; closer y setter
// no) y la tab tiene que estar en la capa (lib/capas.ts: `completo` y `agencia`
// la ven por `navKeys: null`; `superadmin` la lista; `pm` no, igual que Video
// Generator).

import 'server-only';
import { requireRolWs } from '@/lib/tab-access';
import { tabEnCapa } from '@/lib/capas';
import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';

/** ¿Quien mira puede usar el Video Editor? Para el botón y la API (no redirige). */
export async function veEditorVideo(): Promise<boolean> {
  if ((await getRolWsEfectivo()) !== 'admin') return false;
  return tabEnCapa('video-editor', await getCapaActual());
}

/** El guard de las dos pantallas del editor: lo de toda tab (sesión, capa, rol, onboarding). */
export async function requireEditorVideo(): Promise<void> {
  await requireRolWs([], { nav: 'video-editor' });
}
