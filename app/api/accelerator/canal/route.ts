// =============================================================================
// GET /api/accelerator/canal?red=instagram|youtube&q=<lo escrito> — buscar el Instagram o el YouTube de quien aplica (16/11/2026)
// =============================================================================
// Lo pide el formulario de /accelerator/aplicar mientras la persona escribe su @, su nombre o el link (los campos `instagram` y
// `youtube`, lib/aplicacion-accelerator.ts), para que elija su propia cuenta de la lista. La búsqueda es la de Competitor Spy
// (lib/aplicacion-accelerator-canal.ts). Contesta `{ ok, candidatos, vacio }`: `vacio` dice por qué no hay candidatos cuando no
// es «no existe» ('no-anda' o 'limite'), y el formulario deja pegar el link.
//
// ⚠️ PÚBLICA Y DE SÓLO LECTURA: va en PUBLICOS (lib/rutas-publicas.ts), sólo GET, no lee la cookie de sesión ni escribe nada. Pero
//    cada búsqueda puede costar crédito de Apify: tope por IP (acá) y por día para todo el formulario (en la lib). Un navegador que
//    la pide desde OTRO sitio (`Sec-Fetch-Site`) no entra: nadie gasta el crédito de Martín desde una página ajena.
// =============================================================================

import type { NextRequest } from 'next/server';
import { limitePorIp } from '@/lib/limite-publico';
import { MAXIMO_PARA_BUSCAR } from '@/lib/aplicacion-accelerator';
import { buscarCanalDeLaAplicacion } from '@/lib/aplicacion-accelerator-canal';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
/** El más lento es Google por Apify (~6-11 s, con su tope de 45 s en lib/spy-buscar.ts). */
export const maxDuration = 60;

const HORA = 3600_000;

export async function GET(req: NextRequest) {
  const sitio = req.headers.get('sec-fetch-site');
  if (sitio && sitio !== 'same-origin') return Response.json({ ok: false, error: 'Origen no permitido.' }, { status: 403 });
  const red = req.nextUrl.searchParams.get('red');
  if (red !== 'instagram' && red !== 'youtube') return Response.json({ ok: false, error: 'Falta la red.' }, { status: 400 });
  const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, MAXIMO_PARA_BUSCAR);
  // Un formulario lo pide unas pocas veces (dos campos, y lo vuelve a pedir sólo si cambia lo escrito).
  const porIp = limitePorIp(req, 'accelerator-canal:ip', 20, HORA);
  if (porIp) return Response.json({ ok: true, candidatos: [], vacio: 'limite' }, { status: 200 });
  return Response.json({ ok: true, ...(await buscarCanalDeLaAplicacion(red, q)) }, { headers: { 'Cache-Control': 'no-store' } });
}
