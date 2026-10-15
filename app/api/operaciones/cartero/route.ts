// =============================================================================
// POST /api/operaciones/cartero — la única puerta del cartero de la PC de Martín
// =============================================================================
// El cartero (scripts/operaciones/cartero.mjs) no tiene sesión de MaKo: se autentica con SU token
// (`mkop_…`, acuñado en /admin/operaciones y guardado por hash). Por eso esta ruta está en
// `PUBLICOS` (lib/rutas-publicas.ts) y **no mira la cookie de sesión para nada**: se hace cargo de
// su propia auth, como el puente de Flow.
//
// Es UNA llamada por vuelta: el cartero sube lo que ve (chats vivos, claves que acepta), los
// acuses y cierres de la vuelta anterior, y se lleva lo que puede entregar ahora.
//
// ⚠️ QUÉ PUEDE HACER QUIEN ROBE ESTE TOKEN: leer los pedidos que estén por entregarse y marcar
// estados. NO puede hacer que la PC ejecute nada: el cartero sólo entrega pedidos firmados con una
// clave que vive en el navegador de Martín, y la verifica él (docs/diseno-centro-de-operaciones.md
// §3.1). Por eso el token alcanza como credencial de esta ruta.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { cicloCartero } from '@/lib/operaciones';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return NextResponse.json({ error: 'falta el token del cartero' }, { status: 401 });

  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: 'el cuerpo no es JSON' }, { status: 400 });
  }

  try {
    const salida = await cicloCartero(token, cuerpo);
    if (!salida) return NextResponse.json({ error: 'token del cartero inválido' }, { status: 401 });
    return NextResponse.json(salida);
  } catch (e) {
    // Lo que falla acá es la base: el cartero reintenta en la vuelta siguiente sin perder nada
    // (lo que reclamó lo tiene anotado él).
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 503 });
  }
}
