// =============================================================================
// La página PÚBLICA de una landing del editor (lib/editor-landing/pagina-publica.ts +
// app/l/**/route.ts + la entrada `/l` de lib/rutas-publicas.ts)
// =============================================================================
// Pedido de Martín (11/10/2026): un editor de landings copiado de Gamma que publique en
// /l/<slug>. Diseño: docs/diseno-editor-landing.md, D4. Lo que estos tests cuidan:
//   · noindex por default; «Permitir la indexación» sólo lo saca en la página PUBLICADA;
//   · el Pixel de MaKo y el Píxel de Meta sólo en la publicada, nunca en la vista previa;
//   · un id de Meta con algo que no sea un dígito no inyecta NADA;
//   · todo lo que se interpola sale escapado (un título con </title><script>);
//   · la política de contenido: cada script inline entra por su hash, script-src sin
//     'unsafe-inline', y va ANTES de cualquier script, hoja o link;
//   · el script propio: cancela el envío, valida, deshabilita, muestra el éxito o redirige
//     (sólo http/https), y la animación sólo con la config prendida;
//   · la respuesta: 404 sin tocar la base y sin enumerar, 503 si la base no contestó (o el
//     token del Pixel no se pudo leer), 308 a minúsculas con la query, ETag/304, HEAD;
//   · `/l` es público y sólo de lectura, y `app/l` tiene EXACTAMENTE las tres rutas, que
//     sólo exportan GET y HEAD y no leen la sesión.
//
// PROBADO ROMPIÉNDOLO: ver el bloque al final del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Script, createContext, runInContext } from 'node:vm';
import {
  CACHE_ERROR, CACHE_PUBLICO, CACHE_VISTA, SCRIPT_PAGINA, TEXTO_FALLO, TEXTO_NO_EXISTE,
  armarDocumento, codigoMetaPixel, documentoPublico, etagDe, hashScript, hostsDeIframes, idMetaPixel, responderPublico,
  configDeLectura, entornoActual, type Entorno, type EntradaDocumento, type LecturaPublica,
} from '../lib/editor-landing/pagina-publica';
import { CONFIG_DEFAULT, type ConfigLanding } from '../lib/editor-landing/api-tipos';
import { CSS_CONTENIDO } from '../lib/editor-landing/css';
import { origenImagenes } from '../lib/editor-landing/especificacion';
import { lineaCargador } from '../lib/pixel-cargador';
import { esPublica, esPublicaSoloLeer } from '../lib/rutas-publicas';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

const ENTORNO: Entorno = {
  appBaseUrl: 'https://hola-mako.com',
  prefijoBucket: 'https://proy.supabase.co/storage/v1/object/public/landing-imagenes/',
};
const TOKEN = `mko_${'a1'.repeat(16)}`;
const CUERPO = '<div class="gm-doc" style="--gm-fondo:#fff"><div class="gm-fondo"><div class="gm-pagina"><section class="gm-tarjeta" id="t-1"><div class="gm-tarjeta-cuerpo"><h1 class="gm-titulo">Hola</h1></div></section></div></div></div>';

function config(sitio: Partial<ConfigLanding['sitio']> = {}, pagina: Partial<ConfigLanding['pagina']> = {}): ConfigLanding {
  return { ...CONFIG_DEFAULT, sitio: { ...CONFIG_DEFAULT.sitio, ...sitio }, pagina: { ...CONFIG_DEFAULT.pagina, ...pagina } };
}

function entrada(over: Partial<EntradaDocumento> = {}): EntradaDocumento {
  return { html: CUERPO, config: config(), workspaceId: 7, modo: 'publico', urlCanonica: 'https://hola-mako.com/l/mi-landing', ...over };
}

const doc = (over: Partial<EntradaDocumento> = {}, tokenPixel: string | null = TOKEN) => armarDocumento({ ...entrada(over), tokenPixel }, ENTORNO);

/** La política del <meta>, directiva → fuentes (con las entidades del atributo deshechas). */
function politica(html: string): Map<string, string[]> {
  const m = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html);
  assert.ok(m, 'el documento trae la política de contenido');
  const crudo = m[1].replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const out = new Map<string, string[]>();
  for (const parte of crudo.split(';')) {
    const [k, ...v] = parte.trim().split(/\s+/);
    if (k) out.set(k, v);
  }
  return out;
}

