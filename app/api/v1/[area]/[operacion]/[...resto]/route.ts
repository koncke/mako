// =============================================================================
// /api/v1/{area}/{recurso}/… — las rutas REST estilo GitHub de tres o más segmentos
// =============================================================================
// `GET /api/v1/crm/leads/1395`, `PUT /api/v1/crm/leads/1395/etapa`… Son ALIAS de las
// operaciones de siempre (lib/api-mako/rest.ts, decisión de Martín del 08/10/2026): se
// resuelven a una operación y corren por el mismo `correr()` que la ruta por operación
// (lib/api-mako/rutas-http.ts). Bearer, sin cookie, como toda la carpeta.
// =============================================================================

import type { NextRequest } from 'next/server';
import { autenticar, esRespuesta } from '@/lib/api-mako/http';
import { manejarRest, type Metodo } from '@/lib/api-mako/rutas-http';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

type Params = Promise<{ area: string; operacion: string; resto: string[] }>;

async function manejar(req: NextRequest, params: Params, metodo: Metodo) {
  const auth = await autenticar(req);
  if (esRespuesta(auth)) return auth;
  const { area, operacion, resto } = await params;
  return manejarRest(req, auth, [area, operacion, ...resto], metodo);
}

export const GET = (req: NextRequest, ctx: { params: Params }) => manejar(req, ctx.params, 'GET');
export const POST = (req: NextRequest, ctx: { params: Params }) => manejar(req, ctx.params, 'POST');
export const PATCH = (req: NextRequest, ctx: { params: Params }) => manejar(req, ctx.params, 'PATCH');
export const PUT = (req: NextRequest, ctx: { params: Params }) => manejar(req, ctx.params, 'PUT');
export const DELETE = (req: NextRequest, ctx: { params: Params }) => manejar(req, ctx.params, 'DELETE');
