// La FOTO de la copia idéntica cuando no sale (29/10/2026). El ticket de Martín (ws9, /web-generator/68, «Replicar»):
// «No pude sacar la foto de la página. Vuelve a intentar.» replicando https://100ads.ai/. Medido con la ventana aislada
// de verdad (Chrome sin ventana, la misma `responderPaginaLector`):
//   · la CAUSA: `sinRastreadores` sacaba dos pedazos del árbol de la app de Next (`self.__next_f.push`, uno de 113 KB)
//     porque nombran a Facebook y a Clarity; React no podía armar la página («Connection closed», #423), la borraba, y
//     la foto llegaba con el cuerpo vacío. El saneo la tiraba sin decir nada. Con los datos: 684 palabras y la foto;
//   · y el lector cerraba la ventana 300 ms después de mandar la foto: con megas, el mensaje se PERDÍA (2 de 18).
// Lo que se fija acá:
//   1. la ventana del lector deja los DATOS de la página (y saca los rastreadores de verdad); la copia fiel, no;
//   2. el lector (corrido de verdad, con un DOM y un reloj de mentira): la foto sale; si llega el tope antes, la saca
//      IGUAL (parcial); y si no sale, manda el MOTIVO (vacía, la excepción, la página que se fue);
//   3. con la foto, la ventana no se cierra sola a los 300 ms (MaKo la cierra al recibirla);
//   4. el protocolo pasa el motivo saneado, y el de una foto que no pasa el saneo (vacía, grande);
//   5. la pantalla dice el motivo, y «Vuelve a intentar» sólo cuando reintentar sirve.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { scriptLector } from '../lib/editor-landing/lector-script';
import { JS_ANTES_DE_BAJAR, JS_INSTANTANEA, JS_MIRAR_VISIBLES } from '../lib/editor-landing/copia-identica-script';
import { MOTIVOS_SIN_FOTO, sanearMensajeLectura } from '../lib/editor-landing/lector';
import { documentoLector } from '../lib/editor-landing/lector-pagina';
import { esDatosDeLaPagina, sinRastreadores, copiaFiel } from '../lib/editor-landing/replicar-reglas';
import { MENSAJE_SIN_FOTO, mensajeSinFoto } from '../lib/editor-landing/lector-navegador';
import { TOPES_COPIA } from '../lib/editor-landing/copia-identica';

const RAIZ = join(__dirname, '..');
const fuente = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const ID = 'abcdefghijklmnopQRSTUV_-12';
const MAKO = 'https://hola-mako.com';
const URL_L = 'https://100ads.ai/';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Los DATOS de la página se quedan en la ventana del lector
// ─────────────────────────────────────────────────────────────────────────────

// Como lo sirve una app de Next (App Router): el árbol en pedazos que nombran a los rastreadores que carga el layout,
// el `<script>` de verdad de Meta, y el `__NEXT_DATA__` del Pages Router.
const ARBOL = '<script>self.__next_f.push([1,"0:[\\"$\\",\\"$L8\\",null,{\\"children\\":[\\"$\\",\\"script\\",null,{\\"src\\":\\"https://connect.facebook.net/en_US/fbevents.js\\"}]}]"])</script>';
const ARRANQUE = '<script>(self.__next_f=self.__next_f||[]).push([0]);self.__next_f.push([2,null])</script>';
const PEDAZO_CLARITY = '<script>self.__next_f.push([1,"9:[\\"$\\",\\"script\\",null,{\\"children\\":\\"(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){};})(window, document, \\\\\\"clarity\\\\\\", \\\\\\"script\\\\\\");clarity(\\\\\\"set\\\\\\")\\"}]"])</script>';
const DATOS_JSON = '<script id="__NEXT_DATA__" type="application/json">{"props":{"gtm":"googletagmanager.com/gtm.js?id=GTM-ABCD12"}}</script>';
const META = '<script>!function(f,b,e,v,n,t,s){n=f.fbq=function(){};t=b.createElement(e);t.src=v}(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");fbq("init","1")</script>';
const PAGINA_NEXT = `<!DOCTYPE html><html><head><title>100ads</title>${META}</head><body><main><h1>100 anuncios</h1></main>${ARRANQUE}${ARBOL}${PEDAZO_CLARITY}${DATOS_JSON}</body></html>`;