/** Los scripts INLINE (sin atributos): son los que necesitan su hash en script-src. */
const scriptsInline = (html: string) => [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

// ─────────────────────────────────────────────────────────────────────────────
// El documento
// ─────────────────────────────────────────────────────────────────────────────

test('noindex por default; «Permitir la indexación» sólo lo saca en la página publicada', () => {
  assert.match(doc(), /<meta name="robots" content="noindex, nofollow">/, 'publicada sin indexar: noindex');
  const indexable = doc({ config: config({ indexar: true }) });
  assert.doesNotMatch(indexable, /name="robots"/, 'publicada con indexar: sin noindex');
  assert.match(indexable, /<link rel="canonical" href="https:\/\/hola-mako.com\/l\/mi-landing">/);
  const vista = doc({ modo: 'vista', config: config({ indexar: true }) });
  assert.match(vista, /<meta name="robots" content="noindex, nofollow, noarchive">/, 'la vista previa nunca se indexa');
  assert.doesNotMatch(vista, /rel="canonical"/);
});

test('el Pixel de MaKo va SÓLO en la página publicada', () => {
  const publica = doc();
  assert.ok(publica.includes(lineaCargador(TOKEN, ENTORNO.appBaseUrl)), 'la línea del cargador, tal cual la arma lib/pixel-cargador.ts');
  assert.ok(politica(publica).get('script-src')!.includes('https://hola-mako.com'), 'el cargador entra en script-src');
  assert.ok(politica(publica).get('connect-src')!.includes('https://hola-mako.com'), 'y sus endpoints en connect-src');

  const vista = doc({ modo: 'vista' });
  assert.doesNotMatch(vista, /\/m\.js/, 'la vista previa no carga el Pixel aunque haya token');
  assert.ok(!politica(vista).get('script-src')!.includes('https://hola-mako.com'));

  assert.doesNotMatch(doc({}, 'mko_"><script>'), /\/m\.js/, 'un token con forma inválida no se escribe');
});

test('un id del Píxel de Meta con algo que no sea un dígito no inyecta nada', () => {
  const bueno = doc({ config: config({ metaPixelId: '123456789012345' }) });
  assert.match(bueno, /fbq\('init','123456789012345'\)/);
  assert.match(bueno, /src="https:\/\/www.facebook.com\/tr\?id=123456789012345&amp;ev=PageView&amp;noscript=1"/);
  assert.ok(politica(bueno).get('script-src')!.includes('https://connect.facebook.net'));

  for (const malo of ['12345abc', "1234567');alert(1);//", '12 34567', '1234', '']) {
    const d = doc({ config: config({ metaPixelId: malo }) });
    assert.doesNotMatch(d, /fbq|facebook/, `«${malo}» no deja rastro de Meta`);
  }
  assert.doesNotMatch(doc({ modo: 'vista', config: config({ metaPixelId: '123456789012345' }) }), /fbq|facebook/, 'ni en la vista previa');
});

test('el id de Meta se filtra en DOS capas, y cada una frena sola', () => {
  // Con una sola capa rota el documento sigue limpio (la otra frena): por eso cada capa
  // lleva su propia afirmación, o romper una pasaría en verde.
  assert.equal(idMetaPixel(config({ metaPixelId: '12345abc' })), null);
  assert.equal(idMetaPixel(config({ metaPixelId: ' 123456789012345 ' })), '123456789012345');
  assert.equal(codigoMetaPixel("1234567');alert(1);//"), null);
  assert.equal(codigoMetaPixel('12345abc'), null);
  assert.ok(codigoMetaPixel('123456789012345')?.script.includes("fbq('init','123456789012345')"));
});

test('un título con </title><script> sale escapado, en el <title> y en los meta', () => {
  const ataque = '</title><script>alert(1)</script>';
  const d = doc({ titulo: ataque, descripcion: '"><img src=x onerror=alert(1)>' });
  assert.equal((d.match(/<title>/g) ?? []).length, 1);
  assert.ok(d.includes('<title>&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;</title>'));
  assert.ok(d.includes('content="&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"'));
  assert.doesNotMatch(d, /<script>alert|<img src=x/);
  // El SEO del sitio cuando la página no trae el suyo, escapado igual.
  const delSitio = doc({ config: config({ seoTitulo: 'Mi <b>sitio</b>', nombre: 'A & B' }) });
  assert.ok(delSitio.includes('<title>Mi &lt;b&gt;sitio&lt;/b&gt;</title>'));
  assert.ok(delSitio.includes('<meta property="og:site_name" content="A &amp; B">'));
});

test('cada script inline entra por su HASH, y script-src no tiene unsafe-inline', () => {
  const d = doc({ config: config({ metaPixelId: '123456789012345' }) });
  const p = politica(d);
  const scriptSrc = p.get('script-src')!;
  const inline = scriptsInline(d);
  assert.equal(inline.length, 2, 'el de la página y el de Meta');
  for (const s of inline) assert.ok(scriptSrc.includes(hashScript(s)), `falta el hash de: ${s.slice(0, 40)}…`);
  assert.ok(!scriptSrc.includes("'unsafe-inline'") && !scriptSrc.includes("'unsafe-eval'"));
  // El tema viaja en atributos style: sin 'unsafe-inline' no se vería, y con un hash al lado el navegador lo ignoraría.
  assert.ok(p.get('style-src')!.includes("'unsafe-inline'"));
  assert.ok(!p.get('style-src')!.some((s) => s.startsWith("'sha256-")));
  for (const h of hostsDeIframes()) assert.ok(p.get('frame-src')!.includes(h), `frame-src deja pasar ${h}`);
  assert.deepEqual(p.get('form-action'), ["'none'"]);
  assert.deepEqual(p.get('object-src'), ["'none'"]);
  assert.ok(p.get('img-src')!.includes(ENTORNO.prefijoBucket!));
});

test('la política va antes de cualquier script, hoja o link (lo de antes no lo gobierna)', () => {
  const d = doc({ fuentes: 'https://fonts.googleapis.com/css2?family=Inter&display=swap', config: config({ metaPixelId: '123456789012345' }) });
  const csp = d.indexOf('http-equiv="Content-Security-Policy"');
  assert.ok(d.indexOf('<meta charset="utf-8">') < csp, 'el charset primero');
  for (const tag of ['<script', '<link', '<style']) assert.ok(csp < d.indexOf(tag), `la política antes del primer ${tag}`);
});

test('una hoja que no es de Google Fonts y un favicon fuera del bucket no se escriben', () => {
  const d = doc({
    fuentes: ['https://fonts.googleapis.com/css2?family=Inter&display=swap', 'https://evil.tld/x.css', 'https://fonts.googleapis.com.evil.tld/a'],
    config: config({ favicon: 'https://evil.tld/f.png' }),
  });
  assert.ok(d.includes('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter&amp;display=swap">'));
  assert.doesNotMatch(d, /evil\.tld/);
  const conFavicon = doc({ config: config({ favicon: `${ENTORNO.prefijoBucket}7/f.png` }) });
  assert.ok(conFavicon.includes(`<link rel="icon" href="${ENTORNO.prefijoBucket}7/f.png">`));
});

test('el bucket que deja pasar la política es el MISMO que acepta el renderizador', () => {
  // Dos cuentas del prefijo (una con barra, otra sin) bloquearían en silencio las imágenes
  // que el render dejó pasar: la imagen no carga y no hay un solo error en el server.
  const antes = process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proy.supabase.co/';
    assert.equal(entornoActual().prefijoBucket, origenImagenes());
    assert.equal(entornoActual().prefijoBucket, 'https://proy.supabase.co/storage/v1/object/public/landing-imagenes/');
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    assert.equal(entornoActual().prefijoBucket, null, 'sin Supabase no se inventa un origen');
  } finally {
    if (antes === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = antes;
  }
});

test('documentoPublico lee el token SÓLO en la publicada, y si la lectura tira, tira', async () => {
  let lecturas = 0;
  const tokenPixel = async () => { lecturas++; return TOKEN; };
  await documentoPublico(entrada({ modo: 'vista' }), { tokenPixel, entorno: ENTORNO });
  assert.equal(lecturas, 0, 'la vista previa no pregunta por el token');
  const d = await documentoPublico(entrada(), { tokenPixel, entorno: ENTORNO });
  assert.equal(lecturas, 1);
  assert.ok(d.includes(lineaCargador(TOKEN, ENTORNO.appBaseUrl)));
  await assert.rejects(documentoPublico(entrada(), { tokenPixel: async () => { throw new Error('base caída'); }, entorno: ENTORNO }));
});

test('la fuente lee el token ESTRICTO y sólo acuña si no hay nada guardado', () => {
  // `getOrCreateLandingToken` lee con getSetting, que convierte un error en null y entonces
  // ACUÑA y GUARDA: en una página pública eso pasaría en cada visita que coincida con un
  // pestañeo de la base. Lo fija el fuente porque la función toca la base.
  const src = leer('lib/editor-landing/pagina-publica.ts');
  const cuerpo = src.slice(src.indexOf('export async function tokenDelPixel'), src.indexOf('export type DepDocumento'));
  assert.ok(cuerpo.length > 100 && cuerpo.length < 1500, `el recorte mide ${cuerpo.length}: mira otra cosa`);
  assert.match(cuerpo, /getSettingEstricto\(landing\.LANDING_TOKEN_KEY\)/);
  assert.ok(cuerpo.indexOf('getSettingEstricto(') < cuerpo.indexOf('getOrCreateLandingToken('), 'primero la lectura estricta');
  assert.match(cuerpo, /if \(guardado\) return guardado;/);
});

// ─────────────────────────────────────────────────────────────────────────────
// El script propio, corrido de verdad (vm) contra un DOM de mentira
// ─────────────────────────────────────────────────────────────────────────────

type Oyente = (ev: { target: unknown; preventDefault: () => void }) => void;
type Elemento = { clases: Set<string>; classList: { add: (c: string) => void } };

function correrScript(op: { animar?: boolean; reducido?: boolean; conIO?: boolean } = {}) {
  const oyentes: Record<string, Oyente[]> = {};
  const clasesHtml = new Set<string>();
  const observados: unknown[] = [];
  const timers: Array<() => void> = [];
  const asignados: string[] = [];
  let alVer: ((e: Array<{ isIntersecting: boolean; target: Elemento }>) => void) | null = null;
  const elementos: Elemento[] = [0, 1].map(() => {
    const clases = new Set<string>();
    return { clases, classList: { add: (c: string) => { clases.add(c); } } };
  });
  class IOFalso {
    constructor(cb: (e: Array<{ isIntersecting: boolean; target: Elemento }>) => void) { alVer = cb; }
    observe(el: unknown) { observados.push(el); }
    unobserve() { /* nada */ }
  }
  const document = {
    addEventListener: (t: string, fn: Oyente) => { (oyentes[t] ??= []).push(fn); },
    body: { getAttribute: (n: string) => (n === 'data-gm-animar' && op.animar ? '1' : null) },
    documentElement: { classList: { add: (c: string) => { clasesHtml.add(c); } } },
    querySelectorAll: () => elementos,
    createElement: () => ({ className: '', textContent: '', attrs: {} as Record<string, string>, setAttribute(k: string, v: string) { this.attrs[k] = v; } }),
  };
  const window = {
    location: { href: 'https://hola-mako.com/l/mi-landing', assign: (u: string) => { asignados.push(u); } },
    setTimeout: (fn: () => void) => { timers.push(fn); },
    matchMedia: () => ({ matches: !!op.reducido }),
    IntersectionObserver: op.conIO === false ? undefined : IOFalso,
  };
  runInContext(SCRIPT_PAGINA, createContext({ document, window, URL }));
  return { oyentes, clasesHtml, observados, elementos, timers, asignados, ver: (e: Array<{ isIntersecting: boolean; target: Elemento }>) => alVer?.(e) };
}

type Hijo = { attrs: Record<string, string>; style: Record<string, string>; removeAttribute: (n: string) => void; setAttribute: (n: string, v: string) => void };
const hijo = (attrs: Record<string, string> = {}): Hijo => ({
  attrs: { ...attrs }, style: {},
  removeAttribute(n: string) { delete this.attrs[n]; },
  setAttribute(n: string, v: string) { this.attrs[n] = v; },
});

/** Un form de mentira. `conExito`: con el `p.gm-formulario-exito[hidden]` que escribe especificacion.ts adentro. */
function formulario(attrs: Record<string, string>, valido = true, clase = 'gm-formulario', conExito = false) {
  const botones = [{ disabled: false }, { disabled: false }];
  const insertados: Array<{ className: string; textContent: string; attrs: Record<string, string> }> = [];
  const estado = { reportes: 0 };
  const campo = hijo();
  const exito = conExito ? hijo({ hidden: '' }) : null;
  const f = {
    classList: { contains: (c: string) => c === clase },
    attrs: { ...attrs } as Record<string, string>,
    getAttribute(n: string) { return n in this.attrs ? this.attrs[n] : null; },
    setAttribute(n: string, v: string) { this.attrs[n] = String(v); },
    checkValidity: () => valido,
    reportValidity: () => { estado.reportes++; return valido; },
    querySelectorAll: () => botones,
    querySelector: (sel: string) => (sel === '.gm-formulario-exito' ? exito : null),
    children: exito ? [campo, exito] : [campo],
    parentNode: { insertBefore: (n: { className: string; textContent: string; attrs: Record<string, string> }) => { insertados.push(n); } },
    nextSibling: null,
    style: {} as Record<string, string>,
  };
  return { f, botones, insertados, estado, campo, exito };
}

function enviar(oyentes: Record<string, Oyente[]>, f: unknown): boolean {
  let cancelado = false;
  for (const fn of oyentes.submit ?? []) fn({ target: f, preventDefault: () => { cancelado = true; } });
  return cancelado;
}

test('el script de la página compila, y su texto no trae barras ni backticks', () => {
  assert.doesNotThrow(() => new Script(SCRIPT_PAGINA));
  assert.doesNotMatch(SCRIPT_PAGINA, /[\\`]|\$\{/, 'un string que se sirve: sin barras, sin backticks, sin ${');
});

test('el formulario (sin mensaje escrito): cancela, deshabilita, arma el éxito y esconde el form — sin mandar nada', () => {
  const s = correrScript();
  const { f, botones, insertados } = formulario({ 'data-exito': '¡Listo! Te escribimos hoy.' });
  assert.equal(enviar(s.oyentes, f), true, 'preventDefault: el navegador no manda nada');
  assert.ok(botones.every((b) => b.disabled), 'el botón queda deshabilitado');
  assert.equal(insertados.length, 1);
  assert.equal(insertados[0].textContent, '¡Listo! Te escribimos hoy.', 'el mensaje va por textContent');
  assert.equal(insertados[0].attrs.role, 'status');
  assert.equal(f.style.display, 'none');
  enviar(s.oyentes, f);
  assert.equal(insertados.length, 1, 'un segundo envío no hace nada');
  assert.deepEqual(s.asignados, []);
});

test('con el mensaje ya escrito adentro (especificacion.ts), se muestra ése y se esconde el resto', () => {
  const s = correrScript();
  const { f, insertados, campo, exito } = formulario({ 'data-exito': 'Gracias' }, true, 'gm-formulario', true);
  assert.equal(enviar(s.oyentes, f), true);
  assert.equal(insertados.length, 0, 'no arma un segundo mensaje');
  assert.equal(campo.style.display, 'none', 'los campos se esconden');
  assert.ok(exito && !('hidden' in exito.attrs), 'el mensaje se muestra');
  assert.equal(exito?.style.display, undefined, 'y no se esconde a sí mismo');
  assert.equal(exito?.attrs.role, 'status');
});

test('el formulario inválido no se da por enviado, y uno ajeno no se toca', () => {
  const s = correrScript();
  const malo = formulario({}, false);
  enviar(s.oyentes, malo.f);
  assert.equal(malo.estado.reportes, 1, 'se le muestra la validación nativa');
  assert.ok(malo.botones.every((b) => !b.disabled) && malo.insertados.length === 0);
  const ajeno = formulario({}, true, 'otro-form');
  assert.equal(enviar(s.oyentes, ajeno.f), false, 'un <form> que no es del editor sigue haciendo lo suyo');
});

test('redirigir: sólo a http/https, y sin datos en la URL', () => {
  const s = correrScript();
  const bueno = formulario({ 'data-redirigir': 'https://ejemplo.com/gracias' });
  enviar(s.oyentes, bueno.f);
  assert.equal(bueno.insertados.length, 0);
  assert.deepEqual(s.asignados, [], 'espera un instante (el fetch del Pixel sale primero)');
  s.timers.forEach((t) => t());
  assert.deepEqual(s.asignados, ['https://ejemplo.com/gracias'], 'navega a la URL configurada, tal cual');

  for (const malo of ['javascript:alert(1)', 'data:text/html,<script>x</script>', ' JaVaScRiPt:alert(1)']) {
    const s2 = correrScript();
    const f = formulario({ 'data-redirigir': malo, 'data-exito': 'Gracias' });
    enviar(s2.oyentes, f.f);
    s2.timers.forEach((t) => t());
    assert.deepEqual(s2.asignados, [], `«${malo}» no navega`);
    assert.equal(f.insertados[0]?.textContent, 'Gracias', 'y muestra el éxito en su lugar');
  }
});

test('la animación: sólo con la config prendida, con IntersectionObserver y sin «menos movimiento»', () => {
  const s = correrScript({ animar: true });
  assert.ok(s.clasesHtml.has('gm-anim'), 'la clase que esconde la pone el script: sin JS no se esconde nada');
  assert.equal(s.observados.length, 2);
  s.ver([{ isIntersecting: true, target: s.elementos[0] }, { isIntersecting: false, target: s.elementos[1] }]);
  assert.ok(s.elementos[0].clases.has('gm-visto') && !s.elementos[1].clases.has('gm-visto'));

  for (const op of [{ animar: false }, { animar: true, reducido: true }, { animar: true, conIO: false }]) {
    const x = correrScript(op);
    assert.ok(!x.clasesHtml.has('gm-anim') && x.observados.length === 0, JSON.stringify(op));
  }
  assert.match(doc(), /<body data-gm-animar="1">/, 'animaciones prendidas por default');
  assert.match(doc({ config: config({}, { animaciones: false }) }), /<body>/);
});

// ─────────────────────────────────────────────────────────────────────────────
// La respuesta de las rutas
// ─────────────────────────────────────────────────────────────────────────────

const FOTO: LecturaPublica = {
  workspaceId: 7,
  titulo: 'Mi landing',
  foto: { css: '.gm-doc{color:#111}', fuentes: '', sitio: CONFIG_DEFAULT.sitio, temaId: 'pewter' },
  pagina: { html: CUERPO, titulo: 'Mi landing', descripcion: '' },
};

function dep(leerFoto: () => Promise<LecturaPublica | null>) {
  let lecturas = 0;
  return {
    d: { leer: async () => { lecturas++; return leerFoto(); }, tokenPixel: async () => TOKEN, entorno: ENTORNO },
    lecturas: () => lecturas,
  };
}
const pedir = (ruta: string, init?: RequestInit) => new Request(`https://hola-mako.com${ruta}`, init);

test('slug, ruta o token que no pueden existir: 404 SIN tocar la base', async () => {
  for (const [p, url] of [
    [{ tipo: 'pagina', slug: 'api', ruta: '' }, '/l/api'],
    [{ tipo: 'pagina', slug: 'ab', ruta: '' }, '/l/ab'],
    [{ tipo: 'pagina', slug: 'mi-landing', ruta: 'no_vale' }, '/l/mi-landing/no_vale'],
    [{ tipo: 'vista', token: 'a b' }, '/l/vista/a%20b'],
  ] as const) {
    const { d, lecturas } = dep(async () => FOTO);
    const r = await responderPublico(pedir(url), p, d);
    assert.equal(r.status, 404, url);
    assert.equal(lecturas(), 0, `${url}: no se consulta la base`);
  }
});

test('mayúsculas: 308 a la URL en minúsculas, con la query (la atribución) intacta', async () => {
  const { d, lecturas } = dep(async () => FOTO);
  const r = await responderPublico(pedir('/l/Mi-Landing/Gracias?utm_source=meta&fbclid=x'), { tipo: 'pagina', slug: 'Mi-Landing', ruta: 'Gracias' }, d);
  assert.equal(r.status, 308);
  assert.equal(r.headers.get('location'), 'https://hola-mako.com/l/mi-landing/gracias?utm_source=meta&fbclid=x');
  assert.equal(lecturas(), 0);
});

test('no existe o está apagado: 404 con la página propia (la misma para los dos casos)', async () => {
  const { d } = dep(async () => null);
  const r = await responderPublico(pedir('/l/mi-landing'), { tipo: 'pagina', slug: 'mi-landing', ruta: '' }, d);
  assert.equal(r.status, 404);
  assert.equal(r.headers.get('cache-control'), CACHE_ERROR, 'un 404 guardado taparía un slug recién publicado');
  assert.match(r.headers.get('x-robots-tag') ?? '', /noindex/);
  const html = await r.text();
  assert.ok(html.includes(TEXTO_NO_EXISTE));
  assert.doesNotMatch(html, /mi-landing/, 'no repite el slug: no confirma ni niega nada');
});

test('la base no contestó: 503 sin caché, nunca un 404', async () => {
  const { d } = dep(async () => { throw new Error('timeout'); });
  const errores: string[] = [];
  const original = console.error;
  console.error = (m: string) => { errores.push(String(m)); };
  try {
    const r = await responderPublico(pedir('/l/mi-landing'), { tipo: 'pagina', slug: 'mi-landing', ruta: '' }, d);
    assert.equal(r.status, 503);
    assert.equal(r.headers.get('cache-control'), CACHE_ERROR);
    assert.ok(r.headers.get('retry-after'));
    assert.ok((await r.text()).includes(TEXTO_FALLO));
    // Y si lo que falla es el token del Pixel, tampoco se sirve una página que no puede capturar.
    const sinToken = await responderPublico(pedir('/l/mi-landing'), { tipo: 'pagina', slug: 'mi-landing', ruta: '' },
      { leer: async () => FOTO, tokenPixel: async () => { throw new Error('base caída'); }, entorno: ENTORNO });
    assert.equal(sinToken.status, 503);
  } finally {
    console.error = original;
  }
  assert.equal(errores.length, 2, 'cada 503 deja su línea en el log');
});

test('200 con el documento, ETag y no-cache; 304 si el navegador ya lo tiene; HEAD sin cuerpo', async () => {
  const { d } = dep(async () => FOTO);
  const p = { tipo: 'pagina', slug: 'mi-landing', ruta: '' } as const;
  const r = await responderPublico(pedir('/l/mi-landing'), p, d);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(r.headers.get('cache-control'), CACHE_PUBLICO);
  // El valor, literal: con un max-age, el navegador seguiría mostrando la versión vieja
  // minutos después de publicar. «no-cache» guarda y PREGUNTA cada vez (y el ETag da el 304).
  assert.equal(CACHE_PUBLICO, 'public, no-cache');
  assert.equal(CACHE_VISTA, 'private, no-store');
  assert.equal(CACHE_ERROR, 'no-store');
  const html = await r.text();
  assert.ok(html.startsWith('<!doctype html>'));
  assert.equal(r.headers.get('etag'), etagDe(html), 'el ETag es el del documento entero');
  assert.ok(html.includes(lineaCargador(TOKEN, ENTORNO.appBaseUrl)));

  const r304 = await responderPublico(pedir('/l/mi-landing', { headers: { 'If-None-Match': `W/"otro", ${r.headers.get('etag')}` } }), p, d);
  assert.equal(r304.status, 304);
  assert.equal(await r304.text(), '');

  const head = await responderPublico(pedir('/l/mi-landing', { method: 'HEAD' }), p, d);
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('etag'), r.headers.get('etag'));
});

test('la vista previa: private no-store, noindex, y sin Pixel', async () => {
  const { d } = dep(async () => ({ ...FOTO, foto: { ...FOTO.foto, sitio: config({ indexar: true, metaPixelId: '123456789012345' }).sitio } }));
  const r = await responderPublico(pedir('/l/vista/tok_ABCdef123456'), { tipo: 'vista', token: 'tok_ABCdef123456' }, d);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), CACHE_VISTA);
  assert.match(r.headers.get('x-robots-tag') ?? '', /noindex/);
  const html = await r.text();
  assert.doesNotMatch(html, /\/m\.js|fbq/);
});

test('el documento sale de lo CONGELADO en la foto: la hoja, el sitio y el título resuelto', async () => {
  const { d } = dep(async () => ({
    ...FOTO,
    foto: { ...FOTO.foto, css: '.gm-doc{color:#123456}', sitio: config({ metaPixelId: '123456789012345', seoTitulo: 'SEO del sitio' }).sitio, animaciones: false },
  }));
  const html = await (await responderPublico(pedir('/l/mi-landing'), { tipo: 'pagina', slug: 'mi-landing', ruta: '' }, d)).text();
  assert.ok(html.includes('.gm-doc{color:#123456}'), 'la hoja congelada con el HTML que la usa');
  assert.match(html, /fbq\('init','123456789012345'\)/, 'el Píxel de Meta del sitio congelado');
  assert.match(html, /<title>Mi landing<\/title>/, 'el título que resolvió D para esa página manda');
  assert.match(html, /<body>/, 'animaciones apagadas en la foto: sin data-gm-animar');
  // Lo que la foto no trae cae al DEFAULT, nunca a otra cosa.
  const cfg = configDeLectura({ ...FOTO, foto: { sitio: CONFIG_DEFAULT.sitio } });
  assert.equal(cfg.pagina.animaciones, true);
  assert.equal(cfg.tema, CONFIG_DEFAULT.tema);
  // Sin título propio de la página: el SEO del sitio, y después el título de la landing.
  assert.match(doc({ titulo: '', config: config({ seoTitulo: 'SEO del sitio' }), tituloRespaldo: 'La landing' }), /<title>SEO del sitio<\/title>/);
  assert.match(doc({ titulo: '', tituloRespaldo: 'La landing' }), /<title>La landing<\/title>/);
  // Una foto sin hoja (vacía) no deja la página sin estilos: va la de hoy. Con hoja, sólo la suya.
  assert.ok(doc({ css: '' }).includes(CSS_CONTENIDO), 'sin hoja congelada: CSS_CONTENIDO');
  assert.ok(!doc({ css: '.solo-esta{}' }).includes(CSS_CONTENIDO), 'con hoja congelada, no se mezcla con la de hoy');
});

// ─────────────────────────────────────────────────────────────────────────────
// Rutas públicas y el contenido de app/l
// ─────────────────────────────────────────────────────────────────────────────

test('/l es público y sólo de lectura; lo de al lado no', () => {
  for (const r of ['/l/mi-landing', '/l/mi-landing/gracias', '/l/vista/tok_ABCdef123456']) {
    assert.equal(esPublica(r), true, `${r}: sin esto, en producción el proxy la manda a /login`);
    assert.equal(esPublicaSoloLeer(r), true, `${r}: una página pública que acepta POST ejecuta server actions sin sesión`);
  }
  // El prefijo es `/l` + `/`: la tab del editor (con sesión) empieza con «/l» y no entra.
  for (const r of ['/landing-generator', '/landing-generator/12', '/landing-writer', '/lx']) assert.equal(esPublica(r), false, r);
});

function rutasBajo(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...rutasBajo(p));
    else out.push(relative(RAIZ, p).replace(/\\/g, '/'));
  }
  return out;
}

