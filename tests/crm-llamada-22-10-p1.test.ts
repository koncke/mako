// =============================================================================
// Los P1 del CRM de la llamada con Mauricio (22/10/2026): mover sin esperar, crear con loader, el menú que tapaba
// =============================================================================
// C3 (min 04:32): «al mover un lead a otra etapa, no tarde tanto en cambiarse... ese ya se movió, solamente que permanece
//   en la etapa anterior, porque todavía está cargando». Era «Agenda» con «Ya está agendada» / «Ya ocurrió»: el único
//   camino del arrastre que esperaba al server para mover la tarjeta (`persistStage` y `moverEnProducto` ya eran optimistas).
// C4 (min 19:30): «tarda mucho en crearse y tal vez necesita un loader» (crear una etapa).
// C5 (min 16:15): «cuando le das al botón de editar, se queda el desplegable del CRM por encima del pop-up que salta».
// C7 (min 10:00): Mauricio no encontraba «Pagos» en la ficha; Martín: «se puso muy escondido el desplegable de las
//   pestañas, yo voy a hacer de que esté un poco más visible». El desplegable queda; las otras hojas, como atajos.
//
// PROBADO ROMPIÉNDOLO (22/10/2026), con el archivo en 4 / 0, una rotura por vez y restaurada:
//   · `confirmManualMeeting` sin mover la tarjeta antes de la acción                    → 3 / 1
//   · el pop-up de etapas sin la fila «Creando…»                                       → 3 / 1
//   · el tablero sin la columna «Creando la etapa…»                                     → 3 / 1
//   · el lápiz del selector de CRMs sin `cierra: true`                                  → 3 / 1
//   · la ficha sin los atajos de las otras hojas (C7)                                 → 3 / 1
// Correr: node --import tsx --test tests/crm-llamada-22-10-p1.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const BOARD = sinComentarios(leer('app/crm/CrmBoard.tsx'));

test('C3: «Ya está agendada» mueve la tarjeta en el acto y la devuelve si el server falla', () => {
  const i = BOARD.indexOf('const confirmManualMeeting = ');
  const f = BOARD.slice(i, BOARD.indexOf('\n  };', i));
  const optimista = f.indexOf('setLocalStage((m) => ({ ...m, [leadId]: which }));');
  assert.ok(optimista > 0, 'la tarjeta espera al server para moverse');
  assert.ok(optimista < f.indexOf('await markMeetingManualAction('), 'mueve DESPUÉS de esperar al server');
  assert.match(f, /\} catch \{\s*setLocalStage\(\(m\) => \{ const n = \{ \.\.\.m \}; if \(previo === undefined\) delete n\[leadId\]; else n\[leadId\] = previo; return n; \}\);/, 'si falla, la tarjeta no vuelve');
});

test('C4: crear una etapa se ve: «Creando…» en su lugar, en el pop-up de etapas y en el tablero', () => {
  const m = sinComentarios(leer('app/crm/EtapasModal.tsx'));
  assert.match(m, /onCrear=\{\(label\) => \{ setCreando\(\{ label, despuesDe: etapas\[i - 1\]\.key \}\); aplicar\(/);
  assert.match(m, /\{creando\?\.despuesDe === e\.key && <FilaCreando label=\{creando\.label\} caja=\{caja\} \/>\}/);
  assert.match(m, /if \(!r\.ok\) \{ setError\(r\.error\); setOrdenLocal\(null\); setNutriLocal\(null\); setCreando\(null\); return; \}/, 'un error deja el «Creando…» para siempre');
  assert.match(m, /await cargar\(\);\s*setCreando\(null\);/);
  assert.match(BOARD, /if \(op\.op === 'agregar'\) setCreandoTras\(op\.despuesDe \?\? null\);/);
  assert.match(BOARD, /\{creandoTras === c\.key && \(/);
  assert.match(BOARD, /useEffect\(\(\) => \{ setCreandoTras\(null\); \}, \[stages\]\);/, 'la columna «Creando…» no se va cuando llegan las etapas');
});

test('C5: el lápiz del selector de CRMs cierra el desplegable al abrir el pop-up', () => {
  const t = sinComentarios(leer('app/crm/CrmToolbar.tsx'));
  const i = t.indexOf('title: `Editar las etapas de ${comoSeLlama(f)}`');
  assert.ok(i > 0);
  assert.match(t.slice(i, i + 200), /cierra: true,/);
  // La marca la entiende el desplegable de la casa.
  assert.match(leer('app/components/Dropdown.tsx'), /a\.onClick\(\); if \(a\.cierra\) close\(\);/);
});

test('C7: las otras hojas de la ficha, a la vista al lado del título (el desplegable sigue)', () => {
  const t = sinComentarios(leer('app/crm/lead-view/LeadTabs.tsx'));
  assert.match(t, /<nav className="lt-atajos" aria-label="Otras hojas de la ficha">/);
  assert.match(t, /tabs\.filter\(\(t\) => t\.key !== activeKey\)\.map\(\(t\) => \(/, 'los atajos son las OTRAS hojas');
  assert.match(t, /onClick=\{\(\) => \{ setMenu\(null\); ir\(t\.key\); onChange\?\.\(t\.key\); \}\}/, 'el atajo va por el mismo camino que el desplegable');
  assert.match(t, /<MenuHojasFicha /, 'el desplegable del título se fue (es donde se crea y se ordena una hoja)');
  assert.match(t, /\.lt-nueva, \.lt-hoja-mas, \.lt-atajos \{ display: none; \}/, 'en el teléfono, sólo el desplegable');
});

