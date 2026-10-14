// =============================================================================
// POST /api/landing-generator/pagar — el «Botón de pago» de una landing, cobrado por la pasarela
// =============================================================================
// Tanda 4 (14/10/2026). Lo postea el formulario del paso «nombre y email»
// (app/l/[slug]/pagar/[bloque], pago-pagina.ts): `slug`, `bloque` (el producto), `nombre`, `email` y
// el campo trampa. Lee la landing PUBLICADA, busca el lead por email EXACTO en ese workspace o lo crea
// por el mismo camino que el opt-in, reusa el cobro pendiente del mismo lead Y producto o crea uno
// (`crearCobro`, lib/cobros.ts) y redirige (303) al link /pagar/<token>, que lleva al checkout vivo.
//
// ⚠️ PÚBLICA Y DE ESCRITURA: va EXACTA en PUBLICOS (lib/rutas-publicas.ts). La abre un visitante sin
//    cuenta de MaKo, y por eso NO LEE NINGUNA COOKIE: el early-return del proxy saltea el chequeo de
//    Origin, así que acá se mira el Origin a mano (`origenDelPago`, en positivo) — y no es una server
//    action ni un formulario que postee a app/l/** (una página pública que acepta POST ejecuta server
//    actions sin sesión, AGENTS.md).
// ⚠️ LO QUE NO SALE DEL PEDIDO: el workspace (sale de la landing), el monto, la moneda, el valor en
//    dólares y el alta de MaKo. El producto sí, y tiene que estar en la foto PUBLICADA.
// ⚠️ CADA LLAMADA CREA UN CHECKOUT EN EL STRIPE DEL CLIENTE: topes por IP y por email, campo trampa.
// La decisión entera (orden de las puertas, qué ve el visitante) vive en `responderPagoPost`
// (lib/editor-landing/pago-pagina.ts), con test; el cobro, en `pagarDesdeLanding`
// (lib/editor-landing/pago-landing-server.ts).
// =============================================================================
import type { NextRequest } from 'next/server';
import { APP_BASE_URL } from '@/lib/app-url';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { responderPagoPost } from '@/lib/editor-landing/pago-pagina';
import { estadoCobroLanding, leerLandingDePago, pagarDesdeLanding, temaDelPaso } from '@/lib/editor-landing/pago-landing-server';
import { landingDeDominio } from '@/lib/editor-landing/dominios';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// Crear el checkout es un pedido a Stripe (con su plazo) más la base: holgado.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return responderPagoPost(req, {
    appBaseUrl: APP_BASE_URL,
    ip: clientIp(req),
    limitar: rateLimit,
    landing: leerLandingDePago,
    esDelDominio: async (host, docId) => (await landingDeDominio(host))?.docId === docId,
    detalle: async (l) => {
      const [estado, tema] = await Promise.all([estadoCobroLanding(l.ws), temaDelPaso(l.ws, l.temaId)]);
      return { estado, estiloTema: tema.estilo };
    },
    pagar: pagarDesdeLanding,
  });
}
