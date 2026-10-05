// =============================================================================
// GET /api/crm/replay?sesion=rs_… — el cuerpo de una grabación, para reproducirla
// =============================================================================
// Devuelve los eventos de rrweb como JSON Lines, ya descomprimidos. Lo pide el
// pop-up de la ficha del lead cuando alguien abre una grabación, y nunca al
// dibujar la ficha: son hasta 2 MiB comprimidos por sesión.
//
// ⚠️ NO DEVUELVE UNA URL FIRMADA DE STORAGE, a diferencia de /api/doc. Una URL
// firmada de una grabación de sesión es un link que se puede pegar en cualquier
// lado y que sigue abriendo la pantalla de un visitante hasta que vence; y el
// objeto viene gzip, así que el navegador necesitaría descomprimirlo él. Se baja
// con el service role, se descomprime acá y sale por esta ruta, que exige sesión.
//
// ⚠️ Y NO ESTÁ EN `PUBLICOS` (lib/rutas-publicas.ts), a propósito: el proxy la corta
// con 401 sin sesión, que es exactamente lo que tiene que pasar. El aislamiento por
// cliente lo pone `getTenantDb()` adentro de `cuerpoDeSesion`.
//
// El gate de ROL es el mismo que el de la ficha: cualquiera que pueda abrir el CRM
// puede ver lo que esa persona hizo en la página. Si algún día la grabación tiene
// que ser sólo del admin, el chequeo va acá y en el botón que la ofrece, no en uno
// de los dos.

import type { NextRequest } from 'next/server';
import { cuerpoDeSesion, type FalloDeCuerpo } from '@/lib/replay-leer';

export const dynamic = 'force-dynamic';

/**
 * Cada fallo, su código y su número. El pop-up los traduce a una frase distinta:
 * «todavía se está grabando» y «no pude bajarla» mandan a hacer cosas opuestas.
 */
const HTTP: Record<FalloDeCuerpo, number> = {
  id_invalido: 400,
  no_existe: 404,
  sin_sellar: 409,
  storage: 502,
  ilegible: 502,
};

export async function GET(req: NextRequest) {
  const sesion = req.nextUrl.searchParams.get('sesion') ?? '';
  const r = await cuerpoDeSesion(sesion);
  if (!r.ok) return Response.json({ error: r.motivo }, { status: HTTP[r.motivo] });

  return new Response(r.texto, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      // Es la pantalla de una persona: no se cachea en ningún lado del camino.
      'cache-control': 'private, no-store',
    },
  });
}
