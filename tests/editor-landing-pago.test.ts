// =============================================================================
// El «Botón de pago» de una landing, cobrado por la pasarela de MaKo (tanda 4, 14/10/2026)
// =============================================================================
// Pedido: conectar el «Botón de pago» de las landings a la PASARELA DE MaKo (Stripe del negocio) en vez
// de que la persona pegue un link; antes del checkout se piden nombre y email (decisión de Martín). Lo
// que se fija acá, todo sin base:
//   · el destino guardado `pago:<productoId>` pasa por el MISMO `href` del botón (attrsBoton, saneo,
//     IA) y SÓLO por el botón;
//   · el render lo escribe con la base del sitio (`<base>/pagar/<id>`) sólo en la PUBLICADA;
//   · la foto congela los productos que la landing ofrece (y una sección oculta no ofrece nada);
//   · quién puede cobrar (Stripe; Mercado Pago no, por la moneda) y qué ve el editor antes de publicar;
//   · el formulario (trampa, nombre, email), el Origin en positivo, el lead por email EXACTO, el cobro
//     pendiente que se reusa;
//   · las dos respuestas (paso y POST), con dependencias falsas: el orden de las puertas.
// La rotura de cada guard, con números, al final.
// =============================================================================

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proyecto.supabase.co';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  avisoDeCobro, describirCobro, esHrefPago, hrefDePago, hrefPagoValido, motivoNoCobra, pasarelaDeLanding, precioDe,
  productoDeHref, productoDeSegmento, productosDeFoto, productosDePago, urlPasoPago, type EstadoCobroLanding,
} from '../lib/editor-landing/pago-landing';
import {
  CAMPO_TRAMPA, RUTA_POST_PAGO, cobroPendienteReusable, cobroReusable, creadoPorLanding, leadPorEmail, leerPedidoPago, origenDelPago,
} from '../lib/editor-landing/pago-pedido';
import {
  ORIGENES_CHECKOUT, paginaPasoPago, politicaPasoPago, responderPagoPost, responderPasoPago,
  type DepPagoPost, type LandingDelPaso, type ResultadoDelPago,
} from '../lib/editor-landing/pago-pagina';
import { attrsBoton, hrefPermitido, specBoton, htmlDeArbol } from '../lib/editor-landing/especificacion';
import { htmlDePagina } from '../lib/editor-landing/render';
import { sanearContenido } from '../lib/editor-landing/validar';
import { bloquesATarjeta, bloquesATarjetas, tarjetaABloques } from '../lib/editor-landing/ia-bloques';
import { temaPorId } from '../lib/editor-landing/temas';
import { NODO, urlPublica, type JsonNodo, type Pagina } from '../lib/editor-landing/doc';
import { CONFIG_DEFAULT } from '../lib/editor-landing/api-tipos';
import { conEnlacesDelDominio, decidirHost, urlDeDominio } from '../lib/editor-landing/dominios-reglas';

const APP = 'https://hola-mako.com';
const boton = (href: string, texto = 'Pagar ahora'): JsonNodo => ({ type: NODO.boton, attrs: { href, variante: 'primario', nuevaPestana: false }, content: [{ type: 'text', text: texto }] });
const botones = (...b: JsonNodo[]): JsonNodo => ({ type: NODO.botones, attrs: { alinea: 'izquierda' }, content: b });
const tarjeta = (contenido: JsonNodo[], attrs: Record<string, unknown> = {}): JsonNodo => ({ type: NODO.tarjeta, attrs: { id: `t${Math.random().toString(36).slice(2, 8)}`, ...attrs }, content: contenido });
const pagina = (tarjetas: JsonNodo[], ruta = ''): Pagina => ({ id: `p${ruta || 'inicio'}`, titulo: 'Inicio', ruta, doc: { type: 'doc', content: tarjetas } });
const hrefsDe = (html: string) => [...html.matchAll(/<a class="gm-boton"[^>]*?href="([^"]*)"/g)].map((m) => m[1]);

