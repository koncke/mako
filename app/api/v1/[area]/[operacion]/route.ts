// =============================================================================
// /api/v1/{area}/{operacion} — UNA ruta para todas las operaciones de MaKo
// =============================================================================
// GET  → lectura, parámetros por query string (`?formato=` si la operación lo admite).
// POST → acción o control. Con un token clásico queda pendiente o propuesta; con uno
//        detallado con escritura, se hace en el acto (lib/api-mako/rutas-http.ts).
//
// Y si `{operacion}` no es una operación, es una ruta REST de dos segmentos
// (`GET /api/v1/crm/leads`, `POST /api/v1/crm/leads`): el alias estilo GitHub
// (lib/api-mako/rest.ts). Por eso exporta también PATCH, PUT y DELETE. Las de tres o más
// segmentos van por `[...resto]/route.ts`.
//
// Auth por bearer y sin cookie → está en `PUBLICOS` (lib/rutas-publicas.ts) como
// `/api/v1`. Ver lib/api-mako/http.ts. Nada de lógica de negocio acá.
// =============================================================================

import type { NextRequest } from 'next/server';
import { autenticar, esRespuesta } from '@/lib/api-mako/http';
import { manejarOperacion, type Metodo } from '@/lib/api-mako/rutas-http';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// Hay lecturas que salen a Meta, Calendly o Fathom, análisis que invocan un
// modelo y escrituras directas que corren su `ejecutar()`. 60 s, el techo de la casa para
// lo que no es un cron.
export const maxDuration = 60;

type Params = Promise<{ area: string; operacion: string }>;

async function manejar(req: NextRequest, params: Params, metodo: Metodo) {
  const auth = await autenticar(req);
  if (esRespuesta(auth)) return auth;
  const { area, operacion } = await params;
  return manejarOperacion(req, auth, area, operacion, metodo);
}

export const GET = (req: NextRequest, ctx: { params: Params }) => manejar(req, ctx.params, 'GET');
export const POST = (req: NextRequest, ctx: { params: Params }) => manejar(req, ctx.params, 'POST');
export const PATCH = (req: NextRequest, ctx: { params: Params }) => manejar(req, ctx.params, 'PATCH');
export const PUT = (req: NextRequest, ctx: { params: Params }) => manejar(req, ctx.params, 'PUT');
export const DELETE = (req: NextRequest, ctx: { params: Params }) => manejar(req, ctx.params, 'DELETE');
