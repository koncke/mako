// =============================================================================
// /api/perfil/seguridad — administrar el segundo factor, con la sesión COMPLETA
// =============================================================================
// La otra puerta de lib/mfa.ts. Ésta va detrás del proxy (sesión firmada y chequeo de
// Origin) y además pasa por `getUsuarioActual`, que ya cortó a quien necesita segundo
// factor y no lo trae. Acá se agrega o se saca un método, se regeneran los códigos de
// recuperación y se olvidan los dispositivos recordados.
//
// ⚠️ ACTIVAR EL 2FA DESDE ACÁ REEMITE LA SESIÓN. Desde que `usuarios.mfa_activo` pasa a
// true, `getUsuarioActual` exige `mfa` en el token — y la cookie con la que la persona
// acaba de activarlo no lo trae. Sin reemitirla, activar el segundo paso la echaba de la
// app en el request siguiente. Confirmar el método nuevo PRUEBA que lo tiene, así que la
// sesión nueva lleva ese método como `mfa`.

import { NextResponse, type NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { ponerSesion } from '@/lib/sesion-cookies';
import { canalDisponible, CANALES_CODIGO, CANAL_NO_DISPONIBLE, type Amr } from '@/lib/mfa-reglas';
import {
  estadoMfa, cantidadFactores, intentar, intentoOk, MENSAJE_FRENADO,
  iniciarTotp, confirmarTotp, enviarCodigo, verificarCodigo,
  opcionesRegistroPasskey, verificarRegistroPasskey, generarCodigosRecuperacion,
  quitarFactor, revocarDispositivo, rpDelPedido, type Canal,
} from '@/lib/mfa';

export const dynamic = 'force-dynamic';

const no = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

async function quien() {
  const s = await getUsuarioActual();
  if (!s || s.legacy || !/^\d+$/.test(s.sub)) return null;
  return s;
}

export async function GET(req: NextRequest) {
  const s = await quien();
  if (!s) return no('no autenticado', 401);
  const e = await estadoMfa(Number(s.sub));
  return NextResponse.json({
    ok: true,
    obligatorio: s.rol === 'admin',
    passkeysDisponibles: !!rpDelPedido(req.headers.get('host')),
    canales: CANALES_CODIGO,
    totp: e.totp,
    whatsapp: e.whatsapp,
    email: e.email,
    passkeys: e.passkeys,
    codigosRestantes: e.codigosRestantes,
    dispositivos: e.dispositivos,
  });
}

export async function POST(req: NextRequest) {
  const s = await quien();
  if (!s) return no('no autenticado', 401);
  const uid = Number(s.sub);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const accion = String(body.accion ?? '');
  // El freno va en cada intento de adivinar un código (`intentar`), no acá: puesto para todo,
  // quien tiene la cuenta de Google le bloqueaba al dueño logueado hasta olvidar un dispositivo.

  const antes = cantidadFactores(await estadoMfa(uid));

  /** Un método nuevo quedó activo: códigos si era el primero, y la sesión con `mfa`. */
  const activado = async (mfa: Amr) => {
    const codigos = antes === 0 ? await generarCodigosRecuperacion(uid) : undefined;
    const res = NextResponse.json({ ok: true, ...(codigos ? { codigos } : {}) });
    if (!s.mfa) ponerSesion(res, { sub: s.sub, email: s.email, nombre: s.nombre, rol: s.rol, mfa });
    return res;
  };

  const canalDe = (v: unknown): Canal | null => (v === 'email' ? 'email' : v === 'whatsapp' ? 'whatsapp' : null);
  // Lo que hoy no sale (tanda 1: ninguno) se rechaza acá, antes de crear un desafío.
  const canalPedido = canalDe(body.canal);
  if ((accion === 'codigo-enviar' || accion === 'codigo-confirmar') && canalPedido && !canalDisponible(canalPedido)) {
    return no(CANAL_NO_DISPONIBLE);
  }
  const rp = rpDelPedido(req.headers.get('host'));

  switch (accion) {
    case 'totp-iniciar': {
      const t = await iniciarTotp(uid, s.email);
      return NextResponse.json({ ok: true, secreto: t.secreto, qr: t.qr });
    }
    case 'totp-confirmar': {
      const intento = await intentar(uid, 'enrolar-totp');
      if (!intento) return no(MENSAJE_FRENADO, 429);
      const r = await confirmarTotp(uid, String(body.codigo ?? ''));
      if (!r.ok) return no(r.error);
      await intentoOk(intento);
      return activado('totp');
    }
    case 'passkey-opciones': {
      if (!rp) return no('Aquí no se pueden usar llaves de acceso.');
      return NextResponse.json({ ok: true, opciones: await opcionesRegistroPasskey(uid, s.email, s.nombre, rp) });
    }
    case 'passkey-verificar': {
      if (!rp) return no('Aquí no se pueden usar llaves de acceso.');
      const r = await verificarRegistroPasskey(uid, body.respuesta as never, rp, String(body.nombre ?? ''));
      return r.ok ? activado('passkey') : no(r.error);
    }
    case 'codigo-enviar': {
      const canal = canalDe(body.canal);
      if (!canal) return no('canal inválido');
      const r = await enviarCodigo(uid, canal, 'enrolar', { destino: String(body.destino ?? ''), emailLogin: s.email });
      return r.ok ? NextResponse.json({ ok: true, destino: r.destino }) : no(r.error);
    }
    case 'codigo-confirmar': {
      const canal = canalDe(body.canal);
      if (!canal) return no('canal inválido');
      const intento = await intentar(uid, `enrolar-${canal}`);
      if (!intento) return no(MENSAJE_FRENADO, 429);
      const r = await verificarCodigo(uid, canal, 'enrolar', String(body.codigo ?? ''));
      if (!r.ok) return no(r.error);
      await intentoOk(intento);
      return activado(canal);
    }
    case 'quitar': {
      const factor = String(body.factor ?? '');
      if (!['totp', 'whatsapp', 'email', 'passkey'].includes(factor)) return no('método inválido');
      const r = await quitarFactor(uid, s.rol, factor as 'totp', Number(body.passkeyId) || undefined);
      return r.ok ? NextResponse.json({ ok: true }) : no(r.error);
    }
    case 'codigos-generar': {
      if (antes === 0) return no('Primero activa un método.');
      return NextResponse.json({ ok: true, codigos: await generarCodigosRecuperacion(uid) });
    }
    case 'dispositivo-revocar': {
      const id = body.id === 'todos' ? 'todos' : Number(body.id);
      if (id !== 'todos' && (!Number.isInteger(id) || id <= 0)) return no('dispositivo inválido');
      await revocarDispositivo(uid, id);
      return NextResponse.json({ ok: true });
    }
    default:
      return no('acción inválida');
  }
}
