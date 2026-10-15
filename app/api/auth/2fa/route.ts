// =============================================================================
// /api/auth/2fa — el SEGUNDO PASO del login (y el primer factor del super admin)
// =============================================================================
// Lo usa /login/2fa. Se autentica SOLO con el paso intermedio (`mako_preauth`, que deja
// el callback de Google): no lee la cookie de sesión para nada. Y como `/api/auth` es
// público por prefijo en `lib/rutas-publicas.ts`, el proxy se saltea su chequeo de
// Origin — por eso esta ruta lo hace ella misma, y más estricto: un POST sin Origin no
// pasa. Un CSRF acá sería que otra página le haga verificar un código a tu navegador.
//
// Acciones (POST { accion }):
//   enviar · verificar · passkey-opciones · passkey-verificar  → para ENTRAR
//   enrolar-*                                                    → sólo si NO tiene
//     ningún factor: es el arranque del super admin, que no puede entrar sin uno. Con
//     uno ya cargado, sumar otro exige la sesión completa (/api/perfil/seguridad).
//
// Al salir bien, emite la sesión completa con `mfa` = cómo se probó, y cierra el paso
// intermedio en el mismo movimiento (lib/sesion-cookies.ts).

import { NextResponse, type NextRequest } from 'next/server';
import { requiereCrearContrasena } from '@/lib/contrasena-reglas';
import { tieneContrasena, guardarContrasena } from '@/lib/contrasena';
import { obligatorioDesdeDe } from '@/lib/mfa-obligatorio';
import { PREAUTH_COOKIE, verificarPreauth, crearPreauth, type Preauth } from '@/lib/auth-session';
import { ponerSesion, ponerDispositivo, ponerPreauth } from '@/lib/sesion-cookies';
import { buscarUsuarioPorEmail, registrarLogin } from '@/lib/usuarios';
import { puedeEnrolarSinSesion, canalDisponible, esTelefono, CANALES_CODIGO, CANAL_NO_DISPONIBLE, type Amr } from '@/lib/mfa-reglas';
import {
  estadoMfa, cantidadFactores, intentar, intentoOk, MENSAJE_FRENADO, registrarEvento,
  enviarCodigo, verificarCodigo, verificarTotpLogin, usarCodigoRecuperacion,
  iniciarTotp, confirmarTotp, opcionesLoginPasskey, verificarLoginPasskey,
  generarCodigosRecuperacion,
  crearDispositivo, rpDelPedido, type Canal,
} from '@/lib/mfa';

export const dynamic = 'force-dynamic';

const no = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

/** El Origin tiene que estar y ser este mismo host. */
function origenValido(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try { return new URL(origin).host === req.headers.get('host'); } catch { return false; }
}

/** El paso intermedio, y el usuario de verdad detrás (vigente y no suspendido). */
async function quien(req: NextRequest): Promise<{ pre: Preauth; id: number; rol: 'admin' | 'usuario'; ws: number | null } | null> {
  const pre = verificarPreauth(req.cookies.get(PREAUTH_COOKIE)?.value);
  if (!pre) return null;
  const id = Number(pre.sub);
  if (!Number.isInteger(id) || id <= 0) return null;
  const u = await buscarUsuarioPorEmail(pre.email);
  if (!u || u.id !== id || u.estado === 'suspendido') return null;
  return { pre, id, rol: u.rol, ws: u.workspace_id ?? null };
}

/** Un nombre corto del dispositivo, para la lista de «recordados». */
function nombreDispositivo(req: NextRequest): string {
  const ua = req.headers.get('user-agent') ?? '';
  const so = /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Mac OS/.test(ua) ? 'Mac'
    : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Dispositivo';
  const nav = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari' : '';
  return nav ? `${nav} en ${so}` : so;
}

