// =============================================================================
// #850: con la barra de inspección («Estás viendo el dashboard de…»), nada queda debajo de ella
// =============================================================================
// Martín, revisión del 16/10/2026 (49:04): «cuando se está inspeccionando la top bar… tapa muchas veces funcionalidades
// dentro de MaKo, eso jamás debería pasarse, debería como que adaptar todo y que nada se quede por detrás de la top bar».
// En Automations, el título y «Probar» se escondían (42:42) y el cartel «Copiaste un flujo» no se llegaba a ver (48:36).
//
// La causa: con la barra, `body` gana su padding-top, y toda pantalla de `height: 100vh/100dvh` EN LÍNEA quedaba 50 px
// más alta que la ventana. La regla de app/globals.css les descuenta la barra mirando el estilo en línea tal como lo
// serializa el navegador. MEDIDO en Chrome headless el 17/10 (scratchpad css-check/prueba.html, ventana de 704 px, barra
// de 50): `height: 100vh` y `height: 100dvh` → 654 px; `min-height: 100vh` → 704 (intacto); el riel del Sidebar → 704
// (lo maneja su propia regla). Lo que este test fija es que la regla siga ahí y con esas tres propiedades.
//
// Probado rompiéndolo (17/10/2026, arnés `romper.py` + `roturas-850.json`; base 3 / 3): sin la regla de `100dvh`, sin el
// `:not([data-sidebar])`, o el cartel de la copia con `top: 18` → 2 / 1 cada uno.
//
// ⚠️ EL MISMO DÍA, MÁS TARDE (Onboarding, tests 4 y 5): la regla sólo reconocía el estilo como lo escribe el NAVEGADOR
// («height: 100dvh»). Lo que llega del server sale como lo escribe React, «height:100dvh», y toda entrada a inspeccionar
// es una carga del server. MEDIDO en Chrome sin ventana (scratchpad css850, el CSS real de globals.css, ventana de 608):
// la forma del server medía 608 y ahora 558; min-height sigue en 608. Lo que el hallazgo dejó «sin hacer» (la ficha
// del CRM y la lateral del Web Generator) ya bajaba: son <aside>, top 50 medido. Roturas (arnés `romper-881.js`, base
// 20 / 0 con inspeccionar-primer-cuadro y lead-cabecera): sin `;height:100dvh` → 18 / 2 · la ficha con <div> → 19 / 1
// · «Editando el deal» en top 0 → 19 / 1 · el índice de la API en top 0 → 19 / 1 · la ruta del lead sin `arribaTabs`
// → 19 / 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string): string => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentariosCss = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, ' ');

/** El bloque de una regla cuyo selector contiene `trozo`. */
function regla(css: string, trozo: string): string {
  const i = css.indexOf(trozo);
  assert.ok(i >= 0, `no está la regla con «${trozo}»`);
  const ini = css.lastIndexOf('}', i) + 1;
  return css.slice(ini, css.indexOf('}', i) + 1);
}

test('1. las pantallas de alto fijo (100vh y 100dvh, en línea) descuentan la barra', () => {
  const css = sinComentariosCss(leer('app/globals.css'));
  for (const [unidad, valor] of [['100vh', 'calc(100vh - var(--barra-agencia))'], ['100dvh', 'calc(100dvh - var(--barra-agencia))']] as const) {
    const r = regla(css, `[data-barra-agencia] [style^="height: ${unidad}"]`);
    // Al principio del estilo y después de un espacio: `min-height` (que no desborda) queda afuera.
    assert.ok(r.includes(`[data-barra-agencia] [style*=" height: ${unidad}"]`), `falta el caso «…; height: ${unidad}» (${unidad})`);
    // Y como lo escribe React en el server (sin espacios): toda entrada a inspeccionar es una carga del server.
    for (const atributo of ['data-barra-agencia', 'data-alerta-voz']) {
      for (const forma of [`^="height: ${unidad}"`, `*=" height: ${unidad}"`, `^="height:${unidad}"`, `*=";height:${unidad}"`]) {
        assert.ok(r.includes(`[${atributo}] [style${forma}]`), `falta [${atributo}] [style${forma}]: la pantalla que llega del server no descuenta la barra`);
      }
    }
    assert.ok(r.includes(`height: ${valor} !important`), `el alto de una pantalla de ${unidad} no descuenta la barra`);
    assert.ok(!r.includes('"min-height') && !r.includes(';min-height'), 'min-height no desborda: no se toca');
  }
});

