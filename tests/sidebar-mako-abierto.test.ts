// =============================================================================
// Al abrir a MaKo la sidebar se pliega, y al cerrarlo vuelve a como estaba; Automations con un ícono que se entiende
// (22/10/2026)
// =============================================================================
// Martín: «si abro a MaKo, se debería plegar la sidebar principal, para optimizar espacios. Si antes la tenía desplegada y
// fija, al cerrar MaKo debe volver a su lugar». Y: «en la sidebar principal no me gusta el ícono de "Automations", cambialo
// por otro que se entienda más» (era `chatbot`, el globito de chat con chispas).
//   1. el estado compartido del panel (app/_chat/mako-abierto.ts): avisa una vez por cambio;
//   2. la estrella (app/_chat/MakoEnLaTab.tsx) lo marca al abrir y lo desmarca al cerrar o al salir de la tab;
//   3. la barra (app/_components/Sidebar.tsx) lo suma a su pliegue TEMPORAL (`plegadaAca`, el del Ops Center y la ventana
//      chica): plegada mientras tanto, la flecha no pisa lo guardado, y al cerrar `fija` vuelve a ser la guardada;
//   4. Automations lleva `flujo` (tres pasos unidos) en la barra, el buscador (toma el de nav.ts) y el teléfono.
//
// PROBADO ROMPIÉNDOLO (22/10/2026, arnés `romper-sidebar.mjs` del scratchpad de la sesión de Offer, con sidebar-nueva y
// ventana-chica; base 20/0, 8 de 8 cazadas): avisa aunque no cambie → 1 · abrir el panel no pliega la barra → 1 · salir de la
// tab la deja plegada → 1 · la barra no mira a MaKo → 3 · la flecha con MaKo abierto pisa lo guardado → 2 · la fila de la
// barra con el globito → 1 · el teléfono con el globito → 1 · el ícono fuera del set → 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { makoAbierto, marcarMakoAbierto, suscribirMakoAbierto } from '../app/_chat/mako-abierto';
import { Icon } from '../app/_components/icons';
import { FAMILIAS, itemsDe } from '../app/_components/nav';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. el estado del panel de MaKo avisa una vez por cambio', () => {
  let avisos = 0;
  const soltar = suscribirMakoAbierto(() => { avisos++; });
  try {
    assert.equal(makoAbierto(), false, 'arranca cerrado');
    marcarMakoAbierto(true);
    marcarMakoAbierto(true);
    assert.equal(makoAbierto(), true);
    assert.equal(avisos, 1, 'abrir dos veces avisa una');
    marcarMakoAbierto(false);
    assert.equal(makoAbierto(), false);
    assert.equal(avisos, 2);
  } finally { soltar(); }
  marcarMakoAbierto(true);
  assert.equal(avisos, 2, 'el que se soltó no se entera');
  marcarMakoAbierto(false);
});

test('2. la estrella lo marca al abrir, y lo desmarca al cerrar o al salir de la tab', () => {
  const tab = sinComentarios(leer('app/_chat/MakoEnLaTab.tsx'));
  assert.match(tab, /import \{ marcarMakoAbierto \} from '\.\/mako-abierto';/);
  const efecto = tab.slice(tab.indexOf("raiz.setProperty('--ancho-panel-mako'"), tab.indexOf('}, [abierto]);'));
  assert.match(efecto, /marcarMakoAbierto\(abierto\);/, 'abrir el panel no pliega la barra');
  assert.match(efecto, /return \(\) => \{ raiz\.removeProperty\('--ancho-panel-mako'\); marcarMakoAbierto\(false\); \};/,
    'salir de la tab con el panel abierto dejaba la barra plegada en las demás');
  // El panel se pega al borde MEDIDO de la barra: plegada, se corre con ella, y la tab sigue dejándole lo que mide el panel.
  assert.match(tab, /const borde = useBordeDeLaBarra\(\);/);
  // (24/10/2026, f34: se observa lo que se mide, la barra o, para la estrella, su panel.)
  assert.match(tab, /const medida = visible \? panelDeLaBarra\(barra\) : barra;[\s\S]{0,300}ro\?\.observe\(medida\)/, 'el borde no sigue a la barra cuando se pliega');
  assert.match(tab, /raiz\.setProperty\('--ancho-panel-mako', abierto \? `\$\{ANCHO_PANEL\}px` : '0px'\);/);
});

