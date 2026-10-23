// =============================================================================
// EL loader de las tabs grandes: la criatura de MaKo + la barra que corre, en todas (23/10/2026)
// =============================================================================
// Martín, 23/10/2026: «Los loader de las tabs o secciones grandes, quiero que sean todos como el de Ops Center. Con la
// criatura de MaKo. Solo que le falta algún elemento tipo loader para que se entienda que es un loader». Y: «ni siquiera hay
// un loader aunque sea, como para indicarme que le di click». Este test fija:
//   · lo que dibuja CargandoMako (la criatura, la barra, el nombre para el lector de pantalla, sin texto a la vista);
//   · los 150 ms del CSS iguales a MS_APARECE, y la barra que no se queda quieta con movimiento reducido;
//   · que cada tab grande de la barra (escritorio y /m) tiene su loading.tsx con ESTE loader;
//   · que la criatura del Ops Center también lleva la barra.
// ROTURAS (23/10/2026, una por vez y restaurada; base 4 / 0): sin la barra en CargandoMako → 3 / 1; sin app/plan/loading.tsx
// → 3 / 1; la barra quieta con movimiento reducido → 2 / 2; la salida de EntradaOps sin `animation: none` → 2 / 2.
// Correr: node --import tsx --test tests/cargando-mako.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BarraCargando, CargandoMako, MS_APARECE } from '../app/_ui/CargandoMako';
import { EntradaOps } from '../app/second-brain/EntradaOps';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const UI = leer('app/_ui/ui.css');

test('dibuja la criatura de MaKo y la barra que corre, con el nombre de lo que carga y sin texto a la vista', () => {
  const html = renderToStaticMarkup(createElement(CargandoMako, { que: 'Automations' }));
  assert.match(html, /role="status"/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /aria-label="Cargando Automations"/);
  assert.match(html, /class="mun mun--despierto"/, 'sin la criatura');
  assert.match(html, /class="cm-carga__pista"[^>]*><span class="cm-carga__tramo"><\/span><\/div>/, 'sin la barra: la criatura sola no se lee como loader');
  // Ningún texto a la vista (sólo el aria-label).
  assert.equal(html.replace(/<[^>]+>/g, '').trim(), '');
  // Con `cubre` tapa lo de abajo (un esqueleto), como la capa del Ops Center; sin él, tiene el alto de la pantalla.
  assert.match(renderToStaticMarkup(createElement(CargandoMako, { cubre: true })), /class="cm-carga cm-carga--cubre"/);
  assert.match(html, /height:calc\(100dvh - var\(--barra-agencia, 0px\)\)/);
  // Se importa directo: desde el índice de app/_ui iría al bundle de cientos de pantallas de cliente.
  assert.doesNotMatch(leer('app/_ui/index.ts'), /CargandoMako/);
  assert.match(renderToStaticMarkup(createElement(BarraCargando, { que: 'la bandeja' })), /aria-label="Cargando la bandeja"[^>]*><span class="cm-carga__tramo">/);
});

test('aparece a los 150 ms (MS_APARECE) y la barra dice «cargando» también con movimiento reducido', () => {
  assert.equal(MS_APARECE, 150);
  const seg = `${MS_APARECE / 1000}s`.replace(/^0/, '');
  assert.match(UI, new RegExp(`\\.cm-carga__centro \\{[^}]*animation: cm-aparece [^;]*${seg.replace('.', '\\.')} both;`), 'el retardo del CSS no es MS_APARECE');
  assert.match(UI, /\.cm-carga__tramo \{[^}]*animation: cm-corre [^;]*infinite;/, 'la barra no corre');
  assert.match(UI, /@keyframes cm-corre \{ 0% \{ transform: translateX\(-100%\); \} 100% \{ transform: translateX\(250%\); \} \}/);
  // Con movimiento reducido no corre, pero late: una barra quieta no dice nada.
  const reducido = UI.slice(UI.indexOf('.cm-carga__cria { animation: cm-aparece'));
  assert.match(reducido, /\.cm-carga__tramo \{ width: 100%; animation: cm-late [^}]*infinite; \}/);
  // El fondo tapa al instante sólo con `cubre`: sin él, en /m quedaría una caja blanca sobre otro fondo.
  assert.match(UI, /\.cm-carga--cubre \{ position: absolute; inset: 0; z-index: 20; background-color: var\(--surface\); \}/);
  assert.doesNotMatch(UI.slice(UI.indexOf('.cm-carga {'), UI.indexOf('.cm-carga--cubre {')), /background/);
});

