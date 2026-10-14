// =============================================================================
// editor-landing/pago-pagina — el HTML del paso «nombre y email» antes del checkout
// =============================================================================
// Tanda 4 (14/10/2026). Decisión de Martín: antes del checkout se le piden NOMBRE y EMAIL a quien
// paga. Lo sirve app/l/[slug]/pagar/[bloque]/route.ts (GET) y lo vuelve a dibujar con el error el POST
// de app/api/landing-generator/pagar (un campo que no sirve). Es un route handler con HTML entero,
// como las otras páginas de app/l (pagina-publica.ts): sin el layout raíz, sin sesión, sin JavaScript.
//
// LAS DECISIONES QUE NO SE VEN:
//   · CERO JavaScript: un <form method="post"> de verdad, con la validación nativa (`required`,
//     `type=email`). La política lo dice (`default-src 'none'` sin script-src): nada que ejecutar.
//   · `form-action` NOMBRA LA CADENA ENTERA: Chrome aplica `form-action` también a las REDIRECCIONES de
//     un envío, y éste rebota dos veces (303 del POST → /pagar/<token> de la app → el checkout de la
//     pasarela). Sin el origen de la app y el del checkout en la lista, el navegador corta el salto y
//     la persona se queda en una página en blanco con el pago a medio camino.
//   · El formulario postea a una ruta RELATIVA (`RUTA_POST_PAGO`): el mismo host que sirve el paso
//     (hola-mako.com/l en dev, hola-mako.site con la mudanza, el dominio propio cuando el proxy lo deje).
//   · El tema: las variables del tema de la landing van inline en el <body> (`estiloDeTema`), y la hoja
//     propia de acá las usa con un respaldo neutro. Es lo barato: no carga la hoja de 94 KB del contenido.
//   · El campo trampa (`CAMPO_TRAMPA`) va fuera de la pantalla, sin tab y sin autocompletar.
//
// PURO (sin base). ⚠️ No es apto para el navegador: importa pagina-publica.ts (node:crypto).
// =============================================================================

import { escaparHtml, paginaNoDisponible, paginaNoEncontrada, urlsDeFuentes } from './pagina-publica';
import { slugValido } from './doc';
import { motivoNoCobra, notaDePasarela, pasarelaDeLanding, precioDe, productoDeSegmento, type EstadoCobroLanding } from './pago-landing';
import {
  CAMPO_TRAMPA, RUTA_POST_PAGO, TEXTO_DEMASIADOS, TEXTO_FALLA_CAMPO, TEXTO_FALLO, TEXTO_NO_DISPONIBLE, TOPE_EMAIL, TOPE_NOMBRE,
  leerPedidoPago, origenDelPago, type LecturaPedidoPago, type PedidoPago,
} from './pago-pedido';

/** El pedido que volvió por un CAMPO (nombre o email): trae lo escrito para volver a dibujarlo. */
type FallaDeCampo = Extract<LecturaPedidoPago, { falla: 'nombre' | 'email' }>;

/** Los checkouts adonde termina la cadena de redirecciones (`form-action`). */
export const ORIGENES_CHECKOUT: readonly string[] = Object.freeze([
  'https://checkout.stripe.com',
  // Mercado Pago no cobra desde una landing hoy (pago-landing.ts, `pasarelaDeLanding`); su checkout va
  // igual en la lista para que el día que cobre no se corte en el último salto sin que nada lo diga.
  'https://www.mercadopago.com',
  'https://*.mercadopago.com.ar', 'https://*.mercadopago.com.mx', 'https://*.mercadopago.com.br',
  'https://*.mercadopago.cl', 'https://*.mercadopago.com.co', 'https://*.mercadopago.com.pe', 'https://*.mercadopago.com.uy',
]);

const origenDe = (url: string): string | null => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin : null;
  } catch {
    return null;
  }
};

/** La política del paso, directiva por directiva (va en un <meta>: ver pagina-publica.ts, punto 1). */
export function politicaPasoPago(appBaseUrl: string): string {
  const app = origenDe(appBaseUrl);
  const dir: Array<[string, string[]]> = [
    ['default-src', ["'none'"]],
    ['style-src', ["'unsafe-inline'", 'https://fonts.googleapis.com']],
    ['font-src', ['https://fonts.gstatic.com', 'data:']],
    ['img-src', ["'self'", 'data:']],
    ['form-action', ["'self'", ...(app ? [app] : []), ...ORIGENES_CHECKOUT]],
    ['base-uri', ["'none'"]],
  ];
  return dir.map(([k, v]) => `${k} ${[...new Set(v)].join(' ')}`).join('; ');
}

