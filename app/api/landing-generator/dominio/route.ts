// =============================================================================
// /api/landing-generator/dominio — el dominio propio de una landing (T7)
// =============================================================================
// Pedido de Martín (11/10/2026), punto 10 de la tanda 2: publicar «con una URL creada por MaKo […]
// o la opción de traer tu dominio». Diseño: docs/diseno-editor-landing.md → T7. La lógica vive en
// lib/editor-landing/dominios.ts (Vercel, DNS, base) y dominios-reglas.ts (lo puro, con test).
//
// DOS TRABAJOS, DOS PUERTAS:
//
//   · POST — la pestaña «Dominios» del diálogo Publicar: `{ accion: 'estado' | 'conectar' | 'quitar', id, … }`
//     (`PedidoDominio`). LA PUERTA es la misma que la de /api/landing-generator: admin del workspace y
//     la tab en su capa (`tabEnCapa` mira la CAPA, no a la persona).
//
//   · GET/HEAD — la PÁGINA de una landing en su dominio. No se entra por acá con una URL: proxy.ts,
//     para un host que no es de MaKo, REESCRIBE `/` y `/<ruta>` a esta ruta con `?ruta=` y la cabecera
//     `HEADER_DOMINIO` puesta por él (una reescritura no vuelve a pasar por el proxy). Un GET directo a
//     hola-mako.com/api/… pasa por el gate (sesión) y `seguir` le BORRA esa cabecera: contesta 404.
//     Por eso NO va en PUBLICOS: no es una ruta pública, es el destino interno de un dominio de cliente.
//     Lee estricto (base caída → 503, nunca 404) y arma la página con la MISMA decisión que /l/<slug>
//     (`responderPublico` + `leerPublicado`).
//     Y EL PASO DE PAGO (Paquete 2 de la tanda 6: «El paso de pago no se sirve EN el dominio propio»):
//     `/pagar/<producto>` llega con `?ruta=pagar&bloque=<producto>` (`pedidoDelDominio`) y se arma con
//     la MISMA decisión que app/l/[slug]/pagar/[bloque] (`responderPasoPago`), sólo para la landing de
//     ESTE dominio. Su formulario postea relativo, a este host, y el proxy deja pasar ese POST.
//
// ¿Por qué el host → slug se resuelve acá y no en el proxy? Porque el proxy es SÍNCRONO y su forma es
// un contrato: tests/alumno-sesion.test.ts lo ejecuta y lee `.status` sin `await`. Una consulta a la
// base adentro lo volvía async para TODO pedido de la app.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getCapaActual, getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { conectarDominio, estadoDominio, landingDeDominio, quitarDominio, type LandingDeDominio, type ResultadoDominio } from '@/lib/editor-landing/dominios';
import { HEADER_DOMINIO, conEnlacesDelDominio, dominioValido, hostDeCabecera, pedidoDelDominio, urlDeDominio } from '@/lib/editor-landing/dominios-reglas';
import { leerPublicado } from '@/lib/editor-landing/publicar';
import { urlLandingEn } from '@/lib/editor-landing/origen-landings';
import { APP_BASE_URL, basesLandings } from '@/lib/app-url';
import { CACHE_ERROR, paginaNoDisponible, paginaNoEncontrada, responderPublico } from '@/lib/editor-landing/pagina-publica';
import { responderPasoPago } from '@/lib/editor-landing/pago-pagina';
import { estadoCobroLanding, leerLandingDePago, temaDelPaso } from '@/lib/editor-landing/pago-landing-server';

export const dynamic = 'force-dynamic';
// Conectar llama a Vercel tres veces (agregar, leer, config) con 15 s de plazo cada una, más el DNS.
export const maxDuration = 60;

async function puerta(): Promise<Response | null> {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (rol == null) return Response.json({ ok: false, error: 'no autenticado' }, { status: 401 });
  if (ws == null || rol !== 'admin') return Response.json({ ok: false, error: 'Solo el admin del negocio' }, { status: 403 });
  if (!tabEnCapa('landing-writer', await getCapaActual())) return Response.json({ ok: false, error: 'No existe' }, { status: 404 });
  return null;
}