test('2. el riel del Sidebar queda afuera (tiene su regla con 100dvh para el iPad)', () => {
  const css = sinComentariosCss(leer('app/globals.css'));
  for (const unidad of ['100vh', '100dvh']) {
    const r = regla(css, `[data-barra-agencia] [style^="height: ${unidad}"]`);
    const selectores = r.slice(0, r.indexOf('{')).split(',').map((x) => x.trim()).filter(Boolean);
    assert.equal(selectores.length, 8);
    for (const s of selectores) assert.ok(s.endsWith(':not([data-sidebar])'), `«${s}» le ganaría al riel del Sidebar y le devolvería el 100vh del iPad`);
  }
  // Y la del Sidebar sigue.
  assert.match(css, /\[data-barra-agencia\] aside, \[data-alerta-voz\] aside\[data-sidebar\] \{ height: calc\(100dvh - var\(--barra-agencia\)\) !important; \}/);
});

test('3. el cartel «Copiaste un flujo» de Automations baja con la barra', () => {
  const app = leer('app/automations/ChatAgentApp.tsx');
  const i = app.indexOf('aria-label="Crear lo copiado"');
  assert.ok(i > 0);
  assert.match(app.slice(i, i + 300), /top: 'calc\(18px \+ var\(--barra-agencia, 0px\)\)'/, 'el cartel quedaba debajo de la barra (z 58 contra 300)');
});

test('4. el panel de la ficha del CRM y la lateral del Web Generator bajan con la barra porque son <aside>', () => {
  // Los dos que el hallazgo de #850 dejó «sin hacer» (`position: fixed; top: 0` y `sticky; top: 0` en una clase) ya los
  // baja la regla de TODO <aside> con la barra (`top: var(--barra-agencia) !important`). MEDIDO en Chrome sin ventana el
  // 17/10 (scratchpad css850): los dos quedan con top 50. Si alguno deja de ser <aside>, vuelve abajo de la barra.
  const css = sinComentariosCss(leer('app/globals.css'));
  assert.match(css, /\[data-barra-agencia\] aside, \[data-alerta-voz\] aside\[data-sidebar\] \{\s*top: var\(--barra-agencia\) !important;/);
  const ficha = leer('app/crm/lead-view/ficha/FichaPorBloques.tsx');
  assert.match(ficha, /<aside aria-label=\{panel === 'editar'[^\n]*\n\s*style=\{\{ position: 'fixed', top: 0,/, 'el panel del AI Analyst de la ficha dejó de ser <aside>');
  const wg = leer('app/web-generator/Inicio.tsx');
  assert.match(wg, /<aside className="gp-lateral"/, 'la lateral del Web Generator dejó de ser <aside>');
  assert.match(wg, /\.gp \.gp-lateral \{ position: sticky; top: 0;/);
});

test('5. lo que se pega a la VENTANA y no es <aside> se pega debajo de la barra', () => {
  // Relevados el 17/10 (de 18 `sticky`/`fixed` con top 0 en app/, éstos son los que scrollean con la ventana y la regla
  // de los <aside> no toma). Los que se pegan adentro de un modal o de un panel con scroll van en 0: ahí la barra no está.
  assert.match(leer('app/crm/[id]/EditarDeal.tsx'), /<div style=\{\{ position: 'sticky', top: 'var\(--barra-agencia, 0px\)', zIndex: 20,/, 'la barra de «Editando el deal»');
  const est = sinComentariosCss(leer('app/admin/estrategia/estrategia.css'));
  assert.match(est, /\.est-det\[open\] > \.est-det-cab \{\s*position: sticky; top: var\(--barra-agencia, 0px\);/, 'la cabecera abierta de /admin/estrategia');
  const gh = sinComentariosCss(leer('app/api-mako/github.css'));
  assert.match(gh, /\.gh-docs-sidebar \{ position: sticky; top: var\(--barra-agencia, 0px\); align-self: start; max-height: calc\(100vh - var\(--barra-agencia, 0px\)\);/, 'el índice de las docs de la API (es un <nav>)');
});