const CSS_PASO = [
  'html,body{margin:0;padding:0}',
  'body{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px;box-sizing:border-box;background:var(--gm-fondo,#f6f5f3);font-family:var(--gm-fuente-cuerpo,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif);color:var(--gm-texto,#272525);-webkit-text-size-adjust:100%}',
  '.caja{position:relative;width:100%;max-width:420px;box-sizing:border-box;background:var(--gm-tarjeta-color,#fff);border-radius:var(--gm-radio-tarjeta,16px);box-shadow:0 10px 30px rgba(0,0,0,.10);padding:28px 24px}',
  '.sitio{margin:0 0 6px;font-size:13px;color:var(--gm-texto-tenue,#6b6a68)}',
  'h1{margin:0;font-family:var(--gm-fuente-titulo,inherit);font-weight:var(--gm-peso-titulo,700);color:var(--gm-titulo,inherit);font-size:24px;line-height:1.2;overflow-wrap:anywhere}',
  '.precio{margin:6px 0 20px;font-size:18px;font-weight:600}',
  'label{display:block;font-size:14px;font-weight:600;margin:0 0 6px}',
  'input{display:block;width:100%;box-sizing:border-box;height:44px;padding:0 12px;margin:0 0 14px;border:1px solid var(--gm-borde-neutro,rgba(0,0,0,.18));border-radius:10px;background:transparent;color:inherit;font:inherit;font-size:16px}',
  'input:focus{outline:2px solid var(--gm-acento,#2c88f7);outline-offset:1px}',
  'button{display:block;width:100%;height:48px;margin-top:4px;border:0;border-radius:var(--gm-radio-boton,999px);background:var(--gm-boton,#111);color:var(--gm-boton-texto,#fff);font:inherit;font-weight:700;font-size:16px;cursor:pointer}',
  '.error{margin:0 0 14px;padding:10px 12px;border-radius:10px;background:rgba(220,38,38,.10);color:#b91c1c;font-size:14px}',
  '.nota{margin:14px 0 0;font-size:13px;color:var(--gm-texto-tenue,#6b6a68);text-align:center}',
  '.aviso{margin:8px 0 0;font-size:16px;color:var(--gm-texto-tenue,#6b6a68)}',
  '.volver{display:inline-block;margin-top:16px;font-size:14px;color:var(--gm-enlace,inherit)}',
  '.trampa{position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden}',
].join('\n');

/** Lo que comparten el paso y el aviso: el tema, las fuentes, adónde vuelve. */
type Marco = {
  /** El nombre del sitio (o el título de la landing): la línea chica de arriba. */
  sitio: string;
  /** `estiloDeTema(tema)` (temas.ts): las variables del tema, inline en el <body>. */
  estiloTema?: string | null;
  /** Las hojas de Google Fonts del tema (`foto.fuentes`). Sólo fonts.googleapis.com entra. */
  fuentes?: readonly string[] | string | null;
  /** «Volver»: '..' en el GET (la página de inicio del mismo sitio); el Referer validado en el POST. */
  volver?: string | null;
  appBaseUrl: string;
};

export type EntradaPasoPago = Marco & {
  producto: { nombre: string; precio: string | null };
  slug: string;
  productoId: number;
  /** «Pago seguro con Stripe.» — null si hoy no hay con qué cobrar (el POST lo dice al enviar). */
  nota: string | null;
  error?: string | null;
  valores?: { nombre?: string | null; email?: string | null };
};

export type EntradaAvisoPago = Marco & { titulo: string; texto: string | null };

const a = escaparHtml;

