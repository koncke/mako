// =============================================================================
// /video-generator — server wrapper: guard + contexto + monta la app
// =============================================================================
// Mismo patrón que /reels: la page aplica el guard (requireRolWs con la key
// exacta del nav) y junta el estado que la vista necesita. El trabajo pesado
// vive en VideoGeneratorApp.tsx ('use client').
//
// El estado del contexto se lee VIVO en cada carga (no se recuerda): si el
// cliente borra sus fotos, el aviso de «sin foto no hay identidad» vuelve solo.

import { requireRolWs } from '@/lib/tab-access';
import { getWorkspaceActual } from '@/lib/workspace';
import { estadoContextoVideo, leerHistorial } from './video-datos';
import { estadoPuente } from '@/lib/flow-cola';
import { VideoGeneratorApp } from './VideoGeneratorApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page() {
  await requireRolWs([], { nav: 'video-generator' });

  const ws = await getWorkspaceActual();
  // Agencia sin impersonar: no hay workspace del que leer. La vista igual se
  // sirve (las actions cortan con su propio error si intenta operar).
  if (ws == null) return <VideoGeneratorApp historialInicial={[]} contexto={null} puente={null} />;

  const [historial, contexto, puente] = await Promise.all([
    leerHistorial(),
    estadoContextoVideo(),
    // Estado VIVO: si el cliente desconecta el navegador, el panel lo dice sola
    // la próxima vez que entra.
    estadoPuente().catch(() => null),
  ]);

  return <VideoGeneratorApp historialInicial={historial} contexto={contexto} puente={puente} />;
}
