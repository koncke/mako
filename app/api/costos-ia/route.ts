// =============================================================================
// /api/costos-ia — el gasto de IA de un PERÍODO, para el filtro de fecha
// =============================================================================
// GET ?periodo=YYYY-MM  → resumen de ese mes
// GET ?periodo=todo     → todo el histórico (default)
//
// Existe aparte de /api/anthropic-usage porque aquél responde una pregunta
// distinta —«¿cuánto me queda del saldo que cargué?»— y está atado al mes en
// curso. Este responde «¿cuánto se gastó en X?», que es lo que pidió el dueño:
// «Sería bueno que incluyas un filtro de fecha y poder ver el gasto de otros
// meses también» (08/08/2026). Además lee PAGINADO: el otro trunca en 1000 filas
// sin avisar (ver el encabezado de lib/costos-ia.ts).
//
// Solo super-admin: es el costo de la AGENCIA, no el de un cliente.

import type { NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { resumenDelPeriodo, mesesConDatos } from '@/lib/costos-ia';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Guard de AGENCIA, no `requireRolWs([])`: `rol_ws` vale 'admin' para el dueño
  // de CADA workspace, así que ese chequeo dejaría entrar a cualquier cliente.
  if (!(await getSesionAdmin())) {
    return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  // `?meses=1` devuelve SOLO la lista de meses con datos. Lo pide /integraciones
  // al montar, y hace dos cosas de una: puebla el selector sin ofrecer meses
  // vacíos, y sirve de sonda de permiso — si contesta 403, el cliente no ve el
  // filtro. Es la regla de «estado vivo, no recordado»: el control aparece
  // porque el endpoint contestó, no porque alguien supuso que existe.
  if (req.nextUrl.searchParams.get('meses')) {
    try {
      return Response.json({ ok: true, mesesDisponibles: await mesesConDatos() });
    } catch (err) {
      return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
  }

  const crudo = req.nextUrl.searchParams.get('periodo') ?? 'todo';
  // Saneo explícito: lo que no sea 'YYYY-MM' es 'todo'. Sin esto, un parámetro
  // raro se convierte en una ventana vacía y la pantalla muestra $0 — que es la
  // forma más cara de equivocarse (se lee como «no se gastó nada»).
  const periodo = /^\d{4}-(0[1-9]|1[0-2])$/.test(crudo) ? crudo : 'todo';

  try {
    return Response.json({ ok: true, ...(await resumenDelPeriodo(periodo)) });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
