// =============================================================================
// GET /l/vista/<token>/<ruta> — otra página del BORRADOR (gracias, oferta…), por el link privado
// =============================================================================
// El link privado de la vista previa servía sólo la página de inicio: un botón «a la página de
// gracias» o el menú del sitio de un borrador llevaban a lo PUBLICADO (o a ninguna parte si no se
// publicó). `leerVistaPrevia` ya aceptaba la ruta y ahora renderiza los enlaces entre páginas
// contra `/l/vista/<token>` (lib/editor-landing/publicar.ts), así que las demás páginas viven acá.
//
// Mismo contrato que app/l/vista/[token]/route.ts: el token es la credencial entera, modo
// 'vista' (`noindex`, `private, no-store`, sin el Pixel de MaKo ni el Píxel de Meta) y la
// decisión entera en `responderPublico` (lib/editor-landing/pagina-publica.ts).
//
// ⚠️ PÚBLICA Y SIN COOKIE (`/l` en PUBLICOS, sólo GET/HEAD/OPTIONS por el proxy).
// =============================================================================
import type { NextRequest } from 'next/server';
import { leerVistaPrevia } from '@/lib/editor-landing/publicar';
import { responderPublico } from '@/lib/editor-landing/pagina-publica';

export const dynamic = 'force-dynamic';

type Params = Promise<{ token: string; ruta: string }>;

export async function GET(req: NextRequest, ctx: { params: Params }) {
  const { token, ruta } = await ctx.params;
  return responderPublico(req, { tipo: 'vista', token, ruta }, { leer: () => leerVistaPrevia(token, ruta) });
}

export async function HEAD(req: NextRequest, ctx: { params: Params }) {
  return GET(req, ctx);
}
