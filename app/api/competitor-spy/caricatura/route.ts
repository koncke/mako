// =============================================================================
// /api/competitor-spy/caricatura — un paso de la caricatura de un competidor (4/11/2026)
// =============================================================================
// Martín, 4/11: «no me hizo la caricatura como habíamos quedado... Eso debe hacerse en segundo plano de manera
// automática». La pantalla la llama sola, por cada competidor sin caricatura, y vuelve a preguntar mientras
// `enMarcha`. Qué paso toca y por qué se salta (un referente, la prueba gratis, sin el puente de Flow): lib/spy-caricatura-reglas.ts.
//
//   POST { id } → { ok, url | null, enMarcha, porque? }
//
// ⚠️ ES UNA RUTA Y NO UNA SERVER ACTION: describir la cara con la IA tarda hasta 40 s, y una action haría fila delante
// de todas las demás de la pantalla.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { avanzarCaricatura } from '@/lib/spy-caricatura-auto';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
/** Los rasgos con la IA (hasta 40 s) más bajar la foto o la caricatura. */
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const s = await getUsuarioActual();
  const ws = s && (await getRolWsEfectivo()) ? await getWorkspaceActual() : null;
  if (!s || ws == null) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  const cuerpo = (await req.json().catch(() => ({}))) as { id?: unknown };
  const id = Number(cuerpo.id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ ok: false, error: 'Falta el competidor.' }, { status: 400 });
  return Response.json({ ok: true, ...(await avanzarCaricatura(ws, id)) });
}