test('3. la barra se pliega mientras MaKo está abierto, sin pisar lo guardado, y vuelve sola al cerrar', () => {
  const sb = sinComentarios(leer('app/_components/Sidebar.tsx'));
  assert.match(sb, /import \{ useMakoAbierto \} from '@\/app\/_chat\/mako-abierto';/);
  assert.match(sb, /const makoAbierto = useMakoAbierto\(\);\s*const plegadaAca = enOpsCenter \|\| angosta \|\| makoAbierto;/);
  // `fija` es la GUARDADA salvo donde se pliega sola: al cerrar MaKo `plegadaAca` vuelve a false y la barra, a lo suyo
  // (desplegada y fija si lo estaba, plegada si ya lo estaba).
  assert.match(sb, /const fija = fijaGuardada && \(!plegadaAca \|\| abiertaAca\);/);
  // Lo que se toca con MaKo abierto (la flecha) es de ese rato: no se guarda.
  const setFija = sb.slice(sb.indexOf('const setFija = (v: boolean) => {'), sb.indexOf('const open = '));
  assert.match(setFija, /if \(plegadaAca\) \{ setAbiertaAca\(v\); if \(!v\) setExpanded\(false\); return; \}/);
  assert.equal(setFija.indexOf('guardarFija(') > setFija.indexOf('return; }'), true, 'con MaKo abierto, la flecha pisaba la preferencia');
  // Y lo abierto de ese rato no sobrevive al cerrar.
  assert.match(sb, /useEffect\(\(\) => \{ setAbiertaAca\(false\); \}, \[plegadaAca\]\);/);
});

test('4. Automations lleva el ícono de un flujo en la barra, el buscador y el teléfono', () => {
  // Existe en el set (uno que no está dibuja un punto) y no es el globito de antes.
  const flujo = renderToStaticMarkup(createElement(Icon, { name: 'flujo' }));
  assert.notEqual(flujo, renderToStaticMarkup(createElement(Icon, { name: 'no-existe' })), 'el ícono no está en el set');
  assert.match(flujo, /<rect[^>]*><\/rect><circle[^>]*><\/circle><rect[^>]*><\/rect><path d="M10 6\.25h4\.75"><\/path>/, 'tres pasos unidos');
  // La barra y el buscador (BuscadorNav dibuja `item.icon` de nav.ts): la fila de la TAB (unificada: la barra la dibuja a
  // ella) y sus secciones (`itemsDe` la abre en sus secciones, lo que ve el buscador).
  const filas = FAMILIAS.flatMap((f) => [...f.bloques.flat(), ...(f.grupos ?? []).flatMap((g) => g.items)]);
  const deAutomations = [...filas, ...FAMILIAS.flatMap((f) => itemsDe(f))].filter((i) => i.label === 'Automations');
  assert.ok(deAutomations.some((i) => i.key === 'automatizaciones'), 'no encontré la fila de Automations en la barra');
  assert.ok(deAutomations.some((i) => i.key === 'setting'), 'no encontré la sección de Automations');
  for (const i of deAutomations) assert.equal(i.icon, 'flujo', `${i.key}: ${i.icon}`);
  assert.match(sinComentarios(leer('app/_components/BuscadorNav.tsx')), /<Icon name=\{d\.item\.icon\}/);
  // El teléfono: su menú, las tarjetas del lienzo sin ícono propio y lo que propone un flujo en la bandeja.
  assert.match(leer('lib/movil-rutas.ts'), /\{ id: 'automations', label: 'Automations', href: '\/m\/automations', icon: 'flujo',/);
  assert.match(leer('app/m/automations/modelo.ts'), /icono: ICONO_DE_TITULO\[titulo\] \?\? 'flujo' \}/);
  assert.match(leer('app/m/inbox/decision-m.ts'), /\[etiquetaDeOrigen\('flujo:x'\)\]: 'flujo',/);
});
