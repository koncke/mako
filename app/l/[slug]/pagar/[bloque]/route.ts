// =============================================================================
// GET /l/<slug>/pagar/<productoId> — el paso «nombre y email» antes del checkout (tanda 4)
// =============================================================================
// El «Botón de pago» de una landing publicada lleva acá (`<base del sitio>/pagar/<productoId>`,
// pago-landing.ts). Decisión de Martín (14/10/2026): antes del checkout se le piden NOMBRE y EMAIL a
// quien paga. El formulario postea a /api/landing-generator/pagar, que crea (o reusa) el lead y el
// cobro y redirige al link de pago. En hola-mako.site (la mudanza en curso) se sirve como
// /<slug>/pagar/<productoId>; el `[bloque]` es el PRODUCTO que cobra el botón.
//
// ⚠️ PÚBLICA Y SIN COOKIE, como las otras rutas de app/l: `/l` está en PUBLICOS (lib/rutas-publicas.ts)
//    como prefijo y, como no es /api/, el proxy la deja sólo en GET/HEAD/OPTIONS. Lee con el cliente
//    crudo por slug y el workspace sale de la FILA; nunca `getTenantDb` sin contexto (caería al ws1).
// ⚠️ EN EL DOMINIO DE UN CLIENTE el botón NO trae acá con el host del cliente: `conEnlacesDelDominio`
//    (dominios-reglas.ts) deja el pago en la base de MaKo, porque `decidirHost` contesta 404 a una ruta
//    de dos segmentos (revisión de la tanda 4, ALTA). Si algún día el proxy la deja pasar, sólo sirve
//    una landing de ESE dominio — el mismo corte que /l/html.
// La decisión entera (formas, 404 sin tocar la base, 503, el formulario) vive en `responderPasoPago`
// (lib/editor-landing/pago-pagina.ts), con test.
// =============================================================================
import type { NextRequest } from 'next/server';
import { APP_BASE_URL } from '@/lib/app-url';
import { responderPasoPago } from '@/lib/editor-landing/pago-pagina';
import { estadoCobroLanding, leerLandingDePago, temaDelPaso } from '@/lib/editor-landing/pago-landing-server';
import { HEADER_DOMINIO, hostDeCabecera } from '@/lib/editor-landing/dominios-reglas';
import { landingDeDominio } from '@/lib/editor-landing/dominios';

export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string; bloque: string }>;

export async function GET(req: NextRequest, ctx: { params: Params }) {
  const { slug, bloque } = await ctx.params;
  return responderPasoPago(req, { slug, bloque }, {
    appBaseUrl: APP_BASE_URL,
    landing: async () => {
      const l = await leerLandingDePago(slug);
      if (!l) return null;
      const crudo = req.headers.get(HEADER_DOMINIO);
      if (crudo == null) return l;
      const del = await landingDeDominio(hostDeCabecera(crudo));
      return del && del.docId === l.docId ? l : null;
    },
    detalle: async (l) => {
      const [estado, tema] = await Promise.all([estadoCobroLanding(l.ws), temaDelPaso(l.ws, l.temaId)]);
      return { estado, estiloTema: tema.estilo };
    },
  });
}

export async function HEAD(req: NextRequest, ctx: { params: Params }) {
  return GET(req, ctx);
}
