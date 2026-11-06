// =============================================================================
// /api/perfil/correos-tickets — la casilla de «los correos de mis tickets» (6/11/2026)
// =============================================================================
// Hasta hoy, apagar estos correos sólo se podía desde el link del pie del correo: para apagarlos había que tener un
// correo a mano, y el mismo link es el que los vuelve a prender. Esto es la casilla de Notificaciones
// (app/perfil/NotificacionesPanel.tsx).
//
// ⚠️ RESUELVE A LA PERSONA POR EL EMAIL DE LA SESIÓN, y no con `filaPropia` (lib/perfil.ts) como las otras preferencias
// de esta pantalla. No es un capricho: `filaPropia` hace `.maybeSingle()` sobre `eq('email', …)`, y eso tira PGRST116 en
// cuanto hay DOS filas de `usuarios` con la misma dirección — que es exactamente la gente para la que esta casilla
// existe (quien tiene cuenta en su negocio y en el de un cliente de su agencia; `usuarios(email)` no es único, 0053).
// Con `filaPropia` esta ruta contestaría «no hay fila» justo a quien la necesita.
//
// Y por eso la baja es de la DIRECCIÓN: lo que se apaga son los correos a esa casilla, no los de una cuenta. La regla y
// las dos capas están en lib/tickets-baja-correo.ts.

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { apagadosPorEmail, cambiarBajaPorEmail } from '@/lib/tickets-baja-correo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** La dirección de quien está frente al teclado. '' = sesión sin cuenta propia (contraseña maestra, dev-login). */
async function emailDeLaSesion(): Promise<string> {
  const s = await getUsuarioActual();
  return String(s?.email ?? '').trim().toLowerCase();
}

export async function GET() {
  const email = await emailDeLaSesion();
  // Sin cuenta propia no hay a quién escribirle: la pantalla lo dice con `guardado: false`, no con un error.
  if (!email) return Response.json({ ok: true, recibir: true, guardado: false });
  const apagados = await apagadosPorEmail(email);
  if (apagados === null) return Response.json({ ok: false, error: 'No pude leer tus correos' }, { status: 503 });
  return Response.json({ ok: true, recibir: !apagados, guardado: true });
}

export async function POST(req: NextRequest) {
  let body: { recibir?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: 'json inválido' }, { status: 400 });
  }
  if (typeof body.recibir !== 'boolean') return Response.json({ ok: false, error: 'falta recibir' }, { status: 400 });
  const email = await emailDeLaSesion();
  if (!email) return Response.json({ ok: true, recibir: body.recibir, guardado: false });
  const ok = await cambiarBajaPorEmail(email, body.recibir, 'notificaciones');
  if (!ok) return Response.json({ ok: false, error: 'No pude guardarlo' }, { status: 503 });
  return Response.json({ ok: true, recibir: body.recibir, guardado: true });
}
