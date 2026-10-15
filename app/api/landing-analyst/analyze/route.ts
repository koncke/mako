// =============================================================================
// POST /api/landing-analyst/analyze — analiza UNA landing
// =============================================================================
// El camino del botón "Analizar" de /landing-analyst: MaKo baja la URL, le lee
// el copy y lo cruza con el comportamiento medido de esa misma página.
// La baranda SSRF (solo http/https, IPs públicas, revalidación en cada redirect)
// vive en lib/landing-fetch.ts: es lo que evita que una URL escrita por el
// usuario le haga pedir cosas al server desde adentro de la red.
//
// ⚠️ SÓLO ADMIN (tanda 6 del editor de landings, 14/10/2026; pendiente de la tanda 2: «las rutas
// analyze, sync y pulso del Landing Analyst no miran el rol»). Gasta IA con las keys del negocio y no
// tenía guarda: cualquier sesión del workspace (un closer, un setter) la podía llamar. La misma puerta
// que /view y /mapa (el admin del negocio o el super admin); tests/landing-analyst-rol.test.ts la exige
// en cada ruta de /api/landing-analyst ANTES de cualquier otro trabajo.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { getRolWsEfectivo } from '@/lib/workspace';
import { analizarLanding } from '@/lib/landing-analyst';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if ((await getSesionAdmin()) == null && (await getRolWsEfectivo()) !== 'admin') {
    return Response.json({ ok: false, error: 'solo admin' }, { status: 403 });
  }
  let body: { url?: string; texto?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const url = (body.url ?? '').trim();
  if (!url) return Response.json({ ok: false, error: 'Falta la dirección de la landing.' }, { status: 400 });

  try {
    // `texto`: el copy pegado a mano cuando la página se arma en el navegador y
    // no hay nada que descargar. Salta la bajada, no el análisis ni el cruce.
    const res = await analizarLanding(url, body.texto);
    if (!res.ok) {
      // No es un 500: la página del cliente falló (404, JS-only, timeout), no
      // nuestro server. La UI lo muestra como un aviso, no como un error roto.
      // `pegable` le dice a la pantalla que ofrezca pegar el texto.
      console.warn(`[landing-analyst:analyze] ${res.url} → ${res.error}`);
      return Response.json({ ok: false, error: res.error, url: res.url, pegable: res.pegable === true }, { status: 200 });
    }
    console.log(`[landing-analyst:analyze] ${res.row.url} score=${res.row.score} hallazgos=${(res.row.hallazgos ?? []).length}`);
    return Response.json({ ok: true, row: res.row });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[landing-analyst:analyze] error: ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
