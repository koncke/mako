// =============================================================================
// El grabador v2 (rrweb + envoltorio) y el reproductor que lo tiene que poder mirar
// =============================================================================
// `public/replay/2/r.js` lo baja el navegador de CADA visitante de CADA página con el
// Pixel v21/v22 en cuanto el servidor contesta `rec.v = 2`. No hay navegador acá: el
// envoltorio corre en un `vm` de node con un rrweb, un `document` y un reloj de
// mentira, y lo que se prueba es el archivo PUBLICADO (la cola de la v2), no el
// fuente. La prueba en un Chromium de verdad, con el snippet v22 real, está en el
// commit que trajo esto.
//
// PROBADO ROMPIÉNDOLO (08/10/2026). Base: 13 pases, 0 fallos. Cada rotura, una por
// una, restaurando antes de la siguiente (huellas de los 7 archivos iguales al
// final). Las del envoltorio se llevaron a mano hasta `public/replay/2/r.js`, con
// la misma receta del generador: él ya no las deja pasar (ver abajo).
//
//   envoltorio sin `o.inlineStylesheet = false;` ........................ 11 · 2
//   el stop sin `parar()` (el latido sigue después del tope) ............ 12 · 1
//   late sin mirar la visibilidad (latir, programar y al esconderse) .... 12 · 1
//   `alCambiar` sin `takeFullSnapshot` (no hay foto al volver) .......... 12 · 1
//   LATIDO_LENTO_MS: 8000 → 12000 (más que el lote de 10 s) ............. 12 · 1
//   `latir` sin el try/catch de addCustomEvent .......................... 12 · 1
//   REPLAY_LIB_VERSION: 2 → 3 (anuncia un archivo que no existe) ........ 12 · 1
//   la v1 con el envoltorio pegado detrás ............................... 12 · 1
//   constructorDelGlobal sólo con `typeof g === 'function'` ............. 12 · 1
//   hojasSinCors sin mirar las mutaciones (type 3) ...................... 12 · 1
//   `montar` pasando `events: eventos` sin hojasSinCors ................. 12 · 1
//   el pop-up sin `!traeFoto(eventos)` en la condición de «cortada» ..... 12 · 1
//   REPLAY_LATIDO: 'mko-vivo' → 'mko-latido' (el envoltorio no cambia) .. 11 · 2
//
// Y EL GENERADOR, ANTES QUE EL TEST: con cualquiera de las seis roturas del
// envoltorio, `node scripts/replay-libs.mjs` se NIEGA a escribir (la huella de la v2
// publicada no da), y con el envoltorio pegado a la v1 desde el generador, también
// («public/replay/1/r.js es una versión PUBLICADA (huella bf8fa2f53188) y lo que se
// arma hoy da c5234232d1ac»). El test es la segunda red, sobre el archivo que se sirve.
//
// ⚠️ La rotura de la visibilidad tuvo que ser triple: con UNA sola de las tres
// guardas sacada (latir, programar o el `parar()` al esconderse) el envoltorio
// sigue sin latir escondido, porque las otras dos lo atajan — medido, cada una
// sola da 13 · 0. No es un test flojo:
// es el envoltorio defendido en profundidad, que es lo que se quiere en un archivo
// que corre en la página de un cliente.
//
// Correr: npm test
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import {
  REPLAY_LATIDO,
  REPLAY_LIB_VERSION,
  REPLAY_LOTE_MS,
  REPLAY_OPCIONES_RRWEB,
  REPLAY_PISO_EVENTOS,
  REPLAY_PISO_SEGUNDOS,
} from '../lib/replay-contrato';
import { constructorDelGlobal, hojasSinCors } from '../lib/replay-reproductor';
import { tieneFoto } from '../lib/replay-ficha';

const raiz = new URL('../', import.meta.url);
// ⚠️ Todo lo que se lee de disco se normaliza ANTES de mirarlo: en un worktree los
// fuentes llegan en CRLF (la regla de AGENTS.md). Los bundles van en latin1, que
// mapea byte a byte: no se decodifica nada que después haya que comparar.
const leer = (ruta: string, enc: BufferEncoding = 'utf8') =>
  readFileSync(new URL(ruta, raiz)).toString(enc).replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const RRWEB = leer('node_modules/rrweb/dist/record/rrweb-record.min.js', 'latin1');
