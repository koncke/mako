// =============================================================================
// GET /r/<código> — el link de MaKo Partners: quién mandó a esta persona (docs/referidos.md)
// =============================================================================
// Deja la cookie `mako_ref` con el código (60 días) y lleva a /planes con `?ref=`. EL PRIMERO VALE: si la persona ya
// llegó con el link de otro, la cookie no se pisa (docs/referidos.md, «el origen que vale es el primero»), salvo que ese
// primero ya no sea de ningún partner (`refQueVale`, 6/11/2026). El código se valida contra la base: uno que no existe no
// deja cookie (lleva igual a /planes).
//
// ⚠️ PÚBLICA (prefijo `/r`, lib/rutas-publicas.ts): sólo GET, no lee la sesión. Declara su HEAD (AGENTS.md: Next contesta
// un HEAD llamando al GET, y un bot de vista previa no tiene por qué dejar una cookie).
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { codigoRefLimpio } from '@/lib/compra-plan-reglas';
import { COOKIE_REF, DIAS_COOKIE_REF, refQueVale } from '@/lib/partners-reglas';
import { codigoVigente, esCodigoDePartner, sumarVisitaAlLink } from '@/lib/partners-programa';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo: crudo } = await params;
  const limpio = codigoRefLimpio(crudo);
  const destino = new URL('/planes', req.nextUrl.origin);
  // El código que vale HOY (27/10/2026): un link viejo, de antes de que el partner cambiara su código, lleva con el nuevo
  // (lib/partners-programa.ts, `codigoVigente`). Si no es de nadie, o no se pudo leer, a /planes sin código.
  const codigo = limpio ? await codigoVigente(limpio).catch(() => null) : null;
  if (!codigo) return NextResponse.redirect(destino, 302);
  const previo = codigoRefLimpio(req.cookies.get(COOKIE_REF)?.value);
  // La cookie de antes vale sólo si sigue siendo de un partner (`refQueVale`): una muerta no tapa el link de hoy.
  const previoEsDePartner = previo ? await esCodigoDePartner(previo).catch(() => null) : null;
  const { ref, ponerCookie } = refQueVale({ previo, previoEsDePartner, codigo });
  destino.searchParams.set('ref', ref);
  const res = NextResponse.redirect(destino, 302);
  if (ponerCookie) {
    res.cookies.set(COOKIE_REF, codigo, { maxAge: DIAS_COOKIE_REF * 86_400, path: '/', sameSite: 'lax', secure: true, httpOnly: true });
    // La visita del panel del partner (25/10/2026): la primera vez de este navegador, y nunca un robot de vista previa. Si
    // no se pudo anotar, el link igual lleva.
    await sumarVisitaAlLink(codigo, req.headers.get('user-agent')).catch((e) => console.warn('[r] no pude anotar la visita:', e instanceof Error ? e.message : e));
  }
  return res;
}

export function HEAD() {
  return new Response(null, { status: 200 });
}