test('app/l tiene EXACTAMENTE las cinco rutas, sólo GET y HEAD, y ninguna lee la sesión', () => {
  // `/l` entra en PUBLICOS como prefijo porque la carpeta es pública por construcción: un
  // archivo nuevo acá adentro queda abierto sin sesión, así que tiene que decidirse a mano.
  // La cuarta (las otras páginas de un BORRADOR por el link privado) la sumó la integración del
  // 11/10/2026: es la misma lectura que la vista previa, con la ruta. La quinta (el «HTML
  // personalizado» aislado, T6) la sumó la integración de la tanda 2 (12/10/2026): no arma una
  // página sino un documento para un iframe, y su decisión (`responderHtmlLibre`) la cubre
  // tests/editor-landing-htmllibre.test.ts.
  const RUTAS_L = [
    'app/l/[slug]/[ruta]/route.ts',
    'app/l/[slug]/route.ts',
    'app/l/html/[docId]/[bloque]/route.ts',
    'app/l/vista/[token]/[ruta]/route.ts',
    'app/l/vista/[token]/route.ts',
  ];
  assert.deepEqual(rutasBajo(join(RAIZ, 'app/l')).sort(), RUTAS_L);
  for (const f of RUTAS_L) {
    const src = leer(f).replace(/^[ \t]*\/\/.*$/gm, '');
    const exportados = [...src.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(\w+)/g)].map((m) => m[1]).sort();
    assert.deepEqual(exportados, ['GET', 'HEAD', 'dynamic'], `${f}: sólo lectura`);
    assert.doesNotMatch(src, /next\/headers|cookies\(|getTenantDb|getSesion|getWorkspaceActual/, `${f}: no mira la sesión`);
    if (f.startsWith('app/l/html/')) { assert.match(src, /responderHtmlLibre\(/, `${f}: la decisión vive en html-libre.ts`); continue; }
    assert.match(src, /responderPublico\(/, `${f}: la decisión vive en pagina-publica.ts`);
    // La vista previa entra como 'vista' (noindex, sin Pixel, no-store); las otras dos como 'pagina'.
    if (f.includes('vista')) assert.match(src, /responderPublico\(req, \{ tipo: 'vista', token(?:, ruta)? \}, \{ leer: \(\) => leerVistaPrevia\(token(?:, ruta)?\) \}\)/);
    else assert.match(src, /responderPublico\(req, \{ tipo: 'pagina', slug, ruta(?:: '')? \}, \{ leer: \(\) => leerPublicado\(slug, (?:''|ruta)\) \}\)/);
  }
});

// =============================================================================
// PROBADO ROMPIÉNDOLO (11/10/2026), una rotura por vez, corriendo ESTE archivo junto con
// tests/rutas-publicas.test.ts (base: 38 pass / 0 fail), con un arnés en el scratchpad que
// guarda el archivo en memoria, lo rompe, corre y lo reescribe (comparado byte a byte, y
// md5 de los cuatro archivos tocados igual antes y después). Resultado «pass / fail»:
//    1. esIndexable sin mirar el modo                        → 36 / 2 (noindex; vista previa)
//    2. el token del Pixel sin `publico &&`                  → 37 / 1 (Pixel sólo en la publicada)
//    3. idMetaPixel aceptando \S{4,40}                        → 37 / 1 (las DOS capas)
//    4. codigoMetaPixel sin su propio chequeo de dígitos     → 37 / 1 (las DOS capas)
//    3+4 las dos capas a la vez                               → 36 / 2 (+ «no inyecta nada»)
//    5. escaparHtml sin escapar `<`                           → 37 / 1 (</title><script>)
//    6. sin el hash del script de Meta                        → 37 / 1 (cada script por su hash)
//    7. 'unsafe-inline' en script-src                         → 37 / 1 (ídem)
//    8. sin el <meta> de la política                          → 34 / 4
//    9. fuentes de cualquier origen https                     → 37 / 1
//   10. sin `ev.preventDefault()`                             → 36 / 2 (los dos formularios)
//   11. redirigir a cualquier protocolo                       → 37 / 1 (javascript:)
//   12. sin el chequeo de «menos movimiento»                  → 37 / 1
//   13. sin validar slug/ruta antes de leer                   → 37 / 1 (404 sin tocar la base)
//   14. sin validar la forma del token de la vista            → 37 / 1 (ídem)
//   15. la base caída contestando 404                         → 37 / 1 (503, nunca 404)
//   16. CACHE_PUBLICO con max-age=600                         → 37 / 1 (el valor, literal)
//   17. sin el 304                                            → 37 / 1
//   18. el 308 perdiendo la query                             → 37 / 1 (los utm_*)
//   19. tokenDelPixel sin la lectura estricta                 → 37 / 1
//   20. documentoPublico pidiendo el token también en vista   → 37 / 1
//   21. '/l' fuera de PUBLICOS                                → 36 / 2 (acá y en rutas-publicas)
//   22. app/l/[slug]/route.ts exportando POST                 → 37 / 1
//   23. la ruta de la vista entrando como 'pagina'            → 37 / 1
//   24. el mensaje escrito adentro sin des-ocultar            → 37 / 1
//   25. la hoja de hoy en vez de la congelada en la foto      → 37 / 1
//   26. las animaciones de la foto ignoradas                  → 37 / 1
//   27. el prefijo del bucket armado por su cuenta            → 37 / 1
// Restaurado: 38 / 0. La 3 y la 4 SOLAS daban 34 / 0 antes de agregar «las DOS capas»: cada
// capa frenaba por la otra, y una capa que se puede romper en verde no tiene red.
// =============================================================================
