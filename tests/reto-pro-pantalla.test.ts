// =============================================================================
// R57-03 (20/11/2026): lo de Pro que el reto abre UNA vez en la prueba de Essential, también en la PANTALLA
// =============================================================================
// El servidor ya dejaba pasar el primer uso (lib/reto/pro-del-reto.ts → `abreElReto` en cada candado), pero la pantalla ponía el
// candado sin preguntarle al reto: `useSoloPro` (app/_components/solo-pro.ts) miraba sólo `planEsencial` de /api/auth/me, que
// en la prueba de Essential da true. Así:
//   · Copywriting: «Replicar» cortaba con el candado sin llamar al servidor (app/copywriter/OutliersCopy.tsx);
//   · Web Generator: la caja no mandaba la réplica (app/web-generator/CajaCrear.tsx) y «Replicar landing» quedaba girando
//     (app/web-generator/crear/Replicar.tsx, que además miraba `usePlanEsencial`);
//   · Image: el carrusel con IA arrancaba, pero mientras se armaba mostraba «Pasar a Pro» (app/image-editor/carruseles/EditarCarrusel.tsx).
// Y aparte: /ai-avatar llamaba al candado que ANOTA el uso (`usar: true`) al dibujarse, así que sólo abrir la pantalla ya
// gastaba la ventana de 2 h de su único uso.
//
// Por qué un archivo propio y no tests/reto-dias.test.ts: éste dibuja un hook con jsdom y reemplaza `fetch` para todo el proceso
// (la lectura de /api/auth/me se memoiza por módulo); reto-dias es de reglas puras.
//
// Correr: node --import tsx --test tests/reto-pro-pantalla.test.ts
// Verificado rompiéndolo (20/11/2026), cada parte por separado, con el resto en su lugar:
//   · `useSoloPro` de vuelta a `usePlanEsencial()` y `esSoloPro` a `leerPlanEsencial()` (solo-pro.ts)  → 2 fallos (3 y 4), 3 pasan
//   · `candadoEsencial` sin mirar `proDelReto` (useClienteDeAgencia.ts)                                → 2 fallos (3 y 4), 3 pasan
//   · `queAbreElReto` que deja abierto lo ya usado, pasada la ventana (lib/reto/pro-del-reto.ts)       → 1 fallo (1), 4 pasan
//   · /api/auth/me sin `proDelReto` en la respuesta                                                     → 1 fallo (2), 4 pasan
//   · /ai-avatar con `candadoDeAiAvatar()` otra vez                                                      → 1 fallo (5), 4 pasan
//   · `cartelDeAiAvatar` con `usar: true` (app/ai-avatar/acceso.ts)                                      → 1 fallo (5), 4 pasan
//   · Replicar.tsx con `usePlanEsencial()` otra vez                                                       → 1 fallo (4), 4 pasan
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { EstadoReto } from '../lib/reto/dias';

/** El código de un archivo, con los finales de línea de GitHub (LF), como en tests/reto-dias.test.ts. */
const fuente = (ruta: string) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const h = (iso: string) => Date.parse(iso);
const base: EstadoReto = { v: 1, inicio: '2026-11-18T15:00:00Z', adelantado: 1, hechas: {} }; // 12:00 en Argentina

test('1 · la regla de la pantalla es la del servidor: lo que no usó (con su día abierto) y la ventana de su uso', async () => {
  const { queAbreElReto, decidirProDelReto, VENTANA_MS } = await import('../lib/reto/pro-del-reto');
  const ahora = h('2026-11-22T15:00:00Z');
  const e: EstadoReto = { ...base, adelantado: 5 };
  assert.deepEqual([...queAbreElReto(e, { enPrueba: true, ahora })].sort(), ['ia-editores', 'replicar-guion', 'replicar-landing'], 'el día 5: lo de los días 4 y 5');
  assert.ok(queAbreElReto({ ...base, adelantado: 6 }, { enPrueba: true, ahora }).includes('ai-avatar'), 'el día 6, también el personaje');
  assert.deepEqual(queAbreElReto(e, { enPrueba: false, ahora }), [], 'fuera de la prueba, nada');
  assert.deepEqual(queAbreElReto(null, { enPrueba: true, ahora }), [], 'sin reto, nada');
  const uso = decidirProDelReto(e, 'replicar-guion', { enPrueba: true, ahora }).nuevo;
  assert.ok(uso, 'la primera vez hay un uso para anotar');
  const usado: EstadoReto = { ...e, pro: { 'replicar-guion': uso } };
  assert.ok(queAbreElReto(usado, { enPrueba: true, ahora: ahora + 60_000 }).includes('replicar-guion'), 'dentro de la ventana de su uso, sigue abierta');
  assert.ok(!queAbreElReto(usado, { enPrueba: true, ahora: ahora + VENTANA_MS + 1 }).includes('replicar-guion'), 'después del uso, el candado vuelve');
  assert.ok(queAbreElReto(usado, { enPrueba: true, ahora: ahora + VENTANA_MS + 1 }).includes('replicar-landing'), 'y las otras siguen con su vez');
});

