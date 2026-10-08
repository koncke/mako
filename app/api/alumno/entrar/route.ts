// =============================================================================
// POST /api/alumno/entrar — entrar con el link del mail (el botón de /login)
// =============================================================================
// El link que llega pidiéndolo con el email (POST /api/alumno/link) lleva a /login?entrar=<token>,
// que muestra «Entrar a tu programa»: un formulario que hace POST acá con el token. Acá se GASTA
// (un solo uso, lib/alumno-acceso.ts → `entrarConLinkDeEmail`), se pone la cookie del alumno
// (`mako_alumno`, la MISMA que deja /api/compartido/curso/entrar) y se va a /mi-curso.
//
// ⚠️ POR QUÉ UN POST Y NO EL GET DEL LINK: un link de un solo uso que se gasta con un GET lo gasta
// el escáner del correo que abre los links antes que la persona. Con el botón, abrir el link no
// gasta nada; apretarlo, sí.
//
// ⚠️ NUNCA UNA FILA EN `usuarios` NI `mako_session` (medido: con una fila el alumno leía el CRM del
// dueño — lib/alumno-sesion.ts). Sólo la cookie del alumno, que el proxy no toma por sesión.
//
// ⚠️ ESTÁ EN `PUBLICOS` (lib/rutas-publicas.ts), ruta exacta: se autentica con el token firmado del
// CUERPO, que el navegador no manda solo, y no lee ninguna cookie (sólo escribe la del alumno). Un
// sitio ajeno que dispare este POST necesita un token válido de OTRO alumno, y con eso sólo le
// dejaría a la víctima la cookie de ese otro (el login-CSRF de cualquier link mágico, ya anotado en
// docs/hallazgos-customer-success.md para el link del curso).
//
// Las salidas, todas a /login con UNA palabra (sin el porqué: distinguir «vencido» de «usado» de
// «cortado» ayudaría a probar tokens): `vencido` (no abre), `intentos` (rate limit), `fallo` (base).

import { NextResponse, type NextRequest } from 'next/server';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { entrarConLinkDeEmail, ponerCookieAlumno } from '@/lib/alumno-acceso';
import { RUTA_ALUMNO } from '@/lib/rutas-publicas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ⚠️ Lleva Set-Cookie: ningún caché intermedio puede guardar esta respuesta.
const SIN_CACHE = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const TOPE_CUERPO = 2_000;

export async function POST(req: NextRequest) {
  // 303: después de un POST, el navegador sigue con un GET (un 307 repetiría el POST en /mi-curso,
  // que lo corta con 403).
  const ir = (ruta: string) => NextResponse.redirect(new URL(ruta, req.nextUrl.origin), { status: 303, headers: SIN_CACHE });
  if (!rateLimit(`alumno-entrar:ip:${clientIp(req)}`, 20, 60_000)) return ir('/login?alumno=intentos');

  let token = '';
  try {
    const crudo = await req.text();
    if (crudo.length <= TOPE_CUERPO) token = (new URLSearchParams(crudo).get('t') ?? '').trim();
  } catch { /* sin cuerpo legible no hay token: «vencido» */ }

  try {
    const acceso = await entrarConLinkDeEmail(token);
    if (!acceso) return ir('/login?alumno=vencido');
    const res = ir(RUTA_ALUMNO);
    // Sin secreto para firmar la cookie no hay cómo dejarlo adentro (y sin secreto el token tampoco
    // habría verificado): se dice lo mismo que un link que no abre.
    return ponerCookieAlumno(res, acceso) ? res : ir('/login?alumno=vencido');
  } catch (e) {
    console.error('[alumno-entrar] no pude verificar el link:', e instanceof Error ? e.message : e);
    return ir('/login?alumno=fallo');
  }
}
