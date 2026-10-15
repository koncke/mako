// =============================================================================
// POST /api/landing-generator/pagar — el «Botón de pago» de una landing, cobrado por la pasarela
// =============================================================================
// Tanda 4 (14/10/2026). Lo postea el formulario del paso «nombre y email»
// (app/l/[slug]/pagar/[bloque], pago-pagina.ts): `slug`, `bloque` (el producto), `nombre`, `email` y
// el campo trampa. Lee la landing PUBLICADA y, con un candado por (negocio, email) tomado
// (`ejecutarPago`, lib/editor-landing/pago-pedido.ts): si hoy no se puede cobrar, deja una PROPUESTA de
// contacto (nunca una ficha); si se puede, busca el lead por email EXACTO o lo crea por el mismo camino
// que el opt-in, reusa el cobro pendiente que creó esta landing para ese email o crea uno
// (`crearCobro`, lib/cobros.ts) y redirige (303) al link /pagar/<token>, que lleva al checkout vivo.
//
// ⚠️ PÚBLICA Y DE ESCRITURA: va EXACTA en PUBLICOS (lib/rutas-publicas.ts). La abre un visitante sin
//    cuenta de MaKo, y por eso NO LEE NINGUNA COOKIE: el early-return del proxy saltea el chequeo de
//    Origin, así que acá se mira el Origin a mano (`origenDelPago`, en positivo) — y no es una server
//    action ni un formulario que postee a app/l/** (una página pública que acepta POST ejecuta server
//    actions sin sesión, AGENTS.md). En hola-mako.site es la ÚNICA ruta de /api que el proxy deja
//    pasar, sólo en POST y con un Origin ausente o de ese host (`decidirLandings`, origen-landings.ts).
// ⚠️ LO QUE NO SALE DEL PEDIDO: el workspace (sale de la landing), el monto, la moneda, el valor en
//    dólares y el alta de MaKo. El producto sí, y tiene que estar en la foto PUBLICADA.
// ⚠️ CADA LLAMADA PUEDE CREAR UN CHECKOUT EN EL STRIPE DEL CLIENTE: topes por IP y por email (en la
//    memoria de la instancia), campo trampa, y un techo por landing y hora contado en la BASE (mig 0276).
// La decisión entera (orden de las puertas, qué ve el visitante) vive en `responderPagoPost`
// (lib/editor-landing/pago-pagina.ts), con test; el cobro, en `pagarDesdeLanding`
// (lib/editor-landing/pago-landing-server.ts).
// Paquete 3 de la tanda 6: los rechazos de DESPUÉS de leer la landing (tope por email, techo, dominio
// ajeno, producto que la foto no ofrece) suman al contador del día de esa landing (`anotarRechazoDePago`,
// mig 0282); los de antes, al log. Y la campaña que volvió en el formulario llega al lead nuevo.
// =============================================================================
import type { NextRequest } from 'next/server';
import { APP_BASE_URL } from '@/lib/app-url';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { responderPagoPost } from '@/lib/editor-landing/pago-pagina';
import { anotarRechazoDePago, estadoCobroLanding, leerLandingDePago, pagarDesdeLanding, temaDelPaso } from '@/lib/editor-landing/pago-landing-server';
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
    rechazo: anotarRechazoDePago,
  });
}
