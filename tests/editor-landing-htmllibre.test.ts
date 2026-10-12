// =============================================================================
// El «HTML personalizado» servido desde su propia URL y «Replicar en el editor» (tanda 2, T6)
// =============================================================================
// Lo que fija este archivo (lib/editor-landing/html-libre.ts, replicar-reglas.ts y sus enchufes en
// especificacion.ts, render.ts, validar.ts, pagina-publica.ts y app/l/html/[docId]/[bloque]):
//   · en la PUBLICADA el bloque sale con `src="/l/html/<doc>/<id>"` y el sandbox de T6 (su JS corre),
//     y en el editor, las miniaturas y la exportación sigue con `srcdoc`;
//   · la ruta: sólo para un IFRAME (`Sec-Fetch-Dest`), formas validadas ANTES de leer, 404 sin
//     enumerar, 503 si la base falla, la política `sandbox`, `noindex`, caché del navegador con ETag;
//   · el alto: el script de adentro avisa y frena; el de la página acepta SÓLO de su iframe, con los
//     mismos topes que `altoDeMensaje`;
//   · el id del bloque: estable y DETERMINISTA (la vista previa sanea en cada pedido);
//   · la copia fiel: se parte por secciones conservando los envoltorios, se van los rastreadores, y
//     si no entra se copia entera o se dice que no entra.
//
// PROBADO ROMPIÉNDOLO: ver el bloque al final, con los números.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Script, createContext, runInContext } from 'node:vm';
import {
  ALTO_MAX, ALTO_MIN, CABECERAS_HTML_LIBRE, CSP_HTML_LIBRE, MENSAJE_ALTO, SANDBOX_PUBLICO, SCRIPT_ALTO, TEXTO_PIDE_CONTRASENA,
  altoDeMensaje, documentoHtmlLibre, etagHtmlLibre, fuentesHtmlLibre, htmlDeBloque, htmlLibreDeFoto, pideContrasena,
  responderHtmlLibre, urlBloqueHtmlLibre,
} from '../lib/editor-landing/html-libre';
import {
  MAX_SECCIONES_FIEL, PRESUPUESTO_FIEL, absolutizarUrls, baseDeDocumento, contenidoDeCopiaFiel, copiaFiel, esRastreador,
  headLimpio, modoReplicar, nodosDeNivel, partirCuerpo, urlParaReplicar,
} from '../lib/editor-landing/replicar-reglas';
import { specHtmlLibre, htmlDeArbol } from '../lib/editor-landing/especificacion';
import { htmlDeFragmento } from '../lib/editor-landing/render';
import { sanearContenido } from '../lib/editor-landing/validar';
import { NODO, TOPES, slugValido, type JsonNodo, type LandingContenido } from '../lib/editor-landing/doc';
import { SCRIPT_PAGINA, politicaDeContenido } from '../lib/editor-landing/pagina-publica';
import { esPublica, esPublicaSoloLeer } from '../lib/rutas-publicas';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const TOKEN = 'A'.repeat(43);

// ─────────────────────────────────────────────────────────────────────────────
// La URL, el sandbox y la política
// ─────────────────────────────────────────────────────────────────────────────

test('la URL de un bloque: relativa, con el token del borrador, y null si algo no tiene la forma', () => {
  assert.equal(urlBloqueHtmlLibre(12, 'h1abc'), '/l/html/12/h1abc');
  assert.equal(urlBloqueHtmlLibre('12', 'h1abc', TOKEN), `/l/html/12/h1abc?vista=${TOKEN}`);
  for (const [doc, id, tok] of [[0, 'h1'], ['012', 'h1'], [12, 'h 1'], [12, '../x'], [12, 'h1', 'corto'], [12, 'a'.repeat(61)]] as const) {
    assert.equal(urlBloqueHtmlLibre(doc, id, tok as string | undefined), null, `${doc} ${id} ${tok}`);
  }
});

test('la política del bloque: sandbox de T6 sin allow-same-origin, todo adentro, y sólo el mismo host lo enmarca', () => {
  assert.equal(SANDBOX_PUBLICO, 'allow-scripts allow-forms allow-popups');
  assert.ok(CSP_HTML_LIBRE.startsWith(`sandbox ${SANDBOX_PUBLICO};`));
  assert.match(CSP_HTML_LIBRE, /default-src \* data: blob: 'unsafe-inline' 'unsafe-eval'/);
  assert.match(CSP_HTML_LIBRE, /frame-ancestors 'self'/);
  assert.doesNotMatch(CSP_HTML_LIBRE, /allow-same-origin|allow-top-navigation/);
  assert.deepEqual(CABECERAS_HTML_LIBRE.map((c) => c.key), ['X-Frame-Options', 'Content-Security-Policy']);
  assert.equal(CABECERAS_HTML_LIBRE[0].value, 'SAMEORIGIN');
});

