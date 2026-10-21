// =============================================================================
// POST /api/ia-pc/modelo { modelo } — qué modelo de Claude usan las computadoras del negocio (docs/ia-del-cliente.md §12.12)
// =============================================================================
// PRIVADA, del admin. Sonnet por default: Opus le gasta el cupo de 5 horas al cliente en pocos turnos. Sólo los de la
// lista (MODELOS_PC), que la PC vuelve a validar antes de usarlo.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { personaDelRequest } from '@/lib/mako-turno-app';
import { CLAVE_MODELO_PC, MODELOS_PC } from '@/lib/ia-pc-reglas';
import { setSetting } from '@/lib/settings';
import { runWithWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const persona = await personaDelRequest();
  if ('error' in persona) return NextResponse.json({ ok: false, error: persona.error }, { status: persona.status });
  if (persona.rol !== 'admin') return NextResponse.json({ ok: false, error: 'Sólo el admin del negocio.' }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Pedido inválido.' }, { status: 400 }); }
  if (!(MODELOS_PC as readonly unknown[]).includes(body?.modelo)) return NextResponse.json({ ok: false, error: 'Ese modelo no está.' }, { status: 400 });
  await runWithWorkspace(persona.ws, () => setSetting(CLAVE_MODELO_PC, String(body.modelo)));
  return NextResponse.json({ ok: true });
}
