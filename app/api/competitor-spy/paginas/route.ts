// =============================================================================
// /api/competitor-spy/paginas — las páginas de un competidor capturadas con la extensión (4/11/2026)
// =============================================================================
// «Sus páginas» las pide al abrir y cuando la extensión avisa que capturó una (lib/spy-pagina-capturada.ts). Sólo lee.
//
//   GET ?id=<competidor> → { ok, capturas: PaginaCapturada[] }   (sin el texto: la pantalla dibuja la foto y el título)
// =============================================================================

import type { NextRequest } from 'next/server';
import { soloAdminDeTab } from '@/lib/puerta-admin-tab';
import { esCompetidorDelNegocio, paginasCapturadas } from '@/lib/spy-pagina-capturada-servidor';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // La misma puerta que la vista previa y que la oferta: es la pestaña Funnel de Spy.
  const cerrada = await soloAdminDeTab('market-an');
  if (cerrada) return cerrada;
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) return Response.json({ ok: false, error: 'Falta el competidor.' }, { status: 400 });
  try {
    if (!(await esCompetidorDelNegocio(id))) return Response.json({ ok: false, error: 'Ese competidor no está.' }, { status: 404 });
    const capturas = Object.values(await paginasCapturadas(id)).map(({ texto: _texto, ...p }) => p);
    return Response.json({ ok: true, capturas });
  } catch (e) {
    console.warn(`[spy-paginas] ${id}: ${e instanceof Error ? e.message : String(e)}`);
    return Response.json({ ok: false, error: 'No pude leer sus páginas capturadas.' }, { status: 500 });
  }
}
