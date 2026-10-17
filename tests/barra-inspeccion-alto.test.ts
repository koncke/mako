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
    assert.ok(r.includes(`[data-alerta-voz] [style^="height: ${unidad}"]`), 'la alerta de la voz también corre el body');
    assert.ok(r.includes(`height: ${valor} !important`), `el alto de una pantalla de ${unidad} no descuenta la barra`);
    assert.ok(!r.includes('"min-height'), 'min-height no desborda: no se toca');
  }
});

test('2. el riel del Sidebar queda afuera (tiene su regla con 100dvh para el iPad)', () => {
  const css = sinComentariosCss(leer('app/globals.css'));
  for (const unidad of ['100vh', '100dvh']) {
    const r = regla(css, `[data-barra-agencia] [style^="height: ${unidad}"]`);
    const selectores = r.slice(0, r.indexOf('{')).split(',').map((x) => x.trim()).filter(Boolean);
    assert.equal(selectores.length, 4);
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
