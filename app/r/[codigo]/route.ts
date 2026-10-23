// =============================================================================
// GET /r/<código> — el link de MaKo Partners: quién mandó a esta persona (docs/referidos.md)
// =============================================================================
// Deja la cookie `mako_ref` con el código (60 días) y lleva a /planes con `?ref=`. EL PRIMERO VALE: si la persona ya
// llegó con el link de otro, la cookie no se pisa (docs/referidos.md, «el origen que vale es el primero»). El código
// se valida contra la base: uno que no existe no deja cookie (lleva igual a /planes).
//
// ⚠️ PÚBLICA (prefijo `/r`, lib/rutas-publicas.ts): sólo GET, no lee la sesión. Declara su HEAD (AGENTS.md: Next contesta
// un HEAD llamando al GET, y un bot de vista previa no tiene por qué dejar una cookie).
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { codigoRefLimpio } from '@/lib/compra-plan-reglas';
import { COOKIE_REF, DIAS_COOKIE_REF } from '@/lib/partners-reglas';

export const dynamic = 'force-dynamic';

async function existe(codigo: string): Promise<boolean> {
  const { data, error } = await getSupabaseServer().from('partner_codigos').select('workspace_id').eq('codigo', codigo).maybeSingle();
  return !error && !!data;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo: crudo } = await params;
  const codigo = codigoRefLimpio(crudo);
  const destino = new URL('/planes', req.nextUrl.origin);
  if (!codigo || !(await existe(codigo))) return NextResponse.redirect(destino, 302);
  const previo = codigoRefLimpio(req.cookies.get(COOKIE_REF)?.value);
  const vale = previo ?? codigo;
  destino.searchParams.set('ref', vale);
  const res = NextResponse.redirect(destino, 302);
  if (!previo) {
    res.cookies.set(COOKIE_REF, codigo, { maxAge: DIAS_COOKIE_REF * 86_400, path: '/', sameSite: 'lax', secure: true, httpOnly: true });
  }
  return res;
}

export function HEAD() {
  return new Response(null, { status: 200 });
}