test('2 · /api/auth/me manda `proDelReto` a un Essential, con una lectura que NO anota el uso', () => {
  const srv = fuente('lib/reto/pro-del-reto-server.ts');
  const i = srv.indexOf('export async function loQueAbreElReto(');
  assert.ok(i >= 0, 'falta la lectura para la pantalla');
  const cuerpo = srv.slice(i);
  assert.ok(cuerpo.includes('return queAbreElReto(e, { enPrueba: (await estadoDePrueba(w)).enPrueba, ahora: Date.now() });'), 'la misma regla que el servidor');
  assert.doesNotMatch(cuerpo, /cambiarReto|cambiarSettingSi|setSetting/, 'mirar no puede anotar el uso');
  const me = fuente('app/api/auth/me/route.ts');
  assert.ok(me.includes("const proDelReto = planEsencial ? await (await import('@/lib/reto/pro-del-reto-server')).loQueAbreElReto(ws) : [];"), 'sólo para Essential');
  assert.match(me, /\n\s*proDelReto,\n/, 'y viaja en la respuesta');
  const hook = fuente('app/_components/useClienteDeAgencia.ts');
  assert.ok(hook.includes("proDelReto: Array.isArray(j.proDelReto) ? j.proDelReto.filter((f: unknown): f is string => typeof f === 'string') : [],"), 'el navegador la lee');
});

// ─── La pantalla de verdad: /api/auth/me de mentira (un Essential en su prueba, el día 5) y el hook dibujado con jsdom ────────

type Ventana = Window & typeof globalThis;
const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: new (html: string, o: { url: string }) => { window: Ventana };
};
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://hola-mako.com/copywriter?ws=9' });
const g = globalThis as unknown as Record<string, unknown>;
for (const k of ['window', 'self', 'document', 'HTMLElement', 'Node', 'Element', 'Event', 'MutationObserver', 'getComputedStyle']) {
  g[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true });
g.IS_REACT_ACT_ENVIRONMENT = true;
let lecturasMe = 0;
g.fetch = async (url: string) => {
  if (String(url) !== '/api/auth/me') throw new Error(`fetch sin mock: ${url}`);
  lecturasMe++;
  // Un número suelto en la lista: se descarta (la respuesta es de afuera del navegador).
  const j = { ok: true, autenticado: true, planEsencial: true, proDelReto: ['replicar-guion', 'ia-editores', 'replicar-landing', 42] };
  return { ok: true, status: 200, json: async () => j };
};

test('3 · el candado de la pantalla: abierto en lo que el reto abre, cerrado en lo demás, y vuelve con el 403', async () => {
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { useSoloPro, marcarSoloPro } = await import('../app/_components/solo-pro');
  // Lo que usan OutliersCopy (`replicar-guion`), CajaCrear y Replicar (`replicar-landing`) y EditarCarrusel (`ia-editores`).
  function Sonda() {
    return React.createElement('i', null, ['replicar-guion', 'replicar-landing', 'ia-editores', 'ai-avatar', 'chat-referentes']
      .map((f) => String(useSoloPro(f as 'replicar-guion'))).join('|'));
  }
  const cont = document.createElement('div');
  document.body.appendChild(cont);
  const root = createRoot(cont);
  await React.act(async () => { root.render(React.createElement(Sonda)); });
  await React.act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  assert.equal(cont.textContent, 'false|false|false|true|true', 'lo que el reto abre, sin candado; el personaje (día 6) y lo que el reto no abre, con candado');
  // Después del uso, el servidor contesta el 403 con `pasarAPro` y la pantalla vuelve a poner el candado.
  await React.act(async () => { marcarSoloPro('ia-editores'); });
  assert.equal(cont.textContent, 'false|false|true|true|true', 'el 403 del servidor vuelve a poner el candado');
  await React.act(async () => { root.unmount(); });
  assert.equal(lecturasMe, 1, 'una sola lectura de /api/auth/me por pestaña');
});

