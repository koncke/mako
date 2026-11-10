// «Replicar con la extensión»: la página que el servidor de MaKo no puede bajar, copiada en la pestaña real (9/11/2026, 0.79.0).
//
// Martín (9/11/2026): «habíamos quedado en actualizar la extensión de Mako para que se pueda replicar por allí. Y de esa manera
// siempre vamos a poder replicar cualquier landing». Replicar, «Leer en tu navegador» y «Sus páginas» de Spy dependen de que el
// SERVIDOR baje la página; un antibots, un 403/429 o una app que no corre aislada los frena a los tres. La extensión abre la
// página a la vista, la persona pasa la barrera si la hay y toca el ícono, y la foto de la copia idéntica sale en SU pestaña
// (docs/editor-landing/pendientes-web-generator.md §3.1). Lo que se fija acá:
//   1. el archivo de la extensión sale del fuente (generado) y la regla de esta lectura: sólo baja por la página y vuelve a donde
//      estaba; ni clics, ni foco, ni red, ni cookies; en el mundo aislado y sin permisos nuevos; la política lo dice;
//   2. la lectura, CORRIDA (un DOM y un reloj de mentira): avisa con su nonce, la foto viaja sin la consulta, vuelve a donde
//      estaba la persona; vacía, pesada, una excepción y dos a la vez dicen su motivo;
//   3. la instantánea con `soloDeLaPagina`, corrida con un DOM de mentira: lo que la persona escribió en un campo NO viaja; en
//      la ventana del lector (sin `op`) se copia como antes;
//   4. el worker: abre sólo para una pestaña de MaKo; la lectura sólo cuenta desde ESA pestaña y con SU nonce; la foto se le da
//      a la pantalla que la pidió (y si no hay nadie esperando, se abre Replicar con la entrega); la pestaña se cierra recién
//      cuando MaKo dice que la tomó; si la cierran, la pantalla deja de esperar;
//   5. el puente: el acuse de la foto lista, y los pedidos con su `id`;
//   6. la pantalla: la extensión vieja o ausente, el pedido con su id, la foto que es la verificación de un antibots no se usa,
//      `?replicar=` abre Replicar (Spy) y con `extension=` toma la foto sin leer;
//   7. el cableado: Replicar ofrece la extensión cuando el servidor no la baja y cuando la foto no sale en la ventana, y con la
//      foto de la extensión «Página web» no abre ninguna ventana; «Copiar su sitio» de Spy va a Replicar.
//
// Verificado rompiéndolo (base en verde; cada línea, el test que cae):
//   · la lectura que no vuelve a donde estaba la persona (`irA(x0, y0)` fuera)              → 2
//   · la foto con la dirección con su consulta (sin `sinConsulta`)                          → 2
//   · la instantánea que copia `o.value` también con soloDeLaPagina                         → 3
//   · el worker que acepta la foto con otro nonce                                           → 4
//   · el worker que cierra la pestaña al recibir la foto (antes de que MaKo la tome)         → 4
//   · `juzgarEntrega` sin la verificación de un antibots                                     → 6
//   · `derechaDeQuery` sin `?replicar=`                                                     → 6
//   · «Página web» que abre la ventana aunque ya tenga la foto de la extensión              → 7
// Y lo que agregó la revisión adversarial del mismo día (4c, 6b y lo nuevo de 2 y 3):
//   · la pestaña que se va a otro sitio sigue «pedida» (sin soltarla en onUpdated)           → 4c
//   · una dirección de la red de la persona (sin el chequeo de IP privada)                   → 4, 4b
//   · sin la cola por pestaña                                                                → 4c (⚠️ el pisotón de 4 no se
//     reproduce con un storage de mentira, que contesta en el acto: la cola se probó por lo que ordena, no por la carrera)
//   · «Replicar esta página» desde el inicio con la dirección con su consulta                 → 4b
//   · un campo de texto con su atributo `value` (React lo escribe con lo tipeado)            → 3
//   · una caja editable copiada con lo que tiene                                             → 3
//   · una segunda inyección que contesta «ocupada» en vez de adoptar el nonce                → 2
//   · el latido cada 30 s en vez de 3 (con la página cargando 10 s)                          → 2
//   · el texto visible con lo escrito en un textarea                                         → 2
//
// Correr: node --import tsx --test tests/replicar-extension.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext, runInNewContext } from 'node:vm';
import {
  JS_REPLICA_EN_LA_PESTANA, TOPE_FOTO_EXTENSION, VERSION_REPLICA, archivoDeLaExtension,
} from '../lib/editor-landing/replica-extension-script';
import { JS_INSTANTANEA } from '../lib/editor-landing/copia-identica-script';
import {
  MENSAJE_REPLICA, alEstadoDeReplica, entregaValida, extensionReplica, hrefReplicar, juzgarEntrega, ofertaDeExtension, pedirReplica,
  tomarEntrega, type AvisoReplica, type VentanaReplica,
} from '../lib/editor-landing/replica-extension-cliente';
import { consultaDerecha, derechaDeQuery, urlConVentanaAlAbrir } from '../app/web-generator/panel-reglas';
import { esMasVieja } from '../lib/version-comparar';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const plano = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// 1. El archivo y la regla
// ─────────────────────────────────────────────────────────────────────────────