test('1. la ventana del lector deja los DATOS de la página (el árbol de Next, el JSON) y saca el rastreador de verdad', () => {
  for (const d of [ARBOL, ARRANQUE, PEDAZO_CLARITY, DATOS_JSON]) assert.equal(esDatosDeLaPagina(d), true, d.slice(0, 60));
  assert.equal(esDatosDeLaPagina(META), false, 'el script de Meta es código');
  assert.equal(esDatosDeLaPagina('<script>window.self.__next_f_falso = 1; fbq("track")</script>'), false);
  assert.equal(esDatosDeLaPagina('<script type="text/javascript">gtag("config")</script>'), false);

  const doc = documentoLector(PAGINA_NEXT, URL_L, ID, MAKO)!;
  for (const d of [ARBOL, ARRANQUE, PEDAZO_CLARITY, DATOS_JSON]) assert.ok(doc.includes(d), `la ventana lleva ${d.slice(0, 50)}`);
  assert.ok(!doc.includes('fbq("init","1")'), 'el Pixel de Meta de la página no viaja');
  // El preludio (que apaga los rastreadores) va ANTES que cualquier cosa de la página: por eso los datos pueden quedarse.
  assert.ok(doc.indexOf('__mkMudo') < doc.indexOf(ARBOL), 'los rastreadores se apagan antes que la página');

  const sin = sinRastreadores(PAGINA_NEXT);
  for (const d of [ARBOL, PEDAZO_CLARITY, DATOS_JSON]) assert.ok(!sin.includes(d), 'sin `guardarDatos` (la copia fiel, el Diagnóstico) se siguen sacando');
  const fiel = copiaFiel(PAGINA_NEXT, URL_L);
  assert.ok(fiel.ok && !fiel.documentos.join('').includes('connect.facebook.net'), 'la copia fiel no lleva nada que nombre a Meta');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. El lector, corrido de verdad (un DOM y un reloj de mentira)
// ─────────────────────────────────────────────────────────────────────────────

type Mensaje = Record<string, unknown> & { fase?: string; foto?: { cuerpo?: string }; sinFoto?: { motivo: string; detalle?: string }; parcial?: boolean };

/**
 * El lector en un `vm`: la página es un DOM mínimo, `__foto` es lo que devuelve la instantánea (la de verdad necesita un
 * navegador), y el reloj es de mentira. `lento`: los temporizadores corren de a uno por segundo, como en una ventana en
 * segundo plano (Chrome los frena): así una página larga llega al tope ANTES de la foto, como una página lenta.
 */
function lectorDeMentira(o: { foto: () => unknown; alto?: number; lento?: boolean; pideFoto?: boolean; rompeAlBajar?: boolean }) {
  const reloj = { t: 1_000_000, n: 0, cola: [] as Array<{ t: number; id: number; fn: () => void; cada?: number }> };
  const programar = (fn: () => void, ms: number, cada?: number) => {
    const id = ++reloj.n;
    const espera = Math.max(o.lento ? 1000 : 0, Number(ms) || 0);
    reloj.cola.push({ t: reloj.t + espera, id, fn, ...(cada !== undefined ? { cada: espera } : {}) });
    return id;
  };
  const quitar = (id: number) => { reloj.cola = reloj.cola.filter((x) => x.id !== id); };
  const enviados: Mensaje[] = [];
  let cerradaEn: number | null = null;
  const oyentes: Record<string, Array<(e: unknown) => void>> = {};
  const opener = { postMessage: (m: unknown) => { enviados.push(JSON.parse(JSON.stringify(m))); } };
  const alto = o.alto ?? 2_000;
  const vacio = () => [];
  const elemento = () => ({ getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0 }), querySelector: () => null, querySelectorAll: vacio, getAttribute: () => null, childNodes: [], firstChild: null, children: [] });
  const raiz = { ...elemento(), tagName: 'HTML', get scrollHeight() { if (o.rompeAlBajar) throw new Error('el alto se rompió'); return alto; }, clientHeight: 800 };
  const body = { ...elemento(), tagName: 'BODY', nodeType: 1, scrollHeight: alto, innerText: '' };
  const document = {
    readyState: 'complete', title: 'T', baseURI: URL_L, documentElement: raiz, body, head: elemento(),
    querySelector: () => null, querySelectorAll: vacio, getElementsByTagName: vacio, styleSheets: [],
    addEventListener: () => {}, removeEventListener: () => {}, createElement: () => elemento(),
  };
  class DateFalso extends Date { static now() { return reloj.t; } }
  const ctx: Record<string, unknown> = {
    opener, document, Date: DateFalso, Promise, Map, Set, WeakSet, WeakMap, JSON, Math, String, Number, Array, Object, RegExp, Error, Boolean,
    setTimeout: (fn: () => void, ms: number) => programar(fn, ms), clearTimeout: quitar,
    setInterval: (fn: () => void, ms: number) => programar(fn, ms, ms), clearInterval: quitar,
    addEventListener: (tipo: string, f: (e: unknown) => void) => { (oyentes[tipo] ??= []).push(f); },
    removeEventListener: () => {},
    innerHeight: 800, innerWidth: 1280, scrollY: 0, scrollTo: () => {},
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', getPropertyValue: () => '' }),
    MutationObserver: class { observe() {} disconnect() {} },
    navigator: {}, location: { href: URL_L, origin: 'null' },
    close: () => { if (cerradaEn === null) cerradaEn = reloj.t; },
    __foto: o.foto,
  };
  ctx.window = ctx;
  ctx.self = ctx;
  const vm = createContext(ctx);
  // La instantánea y los dos pasos de la foto que necesitan un navegador, cambiados por lo que dice el test.
  const js = scriptLector(ID, 'ventana', MAKO)!
    .split(JS_INSTANTANEA).join('function () { return window.__foto(); }')
    .split(JS_ANTES_DE_BAJAR).join('function () {}')
    .split(JS_MIRAR_VISIBLES).join('function () {}');
  assert.ok(!js.includes(JS_INSTANTANEA) && js.includes('window.__foto()'), 'el lector lleva la instantánea (y acá se cambia)');
  runInContext(js, vm);
  const lanzar = (tipo: string, e: unknown) => { for (const f of oyentes[tipo] ?? []) f(e); };
  const vaciar = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r)); };
  /** Corre el reloj hasta `hastaMs` desde ahora (o hasta que no quede nada), con las promesas resueltas entre paso y paso. */
  const correr = async (hastaMs: number) => {
    const fin = reloj.t + hastaMs;
    for (;;) {
      await vaciar();
      reloj.cola.sort((a, b) => a.t - b.t || a.id - b.id);
      const sig = reloj.cola[0];
      if (!sig || sig.t > fin) break;
      reloj.cola.shift();
      reloj.t = sig.t;
      if (sig.cada !== undefined) reloj.cola.push({ ...sig, t: reloj.t + Math.max(1, sig.cada) });
      sig.fn();
    }
    reloj.t = Math.max(reloj.t, fin);
    await vaciar();
  };
  const dale = () => lanzar('message', { source: opener, origin: MAKO, data: { tipo: 'mako-lectura', id: ID, fase: 'dale', ...(o.pideFoto === false ? {} : { foto: true }) } });
  const t0 = reloj.t;
  return {
    enviados, lanzar, correr, dale,
    fin: () => enviados.find((m) => m.fase === 'fin'),
    cerradaA: () => (cerradaEn === null ? null : cerradaEn - t0),
    ahora: () => reloj.t - t0,
  };
}