test('4 · sin hook: `esSoloPro` y la regla, y cada pantalla del día 4 y 5 pregunta por SU función', async () => {
  const { esSoloPro } = await import('../app/_components/solo-pro');
  const { candadoEsencial } = await import('../app/_components/useClienteDeAgencia');
  assert.equal(await esSoloPro('replicar-guion'), false, 'la lectura sin hook también respeta el reto');
  assert.equal(await esSoloPro('chat-referentes'), true);
  assert.equal(candadoEsencial({ planEsencial: false, proDelReto: [] }, 'ia-editores'), false, 'a Pro, sin candado');
  assert.equal(candadoEsencial(null, 'ia-editores'), false, 'ante la duda, sin candado');
  assert.equal(candadoEsencial({ planEsencial: true, proDelReto: [] }, 'ia-editores'), true, 'Essential sin el reto, con candado');
  // Las pantallas: el hook de su función, y ninguna con `usePlanEsencial` (el plan solo es más estricto que el servidor).
  const sp = fuente('app/_components/solo-pro.ts');
  assert.ok(sp.includes('const plan = useCandadoEsencial(f);') && sp.includes('return marcadas.has(f) || (await leerCandadoEsencial(f));'));
  for (const [rel, f] of [['app/copywriter/OutliersCopy.tsx', 'replicar-guion'], ['app/web-generator/CajaCrear.tsx', 'replicar-landing'], ['app/image-editor/carruseles/EditarCarrusel.tsx', 'ia-editores']]) {
    const src = fuente(rel);
    assert.ok(src.includes(`const soloPro = useSoloPro('${f}');`), `${rel}: el candado de ${f}`);
    assert.ok(!src.includes('usePlanEsencial'), `${rel}: con el plan solo, el reto no le abre nada`);
  }
  assert.ok(fuente('app/web-generator/crear/Replicar.tsx').includes("const plan = useCandadoEsencial('replicar-landing');"), 'Replicar landing: sin esto queda girando');
  assert.ok(fuente('app/image-editor/mako/chat/PanelMakoIA.tsx').includes("const plan = useCandadoEsencial('ia-editores');"));
});

test('5 · AI Avatar: abrir la pantalla no gasta el único uso; generar sí', () => {
  const acceso = fuente('app/ai-avatar/acceso.ts');
  assert.ok(acceso.includes("export async function cartelDeAiAvatar(): Promise<string | null> {\n  return (await esEsencialDeLaSesion()) && !(await abreElReto('ai-avatar', { usar: false })) ? textoSoloPro('ai-avatar') : null;"), 'el cartel pregunta sin anotar');
  assert.ok(acceso.includes("return (await esEsencialDeLaSesion()) && !(await abreElReto('ai-avatar', { usar: true })) ? textoSoloPro('ai-avatar') : null;"), 'lo que genera anota el uso');
  for (const rel of ['app/ai-avatar/page.tsx', 'app/m/ai-avatar/page.tsx']) {
    const p = fuente(rel);
    assert.ok(p.includes('const pro = await cartelDeAiAvatar();'), `${rel}: el cartel`);
    assert.ok(!p.includes('candadoDeAiAvatar('), `${rel}: con sólo abrirla gastaba la ventana de 2 h`);
  }
  assert.match(fuente('app/ai-avatar/actions.ts'), /const pro = await candadoDeAiAvatar\(\);\n\s*if \(pro\) return \{ ok: false, error: pro \};/, 'generar anota el uso');
});
