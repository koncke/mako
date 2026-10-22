// =============================================================================
// POST /api/ia-del-negocio/probar-clave { proveedor } — «Probar mi clave» de «Tus cuentas de IA» (IA3, 22/10/2026)
// =============================================================================
// PRIVADA, del admin (la clave de API es del negocio, la guarda él). Un pedido que no cobra (lib/su-clave.ts →
// `probarSuClave`): dice si la clave es válida, y si no anda deja la fila del fallo como cualquier otro. Nunca devuelve
// ni registra la clave ni el texto del proveedor.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { personaDelRequest } from '@/lib/mako-turno-app';
import { probarSuClave } from '@/lib/su-clave';
import { PROVS_SU_CLAVE, type ProvSuClave } from '@/lib/su-clave-reglas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const persona = await personaDelRequest();
  if ('error' in persona) return NextResponse.json({ ok: false, error: persona.error }, { status: persona.status });
  if (persona.rol !== 'admin') return NextResponse.json({ ok: false, error: 'Sólo el admin del negocio.' }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Pedido inválido.' }, { status: 400 }); }
  if (!(PROVS_SU_CLAVE as readonly unknown[]).includes(body?.proveedor)) return NextResponse.json({ ok: false, error: 'Esa clave no está.' }, { status: 400 });
  const r = await probarSuClave(persona.ws, body.proveedor as ProvSuClave);
  return NextResponse.json({ ok: true, anda: r.ok, texto: r.texto }, { headers: { 'cache-control': 'no-store' } });
}