/** Entra: sesión completa, registro del login y, si se pidió, el dispositivo recordado. */
async function entrar(
  req: NextRequest, q: { pre: Preauth; id: number; rol: 'admin' | 'usuario'; ws: number | null }, mfa: Amr,
  extra: { recordar?: boolean; codigos?: string[]; saltarContrasena?: boolean } = {},
): Promise<NextResponse> {
  // La contraseña obligatoria (decisión de Martín, 15/10/2026: el 21/10, junto con el 2FA). Si ya
  // tocaba y no la tiene, la sesión NO se abre todavía: el paso intermedio sigue, ahora con el factor
  // marcado como pasado, y la pantalla que queda es «Crea tu contraseña». Primero el factor, después
  // la contraseña, una pantalla cada una.
  if (!extra.saltarContrasena && requiereCrearContrasena(await tieneContrasena(q.id), await obligatorioDesdeDe(q.ws))) {
    const pre = crearPreauth({ sub: String(q.id), email: q.pre.email, nombre: q.pre.nombre, rol: q.rol, next: q.pre.next, foto: q.pre.foto, mfa, recordar: !!extra.recordar });
    if (!pre) return no('No se pudo seguir.', 500);
    const res = NextResponse.json({ ok: true, falta: 'contrasena', next: q.pre.next, ...(extra.codigos ? { codigos: extra.codigos } : {}) });
    ponerPreauth(res, pre);
    await registrarEvento(q.id, `factor-${mfa}`, true, 'falta crear la contraseña');
    return res;
  }
  const res = NextResponse.json({ ok: true, next: q.pre.next, ...(extra.codigos ? { codigos: extra.codigos } : {}) });
  if (!ponerSesion(res, { sub: String(q.id), email: q.pre.email, nombre: q.pre.nombre, rol: q.rol, mfa })) {
    return no('No se pudo abrir la sesión.', 500);
  }
  if (extra.recordar) {
    try { ponerDispositivo(res, await crearDispositivo(q.id, nombreDispositivo(req))); }
    catch { /* no recordarlo no puede tumbar un login que salió bien */ }
  }
  await registrarLogin(q.pre.email, { nombre: q.pre.nombre, foto_url: q.pre.foto });
  await registrarEvento(q.id, `login-${mfa}`, true);
  return res;
}

export async function GET(req: NextRequest) {
  const q = await quien(req);
  if (!q) return no('vencido', 401);
  const e = await estadoMfa(q.id);
  return NextResponse.json({
    ok: true,
    factores: { totp: e.totp, passkey: e.passkeys.length > 0, whatsapp: e.whatsapp, email: e.email, recuperacion: e.codigosRestantes > 0 },
    hayQueEnrolar: puedeEnrolarSinSesion(cantidadFactores(e)),
    // La llave de acceso, sólo en el teléfono (decisión de Martín del 14/10/2026: es el atajo del
    // celu, no un método para la compu). `esTelefono` le dice a la pantalla si ofrecerla después.
    passkeysDisponibles: !!rpDelPedido(req.headers.get('host')) && esTelefono(req.headers.get('user-agent')),
    esTelefono: esTelefono(req.headers.get('user-agent')),
    // Por dónde puede salir un código HOY (vacío en la tanda 1): la pantalla no ofrece otro.
    canales: CANALES_CODIGO,
    // El factor ya pasó y falta crear la contraseña obligatoria (recargar la página cae acá).
    falta: q.pre.mfa ? 'contrasena' : null,
  });
}

