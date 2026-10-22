// =============================================================================
// Clients sin título, sin el desplegable del servicio y con el fondo de MaKo (18/10/2026, Martín, pt 14)
// =============================================================================
// docs/feedback-18-10.md, pt 14: «sin el título "Clients" (ya está la tab); el desplegable dice "VSL Funnel" con el
// nombre viejo, y sobra porque el de la topbar ya cambia de CRM; el fondo, el de MaKo (no crema), con cuadrícula».
//   1. la cartera no dibuja título (queda el aviso de MaKo, que es lo único que informa);
//   2. no está el desplegable del servicio, y «Editar etapas» —lo único suyo— sigue a mano en los tres puntos;
//   3. la cabecera y el cuerpo de la comunidad van sobre el fondo de MaKo con la cuadrícula, no sobre el papel crema.
//
// PROBADO ROMPIÉNDOLO (18/10/2026), con el archivo en 3 / 0 y los archivos de antes, de a uno y restaurados:
//   · app/customer-success/ClientesApp.tsx de antes (título y desplegable)          → 1 / 2
//   · app/clients/estilos.ts de antes (la cabecera sobre `--cl-papel`)              → 2 / 1
// Correr: node --import tsx --test tests/clients-cabecera-18-10.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

test('la cartera no repite el título de la tab', () => {
  const app = leer('app/customer-success/ClientesApp.tsx');
  assert.doesNotMatch(app, /titulo="Clients"/, 'volvió el título «Clients»: ya lo dice la tab');
  assert.match(app, /<span className="cl-mako">\{mako\}<\/span>/, 'el aviso de MaKo se tiene que seguir viendo');
});

test('sin el desplegable del servicio, y «Editar etapas» en los tres puntos', () => {
  const app = leer('app/customer-success/ClientesApp.tsx');
  assert.doesNotMatch(app, /<SelectorServicio\b/, 'volvió el desplegable del servicio: el de la cabecera ya elige');
  // (21/10/2026) Los tres puntos son una LISTA desde que también llevan «Personalizar tarjetas» (sólo en el kanban):
  // «Editar etapas» sigue igual, ahora como uno de sus renglones (tests/clientes-tarjeta-plantillas.test.ts).
  assert.match(app, /accionesExtra=\{\[\s*\.\.\.\(puedeEditarEtapas && servicio \? \[\{[\s\S]{0,200}label: 'Editar etapas'[\s\S]{0,120}onClick: \(\) => setEditandoEtapas\(true\)/,
    'editar las etapas tiene que seguir a mano');
});

test('el fondo de MaKo con la cuadrícula, no el papel crema', () => {
  const css = leer('app/clients/estilos.ts');
  const cab = css.match(/\n\.cls-cab\{[^}]*\}/)?.[0] ?? '';
  assert.doesNotMatch(cab, /var\(--cl-papel\)/, 'la cabecera volvió al papel crema');
  assert.match(css, /\.cls-cuerpo--papel, \.cls-cab\{ background-color: var\(--bg\); background-image: radial-gradient\(var\(--border\) 1px, transparent 1px\)/);
});