test('html-libre.ts sólo importa ./doc y nada de node (lo importan render.ts en el navegador y next.config.ts)', () => {
  const src = sinComentarios(leer('lib/editor-landing/html-libre.ts'));
  const imports = [...src.matchAll(/^import[^;]*from\s+'([^']+)'/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['./doc']);
  assert.doesNotMatch(src, /server-only|['"]node:|require\(/);
});

test('`html` es un slug reservado: app/l/html es una carpeta fija', () => {
  assert.equal(slugValido('html'), false);
});

test('/l/html entra sin sesión y sólo para leer', () => {
  assert.equal(esPublica('/l/html/12/h1abc'), true);
  assert.equal(esPublicaSoloLeer('/l/html/12/h1abc'), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// La forma HTML: src en la publicada, srcdoc en lo demás
// ─────────────────────────────────────────────────────────────────────────────

const BLOQUE = { id: 'h1abc', html: '<b>hola</b><script>x()</script>', alto: 300 };

test('en la publicada con la landing conocida: iframe con src y el sandbox de T6, SIN srcdoc', () => {
  const h = htmlDeArbol(specHtmlLibre(BLOQUE, { modo: 'publico', srcHtmlLibre: (id) => urlBloqueHtmlLibre(12, id) }));
  assert.match(h, /<iframe sandbox="allow-scripts allow-forms allow-popups" src="\/l\/html\/12\/h1abc"/);
  assert.doesNotMatch(h, /srcdoc/);
  assert.doesNotMatch(h, /allow-same-origin/);
});

test('sin la landing, sin id o fuera de la publicada: srcdoc como siempre (exportar, editor, renderHTML)', () => {
  const sinLanding = htmlDeArbol(specHtmlLibre(BLOQUE, { modo: 'publico' }));
  const sinId = htmlDeArbol(specHtmlLibre({ ...BLOQUE, id: null }, { modo: 'publico', srcHtmlLibre: (id) => urlBloqueHtmlLibre(12, id) }));
  const editor = htmlDeArbol(specHtmlLibre(BLOQUE, { modo: 'editor', srcHtmlLibre: (id) => urlBloqueHtmlLibre(12, id) }));
  for (const h of [sinLanding, sinId, editor]) {
    assert.match(h, /<iframe sandbox="allow-scripts" srcdoc="/);
    assert.doesNotMatch(h, / src="/);
  }
  // El srcdoc es el HTML CRUDO (copiar y pegar no acumula el script del alto).
  assert.doesNotMatch(editor, /gm-html-alto/);
});

test('render: `htmlLibre` en las opciones pone la URL del bloque (y la del borrador con su token)', () => {
  const sec: JsonNodo = { type: NODO.tarjeta, attrs: { id: 't1' }, content: [{ type: NODO.htmlLibre, attrs: BLOQUE }] };
  assert.match(htmlDeFragmento(sec, { modo: 'publico', htmlLibre: { docId: 12 } }), /src="\/l\/html\/12\/h1abc"/);
  assert.match(htmlDeFragmento(sec, { modo: 'publico', htmlLibre: { docId: 12, vista: TOKEN } }), new RegExp(`src="/l/html/12/h1abc\\?vista=${TOKEN}"`));
  assert.doesNotMatch(htmlDeFragmento(sec, { modo: 'exportar', htmlLibre: { docId: 12 } }), / src="/);
});

// ─────────────────────────────────────────────────────────────────────────────
// El id del bloque y el tope (validar.ts)
// ─────────────────────────────────────────────────────────────────────────────

const landing = (bloques: Record<string, unknown>[][], ocultas: number[] = []): unknown => ({
  v: 1,
  paginas: [{ id: 'p1', titulo: 'Inicio', ruta: '', doc: { type: 'doc', content: bloques.map((b, i) => ({ type: NODO.tarjeta, attrs: { id: `t${i}`, oculta: ocultas.includes(i) }, content: b.map((attrs) => ({ type: NODO.htmlLibre, attrs })) })) } }],
});
const idsHtml = (c: LandingContenido): string[] => {
  const out: string[] = [];
  const walk = (n: JsonNodo) => { if (n.type === NODO.htmlLibre) out.push(String(n.attrs?.id)); (n.content ?? []).forEach(walk); };
  c.paginas.forEach((p) => p.doc.content.forEach(walk));
  return out;
};

test('sin id: el saneo le pone uno DETERMINISTA (mismo contenido, mismo id) y sin motivo', () => {
  const raw = landing([[{ html: '<b>a</b>' }, { html: '<b>b</b>' }], [{ html: '<b>c</b>' }]]);
  const a = sanearContenido(raw), b = sanearContenido(JSON.parse(JSON.stringify(raw)));
  const ids = idsHtml(a.contenido);
  assert.equal(ids.length, 3);
  assert.deepEqual(idsHtml(b.contenido), ids, 'la vista previa y la ruta del bloque tienen que encontrar el mismo id');
  assert.equal(new Set(ids).size, 3);
  for (const id of ids) assert.match(id, /^h[a-z0-9]+(-\d+)?$/);
  assert.equal(a.descartes.filter((d) => d.includes('HTML personalizado')).length, 0, 'un bloque nuevo sin id no es un error');
});

test('un id válido se conserva; uno repetido se regenera con motivo', () => {
  const r = sanearContenido(landing([[{ id: 'hA', html: 'x' }], [{ id: 'hA', html: 'y' }]]));
  const ids = idsHtml(r.contenido);
  assert.equal(ids[0], 'hA');
  assert.notEqual(ids[1], 'hA');
  assert.ok(r.descartes.some((d) => /repetido «hA»/.test(d)));
});

test('el tope del HTML personalizado es ~400 KB: justo entra, uno más queda vacío', () => {
  assert.equal(TOPES.htmlLibre, 400_000);
  const justo = sanearContenido(landing([[{ id: 'h1', html: 'x'.repeat(TOPES.htmlLibre) }]]));
  const pasado = sanearContenido(landing([[{ id: 'h1', html: 'x'.repeat(TOPES.htmlLibre + 1) }]]));
  const html = (c: LandingContenido) => (c.paginas[0].doc.content[0].content?.[0].attrs as { html: string }).html;
  assert.equal(html(justo.contenido).length, TOPES.htmlLibre);
  assert.equal(html(pasado.contenido), '');
});

// ─────────────────────────────────────────────────────────────────────────────
// De dónde sale el HTML de un bloque
// ─────────────────────────────────────────────────────────────────────────────

test('la foto guarda { id: html } sin las secciones ocultas; el borrador se busca igual', () => {
  const c = sanearContenido(landing([[{ id: 'h1', html: 'uno' }], [{ id: 'h2', html: 'oculto' }], [{ id: 'h3', html: '' }]], [1])).contenido;
  assert.deepEqual(fuentesHtmlLibre(c.paginas), { h1: 'uno' });
  assert.equal(htmlDeBloque(c, 'h1'), 'uno');
  assert.equal(htmlDeBloque(c, 'h2'), null, 'una sección oculta no se sirve');
  assert.equal(htmlLibreDeFoto({ htmlLibre: { h1: 'uno' } }, 'h1'), 'uno');
  assert.equal(htmlLibreDeFoto({ paginas: [] }, 'h1'), null, 'una foto de antes de T6 no tiene bloques que servir');
});

// ─────────────────────────────────────────────────────────────────────────────
// El documento servido y el alto
// ─────────────────────────────────────────────────────────────────────────────

test('el documento: doctype si falta, base con destino si falta, y el script del alto AL FINAL', () => {
  const d = documentoHtmlLibre('<p>hola</p>');
  assert.ok(d.startsWith('<!doctype html>'));
  assert.match(d, /<base target="_blank">/);
  assert.ok(d.lastIndexOf('<script>') > d.indexOf('<p>hola</p>'));
  const conTodo = documentoHtmlLibre('<!DOCTYPE html><html><head><base href="https://a.com/" target="_self"></head><body>x</body></html>');
  assert.equal((conTodo.match(/<!doctype/gi) ?? []).length, 1, 'un solo doctype');
  assert.doesNotMatch(conTodo, /<base target="_blank">/, 'ya tenía un base con destino');
  assert.doesNotThrow(() => new Script(SCRIPT_ALTO));
  assert.doesNotMatch(SCRIPT_ALTO, /`|\$\{|<\/script/i);
});

/** Corre el script del alto en una ventana de mentira y devuelve los mensajes que mandó. */
function correrScriptAlto(alturas: number[]) {
  // Lo que se manda se copia por JSON: un objeto nacido en el contexto de `vm` no es deep-equal a uno de acá.
  const enviados: unknown[] = [];
  let i = 0;
  const oyentes: Record<string, Array<() => void>> = {};
  const timers: Array<() => void> = [];
  let ahora = 1_000;
  const de = { getBoundingClientRect: () => ({ height: alturas[Math.min(i, alturas.length - 1)] }) };
  const document = { documentElement: de, body: { scrollHeight: 0, offsetHeight: 0 }, addEventListener: (t: string, f: () => void) => { (oyentes[t] ??= []).push(f); } };
  const window = {
    parent: { postMessage: (m: unknown, destino: string) => { assert.equal(destino, '*'); enviados.push(JSON.parse(JSON.stringify(m))); } },
    addEventListener: (t: string, f: () => void) => { (oyentes[t] ??= []).push(f); },
    setTimeout: (f: () => void) => { timers.push(f); },
  };
  runInContext(SCRIPT_ALTO, createContext({ window, document, Date: { now: () => ahora }, Math }));
  return {
    enviados,
    medirOtraVez: (paso = 1, avanzaMs = 10) => { i += paso; ahora += avanzaMs; for (const f of oyentes.load ?? []) f(); },
  };
}

test('el script del alto: avisa el alto, no repite el mismo, y frena un contenido que crece sin fin', () => {
  const s = correrScriptAlto([500, 500, 640]);
  assert.deepEqual(s.enviados, [{ tipo: MENSAJE_ALTO, alto: 500 }]);
  s.medirOtraVez();
  assert.equal(s.enviados.length, 1, 'mismo alto: no avisa');
  s.medirOtraVez();
  assert.deepEqual(s.enviados.at(-1), { tipo: MENSAJE_ALTO, alto: 640 });
  // Un `height: 120vh`: crece en cada medición. En 3 segundos, más de 25 avisos y para.
  const loco = correrScriptAlto(Array.from({ length: 100 }, (_, k) => 300 + k * 50));
  for (let k = 0; k < 60; k++) loco.medirOtraVez(1, 10);
  assert.equal(loco.enviados.length, 25);
});

test('altoDeMensaje: sólo el mensaje del bloque, topeado', () => {
  assert.equal(altoDeMensaje({ tipo: MENSAJE_ALTO, alto: 480.4 }), 480);
  assert.equal(altoDeMensaje({ tipo: MENSAJE_ALTO, alto: 2 }), ALTO_MIN);
  assert.equal(altoDeMensaje({ tipo: MENSAJE_ALTO, alto: 1e9 }), ALTO_MAX);
  for (const m of [null, 'gm-html-alto', { tipo: 'otro', alto: 300 }, { tipo: MENSAJE_ALTO, alto: 'mucho' }]) assert.equal(altoDeMensaje(m), null);
});

/** Corre SCRIPT_PAGINA con una ventana que escucha `message` y dos iframes de mentira. */
function correrOyenteDelAlto() {
  const oyentes: Record<string, Array<(ev: unknown) => void>> = {};
  const ventanaA = {}, ventanaB = {};
  const iframes = [{ contentWindow: ventanaA, style: { height: '300px' } }, { contentWindow: ventanaB, style: { height: '300px' } }];
  const document = {
    addEventListener: () => {},
    body: { getAttribute: () => null },
    documentElement: { classList: { add: () => {} } },
    querySelectorAll: (sel: string) => (sel === '.gm-html iframe' ? iframes : []),
  };
  const window = { addEventListener: (t: string, f: (ev: unknown) => void) => { (oyentes[t] ??= []).push(f); }, location: { href: 'https://hola-mako.com/l/x' } };
  runInContext(SCRIPT_PAGINA, createContext({ document, window, URL }));
  const mandar = (source: unknown, data: unknown) => { for (const f of oyentes.message ?? []) f({ source, data }); };
  return { iframes, ventanaA, ventanaB, mandar, oyentes };
}

test('la página publicada ajusta el alto SÓLO del iframe que mandó, con los mismos topes', () => {
  const o = correrOyenteDelAlto();
  assert.equal(o.oyentes.message?.length, 1, 'escucha `message`');
  o.mandar(o.ventanaB, { tipo: MENSAJE_ALTO, alto: 812 });
  assert.equal(o.iframes[1].style.height, '812px');
  assert.equal(o.iframes[0].style.height, '300px', 'el otro iframe no se toca');
  o.mandar({}, { tipo: MENSAJE_ALTO, alto: 999 });
  assert.equal(o.iframes[1].style.height, '812px', 'una ventana que no es de un bloque no mueve nada');
  o.mandar(o.ventanaA, { tipo: 'otro', alto: 999 });
  assert.equal(o.iframes[0].style.height, '300px');
  // Los mismos topes que altoDeMensaje (un string que se sirve no lo puede importar).
  for (const alto of [1, 24, 480.6, 20_000, 1e9]) {
    o.mandar(o.ventanaA, { tipo: MENSAJE_ALTO, alto });
    assert.equal(o.iframes[0].style.height, `${altoDeMensaje({ tipo: MENSAJE_ALTO, alto })}px`, `alto ${alto}`);
  }
});

test('la política de la página deja enmarcar al mismo host (el bloque vive en /l/html)', () => {
  const p = politicaDeContenido({ entorno: { appBaseUrl: 'https://hola-mako.com', prefijoBucket: null }, conPixel: false, conMeta: false });
  const frame = p.split('; ').find((d) => d.startsWith('frame-src ')) ?? '';
  assert.ok(frame.split(' ').includes("'self'"), frame);
});

// ─────────────────────────────────────────────────────────────────────────────
// La respuesta de la ruta
// ─────────────────────────────────────────────────────────────────────────────

/** Un pedido como lo hace el iframe de la página: `Sec-Fetch-Dest: iframe` (lo pone el navegador). */
const pedir = (url = 'https://hola-mako.com/l/html/12/h1', init: RequestInit = {}, destino: string | null = 'iframe') => {
  const headers = new Headers(init.headers);
  if (destino) headers.set('sec-fetch-dest', destino);
  return new Request(url, { ...init, headers });
};

test('la ruta: si no lo pide un IFRAME (una pestaña, un fetch, sin la cabecera) → 403 SIN leer', async () => {
  // Abierto como pestaña, sin la política sandbox (next.config la tapa), el HTML del cliente correría
  // con el origen de MaKo y la sesión de quien abre el link.
  let lecturas = 0;
  const leerAlgo = async () => { lecturas++; return '<script>robar()</script>'; };
  const pedido = { docId: '12', bloque: 'h1', vista: null };
  for (const destino of ['document', 'empty', null]) {
    const r = await responderHtmlLibre(pedir(undefined, {}, destino), pedido, { leer: leerAlgo });
    assert.equal(r.status, 403, String(destino));
    assert.doesNotMatch(await r.text(), /robar/);
  }
  assert.equal(lecturas, 0);
  assert.equal((await responderHtmlLibre(pedir(), pedido, { leer: leerAlgo })).status, 200);
});

test('la ruta: forma inválida → 404 SIN leer; null → 404; la base cae → 503', async () => {
  let lecturas = 0;
  const leerNada = async () => { lecturas++; return 'x'; };
  for (const p of [{ docId: 'abc', bloque: 'h1', vista: null }, { docId: '12', bloque: 'h/1', vista: null }, { docId: '12', bloque: 'h1', vista: 'corto' }]) {
    assert.equal((await responderHtmlLibre(pedir(), p, { leer: leerNada })).status, 404, JSON.stringify(p));
  }
  assert.equal(lecturas, 0, 'una forma que no puede existir no toca la base');
  assert.equal((await responderHtmlLibre(pedir(), { docId: '12', bloque: 'h1', vista: null }, { leer: async () => null })).status, 404);
  const caida = await responderHtmlLibre(pedir(), { docId: '12', bloque: 'h1', vista: null }, { leer: async () => { throw new Error('base caída'); } });
  assert.equal(caida.status, 503);
  assert.equal(caida.headers.get('cache-control'), 'no-store');
});

test('la ruta: 200 con el documento, la política sandbox, noindex y caché del navegador con ETag (304 si ya lo tiene)', async () => {
  const pedido = { docId: '12', bloque: 'h1', vista: null };
  const r = await responderHtmlLibre(pedir(), pedido, { leer: async () => '<p>hola</p>' });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-security-policy'), CSP_HTML_LIBRE);
  assert.equal(r.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(r.headers.get('cache-control'), 'private, no-cache', 'privada: la respuesta depende de Sec-Fetch-Dest');
  assert.equal(r.headers.get('vary'), 'Sec-Fetch-Dest');
  assert.match(r.headers.get('content-type') ?? '', /^text\/html/);
  const cuerpo = await r.text();
  assert.equal(cuerpo, documentoHtmlLibre('<p>hola</p>'));
  assert.equal(r.headers.get('etag'), etagHtmlLibre(cuerpo));
  const otra = await responderHtmlLibre(pedir(undefined, { headers: { 'if-none-match': r.headers.get('etag')! } }), pedido, { leer: async () => '<p>hola</p>' });
  assert.equal(otra.status, 304);
  const cabeza = await responderHtmlLibre(pedir(undefined, { method: 'HEAD' }), pedido, { leer: async () => '<p>hola</p>' });
  assert.equal(await cabeza.text(), '');
});

// Revisión de la tanda 2 (12/10/2026, MEDIA): un login copiado y servido en hola-mako.com es phishing
// con nuestra barra de direcciones. Es un FRENO (un script puede armar la palabra por partes): lo de
// fondo es un dominio aparte para el contenido de usuarios, anotado en docs/hallazgos-editor-landing.md.
test('pideContrasena: el campo de contraseña en HTML o armado por script; la palabra suelta no', () => {
  for (const h of [
    '<form><input type="password" name="p"></form>', '<INPUT TYPE=PASSWORD>', "<input name=x type = 'password'>",
    '<script>const i = document.createElement("input"); i.type = "password";</script>',
    "<script>el.setAttribute('type', 'password')</script>", '<script>h({ type: "password" })</script>',
  ]) assert.equal(pideContrasena(h), true, h);
  for (const h of [
    '<p>¿Olvidaste tu password?</p>', '<input type="text" name="password">', '<input type="passwordless">', '', null, 12,
  ]) assert.equal(pideContrasena(h), false, String(h));
});

test('la ruta: un bloque que pide una contraseña no se sirve (451, sin caché, y sin su HTML)', async () => {
  const pedido = { docId: '12', bloque: 'h1', vista: null };
  const r = await responderHtmlLibre(pedir(), pedido, { leer: async () => '<form action="https://evil.tld"><input type="password"></form>' });
  assert.equal(r.status, 451);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('content-security-policy'), CSP_HTML_LIBRE);
  const cuerpo = await r.text();
  assert.equal(cuerpo, TEXTO_PIDE_CONTRASENA);
  assert.doesNotMatch(cuerpo, /evil/);
  // El link de la vista previa también se comparte: el borrador tampoco.
  assert.equal((await responderHtmlLibre(pedir(), { ...pedido, vista: TOKEN }, { leer: async () => '<input type=password>' })).status, 451);
});

test('publicar: un bloque HTML que pide una contraseña no se publica', () => {
  const src = sinComentarios(leer('lib/editor-landing/publicar.ts'));
  const pub = src.slice(src.indexOf('export async function publicar('), src.indexOf('export async function despublicar('));
  const iFoto = pub.indexOf('const foto = armarFoto(');
  const iGuard = pub.indexOf('if (Object.values(foto.htmlLibre ?? {}).some(pideContrasena)) return falla(');
  const iUpdate = pub.indexOf(".update({ publicado: foto");
  assert.ok(iFoto > 0 && iGuard > iFoto && iUpdate > iGuard, 'después de armar la foto y antes de escribirla');
});

test('la ruta: el borrador por el token va sin caché compartida', async () => {
  const r = await responderHtmlLibre(pedir(), { docId: '12', bloque: 'h1', vista: TOKEN }, { leer: async () => 'x' });
  assert.equal(r.headers.get('cache-control'), 'private, no-store');
});

test('app/l/html/[docId]/[bloque]/route.ts: sólo GET/HEAD, sin sesión, la decisión en responderHtmlLibre', () => {
  const src = sinComentarios(leer('app/l/html/[docId]/[bloque]/route.ts'));
  const exportados = [...src.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(\w+)/g)].map((m) => m[1]).sort();
  assert.deepEqual(exportados, ['GET', 'HEAD', 'dynamic']);
  assert.doesNotMatch(src, /next\/headers|cookies\(|getTenantDb|getSesion|getWorkspaceActual/);
  assert.match(src, /responderHtmlLibre\(/);
  // Sin el token, la foto PUBLICADA; con el token, el borrador de ESA landing.
  assert.match(src, /\.eq\('vista_token', token\)/);
  assert.match(src, /sitio_activo/);
});

// Integración de la tanda 2 (11/10/2026): el PEDIDO se aplicó y el `todo` se fue. La misma regla vale
// para la página de afuera del Diagnóstico (T5), que también se sirve a un iframe con sandbox.
// Probado rompiéndolo: el bloque de /l/html movido ANTES del global → 1 fallo; el del Diagnóstico
// borrado → 1 fallo; restaurado → verde.
test('next.config.ts pone las cabeceras del bloque en /l/html (y en la página del Diagnóstico), DESPUÉS del bloque global', () => {
  const cfg = sinComentarios(leer('next.config.ts'));
  const global = cfg.indexOf("source: '/:path*'");
  assert.match(cfg, /import \{ CABECERAS_HTML_LIBRE \} from "\.\/lib\/editor-landing\/html-libre"/);
  for (const ruta of ['/l/html/:path*', '/api/landing-generator/diagnostico/pagina']) {
    const propio = cfg.indexOf(`source: '${ruta}'`);
    assert.ok(propio > global && global >= 0, `el bloque de ${ruta} va después del global (gana el último)`);
    assert.match(cfg.slice(propio, propio + 200), /headers:\s*\[\s*\.\.\.CABECERAS_HTML_LIBRE\s*\]|headers:\s*CABECERAS_HTML_LIBRE/);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Replicar: la copia fiel
// ─────────────────────────────────────────────────────────────────────────────

const PAGINA = `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><title>Mi oferta &amp; más</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'self'">
<meta http-equiv="refresh" content="5;url=/otra">
<base href="/raiz/">
<link rel="stylesheet" href="/css/app.css">
<style>.wrap > section { padding: 40px }</style>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XYZ"></script>
<script>!function(f,b,e,v,n,t,s){}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','123');</script>
</head>
<body class="home">
<div class="wrap" data-x="a > b">
  <!-- comentario con <section> adentro -->
  <section id="hero"><h1>Vende más</h1><p>Texto del hero con <a href="/agenda">un enlace</a>.</p></section>
  <div class="espacio"></div>
  <section id="beneficios"><h2>Beneficios</h2><ul><li>Uno<li>Dos</ul><script>var s = "<div>no es un div</div>";</script></section>
  <section id="cta"><img src="foto.jpg"><button>Agenda</button></section>
</div>
<script src="/js/app.js"></script>
<noscript><img src="https://www.facebook.com/tr?id=123&ev=PageView"></noscript>
</body></html>`;

test('urlParaReplicar y modoReplicar: http(s) con dominio; los dos modos', () => {
  assert.equal(urlParaReplicar('ejemplo.com/landing'), 'https://ejemplo.com/landing');
  for (const u of ['', 'javascript:alert(1)', 'ftp://a.com', 'localhost', 'a b.com', 42]) assert.equal(urlParaReplicar(u), null, String(u));
  assert.equal(modoReplicar('fiel'), 'fiel');
  assert.equal(modoReplicar('bloques'), 'bloques');
  assert.equal(modoReplicar('otro'), null);
});

test('el recorrido de etiquetas respeta comillas, comentarios, scripts y elementos sin cerrar', () => {
  const s = '<div title="a > b"><p>x<p>y</div><!-- <div> --><script>if (a < b) "</div>";</script><img src=x><section>z</section>';
  const els = nodosDeNivel(s).filter((n) => n.tipo === 'el').map((n) => (n as { tag: string }).tag);
  assert.deepEqual(els, ['div', 'script', 'img', 'section']);
  // Un script ADENTRO de una sección que escribe el cierre de esa sección en una cadena: no la cierra.
  const s2 = '<section><script>var x = "</section>";</script><p>y</p></section><div>z</div>';
  assert.deepEqual(nodosDeNivel(s2).filter((n) => n.tipo === 'el').map((n) => (n as { tag: string }).tag), ['section', 'div']);
});

test('copia fiel: una sección por parte, con los envoltorios, el head limpio y el base a la página', () => {
  const c = copiaFiel(PAGINA, 'https://ejemplo.com/oferta');
  assert.ok(c.ok);
  if (!c.ok) return;
  assert.equal(c.titulo, 'Mi oferta & más');
  assert.equal(c.partida, true);
  assert.equal(c.documentos.length, 3, 'hero · beneficios (con el espaciador pegado adelante) · cta');
  for (const d of c.documentos) {
    assert.match(d, /<base href="https:\/\/ejemplo\.com\/raiz\/">/, 'el base de la página, resuelto');
    assert.match(d, /<div class="wrap" data-x="a > b">/, 'el envoltorio viaja: `.wrap > section` sigue valiendo');
    assert.match(d, /<link rel="stylesheet" href="https:\/\/ejemplo\.com\/css\/app\.css">/, 'la hoja, ABSOLUTA (el srcdoc del editor no respeta el base)');
    assert.match(d, /<script src="https:\/\/ejemplo\.com\/js\/app\.js"><\/script>/, 'el script suelto va en todas');
    assert.doesNotMatch(d, /googletagmanager|fbq|facebook\.com\/tr/, 'los rastreadores del dueño original no viajan');
    assert.doesNotMatch(d, /http-equiv|base href="\/raiz\/"/i, 'ni su política, ni su refresh, ni su base');
    assert.ok(d.length <= TOPES.htmlLibre);
  }
  assert.match(c.documentos[0], /id="hero"/);
  assert.match(c.documentos[1], /class="espacio"[\s\S]*id="beneficios"/);
  assert.match(c.documentos[1], /"<div>no es un div<\/div>"/);
  assert.match(c.documentos[2], /id="cta"/);
  assert.match(c.documentos[2], /<img src="https:\/\/ejemplo\.com\/raiz\/foto\.jpg">/, 'lo relativo, contra el base de la página');
});

// En el editor (y en la vista del Diagnóstico) el bloque es un <iframe srcdoc>, que hereda la
// política de la app (`base-uri 'self'`): el <base> de la copia se IGNORA y lo relativo se pide a
// hola-mako.com. Medido en el navegador (12/10/2026) con la copia fiel de https://hola-mako.com/: una
// caja en blanco de 3200 px en el editor. Verificado rompiéndolo: con `absolutizarUrls` devolviendo el
// HTML tal cual, el archivo da 2 fallos y 29 pases (éste y el de la copia fiel de arriba).
test('copia fiel: cada dirección relativa sale absoluta; lo que no es una dirección, intacto', () => {
  const b = 'https://ejemplo.com/raiz/';
  const s = absolutizarUrls(
    '<link rel="stylesheet" href="/css/app.css"><img src="foto.jpg" srcset="a.jpg 1x, /b.jpg 2x" alt="a > b">'
    + '<a href="#x">x</a><a href="mailto:a@b.c">m</a><a href=/agenda>ag</a><img src="data:image/png;base64,AAA">'
    + '<div style="background:url(&quot;/f.png&quot;)">s</div><script src="/app.js">var s = "<img src=\'/no.jpg\'>";</script>'
    + '<style>.a{background:url(img/x.png)} @import "/b.css";</style><img src="//cdn.x.com/y.png"><!-- <img src="/c.jpg"> -->',
    b,
  );
  assert.match(s, /href="https:\/\/ejemplo\.com\/css\/app\.css"/);
  assert.match(s, /src="https:\/\/ejemplo\.com\/raiz\/foto\.jpg" srcset="https:\/\/ejemplo\.com\/raiz\/a\.jpg 1x, https:\/\/ejemplo\.com\/b\.jpg 2x" alt="a > b"/);
  assert.match(s, /<a href="#x">/, 'un ancla no es una dirección');
  assert.match(s, /<a href="mailto:a@b\.c">/);
  assert.match(s, /<a href="https:\/\/ejemplo\.com\/agenda">/, 'sin comillas también');
  assert.match(s, /src="data:image\/png;base64,AAA"/);
  assert.match(s, /style="background:url\(&quot;https:\/\/ejemplo\.com\/f\.png&quot;\)"/);
  assert.match(s, /<script src="https:\/\/ejemplo\.com\/app\.js">var s = "<img src='\/no\.jpg'>";<\/script>/, 'el cuerpo de un script no se toca');
  assert.match(s, /url\(https:\/\/ejemplo\.com\/raiz\/img\/x\.png\)/);
  assert.match(s, /@import "https:\/\/ejemplo\.com\/b\.css"/);
  assert.match(s, /src="https:\/\/cdn\.x\.com\/y\.png"/);
  assert.match(s, /<!-- <img src="\/c\.jpg"> -->/, 'un comentario no se toca');
});

test('copia fiel: lo que no se deja partir va entero; lo que no entra, error; las partes de más se juntan', () => {
  const unaSola = copiaFiel('<html><body><main><h1>Sólo un bloque con texto suficiente</h1></main></body></html>', 'https://a.com');
  assert.ok(unaSola.ok && !unaSola.partida && unaSola.documentos.length === 1);
  const enorme = copiaFiel(`<html><body><div>${'x'.repeat(TOPES.htmlLibre)}</div></body></html>`, 'https://a.com');
  assert.equal(enorme.ok, false);
  const muchas = copiaFiel(`<html><body>${Array.from({ length: 60 }, (_, k) => `<section><h2>Sección número ${k}</h2></section>`).join('')}</body></html>`, 'https://a.com');
  assert.ok(muchas.ok && muchas.documentos.length <= MAX_SECCIONES_FIEL && muchas.documentos.length > 1);
  // Si partida no entra en el presupuesto, va entera (si entra entera).
  const css = `<style>${'.a{color:red}'.repeat(Math.ceil(PRESUPUESTO_FIEL / 13 / 3))}</style>`;
  const pesada = copiaFiel(`<html><head>${css}</head><body><section><h2>Una sección con texto</h2></section><section><h2>Otra sección con texto</h2></section><section><h2>Y otra más con texto</h2></section><section><h2>Y la cuarta con texto</h2></section></body></html>`, 'https://a.com');
  assert.ok(pesada.ok && !pesada.partida, 'cuatro copias del head no entran: una sola');
});

test('copia fiel: una página que pide una contraseña no se copia tal cual (y «Como bloques» queda)', () => {
  const login = PAGINA.replace('<button>Agenda</button>', '<form action="/login"><input type="password" name="clave"><button>Entrar</button></form>');
  const c = copiaFiel(login, 'https://banco.com/login');
  assert.equal(c.ok, false);
  if (!c.ok) assert.match(c.error, /pide una contraseña.*«Como bloques»/);
  assert.equal(copiaFiel(PAGINA, 'https://ejemplo.com/oferta').ok, true, 'la de siempre sí');
});

test('el base: el de la página, si no el canonical, si no el pedido', () => {
  assert.equal(baseDeDocumento('<link rel="canonical" href="https://b.com/x/">', 'https://a.com/y'), 'https://b.com/x/');
  assert.equal(baseDeDocumento('<p>nada</p>', 'https://a.com/y'), 'https://a.com/y');
  assert.equal(baseDeDocumento('<base href="javascript:alert(1)">', 'https://a.com/y'), 'https://a.com/y');
});

test('headLimpio y esRastreador: lo que espía y lo que rompe, afuera; los estilos, adentro', () => {
  const h = headLimpio('<meta charset="utf-8"><base href="/"><style>a{}</style><script src="https://static.hotjar.com/c/x.js"></script><script src="/app.js"></script>');
  assert.equal(h, '<style>a{}</style><script src="/app.js"></script>');
  assert.equal(esRastreador('<script>gtag("config","G-1")</script>'), true);
  assert.equal(esRastreador('<script>console.log(1)</script>'), false);
});

test('el contenido de la copia: una sección de ancho completo por parte, que el saneo deja INTACTA', () => {
  const c = copiaFiel(PAGINA, 'https://ejemplo.com/oferta');
  assert.ok(c.ok);
  if (!c.ok) return;
  const contenido = contenidoDeCopiaFiel(c.documentos, c.partida);
  const r = sanearContenido(contenido);
  assert.deepEqual(r.descartes, []);
  const secciones = r.contenido.paginas[0].doc.content;
  assert.equal(secciones.length, 3);
  secciones.forEach((t, k) => {
    assert.equal((t.attrs as { ancho: string }).ancho, 'completo');
    const b = t.content?.[0];
    assert.equal(b?.type, NODO.htmlLibre);
    assert.equal((b?.attrs as { html: string }).html, c.documentos[k], 'el HTML copiado no se toca');
  });
});

// =============================================================================
// PROBADO ROMPIÉNDOLO (11/10/2026), una rotura por vez con un arnés en el scratchpad que guarda el
// archivo en memoria, lo rompe, corre ESTE archivo y lo reescribe (comparado byte a byte después).
// Corriendo ESTE archivo junto con tests/rutas-publicas.test.ts. Base: 42 pass / 0 fail (+1 todo, el
// de next.config.ts, que es un PEDIDO). Resultado «pass / fail»:
//    1. el src también fuera de la publicada (editor)          → 41 / 1
//    2. render.ts sin `srcHtmlLibre`                            → 41 / 1
//    3. el id derivado al azar (`nuevoId`)                      → 41 / 1 (determinista)
//    4. sin deduplicar los ids                                  → 41 / 1
//    5. la ruta lee sin validar la forma                        → 41 / 1 (404 sin tocar la base)
//    6. la base caída contesta 404                              → 41 / 1
//    7. el oyente de la página no mira `ev.source`              → 41 / 1
//    8. `frame-src` sin 'self'                                  → 41 / 1
//    9. sin el freno del script del alto                        → 41 / 1
//   10. los rastreadores viajan a la copia                      → 40 / 2
//   11. la copia sin los envoltorios                            → 41 / 1
//   12. /l/html fuera de PUBLICOS                               → 40 / 2 (éste y el de rutas-publicas)
//   13. `html` no reservado como slug                           → 41 / 1
//   14. el doctype siempre (dos doctypes)                       → 41 / 1
//   15. `script` no es elemento crudo                           → 42 / 0 la primera vez: el caso sólo
//       cerraba un `</div>` que no estaba abierto. Se sumó un script que escribe el cierre de SU
//       sección en una cadena                                   → 41 / 1
//   16. el tope vuelve a 50 KB                                  → 40 / 2
//   17. la página acepta un mensaje de cualquier tipo           → 41 / 1
// Después se sumó el test de `Sec-Fetch-Dest` (base: 43 / 0) y se midió otra vez sobre esa base:
//    5 y 6 (las dos de arriba)                                  → 42 / 1 cada una
//   18. la ruta sirve a una pestaña (sin `pedidoDeIframe`)      → 42 / 1
//   19. caché `public` (un CDN se la daría a una pestaña)       → 42 / 1
// Los archivos tocados, con md5 igual antes y después.
//
// Revisión de la tanda 2 (12/10/2026): el formulario de contraseña. Mismo método (restauración de
// memoria, sha256 igual), corriendo este archivo. Base: 35 / 0.
//   20. pideContrasena siempre false                          → 32 / 3 (la detección, la ruta, la copia)
//   21. pideContrasena sin la rama de setAttribute            → 34 / 1
//   22. la ruta sirve el bloque que pide contraseña           → 34 / 1
//   23. la copia fiel copia el login                          → 34 / 1
//   24. publicar sin el freno                                 → 34 / 1
// Restaurado: 35 / 0.
// =============================================================================
