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
import { probarLanding } from '@/lib/editor-landing/prueba-landing-server';

export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string; ruta: string }>;

export async function GET(req: NextRequest, ctx: { params: Params }) {
  const { slug, ruta } = await ctx.params;
  // La prueba A/B (O18): con una corriendo, la rama de este visitante (lib/editor-landing/prueba-landing-servir.ts).
  let sitio: Awaited<ReturnType<typeof leerPublicado>> = null;
  return responderPublico(req, { tipo: 'pagina', slug, ruta }, {
    leer: async () => (sitio = await leerPublicado(slug, ruta)),
    probar: async () => (sitio ? probarLanding(sitio, ruta, req) : null),
  });
}

export async function HEAD(req: NextRequest, ctx: { params: Params }) {
  return GET(req, ctx);
}
