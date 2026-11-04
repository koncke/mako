// =============================================================================
// /api/landing-generator/replicar/borrador — los borradores de una réplica (ticket #54, 4/11/2026)
// =============================================================================
// Lo leído de una página de afuera queda como borrador del negocio (lo guarda la ruta de lectura, ./leer/route.ts). Esto
// lo retoma, lo lista, guarda lo que la persona va eligiendo y lo descarta. La regla: lib/editor-landing/replica-borrador.ts.
//
//   GET    ?url=<página>  → { ok, borrador | null }   (para retomar sin volver a leer: no paga IA)
//   GET                   → { ok, borradores: [{ url, titulo, host, adaptar, actualizado }] }
//   POST   { url, eleccion } → { ok, guardado }       (qué replicar, formato, tema, «Tu oferta»)
//   DELETE ?url=<página>  → { ok }                    («Descartar borrador»)
//
// La puerta, la de ./leer y /replicar: admin del workspace y la tab `landing-writer` en su capa.
// =============================================================================

import { getCapaActual, getRolWsEfectivo } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import {
  borrarBorradorReplica, cambiarEleccionReplica, leerBorradorReplica, listarBorradoresReplica,
} from '@/lib/editor-landing/replica-borrador-server';

export const dynamic = 'force-dynamic';

const falla = (status: number, error: string) => Response.json({ ok: false, error }, { status });

async function puerta(): Promise<Response | null> {
  const rol = await getRolWsEfectivo();
  if (rol == null) return falla(401, 'no autenticado');
  if (rol !== 'admin') return falla(403, 'Sólo el admin de la cuenta');
  if (!tabEnCapa('landing-writer', await getCapaActual())) return falla(404, 'No existe');
  return null;
}

export async function GET(req: Request) {
  const no = await puerta();
  if (no) return no;
  const url = new URL(req.url).searchParams.get('url');
  try {
    if (url) {
      const b = await leerBorradorReplica(url);
      // La lectura de la página va entera (la pantalla la dibuja); lo leído en el navegador también (la réplica lo usa).
      return Response.json({ ok: true, borrador: b });
    }
    return Response.json({ ok: true, borradores: await listarBorradoresReplica() });
  } catch (e) {
    console.error('[landing-generator/replicar/borrador] GET', e instanceof Error ? e.message : e);
    return falla(503, 'No pude leer tus borradores. Vuelve a intentar.');
  }
}

export async function POST(req: Request) {
  const no = await puerta();
  if (no) return no;
  let body: { url?: unknown; eleccion?: unknown };
  try { body = await req.json(); } catch { return falla(400, 'body inválido'); }
  if (!body || typeof body !== 'object') return falla(400, 'body inválido');
  try {
    return Response.json({ ok: true, guardado: await cambiarEleccionReplica(body.url, body.eleccion) });
  } catch (e) {
    console.error('[landing-generator/replicar/borrador] POST', e instanceof Error ? e.message : e);
    return falla(503, 'No pude guardar tu borrador. Vuelve a intentar.');
  }
}

export async function DELETE(req: Request) {
  const no = await puerta();
  if (no) return no;
  try {
    await borrarBorradorReplica(new URL(req.url).searchParams.get('url'));
    return Response.json({ ok: true });
  } catch (e) {
    console.error('[landing-generator/replicar/borrador] DELETE', e instanceof Error ? e.message : e);
    return falla(503, 'No pude descartar el borrador. Vuelve a intentar.');
  }
}
