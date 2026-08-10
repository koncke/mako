// =============================================================================
// GET /api/agente/hook — el script del hook, listo para bajar
// =============================================================================
// Devuelve `mako-telemetria.mjs` generado (ver lib/agente-plugin.ts). Se baja desde el
// tutorial de /integraciones y se guarda en `.claude/hooks/` del proyecto del cliente.
//
// Con sesión de browser, no con token de agente: esto lo baja una persona una vez,
// desde la pantalla. Un agente no tiene por qué poder pedirlo.
//
// El origen se lee del REQUEST y no de una variable de entorno: así el script que se
// baja desde localhost apunta a localhost y el que se baja desde producción apunta a
// producción, sin un paso de configuración donde equivocarse. Si hay una URL pública
// configurada gana ella — es la que sabe el dominio cuando hay un proxy adelante que
// reescribe el Host.
//
// ⚠️ Acá decía `NEXT_PUBLIC_BASE_URL`, que NO EXISTE. Nunca ganó nadie: siempre caía al
// origin del request, que por suerte es lo correcto. En /second-brain el mismo nombre
// inventado no tenía red y entregaba una skill con la URL vacía.
// =============================================================================

import { NextResponse } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { agenteHookScript } from '@/lib/agente-plugin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const sesion = await getUsuarioActual();
  if (!sesion) return NextResponse.json({ ok: false, error: 'sin sesión' }, { status: 401 });

  const base = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;

  return new NextResponse(agenteHookScript(base), {
    headers: {
      'content-type': 'text/javascript; charset=utf-8',
      'content-disposition': 'attachment; filename="mako-telemetria.mjs"',
      // No se cachea: el script se regenera con las reglas de redacción de HOY. Una
      // copia vieja en un CDN es exactamente el problema que este diseño vino a evitar.
      'cache-control': 'no-store',
    },
  });
}
