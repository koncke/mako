// =============================================================================
// GET /api/compartido/miniatura?vimeo=<id>[&h=<hash>]
// =============================================================================
// ⚠️ NO VA EN app/api/compartido/curso/: ésas son las rutas del PORTAL, todas con el token del alumno y
//    su resolver primero (tests/curso-portal.test.ts las enumera en positivo). Ésta no lee nada de nadie.
//
// La MINIATURA de un video de Vimeo, para la tarjeta de una clase (`tapaDeVideo`, lib/curso.ts). Item 20
// del pedido de Martín (08/10/2026): «En la miniatura de la clase, falta una opción para sacar la
// miniatura del vídeo. Que por defecto esté esa siempre que haya vídeo».
//
// ⚠️ POR QUÉ UNA RUTA Y NO UNA URL ARMADA: YouTube, Drive y Loom publican su miniatura en una dirección
//    que sale del id del video; Vimeo no (`i.vimeocdn.com/video/<otro id>-<hash>`), y lo único que la
//    dice es su oEmbed (medido el 08/10/2026: `thumbnail_url`, con el hash de un video NO LISTADO adentro
//    de la url que se le pregunta). Esta ruta le pregunta en el SERVER y redirige (302) a la imagen.
//    Preguntarle desde el navegador del alumno sería que cada tarjeta del índice le hable a Vimeo.
//
// ⚠️ NO ES UN REDIRECT ABIERTO: el pedido trae sólo un número (y el hash hexadecimal de un no listado),
//    la url que se le pregunta a Vimeo la arma el código, y la respuesta se sigue SÓLO si su origen es el
//    CDN de Vimeo (`esMiniaturaDeVimeo`, comparando `origin`: AGENTS.md, «un guard de ORIGEN»). Todo lo
//    demás es un 404, que la tarjeta lee como «sin tapa» (`Miniatura` se esconde).
//
// ⚠️ EN CACHÉ: la respuesta de Vimeo se guarda un día (el `fetch` de Next) y el redirect también (el
//    navegador y la CDN). Una miniatura no cambia, y sin caché cada carga del índice saldría a la red.
//
// Es GET: entra por el prefijo público de lectura `/api/compartido`. No lee nada de nadie: un video
// público de Vimeo tiene su miniatura pública.

import type { NextRequest } from 'next/server';
import { esMiniaturaDeVimeo, vimeoDeMiniatura } from '@/lib/curso';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const NO = () => new Response(null, { status: 404, headers: { 'Cache-Control': 'public, max-age=300' } });

export async function GET(req: NextRequest) {
  if (!rateLimit(`curso-miniatura:ip:${clientIp(req)}`, 240, 60_000)) return new Response(null, { status: 429 });
  const q = req.nextUrl.searchParams;
  const v = vimeoDeMiniatura(q.get('vimeo'), q.get('h'));
  if (!v) return NO();
  const pagina = `https://vimeo.com/${v.id}${v.hash ? `/${v.hash}` : ''}`;
  try {
    const r = await fetch(`https://vimeo.com/api/oembed.json?width=800&url=${encodeURIComponent(pagina)}`, {
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!r.ok) return NO();
    const j = (await r.json().catch(() => null)) as { thumbnail_url?: unknown } | null;
    const url = esMiniaturaDeVimeo(j?.thumbnail_url);
    if (!url) return NO();
    return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } });
  } catch {
    return NO();
  }
}
