// =============================================================================
// POST /api/ia-pc/codigo — una persona pide el código para emparejar SU computadora (docs/ia-del-cliente.md §3)
// =============================================================================
// PRIVADA (con sesión, no está en lib/rutas-publicas.ts). El código ata la PC a ESTE negocio y a ESTA persona: sólo sus
// turnos van a su Claude, porque la cuenta es suya y compartirla está prohibido (docs/ia-del-cliente.md §10).
// =============================================================================

import { NextResponse } from 'next/server';
import { personaDelRequest } from '@/lib/mako-turno-app';
import { crearCodigo } from '@/lib/ia-pc';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST() {
  const persona = await personaDelRequest();
  if ('error' in persona) return NextResponse.json({ ok: false, error: persona.error }, { status: persona.status });
  const r = await crearCodigo(persona.ws, persona.actor).catch((e) => {
    console.error('[ia-pc/codigo]', e instanceof Error ? e.message : String(e));
    return null;
  });
  if (!r) return NextResponse.json({ ok: false, error: 'No pude crear el código. Intenta de nuevo.' }, { status: 500 });
  return NextResponse.json({ ok: true, codigo: r.codigo, venceAt: r.venceAt }, { headers: { 'cache-control': 'no-store' } });
}
