// =============================================================================
// /api/competitor-spy/todo — un paso de las corridas largas: todo lo que publica y sus anuncios (4/11/2026)
// =============================================================================
// Martín, 4/11 (puntos 8 y 10): «que traiga muchos más, si puede, todos directamente» y «todos los anuncios de la
// biblioteca de anuncios». La ficha la llama sola después de leer, y vuelve a preguntar mientras `enMarcha`. Qué se
// pide y cuánto cuesta: lib/spy-todo-reglas.ts.
//
//   POST { id } → { ok, enMarcha, nuevas, porque? }
//
// ⚠️ ES UNA RUTA Y NO UNA SERVER ACTION: no hace fila delante de las demás de la pantalla. Y no espera a Apify: empieza
// la corrida o mira la que está en marcha, y contesta.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { avanzarTodo } from '@/lib/spy-todo';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
/** Leer el dataset y guardar cientos de piezas (con sus miniaturas, hasta 9 s). */
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const s = await getUsuarioActual();
  const ws = s && (await getRolWsEfectivo()) ? await getWorkspaceActual() : null;
  if (!s || ws == null) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  const cuerpo = (await req.json().catch(() => ({}))) as { id?: unknown };
  const id = Number(cuerpo.id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ ok: false, error: 'Falta el competidor.' }, { status: 400 });
  return Response.json({ ok: true, ...(await avanzarTodo(ws, id)) });
}
