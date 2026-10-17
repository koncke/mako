// =============================================================================
// GET /api/second-brain/cerebro — el grafo de nuevo, para el grafo VIVO de la pantalla (17/10/2026)
// =============================================================================
// La pantalla lo pide cada 3 minutos mientras la pestaña está a la vista (app/second-brain/VistaCerebro.tsx), y los
// nodos que aparecieron entran VIAJANDO (Grafo.tsx). `?huella=` es la del grafo que ya tiene: si no cambió, la
// respuesta no trae el grafo (`igual: true`) y no se redibuja nada.
//
// ⚠️ La MISMA puerta que las otras rutas del Second Brain (`soloAdminDeTab`): el grafo no es del closer ni del setter.
// ⚠️ Con los chats con MaKo de quien pide, como la pantalla: son suyos (lib/cerebro-chats.ts).

import type { NextRequest } from 'next/server';
import { soloAdminDeTab } from '@/lib/puerta-admin-tab';
import { construirCerebro } from '@/lib/cerebro-grafo';
import { chatsMakoDeQuienMira } from '@/lib/cerebro-chats';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cerrada = await soloAdminDeTab('second-brain');
  if (cerrada) return cerrada;
  try {
    const cerebro = await construirCerebro({ chatsMako: await chatsMakoDeQuienMira() });
    const tenia = req.nextUrl.searchParams.get('huella');
    if (tenia && tenia === cerebro.huella) return Response.json({ ok: true, igual: true, huella: cerebro.huella });
    return Response.json({ ok: true, igual: false, huella: cerebro.huella, cerebro });
  } catch (e) {
    console.error('[second-brain/cerebro]', e instanceof Error ? e.message : e);
    return Response.json({ ok: false, error: 'No pude leer tu Second Brain.' }, { status: 500 });
  }
}
