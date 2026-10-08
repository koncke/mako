// =============================================================================
// POST /api/alumno/link — «Soy alumno: entrar con mi email» (el pedido del link)
// =============================================================================
// Pedido de Martín (07/10/2026, item 9): «que se le cree una cuenta de MaKo con ese nivel de acceso,
// solo al curso, sin la sidebar principal ni nada». La cuenta es la identidad de alumno (D3 de
// docs/diseno-curso-skool.md: NUNCA una fila en `usuarios` ni `mako_session`); esto es la puerta para
// volver a entrar cuando su cookie venció, sin Google y sin buscar el mail de la invitación.
//
// Recibe `{ email }` y contesta SIEMPRE lo mismo (../pedir-link.ts explica por qué también el
// tiempo). Si el email tiene una invitación vigente, le llega un link de 15 minutos y un solo uso a
// /login, donde un botón termina de entrar (POST /api/alumno/entrar).
//
// ⚠️ ESTÁ EN `PUBLICOS` (lib/rutas-publicas.ts), ruta EXACTA, porque se autentica sola: no lee
// NINGUNA cookie (ni la sesión ni la del alumno) y lo único que hace es mandarle un mail a la dirección
// que ya estaba invitada. Sin estar ahí, el proxy la cortaría con 401 antes de correr (y en local no
// se vería: sin AUTH_SECRET el gate no corre — AGENTS.md). El early-return se saltea el chequeo de
// Origin, y no hay nada que eso proteja: un POST desde otro sitio no puede hacer más que el
// formulario mismo, y los dos topes valen igual.

import { after, NextResponse, type NextRequest } from 'next/server';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { mandarLinkDeEntrada } from '@/lib/alumno-acceso';
import { pedirLinkDeEntrada } from '../pedir-link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SIN_CACHE = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
/** Un `{ "email": "…" }` no pesa más que esto. Lo de más no se lee. */
const TOPE_CUERPO = 2_000;

export async function POST(req: NextRequest) {
  let email: unknown = null;
  try {
    const crudo = await req.text();
    if (crudo.length <= TOPE_CUERPO) email = (JSON.parse(crudo) as { email?: unknown } | null)?.email ?? null;
  } catch { /* un cuerpo que no es JSON es un email que no sirve: lo dice `pedirLinkDeEntrada` */ }

  const r = pedirLinkDeEntrada({ ip: clientIp(req), email }, {
    // ⚠️ DESPUÉS DE CONTESTAR: ver la cabecera de ../pedir-link.ts. Fuera de un request (no pasa en
    // una ruta) `after` tira y el trabajo corre en línea, sin esperarlo.
    programar: (trabajo) => {
      try { after(trabajo); } catch { void trabajo(); }
    },
    mandar: mandarLinkDeEntrada,
    limite: rateLimit,
  });
  return NextResponse.json(r.body, { status: r.status, headers: SIN_CACHE });
}