const V1 = leer('public/replay/1/r.js', 'latin1');
const V2 = leer('public/replay/2/r.js', 'latin1');
const ENVOLTORIO = leer('scripts/replay-envoltorio.js');
// Lo que la v2 trae delante del envoltorio: rrweb sin su `//# sourceMappingURL`.
const PREFIJO_V2 = RRWEB.replace(/\n\/\/# sourceMappingURL=[^\n]*\n?$/, '\n');
const COLA_V2 = V2.startsWith(PREFIJO_V2) ? V2.slice(PREFIJO_V2.length) : '';

/** Un número del envoltorio, leído del fuente: `var NOMBRE = 123;`. */
function numeroDelEnvoltorio(nombre: string): number {
  const m = new RegExp(`var ${nombre} = (\\d+);`).exec(ENVOLTORIO);
  assert.ok(m, `no encontré ${nombre} en scripts/replay-envoltorio.js`);
  return Number(m[1]);
}

// ─────────────────────────────────────────────────────────────────────────────
// El mundo de mentira: rrweb, document y un reloj que se avanza a mano
// ─────────────────────────────────────────────────────────────────────────────
type Ops = { originalDevuelve?: unknown; addTira?: number; sinRrweb?: boolean };
function mundo(ops: Ops = {}) {
  let ahora = 0;
  let sig = 1;
  const timers = new Map<number, { cuando: number; fn: () => void }>();
  const listeners: Record<string, Array<() => void>> = {};
  let vis = 'visible';
  let grabando = true;
  let tiradas = ops.addTira ?? 0;
  const llamadas = { record: [] as Array<Record<string, unknown>>, custom: [] as Array<{ tag: string; t: number }>, fotos: [] as Array<{ checkout: unknown; t: number }>, stop: 0 };
  const stopOriginal = () => { llamadas.stop++; grabando = false; return 'detenido'; };
  const original = Object.assign(
    (o: Record<string, unknown>) => { llamadas.record.push(o); return 'originalDevuelve' in ops ? ops.originalDevuelve : stopOriginal; },
    {
      addCustomEvent: (tag: string) => {
        if (tiradas > 0) { tiradas--; throw new Error('please add custom event after start recording'); }
        if (!grabando) throw new Error('please add custom event after start recording');
        llamadas.custom.push({ tag, t: ahora });
      },
      takeFullSnapshot: (checkout?: boolean) => {
        if (!grabando) throw new Error('please take full snapshot after start recording');
        llamadas.fotos.push({ checkout, t: ahora });
      },
      freezePage: () => {},
      mirror: { soy: 'el mirror' },
    },
  );
  const document = {
    get visibilityState() { return vis; },
    addEventListener: (ev: string, fn: () => void) => { (listeners[ev] ||= []).push(fn); },
    removeEventListener: (ev: string, fn: () => void) => { listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn); },
  };
  const window: Record<string, unknown> = ops.sinRrweb ? {} : { rrwebRecord: original };
  const sandbox = {
    window,
    document,
    setTimeout: (fn: () => void, ms: number) => { const id = sig++; timers.set(id, { cuando: ahora + ms, fn }); return id; },
    clearTimeout: (id: number) => { timers.delete(id); },
  };
  const evaluar = () => vm.runInNewContext(COLA_V2, sandbox, { filename: 'public/replay/2/r.js (cola)' });
  evaluar();
  const avanzar = (ms: number) => {
    const fin = ahora + ms;
    for (;;) {
      let prox: [number, { cuando: number; fn: () => void }] | null = null;
      for (const e of timers) if (e[1].cuando <= fin && (!prox || e[1].cuando < prox[1].cuando)) prox = e;
      if (!prox) break;
      timers.delete(prox[0]);
      ahora = prox[1].cuando;
      prox[1].fn();
    }
    ahora = fin;
  };
  const verse = (v: 'visible' | 'hidden') => { vis = v; for (const fn of [...(listeners.visibilitychange || [])]) fn(); };
  const grabar = (o: Record<string, unknown> = { ...REPLAY_OPCIONES_RRWEB, emit: () => {} }) =>
    (window.rrwebRecord as (o: Record<string, unknown>) => unknown)(o);
  return { window, original, llamadas, timers, listeners, avanzar, verse, grabar, evaluar, rrwebSePara: stopOriginal };
}