/** Un `volver` que se puede escribir: '..' o una URL http(s) absoluta. Lo demás no sale. */
function volverSano(v: string | null | undefined): string | null {
  if (!v) return null;
  if (v === '..') return v;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

function documento(m: Marco, titulo: string, cuerpo: string): string {
  const fuentes = urlsDeFuentes(m.fuentes ?? null);
  const head = [
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${a(politicaPasoPago(m.appBaseUrl))}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex, nofollow">',
    `<title>${a(titulo)}</title>`,
    ...fuentes.map((f) => `<link rel="stylesheet" href="${a(f)}">`),
    `<style>${CSS_PASO}</style>`,
  ];
  const estilo = typeof m.estiloTema === 'string' && m.estiloTema.trim() ? ` style="${a(m.estiloTema)}"` : '';
  const volver = volverSano(m.volver);
  return [
    '<!doctype html>',
    '<html lang="es">',
    '<head>',
    ...head,
    '</head>',
    `<body${estilo}>`,
    '<main class="caja">',
    m.sitio ? `<p class="sitio">${a(m.sitio)}</p>` : '',
    cuerpo,
    volver ? `<a class="volver" href="${a(volver)}">Volver</a>` : '',
    '</main>',
    '</body>',
    '</html>',
  ].filter(Boolean).join('\n');
}

/** El paso: el producto, su precio y el formulario de nombre y email. */
export function paginaPasoPago(e: EntradaPasoPago): string {
  const nombre = e.valores?.nombre ?? '';
  const email = e.valores?.email ?? '';
  const cuerpo = [
    `<h1>${a(e.producto.nombre)}</h1>`,
    e.producto.precio ? `<p class="precio">${a(e.producto.precio)}</p>` : '<p class="precio"></p>',
    `<form method="post" action="${a(RUTA_POST_PAGO)}" accept-charset="utf-8">`,
    e.error ? `<p class="error" role="alert">${a(e.error)}</p>` : '',
    `<input type="hidden" name="slug" value="${a(e.slug)}">`,
    `<input type="hidden" name="bloque" value="${a(String(e.productoId))}">`,
    `<label for="pago-nombre">Tu nombre</label>`,
    `<input id="pago-nombre" name="nombre" type="text" required maxlength="${TOPE_NOMBRE}" autocomplete="name" value="${a(nombre)}">`,
    `<label for="pago-email">Tu email</label>`,
    `<input id="pago-email" name="email" type="email" required maxlength="${TOPE_EMAIL}" autocomplete="email" inputmode="email" value="${a(email)}">`,
    `<div class="trampa" aria-hidden="true"><label for="pago-q7">No completes este campo</label><input id="pago-q7" name="${a(CAMPO_TRAMPA)}" type="text" tabindex="-1" autocomplete="off" value=""></div>`,
    '<button type="submit">Ir a pagar</button>',
    '</form>',
    e.nota ? `<p class="nota">${a(e.nota)}</p>` : '',
  ].filter(Boolean).join('\n');
  return documento(e, `Pagar · ${e.producto.nombre}`, cuerpo);
}

/** Un aviso corto en vez del formulario («no está disponible», «no pudimos abrir el pago»). */
export function paginaAvisoPago(e: EntradaAvisoPago): string {
  const cuerpo = `<h1>${a(e.titulo)}</h1>${e.texto ? `\n<p class="aviso">${a(e.texto)}</p>` : ''}`;
  return documento(e, e.titulo, cuerpo);
}

// ─────────────────────────────────────────────────────────────────────────────
// Las respuestas (la decisión entera, con test; las rutas sólo enchufan las lecturas)
// ─────────────────────────────────────────────────────────────────────────────

/** El paso no se guarda en ningún lado: el precio puede cambiar en el catálogo y lleva un formulario. */
export const CACHE_PASO = 'private, no-store';

/** Lo que el paso y el POST necesitan de la landing (es `LandingDePago` de pago-landing-server.ts). */
export type LandingDelPaso = { ws: number; docId: number; slug: string; titulo: string; sitio: string; temaId: string; fuentes: readonly string[]; productos: readonly number[] };
/** El catálogo, las pasarelas y el tema de la landing (`estadoCobroLanding` + `temaDelPaso`). */
export type DetalleDelPaso = { estado: EstadoCobroLanding; estiloTema: string | null };

function html(status: number, cuerpo: string | null): Response {
  return new Response(cuerpo, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': CACHE_PASO, 'X-Robots-Tag': 'noindex, nofollow' },
  });
}

export type DepPasoGet = {
  /** La landing PUBLICADA de ese slug (y de ESTE dominio, si viene por uno propio). null = no se sirve. Tira = la base falló. */
  landing: () => Promise<LandingDelPaso | null>;
  detalle: (l: LandingDelPaso) => Promise<DetalleDelPaso>;
  appBaseUrl: string;
};

/**
 * GET/HEAD del paso. Lo que no puede existir es 404 SIN tocar la base; la base caída, 503 (nunca 404);
 * un producto que la foto publicada no ofrece, 404; uno que ya no está activo en el catálogo, el aviso
 * corto. Si el producto existe pero hoy no se puede cobrar (sin Stripe, sin precio), el formulario se
 * muestra IGUAL y sin la nota de la pasarela: el POST deja a la persona en el CRM con el motivo en su
 * historial — alguien con la tarjeta en la mano no se pierde porque se desconectó una clave.
 */
