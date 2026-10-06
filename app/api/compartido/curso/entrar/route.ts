// =============================================================================
// GET /api/compartido/curso/entrar?t=<token> — el link del MAIL de invitación al curso
// =============================================================================
// Verifica el token del curso (el mismo `c1.` del link de WhatsApp), deja puesta la cookie del
// alumno (`mako_alumno`, lib/alumno-sesion.ts) y lleva a /mi-curso. Desde ahí el alumno vuelve sin
// el link: la cookie dura 30 días, o entra con Google con el email al que se lo invitó.
//
// ⚠️ NO HAY UNA CREDENCIAL NUEVA: la cookie se firma para la MISMA (ws, lead, versión) del token,
// así que revocar el acceso (subir la versión) corta las dos cosas a la vez.
//
// ⚠️ EL WORKSPACE SALE DE LA FIRMA DEL TOKEN (`leerAccesoCurso(t).ws`), nunca de un parámetro, y
// lo primero adentro de `runWithWorkspace` es `resolverAcceso` — la regla de las rutas del portal
// (tests/curso-portal.test.ts).
//
// Es GET, y por eso entra por el prefijo público de lectura `/api/compartido` sin tocar
// PUBLICOS_ESCRITURA: no lee `mako_session` ni ninguna otra cookie, sólo la ESCRIBE. Que un sitio
// ajeno pueda disparar este GET no le abre nada a nadie: sin el token no hay cookie, y con el token
// ya tenía el curso. Y el token no queda en la barra: el navegador termina en /mi-curso.
//
// Un token que no abre va a la pantalla del portal con ese mismo token, que dice «Este link ya no
// está activo» sin el porqué — y si lo que falló fue la base, el portal lo vuelve a intentar y, si
// anda, el alumno ve su curso igual (sin la cookie).

import { NextResponse, type NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { leerAccesoCurso } from '@/lib/curso-acceso';
import { resolverAcceso } from '@/lib/curso-datos';
import { ponerCookieAlumno } from '@/lib/alumno-acceso';
import { RUTA_ALUMNO } from '@/lib/rutas-publicas';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ⚠️ Lleva Set-Cookie: ningún caché intermedio puede guardar esta respuesta.
const SIN_CACHE = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };

export async function GET(req: NextRequest) {
  const ir = (ruta: string) => NextResponse.redirect(new URL(ruta, req.nextUrl.origin), { status: 302, headers: SIN_CACHE });
  // Un link de mail se abre una vez; esto sólo frena a quien prueba tokens.
  if (!rateLimit(`curso-entrar:ip:${clientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ ok: false, error: 'demasiados intentos' }, { status: 429, headers: SIN_CACHE });
  }
  const token = (req.nextUrl.searchParams.get('t') || '').trim();
  const firma = leerAccesoCurso(token);
  if (!firma) return ir('/compartido/curso/inactivo');
  const alPortal = () => ir(`/compartido/curso/${encodeURIComponent(token)}`);

  return runWithWorkspace(firma.ws, async () => {
    const acceso = await resolverAcceso(token).catch((e: unknown) => {
      console.error('[curso-entrar] no pude verificar el acceso:', e instanceof Error ? e.message : e);
      return null;
    });
    if (!acceso) return alPortal();
    const res = ir(RUTA_ALUMNO);
    // Sin secreto para firmar la cookie, el link igual le abre el curso: va al portal.
    return ponerCookieAlumno(res, acceso) ? res : alPortal();
  });
}
