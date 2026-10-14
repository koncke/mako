import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONTROLES_ALTO,
  ID_ESTILOS_REPRODUCTOR,
  ROTULO_SALTAR_PAUSAS,
  cargarReproductor,
  medidasDelReproductor,
  pantallaGrabada,
  rutaDeLosEstilos,
} from '../lib/replay-reproductor';

/**
 * La grabación de sesión se monta cuando el recuadro EXISTE (13/10/2026).
 *
 * Martín: «revisa en la grabación de la pantalla, en tracking no se está trayendo, lo intenté ver
 * con un lead y se quedó cargando eternamente». Medido en producción (ws1, lead 2636), envolviendo
 * el `requestAnimationFrame`: el montaje corría 4 ms después de pedirlo y el recuadro todavía no
 * existía —React no había dibujado el render de 'listo'—, así que un `if (!nodo) return` mudo lo
 * dejaba vacío para siempre. La misma grabación, montada a mano, andaba.
 *
 * Verificado rompiéndolo (base 3/0): volver al `requestAnimationFrame`, 2 fallos; que el ref del
 * recuadro no intente montar, 1 fallo; el `fetch` sin `signal`, 1 fallo.
 *
 * Y SE VE ENTERA, EN LÍNEA (14/10/2026). Martín: «Mira como se ve el reproductor, completamente
 * roto... No hagas un desplegable de eso, que viva dentro de la sección "Grabación de su visita" en
 * tracking». Lo roto era la hoja: `public/replay/1/player.css` se publicaba y nadie la pedía, así
 * que `.replayer-wrapper` quedaba sin el `position: relative` y el `left/top: 50%` sobre los que el
 * reproductor centra y escala la página grabada. Además el alto era 0,62 × ancho para todas y la
 * escala no pasaba de 1. Los tests de abajo cargan el reproductor de verdad (`cargarReproductor`)
 * contra un `document` de mentira: lo que se prueba es qué pide y qué le pasa al bundle.
 *
 * Verificado rompiéndolo el 14/10/2026 (base 10 · 0), una rotura por vez con un script que
 * restaura los bytes (pases · fallos):
 *   el `Promise.all` sin `cargarEstilos()` (no espera la hoja) ............ 8 · 2
 *   `hojaAplicada` devolviendo true sin mirar las reglas ................... 9 · 1
 *   el fallo memoizado (sin `if (!p) enVuelo = null`) ...................... 8 · 2
 *   `maxScale: 0` → `maxScale: 1` .......................................... 9 · 1
 *   la línea del `inert` borrada ........................................... 9 · 1
 *   el rótulo del interruptor sin traducir ................................. 9 · 1
 *   `medir` sin comparar con las medidas de antes (reescala igual) ......... 9 · 1
 *   `medir` sin mirar la pantalla completa ................................. 9 · 1
 *   `medidasDelReproductor` sin el tope del 70% ............................ 8 · 2
 *   `pantallaGrabada` quedándose con el ÚLTIMO Meta ........................ 9 · 1
 *   el `ResizeObserver` midiendo un ancho de 0 ............................. 9 · 1
 *   un `@keyframes click` agregado a app/_ui/ui.css ........................ 9 · 1
 *   un `button{color:red}` agregado a public/replay/1/player.css ........... 9 · 1
 * (Los de a 2 tumban también el test del montaje: la carga se memoiza por módulo y el primero
 * deja la pestaña de mentira en otro estado.)
 */

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(new URL(r, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const SRC = sinComentarios(leer('../app/crm/lead-view/GrabacionModal.tsx'));

test('no se monta en un requestAnimationFrame a ciegas', () => {
  assert.doesNotMatch(SRC, /requestAnimationFrame/, 'el rAF corre antes de que exista el recuadro y sale callado');
});

test('monta el que llega segundo: lo bajado o el recuadro', () => {
  const ini = SRC.indexOf('const refLienzo = useCallback(');
  const ref = SRC.slice(ini, SRC.indexOf('}, [intentarMontar]);', ini));
  assert.ok(ini > 0, 'no encontré el ref del recuadro');
  assert.match(ref, /lienzo\.current = nodo;\s*intentarMontar\(\);/, 'el recuadro se engancha y no intenta montar');
  assert.match(SRC, /listo\.current = \{ r, eventos \};\s*setFase\(\{ k: 'listo', ilegibles \}\);\s*intentarMontar\(\);/, 'lo bajado no intenta montar');
  assert.match(SRC, /<div ref=\{refLienzo\}/);
  // Y el montaje mira las DOS cosas.
  assert.match(SRC, /if \(!nodo \|\| !l \|\| montado\.current\) return;/);
});

test('el cuerpo de la grabación tiene un tope de espera', () => {
  assert.match(SRC, /fetch\(`\/api\/crm\/replay\?sesion=\$\{encodeURIComponent\(sesion\.id\)\}`, \{ cache: 'no-store', signal: AbortSignal\.timeout\(ESPERA_CUERPO_MS\) \}\)/);
});

// ── Las medidas: el ancho de la tarjeta, el alto de la pantalla grabada ──────

test('la pantalla grabada es la del PRIMER evento Meta con dos números', () => {
  const meta = (width: unknown, height: unknown) => ({ type: 4, data: { href: 'https://x.com/', width, height } });
  assert.deepEqual(pantallaGrabada([meta(1440, 900), { type: 2, data: {} }, meta(390, 844)]), { ancho: 1440, alto: 900 });
  // Uno que no sirve se saltea; no se inventa una pantalla con lo que haya.
  assert.deepEqual(pantallaGrabada([meta(0, 900), meta('390', 844), meta(390, 844)]), { ancho: 390, alto: 844 });
  assert.equal(pantallaGrabada([]), null);
  assert.equal(pantallaGrabada([{ type: 2, data: {} }, null, 'x', { type: 4 }, meta(NaN, 10)]), null);
});

test('el alto sale de la proporción grabada, con el reproductor entero topado al 70% de la ventana', () => {
  // Escritorio 1440×900 en una tarjeta de 700 con la ventana en 900: 700 × 900/1440 = 437,5.
  assert.deepEqual(medidasDelReproductor(700, { ancho: 1440, alto: 900 }, 900), { ancho: 700, alto: 438 });
  // Teléfono 390×844: pediría 1.515 px; el tope es 70% de 900 menos los 80 de los controles.
  assert.equal(CONTROLES_ALTO, 80);
  assert.deepEqual(medidasDelReproductor(700, { ancho: 390, alto: 844 }, 900), { ancho: 700, alto: 550 });
  // Sin Meta, la proporción de antes; sin ventana que medir, sin tope.
  assert.deepEqual(medidasDelReproductor(700, null, 900), { ancho: 700, alto: 434 });
  assert.deepEqual(medidasDelReproductor(700, { ancho: 390, alto: 844 }, 0), { ancho: 700, alto: 1515 });
  // Los pisos: un ancho absurdo no deja la barra de controles sin lugar, ni una ventana chica un recuadro de 60 px.
  assert.deepEqual(medidasDelReproductor(100, null, 900), { ancho: 240, alto: 160 });
  assert.equal(medidasDelReproductor(700, { ancho: 390, alto: 844 }, 200).alto, 160);
  assert.equal(medidasDelReproductor(NaN, null, NaN).ancho, 240);
});

test('⚠️ la escala pasa de 1 cuando entra: una visita de teléfono en una tarjeta ancha no queda chiquita', () => {
  // rrweb-player escala con min(ancho/grabado, alto/grabado, maxScale): con el default (1) esto daría 1.
  const p = { ancho: 390, alto: 844 };
  const m = medidasDelReproductor(700, p, 2000);
  assert.ok(Math.min(m.ancho / p.ancho, m.alto / p.alto) > 1.5, `escala ${Math.min(m.ancho / p.ancho, m.alto / p.alto)}`);
});

// ── La carga: el script Y su hoja, una vez por pestaña ───────────────────────

/** Lo mínimo del DOM que tocan `cargar` y `cargarEstilos`: un <head> con hijos y dos fábricas. */
class ElementoFalso {
  tagName: string;
  id = '';
  rel = '';
  href = '';
  src = '';
  async = false;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sheet: { cssRules: unknown[] } | null = null;
  constructor(tag: string) { this.tagName = tag.toUpperCase(); }
  remove() { cabeza.hijos = cabeza.hijos.filter((h) => h !== this); }
}
class LinkFalso extends ElementoFalso {}
const cabeza = { hijos: [] as ElementoFalso[], appendChild(el: ElementoFalso) { cabeza.hijos.push(el); return el; } };
const g = globalThis as unknown as Record<string, unknown>;
g.document = {
  head: cabeza,
  createElement: (tag: string) => (tag === 'link' ? new LinkFalso(tag) : new ElementoFalso(tag)),
  getElementById: (id: string) => cabeza.hijos.find((h) => h.id === id) ?? null,
};
g.window = globalThis;
g.HTMLLinkElement = LinkFalso;

/** El reproductor de mentira: anota con qué se lo construyó y qué se le pidió después. */
class PlayerFalso {
  static ultima: PlayerFalso | null = null;
  opts: { target: unknown; props: Record<string, unknown> };
  sets: Array<Record<string, unknown>> = [];
  reescalas = 0;
  destruido = false;
  constructor(opts: { target: unknown; props: Record<string, unknown> }) { this.opts = opts; PlayerFalso.ultima = this; }
  $set(p: Record<string, unknown>) { this.sets.push(p); }
  triggerResize() { this.reescalas++; }
  $destroy() { this.destruido = true; }
}

const de = (tag: string) => cabeza.hijos.filter((h) => h.tagName === tag);

// ⚠️ ESTOS DOS VAN EN ESTE ORDEN: la carga se memoiza por módulo, y el primero necesita la pestaña
// sin nada cargado.
test('⚠️ sin la hoja de estilos NO hay reproductor, y un fallo se vuelve a intentar', async () => {
  // 1. La hoja no llega: aunque el script esté, se dice que no cargó (montado, se vería roto).
  const p1 = cargarReproductor();
  const [script] = de('SCRIPT');
  const [link] = de('LINK');
  assert.ok(script && link, 'no pidió el script y la hoja juntos');
  assert.equal(link.href, rutaDeLosEstilos());
  assert.equal(link.href, '/replay/1/player.css');
  assert.equal(link.rel, 'stylesheet');
  assert.equal(link.id, ID_ESTILOS_REPRODUCTOR);
  g.rrwebPlayer = { Player: PlayerFalso, default: PlayerFalso };
  script.onload?.();
  link.onerror?.();
  assert.equal((await p1).ok, false, 'sin la hoja dijo que el reproductor está');
  assert.equal(de('LINK').length, 0, 'el <link> que falló quedó colgado y nunca va a volver a avisar');

  // 2. La hoja «carga» pero es un 404 servido como HTML: sin reglas no hay estilos.
  const p2 = cargarReproductor();
  const [link2] = de('LINK');
  assert.ok(link2 && link2 !== link, 'el fallo quedó memoizado: no volvió a pedir la hoja');
  assert.equal(de('SCRIPT').length, 1, 'el global ya estaba y volvió a pedir el script');
  link2.sheet = { cssRules: [] };
  link2.onload?.();
  assert.equal((await p2).ok, false, 'una hoja sin reglas pasó por cargada');

  // 3. Llega de verdad: hay reproductor, y de ahí en más no se pide nada más.
  const p3 = cargarReproductor();
  const [link3] = de('LINK');
  link3.sheet = { cssRules: [{}] };
  link3.onload?.();
  assert.equal((await p3).ok, true);
  assert.equal((await cargarReproductor()).ok, true);
  assert.equal(de('LINK').length, 1, 'pidió la hoja dos veces');
});

test('montar: escala libre, el alto de la pantalla grabada, la página inert, y medir reescala sólo si cambió', async () => {
  const r = await cargarReproductor();
  assert.ok(r.ok);
  const marco = { attrs: {} as Record<string, string>, setAttribute(k: string, v: string) { marco.attrs[k] = v; } };
  const rotulo = { textContent: 'skip inactive' };
  const nodo = {
    querySelector: (sel: string) => (sel === '.rr-player__frame' ? marco : sel === '.rr-controller .switch .label' ? rotulo : null),
  };
  const eventos = [{ type: 4, data: { href: 'https://x.com/', width: 390, height: 844 } }, { type: 2, data: { node: { type: 0, childNodes: [] } } }];
  const rep = r.montar(nodo as unknown as HTMLElement, eventos, 700, 900);
  const inst = PlayerFalso.ultima!;
  assert.equal(inst.opts.target, nodo);
  assert.equal(inst.opts.props.maxScale, 0, 'la escala quedó topada en 1');
  assert.equal(inst.opts.props.width, 700);
  assert.equal(inst.opts.props.height, 550);
  assert.equal(inst.opts.props.events, eventos);
  assert.equal(marco.attrs.inert, '', 'la página grabada no quedó inert: el Tab entra al iframe');
  assert.equal(rotulo.textContent, ROTULO_SALTAR_PAUSAS, 'el interruptor quedó en inglés');
  assert.equal(ROTULO_SALTAR_PAUSAS, 'Saltar pausas');

  rep.medir(700, 900);
  assert.equal(inst.sets.length, 0, 'reescaló con las mismas medidas');
  rep.medir(500, 900);
  assert.deepEqual(inst.sets, [{ width: 500, height: 550 }]);
  assert.equal(inst.reescalas, 1, 'cambió el recuadro y no recentró la página grabada');
  rep.medir(500, 1200);
  assert.deepEqual(inst.sets.at(-1), { width: 500, height: 760 });

  // En pantalla completa las medidas son del reproductor: el `resize` de entrar no las pisa,
  // y al salir se vuelve a medir con la ventana de vuelta.
  const doc = g.document as Record<string, unknown>;
  doc.fullscreenElement = {};
  rep.medir(500, 1080);
  assert.equal(inst.sets.length, 2, 'reescaló en pantalla completa con las medidas de la tarjeta');
  doc.fullscreenElement = null;
  rep.medir(500, 900);
  assert.deepEqual(inst.sets.at(-1), { width: 500, height: 550 });
  assert.equal(inst.sets.length, 3);

  rep.destruir();
  assert.equal(inst.destruido, true);
});

// ── En línea, y la hoja que se pide ──────────────────────────────────────────

test('el reproductor se vuelve a medir cuando cambia la tarjeta, y un ancho de 0 no es un ancho', () => {
  assert.match(SRC, /new ResizeObserver\(medir\)/);
  assert.match(SRC, /if \(!n \|\| !n\.clientWidth\) return;\s*montado\.current\?\.medir\(n\.clientWidth, window\.innerHeight\);/);
  assert.match(SRC, /l\.r\.montar\(nodo, l\.eventos, nodo\.clientWidth \|\| ANCHO_SIN_MEDIDA, window\.innerHeight\)/);
});

test('la hoja que se pide EXISTE, y no pisa nada de la app', () => {
  const ruta = join(RAIZ, 'public', rutaDeLosEstilos());
  assert.ok(existsSync(ruta), `no existe ${ruta}: el <link> pediría un 404`);
  const css = readFileSync(ruta, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /\.replayer-wrapper\{position:relative/, 'es otra hoja: sin esto la página grabada sale corrida');

  // Los @keyframes son globales por definición: se listan, y nadie más puede usar esos nombres.
  const animaciones = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]).sort();
  assert.deepEqual(animaciones, ['click', 'touch-click']);
  let sinAnimaciones = css;
  for (let i = sinAnimaciones.indexOf('@keyframes'); i >= 0; i = sinAnimaciones.indexOf('@keyframes')) {
    let prof = 0;
    let j = sinAnimaciones.indexOf('{', i);
    for (; j < sinAnimaciones.length; j++) {
      if (sinAnimaciones[j] === '{') prof++;
      else if (sinAnimaciones[j] === '}' && --prof === 0) break;
    }
    sinAnimaciones = sinAnimaciones.slice(0, i) + sinAnimaciones.slice(j + 1);
  }
  // Cada selector se ata a una clase del reproductor (prefijo o la clase de Svelte): ninguno pisa
  // un `button`, un `iframe` o un `.label` de la app.
  const selectores = [...sinAnimaciones.matchAll(/([^{}]+)\{[^{}]*\}/g)].flatMap((m) => m[1].split(',')).map((s) => s.trim());
  assert.ok(selectores.length > 20, `leí ${selectores.length} selectores`);
  for (const s of selectores) assert.match(s, /\.(rr-|replayer-)|\.svelte-[a-z0-9]+/, `selector global: ${s}`);

  const archivos = execFileSync('git', ['ls-files', 'app', 'lib', 'components'], { cwd: RAIZ, encoding: 'utf8' })
    .split(/\r?\n/).filter((f) => /\.(css|tsx?)$/.test(f));
  assert.ok(archivos.length > 100, `leí ${archivos.length} archivos`);
  const pisan = archivos.filter((f) => /@keyframes\s+(click|touch-click)\b/.test(readFileSync(join(RAIZ, f), 'utf8')));
  assert.deepEqual(pisan, [], 'un @keyframes con el nombre de uno del reproductor: se pisan entre sí');
});
