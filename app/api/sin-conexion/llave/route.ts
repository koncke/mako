// =============================================================================
// /api/sin-conexion/llave — la llave de MaKo sin conexión de ESTA persona en ESTA computadora (28/10/2026)
// =============================================================================
// GET ?dispositivo=<id de la computadora> → { ok: true, llave: <32 bytes en base64url> }
//
// La llave se DERIVA (lib/sin-conexion/llave-server.ts) del id de la PERSONA frente al teclado (`usuarioPropio`: ignora la
// impersonación) y del de la computadora: sólo la sesión de esa persona la recibe. Con ella la app guarda la copia cifrada sin
// pedir la clave; sin conexión, la abre la clave de esta computadora (docs/diseno-mako-desktop-sin-conexion.md, punto 3).
// Nunca se cachea. Un pedido de otro sitio no puede leer la respuesta (sin CORS) y es GET: no escribe nada.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { usuarioPropio } from '@/lib/perfil';
import { llaveDeLaComputadora } from '@/lib/sin-conexion/llave-server';
import { RE_DISPOSITIVO } from '@/lib/sin-conexion/reglas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SIN_CACHE = { 'Cache-Control': 'no-store, private' };
const json = (x: unknown, status = 200) => Response.json(x, { status, headers: SIN_CACHE });

export async function GET(req: NextRequest) {
  if (!(await getUsuarioActual())) return json({ ok: false, desconectada: false, error: 'Entra a MaKo para guardar una copia.' }, 401);
  const u = await usuarioPropio();
  if (!u) return json({ ok: false, desconectada: false, error: 'Esta sesión no es de una persona: MaKo sin conexión necesita tu cuenta.' }, 403);
  const dispositivo = req.nextUrl.searchParams.get('dispositivo') ?? '';
  if (!RE_DISPOSITIVO.test(dispositivo)) return json({ ok: false, desconectada: false, error: 'El id de esta computadora no es válido.' }, 400);
  const llave = llaveDeLaComputadora(u.id, dispositivo);
  if (!llave) return json({ ok: false, desconectada: false, error: 'MaKo sin conexión no está disponible ahora.' }, 503);
  return json({ ok: true, llave: Buffer.from(llave).toString('base64url') });
}