test('1. el archivo de la extensión sale del fuente, y la lectura sólo baja por la página (sin clics, red ni permisos nuevos)', () => {
  assert.equal(leer('extension/replica-leer.js'), archivoDeLaExtension(), 'extension/replica-leer.js quedó viejo: node --import tsx scripts/sync-replica-extension.mjs');
  const js = archivoDeLaExtension();
  assert.ok(js.includes(JS_INSTANTANEA), 'la extensión lleva la MISMA instantánea que el lector');
  assert.ok(!js.includes('`') && !js.includes('${') && !js.includes('/*'), 'JavaScript plano, sin barra-asterisco (los tests quitan comentarios con una regex)');
  assert.doesNotThrow(() => new Function(`${js}; return MakoReplicaLeer;`)(), 'carga como script clásico');

  const codigo = sinComentarios(JS_REPLICA_EN_LA_PESTANA);
  assert.doesNotMatch(codigo, /\.(?:click|focus|submit|blur)\(|dispatchEvent|fetch\(|XMLHttpRequest|sendBeacon|cookie|localStorage|sessionStorage|indexedDB/,
    'no toca la página, ni pide nada a la red, ni lee lo que el sitio guarda');
  // Lo único que mueve es el scroll, y lo deja donde estaba.
  assert.deepEqual([...codigo.matchAll(/\.(scroll\w*)\(/g)].map((m) => m[1]).filter((x, i, a) => a.indexOf(x) === i), ['scrollTo'], 'sólo `window.scrollTo`');
  assert.match(codigo, /var x0 = window\.scrollX \|\| 0, y0 = window\.scrollY \|\| 0;/);
  assert.match(codigo, /irA\(x0, y0\);\n\s*window\.__mkReplica = 0;\n\s*mandar\(final\);/, 'vuelve a donde estaba ANTES de avisar');
  assert.match(codigo, /instantanea\(\{ soloDeLaPagina: true \}\)/, 'de un campo, sólo lo que trae la página');

  // El desplegable la inyecta con el toque, en el mundo aislado; no es un content script; ningún permiso nuevo.
  const pop = sinComentarios(leer('extension/popup.js'));
  assert.match(pop, /chrome\.scripting\.executeScript\(\{ target: \{ tabId: p\.tabId \}, world: 'ISOLATED', func: MakoReplicaLeer, args: \[\{ nonce: r\.nonce \}\] \}\)/);
  assert.match(leer('extension/popup.html'), /<script src="replica-leer\.js"><\/script>\n<script type="module" src="popup\.js"><\/script>/, 'antes del desplegable');
  const m = JSON.parse(leer('extension/manifest.json')) as { version: string; permissions: string[]; host_permissions: string[]; content_scripts: Array<{ js: string[] }> };
  assert.deepEqual(m.permissions, ['storage', 'alarms', 'webRequest', 'scripting', 'activeTab'], 'un permiso nuevo desactiva la extensión a cada cliente');
  assert.deepEqual(m.host_permissions, ['https://hola-mako.com/*', 'https://labs.google/*', 'https://flow.google.com/*', 'https://aisandbox-pa.googleapis.com/*', 'https://web.whatsapp.com/*']);
  assert.equal(m.content_scripts.flatMap((c) => c.js).includes('replica-leer.js'), false, 'corre sólo con el toque');
  assert.ok(!esMasVieja(m.version, VERSION_REPLICA), 'la pantalla pide una versión más nueva que el paquete');
  assert.ok(leer('extension/injected.js').includes(`VERSION_ESPEJO = '${m.version}'`));

  const pol = leer('app/privacidad/extension/page.tsx');
  assert.match(pol, /<H>Al replicar una página en tu Web Generator<\/H>/);
  assert.match(pol, /<strong>baja por la página<\/strong>/, 'la política dice que se mueve por la página');
  assert.match(pol, /nunca lo que escribiste tú/);
  // La regla vive escrita donde se lee antes de escribir código de la extensión.
  assert.match(leer('AGENTS.md'), /«Replicar esta página» es la ÚNICA lectura que baja por una página ajena/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. La lectura en la pestaña, corrida
// ─────────────────────────────────────────────────────────────────────────────

type Msj = Record<string, unknown> & { tipo?: string; nonce?: string; ok?: boolean; motivo?: string; foto?: Record<string, unknown>; texto?: string; url?: string };

/** La lectura en un `vm`: la página es un DOM mínimo, `__foto` lo que devuelve la instantánea, y el reloj es de mentira. */
function pestanaDeMentira(o: { foto: (op: unknown) => unknown; alto?: number; href?: string; y0?: number; texto?: string; escritos?: Array<Record<string, unknown>>; cargando?: boolean }) {
  const reloj = { t: 1_000_000, n: 0, cola: [] as Array<{ t: number; id: number; fn: () => void }> };
  const programar = (fn: () => void, ms: number) => { const id = ++reloj.n; reloj.cola.push({ t: reloj.t + Math.max(0, Number(ms) || 0), id, fn }); return id; };
  const quitar = (id: number) => { reloj.cola = reloj.cola.filter((x) => x.id !== id); };
  // El latido (setInterval): se reprograma solo hasta que lo paran.
  const vivos = new Set<number>();
  const cada = (fn: () => void, ms: number) => {
    const id = ++reloj.n;
    vivos.add(id);
    const tick = () => { if (!vivos.has(id)) return; fn(); reloj.cola.push({ t: reloj.t + ms, id, fn: tick }); };
    reloj.cola.push({ t: reloj.t + ms, id, fn: tick });
    return id;
  };
  const parar = (id: number) => { vivos.delete(id); quitar(id); };
  const mensajes: Msj[] = [];
  const scrolls: Array<[number, number]> = [];
  const alto = o.alto ?? 4_000;
  const href = o.href ?? 'https://beacons.ai/denborg?utm_source=ig&email=a%40b.com#arriba';
  const document = {
    readyState: o.cargando ? 'loading' : 'complete', title: 'Den Borg', baseURI: href,
    documentElement: { scrollHeight: alto }, body: { scrollHeight: alto, innerText: o.texto ?? '  Den Borg\n\n  Marca Personal 360  ' },
    querySelectorAll: () => o.escritos ?? [],
  };
  class DateFalso extends Date { static now() { return reloj.t; } }
  const ctx: Record<string, unknown> = {
    document, Date: DateFalso, Promise, Map, Set, JSON, Math, String, Number, Array, Object, RegExp, Error, URL,
    setTimeout: (fn: () => void, ms: number) => programar(fn, ms), clearTimeout: quitar, setInterval: cada, clearInterval: parar,
    addEventListener: () => {}, MutationObserver: class { observe() {} disconnect() {} },
    innerHeight: 800, scrollX: 0, scrollY: o.y0 ?? 1_234,
    scrollTo: (a: unknown, b?: number) => { if (typeof a === 'object' && a) { const x = a as { left: number; top: number }; scrolls.push([x.left, x.top]); } else scrolls.push([Number(a), Number(b)]); },
    getComputedStyle: () => ({ opacity: '1', visibility: 'visible', display: 'block', transform: 'none' }),
    location: { href },
    chrome: { runtime: { sendMessage: (m: Msj, cb?: () => void) => { mensajes.push({ ...plano(m), _t: reloj.t }); cb?.(); }, lastError: undefined } },
    __foto: o.foto,
  };
  ctx.window = ctx;
  createContext(ctx);
  // Lo de la página que necesita un navegador de verdad, cambiado por lo que dice el test.
  const js = JS_REPLICA_EN_LA_PESTANA.split(JS_INSTANTANEA).join('function (op) { return window.__foto(op); }');
  assert.ok(!js.includes(JS_INSTANTANEA) && js.includes('window.__foto(op)'));
  const leerPagina = runInContext(`(${js})`, ctx) as (op: unknown) => Record<string, unknown>;
  const vaciar = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };
  const correr = async (hastaMs: number) => {
    const fin = reloj.t + hastaMs;
    for (;;) {
      await vaciar();
      reloj.cola.sort((a, b) => a.t - b.t || a.id - b.id);
      const sig = reloj.cola[0];
      if (!sig || sig.t > fin) break;
      reloj.cola.shift();
      reloj.t = sig.t;
      sig.fn();
    }
    reloj.t = Math.max(reloj.t, fin);
    await vaciar();
  };
  return { leerPagina, correr, mensajes, scrolls };
}

const FOTO = (base: string) => ({ url: base, base, titulo: 'Den Borg', cuerpo: '<main><h1>Den Borg</h1></main>', hojas: [{ css: 'h1{}', base }, { href: 'https://cdn.example.com/a.css' }], html: {}, body: {}, ancho: 1280, medidas: {} });

test('2. la lectura, corrida: avisa con su nonce, la foto va sin la consulta, y vuelve a donde estaba la persona', async () => {
  let op: unknown = null;
  const p = pestanaDeMentira({
    foto: (x) => { op = x; return FOTO('https://beacons.ai/denborg?utm_source=ig&email=a%40b.com'); },
    // Lo que la persona escribió en el chat de la página aparece en el texto visible: no viaja.
    texto: '  Den Borg\n\n  Marca Personal 360  \nMi consulta privada para el chat',
    escritos: [{ tagName: 'TEXTAREA', value: 'Mi consulta privada para el chat' }, { tagName: 'DIV', innerText: 'ok' }],
    // La página no termina de cargar: la lectura espera hasta 10 s sin otro aviso que el latido.
    cargando: true,
  });
  assert.deepEqual(plano(p.leerPagina({ nonce: 'n1' })), { ok: true, empezo: true }, 'contesta en el acto y sigue sola');
  // Una segunda inyección (el worker no la oía y acuñó otro nonce) no arranca otra: la que corre sigue, con el nonce nuevo.
  assert.deepEqual(plano(p.leerPagina({ nonce: 'n2' })), { ok: true, empezo: false, adoptada: true }, 'dos a la vez no');
  await p.correr(120_000);
  assert.deepEqual(plano(op), { soloDeLaPagina: true });
  assert.equal(p.mensajes[0]!.nonce, 'n1');
  assert.ok(p.mensajes.slice(1).every((m) => m.nonce === 'n2'), 'después, todo con el nonce que adoptó (el que el worker espera)');
  // El latido: nunca más de 3 s sin noticias (el worker da por cortada una lectura callada 20 s).
  const huecos = p.mensajes.slice(1).map((m, i) => Number(m._t) - Number(p.mensajes[i]!._t));
  assert.ok(Math.max(...huecos) <= 3_000, `el hueco más largo fue ${Math.max(...huecos)} ms`);
  assert.ok(p.mensajes.some((m) => m.tipo === 'REPLICA_AVANCE' && m.fase === 'bajando'), 'cuenta cómo va mientras baja');
  const fin = p.mensajes.at(-1)!;
  assert.equal(fin.tipo, 'REPLICA_FOTO');
  assert.equal(fin.ok, true);
  assert.equal(fin.url, 'https://beacons.ai/denborg', 'sin la consulta ni el ancla');
  assert.equal((fin.foto as { url: string }).url, 'https://beacons.ai/denborg');
  assert.deepEqual((fin.foto as { hojas: Array<{ base?: string }> }).hojas.map((h) => h.base ?? null), [null, null].map((_, i) => (i === 0 ? 'https://beacons.ai/denborg' : null)), 'la base de una hoja tampoco lleva la consulta');
  assert.equal(fin.texto, 'Den Borg\nMarca Personal 360', 'el texto que se ve, limpio y sin lo escrito por la persona');
  // Bajó, volvió arriba para la foto y la dejó donde estaba.
  assert.ok(p.scrolls.length > 3 && p.scrolls.some(([, y]) => y > 2_000), 'bajó por la página');
  assert.deepEqual(p.scrolls.at(-2), [0, 0], 'arriba de todo para la foto');
  assert.deepEqual(p.scrolls.at(-1), [0, 1_234], 'y la deja donde la tenía la persona');
  // Terminó (y el latido paró): otra vuelta se puede.
  const antes = p.mensajes.length;
  await p.correr(30_000);
  assert.equal(p.mensajes.length, antes, 'sin latidos después de terminar');
  assert.deepEqual(plano(p.leerPagina({ nonce: 'n3' })), { ok: true, empezo: true });
});

test('2b. la lectura: vacía, pesada y una excepción dicen su motivo, y la página vuelve a donde estaba igual', async () => {
  for (const [foto, motivo] of [
    [() => ({ ...FOTO('https://x.example.com/'), cuerpo: '   ' }), 'vacia'],
    [() => ({ ...FOTO('https://x.example.com/'), cuerpo: 'x'.repeat(TOPE_FOTO_EXTENSION + 10) }), 'pesada'],
    [() => { throw new Error('se rompió'); }, 'excepcion'],
  ] as const) {
    const p = pestanaDeMentira({ foto, alto: 1_000, href: 'https://x.example.com/', y0: 77 });
    p.leerPagina({ nonce: 'n' });
    await p.correr(120_000);
    const fin = p.mensajes.at(-1)!;
    assert.equal(fin.tipo, 'REPLICA_FOTO');
    assert.equal(fin.ok, false, motivo);
    assert.equal(fin.motivo, motivo);
    assert.equal(fin.foto, undefined, `${motivo}: sin foto`);
    assert.deepEqual(p.scrolls.at(-1), [0, 77], `${motivo}: la deja donde estaba`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. La instantánea con soloDeLaPagina, corrida con un DOM de mentira
// ─────────────────────────────────────────────────────────────────────────────

/** Un elemento de mentira con lo que usa la instantánea: atributos, hijos, clonar, reemplazar y serializar. */
class Nodo {
  tagName: string;
  nodeType = 1;
  attrs = new Map<string, string>();
  childNodes: Array<Nodo | Texto> = [];
  parentNode: Nodo | null = null;
  style: Record<string, string> = {};
  value = '';
  defaultValue = '';
  options: Array<{ text: string; defaultSelected: boolean }> = [];
  selectedIndex = 0;
  constructor(tag: string, attrs: Record<string, string> = {}, hijos: Array<Nodo | Texto> = []) {
    this.tagName = tag.toUpperCase();
    for (const [k, v] of Object.entries(attrs)) this.attrs.set(k, v);
    for (const h of hijos) this.appendChild(h);
  }
  get attributes() { return [...this.attrs].map(([name, value]) => ({ name, value })); }
  get children() { return this.childNodes.filter((n): n is Nodo => n instanceof Nodo); }
  get firstChild() { return this.childNodes[0] ?? null; }
  get isContentEditable(): boolean {
    for (let n: Nodo | null = this; n; n = n.parentNode) { const v = n.getAttribute('contenteditable'); if (v !== null) return v !== 'false'; }
    return false;
  }
  getAttribute(n: string) { return this.attrs.has(n) ? this.attrs.get(n)! : null; }
  setAttribute(n: string, v: string) { this.attrs.set(n, String(v)); }
  removeAttribute(n: string) { this.attrs.delete(n); }
  hasAttribute(n: string) { return this.attrs.has(n); }
  appendChild(n: Nodo | Texto) { if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = this; this.childNodes.push(n); return n; }
  removeChild(n: Nodo | Texto) { this.childNodes = this.childNodes.filter((x) => x !== n); n.parentNode = null; return n; }
  insertBefore(n: Nodo | Texto, ref: Nodo | Texto) { if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = this; this.childNodes.splice(this.childNodes.indexOf(ref), 0, n); return n; }
  replaceChild(nuevo: Nodo | Texto, viejo: Nodo | Texto) { if (nuevo.parentNode) nuevo.parentNode.removeChild(nuevo); const i = this.childNodes.indexOf(viejo); this.childNodes[i] = nuevo; nuevo.parentNode = this; viejo.parentNode = null; return viejo; }
  set textContent(t: string) { this.childNodes = []; this.appendChild(new Texto(t)); }
  querySelectorAll(sel: string): Nodo[] {
    const todos: Nodo[] = [];
    const andar = (n: Nodo) => { for (const h of n.children) { todos.push(h); andar(h); } };
    andar(this);
    if (sel === '*') return todos;
    const tags = sel.split(',').map((s) => s.trim()).filter((s) => /^[a-z]+$/.test(s)).map((s) => s.toUpperCase());
    return todos.filter((n) => tags.includes(n.tagName));
  }
  cloneNode(): Nodo {
    const c = new Nodo(this.tagName.toLowerCase(), Object.fromEntries(this.attrs));
    for (const h of this.childNodes) c.appendChild(h instanceof Nodo ? h.cloneNode() : new Texto(h.texto));
    return c;
  }
  getBoundingClientRect() { return { top: 0, bottom: 10, left: 0, width: 10, height: 10 }; }
  get innerHTML(): string { return this.childNodes.map((n) => (n instanceof Nodo ? n.outerHTML : n.texto)).join(''); }
  get outerHTML(): string { const t = this.tagName.toLowerCase(); const a = this.attributes.map((x) => ` ${x.name}="${x.value}"`).join(''); return `<${t}${a}>${this.innerHTML}</${t}>`; }
}
class Texto { nodeType = 3; parentNode: Nodo | null = null; constructor(public texto: string) {} }

function instantaneaConCampos(op?: unknown): string {
  const email = new Nodo('input', { type: 'email', value: 'de-la-pagina@ejemplo.com', placeholder: 'Tu correo' });
  email.value = 'lo-que-escribi@persona.com';
  const vacio = new Nodo('input', { type: 'text', placeholder: 'Tu nombre' });
  vacio.value = 'Persona Que Escribio';
  const nota = new Nodo('textarea', {});
  nota.defaultValue = 'Texto de fábrica';
  nota.value = 'Mi mensaje privado';
  const pais = new Nodo('select', {});
  pais.options = [{ text: 'Elige tu país', defaultSelected: true }, { text: 'Uruguay', defaultSelected: false }];
  pais.selectedIndex = 1;
  const boton = new Nodo('input', { type: 'submit', value: 'Quiero mi lugar' });
  boton.value = 'Quiero mi lugar';
  // React escribe lo tipeado en el ATRIBUTO value de un input controlado, también en uno de contraseña.
  const clave = new Nodo('input', { type: 'password', value: 'MiClaveSecreta1' });
  clave.value = 'MiClaveSecreta1';
  const chat = new Nodo('div', { contenteditable: 'true', class: 'chat' }, [new Texto('Lo que escribí en el chat')]);
  const body = new Nodo('body', {}, [new Nodo('main', {}, [email, vacio, nota, pais, boton, clave, chat])]);
  const html = new Nodo('html', {}, [body]);
  const document = {
    baseURI: 'https://pagina.example.com/', title: 'T', body, documentElement: html, styleSheets: [], adoptedStyleSheets: [],
    createElement: (t: string) => new Nodo(t), createElementNS: (_: string, t: string) => new Nodo(t), getElementById: () => null,
  };
  const ctx: Record<string, unknown> = {
    document, location: { href: 'https://pagina.example.com/' }, innerWidth: 1280, URL, Set, Map, Array, String, Object, Math, Infinity,
    getComputedStyle: () => ({ position: 'static', display: 'block', getPropertyValue: () => '', color: 'gray', backgroundColor: '', backgroundImage: 'none' }),
  };
  ctx.window = ctx;
  const r = runInNewContext(`(${JS_INSTANTANEA})(${op === undefined ? '' : JSON.stringify(op)})`, ctx) as { cuerpo: string };
  return r.cuerpo;
}

test('3. con soloDeLaPagina, lo que la persona escribió en un campo no viaja; en la ventana del lector se copia como antes', () => {
  const real = instantaneaConCampos({ soloDeLaPagina: true });
  // El atributo `value` y el `defaultValue` de un textarea también pueden ser lo tipeado (React): de un campo de texto sale
  // sólo su placeholder (revisión adversarial del 9/11/2026).
  for (const privado of ['lo-que-escribi@persona.com', 'Persona Que Escribio', 'Mi mensaje privado', 'Uruguay', 'de-la-pagina@ejemplo.com', 'Texto de fábrica', 'MiClaveSecreta1', 'Lo que escribí en el chat']) {
    assert.ok(!real.includes(privado), `«${privado}» no viaja`);
  }
  assert.ok(real.includes('Tu correo') && real.includes('Tu nombre'), 'un campo de texto muestra su placeholder');
  assert.ok(real.includes('Elige tu país'), 'la opción de fábrica');
  assert.ok(real.includes('Quiero mi lugar'), 'el texto de un botón es de la página');
  assert.match(real, /<div class="chat"><\/div>/, 'la caja editable queda, vacía y sin contenteditable');
  const lector = instantaneaConCampos();
  assert.ok(lector.includes('lo-que-escribi@persona.com') && lector.includes('Uruguay') && lector.includes('Lo que escribí en el chat'), 'sin `op` (la ventana del lector, donde nadie escribe) como antes');
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. El worker
// ─────────────────────────────────────────────────────────────────────────────

function cargarWorker() {
  const bg = leer('extension/background.js');
  const ayudas = bg.slice(bg.indexOf('function esUrlDeMaKo(url) {'), bg.indexOf('/** Las pestañas de la app de MaKo: sin la ventana de lectura'));
  const replicas = bg.slice(bg.indexOf('// ── «Replicar esta página» (0.79.0, 9/11/2026)'), bg.indexOf('// ── WhatsApp Web, lista para leer'));
  const tope = bg.slice(bg.indexOf('function conTope(promesa, ms) {'), bg.indexOf('\n}\n', bg.indexOf('function conTope(promesa, ms) {')) + 3);
  const bloques = bg.slice(bg.indexOf("  // «Replicar con la extensión» desde Replicar del Web Generator (0.79.0)"), bg.indexOf('  // «Capturar» desde «Sus páginas» de Spy (0.76.0, 4/11/2026).'));
  assert.ok(ayudas.length > 200 && replicas.length > 1_000 && tope.length > 50 && bloques.length > 2_000, 'los recortes del worker');
  const reg = {
    session: {} as Record<string, unknown>, creadas: [] as Array<Record<string, unknown>>, cerradas: [] as number[], activadas: [] as number[],
    aTabs: [] as Array<[number, Record<string, unknown>]>, alCerrar: null as null | ((id: number) => void), acuse: true,
    alCambiar: null as null | ((id: number, info: Record<string, unknown>, tab: unknown) => void), alDesplegable: [] as Array<Record<string, unknown>>,
  };
  const tabs: Array<{ id: number; windowId: number; url: string; index?: number }> = [{ id: 5, windowId: 1, url: 'https://hola-mako.com/web-generator?vista=replicar&ws=13', index: 2 }];
  const fakeChrome = {
    runtime: { id: 'mako' },
    tabs: {
      create: async (o: Record<string, unknown>) => { reg.creadas.push(plano(o)); const t = { id: 40 + reg.creadas.length, windowId: 1, url: String(o.url) }; tabs.push(t); return t; },
      remove: async (id: number) => { reg.cerradas.push(id); },
      get: async (id: number) => tabs.find((t) => t.id === id) ?? null,
      update: async (id: number, o: Record<string, unknown>) => { if (o.active) reg.activadas.push(id); },
      sendMessage: async (id: number, m: Record<string, unknown>) => { reg.aTabs.push([id, plano(m)]); return m.tipo === 'REPLICA_LISTA' ? { recibida: reg.acuse } : undefined; },
      onRemoved: { addListener: (fn: (id: number) => void) => { reg.alCerrar = fn; } },
      onUpdated: { addListener: (fn: (id: number, info: Record<string, unknown>, tab: unknown) => void) => { reg.alCambiar = fn; } },
    },
    windows: { update: async () => {} },
    storage: { session: {
      get: async (k: string) => (k in reg.session ? { [k]: plano(reg.session[k]) } : {}),
      set: async (o: Record<string, unknown>) => { Object.assign(reg.session, plano(o)); },
      remove: async (k: string | string[]) => { for (const x of Array.isArray(k) ? k : [k]) delete reg.session[x]; },
      getKeys: async () => Object.keys(reg.session),
    } },
  };
  (fakeChrome.runtime as Record<string, unknown>).sendMessage = async (m: Record<string, unknown>) => { reg.alDesplegable.push(plano(m)); };
  const ctx: Record<string, unknown> = { chrome: fakeChrome, URL, URLSearchParams, console, crypto: globalThis.crypto, Uint8Array, Array, setTimeout, Promise, instalacionDeDesarrollo: false };
  runInNewContext(`${ayudas}\n${tope}\n${replicas}\nglobalThis.atender = (msg, _s, responder) => {\n${bloques}\n  return false;\n};`, ctx);
  const atender = ctx.atender as (m: unknown, s: unknown, r: (x: unknown) => void) => boolean;
  const pedir = (m: Record<string, unknown>, s: unknown) => new Promise<unknown>((resolve) => {
    const asinc = atender(m, s, (x) => resolve(plano(x)));
    if (!asinc) setTimeout(() => resolve('sin respuesta'), 30);
  });
  /** La foto guardada (una sola en estos casos), la pendiente de una pestaña, y la pestaña que navega. */
  const entrega = () => Object.entries(reg.session).filter(([k]) => k.startsWith('replicaEntrega:')).map(([, v]) => v as Record<string, unknown>)[0];
  const pendiente = (id: number) => reg.session[`replica:${id}`] as Record<string, unknown> | undefined;
  const navegar = async (id: number, url: string, completo = true) => {
    const t = tabs.find((x) => x.id === id)!;
    t.url = url;
    reg.alCambiar!(id, { url }, t);
    if (completo) reg.alCambiar!(id, { status: 'complete' }, t);
    await esperar(10);
  };
  return { reg, pedir, tabs, entrega, pendiente, navegar };
}
const DE_MAKO = { tab: { id: 5, index: 2, url: 'https://hola-mako.com/web-generator?vista=replicar&ws=13' }, url: 'https://hola-mako.com/web-generator?vista=replicar&ws=13', id: 'mako' };
const DEL_POPUP = { id: 'mako' };
const DE_LA_PESTANA = (id: number) => ({ id: 'mako', tab: { id, url: 'https://beacons.ai/denborg' } });

test('4. el worker: abre para MaKo, la foto sólo de ESA pestaña con SU nonce, y la pestaña se cierra cuando la réplica salió', async () => {
  const w = cargarWorker();
  const pagina = 'https://beacons.page/denborg';
  // De otra página, con basura o a la red de la persona, nada se abre.
  assert.deepEqual(await w.pedir({ tipo: 'REPLICA_ABRIR', pedido: 'r1abc', url: pagina }, { tab: { id: 9, url: 'https://otro.example.com/' }, url: 'https://otro.example.com/' }), { ok: false, motivo: 'origen' });
  assert.deepEqual(await w.pedir({ tipo: 'REPLICA_ABRIR', pedido: 'r1abc', url: 'javascript:alert(1)' }, DE_MAKO), { ok: false, motivo: 'destino' });
  for (const privada of ['http://192.168.0.1/', 'http://10.0.0.5/admin', 'http://router/', 'http://127.0.0.1:3000/', 'http://intranet.local/', 'https://hola-mako.com/api/x', 'https://web.whatsapp.com/']) {
    assert.deepEqual(await w.pedir({ tipo: 'REPLICA_ABRIR', pedido: 'r1abc', url: privada }, DE_MAKO), { ok: false, motivo: 'destino' }, privada);
  }
  assert.equal(w.reg.creadas.length, 0);

  assert.deepEqual(await w.pedir({ tipo: 'REPLICA_ABRIR', pedido: 'r1abc', url: pagina }, DE_MAKO), { ok: true });
  assert.deepEqual(w.reg.creadas, [{ url: pagina, active: true, openerTabId: 5, index: 3 }], 'a la vista, al lado de MaKo');
  const tabId = 41;
  // Beacons redirige a .ai al cargar: es la misma página (el salto de una redirección se adopta).
  await w.navegar(tabId, 'https://beacons.ai/denborg');
  assert.equal(w.pendiente(tabId)?.sitio, 'beacons.ai');
  assert.deepEqual(await w.pedir({ tipo: 'REPLICA_PENDIENTE', tabId }, DEL_POPUP), { tabId, url: pagina, pedida: true }, 'tocar el ícono ahí es copiarla');
  assert.deepEqual(await w.pedir({ tipo: 'REPLICA_EMPEZAR', tabId }, DE_MAKO), { ok: false, motivo: 'origen' }, 'sólo el desplegable');
  const emp = await w.pedir({ tipo: 'REPLICA_EMPEZAR', tabId }, DEL_POPUP) as { ok: boolean; nonce: string };
  assert.equal(emp.ok, true);
  assert.match(emp.nonce, /^[0-9a-f]{24}$/);
  assert.deepEqual(await w.pedir({ tipo: 'REPLICA_EMPEZAR', tabId }, DEL_POPUP), { ok: true, nonce: emp.nonce, yaLeyendo: true }, 'tocar otra vez no la arranca de nuevo');

  // El avance y la foto: con otro nonce, o desde otra pestaña, no cuentan.
  await w.pedir({ tipo: 'REPLICA_AVANCE', nonce: emp.nonce, hecho: 40 }, DE_LA_PESTANA(tabId));
  await esperar(10);
  assert.deepEqual(w.reg.aTabs.at(-1), [5, { tipo: 'REPLICA_ESTADO', pedido: 'r1abc', fase: 'leyendo', hecho: 40 }]);
  const FOTO_OK = { tipo: 'REPLICA_FOTO', ok: true, foto: { cuerpo: '<h1>Den Borg</h1>' }, texto: 'Den Borg', titulo: 'Den Borg', url: 'https://beacons.ai/denborg' };
  await w.pedir({ ...FOTO_OK, nonce: 'otro' }, DE_LA_PESTANA(tabId));
  await w.pedir({ ...FOTO_OK, nonce: emp.nonce }, DE_LA_PESTANA(99));
  await esperar(10);
  assert.equal(w.entrega(), undefined, 'ninguna foto ajena se guarda');

  // Un aviso tardío que llega pegado a la foto no la pisa (una cola por pestaña): queda «lista».
  void w.pedir({ tipo: 'REPLICA_AVANCE', nonce: emp.nonce, hecho: 90 }, DE_LA_PESTANA(tabId));
  void w.pedir({ ...FOTO_OK, nonce: emp.nonce }, DE_LA_PESTANA(tabId));
  await esperar(30);
  assert.equal(w.pendiente(tabId)?.estado, 'lista');
  const e = w.entrega() as { entrega: string; url: string; leida: string };
  assert.ok(entregaValida(e.entrega));
  assert.equal(e.url, pagina, 'la dirección que se pidió');
  assert.equal(e.leida, 'https://beacons.ai/denborg');
  assert.deepEqual(w.reg.alDesplegable.at(-1), { tipo: 'REPLICA_GUARDADA', nonce: emp.nonce, ok: true }, '«Copiada» se dice con la foto guardada');
  assert.deepEqual(w.reg.aTabs.at(-1), [5, { tipo: 'REPLICA_LISTA', pedido: 'r1abc', entrega: e.entrega }], 'se le avisa a la pantalla que la pidió');
  assert.deepEqual(w.reg.activadas, [5], 'y se la pone al frente');
  assert.deepEqual(w.reg.cerradas, [], 'la pestaña sigue abierta hasta que la réplica sale');

  // MaKo la toma (desde una pestaña de MaKo), y recién al soltarla se cierra la pestaña.
  assert.deepEqual(await w.pedir({ tipo: 'REPLICA_TOMAR', entrega: e.entrega }, { tab: { id: 9, url: 'https://otro.example.com/' } }), { ok: false, motivo: 'origen' });
  const tomada = await w.pedir({ tipo: 'REPLICA_TOMAR', entrega: e.entrega }, DE_MAKO) as Record<string, unknown>;
  assert.equal(tomada.ok, true);
  assert.deepEqual(tomada.foto, { cuerpo: '<h1>Den Borg</h1>' });
  assert.deepEqual(await w.pedir({ tipo: 'REPLICA_TOMAR', entrega: 'f'.repeat(24) }, DE_MAKO), { ok: false, motivo: 'vencida' });
  assert.deepEqual(await w.pedir({ tipo: 'REPLICA_SOLTAR', entrega: e.entrega }, DE_MAKO), { ok: true });
  await esperar(10);
  assert.deepEqual(w.reg.cerradas, [tabId], 'la abrió la extensión y sigue en el sitio: se cierra');
  assert.equal(w.entrega(), undefined, 'y la foto se borra');
  assert.equal(w.pendiente(tabId), undefined);
});

test('4b. el worker: sin nadie esperando, abre Replicar con la entrega; era la verificación: vuelve a la pestaña; la cierran: avisa', async () => {
  const w = cargarWorker();
  w.reg.acuse = false;
  await w.pedir({ tipo: 'REPLICA_ABRIR', pedido: 'r2abc', url: 'https://lovable.dev/' }, DE_MAKO);
  const tabId = 41;
  const { nonce } = await w.pedir({ tipo: 'REPLICA_EMPEZAR', tabId }, DEL_POPUP) as { nonce: string };
  await w.pedir({ tipo: 'REPLICA_FOTO', nonce, ok: true, foto: { cuerpo: '<h1>Just a moment...</h1>' }, titulo: 'Just a moment...', url: 'https://lovable.dev/' }, DE_LA_PESTANA(tabId));
  await esperar(20);
  const e = w.entrega() as { entrega: string };
  assert.deepEqual(w.reg.creadas.at(-1), { url: `https://hola-mako.com/web-generator?replicar=${encodeURIComponent('https://lovable.dev/')}&extension=${e.entrega}&ws=13`, active: true },
    'la pantalla se fue a otra cosa: Replicar en una pestaña nueva, en el mismo negocio');

  // MaKo vio la verificación: la foto se tira y la pestaña vuelve al frente, lista para otro toque.
  assert.deepEqual(await w.pedir({ tipo: 'REPLICA_VOLVER', entrega: e.entrega, pedido: 'r9nuevo' }, DE_MAKO), { ok: true });
  assert.equal(w.entrega(), undefined);
  const p = w.pendiente(tabId) as { estado: string; pedido: string };
  assert.deepEqual({ estado: p.estado, pedido: p.pedido }, { estado: 'abierta', pedido: 'r9nuevo' });
  assert.ok(w.reg.activadas.includes(tabId));

  // La cierra sin replicar: la pantalla deja de esperar.
  w.reg.alCerrar!(tabId);
  await esperar(20);
  assert.deepEqual(w.reg.aTabs.at(-1), [5, { tipo: 'REPLICA_ESTADO', pedido: 'r9nuevo', fase: 'cerrada' }]);

  // «Replicar esta página» desde el inicio, en una pestaña que la persona abrió: sin pedido, la dirección sin su consulta, y
  // no se cierra al soltar.
  w.tabs.push({ id: 60, windowId: 1, url: 'https://www.vidalytics.com/precios?utm_source=ig&email=a%40b.com#planes' });
  assert.deepEqual(await w.pedir({ tipo: 'REPLICA_PUEDE', tabId: 60 }, DEL_POPUP), { tabId: 60, url: 'https://www.vidalytics.com/precios' });
  assert.equal(await w.pedir({ tipo: 'REPLICA_PENDIENTE', tabId: 60 }, DEL_POPUP), null, 'nadie la pidió');
  const r = await w.pedir({ tipo: 'REPLICA_EMPEZAR', tabId: 60 }, DEL_POPUP) as { nonce: string };
  await w.pedir({ tipo: 'REPLICA_FOTO', nonce: r.nonce, ok: true, foto: { cuerpo: '<h1>Vidalytics</h1>' }, url: 'https://www.vidalytics.com/precios' }, DE_LA_PESTANA(60));
  await esperar(20);
  const e2 = w.entrega() as { entrega: string };
  assert.deepEqual(w.reg.creadas.at(-1), { url: `https://hola-mako.com/web-generator?replicar=${encodeURIComponent('https://www.vidalytics.com/precios')}&extension=${e2.entrega}`, active: true });
  await w.pedir({ tipo: 'REPLICA_SOLTAR', entrega: e2.entrega }, DE_MAKO);
  assert.ok(!w.reg.cerradas.includes(60), 'la abrió la persona: no se cierra');
  // Una pestaña de MaKo o de la red de la persona no se replica.
  w.tabs.push({ id: 61, windowId: 1, url: 'https://hola-mako.com/crm' }, { id: 62, windowId: 1, url: 'http://192.168.1.1/' });
  assert.deepEqual(await w.pedir({ tipo: 'REPLICA_EMPEZAR', tabId: 61 }, DEL_POPUP), { ok: false, motivo: 'destino' });
  assert.deepEqual(await w.pedir({ tipo: 'REPLICA_EMPEZAR', tabId: 62 }, DEL_POPUP), { ok: false, motivo: 'destino' });
  assert.equal(await w.pedir({ tipo: 'REPLICA_PUEDE', tabId: 62 }, DEL_POPUP), null);
});

test('4c. el worker: si la persona lleva la pestaña a OTRO sitio, la pendiente se suelta (tocar el ícono ahí no copia nada para MaKo)', async () => {
  const w = cargarWorker();
  await w.pedir({ tipo: 'REPLICA_ABRIR', pedido: 'r3abc', url: 'https://lovable.dev/' }, DE_MAKO);
  const tabId = 41;
  await w.navegar(tabId, 'https://lovable.dev/');
  // Pasó el rato de las redirecciones: un cambio de sitio ya es «se fue».
  (w.pendiente(tabId) as { cargoAt: number }).cargoAt = Date.now() - 60_000;
  const antes = w.reg.aTabs.length;
  await w.navegar(tabId, 'https://mail.google.com/mail/u/0/#inbox');
  assert.equal(w.pendiente(tabId), undefined, 'se soltó');
  assert.deepEqual(w.reg.aTabs.slice(antes), [[5, { tipo: 'REPLICA_ESTADO', pedido: 'r3abc', fase: 'se_fue' }]], 'MaKo se entera');
  assert.equal(await w.pedir({ tipo: 'REPLICA_PENDIENTE', tabId }, DEL_POPUP), null, 'el ícono ahí ya no entra solo a la copia');
  // Si igual la copia desde el inicio, es una copia de la persona, sin pedido de MaKo, y no se cierra al soltar.
  const r = await w.pedir({ tipo: 'REPLICA_EMPEZAR', tabId }, DEL_POPUP) as { nonce: string };
  assert.deepEqual({ pedido: w.pendiente(tabId)?.pedido, nuestra: w.pendiente(tabId)?.nuestra }, { pedido: null, nuestra: false });
  await w.pedir({ tipo: 'REPLICA_FOTO', nonce: r.nonce, ok: true, foto: { cuerpo: '<p>x</p>' }, url: 'https://mail.google.com/mail/u/0/' }, DE_LA_PESTANA(tabId));
  await esperar(20);
  await w.pedir({ tipo: 'REPLICA_SOLTAR', entrega: (w.entrega() as { entrega: string }).entrega }, DE_MAKO);
  await esperar(10);
  assert.ok(!w.reg.cerradas.includes(tabId), 'nunca se cierra una pestaña que la persona usa para otra cosa');

  // Una pendiente vieja (media hora sin tocarla) tampoco cuenta.
  await w.pedir({ tipo: 'REPLICA_ABRIR', pedido: 'r4abc', url: 'https://gsap.com/' }, DE_MAKO);
  const otra = 40 + w.reg.creadas.length;
  await w.navegar(otra, 'https://gsap.com/');
  Object.assign(w.pendiente(otra)!, { desde: Date.now() - 31 * 60_000, ultimo: Date.now() - 31 * 60_000 });
  assert.equal(await w.pedir({ tipo: 'REPLICA_PENDIENTE', tabId: otra }, DEL_POPUP), null);

  // El desplegable no pudo inyectar (la tienda de Chrome, un PDF): MaKo deja de esperar con el motivo.
  await w.pedir({ tipo: 'REPLICA_ABRIR', pedido: 'r5abc', url: 'https://example.com/' }, DE_MAKO);
  const tercera = 40 + w.reg.creadas.length;
  await w.navegar(tercera, 'https://example.com/');
  const e3 = await w.pedir({ tipo: 'REPLICA_EMPEZAR', tabId: tercera }, DEL_POPUP) as { nonce: string };
  await w.pedir({ tipo: 'REPLICA_FALLO', tabId: tercera, nonce: e3.nonce, motivo: 'prohibida' }, DE_LA_PESTANA(tercera));
  await esperar(10);
  assert.equal(w.pendiente(tercera)?.estado, 'leyendo', 'sólo el desplegable puede decir que falló');
  await w.pedir({ tipo: 'REPLICA_FALLO', tabId: tercera, nonce: e3.nonce, motivo: 'prohibida' }, DEL_POPUP);
  await esperar(10);
  assert.deepEqual(w.reg.aTabs.at(-1), [5, { tipo: 'REPLICA_ESTADO', pedido: 'r5abc', fase: 'fallo', motivo: 'prohibida' }]);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. El puente
// ─────────────────────────────────────────────────────────────────────────────

test('5. el puente: la foto lista se acusa sólo si la pantalla la esperaba, y los pedidos viajan con su id', async () => {
  const puente = leer('extension/mako-puente.js');
  const bloque = puente.slice(puente.indexOf('// ── «Replicar con la extensión» desde Replicar del Web Generator (0.79.0, 9/11/2026)'));
  const win = new EventTarget();
  const oyentes: Array<(m: unknown, s: unknown, r: (x: unknown) => void) => boolean> = [];
  const enviados: Array<Record<string, unknown>> = [];
  const ctx: Record<string, unknown> = {
    window: win, CustomEvent, setTimeout, clearTimeout,
    chrome: { runtime: {
      id: 'mako', lastError: undefined,
      sendMessage: (m: Record<string, unknown>, cb: (r: unknown) => void) => { enviados.push(plano(m)); cb(m.tipo === 'REPLICA_ABRIR' ? { ok: true } : { ok: true, url: 'https://a.example.com/' }); },
      onMessage: { addListener: (fn: (m: unknown, s: unknown, r: (x: unknown) => void) => boolean) => oyentes.push(fn) },
    } },
  };
  runInNewContext(`const huerfano = () => false;\n${bloque}`, ctx);
  // Pedir: el id va y vuelve.
  const vueltas: unknown[] = [];
  win.addEventListener('MAKO_REPLICA', (e) => vueltas.push(plano((e as CustomEvent).detail)));
  win.dispatchEvent(new CustomEvent('MAKO_REPLICA_PIDO', { detail: { id: 'r1abc', url: 'https://a.example.com/' } }));
  assert.deepEqual(enviados.at(-1), { tipo: 'REPLICA_ABRIR', pedido: 'r1abc', url: 'https://a.example.com/' });
  assert.deepEqual(vueltas, [{ id: 'r1abc', ok: true }]);
  // La foto lista: sin nadie que la acuse, contesta `recibida: false` (el worker abre otra pestaña).
  const contestar = (m: Record<string, unknown>) => new Promise((resolve) => { for (const fn of oyentes) fn(m, {}, (x) => resolve(plano(x))); });
  assert.deepEqual(await contestar({ tipo: 'REPLICA_LISTA', pedido: 'r1abc', entrega: 'a'.repeat(24) }), { recibida: false });
  // Con la pantalla escuchando ese pedido, la acusa en el acto.
  const avisos: AvisoReplica[] = [];
  const dejar = alEstadoDeReplica(win as unknown as VentanaReplica, 'r1abc', (a) => avisos.push(a));
  assert.deepEqual(await contestar({ tipo: 'REPLICA_LISTA', pedido: 'r1abc', entrega: 'a'.repeat(24) }), { recibida: true });
  assert.deepEqual(avisos, [{ fase: 'lista', entrega: 'a'.repeat(24) }]);
  // Otro pedido no lo toca, y el estado llega por su evento.
  const avisar = (m: Record<string, unknown>) => { for (const fn of oyentes) assert.equal(fn(m, {}, () => {}), false, 'el estado no espera respuesta'); };
  avisar({ tipo: 'REPLICA_ESTADO', pedido: 'otro', fase: 'leyendo', hecho: 5 });
  avisar({ tipo: 'REPLICA_ESTADO', pedido: 'r1abc', fase: 'leyendo', hecho: 55 });
  avisar({ tipo: 'REPLICA_ESTADO', pedido: 'r1abc', fase: 'fallo', motivo: 'inventado' });
  dejar();
  assert.deepEqual(avisos.slice(1), [{ fase: 'leyendo', hecho: 55 }, { fase: 'fallo', motivo: 'otro' }]);
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. La pantalla: el cliente y la dirección
// ─────────────────────────────────────────────────────────────────────────────

/** Una ventana de mentira: eventos del DOM y relojes de verdad, sin navegador. */
function ventana(): VentanaReplica & EventTarget {
  const t = new EventTarget() as VentanaReplica & EventTarget;
  t.setTimeout = (fn, ms) => setTimeout(fn, ms);
  t.clearTimeout = (x) => clearTimeout(x as unknown as NodeJS.Timeout);
  return t;
}

test('6. la pantalla: sin extensión o vieja; el pedido con su id; la verificación de un antibots no se usa; `?replicar=` abre Replicar', async () => {
  assert.equal(extensionReplica(null), 'no');
  assert.equal(extensionReplica('0.78.0'), 'vieja', 'la de antes no sabe replicar');
  assert.equal(extensionReplica(VERSION_REPLICA), 'si');

  // Una respuesta a OTRO pedido no lo cierra.
  const v = ventana();
  v.addEventListener('MAKO_REPLICA_PIDO', (e) => {
    const d = (e as CustomEvent).detail as { id: string };
    setTimeout(() => v.dispatchEvent(new CustomEvent('MAKO_REPLICA', { detail: { id: 'otro', ok: false, motivo: 'abrir' } })), 5);
    setTimeout(() => v.dispatchEvent(new CustomEvent('MAKO_REPLICA', { detail: { id: d.id, ok: true } })), 15);
  });
  const r = await pedirReplica(v, 'https://lovable.dev/', 500);
  assert.equal(r.ok, true);
  assert.deepEqual(await pedirReplica(ventana(), 'https://lovable.dev/', 30), { ok: false, motivo: 'sin_respuesta' }, 'sin extensión, nadie contesta');
  // Tomar: lo que no trae foto es null.
  const w = ventana();
  w.addEventListener('MAKO_REPLICA_TOMAR', (e) => {
    const d = (e as CustomEvent).detail as { id: string; entrega: string };
    w.dispatchEvent(new CustomEvent('MAKO_REPLICA_FOTO', { detail: d.entrega === 'b'.repeat(24) ? { id: d.id, ok: true, url: 'https://a.example.com/', foto: { cuerpo: '<h1>x</h1>' }, texto: 'x' } : { id: d.id, ok: false } }));
  });
  assert.equal((await tomarEntrega(w, 'b'.repeat(24), 200))?.url, 'https://a.example.com/');
  assert.equal(await tomarEntrega(w, 'c'.repeat(24), 200), null);

  // Lo copiado: la página, la verificación de Cloudflare o del checkpoint de Vercel, su error o nada.
  const pag = { titulo: 'Den Borg', foto: { cuerpo: '<main><h1>Den Borg</h1><p>Marca Personal 360</p></main>' }, texto: 'Den Borg Marca Personal 360' };
  assert.equal(juzgarEntrega(pag), 'ok');
  assert.equal(juzgarEntrega({ ...pag, titulo: 'Just a moment...', texto: 'Verifying you are human. This may take a few seconds.' }), 'desafio');
  assert.equal(juzgarEntrega({ ...pag, titulo: 'Just a moment...', texto: 'Enable JavaScript and cookies to continue' }), 'desafio', 'el título de Cloudflare solo (esDesafioDeBot)');
  assert.equal(juzgarEntrega({ ...pag, titulo: 'Vercel Security Checkpoint', texto: 'We are verifying your browser' }), 'desafio');
  assert.equal(juzgarEntrega({ ...pag, titulo: '500', texto: '500 Internal Server Error' }), 'error');
  assert.equal(juzgarEntrega({ ...pag, foto: { cuerpo: '  ' } }), 'vacia');

  // La dirección: «Copiar su sitio» de Spy y la extensión abren Replicar con la página.
  assert.equal(hrefReplicar('https://beacons.page/denborg'), '/web-generator?replicar=https%3A%2F%2Fbeacons.page%2Fdenborg');
  assert.equal(hrefReplicar('https://a.example.com/', 'a'.repeat(24)), `/web-generator?replicar=https%3A%2F%2Fa.example.com%2F&extension=${'a'.repeat(24)}`);
  const d = derechaDeQuery(consultaDerecha({ replicar: 'https://beacons.page/denborg' }), [], []);
  assert.deepEqual(d, { tipo: 'replicar', url: 'https://beacons.page/denborg', auto: true }, 'arranca sola');
  const conFoto = derechaDeQuery(consultaDerecha({ replicar: 'https://a.example.com/', extension: 'a'.repeat(24) }), [], []);
  assert.deepEqual(conFoto, { tipo: 'replicar', url: 'https://a.example.com/', auto: true, entrega: 'a'.repeat(24) });
  assert.equal(urlConVentanaAlAbrir(conFoto, []), null, 'con la foto de la extensión no se abre ninguna ventana');
  assert.deepEqual(derechaDeQuery(consultaDerecha({ replicar: 'https://a.example.com/', extension: '<script>' }), [], []), { tipo: 'replicar', url: 'https://a.example.com/', auto: true }, 'una entrega sin forma se ignora');
  assert.deepEqual(derechaDeQuery(consultaDerecha({ replicar: 'no es una dirección' }), [], []), { tipo: 'replicar' });
});

test('6b. antes de tocar nada: el botón sólo con una extensión que sabe replicar; si la tienda no la trae, no se ofrece nada', async () => {
  // La regla, con la tienda atrás (hoy) y adelante (cuando Martín publique).
  assert.equal(ofertaDeExtension('si', '0.74.5'), 'copiar', 'la copia de la carpeta de Martín ya sabe');
  assert.equal(ofertaDeExtension('no', '0.74.5'), 'nada', 'instalar traería una que no sabe');
  assert.equal(ofertaDeExtension('vieja', '0.74.5'), 'nada');
  assert.equal(ofertaDeExtension('no', VERSION_REPLICA), 'instalar');
  assert.equal(ofertaDeExtension('vieja', VERSION_REPLICA), 'actualizar');
  assert.equal(ofertaDeExtension('vieja', '1.0.0'), 'actualizar');

  // Lo que se dibuja en cada caso.
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { BloqueExtension } = await import('../app/web-generator/crear/ConLaExtension');
  const nada = () => {};
  const dibujar = (oferta: 'copiar' | 'instalar' | 'actualizar' | 'nada', estado: Parameters<typeof BloqueExtension>[0]['estado'] = { fase: 'quieta' }) =>
    renderToStaticMarkup(createElement(BloqueExtension, { estado, oferta, onEmpezar: nada, onVolver: nada, onCancelar: nada, primario: true }));
  assert.match(dibujar('copiar'), /Copiar con la extensión<\/button>/);
  assert.equal(dibujar('nada'), '', 'sin nada que ofrecer, ni un contenedor');
  const instalar = dibujar('instalar');
  assert.doesNotMatch(instalar, /<button/, 'ningún botón que no pueda hacer nada');
  assert.match(instalar, /Agregar a Chrome<\/a>/);
  assert.ok(instalar.includes(MENSAJE_REPLICA.sinExtension));
  const actualizar = dibujar('actualizar');
  assert.doesNotMatch(actualizar, /<button|<a /);
  assert.ok(actualizar.includes(MENSAJE_REPLICA.vieja));
  // Lo que ya está en curso se sigue dibujando aunque la extensión se haya ido (no se esconde a la mitad).
  assert.ok(dibujar('nada', { fase: 'abierta' }).includes(MENSAJE_REPLICA.abierta));
  // Mientras copia, el anillo dice cuánto lleva: el renglón no lo repite.
  const leyendo = dibujar('copiar', { fase: 'leyendo', hecho: 40 });
  assert.ok(leyendo.includes(MENSAJE_REPLICA.copiando));
  assert.doesNotMatch(leyendo, /40 %/);
  // Y la pantalla no deja un hueco ni pinta «Leer en tu navegador» de contorno al lado de nada.
  const rep = sinComentarios(leer('app/web-generator/crear/Replicar.tsx'));
  assert.match(rep, /const hayExt = ext\.oferta !== 'nada' \|\| ext\.estado\.fase !== 'quieta';/);
  assert.match(rep, /const bloqueExt = \(u: string, primario: boolean\) => \(hayExt \?/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. El cableado
// ─────────────────────────────────────────────────────────────────────────────

test('7. el cableado: Replicar ofrece la extensión donde el servidor no llega, y con su foto «Página web» no abre ventana', () => {
  const rep = sinComentarios(leer('app/web-generator/crear/Replicar.tsx'));
  // La falla de «Leer» (el servidor no la baja): LeerOPegar con la extensión, primero.
  assert.match(rep, /<LeerOPegar[\s\S]*?extension=\{fotoExt && fotoExt\.url === lectura\.url \? \([\s\S]*?\) : bloqueExt\(lectura\.url, true\)\}/);
  // La falla de la foto en la ventana («Página web»).
  assert.match(rep, /estado\.fase === 'falla' && estado\.formato === 'web' && !conFotoExt && hayExt && <div className="gp-replicar-ext">\{bloqueExt\(lectura\.url, false\)\}<\/div>/);
  // Con la foto, «Replicar» no abre ninguna ventana y usa ésa.
  assert.match(rep, /replicarLeida\(formato, formato === 'web' && !conFotoExt \? abrirEnElClic\(\) : undefined\)/);
  assert.match(rep, /if \(fotoExt && fotoExt\.url === lectura\.url\) \{ if \(ventanaFoto && ventanaFoto !== 'bloqueada'\) cerrarVentana\(ventanaFoto\); void replicar\(lectura\.url, f, \{\}, \{ foto: fotoExt\.foto \}\); return; \}/);
  // La foto de la extensión no pasa por la ventana del lector.
  assert.match(rep, /let foto: unknown = formato === 'web' \? op\.foto : undefined;\n\s*if \(formato === 'web' && foto === undefined && op\.ventanaFoto !== undefined\) \{/);
  // Replicar abierto por la extensión toma la entrega en vez de leer.
  assert.match(rep, /if \(entrega && u\) recibirDeExtension\(entrega, u\);\n\s*else if \(auto && u\) leerPagina\(u, tomarVentanaReservada\(u\)\);/);
  assert.match(leer('app/web-generator/Inicio.tsx'), /entrega=\{derecha\.entrega\}/);
  // LeerOPegar dibuja la extensión antes que lo suyo.
  const lop = sinComentarios(leer('app/web-generator/lector/LeerOPegar.tsx'));
  assert.ok(lop.indexOf('{extension}') > 0 && lop.indexOf('{extension}') < lop.indexOf('className="gp-leer-acciones"'));
  // Spy: «Copiar su sitio» va a Replicar, no al Diagnóstico.
  const spy = sinComentarios(leer('app/competitor-spy/SusPaginas.tsx'));
  assert.match(spy, /<a href=\{conWs\(hrefReplicar\(destino\), ws\)\} className="spy-boton">Copiar su sitio<\/a>/);
  assert.doesNotMatch(spy, /web-generator\?analizar=/);
  // El servidor no copia la verificación aunque le llegue.
  assert.match(sinComentarios(leer('lib/editor-landing/replicar.ts')), /if \(esDesafioDeBot\(`<title>\$\{foto\.titulo\}<\/title>\$\{foto\.cuerpo\.slice\(0, 30_000\)\}`\)\) return falla\(/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Tanda 2 de los varios mouse: el anillo en el paso «Leer»
// ─────────────────────────────────────────────────────────────────────────────

test('8. el paso «Leer» arranca con el anillo del reel (y la extensión dice cuánto lleva copiado)', async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { EscenarioReplica, textoDeEtapa } = await import('../app/web-generator/crear/EscenarioReplica');
  const html = renderToStaticMarkup(createElement(EscenarioReplica, { eventos: [{ fase: 'leer' }], visibles: 0, llegadas: 0, saltear: () => {}, leyendo: 'Copiando en tu navegador · 40 %' }));
  assert.match(html, /class="wr-anillo"/, 'el anillo');
  assert.match(html, /<span class="wr-anillo-texto">Copiando en tu navegador · 40 %<\/span>/);
  assert.match(html, /<span class="wr-fase">Copiando en tu navegador · 40 %<\/span>/, 'la barra dice lo mismo');
  // Sin `leyendo`, lo de la tanda 1.
  assert.equal(textoDeEtapa({ etapa: 'arranque', cajas: [], alto: 0, escritas: 0, total: 0 }), 'Leyendo la página');
  const rep = sinComentarios(leer('app/web-generator/crear/Replicar.tsx'));
  assert.match(rep, /\{leyendo && \(\n\s*<>\n\s*<EscenarioReplica eventos=\{EVENTOS_LEER\} visibles=\{0\} llegadas=\{0\} saltear=\{NADA\} leyendo=/, 'el paso «Leer» monta el escenario');
  assert.match(rep, /ext\.estado\.fase === 'leyendo' && \(\n\s*<EscenarioReplica [^\n]*leyendo=\{`Copiando en tu navegador · \$\{ext\.estado\.hecho\} %`\}/);
  assert.doesNotMatch(rep, /<span className="gp-giro" aria-hidden \/> \{lectura\.enVentana/, 'el giro de antes ya no es lo que se ve al leer');
});
