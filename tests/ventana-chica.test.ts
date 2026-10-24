// =============================================================================
// MaKo en una ventana de escritorio CHICA (21/10/2026)
// =============================================================================
// Martín: MaKo se rompía apenas la ventana era un poco más angosta que la pantalla completa (su caso: 60 % de
// 1920×1080 con escala 125 %, 934×639 de CSS). Medido en producción contando, no a ojo (docs/hallazgos-ui.md):
//   · /integraciones a 934: 38 px de scroll de costado, 5 textos fuera de la ventana y 20 motivos cortados con «…»;
//   · el modal de un servicio: el panel oscuro 38 % del ancho y más alto que el modal (se cortaba abajo);
//   · a 1027, el Dashboard pisaba un título y el CRM scrolleaba 1 px; con la barra plegada, nada.
// La red es el LAYOUT: debajo de 1200 la barra principal arranca plegada, y el molde de ajustes y el modal se
// angostan en el mismo corte.
//
// Probado ROMPIÉNDOLO, de a uno, con la base en 3 pases y 0 fallos:
//   · la barra sin plegarse en una ventana chica                          → 2 / 1 (la barra)
//   · el server diciendo «angosta» (la barra nacería plegada en todas)    → 2 / 1 (la barra)
//   · el corte de ajustes en otro ancho que el de la barra                → 2 / 1 (el mismo corte)
//   · el panel oscuro del modal sin angostarse                            → 2 / 1 (el mismo corte)
//   · el panel oscuro sin topearse a su celda                             → 2 / 1 (el mismo corte)
//   · una grilla de /integraciones con el mínimo fijo otra vez            → 2 / 1 (/integraciones)
//   · el nombre de un servicio con «…» otra vez                           → 2 / 1 (/integraciones)
//   · el motivo de «Requiere tu atención» con «…» otra vez                → 2 / 1 (/integraciones)
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ANCHO_BARRA_PLEGADA } from '../app/_components/Sidebar';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const CORTE = `${ANCHO_BARRA_PLEGADA - 0.02}px`;

test('debajo de 1200 px la barra principal arranca plegada a íconos (y la flecha la abre ahí)', () => {
  assert.equal(ANCHO_BARRA_PLEGADA, 1200);
  const sb = sinComentarios(leer('app/_components/Sidebar.tsx'));
  // La pregunta la hace el navegador (matchMedia); en el server, abierta (no hay ventana que medir).
  assert.match(sb, /const MQ_ANGOSTA = `\(max-width: \$\{ANCHO_BARRA_PLEGADA - 0\.02\}px\)`;/);
  assert.match(sb, /\(\) => window\.matchMedia\(MQ_ANGOSTA\)\.matches,\s*\(\) => false,/);
  // La misma regla que el Ops Center: plegada por defecto, la flecha la fija abierta SIN tocar la preferencia guardada.
  // (Y desde el 22/10/2026 también con el panel de MaKo abierto: tests/sidebar-mako-abierto.test.ts.)
  assert.match(sb, /const plegadaAca = enOpsCenter \|\| angosta \|\| makoAbierto;/);
  assert.match(sb, /const fija = fijaGuardada && \(!plegadaAca \|\| abiertaAca\);/);
  assert.match(sb, /if \(plegadaAca\) \{ setAbiertaAca\(v\); if \(!v\) setExpanded\(false\); return; \}/);
});

test('el molde de ajustes y el modal de un servicio se angostan en el MISMO corte que la barra', () => {
  const aj = leer('app/_ui/ajustes.css');
  assert.ok(aj.includes(`@media (max-width: ${CORTE}) {\n  .aj { padding: 26px 26px 72px; gap: 24px; }\n  .aj-indice { width: 196px; }`), 'el índice de ajustes no se angosta debajo del corte');
  const g = leer('app/globals.css');
  assert.ok(g.includes(`@media (max-width: ${CORTE}) {\n  .mk-svc-modal { grid-template-columns: 236px minmax(0, 1fr); }`), 'el panel oscuro del modal no se angosta');
  // Con poco alto, el panel se topea a su celda (medía 566 en una fila de 518) y scrollea solo; no en el apilado.
  assert.match(g, /@media \(max-height: 760px\) and \(min-width: 820\.02px\) \{\s*\.mk-svc-aside \{ overflow-y: auto; max-height: 100%; \}/);
});

test('/integraciones: ninguna grilla desborda una columna angosta y ningún nombre o motivo se corta', () => {
  const b = sinComentarios(leer('app/integraciones/IntegracionesBoard.tsx'));
  // `minmax(Npx, 1fr)` sin `min(…, 100%)` desborda una columna más angosta que N: ninguna queda así.
  const sueltas = b.match(/minmax\(\d+px,\s*1fr\)/g) ?? [];
  assert.deepEqual(sueltas, [], 'una grilla con un mínimo fijo desborda en una ventana chica');
  // Las grillas que quedan (24/10/2026: una para las dos secciones de tarjetas, más las de «Costo de MaKo» y del modal).
  assert.ok((b.match(/minmax\(min\(\d+px,100%\),1fr\)/g) ?? []).length >= 4);
  assert.match(b, /gridTemplateColumns: 'repeat\(auto-fill,minmax\(min\(236px,100%\),1fr\)\)'/, 'la grilla de las tarjetas, sin desbordar');
  // El motivo de una conectada con un problema (desde el 24/10/2026 en su tarjeta, no en «Requiere tu atención») y el nombre de
  // cada servicio se leen enteros.
  assert.match(b, /color: equipo \? 'var\(--dim\)' : sev === 'bad' \? 'var\(--bad\)' : sev === 'warn' \? 'var\(--warn\)' : 'var\(--good\)', overflowWrap: 'anywhere' \}\}>[\s\S]{0,240}\{equipo \? POR_QUE_LA_CONFIGURA_MAKO : motivo \?\? 'Conectada'\}/);
  assert.doesNotMatch(b, /textOverflow: 'ellipsis', whiteSpace: 'nowrap' \}\}>\{i\.nombre\}/);
  assert.match(b, /overflowWrap: 'anywhere' \}\}>\{i\.nombre\}<\/span>/);
});
