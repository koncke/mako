// =============================================================================
// GET /pagar/<token> — el link de pago que se MANDA: lleva al checkout vivo de la pasarela
// =============================================================================
// Es el link que arma `linkDelCobro` (lib/cobros.ts) y que viaja por WhatsApp, email o la API. Es de
// MaKo y no del proveedor a propósito: la sesión de Stripe VENCE (24 h como mucho) y este link no;
// al abrirse, `urlParaPagar` devuelve la URL viva, o crea otra sesión si la de antes venció.
//
// Si el cobro ya no se puede pagar, una página CORTA que dice qué pasó y qué hacer. Nunca un 500
// pelado: quien abre esto es un comprador, no alguien que pueda leer un log.
//
// ⚠️ PÚBLICA (prefijo `/pagar` en lib/rutas-publicas.ts) y por eso:
//   · NO LEE NINGUNA COOKIE. La credencial es el token, y se valida (`esTokenCobro`) ANTES de ir a
//     la base: un segmento de 20 KB o con caracteres raros no hace una consulta.
//   · Cache-Control no-store: el destino cambia con el estado del cobro, y un 302 cacheado mandaría
//     a pagar algo que ya se pagó.
//   · HEAD no toca la pasarela: un bot que pide HEAD para armar una vista previa no tiene por qué
//     crear una sesión de checkout.

import type { NextRequest } from 'next/server';
import { esTokenCobro, NOMBRE_PASARELA, type Cobro } from '@/lib/cobros-tipos';
import { getCobroPorToken, linkDeRetorno, pasarelasConectadas, urlParaPagar } from '@/lib/cobros';
import { nombreDelNegocio } from '../acceso';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CABECERAS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  // El token es la credencial: que no viaje en el Referer a ningún lado.
  'Referrer-Policy': 'no-referrer',
} as const;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** La página corta. Colores fijos (no hay tema sin sesión) y legible sin JavaScript. */
function pagina(status: number, p: { negocio?: string | null; titulo: string; texto: string; boton?: { href: string; texto: string } }): Response {
  const negocio = p.negocio ? `<div class="negocio">${esc(p.negocio)}</div>` : '';
  const boton = p.boton ? `<a class="btn" href="${esc(p.boton.href)}">${esc(p.boton.texto)}</a>` : '';
  const html = `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><meta name="referrer" content="no-referrer">
<title>${esc(p.titulo)}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:#F4F6F9;color:#12151B;
       font:400 16px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  .card{max-width:460px;width:100%;background:#fff;border:1px solid #EAECF1;border-radius:16px;padding:32px 28px;text-align:center;
        box-shadow:0 1px 2px rgba(18,21,27,.04),0 8px 24px rgba(18,21,27,.06)}
  .negocio{font-weight:600;font-size:14px;color:#5B6472;margin-bottom:18px}
  h1{margin:0 0 10px;font-size:22px;line-height:1.25}
  p{margin:0;color:#5B6472}
  a.btn{display:inline-block;margin-top:22px;background:#2F6FED;color:#fff;text-decoration:none;font-weight:600;font-size:15px;
        padding:12px 24px;border-radius:10px}
</style></head><body>
<main class="card">${negocio}<h1>${esc(p.titulo)}</h1><p>${esc(p.texto)}</p>${boton}</main>
</body></html>`;
  return new Response(html, { status, headers: { ...CABECERAS, 'Content-Type': 'text/html; charset=utf-8' } });
}

const redirigir = (url: string) => new Response(null, { status: 302, headers: { ...CABECERAS, Location: url } });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const noExiste = () => pagina(404, { titulo: 'Este link de pago no existe', texto: 'Revisa que esté completo, o pídele uno nuevo a quien te lo mandó.' });
  const nuestro = () => pagina(503, { titulo: 'No pudimos abrir el pago', texto: 'Es un problema nuestro, no de tu tarjeta. Prueba de nuevo en unos minutos.' });
  if (!esTokenCobro(token)) return noExiste();

  let leido: Cobro | null;
  try {
    leido = await getCobroPorToken(token);
  } catch (e) {
    console.error('[pagar] no pude leer el cobro:', e instanceof Error ? e.message : e);
    return nuestro();
  }
  if (!leido) return noExiste();
  const c = leido;

  let r: Awaited<ReturnType<typeof urlParaPagar>>;
  try {
    r = await urlParaPagar(c);
  } catch (e) {
    // Lo que TIRA es nuestro (la base, el guardado de la sesión nueva): no se le echa a la pasarela.
    console.error(`[pagar] urlParaPagar del cobro ${c.id}:`, e instanceof Error ? e.message : e);
    return nuestro();
  }
  if ('url' in r) {
    // Sólo una URL https del proveedor: lo que viene de la base no se sigue a ciegas.
    if (/^https:\/\//i.test(r.url)) return redirigir(r.url);
    console.error(`[pagar] el cobro ${c.id} tiene una URL de checkout que no es https`);
    return nuestro();
  }

  const pasarela = NOMBRE_PASARELA[c.proveedor];
  const negocio = await nombreDelNegocio(c.workspace_id);
  const error = r.error;
  if (error === 'ya_pagado') return redirigir(linkDeRetorno(c.token));
  if (error === 'no_disponible') {
    return pagina(410, { negocio, titulo: 'Este link ya no está disponible', texto: 'Si todavía quieres pagar, pídele un link nuevo a quien te lo mandó.' });
  }
  // La pasarela: o el negocio la desconectó (es de él, y se dice), o el proveedor no contestó.
  const conectada = await pasarelasConectadas(c.workspace_id).then((ps) => ps.includes(c.proveedor)).catch(() => true);
  if (!conectada) {
    return pagina(503, { negocio, titulo: 'Este link no puede cobrar ahora', texto: `${negocio ?? 'El negocio'} desconectó ${pasarela}, así que el pago no se puede abrir. Pídele un link nuevo.` });
  }
  return pagina(503, { negocio, titulo: 'No pudimos abrir el pago', texto: `${pasarela} no abrió el pago en este momento. No se te cobró nada: prueba de nuevo en unos minutos.` });
}

/** Sin pasarela y sin base: un HEAD no tiene por qué abrir un checkout. */
export function HEAD() {
  return new Response(null, { status: 200, headers: { ...CABECERAS, 'Content-Type': 'text/html; charset=utf-8' } });
}