// ─────────────────────────────────────────────────────────────────────────────
// Los archivos publicados
// ─────────────────────────────────────────────────────────────────────────────
test('la v1 sigue siendo rrweb pelado y la v2 es el mismo rrweb con el envoltorio detrás', () => {
  // ⚠️ LA v1 NO SE TOCA: está en la caché de los visitantes, y un arreglo es una
  // ruta nueva. Si el envoltorio apareciera ahí, el cambio llegaría «cuando quiere».
  assert.equal(V1, RRWEB, 'public/replay/1/r.js ya no es el rrweb de node_modules byte a byte');
  assert.doesNotMatch(V1, /mkoEnvoltorio/);
  assert.ok(COLA_V2.length > 0, 'public/replay/2/r.js no arranca con el rrweb de node_modules');
  // La cola es el envoltorio, sin sus comentarios de línea y sin líneas vacías.
  const esperado = ENVOLTORIO.split('\n').filter((l) => l.trim() !== '' && !/^\s*\/\//.test(l)).join('\n') + '\n';
  assert.equal(COLA_V2, esperado, 'la cola de la v2 no es scripts/replay-envoltorio.js: corre node scripts/replay-libs.mjs');
  assert.match(COLA_V2, /o\.inlineStylesheet = false;/);
});

test('el servidor anuncia un grabador que existe, y es el que trae el envoltorio', () => {
  // El pageview contesta rec.v = REPLAY_LIB_VERSION y el snippet baja /replay/<v>/r.js:
  // un número sin archivo es un 404, y el snippet lo toma como «no bajó» en TODAS las
  // páginas sin que nada lo diga.
  const ruta = `public/replay/${REPLAY_LIB_VERSION}/r.js`;
  assert.ok(existsSync(new URL(ruta, raiz)), `REPLAY_LIB_VERSION = ${REPLAY_LIB_VERSION} y no existe ${ruta}`);
  assert.match(leer(ruta, 'latin1'), /mkoEnvoltorio/, `${ruta} no trae el envoltorio`);
});

test('la v2 entera, evaluada: rrwebRecord queda envuelto y conserva todo lo que rrweb le cuelga', () => {
  const s1: Record<string, unknown> = {};
  s1.window = s1;
  vm.runInNewContext(V1, s1);
  const s2: Record<string, unknown> = {};
  s2.window = s2;
  vm.runInNewContext(V2, s2);
  const r1 = s1.rrwebRecord as Record<string, unknown>;
  const r2 = s2.rrwebRecord as Record<string, unknown>;
  assert.equal(typeof r2, 'function');
  assert.equal(r2.mkoEnvoltorio, 2);
  for (const k of Object.keys(r1)) assert.equal(typeof r2[k], typeof r1[k], `la v2 perdió rrwebRecord.${k}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Lo que hace el envoltorio
// ─────────────────────────────────────────────────────────────────────────────
test('pasa las opciones del snippet tal cual, salvo la hoja: inlineStylesheet false', () => {
  const m = mundo();
  const emit = () => {};
  const delSnippet = { ...REPLAY_OPCIONES_RRWEB, emit };
  m.grabar(delSnippet);
  assert.equal(m.llamadas.record.length, 1);
  const o = m.llamadas.record[0];
  assert.equal(o.inlineStylesheet, false);
  // ⚠️ Las de privacidad pasan intactas: este archivo no puede ser la puerta para bajarlas.
  for (const [k, v] of Object.entries(delSnippet)) if (k !== 'inlineStylesheet') assert.deepEqual(o[k], v, `cambió la opción ${k}`);
  assert.equal(o.emit, emit);
  assert.equal(delSnippet.inlineStylesheet, true, 'el envoltorio pisó el objeto del snippet en vez de copiarlo');
  // Y lo que rrweb cuelga de su función sigue siendo lo de rrweb.
  for (const k of ['addCustomEvent', 'takeFullSnapshot', 'freezePage', 'mirror'] as const) {
    assert.equal((m.window.rrwebRecord as Record<string, unknown>)[k], m.original[k], `rrwebRecord.${k} no es el de rrweb`);
  }
});

test('el latido llega al piso en sus 10 s, y después nunca deja un hueco más largo que un lote', () => {
  const rapido = numeroDelEnvoltorio('LATIDO_RAPIDO_MS');
  const rapidos = numeroDelEnvoltorio('LATIDOS_RAPIDOS');
  const lento = numeroDelEnvoltorio('LATIDO_LENTO_MS');
  // Los números contra el snippet: 20 eventos en los 10 s del piso (la foto son 2),
  // la fase rápida cubre el piso, y el lento es menor que el hueco que el snippet
  // cuenta entero (RMS suma cada hueco topeado en REPLAY_LOTE_MS).
  assert.ok(rapido * (REPLAY_PISO_EVENTOS - 2) <= REPLAY_PISO_SEGUNDOS * 1000, `${rapido} ms no llega a ${REPLAY_PISO_EVENTOS} eventos en ${REPLAY_PISO_SEGUNDOS} s`);
  assert.ok(rapidos * rapido >= REPLAY_PISO_SEGUNDOS * 1000, 'la fase rápida termina antes del piso');
  assert.ok(lento < REPLAY_LOTE_MS, `un latido cada ${lento} ms deja huecos que el snippet topea en ${REPLAY_LOTE_MS}: la duración saldría corta`);

  const m = mundo();
  m.grabar();
  m.avanzar(REPLAY_PISO_SEGUNDOS * 1000);
  assert.ok(m.llamadas.custom.length >= REPLAY_PISO_EVENTOS - 2, `en el piso hubo ${m.llamadas.custom.length} latidos`);
  assert.ok(m.llamadas.custom.every((c) => c.tag === REPLAY_LATIDO));
  m.avanzar(10 * 60 * 1000);
  const t = m.llamadas.custom.map((c) => c.t);
  const huecoMax = Math.max(...t.slice(1).map((x, i) => x - t[i]));
  assert.ok(huecoMax < REPLAY_LOTE_MS, `hubo un hueco de ${huecoMax} ms entre latidos`);
  assert.ok(m.llamadas.custom.length < 200, `${m.llamadas.custom.length} latidos en 10 min: el lento no frenó`);
});

test('con la pestaña escondida no late; al volver saca una foto nueva y sigue latiendo', () => {
  const m = mundo();
  m.grabar();
  m.avanzar(3000);
  m.verse('hidden');
  const antes = m.llamadas.custom.length;
  m.avanzar(60_000);
  assert.equal(m.llamadas.custom.length, antes, 'latió con la pestaña escondida');
  assert.equal(m.llamadas.fotos.length, 0);
  m.verse('visible');
  // ⚠️ La foto nueva es lo que rescata la sesión cuya cola el snippet tiró al esconderse.
  assert.equal(m.llamadas.fotos.length, 1, 'al volver no sacó una foto nueva');
  assert.equal(m.llamadas.fotos[0].checkout, true);
  m.avanzar(2000);
  assert.ok(m.llamadas.custom.length > antes, 'al volver no retomó el latido');
});

test('el stop corta el latido y suelta el listener: después del tope no queda nada corriendo', () => {
  const m = mundo();
  const stop = m.grabar() as () => unknown;
  m.avanzar(3000);
  assert.equal(stop(), 'detenido', 'el stop no devuelve lo que devuelve el de rrweb');
  assert.equal(m.llamadas.stop, 1);
  assert.equal(m.timers.size, 0, 'quedó un latido programado después del stop');
  assert.equal((m.listeners.visibilitychange || []).length, 0, 'quedó colgado el listener de visibilidad');
  const n = m.llamadas.custom.length;
  m.avanzar(10 * 60 * 1000);
  m.verse('hidden');
  m.verse('visible');
  assert.equal(m.llamadas.custom.length, n);
  assert.equal(m.llamadas.fotos.length, 0);
});

test('un error de rrweb no sale del envoltorio: la página del cliente no se entera', () => {
  // rrweb tira si todavía no arrancó (la página seguía cargando)...
  const m = mundo({ addTira: 3 });
  m.grabar();
  assert.doesNotThrow(() => m.avanzar(5000));
  assert.ok(m.llamadas.custom.length > 0, 'después de los errores dejó de latir');
  // ...y si se detuvo por su cuenta, sin pasar por el stop envuelto.
  m.rrwebSePara();
  assert.doesNotThrow(() => m.avanzar(30_000));
  assert.doesNotThrow(() => { m.verse('hidden'); m.verse('visible'); });
});

test('si rrweb no arrancó no queda nada colgado, y sin rrweb no hace nada', () => {
  const m = mundo({ originalDevuelve: undefined });
  assert.equal(m.grabar(), undefined);
  assert.equal(m.timers.size, 0);
  assert.equal((m.listeners.visibilitychange || []).length, 0);
  assert.doesNotThrow(() => mundo({ sinRrweb: true }));
  // Evaluado dos veces (el archivo cargado de nuevo), no se envuelve dos veces.
  const d = mundo();
  const envuelto = d.window.rrwebRecord;
  d.evaluar();
  assert.equal(d.window.rrwebRecord, envuelto);
});

test('la etiqueta del latido es una sola: la del envoltorio es la que el reproductor esconde', () => {
  const m = /var ETIQUETA = '([^']+)';/.exec(ENVOLTORIO);
  assert.ok(m, 'no encontré ETIQUETA en el envoltorio');
  assert.equal(m[1], REPLAY_LATIDO);
});

// ─────────────────────────────────────────────────────────────────────────────
// El reproductor: que lo grabado se pueda MIRAR
// ─────────────────────────────────────────────────────────────────────────────
test('el reproductor encuentra la clase en el global que deja el bundle real', () => {
  // ⚠️ Medido: el UMD deja un OBJETO { Player, default }, y hasta el 08/10/2026 el
  // cargador pedía una función — ninguna grabación se pudo mirar.
  const s: Record<string, unknown> = {};
  s.window = s;
  vm.runInNewContext(leer('public/replay/1/player.js', 'latin1'), s);
  assert.equal(typeof constructorDelGlobal(s.rrwebPlayer), 'function', 'con el bundle publicado no hay constructor');
  const clase = function () {};
  assert.equal(constructorDelGlobal(clase), clase);
  assert.equal(constructorDelGlobal({ default: clase }), clase);
  assert.equal(constructorDelGlobal(undefined), null);
  assert.equal(constructorDelGlobal({ nada: 1 }), null);
});

test('las hojas enlazadas pierden crossorigin e integrity, en la foto y en las mutaciones', () => {
  const link = (rel: string) => ({ type: 2, tagName: 'link', attributes: { rel, href: 'https://x.com/a.css', crossorigin: '', integrity: 'sha-1' }, childNodes: [], id: 9 });
  const eventos = [
    { type: 2, data: { node: { type: 0, childNodes: [{ type: 2, tagName: 'html', attributes: {}, childNodes: [{ type: 2, tagName: 'head', attributes: {}, childNodes: [link('stylesheet'), link('icon')] }] }] } } },
    { type: 3, data: { source: 0, adds: [{ parentId: 3, nextId: null, node: link('stylesheet') }], removes: [], texts: [], attributes: [] } },
    { type: 5, data: { tag: REPLAY_LATIDO, payload: {} } },
  ];
  const r = hojasSinCors(eventos) as typeof eventos;
  const head = (r[0].data as { node: { childNodes: Array<{ childNodes: Array<{ childNodes: Array<{ attributes: Record<string, unknown> }> }> }> } }).node.childNodes[0].childNodes[0].childNodes;
  assert.deepEqual(head[0].attributes, { rel: 'stylesheet', href: 'https://x.com/a.css' });
  // Un link que no es hoja no se toca.
  assert.equal(head[1].attributes.crossorigin, '');
  const add = (r[1].data as { adds: Array<{ node: { attributes: Record<string, unknown> } }> }).adds[0].node.attributes;
  assert.deepEqual(add, { rel: 'stylesheet', href: 'https://x.com/a.css' }, 'la hoja que agrega una mutación sigue con crossorigin');
  assert.doesNotThrow(() => hojasSinCors([null, 3, 'x', { type: 2 }, { type: 3, data: { source: 0, adds: 'no' } }]));
});

test('el pop-up monta con las hojas arregladas, sin marcas del latido y sólo si hay foto', () => {
  const rep = sinComentarios(leer('lib/replay-reproductor.ts'));
  assert.match(rep, /events: hojasSinCors\(eventos\)/, 'montar no le pasa los eventos por hojasSinCors');
  assert.match(rep, /tags: \{ \[REPLAY_LATIDO\]: 'transparent' \}/, 'el latido se dibujaría como una marca en la barra');
  assert.equal((rep.match(/constructorDelGlobal\(\(window/g) || []).length, 2, 'las dos lecturas del global tienen que pasar por constructorDelGlobal');
  const modal = sinComentarios(leer('app/crm/lead-view/GrabacionModal.tsx'));
  // (Al integrarlo con la ficha de la grabación, el 08/10/2026, la regla quedó UNA: `tieneFoto`, con
  // su propio estado en el pop-up; tests/replay-ficha.test.ts fija la frase.)
  assert.match(modal, /if \(!tieneFoto\(eventos\)\) \{ setFase\(\{ k: 'sin_foto' \}\); return; \}/, 'una sesión sin foto montaría un cuadro vacío');
  assert.equal(tieneFoto([{ type: 4 }, { type: 2 }]), true);
  assert.equal(tieneFoto([{ type: 3 }, { type: 5 }, null]), false);
});
