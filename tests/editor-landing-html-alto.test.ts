// =============================================================================
// tests/editor-landing-html-alto — el alto del «HTML personalizado» con una página armada como APP
// =============================================================================
// Pendiente de la tanda 2 (resuelto en la tanda 6, 14/10/2026): «la copia fiel de una página armada como
// app (html y body al 100% con scroll interno) queda en 400 px por sección». SCRIPT_ALTO
// (lib/editor-landing/html-libre.ts) medía `documentElement` y el `scrollHeight` del body, y con el
// contenido adentro de un contenedor con scroll propio los dos dan el alto del iframe: el bloque nunca
// crecía. Ahora, si el documento entra justo en la vista, suma lo que esconde ese contenedor.
//
// Corre el script REAL en `vm` con una ventana y un DOM de mentira cuyo layout depende de la vista: el
// padre aplica cada aviso (como pagina-publica.ts, con `altoDeMensaje`) y el iframe avisa `resize`.
// Las mismas páginas, medidas con Chromium sin cabeza (un padre con el iframe en sandbox y el script
// servido por `documentoHtmlLibre`; antes → ahora): app con html y body al 100% 400 → 2046; app con
// 100vh y la barra arriba 400 → 1569; la misma con un pie de 50 px 400 → 1619 (con «top + scrollHeight»,
// el primer intento, quedaba en 1569 y el pie con scroll); una página común 1505 → 1505; el body con su
// propio scroll 1505 → 1505; términos con scroll a mitad de una página de 2106 → 2106 sin saltos; un
// bloque que es casi sólo un chat de 300 px 400 → 400 con un aviso de paso (1610) que se corrige solo.
//
// ── ROTURAS (14/10/2026, arnés que restaura DE MEMORIA y verifica el hash; base: 4 pasan, 0 fallan) ──
//   · sin sumar lo que esconde el contenedor (la medida de antes) .......... 2 / 2 (app, fijo)
//   · «top + scrollHeight» en vez de lo escondido ......................... 3 / 1 (app)
//   · sin escuchar `resize` ................................................ 3 / 1 (fijo)
//   · sin marcar la caja FIJA (`__gmFijo`) .................................. 3 / 1 (fijo)
//   · sin pedir la mitad de la vista ....................................... 3 / 1 (fijo)
//   · también con un documento más alto que la vista ....................... 3 / 1 (fijo)
//   · un textarea cuenta como contenedor ................................... 3 / 1 (lo que no es)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Script, createContext, runInContext } from 'node:vm';
import { SCRIPT_ALTO, altoDeMensaje } from '../lib/editor-landing/html-libre';

/** Un descendiente del body: su alto según la vista, lo que mide su contenido y su overflow-y. */
type Caja = { tag?: string; overflowY?: string; top?: number; alto: (vista: number) => number; contenido: number | ((vista: number) => number) };

/**
 * Corre el script con un documento que mide `doc(vista)` y las cajas dadas. El padre aplica cada aviso
 * (la vista pasa a ese alto) y el iframe avisa `resize`; recién al final corren `load` y los tres tiempos.
 * Devuelve los avisos y la vista cuando dejó de avisar con los `resize` solos, y después de los tiempos.
 */
function simular(doc: (vista: number) => number, cajas: Caja[] = [], inicial = 400) {
  let vista = inicial;
  const avisos: number[] = [];
  const pendientes: number[] = [];
  const oyentes: Record<string, Array<() => void>> = {};
  const tiempos: Array<() => void> = [];
  const els = cajas.map((c) => ({
    tagName: c.tag ?? 'DIV',
    get clientHeight() { return c.alto(vista); },
    get scrollHeight() { return Math.max(typeof c.contenido === 'function' ? c.contenido(vista) : c.contenido, c.alto(vista)); },
    getBoundingClientRect: () => ({ top: c.top ?? 0, height: c.alto(vista) }),
    estilo: { overflowY: c.overflowY ?? 'auto' },
  }));
  const body = { get scrollHeight() { return doc(vista); }, get offsetHeight() { return doc(vista); }, getElementsByTagName: () => els };
  const document = {
    documentElement: { getBoundingClientRect: () => ({ height: doc(vista) }) },
    body,
    addEventListener: (t: string, f: () => void) => { (oyentes[t] ??= []).push(f); },
  };
  const window = {
    get innerHeight() { return vista; },
    getComputedStyle: (el: { estilo: unknown }) => el.estilo,
    parent: {
      postMessage: (m: unknown) => {
        const a = altoDeMensaje(JSON.parse(JSON.stringify(m)));
        if (a !== null) { avisos.push(a); pendientes.push(a); }
      },
    },
    addEventListener: (t: string, f: () => void) => { (oyentes[t] ??= []).push(f); },
    setTimeout: (f: () => void) => { tiempos.push(f); },
  };
  let ahora = 1_000;
  runInContext(SCRIPT_ALTO, createContext({ window, document, Date: { now: () => (ahora += 10) }, Math }));
  const aplicar = () => {
    for (let vuelta = 0; vuelta < 60 && pendientes.length; vuelta++) {
      vista = pendientes.shift()!;
      for (const f of oyentes.resize ?? []) f();
    }
  };
  aplicar();
  const conResize = { avisos: [...avisos], vista };
  for (const f of [...(oyentes.DOMContentLoaded ?? []), ...(oyentes.load ?? []), ...tiempos]) { f(); aplicar(); }
  return { conResize, avisos, vista };
}