const FOTO = () => ({ cuerpo: '<main><h1>100 anuncios</h1></main>', hojas: [], html: {}, body: {} });

test('2a. con la foto pedida, sale; sin pedirla, el final no trae ni foto ni motivo', async () => {
  const l = lectorDeMentira({ foto: FOTO });
  assert.equal(l.enviados[0]?.fase, 'hola');
  l.dale();
  await l.correr(60_000);
  const f = l.fin();
  assert.ok(f, 'llega el final');
  assert.equal(f!.foto?.cuerpo, '<main><h1>100 anuncios</h1></main>');
  assert.equal(f!.parcial, false);
  assert.equal('sinFoto' in f!, false);

  const s = lectorDeMentira({ foto: FOTO, pideFoto: false });
  s.dale();
  await s.correr(60_000);
  const g = s.fin();
  assert.ok(g && !('foto' in g) && !('sinFoto' in g), 'una lectura sin foto no cambia');
});

test('2b. si el tope llega ANTES que la foto (una página larga con los temporizadores frenados), la saca igual', async () => {
  const l = lectorDeMentira({ foto: FOTO, alto: 200_000, lento: true });
  l.dale();
  await l.correr(45_000);
  const f = l.fin();
  assert.ok(f, 'el tope manda el final');
  assert.ok(l.ahora() >= 40_000 && (f!.ms as number) >= 40_000, `el final sale por el tope (${f!.ms} ms)`);
  assert.equal(f!.parcial, true, 'parcial: se cortó la bajada');
  assert.equal(f!.foto?.cuerpo, '<main><h1>100 anuncios</h1></main>', 'pero CON la foto');
  assert.equal('sinFoto' in f!, false);
  await l.correr(120_000);
  assert.equal(l.enviados.filter((m) => m.fase === 'fin').length, 1, 'un solo final, aunque la bajada siga después del tope');
});

