// =============================================================================
// /api/agencia/altas — una agencia PIDE sumar a alguien al equipo de un cliente
// =============================================================================
// GET                                  → lo que esta agencia pidió, en los tres estados.
// POST { clienteWs, email, nombre, rolWs } → deja el pedido en `pendiente`.
//
// ⚠️ ACÁ NO SE CREA NINGUNA CUENTA, y ése es todo el punto. «En super admin, me
// tienen que aparecer las notificaciones de cuando una agencia intenta agregar a
// un nuevo usuario, para poder aceptarlo o rechazarlo» (27/09/2026). Es la regla
// de la casa aplicada a un inquilino en vez de a un modelo: un canal PROPONE y
// una persona confirma. Quien firma es el super admin, en /api/admin/agencia.
//
// ⚠️ EL `clienteWs` DEL BODY NO ES UN PERMISO: ES UNA PREGUNTA. Lo escribe el
// navegador. Quién pregunta sale de la SESIÓN, y si puede sale de la BASE en este
// mismo request (`puedeEntrarAhora`) — no del token, no de la pantalla, no de un
// `estadoPorWs` que viajó con el HTML hace diez minutos.
//
// Esta ruta NO va en `lib/rutas-publicas.ts`: exige sesión de navegador, así que el
// gate tiene que verla y su chequeo de Origin tiene que correr.

import { NextResponse, type NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { puedeEntrarAhora, altasDeAgencia, pedirAlta } from '@/lib/agencia';
import { esWsValido } from '@/lib/agencia-cartera';
import { sanearPedido } from '@/lib/agencia-altas';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sesion = await getUsuarioActual();
  if (!sesion) return NextResponse.json({ ok: false, error: 'no autenticado' }, { status: 401 });
  if (!esWsValido(sesion.ws)) return NextResponse.json({ ok: true, altas: [] });
  return NextResponse.json({ ok: true, altas: await altasDeAgencia(sesion.ws) });
}

export async function POST(req: NextRequest) {
  const sesion = await getUsuarioActual();
  if (!sesion) return NextResponse.json({ ok: false, error: 'no autenticado' }, { status: 401 });

  // El super admin no pide: crea. Su alta es el «＋ Sumar a alguien» del equipo, que
  // escribe directo — es él quien firmaría este pedido, así que hacérselo dejar
  // pendiente sería pedirle permiso a sí mismo.
  if (sesion.rol === 'admin') {
    return NextResponse.json({ ok: false, error: 'el super admin suma directo desde el equipo' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { body = {}; }

  const sano = sanearPedido({
    agenciaWs: sesion.ws, clienteWs: body.clienteWs,
    email: body.email, nombre: body.nombre, rolWs: body.rolWs,
  });
  if (!sano.ok) return NextResponse.json({ ok: false, error: sano.error }, { status: 400 });
  const { pedido } = sano;

  // ⚠️ 404 Y NO 403, igual que en /api/agencia/entrar: un 403 confirma que ese
  // workspace existe, y eso ya es contarle a una agencia algo de la cartera de otra.
  if (!(await puedeEntrarAhora(pedido.agenciaWs, pedido.clienteWs))) {
    return NextResponse.json({ ok: false, error: 'ese cliente no está en tu cartera' }, { status: 404 });
  }

  const r = await pedirAlta({ ...pedido, pedidoPor: sesion.email ?? null });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 409 });
  return NextResponse.json({ ok: true, alta: r.fila });
}
