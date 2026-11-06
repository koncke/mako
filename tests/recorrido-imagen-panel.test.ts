// =============================================================================
// tests/recorrido-imagen-panel — el Image Editor con la barra fijada y el chat abiertos (6/11/2026)
// =============================================================================
// Llamada con Leila del 5/11 y recorrido del 30/10 (1.4): «pantalla rota con la barra fijada y el chat abiertos». En Create
// el editor comparte la pantalla con la barra lateral y la tarjeta de MaKo, y el panel de herramientas empujaba el lienzo:
// a 1280 px le quedaban 257 px y la página se cortaba. `122071b5c` había arreglado una réplica (PageSlot), no el editor.
// Ahora, con el CUERPO del editor angosto, el panel se abre ENCIMA del lienzo (chrome/ToolHost.module.css). Medido con el
// editor de verdad en un banco: docs/recorrido-visual/imagen-barra-chat-*.png (a 1280 el lienzo pasó de 257 a 619 px).
//
// Probado rompiéndolo (6/11/2026), base 4 pasan / 0 fallan:
//   · el cuerpo sin `container-type` ............................ 1 falla
//   · el cuerpo con `container-name` (el módulo lo renombra) .... 1 falla
//   · el umbral en 700 px (vuelve a cortarse a 1366) ............ 1 falla
//   · el umbral en 900 px (cambia también a 1440, donde entra) .. 1 falla
//   · el panel sin `position: absolute` (sigue empujando) ....... 1 falla
//   · el panel debajo de la barra flotante del objeto ........... 1 falla
//   · el panel montado fuera del cuerpo del editor .............. 1 falla
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '../app/image-editor/_doory');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de la primera regla `sel {…}` de nivel superior (sin anidar). */
const regla = (css: string, sel: string) => {
  const i = css.search(new RegExp(`(^|\\n)${sel.replace('.', '\\.')}\\s*\\{`));
  assert.ok(i >= 0, `no está la regla ${sel}`);
  const ini = css.indexOf('{', i) + 1;
  return css.slice(ini, css.indexOf('}', ini));
};
const px = (tokens: string, nombre: string) => {
  const m = tokens.match(new RegExp(`${nombre}:\\s*(\\d+)px`));
  assert.ok(m, `no está el token ${nombre}`);
  return Number(m[1]);
};

const EDITOR = sinComentarios(leer('editor/EditorApp.module.css'));
const PANEL = sinComentarios(leer('editor/chrome/ToolHost.module.css'));
const TOKENS = sinComentarios(leer('styles/tokens.css'));
// Lo que pide el encabezado de una página («Página 1 - Agregar título» + tamaño + flechas), medido en el banco.
const ENCABEZADO = 372;
// A 1440 el editor tiene 1440 − la barra lateral (240) − la tarjeta de MaKo (348) = 852 px, y ahí el modo de siempre entra.
const EDITOR_A_1440 = 1440 - 240 - 348;

test('el cuerpo del editor es el contenedor que mide el panel, sin nombre', () => {
  const body = regla(EDITOR, '.body');
  assert.match(body, /container-type:\s*inline-size/, 'sin contenedor, el panel decide por la ventana, que no sabe del chat ni de la barra');
  assert.doesNotMatch(body, /container-name/, 'un módulo CSS renombra el `container-name` y la consulta de ToolHost no lo encuentra');
  assert.match(body, /position:\s*relative/, 'el panel encima se ubica contra el cuerpo');
});

test('el umbral: el panel va encima cuando el lienzo no entra, y no cambia nada donde sí entra', () => {
  const m = PANEL.match(/@container\s*\(max-width:\s*(\d+)px\)\s*\{/);
  assert.ok(m, 'no hay consulta de contenedor en el panel');
  const umbral = Number(m[1]);
  const minimo = px(TOKENS, '--cv-editor-rail-w') + px(TOKENS, '--cv-editor-panel-w') + ENCABEZADO;
  assert.ok(umbral >= minimo, `con ${umbral} px el encabezado de la página se corta (pide ${minimo})`);
  assert.ok(umbral < EDITOR_A_1440, `con ${umbral} px el panel taparía el lienzo a 1440, donde el modo de siempre entra`);
});

test('adentro del umbral, el panel flota sobre el lienzo, al lado del riel y encima de la barra del objeto', () => {
  const ini = PANEL.search(/@container\s*\(max-width:/);
  const bloque = PANEL.slice(ini, PANEL.indexOf('}\n}', ini) + 1);
  const m = bloque.match(/\.sidebar\s*\{([^}]*)\}/);
  assert.ok(m, 'la consulta no toca el panel');
  const sidebar = m[1];
  assert.match(sidebar, /position:\s*absolute/, 'el panel sigue empujando el lienzo');
  assert.match(sidebar, /left:\s*var\(--cv-editor-rail-w\)/, 'el panel no arranca al lado del riel');
  assert.match(sidebar, /top:\s*0/);
  assert.match(sidebar, /bottom:\s*0/);
  assert.match(sidebar, /z-index:\s*calc\(var\(--cv-z-sticky\)\s*\+\s*\d+\)/, 'la barra flotante del objeto le tapa el «‹» que lo cierra');
});

test('el panel es hijo directo del cuerpo del editor (su contenedor más cercano)', () => {
  const tsx = leer('editor/EditorApp.tsx');
  assert.match(tsx, /<div className=\{styles\.body\}>\s*<RielCanva \/>\s*<SidebarHost \/>/, 'el panel no vive en el cuerpo: la consulta mediría otra caja');
});
