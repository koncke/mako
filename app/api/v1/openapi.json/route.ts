// =============================================================================
// GET /api/v1/openapi.json — la descripción OpenAPI 3.1 de la API, generada del registro
// =============================================================================
// Como la que publica GitHub (github/rest-api-description): para importar la API de MaKo
// en n8n, Postman o un generador de SDK. Sale de lib/api-mako/openapi.ts; bearer como toda
// la carpeta.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { autenticar, esRespuesta } from '@/lib/api-mako/http';
import { especificacionOpenApi } from '@/lib/api-mako/openapi';
import { APP_BASE_URL } from '@/lib/app-url';
import { registrarLlamada } from '@/lib/api-mako/bitacora';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const auth = await autenticar(req);
  if (esRespuesta(auth)) return auth;
  registrarLlamada({ ws: auth.ctx.ws, operacion: 'openapi', canal: 'http', ok: true, status: 200, ms: 0, req, token: auth.token.clase === 'detallado' ? auth.token.id : 'principal' });
  const base = new URL(req.url).origin || APP_BASE_URL;
  return NextResponse.json(especificacionOpenApi(base), { headers: { ...auth.cabeceras, 'Cache-Control': 'no-store' } });
}
