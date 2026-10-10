// =============================================================================
// «¿Qué hacer ahora?» del CRM: una sola capa en la pila por pantalla
// =============================================================================
// Medido en producción el 09/10/2026, grabando el video de verificación de Google: el botón
// «¿Qué hacer ahora?» de una reunión que ya pasó no abría nada. El diálogo estaba montado, con
// su texto, adentro de un contenedor en `display:none` y z 130.
//
// La causa: `CrmBoard` registraba `useCapaModal(!!queHacer)` mientras el formulario estaba
// abierto, y adentro el `WizardShell` registra SU propia capa. Son dos capas para una sola
// pantalla, y React corre el efecto del HIJO antes que el del padre: el wizard entraba primero a
// la pila, la capa del tablero quedaba arriba, y `decidirVisible` apagaba al wizard. Arriba no
// había nada que dibujar (el overlay propio del tablero sólo existe con el resultado del
// reagendado, `reagOut`).
//
// Probado ROMPIÉNDOLO (09/10/2026): devolviendo `useCapaModal(!!queHacer)`, 1 fallo y 2 pases.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decidirVisible } from '../app/_components/pila-modales';

const leer = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('la capa propia de «¿Qué hacer ahora?» existe sólo mientras se ve el resultado del reagendado', () => {
  const src = sinComentarios(leer('app/crm/CrmBoard.tsx'));
  assert.match(src, /const capaQueHacer = useCapaModal\(!!queHacer && !!reagOut\);/,
    'con `!!queHacer` a secas son dos capas (la del tablero y la del WizardShell) y el wizard queda apagado');
});

test('las preguntas las dibuja el WizardShell sólo sin resultado, y el overlay propio sólo con él', () => {
  const src = sinComentarios(leer('app/crm/CrmBoard.tsx'));
  assert.match(src, /\{queHacer && reagOut && \(/, 'el overlay del resultado cuelga de `reagOut`');
  const i = src.indexOf('{queHacer && !reagOut && (() => {');
  assert.ok(i > 0, 'las preguntas cuelgan de `!reagOut`');
  assert.ok(src.indexOf('<WizardShell', i) > i, 'y las dibuja el WizardShell');
});

test('el mecanismo: una capa del padre registrada DESPUÉS que la del hijo lo apaga', () => {
  // Así quedaba la pila: el wizard (hijo) entra primero; el tablero (padre), después.
  const pila = ['wizard', 'tablero'];
  assert.equal(decidirVisible(pila, 'wizard', new Set(), new Set()), false, 'si esto cambia, revisar el comentario de CrmBoard');
  // Con una sola capa (la del wizard), se ve.
  assert.equal(decidirVisible(['wizard'], 'wizard', new Set(), new Set()), true);
});