/** Las tabs de la barra de escritorio y de /m que cargan del server: cada una con su loading.tsx y ESTE loader. */
const TABS_ESCRITORIO = ['automations', 'plan', 'dashboard', 'general', 'chats', 'calendario', 'clients', 'offer', 'web-generator', 'ads-manager', 'video-editor', 'image-editor', 'ads-writer'];
const TABS_MOVIL = ['ads', 'automations', 'calendario', 'chats', 'crm', 'cs', 'curso', 'dashboard', 'hoy', 'inbox', 'landing', 'mas', 'plan', 'second-brain', 'video'];

test('cada tab grande tiene su loading.tsx con CargandoMako (escritorio y /m)', () => {
  for (const t of TABS_ESCRITORIO) {
    const f = `app/${t}/loading.tsx`;
    assert.ok(existsSync(join(RAIZ, f)), `falta ${f}: el clic deja la pantalla anterior quieta`);
    assert.match(leer(f), /return <CargandoMako que="[^"]+" \/>;/, f);
  }
  for (const t of TABS_MOVIL) {
    const f = `app/m/${t}/loading.tsx`;
    assert.match(leer(f), /return <CargandoMako que="[^"]+" alto="calc\(100dvh - var\(--m-abajo, 72px\) - 96px\)" \/>;/, f);
  }
  // El CRM conserva su esqueleto (las medidas del tablero) y el loader lo tapa.
  assert.match(leer('app/crm/loading.tsx'), /<CargandoMako cubre que="el CRM" \/>\n\s*<\/main>/);
  assert.match(leer('app/crm/loading.tsx'), /minHeight: 0, position: 'relative' \}\}>/, 'sin position relative, la capa tapa la página entera');
  // /second-brain es el Ops Center del cliente: carga como /admin/operaciones (la criatura que espera y vuela).
  assert.match(leer('app/second-brain/loading.tsx'), /^export \{ default \} from '@\/app\/admin\/operaciones\/loading';$/m);
});

test('ir al grafo del Second Brain muestra el loader desde el toque hasta que llega el grafo (eran 2,7 s sin nada)', () => {
  const src = leer('app/second-brain/ChatSecondBrain.tsx');
  // Se prende al tocar «Second Brain» (el paso de la barra va al grafo y el grafo todavía no está)…
  assert.match(src, /setYendoAlGrafo\(paso\.ir === 'mapa' && mapa == null\);\n\s*if \(paso\.ir\) router\.push\(/);
  // …se apaga cuando llega, o al elegir otro chat…
  assert.match(src, /useEffect\(\(\) => \{ if \(mapa != null\) setYendoAlGrafo\(false\); \}, \[mapa\]\);/);
  assert.match(src, /if \(!k\.elegir\(e\)\) return;\n\s*setYendoAlGrafo\(false\);/);
  // …y mientras, el panel es el loader de todas las tabs, DESPUÉS del grafo (si el grafo está, gana el grafo).
  assert.match(src, /\) : mapa \? \([\s\S]*?\) : yendoAlGrafo \? \([\s\S]{0,200}<CargandoMako que="tu Second Brain" alto="100%" \/>/);
  assert.match(src, /import \{ CargandoMako \} from '@\/app\/_ui\/CargandoMako';/);
});

test('la criatura del Ops Center también lleva la barra, y la barra no vuela con ella', () => {
  const html = renderToStaticMarkup(createElement(EntradaOps, { espera: true }));
  assert.match(html, /<div class="eo-vuelo">[\s\S]*<\/div><div class="cm-carga__pista eo-pista"><span class="cm-carga__tramo"><\/span><\/div><\/div>$/, 'la barra va afuera de .eo-vuelo, al final de la capa');
  const css = leer('app/admin/operaciones/centro.css');
  assert.match(css, /\.eo-capa \{ flex-direction: column; gap: 18px; \}/);
  // La animación de aparecer deja `opacity: 1` puesta (fill both): para apagarla al irse hay que sacarla.
  assert.match(css, /\.eo-capa\[data-sale\] \.eo-pista \{ animation: none; opacity: 0; \}/);
});
