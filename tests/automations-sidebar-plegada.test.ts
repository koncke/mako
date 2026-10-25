// =============================================================================
// Automations arranca con la sidebar principal PLEGADA, el panel más grueso y el rail sin barra de scroll (23/10/2026)
// =============================================================================
// Martín: «Quiero que al entrar a Automations, por defecto la sidebar principal esté plegada, entonces puedes hacer que la
// sidebar de las automatizaciones y el chat con MaKo sea más gruesa, así se puede escribir con más comodidad. Y siempre
// cuando la sidebar principal esté plegada, no debe aparecer la barra de scroll.»
// Tres cosas, tres rojos posibles: la ruta en `RUTAS_QUE_PLIEGAN` (el mismo mecanismo del Ops Center), el ancho del panel
// (`MUELLE.listaAncho`, del que cuelgan los insets del lienzo) y la regla de CSS que esconde la barra del rail.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pliegaLaBarra, RUTAS_QUE_PLIEGAN } from '../app/_components/Sidebar';
import { MUELLE, muelles } from '../lib/lienzo-grafo';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('Automations arranca con la sidebar principal plegada (y sólo ella, no una ruta que se le parezca)', () => {
  assert.ok(RUTAS_QUE_PLIEGAN.includes('/automations'));
  assert.equal(pliegaLaBarra('/automations'), true);
  assert.equal(pliegaLaBarra('/automations/nueva'), true);
  assert.equal(pliegaLaBarra('/automationsx'), false);
  // El Ops Center sigue plegando, y las demás tabs no.
  assert.equal(pliegaLaBarra('/second-brain'), true);
  assert.equal(pliegaLaBarra('/crm'), false);
  // Es «por defecto», no forzada: la flecha la vuelve a abrir (la misma lógica de plegadaAca/abiertaAca de siempre).
  const sb = leer('app/_components/Sidebar.tsx');
  assert.match(sb, /const plegadaAca = enOpsCenter \|\| angosta \|\| makoAbierto;/);
  assert.match(sb, /const fija = barraFija\(fijaGuardada, plegadaAca, abiertaAca\);/);
  // Plegada por defecto: la flecha la abre en la visita (y desplegarla se recuerda, 25/10: tests/sidebar-plegada-por-defecto).
  assert.match(sb, /if \(plegadaAca\) setAbiertaAca\(v\);/, 'plegada por defecto: la flecha no la abre');
});

test('el panel de Automations (lista y chat con MaKo) es más grueso, y los insets del lienzo salen del mismo número', () => {
  assert.ok(MUELLE.listaAncho >= 400 && MUELLE.listaAncho <= 460, `listaAncho ${MUELLE.listaAncho}: fuera de 400–460`);
  // En 1366 de ancho, con el rail de 68 px, el lienzo no queda tapado: sobra más de la mitad.
  const caja = { w: 1366 - 68, h: 700 };
  const m = muelles(caja, { listaAbierta: true, probarAbierto: false, editorAbierto: false });
  assert.equal(m.insets.izq, MUELLE.listaAncho + MUELLE.hueco * 2, 'el lienzo corre su borde izquierdo lo que mide el panel');
  assert.ok(caja.w - m.insets.izq >= caja.w / 2, 'el panel no deja ni la mitad del lienzo en 1366');
  // El panel dibujado usa la misma constante (no un número propio).
  const panel = leer('app/automations/SimuladorWhatsApp.tsx');
  assert.match(panel, /export const LISTA_ANCHO = MUELLE\.listaAncho;/);
  assert.match(panel, /width: LISTA_ANCHO,/);
});

test('la sidebar principal plegada no muestra barra de scroll (en toda la app), y abierta sigue adelgazada', () => {
  const css = leer('app/_ui/ui.css');
  const regla = css.match(/aside\[data-sidebar\]\[data-fija="no"\] \.mk-scroll-oscuro \{([^}]*)\}/);
  assert.ok(regla, 'falta la regla del rail sin barra');
  assert.match(regla![1], /scrollbar-width: none;/);
  assert.match(css, /aside\[data-sidebar\]\[data-fija="no"\] \.mk-scroll-oscuro::-webkit-scrollbar \{\s*display: none;/);
  // Se engancha en lo que la barra ya declara (data-fija), y el menú sigue siendo el que scrollea (sin barra, pero scrollea).
  const sb = leer('app/_components/Sidebar.tsx');
  assert.match(sb, /<aside data-sidebar data-fija=\{fija \? 'si' : 'no'\}/);
  assert.match(sb, /<nav className="mk-scroll-oscuro" style=\{\{[^}]*overflowY: 'auto'/);
  // Abierta y fija: la receta de siempre (delgada y teñida), no escondida.
  assert.match(css, /\.mk-scroll-oscuro \{\n  scrollbar-width: thin;/);
});