export async function POST(req: NextRequest) {
  const cerrada = await puerta();
  if (cerrada) return cerrada;

  let body: Record<string, unknown>;
  try {
    const b = await req.json();
    if (!b || typeof b !== 'object') throw new Error('no es un objeto');
    body = b as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: 'body inválido' }, { status: 400 });
  }

  let r: ResultadoDominio;
  switch (body.accion) {
    case 'estado': r = await estadoDominio(body.id, { verificar: body.verificar === true }); break;
    case 'conectar': r = await conectarDominio(body.id, body.dominio); break;
    case 'quitar': r = await quitarDominio(body.id); break;
    default: return Response.json({ ok: false, error: 'Acción desconocida' }, { status: 400 });
  }
  if (r.ok) return Response.json(r);
  const { status, ...cuerpo } = r;
  return Response.json(cuerpo, { status });
}

function respuestaError(status: 404 | 503, sinCuerpo: boolean): Response {
  const headers: Record<string, string> = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': CACHE_ERROR, 'X-Robots-Tag': 'noindex, nofollow' };
  if (status === 503) headers['Retry-After'] = '30';
  return new Response(sinCuerpo ? null : status === 404 ? paginaNoEncontrada() : paginaNoDisponible(), { status, headers });
}

export async function GET(req: NextRequest) {
  const sinCuerpo = req.method.toUpperCase() === 'HEAD';
  const host = hostDeCabecera(req.headers.get(HEADER_DOMINIO));
  if (!dominioValido(host)) return respuestaError(404, sinCuerpo);
  const pedido = pedidoDelDominio(req.nextUrl.searchParams);
  if (!pedido) return respuestaError(404, sinCuerpo);

  let encontrado: LandingDeDominio | null;
  try {
    encontrado = await landingDeDominio(host);
  } catch (e) {
    console.error(`[l:dominio] no pude leer qué landing sirve ${host} (la base no contestó): ${e instanceof Error ? e.message : String(e)}`);
    return respuestaError(503, sinCuerpo);
  }
  if (!encontrado) return respuestaError(404, sinCuerpo);

  const { slug, docId } = encontrado;
  if (pedido.tipo === 'pago') {
    return responderPasoPago(req, { slug, bloque: pedido.producto }, {
      appBaseUrl: APP_BASE_URL,
      // La lectura por slug es la de app/l; sólo se sirve si es la landing de ESTE dominio (la caché host
      // → slug dura 60 s y el slug se puede liberar y tomar en el medio: el mismo corte que la página).
      landing: async () => {
        const l = await leerLandingDePago(slug);
        return l && l.docId === docId ? l : null;
      },
      detalle: async (l) => {
        const [estado, tema] = await Promise.all([estadoCobroLanding(l.ws), temaDelPaso(l.ws, l.temaId)]);
        return { estado, estiloTema: tema.estilo };
      },
    });
  }
  const ruta = pedido.ruta;
  // En el dominio, la canónica es la del dominio, y los enlaces entre páginas (que la foto trae con la
  // URL de MaKo) se reescriben al servir: `conEnlacesDelDominio` dice por qué no al publicar.
  const base = urlDeDominio(host);
  return responderPublico(req, { tipo: 'pagina', slug, ruta, base }, {
    leer: async () => {
      const sitio = await leerPublicado(slug, ruta);
      // La caché host → slug dura 60 s por instancia, y republicar puede cambiar el slug y liberar el
      // viejo: si OTRA landing lo tomó en el medio, la lectura por slug traería la suya. Sólo se sirve
      // la landing de ESTE dominio (revisión de la tanda 2, BAJA).
      if (!sitio || sitio.docId !== docId) return null;
      // Cada base donde la foto pudo quedar escrita: hola-mako.site (tanda 4) y hola-mako.com/l (antes).
      let html = sitio.pagina.html;
      for (const b of basesLandings()) html = conEnlacesDelDominio(html, urlLandingEn(b, slug), base);
      return { ...sitio, pagina: { ...sitio.pagina, html } };
    },
  });
}

export async function HEAD(req: NextRequest) {
  return GET(req);
}
