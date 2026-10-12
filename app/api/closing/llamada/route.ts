// =============================================================================
// GET /api/closing/llamada?recording_id=N — el detalle de UNA llamada, para su ficha en el Dashboard
// =============================================================================
// Lo pide app/dashboard/bloques/extra/FichaLlamada.tsx al abrirse (la lista del bloque «Las llamadas» es
// compacta a propósito: el análisis entero de cada llamada se baja cuando alguien la abre).
//
// Puerta (./puerta.ts): sesión, admin o closer, el Dashboard en la capa y Fathom conectado. La fila se lee
// con `leerLlamada` (lib/api-mako/areas/closing.helpers.ts, por getTenantDb: una llamada de otro workspace
// no existe para este request) y sale por `fichaDe`, que copia SÓLO lo que la ficha dibuja.
//
// ⚠️ Es una ruta de SESIÓN, no de la API de MaKo: nombres de personas, citas y links de Fathom sólo van a
//    la pantalla de quien mira (por /api/v1 no sale nada de esto: closing.def.ts, `detalle_llamada` sin http).

import type { NextRequest } from 'next/server';
import { leerLlamada } from '@/lib/api-mako/areas/closing.helpers';
import { fichaDe } from '@/app/dashboard/bloques/extra/llamadas-modelo';
import { puertaClosing } from '../puerta';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const SIN_CACHE = { 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest) {
  const cerrada = await puertaClosing({ fathom: true });
  if (cerrada) return cerrada;

  const recordingId = Number(req.nextUrl.searchParams.get('recording_id'));
  if (!Number.isInteger(recordingId) || recordingId <= 0) {
    return Response.json({ ok: false, error: 'Falta la llamada (recording_id)' }, { status: 400, headers: SIN_CACHE });
  }

  try {
    const c = await leerLlamada(recordingId);
    if (!c) return Response.json({ ok: false, error: 'Esa llamada no está en esta cuenta' }, { status: 404, headers: SIN_CACHE });
    return Response.json({ ok: true, llamada: fichaDe(c) }, { headers: SIN_CACHE });
  } catch (err) {
    // El mensaje de la base no es para la pantalla: va al log.
    console.error(`[closing:llamada] recording_id=${recordingId}: ${err instanceof Error ? err.message : String(err)}`);
    return Response.json({ ok: false, error: 'No pude leer la llamada' }, { status: 500, headers: SIN_CACHE });
  }
}
