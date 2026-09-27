// =============================================================================
// /api/agencia/entrar — una agencia entra a un cliente SUYO (y sale)
// =============================================================================
// POST { ws }            → acuña la cookie firmada `mako_agencia` si la cartera
//                          está APROBADA para esta agencia y ese cliente.
// POST { salir: true } / DELETE → la borra.
//
// ⚠️ ES UN ENDPOINT Y NO UN LINK, y ésa es la diferencia con el «Entrar como» de
// /admin. Ahí entrar es un `<a href="/general?ws=N">`: no hay acto, así que no
// hay dónde colgar una aprobación, un vencimiento ni un registro de quién entró
// a qué. Acá entrar es una petición que el server acepta o rechaza, y eso es lo
// que hace posible todo lo demás.
//
// ⚠️ EL `ws` DEL BODY NO ES UN PERMISO: ES UNA PREGUNTA. Lo escribe el navegador,
// así que se trata como texto de afuera. Quién lo pregunta sale de la SESIÓN
// (`sesion.ws`), nunca del body — pedir la agencia por parámetro sería el mismo
// IDOR que leer `?ws=` directo de la URL.
//
// Esta ruta NO va en `lib/rutas-publicas.ts`: exige sesión de navegador, así que
// el gate tiene que verla y su chequeo de Origin tiene que correr.

import { NextResponse, type NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { AGENCIA_COOKIE, AGENCIA_HORAS, firmarAgencia } from '@/lib/auth-session';
import { puedeEntrarAhora } from '@/lib/agencia';
import { esWsValido } from '@/lib/agencia-cartera';
import { getWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

/** Salir siempre se puede, incluso sin permiso para entrar: una salida que
 *  depende de la misma condición que te dejó entrar es una salida que falta
 *  justo cuando hace falta (la cartera se revocó mientras estabas adentro). */
function limpiar() {
  const res = NextResponse.json({ ok: true, viendo: null });
  res.cookies.set({ name: AGENCIA_COOKIE, value: '', ...cookieBase, maxAge: 0 });
  return res;
}

export async function DELETE() {
  return limpiar();
}

export async function POST(req: NextRequest) {
  const sesion = await getUsuarioActual();
  if (!sesion) return NextResponse.json({ ok: false, error: 'no autenticado' }, { status: 401 });

  let body: { ws?: unknown; salir?: unknown };
  try { body = (await req.json()) as typeof body; } catch { body = {}; }
  if (body.salir === true) return limpiar();

  // El super-admin no entra por acá: ya tiene `?ws=` y la cookie de
  // impersonación. Una tercera fuente para el mismo dato obligaría a que
  // getWorkspaceActual y estaImpersonando coincidan en tres lugares.
  if (sesion.rol === 'admin') {
    return NextResponse.json({ ok: false, error: 'el super admin entra desde /admin' }, { status: 400 });
  }

  const agenciaWs = sesion.ws;
  const clienteWs = Number(body.ws);
  if (!esWsValido(agenciaWs)) {
    return NextResponse.json({ ok: false, error: 'tu cuenta no tiene workspace' }, { status: 403 });
  }
  if (!esWsValido(clienteWs)) {
    return NextResponse.json({ ok: false, error: 'cliente inválido' }, { status: 400 });
  }

  // ⚠️ 404 Y NO 403, igual que con las credenciales de plataforma: un 403
  // confirma que ese workspace existe, y eso ya es contarle a una agencia algo
  // de la cartera de otra. A quien no le corresponde, no existe. Y las dos
  // ramas —sin permiso y sin workspace— contestan LO MISMO, para que la
  // diferencia tampoco se pueda medir por el texto.
  const sinPermiso = () => NextResponse.json({ ok: false, error: 'ese cliente no está en tu cartera' }, { status: 404 });

  if (!(await puedeEntrarAhora(agenciaWs, clienteWs))) return sinPermiso();

  const wsRow = await getWorkspace(clienteWs);
  if (!wsRow) return sinPermiso();

  const token = firmarAgencia(agenciaWs, clienteWs);
  if (!token) return NextResponse.json({ ok: false, error: 'auth no configurada' }, { status: 500 });

  const res = NextResponse.json({ ok: true, viendo: clienteWs, nombre: wsRow.nombre });
  res.cookies.set({ name: AGENCIA_COOKIE, value: token, ...cookieBase, maxAge: AGENCIA_HORAS * 3600 });
  return res;
}
