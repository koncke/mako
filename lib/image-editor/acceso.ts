import 'server-only';

// =============================================================================
// ¿Quien mira puede usar el Image Editor? — la pregunta, suelta
// =============================================================================
// La misma que toda tab (admin del workspace y la tab en la capa), sin redirigir. Vive acá y no en
// app/image-editor/acceso.ts porque la usan la puerta de /api/image-editor (./server.ts) y, por ella, el
// área `imagen` de la API de MaKo: app/image-editor/acceso.ts importa lib/tab-access.ts, que importa
// `next/navigation`, y eso fuera de Next (un script, un test que corre los runners con
// `--conditions=react-server`) muere con «createContext is not a function». Pasó el 15/10/2026: el registro
// entero dejó de cargar en tests/voz-mako.test.ts. El guard de las PÁGINAS (`requireEditorImagen`, que sí
// redirige) sigue en app/image-editor/acceso.ts y reexporta ésta.

import { tabEnCapa } from '@/lib/capas';
import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';

/** ¿Quien mira puede usar el Image Editor? Para la API (no redirige). */
export async function veEditorImagen(): Promise<boolean> {
  if ((await getRolWsEfectivo()) !== 'admin') return false;
  return tabEnCapa('image-editor', await getCapaActual());
}