test('2c. sin foto, el MOTIVO: vacía, la excepción de la instantánea, la página que se fue, y el tope que tampoco pudo', async () => {
  const vacia = lectorDeMentira({ foto: () => ({ cuerpo: '  \n ', hojas: [] }) });
  vacia.dale();
  await vacia.correr(60_000);
  assert.deepEqual(vacia.fin()!.sinFoto, { motivo: 'vacia' });
  assert.equal('foto' in vacia.fin()!, false, 'una foto sin cuerpo no viaja');

  const rota = lectorDeMentira({ foto: () => { throw new Error('Cannot read properties of null'); } });
  rota.dale();
  await rota.correr(60_000);
  assert.deepEqual(rota.fin()!.sinFoto, { motivo: 'excepcion', detalle: 'Cannot read properties of null' });

  const sale = lectorDeMentira({ foto: FOTO, alto: 200_000 });
  sale.dale();
  await sale.correr(2_000);
  sale.lanzar('pagehide', {});
  assert.deepEqual(sale.fin()!.sinFoto, { motivo: 'salio' });
  assert.equal(sale.fin()!.parcial, true);

  const tarde = lectorDeMentira({ foto: () => { throw new Error('sin DOM'); }, alto: 200_000, lento: true });
  tarde.dale();
  await tarde.correr(45_000);
  assert.deepEqual(tarde.fin()!.sinFoto, { motivo: 'excepcion', detalle: 'sin DOM' }, 'en el tope se intenta y se dice por qué no salió');
});

