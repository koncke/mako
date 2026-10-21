// =============================================================================
// POST /api/ia-pc/codigo { acepto: <versión> } — una persona pide el código para emparejar SU computadora
// =============================================================================
// PRIVADA (con sesión, no está en lib/rutas-publicas.ts). El código ata la PC a ESTE negocio y a ESTA persona: sólo sus
// turnos van a su Claude, porque la cuenta es suya y compartirla está prohibido (docs/ia-del-cliente.md §10). Y sólo
// después de aceptar con un toque TEXTO_CONSENTIMIENTO, en su versión de hoy (el Cerebro, 21/10/2026; mig 0321).
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { personaDelRequest } from '@/lib/mako-turno-app';
import { crearCodigo } from '@/lib/ia-pc';
import { VERSION_CONSENTIMIENTO } from '@/lib/ia-pc-reglas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const persona = await personaDelRequest();
  if ('error' in persona) return NextResponse.json({ ok: false, error: persona.error }, { status: persona.status });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* abajo: sin aceptar no hay código */ }
  if (body?.acepto !== VERSION_CONSENTIMIENTO) return NextResponse.json({ ok: false, error: 'Primero acepta cómo funciona.' }, { status: 400 });
  const r = await crearCodigo(persona.ws, persona.actor, VERSION_CONSENTIMIENTO).catch((e) => {
    console.error('[ia-pc/codigo]', e instanceof Error ? e.message : String(e));
    return null;
  });
  if (!r) return NextResponse.json({ ok: false, error: 'No pude crear el código. Intenta de nuevo.' }, { status: 500 });
  return NextResponse.json({ ok: true, codigo: r.codigo, venceAt: r.venceAt }, { headers: { 'cache-control': 'no-store' } });
}