const conScroll = (alto: (vista: number) => number, contenido: Caja['contenido'], top = 0): Caja => ({ alto, contenido, top });

test('el script sigue siendo un string servible (sin backticks ni `${`) que compila', () => {
  assert.doesNotThrow(() => new Script(SCRIPT_ALTO));
  assert.doesNotMatch(SCRIPT_ALTO, /`|\$\{|<\/script/i);
});

test('una página armada como APP (html y body al 100%, scroll adentro) crece hasta su contenido en UN aviso', () => {
  // html y body al 100% y #root con overflow-y auto: la barra (60) y 6 secciones de 331.
  const app = simular((v) => v, [conScroll((v) => v, 2046)]);
  assert.deepEqual(app.conResize.avisos, [2046]);
  assert.deepEqual(app.avisos, [2046], 'los tiempos y el load no cambian nada más');
  // La barra arriba (64), el contenido con scroll (1505) y un PIE de 50 abajo: cuenta también el pie.
  const conPie = simular((v) => v, [conScroll((v) => v - 114, 1505, 64)]);
  assert.deepEqual(conPie.avisos, [1619]);
  // Una página común (alto automático) y una cuyo body tiene su propio scroll: la medida de siempre.
  assert.deepEqual(simular(() => 1505).avisos, [1505]);
  assert.deepEqual(simular((v) => Math.max(v, 1505)).avisos, [1505]);
});

test('una caja de alto FIJO con scroll (un chat, unos términos) no estira el bloque', () => {
  // Términos de 300 px con 3000 de contenido a mitad de una página de 2106: ni un aviso de más.
  const terminos = simular(() => 2106, [conScroll(() => 300, 3000, 900)]);
  assert.deepEqual(terminos.avisos, [2106]);
  // Un bloque que es casi sólo un chat de 300 px (con 1500 de mensajes): se mide una vez de paso, y al
  // crecer la vista la caja no crece con ella; con el `resize` solo, el bloque vuelve a su alto.
  const chat = simular(() => 400, [conScroll(() => 300, 1500, 100)]);
  assert.deepEqual(chat.conResize.avisos, [1600, 400]);
  assert.equal(chat.conResize.vista, 400);
  assert.deepEqual(chat.avisos, [1600, 400], 'y no vuelve a saltar con los tiempos');
});

test('el contenido que CRECE con la vista (un hero de 100vh adentro de la app) no desboca el bloque', () => {
  // Verificación de la tanda 6: #root con overflow-y auto, la barra (60), un hero `min-height: 100vh` y
  // 1500 más. Lo escondido es siempre 1560: sin mirarlo, cada aviso sumaba otra vez lo mismo (en este
  // arnés llegaba a ALTO_MAX, 20000, en 14 avisos; en Chromium, 8200). Queda en la primera medida.
  const hero = simular((v) => v, [conScroll((v) => v, (v) => 60 + v + 1500)]);
  assert.deepEqual(hero.avisos, [1960]);
  assert.equal(hero.vista, 1960);
  // El umbral es la MITAD de lo que creció la vista. Un hero de 60vh crece más que eso: se marca en el
  // segundo aviso y queda en la primera medida. Uno de 40vh tiene un punto fijo (la vista donde todo
  // entra, 1560 / 0,6 = 2600) y llega a él sin pasar el freno de los 25 avisos.
  assert.deepEqual(simular((v) => v, [conScroll((v) => v, (v) => 60 + v * 0.6 + 1500)]).avisos, [1800]);
  const poco = simular((v) => v, [conScroll((v) => v, (v) => 60 + v * 0.4 + 1500)]);
  assert.ok(poco.vista >= 2590 && poco.vista <= 2600 && poco.avisos.length < 25, 'el 40vh: ' + poco.avisos.join(' > '));
});

test('lo que no es el contenedor de una app: un textarea largo y una caja con overflow hidden', () => {
  assert.deepEqual(simular((v) => v, [{ tag: 'TEXTAREA', alto: (v) => v, contenido: 5000 }]).avisos, [400]);
  assert.deepEqual(simular((v) => v, [{ overflowY: 'hidden', alto: (v) => v, contenido: 5000 }]).avisos, [400]);
  assert.deepEqual(simular((v) => v, [{ overflowY: 'visible', alto: (v) => v, contenido: 5000 }]).avisos, [400]);
});

// ── VERIFICACIÓN DE LA TANDA 6 (14/10/2026): PROBADO ROMPIÉNDOLO ──────────────────────────────
// Base: 5 / 0, con el mismo arnés. El contenido que crece con la vista (un hero de 100vh):
//   A-1 sin mirar lo escondido (lo que había en la rama)  → 4 / 1 «el contenido que CRECE…» (en este arnés: 20000 en 14 avisos)
//   A-2 el umbral en el 10 % de lo que creció la vista     → 4 / 1 «el contenido que CRECE…» (el de 60vh ya no se frena)
// Medido además en Chromium sin cabeza (padre con el iframe en sandbox, el script servido por documentoHtmlLibre,
// 4 s): con hero, la rama antes del arreglo 14 avisos y 20000 px; con el arreglo 1 aviso y 1960. Sin hero, 1560
// las dos (el arreglo del Paquete 4 sigue sirviendo); una página común, 1505 las dos.
// Restaurado: 5 / 0.
