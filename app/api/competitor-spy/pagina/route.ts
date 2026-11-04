// =============================================================================
// /api/competitor-spy/pagina — ¿una página de un competidor se puede mostrar en «Sus páginas»? (4/11/2026)
// =============================================================================
// Martín, con una captura de Funnel → «Sus páginas» de Den Borg: la vista previa decía «La página respondió 403: está bloqueando
// la lectura automática.». Textual: «Y revisa esto, que no se bloquee, y que funcione todo».
//
// La vista previa es el iframe de la ruta del Diagnóstico del Web Generator, y cuando la página no deja leerla, esa ruta dibuja
// su error ADENTRO del iframe: la pantalla no lo puede saber. Esto pregunta antes, con la MISMA lectura de siempre
// (lib/landing-fetch.ts, SSRF-segura): si abre, la pantalla muestra el iframe; si no (un 403, el desafío de un antibots, una
// página caída), muestra «Abrir» para verla en el navegador de la persona, sin cartel técnico.
//
// ⚠️ NO SE EVADE EL BLOQUEO. Una página que pide demostrar que es una persona (el «Just a moment...» de Cloudflare de Beacons)
// se respeta: no se intenta pasar con otro navegador ni con otro proxy. Se abre donde la persona la ve, y si quiere guardarla en
// Spy, lo hace desde su navegador con la extensión («Guardar en Spy»).
//
//   POST { id, url } → { ok, estado: 'abierta' | 'no-pudo' }   (sin el porqué: la pantalla no lo dibuja)
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { paginaParaVer } from '@/lib/landing-fetch';
import { soloAdminDeTab } from '@/lib/puerta-admin-tab';
import { ofertaGuardada } from '@/lib/spy-oferta-servidor';
import { webComparable } from '@/lib/spy-oferta';
import { getWorkspaceActual } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
/** Bajar una página tiene su propio plazo (lib/landing-fetch.ts); esto es el techo de la ruta. */
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  // La misma puerta que la vista previa (admin) y que la oferta: la pantalla sólo la pide con la vista previa disponible.
  const cerrada = await soloAdminDeTab('market-an');
  if (cerrada) return cerrada;
  const s = await getUsuarioActual();
  const ws = s ? await getWorkspaceActual() : null;
  if (!s || ws == null) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const cuerpo = (await req.json().catch(() => ({}))) as { id?: unknown; url?: unknown };
  const id = Number(cuerpo.id);
  const url = typeof cuerpo.url === 'string' ? cuerpo.url.trim() : '';
  if (!Number.isInteger(id) || id <= 0 || !/^https?:\/\//i.test(url)) return Response.json({ ok: false, error: 'Falta la página.' }, { status: 400 });

  // Sólo las páginas SUYAS (su web y las que enlaza): esto no es un lector de cualquier dirección.
  const v = await ofertaGuardada(id).catch(() => null);
  if (!v) return Response.json({ ok: false, error: 'Ese competidor no está.' }, { status: 404 });
  const suyas = 'enlaces' in v ? [...v.urls, ...v.enlaces] : [];
  if (!suyas.some((u) => webComparable(u) === webComparable(url))) return Response.json({ ok: false, error: 'Esa página no es suya.' }, { status: 404 });

  try {
    await paginaParaVer(url);
    return Response.json({ ok: true, estado: 'abierta' });
  } catch (e) {
    // El porqué queda en el log; la pantalla sólo ofrece «Abrir».
    console.warn(`[spy-pagina] ws=${ws} ${url}: ${e instanceof Error ? e.message : String(e)}`);
    return Response.json({ ok: true, estado: 'no-pudo' });
  }
}