export async function responderPasoPago(req: Request, pedido: { slug: string; bloque: string }, dep: DepPasoGet): Promise<Response> {
  const sinCuerpo = req.method.toUpperCase() === 'HEAD';
  const productoId = productoDeSegmento(pedido.bloque);
  if (!slugValido(pedido.slug) || productoId === null) return html(404, sinCuerpo ? null : paginaNoEncontrada());
  let landing: LandingDelPaso | null;
  let detalle: DetalleDelPaso;
  try {
    landing = await dep.landing();
    if (!landing || !landing.productos.includes(productoId)) return html(404, sinCuerpo ? null : paginaNoEncontrada());
    detalle = await dep.detalle(landing);
  } catch (e) {
    console.error(`[landing-pagar] no pude leer /l/${pedido.slug}/pagar/${productoId} (la base no contestó): ${e instanceof Error ? e.message : String(e)}`);
    return html(503, sinCuerpo ? null : paginaNoDisponible());
  }
  const marco = { sitio: landing.sitio, estiloTema: detalle.estiloTema, fuentes: landing.fuentes, volver: '..', appBaseUrl: dep.appBaseUrl };
  const producto = detalle.estado.productos.find((p) => p.id === productoId) ?? null;
  if (!producto) return html(404, sinCuerpo ? null : paginaAvisoPago({ ...marco, titulo: TEXTO_NO_DISPONIBLE, texto: null }));
  const motivo = motivoNoCobra({ conectadas: detalle.estado.conectadas, producto });
  const pasarela = pasarelaDeLanding(detalle.estado.conectadas);
  if (motivo) console.warn(`[landing-pagar] ws=${landing.ws} /l/${landing.slug} producto=${productoId} no cobra: ${motivo}`);
  return html(200, sinCuerpo ? null : paginaPasoPago({
    ...marco,
    producto: { nombre: producto.nombre, precio: precioDe(producto) },
    slug: landing.slug, productoId,
    nota: !motivo && pasarela ? notaDePasarela(pasarela) : null,
  }));
}

/** Lo que devuelve `pagarDesdeLanding` (pago-landing-server.ts), con la forma que esta decisión necesita. */
export type ResultadoDelPago = { tipo: 'redirigir'; url: string } | { tipo: 'no-disponible' } | { tipo: 'demasiados' } | { tipo: 'fallo' };

export type DepPagoPost = {
  appBaseUrl: string;
  landing: (slug: string) => Promise<LandingDelPaso | null>;
  /** ¿Ese dominio propio es el de ESA landing? (`landingDeDominio`). Tira = la base falló. */
  esDelDominio: (host: string, docId: number) => Promise<boolean>;
  detalle: (l: LandingDelPaso) => Promise<DetalleDelPaso>;
  pagar: (l: LandingDelPaso, p: PedidoPago) => Promise<ResultadoDelPago>;
  /** El limitador (lib/rate-limit.ts). Los tests pasan uno propio: el de memoria se comparte entre pedidos. */
  limitar: (clave: string, max: number, ventanaMs: number) => boolean;
  ip: string;
};

/** Un formulario de nombre y email no pesa más que esto. Lo de más no se lee. */
export const TOPE_CUERPO_PAGO = 4_000;
/** Los topes: por IP (quien prueba) y por email (quien repite). Cada intento crea un checkout en el Stripe del cliente. */
export const TOPE_IP = { max: 10, ventanaMs: 10 * 60_000 } as const;
export const TOPE_EMAIL_PEDIDOS = { max: 5, ventanaMs: 60 * 60_000 } as const;

/** El Referer, si es del MISMO origen que mandó el formulario (para el «Volver» del error). */
function volverDe(req: Request, origen: string | null): string | null {
  const r = req.headers.get('referer');
  if (!r || !origen) return null;
  try { return new URL(r).origin === origen ? r : null; } catch { return null; }
}

/**
 * POST del paso. El orden es el de las puertas, de la más barata a la más cara: tope por IP → tamaño
 * → Origin → forma y trampa (sin base) → la landing publicada (y su dominio) → el producto en la foto
 * → los campos (si fallan, el formulario de nuevo con el error y lo escrito) → tope por email → pagar.
 * Al visitante, siempre una frase corta; el motivo real queda en el historial del lead (lo escribe
 * `pagarDesdeLanding`) y en el log.
 */