const ESTADO: EstadoCobroLanding = {
  conectadas: ['stripe'],
  productos: [
    { id: 12, nombre: 'Programa', tipo: 'unico', montoUsd: 990 },
    { id: 13, nombre: 'Mentoría', tipo: 'suscripcion', montoUsd: 49 },
    { id: 14, nombre: 'Sin precio', tipo: 'unico', montoUsd: null },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// El destino guardado
// ─────────────────────────────────────────────────────────────────────────────

test('pago:<id> se lee sólo con la forma exacta (un id positivo, sin ceros adelante)', () => {
  assert.equal(hrefDePago(12), 'pago:12');
  assert.equal(productoDeHref('pago:12'), 12);
  assert.equal(productoDeHref(' pago:7 '), 7);
  assert.equal(hrefPagoValido(' pago:7 '), 'pago:7');
  for (const malo of ['pago:0', 'pago:012', 'pago:-1', 'pago:1a', 'pago:', 'pago:12345678901', 'pagina:12', 'PAGO:12', 12, null]) {
    assert.equal(productoDeHref(malo), null, String(malo));
    assert.equal(esHrefPago(malo), false, String(malo));
  }
  assert.equal(productoDeSegmento('12'), 12);
  for (const malo of ['0', '012', 'abc', '1.5', '', '12/1']) assert.equal(productoDeSegmento(malo), null, malo);
});

test('el BOTÓN guarda pago:<id>; un enlace de texto, una imagen o la barra no (hrefPermitido no lo conoce)', () => {
  assert.equal(attrsBoton({ href: 'pago:12' }).href, 'pago:12');
  assert.equal(attrsBoton({ href: 'pago:0' }).href, '');
  assert.equal(attrsBoton({ href: 'https://pagar.ejemplo.com' }).href, 'https://pagar.ejemplo.com', 'el link pegado sigue andando');
  assert.equal(hrefPermitido('pago:12'), null, 'sólo el botón lo conoce: afuera no tendría quién lo resuelva');
});

test('el saneo conserva el botón de pago sin anotar un descarte (lo que se guarda abre igual)', () => {
  const r = sanearContenido({ v: 1, paginas: [pagina([tarjeta([botones(boton('pago:12'))])])] });
  const b = JSON.stringify(r.contenido);
  assert.match(b, /"href":"pago:12"/);
  assert.equal(r.descartes.filter((d) => /botón|destino/i.test(d)).length, 0, r.descartes.join(' | '));
});

test('«Editar con IA» devuelve el botón de pago TAL CUAL (antes volvía apuntando al formulario)', () => {
  const t = tarjeta([{ type: 'heading', attrs: { level: 2, variante: null }, content: [{ type: 'text', text: 'Comprar' }] }, botones(boton('pago:12'), boton('https://otro.com', 'Más'))]);
  const ida = tarjetaABloques(t);
  const vuelta = bloquesATarjeta(ida, { base: t });
  const hrefs: string[] = JSON.stringify(vuelta).match(/"href":"[^"]*"/g) ?? [];
  assert.ok(hrefs.includes('"href":"pago:12"'), hrefs.join(' '));
});

// Revisión de la tanda 4 (BAJA): un dígito cambiado por el modelo hacía que el botón cobrara OTRO producto.
test('«Editar con IA» no deja que el modelo cambie QUÉ producto cobra un botón (ni que invente uno)', () => {
  const hrefsDeNodo = (n: unknown): string[] => (JSON.stringify(n).match(/"href":"[^"]*"/g) ?? []).map((h) => h.slice(8, -1));
  const t = tarjeta([botones(boton('pago:12'))]);
  const cambiada = JSON.parse(JSON.stringify(tarjetaABloques(t)).replace('pago:12', 'pago:99'));
  const descartes: string[] = [];
  const vuelta = bloquesATarjeta(cambiada, { base: t, descartes });
  assert.ok(!hrefsDeNodo(vuelta).includes('pago:99'), hrefsDeNodo(vuelta).join(' '));
  assert.ok(descartes.some((d) => /pago:99/.test(d)), `queda escrito: ${descartes.join(' | ')}`);
  // Generar una landing (sin secciones originales): ningún botón nace cobrando.
  const nueva = bloquesATarjetas([tarjetaABloques(t)]);
  assert.ok(!hrefsDeNodo(nueva).some((h) => h.startsWith('pago:')), hrefsDeNodo(nueva).join(' '));
  // Sobre la landing entera, mover el botón a OTRA sección no es un producto nuevo.
  const otra = tarjeta([{ type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] }]);
  const [ida1, ida2] = [tarjetaABloques(t), tarjetaABloques(otra)];
  const movida = [{ ...ida1, bloques: [] }, { ...ida2, bloques: [...ida2.bloques, ...ida1.bloques] }];
  assert.ok(hrefsDeNodo(bloquesATarjetas(movida, { bases: [t, otra] })).includes('pago:12'));
});

// ─────────────────────────────────────────────────────────────────────────────
// El render: la base del sitio, y sólo en la publicada
// ─────────────────────────────────────────────────────────────────────────────

test('publicada: <base>/pagar/<id>, en la misma pestaña; vista previa y exportar: #; el editor: como se guardó', () => {
  const p = pagina([tarjeta([botones({ ...boton('pago:12'), attrs: { href: 'pago:12', variante: 'primario', nuevaPestana: true } }, boton('pagina:pgracias', 'Gracias'))])]);
  const tema = temaPorId('pewter');
  const paginas = [{ id: p.id, ruta: '' }, { id: 'pgracias', ruta: 'gracias' }];
  const base = `${APP}/l/mi-landing`;
  const publicada = htmlDePagina(p, CONFIG_DEFAULT, tema, { modo: 'publico', urlBase: base, paginas, pagos: true });
  assert.deepEqual(hrefsDe(publicada), [`${base}/pagar/12`, `${base}/gracias`], 'la MISMA base que el enlace a otra página');
  assert.doesNotMatch(publicada, /pagar\/12"[^>]*target="_blank"/, 'el camino de compra no abre otra pestaña');
  const vista = htmlDePagina(p, CONFIG_DEFAULT, tema, { modo: 'publico', urlBase: `${APP}/l/vista/tok`, paginas });
  assert.equal(hrefsDe(vista)[0], '#', 'el link privado no cobra');
  assert.doesNotMatch(vista, /pago:12/, 'un pago: crudo haría que el navegador busque una aplicación');
  const enEditor = htmlDeArbol(specBoton({ href: 'pago:12', variante: 'primario', nuevaPestana: false }), 'x');
  assert.match(enEditor, /href="pago:12"/, 'sin resolvedor se escribe como se guardó (como pagina:)');
  assert.equal(urlPasoPago('https://hola-mako.site/mi-landing/', 3), 'https://hola-mako.site/mi-landing/pagar/3');
});

test('la foto ofrece los productos de los botones de pago: sin repetir, ordenados, sin las secciones ocultas', () => {
  const paginas = [
    pagina([tarjeta([botones(boton('pago:13'), boton('pago:12'))]), tarjeta([botones(boton('pago:99'))], { oculta: true })]),
    pagina([tarjeta([{ type: NODO.columnas, attrs: {}, content: [{ type: NODO.columna, content: [botones(boton('pago:12'), boton('#'))] }] }])], 'oferta'),
  ];
  assert.deepEqual(productosDePago(paginas), [12, 13]);
  assert.deepEqual(productosDeFoto({ pagos: [12, 13, 12, -1, 'x', 0, 1.5] }), [12, 13]);
  assert.deepEqual(productosDeFoto({ paginas: [] }), [], 'una foto anterior a la tanda 4 no cobra nada');
});

// Revisión de la tanda 4 (ALTA): servida en un dominio propio, `conEnlacesDelDominio` reescribía también
// el botón de pago a `https://<dominio>/pagar/<id>`, y ahí el proxy contesta 404 (dos segmentos). El
// recorrido entero: publicar → servir en el dominio → lo que contesta el proxy a cada enlace.
test('en un dominio propio el botón de pago sigue en MaKo, y ningún enlace servido cae en un 404 del proxy', () => {
  const base = urlPublica(APP, 'mi-landing');
  const p = pagina([tarjeta([botones(boton('pago:12'), boton('pagina:pgracias', 'Gracias'))])]);
  const paginas = [{ id: p.id, ruta: '' }, { id: 'pgracias', ruta: 'gracias' }];
  const publicada = htmlDePagina(p, CONFIG_DEFAULT, temaPorId('pewter'), { modo: 'publico', urlBase: base, paginas, pagos: true });
  const servida = conEnlacesDelDominio(publicada, base, urlDeDominio('cliente-real.com'));
  assert.deepEqual(hrefsDe(servida), [urlPasoPago(base, 12), 'https://cliente-real.com/gracias'], 'el pago queda en MaKo; la página sí se muda al dominio');
  for (const h of hrefsDe(servida)) {
    const u = new URL(h);
    assert.notEqual(decidirHost(u.host, u.pathname, 'GET').tipo, 'no-existe', `${h}: el visitante vería un 404`);
  }
  // El paso postea relativo: servido en la base de MaKo, el POST cae en la app (no en el 404 del dominio).
  assert.deepEqual(decidirHost('hola-mako.com', RUTA_POST_PAGO, 'POST'), { tipo: 'app' });
  // Los bordes de la reescritura: una PÁGINA llamada «pagar» sí se muda; otra landing no se toca.
  const crudo = `<a href="${base}/pagar">x</a><a href="${base}/pagar/3">y</a><a href="${base}d/pagar/3">z</a>`;
  assert.equal(conEnlacesDelDominio(crudo, base, 'https://c.com'), `<a href="https://c.com/pagar">x</a><a href="${base}/pagar/3">y</a><a href="${base}d/pagar/3">z</a>`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Quién cobra, y qué dice el editor
// ─────────────────────────────────────────────────────────────────────────────

test('cobra Stripe; con sólo Mercado Pago no (moneda de su cuenta contra un catálogo en dólares)', () => {
  assert.equal(pasarelaDeLanding(['stripe', 'mercadopago']), 'stripe');
  assert.equal(pasarelaDeLanding(['mercadopago']), null);
  const prod = ESTADO.productos[0];
  assert.equal(motivoNoCobra({ conectadas: ['stripe'], producto: prod }), null);
  assert.equal(motivoNoCobra({ conectadas: ['mercadopago'], producto: prod }), 'solo-mercadopago');
  assert.equal(motivoNoCobra({ conectadas: [], producto: prod }), 'sin-pasarela');
  assert.equal(motivoNoCobra({ conectadas: ['stripe'], producto: null }), 'sin-producto');
  assert.equal(motivoNoCobra({ conectadas: ['stripe'], producto: ESTADO.productos[2] }), 'sin-precio');
  assert.equal(precioDe(ESTADO.productos[1]), 'US$ 49 por mes');
});

test('el rótulo del botón y el aviso de Publicar dicen QUÉ cobra y por qué no puede', () => {
  assert.deepEqual(describirCobro('pago:12', ESTADO), { texto: 'Cobra: Programa', motivo: null });
  assert.deepEqual(describirCobro('pago:77', ESTADO), { texto: 'Cobra: producto inactivo', motivo: 'sin-producto' });
  assert.deepEqual(describirCobro('pago:12', null), { texto: 'Cobro', motivo: null });
  assert.equal(describirCobro('https://x.com', ESTADO), null);
  const paginas = [pagina([tarjeta([botones(boton('pago:12'), boton('pago:14'))])])];
  assert.equal(avisoDeCobro(paginas, ESTADO)?.texto, 'Un botón de pago no cobra: Ese producto no tiene precio en el catálogo.');
  const sinStripe = avisoDeCobro(paginas, { ...ESTADO, conectadas: [] });
  assert.equal(sinStripe?.texto, '2 botones de pago no cobran: Conecta Stripe en Integraciones para cobrar.');
  assert.equal(sinStripe?.integraciones, true);
  assert.equal(avisoDeCobro([pagina([tarjeta([botones(boton('pago:12'))])])], ESTADO), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// El pedido del visitante
// ─────────────────────────────────────────────────────────────────────────────

const campos = (o: Record<string, string>) => new URLSearchParams(o);
const BUENO = { slug: 'mi-landing', bloque: '12', nombre: '  Ana   Pérez ', email: ' Ana.Perez@Mail.com ', [CAMPO_TRAMPA]: '' };

test('el formulario: forma, trampa, nombre y email, en ese orden', () => {
  assert.deepEqual(leerPedidoPago(campos(BUENO)), { ok: true, pedido: { slug: 'mi-landing', productoId: 12, nombre: 'Ana Pérez', email: 'ana.perez@mail.com' } });
  assert.deepEqual(leerPedidoPago(campos({ ...BUENO, slug: 'NO VALE' })), { ok: false, falla: 'forma' });
  assert.deepEqual(leerPedidoPago(campos({ ...BUENO, bloque: '012' })), { ok: false, falla: 'forma' });
  assert.deepEqual(leerPedidoPago(campos({ ...BUENO, [CAMPO_TRAMPA]: 'http://spam' })), { ok: false, falla: 'trampa' });
  const sinNombre = leerPedidoPago(campos({ ...BUENO, nombre: '\u0000  ' }));
  assert.equal(!sinNombre.ok && sinNombre.falla, 'nombre');
  const malEmail = leerPedidoPago(campos({ ...BUENO, email: 'ana@' }));
  assert.ok(!malEmail.ok && malEmail.falla === 'email' && malEmail.valores.nombre === 'Ana Pérez', 'vuelve lo escrito para no tipearlo de nuevo');
});

test('el Origin, en positivo: la app, los sitios, el deploy que contesta; un dominio propio vuelve para confirmar', () => {
  const op = { appBaseUrl: APP, propio: 'https://hola-mako.com' };
  assert.deepEqual(origenDelPago('https://hola-mako.com', op), { tipo: 'mako' });
  assert.deepEqual(origenDelPago('https://hola-mako.site', op), { tipo: 'mako' });
  assert.deepEqual(origenDelPago('https://www.hola-mako.com', op), { tipo: 'mako' });
  assert.deepEqual(origenDelPago('https://mako-abc.vercel.app', { appBaseUrl: APP, propio: 'https://mako-abc.vercel.app' }), { tipo: 'mako' });
  assert.equal(origenDelPago('https://cualquiera.vercel.app', op), null, 'un vercel.app ajeno no es MaKo');
  assert.deepEqual(origenDelPago('http://localhost:3000', { appBaseUrl: APP, propio: 'http://localhost:3000' }), { tipo: 'mako' });
  assert.equal(origenDelPago('http://localhost:3000', op), null);
  assert.deepEqual(origenDelPago('https://tunegocio.com', op), { tipo: 'dominio', host: 'tunegocio.com' });
  for (const malo of [null, '', 'null', 'http://tunegocio.com', 'https://tunegocio.com:8443', 'https://hola-mako.com/l/x', 'javascript:alert(1)', 'https://1.2.3.4']) {
    assert.equal(origenDelPago(malo, op), null, String(malo));
  }
});

test('el lead del email: igualdad EXACTA (el _ no es comodín), sin mayúsculas, y el más viejo si hay dos', () => {
  const cands = [{ id: 30, email: 'juanXperez@x.com' }, { id: 20, email: 'JUAN_PEREZ@x.com' }, { id: 9, email: ' juan_perez@x.com' }];
  assert.deepEqual(leadPorEmail(cands, 'juan_perez@x.com'), { id: 9, ambiguo: true });
  assert.deepEqual(leadPorEmail([{ id: 30, email: 'juanXperez@x.com' }], 'juan_perez@x.com'), null);
  assert.deepEqual(leadPorEmail([{ id: '5', email: 'a@b.co' }], 'A@B.CO'), { id: 5, ambiguo: false });
});

test('se reusa el pendiente del MISMO producto, pasarela y precio; nunca el de otro producto o con el precio viejo', () => {
  const b = { productoId: 12, pasarela: 'stripe' as const, monto: 990, moneda: 'USD', tipo: 'unico' as const, email: 'ana@x.com', slug: 'mi-landing' };
  const c = {
    estado: 'pendiente' as const, producto_id: 12, proveedor: 'stripe' as const, monto: 990, moneda: 'usd', tipo: 'unico' as const, token: 'a',
    email: 'Ana@X.com', alta_capa: null, creado_por: creadoPorLanding('Mi landing', 'mi-landing'),
  };
  assert.equal(cobroReusable(c, b), true);
  assert.equal(cobroReusable({ ...c, producto_id: 13 }, b), false);
  assert.equal(cobroReusable({ ...c, monto: 890 }, b), false);
  assert.equal(cobroReusable({ ...c, estado: 'pagado' }, b), false);
  assert.equal(cobroReusable({ ...c, proveedor: 'mercadopago' }, b), false);
  // La lista viene del más nuevo al más viejo, y el más nuevo es de OTRO producto (`cobroPendienteDelLead` lo devolvería).
  assert.equal(cobroPendienteReusable([{ ...c, producto_id: 13, token: 'nuevo' }, c], b)?.token, 'a');
  assert.equal(creadoPorLanding('  Mi oferta ', 'mi-oferta'), 'Landing «Mi oferta» (mi-oferta)');
});

// Revisión de la tanda 4 (BAJA): el lead se elige por un email que nadie verifica, así que reusar un
// pendiente que NO creó esta landing para este email le entregaba a quien tipeara el email de otro el
// token de un cobro del dueño (y, con alta de MaKo, el cambio de email de la cuenta).
test('sólo se reusa lo que creó ESTA landing para ESTE email, y nunca un cobro con alta de MaKo', () => {
  const b = { productoId: 12, pasarela: 'stripe' as const, monto: 990, moneda: 'USD', tipo: 'unico' as const, email: 'ana@x.com', slug: 'mi-landing' };
  const c = { estado: 'pendiente' as const, producto_id: 12, proveedor: 'stripe' as const, monto: 990, moneda: 'USD', tipo: 'unico' as const, email: 'ana@x.com', alta_capa: null, creado_por: creadoPorLanding('Mi landing', 'mi-landing') };
  assert.equal(cobroReusable(c, b), true);
  assert.equal(cobroReusable({ ...c, creado_por: creadoPorLanding('Otro título', 'mi-landing') }, b), true, 'cambiarle el título a la landing no huerfana su pendiente');
  assert.equal(cobroReusable({ ...c, creado_por: 'Martín Koncke' }, b), false, 'el que armó el dueño desde la ficha o la API');
  assert.equal(cobroReusable({ ...c, creado_por: null }, b), false);
  assert.equal(cobroReusable({ ...c, creado_por: creadoPorLanding('Mi landing', 'otra-landing') }, b), false, 'el de OTRA landing');
  assert.equal(cobroReusable({ ...c, alta_capa: 'pro' }, b), false, 'un alta de MaKo nunca sale de una landing');
  assert.equal(cobroReusable({ ...c, email: 'otra@x.com' }, b), false, 'otro email cargado en el checkout');
  assert.equal(cobroReusable({ ...c, email: null }, b), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// El HTML del paso
// ─────────────────────────────────────────────────────────────────────────────

test('el paso: un formulario sin JavaScript, que postea relativo, escapa todo, y la política nombra la cadena entera', () => {
  const html = paginaPasoPago({
    sitio: 'Mi <sitio>', appBaseUrl: APP, estiloTema: '--gm-fondo:#fff', fuentes: ['https://fonts.googleapis.com/css2?family=X', 'https://evil.com/x.css'],
    producto: { nombre: 'Curso "pro" <b>', precio: 'US$ 99' }, slug: 'mi-landing', productoId: 12, nota: 'Pago seguro con Stripe.',
    valores: { nombre: '"><script>x</script>', email: 'a@b.co' }, volver: '..',
  });
  assert.doesNotMatch(html, /<script/i, 'sin JavaScript (y lo escrito no se cuela)');
  assert.match(html, new RegExp(`<form method="post" action="${RUTA_POST_PAGO.replace(/\//g, '\\/')}"`));
  assert.match(html, /name="slug" value="mi-landing"/);
  assert.match(html, /name="bloque" value="12"/);
  assert.match(html, new RegExp(`name="${CAMPO_TRAMPA}"[^>]*tabindex="-1"`));
  // El campo trampa no puede llamarse como algo que un completador de formularios llena solo (se
  // llamaba `sitio_web`): un comprador real con autocompletado perdía el pago sin rastro.
  const trampa = /<input id="([^"]+)" name="([^"]+)"[^>]*tabindex="-1"/.exec(html);
  assert.ok(trampa, 'el campo trampa está');
  for (const nombre of [trampa![1], trampa![2]]) {
    assert.doesNotMatch(nombre, /web|url|site|sitio|pagina|company|empresa|name|nombre|mail|tel|phone|address|direcc|city|ciudad|zip|postal|codigo/i, nombre);
  }
  assert.match(html, /Curso &quot;pro&quot; &lt;b&gt;/);
  assert.match(html, /Mi &lt;sitio&gt;/);
  assert.doesNotMatch(html, /evil\.com/, 'fuentes sólo de Google');
  const p = politicaPasoPago(APP);
  assert.match(p, /default-src 'none'/);
  assert.doesNotMatch(p, /script-src/);
  const formAction = p.split('; ').find((d) => d.startsWith('form-action')) ?? '';
  for (const o of ["'self'", APP, 'https://checkout.stripe.com']) assert.ok(formAction.includes(o), `${o} en form-action: Chrome lo aplica a las REDIRECCIONES del envío`);
  assert.ok(ORIGENES_CHECKOUT.includes('https://checkout.stripe.com'));
});

// ─────────────────────────────────────────────────────────────────────────────
// Las respuestas
// ─────────────────────────────────────────────────────────────────────────────

const LANDING: LandingDelPaso = { ws: 7, docId: 40, slug: 'mi-landing', titulo: 'Mi landing', sitio: 'Mi sitio', temaId: 'pewter', fuentes: [], productos: [12, 14] };

test('el paso (GET): 404 sin tocar la base, 404 si la foto no lo ofrece, 503 con la base caída, el formulario si existe', async () => {
  let lecturas = 0;
  const dep = (l: LandingDelPaso | null | 'tira', estado = ESTADO) => ({
    appBaseUrl: APP,
    landing: async () => { lecturas++; if (l === 'tira') throw new Error('caída'); return l; },
    detalle: async () => ({ estado, estiloTema: null }),
  });
  const get = (slug: string, bloque: string, d = dep(LANDING), metodo = 'GET') => responderPasoPago(new Request('https://hola-mako.com/l/x/pagar/1', { method: metodo }), { slug, bloque }, d);

  assert.equal((await get('NO VALE', '12')).status, 404);
  assert.equal((await get('mi-landing', '012')).status, 404);
  assert.equal(lecturas, 0, 'lo que no puede existir no toca la base');
  assert.equal((await get('mi-landing', '13')).status, 404, 'la foto no ofrece el 13');
  assert.equal((await get('mi-landing', '12', dep(null))).status, 404);
  assert.equal((await get('mi-landing', '12', dep('tira'))).status, 503, '«no pude leer» no es «no existe»');
  const ok = await get('mi-landing', '12');
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('cache-control'), 'private, no-store');
  const html = await ok.text();
  assert.match(html, /Programa/);
  assert.match(html, /US\$ 990/);
  assert.match(html, /Pago seguro con Stripe\./);
  const sinStripe = await (await get('mi-landing', '12', dep(LANDING, { ...ESTADO, conectadas: [] }))).text();
  assert.match(sinStripe, /<form/, 'sin Stripe el formulario se muestra igual: el POST deja a la persona en el CRM');
  assert.doesNotMatch(sinStripe, /Pago seguro/);
  assert.equal((await get('mi-landing', '12', dep(LANDING, { ...ESTADO, productos: [] }))).status, 404, 'un producto inactivo no se ofrece');
  assert.equal(await (await get('mi-landing', '12', dep(LANDING), 'HEAD')).text(), '');
});

function post(cuerpo: Record<string, string>, op: { origin?: string | null; ip?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded' };
  const origin = op.origin === undefined ? 'https://hola-mako.com' : op.origin;
  if (origin) headers.origin = origin;
  return new Request('https://hola-mako.com/api/landing-generator/pagar', { method: 'POST', headers, body: new URLSearchParams(cuerpo).toString() });
}

function depPost(over: Partial<DepPagoPost> & { resultado?: ResultadoDelPago | 'tira' } = {}) {
  const llamadas = { pagar: 0, landing: 0, limites: [] as string[] };
  const dep: DepPagoPost = {
    appBaseUrl: APP,
    ip: '1.1.1.1',
    limitar: (clave) => { llamadas.limites.push(clave); return true; },
    landing: async () => { llamadas.landing++; return LANDING; },
    esDelDominio: async () => true,
    detalle: async () => ({ estado: ESTADO, estiloTema: null }),
    pagar: async () => {
      llamadas.pagar++;
      const r = over.resultado ?? { tipo: 'redirigir', url: 'https://hola-mako.com/pagar/TOKEN' };
      if (r === 'tira') throw new Error('stripe caído');
      return r;
    },
    ...over,
  };
  return { dep, llamadas };
}

test('el POST: 303 al link; y cada puerta corta antes de cobrar', async () => {
  const BIEN = { ...BUENO };
  {
    const { dep, llamadas } = depPost();
    const r = await responderPagoPost(post(BIEN), dep);
    assert.equal(r.status, 303);
    assert.equal(r.headers.get('location'), 'https://hola-mako.com/pagar/TOKEN');
    assert.deepEqual(llamadas.limites, ['landing-pagar:ip:1.1.1.1', 'landing-pagar:email:ana.perez@mail.com'], 'topes por IP y por email');
  }
  const corta = async (req: Request, over: Parameters<typeof depPost>[0], status: number, msg: string) => {
    const { dep, llamadas } = depPost(over);
    const r = await responderPagoPost(req, dep);
    assert.equal(r.status, status, msg);
    assert.equal(llamadas.pagar, 0, `${msg}: no se cobra`);
    return r;
  };
  await corta(post(BIEN), { limitar: (c) => !c.includes(':ip:') }, 429, 'tope por IP');
  await corta(post(BIEN), { limitar: (c) => !c.includes(':email:') }, 429, 'tope por email');
  await corta(post(BIEN, { origin: null }), {}, 403, 'sin Origin');
  await corta(post(BIEN, { origin: 'https://otro-sitio.vercel.app' }), {}, 403, 'Origin ajeno');
  await corta(post(BIEN, { origin: 'https://tunegocio.com' }), { esDelDominio: async () => false }, 403, 'un dominio propio de OTRA landing');
  await corta(post({ ...BIEN, [CAMPO_TRAMPA]: 'x' }), {}, 400, 'trampa');
  await corta(post({ ...BIEN, bloque: 'x' }), {}, 400, 'forma');
  await corta(post({ ...BIEN, bloque: '13' }), {}, 404, 'un producto que la foto PUBLICADA no ofrece');
  await corta(post(BIEN), { landing: async () => null }, 404, 'landing despublicada');
  await corta(post(BIEN), { landing: async () => { throw new Error('caída'); } }, 503, 'la base caída');
  const mal = await corta(post({ ...BIEN, email: 'ana@' }), {}, 400, 'email que no sirve');
  const html = await mal.text();
  assert.match(html, /Revisa tu email\./);
  assert.match(html, /value="Ana Pérez"/, 'lo que escribió vuelve');
  const grande = new Request('https://hola-mako.com/api/landing-generator/pagar', { method: 'POST', headers: { origin: APP, 'content-length': '9999' }, body: 'x' });
  await corta(grande, {}, 413, 'cuerpo grande');
  {
    const { dep } = depPost({ resultado: { tipo: 'no-disponible' } });
    const r = await responderPagoPost(post(BIEN), dep);
    assert.equal(r.status, 409);
    assert.match(await r.text(), /no está disponible/);
  }
  assert.equal((await responderPagoPost(post(BIEN), depPost({ resultado: { tipo: 'fallo' } }).dep)).status, 502);
  const caido = await responderPagoPost(post(BIEN), depPost({ resultado: 'tira' }).dep);
  assert.equal(caido.status, 503);
  assert.doesNotMatch(await caido.text(), /stripe caído/, 'el error real no llega al visitante');
});

// =============================================================================
// PROBADO ROMPIÉNDOLO (14/10/2026), una rotura por vez, corriendo ESTE archivo con
// tests/rutas-publicas.test.ts (base: 30 pass / 0 fail), con un arnés en el scratchpad que guarda el
// archivo en memoria, lo rompe, corre y lo reescribe (md5 igual antes y después; nunca `git checkout`).
// Resultado «pass / fail»:
//    1. attrsBoton sin `hrefPagoValido`                        → 26 / 4
//    2. el render lleva el pago también en la vista previa      → 29 / 1
//    3. el render sin resolver `pago:`                          → 29 / 1
//    4. el botón de pago abre en otra pestaña                   → 29 / 1
//    5. la IA sin `pago:` en `destinoBoton`                     → 29 / 1
//    6. la foto ofrece los productos de una sección oculta     → 29 / 1
//    7. Mercado Pago cobra desde la landing                     → 29 / 1
//    8. sin el campo trampa                                     → 28 / 2
//    9. cualquier host es un dominio propio (sin dominioValido) → 28 / 2
//   10. el lead de dos fichas: el más nuevo                     → 29 / 1
//   11. se reusa el pendiente de OTRO producto                  → 29 / 1
//   12. form-action sin el origen de la app                     → 29 / 1
//   13. lo escrito vuelve al formulario sin escapar             → 29 / 1
//   14. el paso lee la base con un slug imposible               → 29 / 1
//   15. el POST sin tope por email                              → 29 / 1
//   16. el POST cobra un producto que la foto no ofrece         → 29 / 1
//   17. el POST no mira que el dominio sea el de ESA landing    → 29 / 1
//   18. /api/landing-generator/pagar fuera de PUBLICOS          → 29 / 1 (rutas-publicas)
// Restaurado: 30 / 0. La primera versión del 9 sacaba un `if (esHostDeMako(host)) return null` propio
// y dio 30 / 0: era código muerto, porque `dominioValido` ya excluye los hosts de MaKo. Se borró el
// renglón y la rotura pasó a quitar `dominioValido` entero.
//
// REVISIÓN DE LA TANDA 4 (14/10/2026), mismo arnés, sólo ESTE archivo (base 16 / 0):
//   19. `conEnlacesDelDominio` sin el `(?!/pagar/)`: el pago se muda al dominio → 15 / 1
//   (base 17 / 0 desde acá)
//   20. `cobroReusable` sin `alta_capa == null`                              → 16 / 1
//   21. `cobroReusable` sin `esDeLaLanding` (reusa lo que armó el dueño)      → 16 / 1
//   22. `cobroReusable` sin comparar el email                                 → 16 / 1
//   23. `esDeLaLanding` por el texto entero (un título nuevo huerfana)        → 16 / 1
//   (desde acá con tests/editor-landing-ia-bloques.test.ts: base 34 / 0)
//   24. `destinoBoton` acepta cualquier `pago:` que devuelva el modelo         → 33 / 1
//   25. `bloquesATarjetas` con los cobros de CADA sección y no de todas        → 33 / 1
//   (desde acá con tests/editor-landing-pago-candado.test.ts: base 24 / 0)
//   26. el campo trampa vuelve a llamarse `sitio_web`                          → 23 / 1
//   27. su id vuelve a ser `pago-sitio`                                        → 23 / 1
// =============================================================================
