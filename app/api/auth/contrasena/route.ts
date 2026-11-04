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

import { NextResponse, after, type NextRequest } from 'next/server';
import { limitePorIp } from '@/lib/limite-publico';
import { DISPOSITIVO_COOKIE, crearPreauth, destinoSeguro } from '@/lib/auth-session';
import { ponerPreauth, ponerSesion } from '@/lib/sesion-cookies';
import { decidirTrasGoogle, requiereSegundoFactor } from '@/lib/mfa-reglas';
import { CUENTA_DE_REVISION, DIAS_SESION_REVISION, WS_REVISION, esCorreoDeRevision, esCuentaDeRevision } from '@/lib/cuenta-revision-reglas';
import { revisarNegocioDeRevision } from '@/lib/cuenta-revision';
import { rateLimit } from '@/lib/rate-limit';
import { correoNormalizado } from '@/lib/contrasena-reglas';
import { avisarDePlataforma } from '@/lib/invitaciones';
import { EMAIL_MAKO } from '@/lib/app-url';
import { obligatorioDesdeDe } from '@/lib/mfa-obligatorio';
import { anotarEntradaDeRevision, dispositivoValido, mfaActivoReal, registrarEvento } from '@/lib/mfa';
import { registrarLogin } from '@/lib/usuarios';
import { comprobarContrasena } from '@/lib/contrasena';

export const dynamic = 'force-dynamic';

const no = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

/** La IP de quien pide, para los avisos de la cuenta de revisión (la primera de x-forwarded-for, que en Vercel es la del cliente). */
const ipDe = (req: NextRequest): string => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'una IP desconocida';

/** Un aviso a equipo@ sobre la cuenta de revisión. No tira: si no sale, lo que pasó igual quedó en `mfa_eventos` o en el log. */
async function avisarDeRevision(asunto: string, cuerpo: string): Promise<void> {
  await avisarDePlataforma({ to: EMAIL_MAKO, asunto, preheader: cuerpo.slice(0, 90), tag: 'login-revision-tienda', cuerpo }).catch(() => {});
}

function origenValido(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try { return new URL(origin).host === req.headers.get('host'); } catch { return false; }
}

export async function POST(req: NextRequest) {
  if (!origenValido(req)) return no('origen no permitido', 403);
  // El freno de intentos es POR CUENTA (lib/contrasena.ts); esto corta probar muchas cuentas desde una IP.
  const frenado = limitePorIp(req, 'login-contrasena', 20, 10 * 60_000);
  if (frenado) return frenado;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const next = destinoSeguro(typeof body.next === 'string' ? body.next : '/inicio');

  const r = await comprobarContrasena(body.email, body.contrasena);
  if (!r.ok) {
    // Un intento fallido con el correo de la cuenta de revisión también avisa (4/11/2026): esa contraseña la tienen terceros, y alguien
    // probando es lo primero que hay que saber. Con tope, para que una ráfaga no llene la casilla. La respuesta es la misma de siempre, y
    // el aviso sale DESPUÉS de contestar (`after`): esperarlo acá haría tardar más a ese correo, y eso contaría que existe.
    if (correoNormalizado(body.email) === CUENTA_DE_REVISION.email && rateLimit('aviso-revision-fallido', 6, 60 * 60_000)) {
      const ip = ipDe(req);
      after(() => avisarDeRevision('Intento fallido en la cuenta de revisión de las tiendas', `Alguien probó una contraseña que no es (${r.status === 429 ? 'ya frenado: demasiados intentos' : 'no coincide'}) desde ${ip}. Si no es un revisor, rota la contraseña con scripts/tiendas-cuenta-revision.mts --rotar.`));
    }
    return no(r.error, r.status);
  }
  const usuario = r.usuario;
  const sub = String(usuario.id);
  const nombre = usuario.nombre ?? '';

  // ── La cuenta de revisión de las tiendas: la ÚNICA sin segundo factor (lib/cuenta-revision-reglas.ts) ───
  // Sólo con contraseña (el callback de Google la rechaza), con el freno de intentos de siempre, y con su negocio LIMPIO: sin líneas de
  // WhatsApp, sin credenciales y sin cartera de agencia (si no, 503: un tercero no entra a un negocio con algo de verdad adentro). Y con
  // su rastro antes de dar la sesión: sin rastro, no entra.
  if (esCuentaDeRevision(usuario)) {
    const negocio = await revisarNegocioDeRevision();
    if (!negocio.limpio) {
      console.error(`[auth] cuenta de revisión: su negocio no está limpio (${negocio.falta.join(' · ')})`);
      await avisarDeRevision('La cuenta de revisión no pudo entrar', `Su negocio no está limpio: ${negocio.falta.join(' · ')}. Intento desde ${ipDe(req)}.`);
      return no('No se pudo entrar.', 503);
    }
    if (!(await anotarEntradaDeRevision(usuario.id, `ip ${ipDe(req)}`))) return no('No se pudo entrar.', 503);
    await registrarLogin(usuario.email, { nombre: usuario.nombre, foto_url: usuario.foto_url ?? undefined });
    const res = NextResponse.json({ ok: true, ir: next });
    if (!ponerSesion(res, { sub, email: usuario.email, nombre, rol: usuario.rol, mfa: 'revision' }, DIAS_SESION_REVISION)) return no('El login no está configurado.', 500);
    // Que alguien se entere, con desde dónde: un rastro que nadie lee no avisa de una contraseña filtrada. Si no sale, la entrada sigue: quedó anotada arriba.
    await avisarDeRevision('Entró la cuenta de revisión de las tiendas', `Entró desde ${ipDe(req)}. Si no hay una revisión en curso, rota la contraseña con scripts/tiendas-cuenta-revision.mts --rotar.`);
    return res;
  }
  // Y si la fila con ese correo, o una de su negocio, dejó de cumplir la regla ENTERA (alguien le cambió el `rol_ws`, el rol o el
  // negocio), no entra por el camino de todos (4/11/2026, la segunda revisión): sin la marca el proxy no la corta, y sin segundo factor
  // entraría como un closer común, con una contraseña que tienen terceros.
  if (esCorreoDeRevision(usuario.email) || usuario.workspace_id === WS_REVISION) {
    console.error(`[auth] cuenta de revisión: la fila ${usuario.id} ya no es la cuenta de revisión; no entra`);
    await avisarDeRevision('La cuenta de revisión no pudo entrar', `Su fila cambió (rol, negocio o rol en el negocio) y ya no es la cuenta de revisión. Intento desde ${ipDe(req)}. Revisa quién la tocó.`);
    return no('No se pudo entrar.', 403);
  }

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