export async function POST(req: NextRequest) {
  if (!origenValido(req)) return no('origen no permitido', 403);
  const q = await quien(req);
  if (!q) return no('vencido', 401);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const accion = String(body.accion ?? '');
  const recordar = body.recordar === true;
  // Entrar con la llave, sólo desde el teléfono (regla de producto: ver `esTelefono`).
  const rp = esTelefono(req.headers.get('user-agent')) ? rpDelPedido(req.headers.get('host')) : null;

  // ⚠️ El freno NO va acá arriba para todo: frena cada intento de ADIVINAR un código
  // (`intentar`, que anota antes de contar). Puesto para todas las acciones, quien tiene la
  // cuenta de Google le bloqueaba al dueño también su llave de acceso mandando códigos malos.

  // ── Crear la contraseña obligatoria, con el factor ya pasado ──────────────
  if (accion === 'crear-contrasena') {
    if (!q.pre.mfa) return no('Primero el segundo paso.');
    const r = await guardarContrasena(q.id, body.contrasena, q.pre.email);
    // Lo de la persona (corta, su correo) se corrige y se reintenta en el acto. Un error NUESTRO (la
    // base no guardó) no la deja afuera: entra, y el pendiente se le vuelve a pedir en el próximo login.
    if (!r.ok && !r.nuestro) return no(r.error);
    if (!r.ok) await registrarEvento(q.id, 'contrasena-crear', false, 'la base no guardó: entró igual');
    return entrar(req, q, q.pre.mfa, { recordar: q.pre.recordar, saltarContrasena: true });
  }

  const e = await estadoMfa(q.id);
  const sinFactores = puedeEnrolarSinSesion(cantidadFactores(e));

  // ── Para ENTRAR ────────────────────────────────────────────────────────────
  if (accion === 'enviar') {
    const canal = body.canal === 'email' ? 'email' : body.canal === 'whatsapp' ? 'whatsapp' : null;
    if (!canal) return no('canal inválido');
    if (!canalDisponible(canal)) return no(CANAL_NO_DISPONIBLE);
    const r = await enviarCodigo(q.id, canal, 'login');
    return r.ok ? NextResponse.json({ ok: true, destino: r.destino }) : no(r.error);
  }

  if (accion === 'verificar') {
    const metodo = String(body.metodo ?? '');
    const codigo = String(body.codigo ?? '');
    if (!['totp', 'recuperacion', 'whatsapp', 'email'].includes(metodo)) return no('método inválido');
    const intento = await intentar(q.id, `login-${metodo}`);
    if (!intento) return no(MENSAJE_FRENADO, 429);
    let ok = false;
    let mfa: Amr | null = null;
    if (metodo === 'totp') { ok = await verificarTotpLogin(q.id, codigo); mfa = 'totp'; }
    else if (metodo === 'recuperacion') { ok = await usarCodigoRecuperacion(q.id, codigo); mfa = 'recuperacion'; }
    else if (metodo === 'whatsapp' || metodo === 'email') {
      const r = await verificarCodigo(q.id, metodo, 'login', codigo);
      if (!r.ok) return no(r.error);
      ok = true; mfa = metodo;
    } else return no('método inválido');
    if (!ok || !mfa) {
      await registrarEvento(q.id, `login-${metodo}`, false);
      return no(metodo === 'recuperacion' ? 'Ese código de recuperación no vale o ya se usó.' : 'Ese código no coincide.');
    }
    await intentoOk(intento);
    return entrar(req, q, mfa, { recordar });
  }

  if (accion === 'passkey-opciones') {
    if (!rp) return no('La huella se usa desde el celular.');
    return NextResponse.json({ ok: true, opciones: await opcionesLoginPasskey(q.id, rp) });
  }

  if (accion === 'passkey-verificar') {
    if (!rp) return no('La huella se usa desde el celular.');
    const ok = await verificarLoginPasskey(q.id, body.respuesta as never, rp);
    if (!ok) {
      await registrarEvento(q.id, 'login-passkey', false);
      return no('El dispositivo no confirmó la llave.');
    }
    return entrar(req, q, 'passkey', { recordar });
  }

  // ── El PRIMER factor, sólo si no tiene ninguno ─────────────────────────────
  if (accion.startsWith('enrolar-') && !sinFactores) {
    // Con un factor ya cargado, enrolar otro desde acá sería la puerta para que quien
    // tenga la cuenta de Google se agregue el suyo y entre. Eso va con sesión completa.
    return no('Ya tienes un método. Para agregar otro, entra primero.', 403);
  }

  /** Enrolar el primer factor prueba que lo tiene: entra, con códigos de recuperación nuevos. */
  const entrarEnrolado = async (mfa: Amr) =>
    entrar(req, q, mfa, { recordar, codigos: await generarCodigosRecuperacion(q.id) });

  if (accion === 'enrolar-totp-iniciar') {
    const t = await iniciarTotp(q.id, q.pre.email);
    return NextResponse.json({ ok: true, secreto: t.secreto, uri: t.uri, qr: t.qr });
  }
  if (accion === 'enrolar-totp-confirmar') {
    const intento = await intentar(q.id, 'enrolar-totp');
    if (!intento) return no(MENSAJE_FRENADO, 429);
    const r = await confirmarTotp(q.id, String(body.codigo ?? ''));
    if (!r.ok) return no(r.error);
    await intentoOk(intento);
    return entrarEnrolado('totp');
  }
  // ⛔ La llave de acceso NO es un primer método (decisión de Martín, 14/10/2026): se activa en el
  // teléfono DESPUÉS de haber entrado con la app, desde /api/perfil/seguridad con la sesión completa.
  if (accion === 'enrolar-passkey-opciones' || accion === 'enrolar-passkey-verificar') {
    return no('La huella se activa en el celular, después de entrar.', 403);
  }
  if (accion === 'enrolar-codigo-enviar' || accion === 'enrolar-codigo-confirmar') {
    const canal: Canal | null = body.canal === 'email' ? 'email' : body.canal === 'whatsapp' ? 'whatsapp' : null;
    if (!canal) return no('canal inválido');
    if (!canalDisponible(canal)) return no(CANAL_NO_DISPONIBLE);
    if (accion === 'enrolar-codigo-enviar') {
      const r = await enviarCodigo(q.id, canal, 'enrolar', { destino: String(body.destino ?? ''), emailLogin: q.pre.email });
      return r.ok ? NextResponse.json({ ok: true, destino: r.destino }) : no(r.error);
    }
    const intento = await intentar(q.id, `enrolar-${canal}`);
    if (!intento) return no(MENSAJE_FRENADO, 429);
    const r = await verificarCodigo(q.id, canal, 'enrolar', String(body.codigo ?? ''));
    if (!r.ok) return no(r.error);
    await intentoOk(intento);
    return entrarEnrolado(canal);
  }

  return no('acción inválida');
}
