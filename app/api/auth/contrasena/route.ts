// =============================================================================
// POST /api/auth/contrasena — entrar con correo y contraseña (15/10/2026)
// =============================================================================
// Decisión de Martín: la contraseña es un camino de entrada ALTERNATIVO a Google (para el día que
// Google no esté), obligatoria para todos desde el 21/10. Diseño: docs/diseno-login-contrasena.md.
//
// ⚠️ ES EL MISMO PRIMER FACTOR QUE GOOGLE, NO UNO MÁS DÉBIL. Después de comprobar la contraseña, la
// decisión es la MISMA que toma el callback de Google (`decidirTrasGoogle`): segundo paso si hace
// falta (con el mismo paso intermedio y la misma pantalla /login/2fa), el dispositivo recordado, o
// bloquear. Una contraseña nunca se saltea el 2FA.
//
// Vive bajo /api/auth (público en el proxy: se autentica sola), así que el Origin lo chequea ELLA, como
// la ruta del segundo paso: un formulario de otro sitio no puede loguear a nadie en MaKo.
// Contesta lo mismo si el correo no existe, no tiene contraseña o no coincide, y tarda lo mismo.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { DISPOSITIVO_COOKIE, crearPreauth, destinoSeguro } from '@/lib/auth-session';
import { ponerPreauth, ponerSesion } from '@/lib/sesion-cookies';
import { decidirTrasGoogle, requiereSegundoFactor } from '@/lib/mfa-reglas';
import { obligatorioDesdeDe } from '@/lib/mfa-obligatorio';
import { dispositivoValido, mfaActivoReal, registrarEvento } from '@/lib/mfa';
import { registrarLogin } from '@/lib/usuarios';
import { comprobarContrasena } from '@/lib/contrasena';

export const dynamic = 'force-dynamic';

const no = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

function origenValido(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try { return new URL(origin).host === req.headers.get('host'); } catch { return false; }
}

export async function POST(req: NextRequest) {
  if (!origenValido(req)) return no('origen no permitido', 403);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const next = destinoSeguro(typeof body.next === 'string' ? body.next : '/inicio');

  const r = await comprobarContrasena(body.email, body.contrasena);
  if (!r.ok) return no(r.error, r.status);
  const usuario = r.usuario;
  const sub = String(usuario.id);
  const nombre = usuario.nombre ?? '';

  // ── La MISMA decisión que el callback de Google ───────────────────────────
  const mfaActivo = await mfaActivoReal(usuario.id, !!usuario.mfa_activo);
  const obligatorioDesde = await obligatorioDesdeDe(usuario.workspace_id);
  const requiere = requiereSegundoFactor(usuario.rol, mfaActivo, obligatorioDesde);
  let dispositivo = false;
  if (requiere) {
    try { dispositivo = await dispositivoValido(usuario.id, req.cookies.get(DISPOSITIVO_COOKIE)?.value); }
    catch { dispositivo = false; }
  }
  const decision = decidirTrasGoogle({ rol: usuario.rol, mfaActivo, tieneFila: true, dispositivoValido: dispositivo, obligatorioDesde });
  if (decision === 'bloquear') return no('No se pudo entrar.', 403);

  if (decision === 'segundo-factor') {
    const pre = crearPreauth({ sub, email: usuario.email, nombre, rol: usuario.rol, next, foto: usuario.foto_url ?? undefined });
    if (!pre) return no('El login no está configurado.', 500);
    const res = NextResponse.json({ ok: true, ir: '/login/2fa' });
    ponerPreauth(res, pre);
    await registrarEvento(usuario.id, 'contrasena-ok', true, 'al segundo paso');
    return res;
  }

  // Entra directo: no necesita segundo factor, o el dispositivo es de confianza. (No hace falta
  // pedirle crear la contraseña: acaba de entrar con ella.)
  await registrarLogin(usuario.email, { nombre: usuario.nombre, foto_url: usuario.foto_url ?? undefined });
  const res = NextResponse.json({ ok: true, ir: next });
  if (!ponerSesion(res, { sub, email: usuario.email, nombre, rol: usuario.rol, mfa: requiere ? 'dispositivo' : undefined })) {
    return no('El login no está configurado.', 500);
  }
  await registrarEvento(usuario.id, 'login-contrasena', true);
  return res;
}
