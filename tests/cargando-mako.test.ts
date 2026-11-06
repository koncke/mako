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
// ADMIN (6/11/2026, punto 31 de docs/admin/revision-cerebro-6-11.md; base 6 / 0): app/admin/(polar)/loading.tsx sin CargandoMako
// → 5 / 1.
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
const TABS_ESCRITORIO = ['automations', 'plan', 'dashboard', 'chats', 'calendario', 'classroom', 'offer', 'web-generator', 'ads-manager', 'video-editor', 'image-editor', 'ads-writer'];
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
  // ⛔ Una página que redirige SIEMPRE no lleva loading.tsx (ticket #7, 23/10/2026): con él, su redirect() va adentro del
  // stream (200 + meta refresh, no 307) y la carrera con la hidratación tiró «React error #310» en el router de Next.
  assert.ok(!existsSync(join(RAIZ, 'app/general/loading.tsx')), 'volvió el loading.tsx de /general, que sólo redirige a /dashboard');
  assert.match(leer('app/general/page.tsx'), /^\s*redirect\(conLaQuery\('\/dashboard'/m, '/general dejó de ser sólo un redirect: revisar si ahora le toca un loader');
  // /second-brain es el Ops Center del cliente: carga como /admin/operaciones (la criatura que espera y vuela).
  assert.match(leer('app/second-brain/loading.tsx'), /^export \{ default \} from '@\/app\/admin\/operaciones\/loading';$/m);
});

test('Admin (la copia de Polar) tiene su loader con CargandoMako y un esqueleto: en la portada de la tab y en la ficha de un negocio', async () => {
  // Punto 31 de docs/admin/revision-cerebro-6-11.md: «se hace clic y no pasa nada». Se DIBUJAN los dos loading.tsx (sin hooks:
  // son server) y se mira que traigan EL loader de las tabs y el esqueleto debajo.
  for (const [archivo, que] of [['app/admin/(polar)/loading.tsx', 'Admin'], ['app/admin/(polar)/customers/[id]/loading.tsx', 'el negocio']] as const) {
    const { default: Cargando } = (await import(`../${archivo}`)) as { default: () => ReturnType<typeof CargandoMako> }
    const html = renderToStaticMarkup(createElement(Cargando))
    assert.match(html, new RegExp(`aria-label="Cargando ${que}"`), `${archivo}: sin CargandoMako`)
    assert.match(html, /class="cm-carga cm-carga--cubre"/, `${archivo}: el loader no tapa el esqueleto`)
    assert.match(html, /class="cm-carga__pista"/, `${archivo}: sin la barra que corre`)
    assert.ok((html.match(/rounded-md bg-gray-100/g) ?? []).length >= 6, `${archivo}: sin el esqueleto de la página`)
    assert.equal(html.replace(/<[^>]+>/g, '').trim(), '', `${archivo}: ningún texto a la vista`)
    assert.match(leer(archivo), /^import \{ CargandoMako \} from '@\/app\/_ui\/CargandoMako'/m, `${archivo}: CargandoMako directo, no desde el índice de app/_ui`)
  }
})

test('ir al grafo del Second Brain muestra el loader desde el toque hasta que llega el grafo (eran 2,7 s sin nada)', () => {
  // Desde el 23/10 lo lleva `yendo` (ChatSecondBrain.tsx, del chat Ops Center): cubre también la vuelta (el chat se ve ya).
  const src = leer('app/second-brain/ChatSecondBrain.tsx');
  // Se prende al tocar «Second Brain» (el paso de la barra va al grafo)…
  assert.match(src, /if \(paso\.ir\) \{ setYendo\(paso\.ir === 'mapa' \? 'mapa' : 'fuera'\); router\.push\(/);
  // …se suelta cuando llega el grafo (o se va)…
  assert.match(src, /useEffect\(\(\) => \{ setYendo\(null\); \}, \[mapa\]\);/);
  assert.match(src, /const verMapa = yendo \? yendo === 'mapa' : hayMapa;/);
  // …y mientras, el panel del grafo es el loader de todas las tabs (si el grafo está, gana el grafo).
  assert.match(src, /\) : verMapa \? \([\s\S]*?\{mapa\n\s*\? <VolverDelGrafo\.Provider[\s\S]*?: <CargandoMako que="tu Second Brain" alto="100%" \/>\}/);
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
