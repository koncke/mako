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
  const i = t.indexOf('title: `Editar etapas de ${comoSeLlama(f)}`');
  assert.ok(i > 0);
  assert.match(t.slice(i, i + 200), /cierra: true,/);
  // La marca la entiende el desplegable de la casa.
  assert.match(leer('app/components/Dropdown.tsx'), /a\.onClick\(\); if \(a\.cierra\) close\(\);/);
});

// ⚠️ REESCRITO EL 24/10/2026: Martín pidió TABS de verdad («rediseña el estilo de las tabs... donde está el desplegable en
//    la primera... mira como lo hacen otras apps»). Lo que C7 cuidaba sigue, más fuerte: TODAS las hojas a la vista, también
//    en el teléfono (antes ahí sólo quedaba el desplegable).
test('C7: todas las hojas de la ficha a la vista, como tabs del mismo rango (también en el teléfono)', () => {
  const t = sinComentarios(leer('app/crm/lead-view/LeadTabs.tsx'));
  assert.match(t, /<div ref=\{lista\} role="tablist" aria-label="Hojas de la ficha"/);
  // Las que no entran van a «Ver más» desde el 24/10/2026 (tests/ficha-ver-mas.test.ts): siguen siendo tabs, a un clic.
  assert.match(t, /\{enFila\.map\(\(t\) => \{/, 'cada hoja es una tab, la abierta también');
  assert.match(t, /\{enVerMas\.map\(\(t\) => \(/, 'las que no entran, en «Ver más»');
  assert.match(t, /const elegir = \(key: string\) => \{ setMenu\(null\); setVerMas\(null\); ir\(key\); onChange\?\.\(key\); \};/);
  assert.match(t, /onClick=\{\(\) => elegir\(t\.key\)\}/, 'una tab va por el camino de siempre');
  assert.doesNotMatch(t, /MenuHojasFicha|lt-atajos|lt-tit-btn/, 'volvió el título con desplegable');
  assert.match(t, /@media \(max-width: 720px\) \{[^\n]*\.lt-accion \{ display: none; \} \}/, 'en el teléfono se esconde sólo lo de personalizar');
  assert.doesNotMatch(t, /\.lt-tabs \{ display: none/, 'en el teléfono las tabs no se esconden');
});


// C6 (min ~13): «los tres puntos de "Lead entrante" lo mandaron a otro lado». Reproducido el 22/10/2026 en el Chrome de
// Martín (ws3, y el principal y «Sprint 3 días» del ws1): el «⋯» de una columna trae sólo pop-ups (Asignar campañas,
// Cambiar el nombre, Agregar etapa). El ÚNICO renglón de los menús del CRM que abre otra pantalla es «Buscar prospectos»,
// del «⋯» de la barra (/crm/prospectos). Y «Volver al CRM» de allá iba a /crm pelado: desde «Sprint 3 días» devolvía al
// CRM principal. Probado rompiéndolo (base 5 / 0): sin la flecha → 4 / 1 · sin llevar el CRM → 4 / 1 · «Volver» a /crm
// pelado → 4 / 1.
// 25/10/2026: «Buscar prospectos» se fue con el Leads Scraper entero (tests/leads-scraper-retirado.test.ts), y con él la
// pantalla y su «Volver». Queda la regla: un renglón que navega lo DICE con la flecha.
test('C6: el renglón que navega lo dice, y el «⋯» ya no manda a la pantalla de prospectos', () => {
  const t = sinComentarios(leer('app/crm/CrmToolbar.tsx'));
  assert.match(t, /\{href && <span aria-hidden style=\{\{ marginLeft: 'auto', fontSize: 13, color: 'var\(--faint\)' \}\}>→<\/span>\}/, 'el renglón que navega no lo dice');
  assert.doesNotMatch(t, /crm\/prospectos/, 'volvió el renglón a la pantalla de prospectos');
  assert.doesNotMatch(sinComentarios(BOARD), /crm\/prospectos/, 'el clic derecho del tablero sigue mandando a prospectos');
});
