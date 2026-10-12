// =============================================================================
// GET /l/<slug>/<ruta> — otra página de una landing publicada (gracias, oferta…)
// =============================================================================
// Gamma Sites es multipágina, y el editor también (doc.ts: `Pagina.ruta`, un segmento como
// el slug). Mismo contrato que app/l/[slug]/route.ts —público, sin cookie, HTML entero,
// GET/HEAD— y la misma decisión en `responderPublico` (lib/editor-landing/pagina-publica.ts).
//
// ⚠️ `/l/vista/<token>` NO llega acá: el segmento estático `vista` le gana al dinámico
// `[slug]` (app/l/vista/[token]/route.ts). Por eso `vista` tiene que ser un slug reservado.
// =============================================================================
import type { NextRequest } from 'next/server';
import { leerPublicado } from '@/lib/editor-landing/publicar';
import { responderPublico } from '@/lib/editor-landing/pagina-publica';

export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string; ruta: string }>;

export async function GET(req: NextRequest, ctx: { params: Params }) {
  const { slug, ruta } = await ctx.params;
  return responderPublico(req, { tipo: 'pagina', slug, ruta }, { leer: () => leerPublicado(slug, ruta) });
}

export async function HEAD(req: NextRequest, ctx: { params: Params }) {
  return GET(req, ctx);
}
