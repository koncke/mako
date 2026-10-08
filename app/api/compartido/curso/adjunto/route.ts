// =============================================================================
// GET /api/compartido/curso/adjunto?t=<token>&c=<claseId>&a=<adjuntoId>
// =============================================================================
// Un adjunto (imagen, PDF, archivo) de la DESCRIPCIÓN de una clase, para el portal del alumno (SIN
// sesión). Es lo que `<HtmlSeguro>` pone en el `src` de una imagen y en el `href` del chip de un
// archivo (`urlAdjuntoDelAlumno`, lib/curso-adjuntos-reglas.ts). Valida el link en CADA pedido y
// redirige (302) a una URL firmada de vida corta: el bucket `curso-adjuntos` es privado y su ruta
// nunca viaja al navegador.
//
// Es el molde de /api/compartido/curso/video, con las mismas reglas y por los mismos motivos:
//
// ⚠️ EL WORKSPACE SALE DE LA FIRMA DEL TOKEN (`leerTokenPortal(t).ws`), nunca de un parámetro, y
//    todo corre adentro de `runWithWorkspace`.
//
// ⚠️ LA ÚNICA PUERTA ES `claseDelAlumno` (lib/curso-portal.ts) CON `exigeAbierta: true`: el adjunto
//    de una clase cerrada (su candado o el de su módulo) no se sirve, igual que su video. No se copia la regla: se
//    llama a la función. Y con el token de un LÍDER de área (`c2.`), sólo abre clases por área.
//
// ⚠️ Y DESPUÉS, QUE LA CLASE LO PUBLIQUE (`urlAdjuntoParaAlumno` → `decidirAdjuntoAlumno`): el
//    adjunto tiene que ser de este negocio, de ese producto, y estar nombrado en la descripción
//    actual de ESA clase. Un id de otro producto, de otra clase que no lo nombra, o uno que ya se
//    sacó de la descripción, contesta lo mismo que uno que no existe.
//
// ⚠️ TODO RECHAZO ES EL MISMO 404, sin cuerpo que distinga: un `<img>` no lee el error, y contestar
//    distinto («existe, pero está bloqueado») ayudaría a enumerar ids.
//
// Es GET: entra por el prefijo público de lectura `/api/compartido` (lib/rutas-publicas.ts,
// `PUBLICOS_SOLO_LECTURA`) y no necesita estar en PUBLICOS_ESCRITURA.

import { NextResponse, type NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { leerTokenPortal } from '@/lib/curso-acceso';
import { resolverAccesoPortal } from '@/lib/curso-datos';
import { claseDelAlumno, idDeClase } from '@/lib/curso-portal';
import { urlAdjuntoParaAlumno } from '@/lib/curso-adjuntos';
import { refDeId } from '@/lib/curso-adjuntos-reglas';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO = () => NextResponse.json({ ok: false }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET(req: NextRequest) {
  // Una descripción con diez imágenes son diez pedidos al abrir la clase: el tope es por eso más
  // alto que el del video, y sigue cortando una ráfaga de enumeración.
  if (!rateLimit(`curso-adjunto:ip:${clientIp(req)}`, 240, 60_000)) {
    return NextResponse.json({ ok: false }, { status: 429, headers: { 'Cache-Control': 'private, no-store' } });
  }
  const token = req.nextUrl.searchParams.get('t') || '';
  const claseId = idDeClase(req.nextUrl.searchParams.get('c'));
  const adjuntoId = req.nextUrl.searchParams.get('a') || '';
  if (!claseId || !refDeId(adjuntoId)) return NO();

  const firma = leerTokenPortal(token);
  if (!firma) return NO();

  return runWithWorkspace(firma.ws, async () => {
    const acceso = await resolverAccesoPortal(token);
    if (!acceso) return NO();
    try {
      const r = await claseDelAlumno(acceso.leadId, claseId, { exigeAbierta: true, lider: acceso.area, alcance: acceso.alcance });
      if (r.decision !== 'ok') return NO();
      const url = await urlAdjuntoParaAlumno({ id: r.clase.id, productoId: r.clase.productoId }, adjuntoId);
      if (!url) return NO();
      return NextResponse.redirect(url, {
        status: 302,
        headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
      });
    } catch (e) {
      console.error('[curso-portal] no pude servir el adjunto:', e instanceof Error ? e.message : e);
      return NO();
    }
  });
}