test('2d. si la lectura se cae antes de la foto, la saca igual; y si tampoco puede, dice las dos cosas en orden', async () => {
  const l = lectorDeMentira({ foto: FOTO, rompeAlBajar: true });
  l.dale();
  await l.correr(60_000);
  assert.equal(l.fin()!.parcial, true);
  assert.equal(l.fin()!.foto?.cuerpo, '<main><h1>100 anuncios</h1></main>', 'la caída no se lleva la foto');

  const dos = lectorDeMentira({ foto: () => ({ cuerpo: '' }), rompeAlBajar: true });
  dos.dale();
  await dos.correr(60_000);
  assert.deepEqual(dos.fin()!.sinFoto, { motivo: 'vacia' }, 'lo que la foto vio manda sobre la caída de antes');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Con la foto, la ventana no se cierra sola enseguida
// ─────────────────────────────────────────────────────────────────────────────

test('3. con la foto, la ventana espera a que MaKo la cierre (un mensaje de megas se PERDÍA a los 300 ms)', async () => {
  const l = lectorDeMentira({ foto: FOTO });
  l.dale();
  await l.correr(60_000);
  const conFoto = l.cerradaA()! - (l.fin()!.ms as number);
  assert.ok(conFoto >= 10_000 && conFoto < 11_000, `con la foto, se cierra sola recién a los 10 s del final (${conFoto} ms)`);

  const s = lectorDeMentira({ foto: FOTO, pideFoto: false });
  s.dale();
  await s.correr(60_000);
  const sinFoto = s.cerradaA()! - (s.fin()!.ms as number);
  assert.ok(sinFoto >= 300 && sinFoto < 1_000, `sin foto, como siempre: a los 300 ms (${sinFoto} ms)`);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. El protocolo: el motivo, saneado
// ─────────────────────────────────────────────────────────────────────────────

const fin = (extra: Record<string, unknown>) => ({ tipo: 'mako-lectura', id: ID, fase: 'fin', camino: 'ventana', titulo: 'T', ms: 1234, quieto: true, parcial: false, piezas: [], ...extra });
const sanear = (extra: Record<string, unknown>) => {
  const m = sanearMensajeLectura(fin(extra), { id: ID, url: URL_L });
  assert.ok(m && m.fase === 'fin');
  return m as Extract<NonNullable<typeof m>, { fase: 'fin' }>;
};

test('4. el protocolo pasa el motivo saneado, y una foto que no pasa el saneo dice por qué', () => {
  assert.deepEqual(MOTIVOS_SIN_FOTO, ['tope', 'vacia', 'excepcion', 'error', 'salio', 'grande', 'otro']);
  assert.deepEqual(sanear({ sinFoto: { motivo: 'excepcion', detalle: '  algo\n se rompió  ' } }).sinFoto, { motivo: 'excepcion', detalle: 'algo se rompió' });
  assert.deepEqual(sanear({ sinFoto: { motivo: 'inventado', detalle: 'x'.repeat(5_000) } }).sinFoto, { motivo: 'otro', detalle: 'x'.repeat(300) }, 'lo que no tiene forma es «otro», y el detalle se corta');
  assert.deepEqual(sanear({ sinFoto: 'cualquier cosa' }).sinFoto, { motivo: 'otro' });
  assert.deepEqual(sanear({ foto: { cuerpo: ' ', hojas: [] } }).sinFoto, { motivo: 'vacia' }, 'la foto vacía de un lector viejo también se nombra');
  assert.deepEqual(sanear({ foto: { cuerpo: 'a'.repeat(TOPES_COPIA.cuerpo + 1), hojas: [] } }).sinFoto, { motivo: 'grande' });
  const con = sanear({ foto: { cuerpo: '<p>hola</p>', hojas: [] }, sinFoto: { motivo: 'tope' } });
  assert.ok(con.foto && !('sinFoto' in con), 'con foto no hay motivo');
  assert.equal('sinFoto' in sanear({}), false, 'sin pedir la foto, nada');
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. La pantalla
// ─────────────────────────────────────────────────────────────────────────────

test('5. la pantalla dice el motivo, y «Vuelve a intentar» sólo cuando reintentar sirve', () => {
  for (const m of MOTIVOS_SIN_FOTO) assert.ok(MENSAJE_SIN_FOTO[m], m);
  const reintenta = MOTIVOS_SIN_FOTO.filter((m) => /Vuelve a intentar/.test(MENSAJE_SIN_FOTO[m]));
  assert.deepEqual(reintenta, ['tope'], 'sólo cuando la página tardó');
  assert.equal(mensajeSinFoto({ motivo: 'vacia' }), 'La página quedó en blanco al abrirla, no hay nada que copiar tal cual.');
  assert.equal(mensajeSinFoto({ motivo: 'excepcion', detalle: 'Cannot read properties of null' }), 'La página no dejó sacarle la foto (Cannot read properties of null).');
  assert.equal(mensajeSinFoto({ motivo: 'error' }), 'La lectura de la página se cortó.');
  assert.equal(mensajeSinFoto(undefined), 'No pude sacar la foto de la página y no sé por qué.');
  assert.ok(!/Vuelve a intentar/.test(mensajeSinFoto(undefined)));

  const pantalla = fuente('app/web-generator/crear/Replicar.tsx');
  assert.ok(!pantalla.includes('No pude sacar la foto de la página. Vuelve a intentar.'), 'el texto de antes, uno para todo, no vuelve');
  assert.match(pantalla, /if \(!l\.ok \|\| !l\.foto\) \{ fallar\(l\.ok \? mensajeSinFoto\(l\.sinFoto\) : l\.mensaje\); return; \}/);
  assert.match(fuente('lib/editor-landing/lector-navegador.ts'), /\.\.\.\(m\.sinFoto \? \{ sinFoto: m\.sinFoto \} : \{\}\)/, 'leerEnNavegador pasa el motivo');
});
