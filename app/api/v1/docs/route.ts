// =============================================================================
// GET /api/v1/docs — la referencia de la API, en markdown, generada del registro
// =============================================================================
// Es el MISMO texto que docs/api-mako.md (scripts/generar-api-doc.mjs), servido con
// la URL base del request para que los ejemplos apunten adonde corresponde.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { referenciaMarkdown } from '@/lib/api-mako/docs';
import { autenticar, esRespuesta } from '@/lib/api-mako/http';
import { APP_BASE_URL } from '@/lib/app-url';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const auth = await autenticar(req);
  if (esRespuesta(auth)) return auth;
  const base = new URL(req.url).origin || APP_BASE_URL;
  return new NextResponse(referenciaMarkdown(base), {
    status: 200,
    headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
