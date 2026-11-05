// =============================================================================
// POST /api/planes/comprar — el checkout público de un plan de MaKo (lib/compra-plan.ts)
// =============================================================================
// Lo postea el formulario de /planes/<plan> (nombre, email, WhatsApp, la pasarela si hay dos, el origen que mandó la landing y el
// código de MaKo Partners). Devuelve `{ link }` (/pagar/<token>, que lleva al checkout vivo) o el error para mostrar.
//
// ⚠️ PÚBLICA Y DE ESCRITURA: va EXACTA en PUBLICOS y PUBLICOS_ESCRITURA (lib/rutas-publicas.ts). NO LEE LA COOKIE DE
//    SESIÓN (el comprador no tiene cuenta): el workspace es el de la plataforma, siempre. Como el early-return del proxy
//    saltea el chequeo de Origin, acá se mira a mano y en positivo: sólo desde un host de MaKo (`origenDelPago`).
// ⚠️ CADA LLAMADA PUEDE CREAR UN CHECKOUT EN LA PASARELA DE MAKO: topes por IP y por email, campo trampa, y el link
//    vivo del mismo plan se reusa (lib/compra-plan.ts). La cookie del código de partner (`mako_ref`) sí se lee: no es de
//    sesión ni da permisos, sólo dice quién mandó el link.
// =============================================================================

import type { NextRequest } from 'next/server';
import { APP_BASE_URL } from '@/lib/app-url';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { origenDelPago } from '@/lib/editor-landing/pago-pedido';
import { TEXTO_CODIGO_NO_EXISTE, TEXTO_WHATSAPP_MAL, codigoQueCuenta, codigoRefLimpio, leerPedidoCompra, paisDelVisitante } from '@/lib/compra-plan-reglas';
import { esCodigoDePartner } from '@/lib/partners-programa';
import { iniciarCompraDePlan, pedirPlanSinPasarela } from '@/lib/compra-plan';
import { getSesionAdmin } from '@/lib/auth';
import { COOKIE_REF } from '@/lib/partners-reglas';

import { entornoPromo, promoVigente } from '@/lib/promo-entrada';
import { COOKIE_PROMO } from '@/lib/promo-entrada-reglas';
import { MINUTOS_DE_GRACIA } from '@/lib/primer-mes-reglas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

const HORA = 3600_000;

export async function POST(req: NextRequest) {
  const origen = origenDelPago(req.headers.get('origin'), { appBaseUrl: APP_BASE_URL, propio: req.nextUrl.origin });
  if (!origen || origen.tipo !== 'mako') return Response.json({ error: 'Origen no permitido.' }, { status: 403 });
  const ip = clientIp(req);
  if (!rateLimit(`planes-comprar:ip:${ip}`, 12, HORA)) return Response.json({ error: 'Demasiados intentos. Prueba en un rato.' }, { status: 429 });

  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: 'Pedido inválido.' }, { status: 400 }); }
  const leido = leerPedidoCompra(body);
  // El campo trampa: se contesta como un éxito vacío para que el bot no aprenda nada, y no se crea nada.
  if (!leido.ok) return leido.bot ? Response.json({ ok: true }) : Response.json({ error: leido.error }, { status: 400 });
  const pedido = leido.pedido;
  if (!rateLimit(`planes-comprar:email:${pedido.email}`, 6, HORA)) return Response.json({ error: 'Demasiados intentos con ese email. Prueba en un rato.' }, { status: 429 });
  if (pedido.whatsappEscritoMal) return Response.json({ error: TEXTO_WHATSAPP_MAL, campo: 'whatsapp' }, { status: 400 });
  // El código de partner (`codigoDeLaCompra`): el que escribió en el carrito; si no, el PRIMERO que lo trajo (revisión del
  // 23/10, media 14: la cookie que dejó /r/<código> gana sobre el `?ref=`). Uno escrito que no es de ningún partner se le dice
  // (no se guarda un código que nunca va a contar); si no se pudo leer, la compra sigue con él y el cron no lo cuenta.
  if (pedido.codigoEscritoMal) return Response.json({ error: TEXTO_CODIGO_NO_EXISTE, campo: 'codigo' }, { status: 400 });
  if (pedido.codigoEscrito && !(await esCodigoDePartner(pedido.codigoEscrito).catch(() => true))) {
    return Response.json({ error: TEXTO_CODIGO_NO_EXISTE, campo: 'codigo' }, { status: 400 });
  }
  // El que trajo un link (la cookie, después el `?ref=`) se guarda sólo si es de un partner (28/10/2026, `codigoQueCuenta`); si no
  // se pudo leer, vale la cookie (la validó /r/<código>) y el `?ref=` crudo no.
  const refQueCuenta = await codigoQueCuenta({ escrito: pedido.codigoEscrito, cookie: codigoRefLimpio(req.cookies.get(COOKIE_REF)?.value), url: pedido.ref }, esCodigoDePartner);

  // «Lo quiero» sin pasarela (24/10/2026, sin Calendly): el pedido queda en el CRM de MaKo, con el plan, el origen y el
  // código de partner, y se da de alta a mano (lib/compra-plan.ts, `pedirPlanSinPasarela`). No abre ningún pago.
  if (pedido.quiero) {
    const q = await pedirPlanSinPasarela({ ...pedido, ref: refQueCuenta });
    return q.ok ? Response.json({ ok: true, pedido: true }) : Response.json({ error: q.error }, { status: q.status });
  }
  // Con las claves de PRUEBA conectadas, sólo el super admin compra (la prueba de humo): ver `ofertaDelPlan`. Mercado Pago,
  // sólo desde su país (27/10/2026: desde México rechazaba el pago); el país lo pone Vercel, no el formulario.
  const r = await iniciarCompraDePlan({ ...pedido, ref: refQueCuenta }, {
    conPrueba: (await getSesionAdmin().catch(() => null)) != null,
    // El reloj del 50% (la cookie de lib/promo-entrada.ts). Con el interruptor de Landings apagado, siempre false: precio normal.
    promoVigente: promoVigente(req.cookies.get(COOKIE_PROMO)?.value, Date.now() - (pedido.promo ? MINUTOS_DE_GRACIA * 60_000 : 0), entornoPromo()),
    pais: paisDelVisitante(req.headers.get('x-vercel-ip-country')),
  });
  if (!r.ok) return Response.json({ error: r.error, ...(r.elegir ? { elegir: r.elegir } : {}), ...(r.sinPrueba ? { sinPrueba: true } : {}), ...(r.sinPromo ? { sinPromo: true } : {}) }, { status: r.status });
  // Sin pasarela para su país (5/11/2026): lo que escribió quedó como pedido, como el «Quiero» de arriba.
  if ('pedido' in r) return Response.json({ ok: true, pedido: true });
  return Response.json({ ok: true, link: r.link });
}