export async function responderPagoPost(req: Request, dep: DepPagoPost): Promise<Response> {
  const aviso = (status: number, titulo: string, texto: string | null = null) =>
    html(status, paginaAvisoPago({ sitio: '', titulo, texto, appBaseUrl: dep.appBaseUrl }));

  if (!dep.limitar(`landing-pagar:ip:${dep.ip}`, TOPE_IP.max, TOPE_IP.ventanaMs)) return aviso(429, TEXTO_DEMASIADOS);
  const largo = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(largo) && largo > TOPE_CUERPO_PAGO) return aviso(413, TEXTO_FALLO);

  let propio: string | null = null;
  try { propio = new URL(req.url).origin; } catch { propio = null; }
  const origenCrudo = req.headers.get('origin');
  const origen = origenDelPago(origenCrudo, { appBaseUrl: dep.appBaseUrl, propio });
  if (!origen) return aviso(403, TEXTO_FALLO);

  let crudo = '';
  try { crudo = await req.text(); } catch { crudo = ''; }
  if (crudo.length > TOPE_CUERPO_PAGO) return aviso(413, TEXTO_FALLO);
  const lectura = leerPedidoPago(new URLSearchParams(crudo));
  // Dos casos que siguen: el pedido entero, o un CAMPO que no sirve (vuelve el formulario). TypeScript no
  // angosta la unión después de un `return`, así que cada uno va en su variable.
  let pedido: PedidoPago | null = null;
  let campoMal: FallaDeCampo | null = null;
  if (lectura.ok) pedido = lectura.pedido;
  else if (lectura.falla === 'nombre' || lectura.falla === 'email') campoMal = lectura;
  else {
    if (lectura.falla === 'trampa') console.warn('[landing-pagar] el campo trampa vino lleno: no se crea nada');
    return aviso(400, TEXTO_FALLO);
  }
  const slug = pedido ? pedido.slug : campoMal!.slug;
  const productoId = pedido ? pedido.productoId : campoMal!.productoId;

  let landing: LandingDelPaso | null;
  try {
    landing = await dep.landing(slug);
    if (landing && origen.tipo === 'dominio' && !(await dep.esDelDominio(origen.host, landing.docId))) return aviso(403, TEXTO_FALLO);
  } catch (e) {
    console.error(`[landing-pagar] no pude leer /l/${slug} (la base no contestó): ${e instanceof Error ? e.message : String(e)}`);
    return aviso(503, TEXTO_FALLO);
  }
  if (!landing || !landing.productos.includes(productoId)) return aviso(404, TEXTO_NO_DISPONIBLE);

  if (campoMal) {
    // Un campo que no sirve: el MISMO formulario, con el error y con lo que ya escribió.
    let detalle: DetalleDelPaso;
    try { detalle = await dep.detalle(landing); } catch { return aviso(503, TEXTO_FALLO); }
    const producto = detalle.estado.productos.find((p) => p.id === productoId) ?? null;
    if (!producto) return aviso(404, TEXTO_NO_DISPONIBLE);
    const pasarela = pasarelaDeLanding(detalle.estado.conectadas);
    const cobra = !motivoNoCobra({ conectadas: detalle.estado.conectadas, producto });
    return html(400, paginaPasoPago({
      sitio: landing.sitio, estiloTema: detalle.estiloTema, fuentes: landing.fuentes, appBaseUrl: dep.appBaseUrl,
      volver: volverDe(req, origenCrudo),
      producto: { nombre: producto.nombre, precio: precioDe(producto) }, slug: landing.slug, productoId,
      nota: cobra && pasarela ? notaDePasarela(pasarela) : null,
      error: TEXTO_FALLA_CAMPO[campoMal.falla], valores: campoMal.valores,
    }));
  }

  if (!dep.limitar(`landing-pagar:email:${pedido!.email}`, TOPE_EMAIL_PEDIDOS.max, TOPE_EMAIL_PEDIDOS.ventanaMs)) return aviso(429, TEXTO_DEMASIADOS);

  let r: ResultadoDelPago;
  try {
    r = await dep.pagar(landing, pedido!);
  } catch (e) {
    console.error(`[landing-pagar] /l/${slug} producto=${productoId}: ${e instanceof Error ? e.message : String(e)}`);
    return aviso(503, TEXTO_FALLO);
  }
  if (r.tipo === 'redirigir') return new Response(null, { status: 303, headers: { Location: r.url, 'Cache-Control': 'no-store' } });
  if (r.tipo === 'no-disponible') return aviso(409, TEXTO_NO_DISPONIBLE, 'Ya tenemos tus datos.');
  // El techo de la landing en la hora (contado en la base, `ejecutarPago`): no se escribió nada.
  if (r.tipo === 'demasiados') return aviso(429, TEXTO_DEMASIADOS);
  return aviso(502, TEXTO_FALLO);
}
