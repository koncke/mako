// =============================================================================
// /api/grupos — los grupos de la persona, para la lista de chats (3/11/2026)
// =============================================================================
// El propio si administra, los invitados, la cartera aprobada si administra una agencia; al super admin, el de la pestaña o la plataforma. Cada uno pasa por la
// misma puerta (lib/grupo-puerta.ts): una lista no es otro camino para entrar. El de la pestaña primero, y después por actividad.

import { NextResponse } from 'next/server';
import { getWorkspaceActual } from '@/lib/workspace';
import { gruposDeLaPersona } from '@/lib/grupo-puerta';
import { resumenParaLaLista } from '@/lib/grupo-app';

export const dynamic = 'force-dynamic';

export async function GET() {
  const pestana = await getWorkspaceActual().catch(() => null);
  const grupos = await gruposDeLaPersona(pestana);
  const filas = await Promise.all(grupos.map(async ({ ws, acceso }) => ({
    ws, administra: acceso.administra, invitado: acceso.invitado,
    ...(await resumenParaLaLista(ws, acceso)),
  })));
  filas.sort((a, b) => (Number(b.ws === pestana) - Number(a.ws === pestana)) || String(b.ultimo?.creadoEn ?? '').localeCompare(String(a.ultimo?.creadoEn ?? '')));
  return NextResponse.json({ ok: true, grupos: filas.slice(0, 30) });
}
