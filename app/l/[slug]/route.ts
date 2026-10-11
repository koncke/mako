// =============================================================================
// GET /l/<slug> — la página de INICIO de una landing publicada con el editor
// =============================================================================
// Pedido de Martín (11/10/2026): un editor de landings copiado de Gamma, que publique.
// Diseño: docs/diseno-editor-landing.md, D4.
//
// Un route handler y no una página: devuelve el HTML ENTERO de la foto publicada
// (`landing_docs.publicado`), sin pasar por el layout raíz — sin sidebar, sin los pollers
// de notificaciones (que a un visitante le tirarían 401 en bucle) y sin ningún <Suspense>
// que le esconda el contenido a quien no ejecuta JavaScript (AGENTS.md).
//
// ⚠️ PÚBLICA Y SIN COOKIE: `/l` está en PUBLICOS (lib/rutas-publicas.ts) y, como no es
// /api/, el proxy la deja sólo en GET/HEAD/OPTIONS. La foto se lee por slug con el cliente
// crudo (`leerPublicado`, lib/editor-landing/publicar.ts), NUNCA con `getTenantDb`: sin
// cookie, el workspace caería al ws1, que es un cliente.
//
// La decisión entera (404 sin enumerar, 503 si la base no contestó, 308 a minúsculas, ETag,
// noindex) vive en `responderPublico` (lib/editor-landing/pagina-publica.ts), con test.
// =============================================================================
import type { NextRequest } from 'next/server';
import { leerPublicado } from '@/lib/editor-landing/publicar';
import { responderPublico } from '@/lib/editor-landing/pagina-publica';

export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

export async function GET(req: NextRequest, ctx: { params: Params }) {
  const { slug } = await ctx.params;
  return responderPublico(req, { tipo: 'pagina', slug, ruta: '' }, { leer: () => leerPublicado(slug, '') });
}

export async function HEAD(req: NextRequest, ctx: { params: Params }) {
  return GET(req, ctx);
}
