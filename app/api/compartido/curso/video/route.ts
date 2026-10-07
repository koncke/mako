// =============================================================================
// GET /api/compartido/curso/video?t=<token>&c=<claseId>
// =============================================================================
// El video SUBIDO de una clase, para el `<video>` del portal del alumno (SIN sesión). Valida el
// link en CADA pedido y redirige (302) a una URL firmada de Storage de vida corta: el bucket
// `curso-videos` es privado y su ruta nunca viaja al navegador.
//
// Por qué redirigir y no pasar el video por la función (como sí hace /api/compartido/archivo
// con las miniaturas): un video son cientos de MB pedidos por rangos, y una función de Vercel
// no es un CDN. El precio está escrito en `VIDA_URL_VIDEO` (lib/curso-portal.ts): la URL firmada
// sobrevive a revocar el acceso por ese rato.
//
// ⚠️ EL WORKSPACE SALE DE LA FIRMA DEL TOKEN (`leerTokenPortal(t).ws`), nunca de un parámetro, y
// todo corre adentro de `runWithWorkspace`. Y la ruta del archivo tiene que ser de ESE workspace
// y de ESE producto: el bucket es uno para todos y la ruta sale de una fila. La regla es la MISMA
// que usa el editor de la tab Curso al guardar (`pathEsDelProducto`, sobre la forma
// `<ws>/<producto>/<uuid>.<ext>` que arma `pathDeSubida`): una regla, no dos que divergen.
//
// ⚠️ LA ETAPA TIENE QUE ESTAR ABIERTA: el video de una etapa bloqueada no se sirve. Todo rechazo
// es un 404 genérico (también el de etapa bloqueada: un `<video>` no lee el cuerpo del error).
//
// Es GET: entra por el prefijo público de lectura `/api/compartido` y no necesita estar en
// PUBLICOS_ESCRITURA.
//
// ⚠️ EL TOKEN PUEDE SER EL DEL LÍDER DE UN ÁREA (#665, `c2.`): sólo le sirve el video de una clase
// POR ÁREA (`claseDelAlumno` con `lider`), con la misma etapa abierta que el cliente.

import { NextResponse, type NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { leerTokenPortal } from '@/lib/curso-acceso';
import { resolverAccesoPortal } from '@/lib/curso-datos';
import { getSupabaseServer } from '@/lib/supabase';
import { BUCKET_CURSO } from '@/lib/curso-admin';
import { pathEsDelProducto } from '@/app/customer-success/curso/reglas';
import { claseDelAlumno, idDeClase, VIDA_URL_VIDEO } from '@/lib/curso-portal';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO = () => NextResponse.json({ ok: false }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET(req: NextRequest) {
  // Un `<video>` vuelve a pedir esta URL al recargar o cuando vence la firmada; no es ráfaga.
  if (!rateLimit(`curso-video:ip:${clientIp(req)}`, 120, 60_000)) {
    return NextResponse.json({ ok: false }, { status: 429, headers: { 'Cache-Control': 'private, no-store' } });
  }
  const token = req.nextUrl.searchParams.get('t') || '';
  const claseId = idDeClase(req.nextUrl.searchParams.get('c'));
  if (!claseId) return NO();

  const firma = leerTokenPortal(token);
  if (!firma) return NO();

  return runWithWorkspace(firma.ws, async () => {
    const acceso = await resolverAccesoPortal(token);
    if (!acceso) return NO();
    try {
      const r = await claseDelAlumno(acceso.leadId, claseId, { exigeEtapa: true, lider: acceso.area });
      if (r.decision !== 'ok') return NO();
      if (r.clase.videoTipo !== 'archivo' || !pathEsDelProducto(r.clase.videoPath, acceso.ws, r.clase.productoId)) return NO();
      const { data } = await getSupabaseServer().storage.from(BUCKET_CURSO).createSignedUrl(r.clase.videoPath!, VIDA_URL_VIDEO);
      if (!data?.signedUrl) return NO();
      return NextResponse.redirect(data.signedUrl, {
        status: 302,
        headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
      });
    } catch (e) {
      console.error('[curso-portal] no pude servir el video:', e instanceof Error ? e.message : e);
      return NO();
    }
  });
}
