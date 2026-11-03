// =============================================================================
// /api/crm/instagram-foto — la foto de un perfil de Instagram, servida desde nuestro dominio (3/11/2026)
// =============================================================================
// GET ?url=<foto del CDN de Meta> → la imagen.
//
// ⚠️ POR QUÉ EXISTE: el CDN de Instagram no deja que otra página use sus imágenes. El navegador las descarta
// en silencio (`net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`) y el buscador dibujaba iniciales, así que la foto
// nunca se vio (medido en producción el 3/11/2026; `fotoPorNosotros`, lib/foto-instagram-reglas.ts). Desde el
// servidor no hay esa regla: es lo mismo que ya hace `guardarFotoDeInstagram` al crear un lead.
//
// ⚠️ NO BAJA CUALQUIER COSA: la URL llega del navegador, así que sólo se acepta si es de un CDN de Meta por
// https (`esFotoDeInstagram`), también después de una redirección. Sin esa guarda esto sería un proxy abierto
// con la IP de MaKo. Y sólo con sesión: la ruta NO va en `lib/rutas-publicas.ts`.
//
// No se guarda nada: la URL vence, y lo que queda es la caché del navegador de quien la miró.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { esFotoDeInstagram, esImagenServible } from '@/lib/foto-instagram-reglas';

export const dynamic = 'force-dynamic';

/** Una foto de perfil pesa decenas de KB; 2 MB es un tope de cordura, el mismo de `guardarFotoDeInstagram`. */
const TOPE_BYTES = 2 * 1024 * 1024;

export async function GET(req: NextRequest) {
  if (!(await getUsuarioActual())) return new Response(null, { status: 401 });
  const url = req.nextUrl.searchParams.get('url');
  if (!esFotoDeInstagram(url)) return new Response(null, { status: 400 });
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
    // Después de una redirección, el host final también tiene que ser de Meta.
    if (!r.ok || (r.url && !esFotoDeInstagram(r.url))) return new Response(null, { status: 404 });
    const tipo = r.headers.get('content-type') ?? '';
    if (!esImagenServible(tipo)) return new Response(null, { status: 404 });
    const buf = await r.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > TOPE_BYTES) return new Response(null, { status: 404 });
    return new Response(buf, {
      headers: { 'Content-Type': tipo, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    // Se vence, o Meta no contesta: la pantalla dibuja las iniciales por su `onError`.
    return new Response(null, { status: 404 });
  }
}
